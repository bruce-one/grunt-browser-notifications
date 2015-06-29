'use strict';
var hooker = require('hooker')
    , ws = require('ws')
    , debug = require('debug')('grunt-browser-notifications')

module.exports = function(grunt) {

  grunt.registerTask('browser_notifications', 'Redirect grunt output to the browser for html5 notifications.', function() {

    var options = this.options({port: 37902})

    //start server
    var WebSocketServer = ws.Server

    var wss
    if(!options.ssl){
      wss = new WebSocketServer({port: options.port})
    } else {
      var processRequest = function(req, res) {
        res.writeHead(200, {'Content-Type': 'text/plain'})
        res.end('Not implemented')
      }
      var app = require('https').createServer({
        key: options.key,
        cert: options.cert,
        passphrase: options.passphrase
      }, processRequest).listen(options.port)

      wss = new WebSocketServer({server: app})
      debug('Created websocket server')
    }

    wss.broadcast = function(data) {
      debug('Sending %s to %d clients ', data, this.clients.length)
      for(var i in this.clients) {
        this.clients[i].send(data)
      }
    }

    wss.on('connection', function(ws) {
      ws.on('message', function(data) {
        debug('Websocket server received message %s', data)
      })
      ws.on('message', wss.broadcast.bind(wss))
    })

    hooker.hook(grunt.log, 'error', function(msg) {
      if(!( msg && msg.toString ) ) return
      var message = msg.toString()
      var data = {
        title: message.replace(/:.*$/, '')
        , body: message.replace(/^[:]*:/, '')
        , isError: true
      }
      if(data.title == data.body) data.title = 'Error'
      wss.broadcast(JSON.stringify(data))
    })

    this.async()
  })
}
