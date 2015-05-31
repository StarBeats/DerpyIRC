#!/usr/bin/env node
"use strict";

var express = require('express');
var irc = require('./lib/IRCServer.js');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var dir = __dirname+"/public";
var debugmode = true;

server.listen(8337);

app.use(express.static(dir));

app.get('/', function (req, res) {
    res.sendFile(dir + '/index.html');
});

app.use(function(req, res, next){
    res.status(404).send('404 Not found.');
});

console.log("DerpyIRC started.");

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

// Socket.IO
io.on('connection', function(socket) {
    // Events to signal TO the front-end
    var clients = [];

    socket.on('ircconnection', function(data) {
        var client = new irc.Client(data.server, data.nick, {
            showErrors: debugmode,
            channels: data.channels,
            password: data.password,
            port: data.port,
            autoRejoin: false,
            debug: debugmode,
            secure: data.secure,
            userName: (data.nick.toLowerCase().length > 10 ? data.nick.toLowerCase().substring(0, 10) : data.nick.toLowerCase()),
            realName: 'DerpyIRC',
            certExpired: true,
            selfSigned: true
        });
        
        client.connect(function() {
            socket.emit('serverconnected', {"nw":client.network, "supports":client.supported, "data":client.opt});
        });

        // Socket events sent FROM the front-end
        socket.on('join', function(name) { client.join(name); });
        socket.on('part', function(name) { client.part(name); });
        socket.on('say', function(data) { client.say(data.target, data.message); });
        socket.on('action', function(data) { client.action(data.target, data.message); });
        socket.on('command', function(args) { client.sendraw(args); });
        socket.on('changenick', function(newnick) { client.send("NICK", newnick); });
        socket.on('ircdisconnect', function(text) { client.disconnect(text); });
        socket.on('swhois', function(a) { client.whois(a); });
        socket.on('topic', function(a) { client.sendraw('TOPIC ' + a.channel + " :" + a.topic); });
        socket.on('gettopic', function(a) { client.sendraw('TOPIC '+ a.channel); });
        socket.on('quote', function(a) { client.sendraw(a.command); });
        
        client.on("error", function(message) { socket.emit('errorevent', message)});
        
        // Add a listener on client for the given event & argument names
        var activateListener = function(event, argNames) {
            client.addListener(event, function() {
                if(debugmode===true)
                    console.log('Event ' + event + ' sent');
                // Associate specified names with callback arguments
                // to avoid getting tripped up on the other side
                var callbackArgs = arguments;
                var args = {};
                argNames.forEach(function(arg, index) {
                    args[arg] = callbackArgs[index];
                });
                if(debugmode===true)
                    console.log(args);
                socket.emit(event, args);
            });
        };

        for (var event in events) { activateListener(event, events[event]); }
        clients.push(client);
    });

    socket.on('disconnect', function() {
        clients.forEach(function(client) {
            client.disconnect("DerpyIRC - Chat for the Derpy"); 
        });
    });
});
