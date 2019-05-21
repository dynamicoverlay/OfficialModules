
class TwitchModule {

    constructor(){
        this.currentState = this.getDefaultState();
        // var lastFollowerCheck = new Date().getTime();
    }
    
    create(registry, app, io, config, initialState, sendUpdate) {
        this.sendUpdate = sendUpdate;
        registry.registerPanel('twitch/watch.html', 'Twitch Watch');
        registry.registerPanel('twitch/chat.html', 'Twitch Chat');
        registry.registerPanel('twitch/events.html', 'Twitch Events');
        // registry.registerGraphic('twitch/graphics.html', 'Twitch');
        registry.registerMessageHandler('twitch', this.handleMessages.bind(this));
        registry.registerConfig('twitch', {
            username: 'rushmead'
        });
        registry.registerEventListener('configUpdate', this.handleConfigUpdate.bind(this));
        registry.registerSettingsOption('twitch', 'Username', 'TEXT', config.twitch.username, {type: 'text'}, (value) => {
            config['twitch']['username'] = value;
            registry.updateConfig('twitch', config.twitch);
        })
        this.currentState.username = config.twitch.username;
        // setInterval(getFollowers, 20 * 1000);        
        return this;
    }

    getDefaultState(){
        return {
            events: [],
            username: ""
        }
    }

    handleConfigUpdate(config){
        this.currentState.username = config.twitch.username;
        this.sendUpdate();
    }

    getFollowers(){
    // let followURL = `https://api.twitch.tv/kraken/channels/rushmead/follows?client_id=${config.twitch.client_id}`;
    //     let newFollowers = [];
    //     console.log("Checking followers");
    //     axios.get(followURL).then((data) => {
    //         let actualData = data.data;
    //         if(actualData.follows){
    //             actualData.follows.forEach((follow) => {
    //                 if(+moment(follow.created_at) > lastFollowerCheck){
    //                     newFollowers.push(follow);
    //                 }
    //             })
    //             if(newFollowers.length > 0){
    //                 newFollowers.forEach((follow) => {
    //                     let event = {type: "follow", created_at: follow.created_at, username: follow.user.display_name};
    //                     io.emit("newEvent", event);
    //                     currentState.events.push(event);
    //                 })
    //             }
    //             lastFollowerCheck = new Date().getTime();
    //         }
    //     })
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