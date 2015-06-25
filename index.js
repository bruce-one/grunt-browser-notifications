'use strict';

var _ = require('highland')
    , replacestream = require('replacestream')
    , debug = require('debug')('grunt-browser-notifications')
    , through = require('through')
    , util = require('util')
    , path = require('path')
    , fs = require('fs')
    , hooker = require('hooker')
    , httpProxy = require('http-proxy')
    , contentType = require('content-type')
    , WebSocket = require('ws')

module.exports = function(grunt, opts) {
    opts || (opts = {})
    var scriptContents
        , script
        , port = function() {
            return grunt.config.get('browser_notifications.options.port') || 37901
        }
        , wsClient

    ;(function setupClient(err) {
        err && debug('Websocket client err, will retry')
        wsClient && wsClient.removeAllListeners()
        setTimeout(function() {
            debug('Creating client to ' + port)
            wsClient = new WebSocket('ws://localhost:' + port() )
            wsClient.on('error', setupClient)
        }, 1000) // Don't hog the loop
    })()
    hooker.hook(grunt.log, 'error', function(msg) {
      if(! (msg && msg.toString) ) return
      var message = msg.toString()
      var data = {
        title: message.replace(/:.*$/, '')
        , body: message.replace(/^[:]*:/, '')
        , isError: true
      }
      if(data.title == data.body) data.title = 'Error'
      try {
        wsClient.send(JSON.stringify(data))
        debug('Sent %j to server', data)
      } catch(e) {
        debug('Error sending %s', e.stack)
      }
    })

    function gruntBrowserOutputCreateServer(server, connect, options) {
        var proxy = new httpProxy.createProxyServer({ target: opts.target || { host: 'localhost', port: port() } }) //TODO
        debug('Setting up websocket proxy')
        server.on('upgrade', function (req, socket, head) {
            debug('Websocket detected, proxying')
            proxy.ws(req, socket, head);
        })
    }
    function gruntBrowserOutputMiddleware(req, res, next) {
        var _write = res.write
            , _end = res.end
            , _writeHead = res.writeHead
            , interceptor = _()
            , pipeline

        scriptContents || (scriptContents = fs.readFileSync(path.join(__dirname, 'client.js'), 'utf8')) // TODO Clean this file read, and async it
        script || (script = util.format('<script>%s(%j)</script>', scriptContents, opts))

        debug('Preparing to add script to request')

        function prepareInterceptor(isHtml) {
            debug('Preparing script insertion pipeline, perform modification: ' + isHtml)

            pipeline = _.pipeline(
                //_.tap(function(data) { debug('Before: ' + data.toString('utf8')) })
                _.through(replacestream(/(<[^>]*\/[^>]*body[^>]*>)/, script + '$1', { limit: 1 }))
                //, _.tap(function(data) { debug('After: ' + data.toString('utf8')) })
            )

            interceptor
                .pipe(isHtml ? pipeline : _.pipeline())
                .pipe(through(_write.bind(res), _end.bind(res)))
        }

        res.write = function(data, encoding) { // This hopes that the encoding is always the same :-s
            debug('Intercepting response write, encoding is: ' + encoding)
            if( encoding == 'utf8' || encoding == 'ascii' || encoding == '' || encoding == undefined) {
                debug('Writing to interceptor')
                interceptor.write(data)
            } else {
                debug('Not intercepting request because the encoding is not supported')
                _write.apply(res, arguments)
                res.end = _end.bind(res)
            }
        }
        res.end = function(data, encoding) {
            debug('Ending')
            data && res.write(data, encoding)
            interceptor.end()
        }

        res.writeHead = function() {
            var isHtml = false
            res.removeHeader('content-length')
            _writeHead.apply(res, arguments)

            try {
                isHtml = (contentType.parse(res).type == 'text/html')
            } catch(e) {}

            prepareInterceptor(isHtml)
        }
        next()
    }
    return {
        createServer: gruntBrowserOutputCreateServer
        , middleware: gruntBrowserOutputMiddleware
    }
}
