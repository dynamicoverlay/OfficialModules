const SpotifyWebApi = require('spotify-web-api-node');
const moment = require('moment');
class SpotifyModule {

    spotifyApi;
    sendUpdate;
    io;
    constructor() {
        this.currentState = this.getDefaultState();
        this.spotifyInterval = -1;
    }

    create(registry, app, io, config, intialState, sendUpdate) {
        if(intialState){
            this.currentState = intialState;
        }
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
        this.spotifyApi = new SpotifyWebApi({
            clientId: config.spotify.client_id,
            clientSecret: config.spotify.client_secret,
            redirectUri: config.spotify.redirect_uri
        });
        if(this.currentState.token && this.currentState.token !== ""){
           this.spotifyApi.setAccessToken(this.currentState.token); 
           this.spotifyCheck();
           this.spotifyInterval = setInterval(this.spotifyCheck, 5000);
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
            this.spotifyApi.setAccessToken(token);
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

    spotifyCheck() {
        this.spotifyApi.getMyCurrentPlaybackState({})
            .then((data) => {
                let spotify = this.currentState;
                if(data.body.device){
                    spotify.volume = data.body.device.volume_percent;
                }
                spotify.song = data.body.item.name;
                spotify.image = data.body.item.album.images[0].url;
                let artistList = "";
                data.body.item.artists.forEach((artist) => {
                    artistList += artist.name + ", ";
                });
                spotify.artist = artistList;
                this.currentState = spotify;
                this.sendUpdate();
            }, (err) => {
                if (err.statusCode === 401) {
                    this.io.emit("spotifyAuth");
                    clearInterval(this.spotifyInterval);
                }
                console.log('Something went wrong!', err);
            });
    }

    getDefaultState() {
        return {
            song: "",
            artist: "",
            volume: 0,
            token: ""
        }
    }

    fade(start, end) {
        let newVol = start > end ? Math.max(end, start - 10) : Math.min(end, start + 10);
        if (start === end) {
            return;
        }
        setTimeout(() => {
            this.spotifyApi.setVolume(newVol).then(() => {
                if (newVol !== end) {
                    this.fade(newVol, end);
                }
                this.currentState.volume = newVol;
            }, () => {

            });
        }, 500);
    }

    handleMessages(data) {
        if(data.type === "volume"){
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