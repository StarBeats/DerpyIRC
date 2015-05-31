$(function() {
    // Our global object
    window.irc = window.irc || {};

    // socket.io init
    var socket = io.connect();
    
    // jQuery UI 
    $(document).tooltip();
    $("#dialog").dialog({ autoOpen: false, width: 900, maxHeight: 600 });
    
    // MODELS & COLLECTIONS
    // ====================
    var Message = Backbone.Model.extend({
        defaults: {
            // expected properties:
            // - sender
            // - raw
            // optionally or afterwards set properties:
            // - kickee (kick message)
            // - time
            'type': 'message'
        },

        initialize: function() {
            if (this.get('raw')) {
                this.set({text: irc.util.ParseColors(this.parse( irc.util.escapeHTML(this.get('raw')) ))});
            }
            this.set({time: new Date()});
        },

        parse: function(text) {
            return this._linkify(text);
        },

        // Set output text for status messages
        setText: function() {
            var text = '';
            switch (this.get('type')) {
                case 'join':
                    text = this.get('nick') + ' has joined the channel';
                    break;
                case 'part':
                    text = this.get('nick') + ' has left the channel ('+this.get("text")+')';
                    break;
                case 'quit':
                    text = this.get('nick') + ' has quit ('+this.get("text")+')';
                    break;
                case 'action':
                    text = '* '+ this.get('nick') + ' '+this.get("text");
                    break;
                case 'nick':
                    text = this.get('oldNick') + ' is now known as ' + this.get('newNick');
                    break;
                case 'notice':
                    text = "["+this.get("nick")+"] " + this.get('text');
                    break;
                case 'mode':
                    text = this.get("nick")+' sets mode '+this.get('text');
                    break;
                case 'topic':
                    text = this.get("nick")+' set the topic of '+this.get('text');
                    break;
                case 'raw':
                    text = this.get("nick")+': '+this.get('text');
                    break;
                case 'kick':
                    text = (this.get("kickee")!=irc.me.get("nick")?this.get("kickee")+' has been':'You have been')+ ' kicked by '+this.get("nick")+' (Reason: '+this.get('text')+')';
                    break;
            }
            this.set({text: text});
        },

        // Find and link URLs
        _linkify: function(text) {
            // see http://daringfireball.net/2010/07/improved_regex_for_matching_urls
            var re = /\b((?:https?:\/\/|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/gi;
            var parsed = text.replace(re, function(url) {
                // turn into a link
                var href = url;
                if (url.indexOf('http') !== 0) {
                    href = 'http://' + url;
                }
                return '<a href="' + href + '" target="_blank">' + url + '</a>';
            });
            return parsed;
        }
    });

    var Stream = Backbone.Collection.extend({
        model: Message
    });

    var Person = Backbone.Model.extend({
        defaults: {
            opStatus: ''
        }
    });

    var Participants = Backbone.Collection.extend({
        model: Person,
        getByNick: function(nick) {
            return this.detect(function(person) {
                var p = person.get('nick') == nick;
                if(p)
                    return person;
            });
        }
    });

    var Frame = Backbone.Model.extend({
        defaults: {
            'type': 'channel',
            'active': true,
            'server':''
        },

        initialize: function() {
            this.stream = new Stream;
            this.participants = new Participants;
        },

        part: function() {
        }

    });

    var FrameList = Backbone.Collection.extend({
        model: Frame,

        getByName: function(name) {
            return this.detect(function(frame) {
                if(frame.get('name').toLowerCase() === name.toLowerCase())
                    return frame;
            });
        },

        getByServer: function(name) {
            return this.detect(function(frame) {
                if(frame.get('server').toLowerCase() === name.toLowerCase())
                    return frame;
            });
        },

        getActive: function() {
            return this.detect(function(frame) {
                if(frame.get('active') == true)
                    return frame;
            });
        },

        setActive: function(frame) {
            this.each(function(frm) {
                frm.set({active: false});
            });

            frame.set({active: true});
        },

        getChannels: function() {
            return this.filter(function(frame) {
                if(frame.get('type') == 'channel')
                    return frame;
            });
        }
 
    });
    window.frames = new FrameList;


    // VIEWS
    // =====
    var MessageView = Backbone.View.extend({
        tmpl: $('#message-tmpl').html(),
        initialize: function() {
            this.render();
        },

        render: function() {
            var context = {
                sender: this.model.get('sender'),
                text: this.model.get('text'),
            };
            if(irc.util.variables.showDate === true)
                context["timestamp"] = this.model.get("time").format(irc.util.variables.dateFormat, irc.util.variables.dateUTC);
            
            var html = Mustache.to_html(this.tmpl, context);
            $(this.el).addClass(this.model.get('type'))
                      .html(html);
                      
            if((context.sender && context.sender.toLowerCase() !== irc.me.get("nick").toLowerCase()) && 
                (context.text && context.text.contains(irc.me.get("nick"))))
                $(this.el).addClass("mentioned");
            
            return this;
        }
    });

    var NickListView = Backbone.View.extend({
        el: $('.nicks'),
        bound: null,
        initialize: function() {
            _.bindAll(this);
        },
        
        switchChannel: function(ch) {
            if(ch.get("type") === "channel")
                this.bound = ch;
            ch.participants.bind('add', this.addOne, this);
            ch.participants.bind('change', this.changeNick, this);
            ch.participants.bind('update', this.update, this);
        },

        addOne: function(p) {
            if(this.bound)
                this.update(this.bound.participants);
        },
        
        update: function(participants) {
            $(this.el).html("");
            this.addAll(participants);
        },

        addAll: function(participants) {
            var nicksSorted = [];
            var nicks2 = [];
            
            participants.each(function(p) {
                nicksSorted.push(p.get('opStatus') + p.get('nick'));
            }, this);
            
            nicksSorted = irc.util.sortNamesArray(nicksSorted);
            
            nicksSorted.forEach(function(e) {
                var opstat = (irc.util.opNickRegex.test(e) ? e.substring(0, 1) : "");
                var nickn = (irc.util.opNickRegex.test(e) ? e.substring(1) : e);
                nicks2.push('<div class="listednick" id="'+ nickn +'">'+(opstat.isEmpty() ? "" : '<span class="opstat" title="'+ irc.util.getPrefixName(opstat) +'">'+ opstat +'</span>')+' <span class="nickname">'+ nickn +'</span></div>');
            });
            $(this.el).html(nicks2.join('\n'));
            var ops = irc.util.WhoisOp(nicksSorted);
            $('#nickcount').text(nicksSorted.length+" User"+(nicksSorted.length !== 1 ? "s" : "")+" ("+ops.length+" op"+(ops.length !== 1 ? "s" : "")+")");
        },

        changeNick: function() {
            if(this.bound)
                this.update(this.bound.participants);
        }
        
    });
    var nickList = new NickListView;

    var FrameView = Backbone.View.extend({
        el: $('#frame'),
        // to track scroll position
        position: {},

        initialize: function() {
            _.bindAll(this);
        },

        addMessage: function(message, single) {
            // Only do this on single message additions
            if (single) {
                var position = $('#messages').scrollTop();
                var atBottom = $('#messages')[0].scrollHeight - position
                             == $('#messages').innerHeight();
            }
            var view = new MessageView({model: message});
            $('#messages').append(view.el);
            // Scroll to bottom on new message if already at bottom
            if (atBottom) {
                $('#messages').scrollTop(position + 100);
            }
        },

        updateTopic: function(channel) {
            this.$('#topic').text(channel.get('topic')).show();
            setMessageBox();
        },

        // Switch focus to a different frame
        focus: function(frame) {
            // Save scroll position for frame before switching
            if (this.focused) {
                this.position[this.focused.get('name')] = $('#output #messages').scrollTop();
            }
            this.focused = frame;
            frames.setActive(this.focused);
            $('#messages').empty();

            frame.stream.each(function(message) {
                this.addMessage(message, false);
            }, this);

            nickList.addAll(frame.participants);

            if (frame.get('type') == 'channel') {
                this.$('#sidebar').show();
                frame.get('topic') && this.updateTopic(frame);
            } else {
                this.$('#sidebar').hide();
                this.$('#topic').hide();
            }
            $(this.el).removeClass().addClass(frame.get('type'));
            var position = this.position[frame.get('name')];
            
            $('#output #messages').scrollTop((position ? position : 0));
            
            // Only the selected frame should send messages
            frames.each(function(frm) {
                frm.stream.unbind('add');
                frm.participants.unbind();
                frm.unbind();
            });
            frame.bind('change:topic', this.updateTopic, this);
            frame.stream.bind('add', this.addMessage, this);
            nickList.switchChannel(frame);
            
            setMessageBox();
        },

        updateNicks: function(model, nicks) {
            console.log('Nicks rendered');
        }
    });

    var FrameTabView = Backbone.View.extend({
        tagName: 'li',
        tmpl: $('#tab-tmpl').html(),

        initialize: function() {
            this.model.bind('destroy', this.close, this);
            this.render();
        },

        events: {
            'click .name': 'setActive',
            'click .close-frame': 'close'
        },

        // Send PART command to server
        part: function() {
            if (this.model.get('type') === 'channel') {
                socket.emit('part', this.model.get('name'));
            }
            var mframe = frames.getByName(this.model.get('name'));
            if(mframe) {
                frames.remove(mframe);
                mframe.destroy();
                this.model.destroy();
            }
        },

        // Close frame
        close: function() {
            // Focus on next frame if this one has the focus
            if ($(this.el).hasClass('active')) {
                // Go to previous frame unless it's status
                if ($(this.el).prev().text().trim() !== 'status') {
                    $(this.el).prev().click();
                } else {
                    $(this.el).next().click();
                }
            }
            var d = $(this.el).text().trim();
            if(d !== "status") {
                var frame = frames.getByName(d); 
                if(frame) {
                    this.part();
                    $(this.el).remove();
                }
            }
        },

        // Set as active tab; focus window on frame
        setActive: function() {
            console.log('View setting active status');
            $(this.el).addClass('active')
                .siblings().removeClass('active');
            irc.frameWindow.focus(this.model);
        },

        render: function() {
            console.log(this.model);
            var self = this;
            var context = {
                text: this.model.get('name'),
                type: this.model.get('type'),
                isStatus: function() {
                    return self.model.get('type') == 'status';
                }
            };
            var html = Mustache.to_html(this.tmpl, context);
            $(this.el).html(html);
            return this;
        }
    });

    var AppView = Backbone.View.extend({
        el: $('#content'),
        testFrames: $('#sidebar .frames'),
        frameList: $('header .frames'),

        initialize: function() {
            frames.bind('add', this.addTab, this);
            this.input = this.$('#prime-input');
            this.render();
        },

        events: {
            'keypress #prime-input': 'sendInput',
            'click .opensettings': 'openSettings',
        },
    
        openSettings: function() {
            settings.render();
        },
    
        addTab: function(frame) {
            var tab = new FrameTabView({model: frame});
            this.frameList.append(tab.el);
            tab.setActive();
        },

        joinChannel: function(name) {
            socket.emit('join', name);
        },

        parse: function(text) {
            var command = text.split(' ')[0];
            console.log(command);
            var revised = '';
            switch (command) {
                case 'msg':
                    revised = 'privmsg';
                    break;
                case 'me':
                    revised = 'action';
                    break;
                case 'raw':
                    revised = 'quote';
                    break;
                default:
                    revised = command;
                    break;
            }
            return irc.util.swapCommand(command, revised, text);
        },

        sendInput: function(e) {
            if (e.keyCode != 13) return;
            var frame = irc.frameWindow.focused,
                input = this.input.val();

            if (input.indexOf('/') === 0) {
                var parsed = this.parse(input.substr(1));
                var msgParts = parsed.split(' ');
                if (msgParts[0].toLowerCase() === 'privmsg') {
                    console.log(msgParts);
                    pm = frames.getByName(msgParts[1]);
                    if(pm)
                        pm.stream.add({sender: irc.me.get('nick'), raw: msgParts[2]});
                    else {
                        pm = new Frame({type: 'pm', name: msgParts[1]});
                        pm.stream.add({sender: irc.me.get('nick'), raw: msgParts[2]});
                        frames.add(pm);
                    }
                    socket.emit('command', ["privmsg", msgParts[1], msgParts.slice(2).join(" ")]);
                } else if (msgParts[0].toLowerCase() === 'quote') {
                    console.log(msgParts);
                    socket.emit("quote", {command:msgParts[1], args:msgParts.slice(2).join(" ")});
                } else if (msgParts[0].toLowerCase() === 'join') {
                    socket.emit('join', msgParts[1]);
                } else if (msgParts[0].toLowerCase() === 'part') {
                    if(msgParts[1] && !msgParts[1].isEmpty()) {
                        if(msgParts[1].indexOf('#')!==-1 || msgParts[1].indexOf('&')!==-1) {
                            buffr = frames.getByName(msgParts[1]);
                            if(buffr) { 
                                buffr.stream.add({type: 'error', raw: "You are no longer talking in "+msgParts[1]});
                                buffr.participants.reset();
                            }
                            socket.emit('part', msgParts[1]);
                        }
                    } else {
                        buffrNow = frames.getActive();
                        if(buffrNow.get("type") === "channel") {
                            socket.emit('part', buffrNow.get("name"));
                            buffrNow.stream.add({type: 'error', raw: "You are no longer talking in "+buffrNow.get("name")});
                            buffrNow.participants.reset();
                        }
                    }
                } else if (msgParts[0].toLowerCase() === 'action') {
                    if(!msgParts[1].isEmpty()) {
                        buffr = frames.getActive();
                        if(buffr) { 
                            if(buffr.get("type") == "pm" || buffr.get("type") == "channel") {
                                var messageToSend = msgParts.slice(1).join(" ");
                                socket.emit('action', {target:buffr.get('name'), message:messageToSend});
                                var meMessage = new Message({type: 'action', nick: irc.me.get("nick"), raw: messageToSend});
                                meMessage.setText();
                                buffr.stream.add(meMessage);
                            }
                        }
                    }
                } else if (msgParts[0].toLowerCase() === 'quit') {
                    buffr = frames.getActive();
                    if(buffr) { 
                        var message = parsed.substring(4);
                        message = (message.isEmpty() ? "DerpyIRC - Chat for the derpy" : message);
                        buffr.stream.add({type: 'error', raw: "You have quit the server."});
                        console.log(message);
                        socket.emit('ircdisconnect', message);
                    }
                } else if (msgParts[0].toLowerCase() === 'topic') {
                    buffr = frames.getActive();
                    if(buffr) { 
                        if(irc.util.isChannel(buffr.get("name"))) {
                            var message = parsed.substring(5);
                            if(!message.isEmpty())
                                socket.emit("topic", {channel:buffr.get("name"), topic:message});
                        }
                    }
                } else if (msgParts[0].toLowerCase() === 'whois') {
                    buffr = frames.getActive();
                    if(buffr) { 
                        var message = parsed.substring(5);
                        if(!message.isEmpty())
                            socket.emit("swhois", message.substring(1));
                    }
                } else if (msgParts[0].toLowerCase() === 'nick') {
                    buffr = frames.getActive();
                    if(buffr) { 
                        var message = parsed.substring(5);
                        if(!message.isEmpty())
                            socket.emit("changenick", message);
                    }
                } else {
                    socket.emit('command', msgParts.join(" "));
                }
            } else {
                socket.emit('say', {
                    target: frame.get('name'),
                    message: input
                });
                frame.stream.add({sender: irc.me.get('nick'), raw: input});
            }

            this.input.val('');
        },

        render: function() {
            this.el.show();
        }

    });
    
    var ConnectView = Backbone.View.extend({
        el: $('#connect'),
        events: {
            'click .btn': 'connect',
            'keypress': 'connectOnEnter'
        },

        initialize: function() {
            _.bindAll(this);
            this.render();
            this.getUserSettings();
        },
        
        render: function() {
            //this.el.modal({backdrop: true, show: true});
            this.el.show();
            $('#connect-nick').focus();
            $('#expand').click(function() {
                $('#load-more-arrow').toggleClass('nintydeg');
                $('#serverfix').slideToggle();
            });
            var nickd = irc.util.getURLParam("nick");
            var chand = window.location.hash;
            var served = irc.util.getURLParam("server");
            var portd = irc.util.getURLParam("port");
            
            if(nickd)
                $('#connect-nick').val(nickd.replace("?", Math.floor(Math.random() * 6000) + 1));
            if(chand && irc.util.isChannel(chand))
                $('#connect-channels').val(chand);
            if(served)
                $('#connect-server').val(served);
            if(portd)
                $('#connect-server-port').val(portd);
        },
        
        getUserSettings: function() {
            if(typeof(localStorage)!==void(0) && typeof(JSON)!==void(0)) {
                var it = localStorage.getItem("settings");
                if(it) {
                    var parsed = JSON.parse(it);
                    irc.util.changeValuesIfPresent(parsed, irc.util.variables);
                }
            }
            if(irc.util.variables.theme !== "default") {
                irc.util.switchTheme(irc.util.variables.theme);
            }
        },
        
        connectOnEnter: function(e) {
            if (e.keyCode != 13) return;
            this.connect();
        },

        connect: function(e) {
            e && e.preventDefault();
            
            var channelInput = $('#connect-channels').val(),
                channels = channelInput ? channelInput.split(' ') : [];
            var connectInfo = {
                nick: $('#connect-nick').val(),
                server: $('#connect-server').val(),
                port: $('#connect-server-port').val(),
                password: $('#connect-server-pass').val().isEmpty() ? null : $('#connect-server-pass').val(),
                secure: $('#connect-secure').is(':checked'),
                channels: channels
            };

            socket.emit('ircconnection', connectInfo);

            irc.me = new Person({nick: connectInfo.nick});
            
            $('#notify').show();

            if(!$('#nickserv-pass').val().isEmpty())
                irc.me.set({nickserv:$('#nickserv-pass').val()});
                
            irc.frameWindow = new FrameView;
            irc.app = new AppView;
            // Create the status "frame"
            frames.add({name: 'status', type: 'status', server:connectInfo.server});
        }
        
    });

    var connect = new ConnectView;
    
    var SettingsView = Backbone.View.extend({
        el: $('#settingsframe'),
        tmpl: $('#type-tmpl').html(),
        tmpl2: $('#theme-tmpl').html(),
        events: {
            'keypress': 'closeKey'
        },

        initialize: function() {},
        
        render: function() {
            var visibl = false;
            
            if(this.el.is(':visible'))
                visibl = true;
            
            this.el.fadeToggle('fast');
            
            if(visibl === true)
                return;
            
            $('#stn-timestamp').val(irc.util.variables.dateFormat);
            $('#stn-timestamp').focusout(function() {
                irc.util.variables.dateFormat = $('#stn-timestamp').val();
                settings.saveSettings();
            });
            
            $('#stn-timestamp-utc').prop("checked", irc.util.variables.dateUTC);
            $('#stn-timestamp-utc').change(function() {
                irc.util.variables.dateUTC = $('#stn-timestamp-utc').is(':checked');
                settings.saveSettings();
            });
            
            $('#stn-timestamp-show').prop("checked", irc.util.variables.showDate);
            $('#stn-timestamp-show').change(function() {
                irc.util.variables.showDate = $('#stn-timestamp-show').is(':checked');
                settings.saveSettings();
            });
            
            $('#messageTypes').html('');
            $('.themelist').html('');
            
            $.each(irc.util.messageTypes, function(i, v) {
                i = i.toUpperCase();
                var context = { type: i };
                if(v == false)
                    context['o'] = true;
                    
                var html = Mustache.to_html(settings.tmpl, context);
                $('#messageTypes').append(html);
            });
            
            $.each(irc.util.themes, function(i, v) {
                var context = { theme: i, themename: v[1], color: v[2] };
                if(irc.util.variables.theme === i)
                    context['s'] = true;
                    
                var html = Mustache.to_html(settings.tmpl2, context);
                $('.themelist').append(html);
            });
            
            $('.theme').click(function() {
                var t = $(this);
                var d = t.data("theme");
                var th = irc.util.themes[d];
                if(th != null) {
                    if(d != irc.util.variables.theme) {
                        irc.util.switchTheme(d, true);
                        settings.saveSettings();
                    }
                }
            });
            
            $('.messageType').click(function() {
                var t = $(this);
                var d = t.data("message-type");
                if(d) {
                    if(irc.util.messageTypes[d.toLowerCase()] != null) {
                        t.toggleClass("disabled");
                        irc.util.toggleTypes(d.toLowerCase());
                    }
                }
            });
        },
        
        saveSettings: function() {
            if(typeof(localStorage)!==void(0) && typeof(JSON)!==void(0)) {
                var parsed = JSON.stringify(irc.util.variables);
                localStorage.setItem("settings", parsed);
            }
        },
        
        closeKey: function(e) {
            if (e.keyCode != 28) return;
            this.close();
        },

        close: function() {
           this.el.fadeOut('fast');
        }
        
    });
    
    var settings = new SettingsView;
    
    // UTILS
    // =====
    function humanizeError(message) {
        var text = '';
        switch (message.command) {
            case 'err_unknowncommand':
                text = 'That is not a known IRC command.';
                break;
            case 'err_cannotsendtochan':
                text = 'Failed to send message to channel';
                break;
            case 'err_passwdmismatch':
                text = 'Incorrect Password.';
                break;
            default:
                text = message.args[2];
                break;
        }
        return text;
    }

    function setMessageBox() {
        var sheet = irc.util.getStyleSheetById(document.styleSheets, "custom-styles");
        var rules = 'cssRules' in sheet? sheet.cssRules : sheet.rules;

        if($('#topic').css("display") !== "none") {
            $('#messages').css('top', "30px");
        } else {
            $('#messages').css('top', "0");
        }
        
        if($('#sidebar').css("display") !== "none") {
            $('#messages').css('right', "205px");
            $('#topic').css('right', "200px");
        } else {
            $('#messages').css('right', "0");
            $('#topic').css('right', "0");
        }
        
        if(irc.util.variables.showDate === true) {
            $('.gutter').css('width', "185px");
            rules[0].style["margin-left"] = '185px';
        } else {
            $('.gutter').css('width', "110px");
            rules[0].style["margin-left"] = '115px';
        }
    }
    
    // SOCKET EVENTS
    // =============
    socket.on('message', function(msg) {
        // Filter out messages not aimed at a channel or status (i.e. PMs)
        if (!irc.util.isChannel(msg.to) &&
            msg.to !== 'status') return;
        frame = frames.getByName(msg.to);
        if (frame) {
            frame.stream.add({sender: msg.from, raw: msg.text});
        }
    });
    
    // Raw messages from the server, for handling other commands.
    socket.on('raw', function(input) {
        var msg = input.message;
        if(msg!=null) {
            if(msg.command === "PRIVMSG") {
                if (msg.args[0].indexOf('#') !== 0 &&
                    msg.args[0].indexOf('&') !== 0) return;
                if(msg.args[1].indexOf("\u0001ACTION ") === 0) {
                    channel = frames.getByName(msg.args[0]);
                    if(channel) {
                        var meMessage = new Message({type: 'action', nick: msg.nick, raw: msg.args[1].substring("\u0001ACTION ".length)});
                        meMessage.setText();
                        channel.stream.add(meMessage);
                    }
                }
            } else if(msg.command === "rpl_liststart") {
                $('#dialog').html('<span class="chanlist"><span class="lchannel">#Channel</span><span class="lusers">Users</span><span class="ltopic">Topic</span></span><br>');
            } else if(msg.command === "rpl_list") {
                $('#dialog').append('<span class="chanlist"><span class="lchannel">'+msg.args[1]+'</span><span class="lusers">'+msg.args[2]+'</span>'+(msg.args[3]!=null?'<span class="ltopic">'+irc.util.escapeHTML(msg.args[3])+'</span>':'')+'</span><br>');
            } else if(msg.command === "rpl_listend") {
                $('#dialog').dialog("open");
            } else if(msg.command === "KICK") {
                statusbuffer = frames.getByName(msg.args[0]);
                if(statusbuffer) {
                    var rawMessage = new Message({type: 'kick', nick: msg.nick, kickee: msg.args[1], raw: (msg.args[2]!=null?msg.args[2]:"No reason given")});
                    rawMessage.setText();
                    statusbuffer.stream.add(rawMessage);
                }
            } else if(irc.util.ircCommand(msg.command, msg.args)!=null) {
                var bar = irc.util.ircCommand(msg.command, msg.args);
                statusbuffer = frames.getByName("status");
                var rawMessage = new Message({type: 'raw', nick: msg.server, raw: bar});
                rawMessage.setText();
                statusbuffer.stream.add(rawMessage);
            }
        }
        console.log(input);
    });
    
    // Private message event
    socket.on('pm', function(msg) {
        pm = frames.getByName(msg.nick)
        if(pm && pm.get("type") === "pm") {
            pm.stream.add({sender: msg.nick, raw: msg.text});
        } else {
            pm = new Frame({type: 'pm', name: msg.nick});
            pm.stream.add({sender: msg.nick, raw: msg.text});
            frames.add(pm);
        }
    })

    // Message of the Day event (on joining a server)
    socket.on('motd', function(data) {
        data.motd.split('\n').forEach(function(line) {
            frames.getByName('status').stream.add({sender: '', raw: line});
        });
    });
    
    // Response for whois event
    socket.on('whois', function(data) {
        if(typeof(data.message.nick) !== "undefined") {
            frames.getByName('status').stream.add({sender: '', raw: "* [WHOIS] Started whois on "+data.message.nick});
            $.each(data.message, function(index, value) {
                frames.getByName('status').stream.add({sender: '', raw: "* [WHOIS] "+index+": "+value});
            });
            frames.getByName('status').stream.add({sender: '', raw: "* [WHOIS] End of /whois"});
        }
    });

    // Join channel event
    socket.on('join', function(data) {
        if (data.nick == irc.me.get('nick')) {
            if(!frames.getByName(data.channel))
                frames.add({name: data.channel});
        } else {
            channel = frames.getByName(data.channel);
            channel.participants.add({nick: data.nick});
            var joinMessage = new Message({type: 'join', nick: data.nick});
            joinMessage.setText();
            channel.stream.add(joinMessage);
        }
    });

    // Part channel event
    socket.on('part', function(data) {
        if (data.nick === irc.me.get('nick')) {
            channel = frames.getByName(data.channel);
            if(channel) {
                var partMessage = new Message({type: 'part', nick: data.nick, raw: data.reason});
                partMessage.setText();
                channel.stream.add(partMessage);
                channel.stream.add({type: 'error', raw: "You are no longer talking in "+channel.get("name")});
                channel.participants.reset();
            }
        } else {
            channel = frames.getByName(data.channel);
            channel.participants.getByNick(data.nick).destroy();
            var partMessage = new Message({type: 'part', nick: data.nick, raw: data.reason});
            partMessage.setText();
            channel.stream.add(partMessage);
            if(channel.get("active") === channel)
                nickList.update(channel.participants);
        }
    });
    
    // Quit channel event
    socket.on('quit', function(data) {
        data.channels.forEach(function(ch) {
            var channel = frames.getByName(ch);
            if(channel) {
                nick = channel.participants.getByNick(data.nick)
                if(nick) {
                    nick.destroy();
                    var quitMessage = new Message({type: 'quit', nick: data.nick, raw: data.reason});
                    quitMessage.setText();
                    channel.stream.add(quitMessage);
                    if(channel.get("active"))
                        nickList.update(channel.participants);
                }
            }
        });
    });

    // Set topic event
    socket.on('topic', function(data) {
        var channel = frames.getByName(data.channel);
        if(channel) {
            channel.set({topic: data.topic});
            var topicmsg = new Message({type: 'topic', nick: data.nick, raw: data.channel+" to "+data.topic});
            topicmsg.setText();
            channel.stream.add(topicmsg);
        }
    });
    
    // Set mode event
    socket.on('+mode', function(data) {
        var buffr = frames.getByName(data.channel);
        if(buffr) {
            var sentby = (typeof(data.by) === "undefined" ? "Server" : data.by);
            if(typeof(data.argument) === "undefined") {
                var modemsg = new Message({type: 'mode', nick: sentby, raw: "+"+data.mode+" on "+data.channel});
                modemsg.setText();
                buffr.stream.add(modemsg);
            } else {
                var modemsg = new Message({type: 'mode', nick: sentby, raw: "+"+data.mode+" on "+data.argument});
                modemsg.setText();
                buffr.stream.add(modemsg);
                if(buffr.participants && buffr.participants.getByNick(data.argument)) {
                    // TODO: Remove this stupid work-around
                    if((buffr.participants.getByNick(data.argument).get("opStatus") === "~" || buffr.participants.getByNick(data.argument).get("opStatus") === "&") && data.mode === "o")
                        return;
                    else
                        buffr.participants.getByNick(data.argument).set({opStatus:irc.util.getPrefixFromMode(data.mode)});
                }
            }
        }
    });
    
    // Remove mode event
    socket.on('-mode', function(data) {
        var buffr = frames.getByName(data.channel);
        if(buffr) {
            var sentby = (typeof(data.by) === "undefined" ? "Server" : data.by);
            if(typeof(data.argument) === "undefined") {
                var modemsg = new Message({type: 'mode', nick: sentby, raw: "-"+data.mode+" on "+data.channel});
                modemsg.setText();
                buffr.stream.add(modemsg);
            } else {
                var modemsg = new Message({type: 'mode', nick: sentby, raw: "-"+data.mode+" on "+data.argument});
                modemsg.setText();
                buffr.stream.add(modemsg);
                if(buffr.participants && buffr.participants.getByNick(data.argument)) 
                    buffr.participants.getByNick(data.argument).set({opStatus:''});
            }
        }
    });
    
    // Notice event
    socket.on('notice', function(data) {
        console.log("notice ", data);
        if(irc.util.isChannel(data.to)){
            var deff = frames.getByName(data.to);
            if(deff) {
                var notice = new Message({type: 'notice', nick: data.nick, raw: data.text});
                notice.setText();
                deff.stream.add(notice);
            }
        } else {
            var deff = frames.getByName("status");
            if(deff) {
            var notice = new Message({type: 'notice', nick: data.nick || "NOTICE", raw: data.text});
                notice.setText();
                deff.stream.add(notice);
            }
        }
        if((data.nick && data.text) && (data.nick.toLowerCase() === "nickserv" && data.text.toLowerCase().contains("/msg nickserv identify") && irc.me.get("nickserv") != null)) {
            socket.emit('say', {target: "nickserv", message: "identify "+irc.me.get("nickserv")});
        }
    });
    
    // Nick change event
    socket.on('nick', function(data) {
        // Update my info, if it's me
        if (data.oldNick == irc.me.get('nick')) {
            irc.me.set({nick: data.newNick});
        }
        // Set new name in all channels
        data.channels.forEach(function(ch) {
            var channel = frames.getByName(ch);
            // Change nick in user list
            if(channel) {
                channel.participants.getByNick(data.oldNick).set({nick: data.newNick});
                // Send nick change message to channel stream
                var nickMessage = new Message({
                    type: 'nick',
                    oldNick: data.oldNick,
                    newNick: data.newNick
                });
                nickMessage.setText();
                channel.stream.add(nickMessage);
            }
        });
    });
    
    // Channel names event (for getting users in the channel)
    socket.on('names', function(data) {
        var frame = frames.getByName(data.channel);
        console.log(data);
        for (var nick in data.nicks) {
            frame.participants.add({nick: nick, opStatus: data.nicks[nick]});
        }
    });
    
    // On socket disconnected
    socket.on('disconnect', function(data) {});
    
    socket.on('serverconnected', function(network, vars, data) {
        $('#connect').hide();
    });

    // Server error event
    socket.on('errorevent', function(data) {
        console.log(data);
        frame = frames.getActive();
        if(frame){
            error = humanizeError(data);
            frame.stream.add({type: 'error', raw: error});
        }
    });
});