#!/usr/bin/env node

var connect = require('connect'),
    dir = __dirname+"/public",
    app = connect.createServer(connect.static(dir)).listen(8337),
    io = require('socket.io')(app),
    irc = require('irc'),
    debugmode = false;

console.log('DerpyIRC started on port %s', app.address().port);

// Socket.IO
io.on('connection', function(socket) {
    // Events to signal TO the front-end
    var events = {
        'join': ['channel', 'nick'],
        'part': ['channel', 'nick', 'reason'],
        'quit': ['nick', 'reason', 'channels'],
        'notice': ['nick', 'to', 'text'],
        'topic': ['channel', 'topic', 'nick'],
        'nick': ['oldNick', 'newNick', 'channels'],
        'names': ['channel', 'nicks'],
        'message': ['from', 'to', 'text'],
        'pm': ['nick', 'text'],
        'motd': ['motd'],
        'raw': ['message'],
        '+mode': ['channel', 'by', 'mode', 'argument'],
        '-mode': ['channel', 'by', 'mode', 'argument'],
        'whois': ['message'],
    };
    
    socket.on('ircconnection', function(data) {
        var client = new irc.Client(data.server, data.nick, {
            showErrors: debugmode,
            channels: data.channels,
            autoRejoin: false,
            debug: debugmode,
            secure: data.secure,
            userName: (data.nick.toLowerCase().length > 10 ? data.nick.toLowerCase().substring(0, 10) : data.nick.toLowerCase()),
            realName: 'DerpyIRC'
        });
        
        var sendRaw = function(args) {
            client.send(args[0], args[1], (args[2]!=null ? args[2] : ""), (args[3]!=null ? args[3] : ""));
        };
        
        // Socket events sent FROM the front-end
        socket.on('join', function(name) { client.join(name); });
        socket.on('part', function(name) { client.part(name); });
        socket.on('say', function(data) { client.say(data.target, data.message); });
        socket.on('action', function(data) { client.action(data.target, data.message); });
        socket.on('command', function(args) { sendRaw(args); });
        socket.on('changenick', function(newnick) { client.send("NICK", newnick); });
        socket.on('ircdisconnect', function(text) { client.disconnect(text); });
        socket.on('swhois', function(a) { client.whois(a); });
        socket.on('topic', function(a) { client.send('TOPIC', a.channel + " "+a.topic); });
        socket.on('quote', function(a) { client.send(a.command, a.args); });
        
        socket.on('disconnect', function() {client.disconnect("DerpyIRC - Chat for the derpy"); });
        
        client.on("error", function(message) { socket.emit('errorevent', message)});
        
        // Add a listener on client for the given event & argument names
        var activateListener = function(event, argNames) {
            client.addListener(event, function() {
                if(debugmode===true)
                    console.log('Event ' + event + ' sent');
                // Associate specified names with callback arguments
                // to avoid getting tripped up on the other side
                var callbackArgs = arguments;
                args = {};
                argNames.forEach(function(arg, index) {
                    args[arg] = callbackArgs[index];
                });
                if(debugmode===true)
                    console.log(args);
                socket.emit(event, args);
            });
        };

        for (var event in events) { activateListener(event, events[event]); }
    });
});
