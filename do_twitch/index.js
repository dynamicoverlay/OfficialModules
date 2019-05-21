
class TwitchModule {

    constructor(){
        this.currentState = this.getDefaultState();
    }
    
    create(registry, app, io, config) {
        registry.registerPanel('twitch/watch.html', 'Twitch Watch');
        registry.registerPanel('twitch/chat.html', 'Twitch Chat');
        registry.registerPanel('twitch/events.html', 'Twitch Events');
        // registry.registerGraphic('twitch/graphics.html', 'Twitch');
        registry.registerMessageHandler('twitch', this.handleMessages.bind(this));
        registry.registerConfig('twitch', {
            username: 'rushmead'
        });
        this.currentState.username = config.twitch.username;
        return this;
    }

    getDefaultState(){
        return {
            events: [],
            username: ""
        }
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