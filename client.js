;(function grunt_browser_notifications(config) {
    'use strict';

    config || (config = {})
    var wsTarget = config.target || (config.ssl ? 'wss' : 'ws') + '://' + location.hostname + ':' + location.port + config.wsUrl
        , connection
        , backoff = 0

    if(typeof WebSocket === undefined) {
        return console.log('grunt-browser-notifications - websockets not available')
    }

    Notification.requestPermission()

    ;(function createConnection() {
        try { connection && connection.close() } catch(e) {}
        connection = new WebSocket(wsTarget)
        connection.onopen = function() { backoff = 0 }
        connection.onmessage = onmessage
        connection.onclose = function() { setTimeout(createConnection, (250 * ( backoff = Math.min(8, backoff + 1) ))) }
    })()

    function onmessage(e) {
        var data = JSON.parse(e.data)
            , opts = {
                timeout: 10000
                , icon: config.icon || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAEiQAABIkByt38eQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAALDSURBVFiFrZfPb0xRFMc/7/WHqi7apNSMBJmwkKiF2EkkFlqzKAv+nBIL4lcqSmgbdliSNBbVKCK6kcYGsRBp9EcQmlYx01odi7nDmTPvde4dPcnLO3Pv93zPuefdueeeCE8R2AgcAY4Du4FOYLOb/gYsAO+BUWAighVf7lqOswK3BQoC4vn8ErglkPkfx80Cpx2Zr2P7/BToF2hO8xOlOO8C7gMHq6eYAsaBj8AXN54BdgK9wIEE3hfAyQi++qx8n8BsQkrP+aTUfbLzCZmbEej2MZ43hqMuI0EisFXgoeGaS12EQKvAlDEYEIhT8EcFFt1zJwXTIHDFcL50/6gq8AUDHKyxwj6FfVADe81wn7WAbQJFBXgk0LCOATQKPDZ7KqMBI2pyVWDHWoShATh8TuC3srlZnmgxO/ZSLbJ6AnA2A+aMaImBw8AmhRv2ISvxJepryZDS24BDMdCnBt9EMO1Jtqp0r3M/gg/AOzV0LAb2qIFxT+cABaUXA+zGlL4/BrJqYC6ASDstpKKqRWcgZwP4VGcAIRlYUHq7PeV8NxPAktK/B9hVFKoY+Kx+Z/GUqLSS8spnAwLoVPpyTGXatwcQAcybt4/oTT8dU7kpegMDmDNvH8kr/RUCeVMocr5MAm0CHZJysUnA7zK+ehBoElhSg9cDVhMkAkPKz6JAU3liOLQYObtGgVZPrC1GN/RkxhQkn3LcI7Ds8CMegepy/EPsLUvgjPk+V2uQThh8atYSLiT9SaBmgUkDHBRoTCG9p3BFgfaUlVvnz/9++wSDLqm+ET+R0pXbYrMCdwWeSmVFLc/nBJ4ZrhmBLWmZKht2JwSxInBRPE5KF9hlt5mt870WX29jMga85V8N6KBEnie5MZkETng1JsrTBlmf1uyUrNGa+QRST3NaEM/m1OsIdYHo9rybUuEqV7YFShXxNYHt+R/R00Ilgd/IYwAAAABJRU5ErkJggg=='
            }

        opts.body = data.body

        if(Notification.permission === 'granted') {
            var notification = new Notification( data.title, opts )
            if( opts.timeout ) setTimeout( notification.close.bind(notification) , opts.timeout )
        }
        else console.log( data.title + (data.body ? ': ' + data.body : '') )
    }
})
