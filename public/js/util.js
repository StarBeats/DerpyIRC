// make it safe to use console.log always
(function(b){function c(){}for(var d="assert,clear,count,debug,dir,dirxml,error,exception,firebug,group,groupCollapsed,groupEnd,info,log,memoryProfile,memoryProfileEnd,profile,profileEnd,table,time,timeEnd,timeStamp,trace,warn".split(","),a;a=d.pop();){b[a]=b[a]||c}})((function(){try
{console.log();return window.console;}catch(err){return window.console={};}})());


// POLYFILLS
// =========

if(!String.prototype.trim) {
  String.prototype.trim = function () {
    return this.replace(/^\s+|\s+$/g,'');
  };
}
// Production steps of ECMA-262, Edition 5, 15.4.4.18
// Reference: http://es5.github.com/#x15.4.4.18
if ( !Array.prototype.forEach ) {
  Array.prototype.forEach = function( callback, thisArg ) {

    var T, k;

    if ( this == null ) {
      throw new TypeError( " this is null or not defined" );
    }

    // 1. Let O be the result of calling ToObject passing the |this| value as the argument.
    var O = Object(this);

    // 2. Let lenValue be the result of calling the Get internal method of O with the argument "length".
    // 3. Let len be ToUint32(lenValue).
    var len = O.length >>> 0; // Hack to convert O.length to a UInt32

    // 4. If IsCallable(callback) is false, throw a TypeError exception.
    // See: http://es5.github.com/#x9.11
    if ( {}.toString.call(callback) != "[object Function]" ) {
      throw new TypeError( callback + " is not a function" );
    }

    // 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
    if ( thisArg ) {
      T = thisArg;
    }

    // 6. Let k be 0
    k = 0;

    // 7. Repeat, while k < len
    while( k < len ) {

      var kValue;

      // a. Let Pk be ToString(k).
      //   This is implicit for LHS operands of the in operator
      // b. Let kPresent be the result of calling the HasProperty internal method of O with argument Pk.
      //   This step can be combined with c
      // c. If kPresent is true, then
      if ( k in O ) {

        // i. Let kValue be the result of calling the Get internal method of O with argument Pk.
        kValue = O[ k ];

        // ii. Call the Call internal method of callback with T as the this value and
        // argument list containing kValue, k, and O.
        callback.call( T, kValue, k, O );
      }
      // d. Increase k by 1.
      k++;
    }
    // 8. return undefined
  };
}

if(!String.prototype.isEmpty) {
	String.prototype.isEmpty = function() {
		if(this !== null && this.length >= 0 && /\S/.test(this))
			return false;
		else
			return true;
	};
}

if(!String.prototype.hashCode) {
	String.prototype.hashCode = function() {
		var hash = 0;
		for (var i = 0; i < this.length; i++) {
		   hash = this.charCodeAt(i) + ((hash << 5) - hash);
		}
		return hash;
	};
}

if(!String.prototype.startsWith) {
	String.prototype.startsWith = function(c) {
		if(!c.isEmpty() && this.indexOf(c) === 0)
			return true;
		else
			return false;
	};
}

if(!String.prototype.contains) {
	String.prototype.contains = function(c) {
		if(!c.isEmpty() && this.indexOf(c) !== -1)
			return true;
		else
			return false;
	};
}


if(!Number.prototype.intToARGB) {
	Number.prototype.intToARGB = function(){
    return ((this>>24)&0xFF).toString(16) + 
           ((this>>16)&0xFF).toString(16) + 
           ((this>>8)&0xFF).toString(16) + 
           (this&0xFF).toString(16);
	};
}

