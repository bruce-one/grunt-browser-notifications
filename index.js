'use strict';

var _ = require('highland')
    , replacestream = require('replacestream')
    , debug = require('debug')('grunt-browser-notifications')
    , debugContent = require('debug')('grunt-browser-notifications:content')
    , through = require('through')
    , util = require('util')
    , path = require('path')
    , fs = require('fs')
    , hooker = require('hooker')
    , httpProxy = require('http-proxy')
    , contentType = require('content-type')
    , WebSocket = require('ws')
    , zlib = require('zlib')
    , onHeaders = require('on-headers')

module.exports = function(grunt) {
    var scriptContents
        , script
        , wsClient
        , debugging = !!process.env.DEBUG
        , getConfig = function(key) { return grunt.config.get( key ? ('browser_notifications.options.' + key) : 'browser_notifications.options') }

    ;(function setupClient(err) {
        err && debug('Websocket client err, will retry')
        wsClient && wsClient.removeAllListeners()
        setTimeout(function() {
            debug('Creating client to ' + getConfig('port'))
            wsClient = new WebSocket('ws://localhost:' + getConfig('port') )
            wsClient.on('error', setupClient)
        }, 1000) // Don't hog the loop
    })()

    hooker.hook(grunt.log, 'error', function(msg) {
      if(! (msg && msg.toString()) ) return
      var message = msg.toString()
      var data = {
        title: message.replace(/:.*$/, '') // TODO make configurable
        , body: message.replace(/^[:]*:/, '') // TODO make configurable
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
        var proxyConfig = { target: getConfig('proxyTarget') || { host: 'localhost', port: getConfig('port') || 37901 } }
            , proxy = new httpProxy.createProxyServer(proxyConfig)

        debug('Setting up websocket proxy to %j', proxyConfig)
        server.on('upgrade', function (req, socket, head) {
            if( req.url != (getConfig('wsUrl') || '/grunt-browser-notifications') ) { // True for any url
                debug('Websocket detected, but wrong url (%s != %s), not proxying.', req.url, getConfig('wsUrl') || '/grunt-browser-notifications')
                return
            }
            debug('Websocket to %s detected, proxying', req.url)
            proxy.ws(req, socket, head);
        })
    }

    function gruntBrowserOutputMiddleware(req, res, next) {
        var _write = res.write
            , _end = res.end
            , _writeHead = res.writeHead
            , interceptor = _()
            , headersReady = false

        scriptContents || (scriptContents = fs.readFileSync(path.join(__dirname, 'client.js'), 'utf8')) // TODO Clean this file read, and async it
        script || (script = util.format('<script>%s(%j)</script>', scriptContents, getConfig()) )

        debug('Preparing to add script to request')

        function getInterceptorTarget() {
            debug('Using noop interceptor')
            return through(_write.bind(res), _end.bind(res))
        }

        function prepareInterceptor(isHtml, contentEncoding) {
            debug('Preparing script insertion pipeline, perform modification: %s', isHtml)

            if(!isHtml) return interceptor.pipe(getInterceptorTarget())

            var pipelineArr = []
                , compressor

            if(getConfig('gzip') && contentEncoding) {
                debug('Will decompress (and recompress) %s content to add snippet', contentEncoding)
                pipelineArr.push( _.through( zlib.createUnzip() ) )
                compressor = _.through( zlib['create' + (contentEncoding.charAt(0).toUpperCase() + contentEncoding.slice(1))]() )
            } else if(contentEncoding && !getConfig('gzip')) {
                debug('Ignoring %s content because the gzip option is falsy.', contentEncoding)
                return interceptor.pipe(getInterceptorTarget())
            }

            debugging && pipelineArr.push(_.tap(function(data) { debugContent('Before: ' + data.toString('utf8')) }))

            pipelineArr.push(_.through(replacestream(/(<[^>]*\/[^>]*body[^>]*>)/, script + '$1', { limit: 1 })))

            debugging && pipelineArr.push(_.tap(function(data) { debugContent('After: ' + data.toString('utf8')) }))

            compressor && pipelineArr.push(compressor)

            interceptor
                .pipe(_.pipeline.apply(_, pipelineArr))
                .pipe(getInterceptorTarget())
        }

        res.write = function(data, encoding) {
            debug('Intercepting response write')
            if(!headersReady) { // Need to call writeHead to setup the interceptor
                debug('Calling writeHead with status 200 as it hasn\'t been called yet')
                res.writeHead(200)
            }
            return interceptor.write(new Buffer(data, encoding))
        }

        res.end = function(data, encoding) {
            debug('Ending')
            data && res.write(data, encoding)
            interceptor.end()
        }

        onHeaders(res, function() {
            var isHtml = false

            debug('Headers available for request')

            headersReady = true
            res.removeHeader('content-length')

            try {
                isHtml = (contentType.parse(res).type == 'text/html')
            } catch(e) {}

            prepareInterceptor(isHtml, res.getHeader('content-encoding'))
        })
        next()
    }
    return {
        createServer: gruntBrowserOutputCreateServer
        , middleware: gruntBrowserOutputMiddleware
    }
}
