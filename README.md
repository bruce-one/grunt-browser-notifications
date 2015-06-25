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
        var gruntBrowserOutput = require('grunt-browser-output')(grunt) // Setup in all processes to hook log
        grunt.initConfig({
            server: {
                options: {
                    onCreateServer: [ gruntBrowserOutput.createServer ] // Create websocket proxy (somewhat optional)
                    , middleware: function(connect) {
                        return [
                            gruntBrowserOutput.middleware // Add client snippet
                            ]
                    }
                }
            }
            , browser_output: {
                options: {
                    port: 37901 // Optional port, defaults to 37901
                }
            }
            , concurrent: {
                target: {
                    tasks: [ 'connect:server', 'watch', 'browserify', 'supervisor', 'browser_output' ] // Example with grunt concurrent - the browser_output task will run a websocket server, other tasks are just examples
                }
            }
        })
    }

Then running `grunt concurrent` will start the browser_output service and when a
compatible browser connects, it will receive messages from grunt.log.error.