Date.prototype.format = function (format, utc){
	var date = this;
	var MMMM = ["\x00", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
	var MMM = ["\x01", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	var dddd = ["\x02", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
	var ddd = ["\x03", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	function ii(i, len) { var s = i + ""; len = len || 2; while (s.length < len) s = "0" + s; return s; }

	var y = utc ? date.getUTCFullYear() : date.getFullYear();
	format = format.replace(/(^|[^\\])yyyy+/g, "$1" + y);
	format = format.replace(/(^|[^\\])yy/g, "$1" + y.toString().substr(2, 2));
	format = format.replace(/(^|[^\\])y/g, "$1" + y);

	var M = (utc ? date.getUTCMonth() : date.getMonth()) + 1;
	format = format.replace(/(^|[^\\])MMMM+/g, "$1" + MMMM[0]);
	format = format.replace(/(^|[^\\])MMM/g, "$1" + MMM[0]);
	format = format.replace(/(^|[^\\])MM/g, "$1" + ii(M));
	format = format.replace(/(^|[^\\])M/g, "$1" + M);

	var d = utc ? date.getUTCDate() : date.getDate();
	format = format.replace(/(^|[^\\])dddd+/g, "$1" + dddd[0]);
	format = format.replace(/(^|[^\\])ddd/g, "$1" + ddd[0]);
	format = format.replace(/(^|[^\\])dd/g, "$1" + ii(d));
	format = format.replace(/(^|[^\\])d/g, "$1" + d);

	var H = utc ? date.getUTCHours() : date.getHours();
	format = format.replace(/(^|[^\\])HH+/g, "$1" + ii(H));
	format = format.replace(/(^|[^\\])H/g, "$1" + H);

	var h = H > 12 ? H - 12 : H == 0 ? 12 : H;
	format = format.replace(/(^|[^\\])hh+/g, "$1" + ii(h));
	format = format.replace(/(^|[^\\])h/g, "$1" + h);

	var m = utc ? date.getUTCMinutes() : date.getMinutes();
	format = format.replace(/(^|[^\\])mm+/g, "$1" + ii(m));
	format = format.replace(/(^|[^\\])m/g, "$1" + m);

	var s = utc ? date.getUTCSeconds() : date.getSeconds();
	format = format.replace(/(^|[^\\])ss+/g, "$1" + ii(s));
	format = format.replace(/(^|[^\\])s/g, "$1" + s);

	var f = utc ? date.getUTCMilliseconds() : date.getMilliseconds();
	format = format.replace(/(^|[^\\])fff+/g, "$1" + ii(f, 3));
	f = Math.round(f / 10);
	format = format.replace(/(^|[^\\])ff/g, "$1" + ii(f));
	f = Math.round(f / 10);
	format = format.replace(/(^|[^\\])f/g, "$1" + f);

	var T = H < 12 ? "AM" : "PM";
	format = format.replace(/(^|[^\\])TT+/g, "$1" + T);
	format = format.replace(/(^|[^\\])T/g, "$1" + T.charAt(0));

	var t = T.toLowerCase();
	format = format.replace(/(^|[^\\])tt+/g, "$1" + t);
	format = format.replace(/(^|[^\\])t/g, "$1" + t.charAt(0));

	var tz = -date.getTimezoneOffset();
	var K = utc || !tz ? "Z" : tz > 0 ? "+" : "-";
	if (!utc)
	{
		tz = Math.abs(tz);
		var tzHrs = Math.floor(tz / 60);
		var tzMin = tz % 60;
		K += ii(tzHrs) + ":" + ii(tzMin);
	}
	format = format.replace(/(^|[^\\])K/g, "$1" + K);

	var day = (utc ? date.getUTCDay() : date.getDay()) + 1;
	format = format.replace(new RegExp(dddd[0], "g"), dddd[day]);
	format = format.replace(new RegExp(ddd[0], "g"), ddd[day]);

	format = format.replace(new RegExp(MMMM[0], "g"), MMMM[M]);
	format = format.replace(new RegExp(MMM[0], "g"), MMM[M]);

	format = format.replace(/\\(.)/g, "$1");

	return format;
};

CSSRuleList.prototype.getRuleBySelector = function(rule) {
	if(!rule || rule.isEmpty())
		return;
	var rulex = null;
	
	$.each(this, function(i, v) {
		if(v.selectorText && v.selectorText === rule) {
			rulex = v;
		}
	});
	
	return rulex;
}

// UTILITY FUNCTIONS
// =================

window.irc = (function(module) {
    module.util = {
        // Replaces oldString with newString at beginning of text
		variables: {'dateFormat':'HH:mm:ss', 'showDate':true, 'dateUTC':false},
		messageTypes: {'join':true, 'part':true, 'nick':true, 'notice':true, 'quit':true, 'mode':true, 'topic':true, 'kick':true},
		toggleTypes: function(type) {
			if(this.messageTypes[type] == null) 
				return;
			var sheet = this.getStyleSheetById(document.styleSheets, "custom-styles");
			var trigger = this.messageTypes[type];
			if(sheet) {
				var rules = 'cssRules' in sheet ? sheet.cssRules : sheet.rules;
				if(rules.getRuleBySelector("."+type)) {
					var ruleT = rules.getRuleBySelector("."+type);
					ruleT.style.display = (trigger == true ? "none" : "block");
					this.messageTypes[type] = !trigger;
				} else {
					if ('insertRule' in sheet)
						sheet.insertRule('.'+type+' {display:'+(trigger == true ? "none" : "block")+'}', rules.length);
					else // IE compatibility
						sheet.addRule('.'+type, 'display:'+(trigger == true ? "none" : "block"), rules.length);
					this.messageTypes[type] = !trigger;
				}
			}
		},
        swapCommand: function(oldString, newString, text) {
            if (text.substring(0, oldString.length) === oldString)
                return newString + text.substring(oldString.length, text.length);
            else
                throw 'String "' + oldString + '" not found at beginning of text';
        },
		getStyleSheetById: function(sheetlist, style) {
			var sheet = null;
			if(sheetlist && style) {
				$.each(sheetlist, function(i, v) {
					if(v.ownerNode && v.ownerNode.id == style) {
						sheet = v;
					}
				});
			}
			return sheet;
		},
        escapeHTML: function(text) {
            return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        },
		isChannel: function(channel) {
			return /([#&][^\x07\x2C\s]{0,200})/.test(channel);
		},
		colorNick: function(nickname) {
			var color = nickname.hashCode().intToARGB();
			if(color.length > 6)
				color = color.substring(0, 6);
			return "#"+color;
		},
		WhoisOp: function(names) {
			var ops = [];
			names.forEach(function(e) {
				if(e.startsWith("~") || e.startsWith("&") || e.startsWith("@") || e.startsWith("%"))
					ops.push(e);
			});
			return ops;
		},
		opNickRegex: new RegExp('^[~&@%+]'),
		sortNamesArray: function sortNames(names) {
			names.sort(function (a,b) {
				var modes = "~&@%+";
				var rex = new RegExp('^['+modes+']');
				var nicks = [a.replace(rex,'').toLowerCase(), b.replace(rex,'').toLowerCase()];
				var prefix = [];
				if (rex.test(a)) prefix.push(modes.indexOf(a[0])); 
					else prefix.push(modes.length+1);
				if (rex.test(b)) prefix.push(modes.indexOf(b[0])); 
					else prefix.push(modes.length+1);
				if (prefix[0] < prefix[1]) return -1;
				if (prefix[0] > prefix[1]) return 1;
				if (nicks[0] > nicks[1]) return 1;
				if (nicks[0] < nicks[1]) return -1;
				return 0;
			});
			return names;
		},
		getPrefixFromMode: function(mode) {
			var prefix = "";
			switch(mode) {
				case "q":
					prefix = "~";
					break;
				case "a":
					prefix = "&";
					break;
				case "o":
					prefix = "@";
					break;
				case "h":
					prefix = "%";
					break;
				case "v":
					prefix = "+";
					break;
				default:
					prefix = "";
					break;
			}
			return prefix;
		},
		getPrefixName: function(mode) {
			var prefix = "";
			switch(mode) {
				case "~":
					prefix = "Owner";
					break;
				case "&":
					prefix = "Admin";
					break;
				case "@":
					prefix = "Operator";
					break;
				case "%":
					prefix = "Half-Op";
					break;
				case "+":
					prefix = "Voice";
					break;
			}
			return prefix;
		},
		getURLParam: function(sParam) {
			var sPageURL = window.location.search.substring(1);
			var sURLVariables = sPageURL.split('&');
			for (var i = 0; i < sURLVariables.length; i++) 
			{
				var sParameterName = sURLVariables[i].split('=');
				if (sParameterName[0] == sParam) 
				{
					return sParameterName[1];
				}
			}
		},
		ircCommand: function(command, args) {
			switch(command) {
				case "705":
					return args[2];
					break;
				case "706":
					return args[2];
					break;
				default:
					return null;
					break;
			}
		},
		ParseColors: function(text) {
			//control codes
			var rex = /\003([0-9]{1,2})[,]?([0-9]{1,2})?([^\003]+)/,matches,colors;
			if (rex.test(text)) {
				while (cp = rex.exec(text)) {
					if (cp[2]) {
						var cbg = cp[2];
					}
					var text = text.replace(cp[0],'<span class="fg'+cp[1]+' bg'+cbg+'">'+cp[3]+'</span>');
				}
			}
			//bold,italics,underline (more could be added.)
			var bui = [
				[/\002([^\002]+)(\002)?/, ["<b>","</b>"]],
				[/\037([^\037]+)(\037)?/, ["<u>","</u>"]],
				[/\035([^\035]+)(\035)?/, ["<i>","</i>"]]
			];
			for (var i=0;i < bui.length;i++) {
				var bc = bui[i][0];
				var style = bui[i][1];
				if (bc.test(text)) {
					while (bmatch = bc.exec(text)) {
						var text = text.replace(bmatch[0], style[0]+bmatch[1]+style[1]);
					}
				}
			}
			return text;
		},
		
    }

    return module
})(window.irc || {});
