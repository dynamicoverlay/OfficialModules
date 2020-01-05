const https = require('https');
var querystring = require('querystring');
class SpotifyModule {

    spotifyApi;
    sendUpdate;
    io;
    encodedIDAndSecret;
    config;
    constructor() {
        this.currentState = this.getDefaultState();
        this.spotifyInterval = -1;
    }

    create(registry, app, io, config, initialState, sendUpdate) {
        if (initialState) {
            this.currentState = initialState;
        }
        this.config = config;
        this.sendUpdate = sendUpdate;
        this.io = io;
        registry.registerPanel('spotify/panel.html', 'Spotify');
        registry.registerGraphic('spotify/graphics.html', 'Spotify');
        registry.registerMessageHandler('spotify', this.handleMessages.bind(this));
        registry.registerConfig('spotify', {
            client_id: "",
            client_secret: "",
            redirect_uri: "http://localhost:3001/spotify/redirect"
        })
        this.encodedIDAndSecret = new Buffer(config.spotify.client_id + ":" + config.spotify.client_secret).toString("base64");
        if (this.currentState.token && this.currentState.token !== "") {
            console.log("Checking token");
            this.checkTokenValid(this.currentState.token).then(() => {
                console.log("Valid Token");
                this.spotifyCheck();
                this.spotifyInterval = setInterval(this.spotifyCheck.bind(this), 5000);
            }).catch(async (err) => {
                console.log("Invalid Token");
                let resp = await this.refreshToken(this.currentState.refresh).catch((err) => { console.error(err); });
                if(resp.token){
                    console.log("refreshed token");   
                } else {
                    console.log("failed to refresh token");
                }
                this.currentState.token = resp.token;
                this.currentState.refresh = resp.refresh;
                this.spotifyCheck();
            })
        }
        app.get('/spotify/login', (req, res) => {
            var scopes = 'user-modify-playback-state user-read-email user-read-playback-state';
            res.redirect('https://accounts.spotify.com/authorize' +
                '?response_type=code' +
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
        app.get('/spotify/redirect', async (req, res) => {
            let code = req.query.code;
            if(code === undefined){
                return res.send(`
                <html>
                    <body>
                        <h1>Failed to authorize</h1>
                    </body>
                </html>
                `);
            }
            let resp = await this.getTokenFromCode(code);
            if(resp.token){
                this.currentState.token = resp.token;
                this.currentState.refresh = resp.refresh;
                io.emit('closeSAuth');
                if (this.spotifyInterval !== -1) {
                    clearInterval(this.spotifyInterval);
                }
                this.spotifyCheck();
                this.spotifyInterval = setInterval(this.spotifyCheck.bind(this), 5000);
                res.send(`
                <html>
                    <body>
                        <h1>Authorized</h1>
                    </body>
                </html>
                `)
            }
        })
        return this;
    }

    getTokenFromCode(code){
        return new Promise((resolve, rej) => {
            const req = https.request({
                hostname: 'accounts.spotify.com',
                port: 443,
                path: `/api/token`,
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${this.encodedIDAndSecret}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
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
                        resolve({
                            token: response.access_token,
                            refresh: response.refresh_token
                        });
                    }
                })
            })
            req.on('error', (e) => {
                rej();
            })
            req.write(querystring.stringify({
                grant_type: "authorization_code",
                code: code,
                redirect_uri: this.config.spotify.redirect_uri,
              }))
            req.end();
        });
    }

    refreshToken(refresh){
        return new Promise((resolve, rej) => {
            const req = https.request({
                hostname: 'accounts.spotify.com',
                port: 443,
                path: `/api/token`,
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${this.encodedIDAndSecret}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
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
                        rej(response.error);
                    } else {
                        resolve({
                            token: response.access_token,
                            refresh: response.refresh_token
                        });
                    }
                })
            })
            req.on('error', (e) => {
                rej();
            })
            req.write(querystring.stringify({
                grant_type: "refresh_token",
                refresh_token: refresh,
            }))
            req.end();
        });
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
            res.on('end', async () => {
                var response = JSON.parse(body);
                if (response.error !== undefined) {
                    if (response.status === 401) {
                        let resp = await this.refreshToken(this.currentState.refresh);
                        this.currentState.token = resp.token;
                        this.currentState.refresh = resp.refresh;
                        this.spotifyCheck();
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
                        response.item.artists.forEach((artist, i) => {
                            artistList += artist.name + (i !== (response.item.artists.length -1 )? ", " : "");
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
            token: "",
            refresh: ""
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
        this.checkTokenValid(this.currentState.token).then(() => {
            let newVol = start > end ? Math.max(end, start - 5) : Math.min(end, start + 5);
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
        }).catch(async (err) => {
            console.log("Invalid Token");
            let resp = await this.refreshToken(this.currentState.refresh);
            this.currentState.token = resp.token;
            this.currentState.refresh = resp.refresh;
            this.fade(start, end);
        })
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