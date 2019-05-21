const https = require('https');
class SpotifyModule {

    spotifyApi;
    sendUpdate;
    io;
    constructor() {
        this.currentState = this.getDefaultState();
        this.spotifyInterval = -1;
    }

    create(registry, app, io, config, intialState, sendUpdate) {
        if (intialState) {
            this.currentState = intialState;
        }
        this.sendUpdate = sendUpdate;
        this.io = io;
        registry.registerPanel('spotify/panel.html', 'Spotify');
        // registry.registerGraphic('spotify/graphics.html', 'Spotify');
        registry.registerMessageHandler('spotify', this.handleMessages.bind(this));
        registry.registerConfig('spotify', {
            client_id: "",
            client_secret: "",
            redirect_uri: "http://localhost:3001/spotify/redirect"
        })
        if (this.currentState.token && this.currentState.token !== "") {
            console.log("Checking token");
            this.checkTokenValid(this.currentState.token).then(() => {
                console.log("Valid Token");
                this.spotifyCheck();
                this.spotifyInterval = setInterval(this.spotifyCheck.bind(this), 5000);
            }).catch((err) => {
                console.log("Invalid Token");
                this.currentState.token = "";
            })
        }
        app.get('/spotify/login', (req, res) => {
            var scopes = 'user-modify-playback-state user-read-email user-read-playback-state';
            res.redirect('https://accounts.spotify.com/authorize' +
                '?response_type=token' +
                '&client_id=' + config.spotify.client_id +
                (scopes ? '&scope=' + encodeURIComponent(scopes) : '') +
                '&redirect_uri=' + encodeURIComponent(config.spotify.redirect_uri));
        });
        app.post('/spotify/update', (req, res) => {
            let token = req.body.data.substring(14, req.body.data.indexOf('&'));
            io.emit('closeSAuth');
            this.currentState.token = token;
            if (this.spotifyInterval !== -1) {
                clearInterval(this.spotifyInterval);
            }
            this.spotifyCheck();
            this.spotifyInterval = setInterval(this.spotifyCheck.bind(this), 5000);
            res.send("Done");
        })
        app.get('/spotify/redirect', (req, res) => {
            res.send(`
            <html>
                <body>
                    <h1>Updating...</h1>
                    <script type="text/javascript">
                        fetch('/spotify/update', {method: 'POST', headers: {'Content-Type': 'application/json'},body: JSON.stringify({data: document.location.hash})}).then((res) => res.json()).then(() => {window.open('', '_self', ''); window.close();})
                    </script>
                </body>
            </html>
            `);
        })
        return this;
    }

    checkTokenValid(token){
        return new Promise((resolve, rej) => {
            const req = https.request({
                hostname: 'api.spotify.com',
                port: 443,
                path: `/v1/me`,
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }, (res) => {
                var body = '';
                res.setEncoding('utf8');
                res.on('data', (d) => {
                    body += d;
                });
                res.on('end', () => {
                    var response = JSON.parse(body);
                    if (response.error !== undefined) {
                        rej();
                    } else {
                        resolve();
                    }
                })
            })
            req.on('error', (e) => {
                rej();
            })
            req.end();
        });
    }

    spotifyCheck() {
        const req = https.request({
            hostname: 'api.spotify.com',
            port: 443,
            path: `/v1/me/player`,
            method: 'GET',
            headers: {
                Authorization: `Bearer ${this.currentState.token}`
            }
        }, (res) => {
            var body = '';
            res.setEncoding('utf8');
            res.on('data', (d) => {
                body += d;
            });
            res.on('end', () => {
                var response = JSON.parse(body);
                if (response.error !== undefined) {
                    if (response.status === 401) {
                        this.currentState.token = "";
                        this.io.emit("spotifyAuth");
                        clearInterval(this.spotifyInterval);
                        this.sendUpdate();
                    }
                } else {
                    if (response.device !== undefined) {
                        let spotify = this.currentState;
                        if (response.device) {
                            spotify.volume = response.device.volume_percent;
                        }
                        spotify.song = response.item.name;
                        spotify.image = response.item.album.images[0].url;
                        let artistList = "";
                        response.item.artists.forEach((artist) => {
                            artistList += artist.name + ", ";
                        });
                        spotify.artist = artistList;
                        this.currentState = spotify;
                        this.sendUpdate();
                    }
                }
            })
        })
        req.on('error', (e) => {
            console.log(e);
        })
        req.end();
    }

    getDefaultState() {
        return {
            song: "",
            artist: "",
            volume: 0,
            token: ""
        }
    }

    setVolume(volume) {
        return new Promise((resolve, rej) => {
            const req = https.request({
                hostname: 'api.spotify.com',
                port: 443,
                path: `/v1/me/player/volume?volume_percent=${volume}`,
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${this.currentState.token}`
                }
            }, (res) => {
                var body = '';
                res.setEncoding('utf8');
                res.on('data', (d) => {
                    body += d;
                });
                res.on('end', () => {
                    resolve();
                })
            })
            req.on('error', (e) => {
                rej();
            })
            req.end();
        })
    }

    fade(start, end) {
        let newVol = start > end ? Math.max(end, start - 10) : Math.min(end, start + 10);
        if (start === end) {
            return;
        }
        setTimeout(() => {
            this.setVolume(newVol).then(() => {
                if (newVol !== end) {
                    this.fade(newVol, end);
                }
                this.currentState.volume = newVol;
            }, () => {

            });
        }, 500);
    }

    handleMessages(data) {
        if (data.type === "volume") {
            this.fade(this.currentState.volume, data.value);
        }
        return Promise.resolve();
    }

    getState() {
        return this.currentState;
    }

    getName() {
        return "spotify";
    }
}
module.exports = new SpotifyModule();