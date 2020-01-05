const https = require('https');
// const ws = require('ws');
// const WebSocket = require('reconnecting-websocket');
class TwitchModule {

    constructor(){
        this.currentState = this.getDefaultState();
        this.currentState.lastFollowerCheck = new Date().getTime();
        this.socket = null;
    }
    
    create(registry, app, io, config, initialState, sendUpdate) {
        if (initialState) {
            this.currentState = initialState;
        }
        this.config = config;
        this.sendUpdate = sendUpdate;
        this.updateConfig = registry.updateConfig;
        this.io = io;
        registry.registerPanel('twitch/watch.html', 'Twitch Watch');
        registry.registerPanel('twitch/chat.html', 'Twitch Chat');
        registry.registerPanel('twitch/events.html', 'Twitch Events');
        // registry.registerGraphic('twitch/graphics.html', 'Twitch');
        registry.registerMessageHandler('twitch', this.handleMessages.bind(this));
        registry.registerConfig('twitch', {
            access_token: '',
            refresh_token: '',
            client_id: '',
            client_secret: '',
        });
        registry.registerSettingsOption('twitch', 'Authorize', 'BUTTON', '', {message: 'twitchLogin'}, () => {})
        registry.registerEventListener('configUpdate', this.handleConfigUpdate.bind(this));
        app.get('/twitch/login', (req, res) => {
            res.redirect(this.getAuthURL());
        });
        app.get('/twitch/auth', async (req, res) => {
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
            let success = await this.getAccessToken(code);
            if(success){
                if(this.socket == null){
                    this.connectSocket();
                }
                res.send(`
                <html>
                    <body>
                        <h1>Authorized</h1>
                    </body>
                </html>
                `)
            }
        })
        if(this.config.twitch.access_token && this.config.twitch.access_token.length > 1){
            this.getCurrentUser().then((user) => {
                this.currentState.channelID = user.id;
            }).catch((err) => {
                console.log(err);
            });
        }
        return this;
    }


    connectSocket(){
        // this.socket = new WebSocket('wss://pubsub-edge.twitch.tv', [], {WebSocket: ws, connectionTimeout: 30000, reconnectInterval: 5000 })
        // this.socket.addEventListener('open', () => {
        //     console.log("Connected to PubSub");
        //     this.getPubSubHeartbeat(this.socket);
        //     this.heartBeatInterval = setInterval(() => {
        //         this.getPubSubHeartbeat(this.socket)
        //     }, 1000 * 60)
        // })
        // this.socket.addEventListener('close', () => {
        //     clearInterval(this.heartBeatInterval);
        // })
        // this.socket.addEventListener('message', (data) => {
        //     let messageObject = JSON.parse(data.data);
        //     switch(messageObject.type){
        //         case 'RECONNECT':
        //             this.socket.refresh();
        //             break;
        //         case 'MESSAGE':
        //             this.handleMessage(messageObject.data.topic, messageObject.data.message);
        //             break;
        //     }
        // })
    }

    handleMessage(topic, message){
        let shortenedTopic = topic.substring(0, topic.indexOf('.'));
        switch(shortenedTopic){
            case 'channel-bits-events-v2':
                let bitData = JSON.parse(message).data;
                let event = {type: "bits", created_at: bitData.time, username: bitData.user_name, amount: bitData.bits_used, total: bitData.total_bits_used};
                this.io.emit("newEvent", event);
                this.currentState.events.push(event);
                this.sendUpdate();
                break;
            case 'channel-subscribe-events-v1':
                let subevent = {type: "sub", created_at: message.time, username: message.user_name, tier: message.sub_plan, streak: message.streak-months, total: message.cumulative-months};
                this.io.emit("newEvent", subevent);
                this.currentState.events.push(subevent);
                this.sendUpdate();
                break;
        }
    }

    getPubSubHeartbeat(ws){
        let heartbeat = {
            TYPE: 'PING'
        }
        ws.send(JSON.stringify(heartbeat));
    }

    getDefaultState(){
        return {
            events: [],
            username: "",
            channelID: "",
            lastFollowerCheck: -1
        }
    }

    async handleConfigUpdate(config){
        this.currentState.channelID = await getChannelID(this.currentState.username);
        this.sendUpdate();
    }

    getChannelID(username){
        return new Promise((resolve, reject) => {
            this.doHTTPRequest('GET', 'api.twitch.tv', `/helix/users?login=${username}`, {
                'Client-ID': this.config.twitch.client_id
            }, undefined).then((raw) => {
                var response = JSON.parse(raw);
                let actualData = response.data;
                if(actualData && actualData.length > 0){
                    resolve(actualData[0].id)   
                } else {
                    reject(response);
                }
            });  
        });
    }

    getFollowers(channelID){
        this.doHTTPRequest('GET', 'api.twitch.tv', `/helix/users/follows?to_id=${channelID}`, {
            'Client-ID': this.config.twitch.client_id
        }, undefined).then((raw) => {
            var response = JSON.parse(raw);
            let follows = response.data;
            if(follows){
                let newFollowers = [];
                follows.forEach((follow) => {
                    if(Date.parse(follow.followed_at) > this.currentState.lastFollowerCheck){
                        newFollowers.push(follow);
                    }
                })
                if(newFollowers.length > 0){
                    newFollowers.forEach((follow) => {
                        let event = {type: "follow", created_at: follow.followed_at, username: follow.from_name};
                        this.io.emit("newEvent", event);
                        this.currentState.events.push(event);
                    })
                }
                this.currentState.lastFollowerCheck = new Date().getTime();
                this.sendUpdate();
            }
        })
    }

    getCurrentUser(){}

    getAccessToken(code){
        return new Promise((resolve, reject) => {
            this.doHTTPRequest('POST', 'id.twitch.tv', `/oauth2/token?client_id=${this.config.twitch.client_id}&client_secret=${this.config.twitch.client_secret}&code=${code}&grant_type=authorization_code&redirect_uri=${encodeURI("http://localhost:3001/twitch/auth")}`, {}, undefined).then((raw) => {
                var response = JSON.parse(raw);
                if(response.access_token){
                    let newConfig = this.config.twitch;
                    newConfig.access_token = response.access_token;
                    newConfig.refresh_token = response.refresh_token;
                    this.updateConfig('twitch', newConfig);
                    resolve(true);
                }
            })
        });
    }

    refreshToken(){}

    getAuthURL(){
        return `https://id.twitch.tv/oauth2/authorize
        ?client_id=${this.config.twitch.client_id}
        &redirect_uri=${encodeURI("http://localhost:3001/twitch/auth")}
        &response_type=code
        &scope=${encodeURI("channel_subscriptions bits:read")}`
    }

    doHTTPRequest(method, host, endpoint, headers, body){
        new Promise((resolve, rej) => {
            const req = https.request({
                hostname: host,
                port: 443,
                path: endpoint,
                headers: headers,
                method: method.toUpperCase()
            }, (res) => {
                var body = '';
                res.setEncoding('utf8');
                res.on('data', (d) => {
                    body += d;
                });
                res.on('end', () => {
                    resolve(body);
                })
            })
            req.on('error', (e) => {
                rej(e);
            })
            if(body !== undefined){
                req.write(querystring.stringify(body));
            }
            req.end();
        })
    }

    handleMessages(data){
        return Promise.resolve();
    }

    getState() {
        return this.currentState;
    }

    getName() {
        return "twitch";
    }
}
module.exports = new TwitchModule();