Grunt browser notifications
===========================

A fork of https://github.com/cgross/grunt-browser-output using HTML5 desktop
notifications.

Hence this project only supports browsers that support HTML5 notifications (and
also websockets).

What it does
------------

The code in here will launch a websocket for telling clients to show errors as
they're encountered.

There's also a connect middleware for injecting a client script for showing said
errors.

Then, there's a http proxy which can proxy requests to a connect application (eg
running on port 80) and forward them to the websocket (so that the client only
ever needs to connect to the one port (as far as it's concerned)).

Finally, there's a script which hooks grunt.log.error and basically just assumes
anything written to it is an error. The hook will then send errors it encounters
to the central websocket, which then rebroadcasts them. This is to support
(things like) grunt concurrent which spawn multiple processes.

At the moment, the notification just disappears after a timeout. It'd be cool to
be cleverer than that :-)

Basic example
-------------

*The following probably doesn't work in practice, if you're actually interested
in using this, ping me and I'll fix this doc.*

    module.exports = function(grunt) {
        var gruntBrowserOutput = require('grunt-browser-notifications')(grunt) // Setup in all processes to hook the grunt error log
        grunt.initConfig({
            server: {
                options: {
                    onCreateServer: [ gruntBrowserOutput.createServer ] // Create websocket proxy (somewhat optional - otherwise you'll likely need to specify the "target" option)
                    , middleware: function(connect) {
                        return [
                            gruntBrowserOutput.middleware // Add client snippet
                        ]
                    }
                }
            }
            , browser_notifications: {
                options: {
                    port: 37901 // Optional port, defaults to 37901. This is used for the main websocket server, and also from other grunt processes which connect to the main websocket server.
                    , gzip: true // Optionally decompress and recompress gzip html to add the client snippet (default false, this can be avoided by compressing after this middleware if possible).
                    , wsUrl: '/grunt-browser-notifications' // add a proxy from this (exact) path in the connect server to the websocket server. This is where the client will attempt to connect to as well (unless target is specified).
                    , target: undefined // add a string to specify where the client websocket should try and connect to. Defaults to endpoint where the script came from. A likely example could be 'ws://localhost:37901/' to connect to the websocket directly (not via the proxy).
                    , proxyTarget: undefined // add a string to specify where the websocket proxy should proxy to. Defaults to localhost:{{port}}.
                }
            }
            , concurrent: {
                target: {
                    tasks: [ 'connect:server', 'watch', 'browserify', 'supervisor', 'browser_notifications' ] // Example with grunt concurrent - the browser_notifications task will run a websocket server, other tasks are just examples
                }
            }
        })
    }

Then running `grunt concurrent` will start the browser_notifications service and when a
compatible browser connects, it will receive messages from grunt.log.error.
