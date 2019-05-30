class BackdropModule {

    constructor(){
        this.currentState = this.getDefaultState();
    }
    
    create(registry, app, io, config, initialState) {
        this.currentState = initialState;
        registry.registerPanel('backdrop/panel.html', 'Backdrop');
        registry.registerGraphic('backdrop/graphics.html', 'Backdrop');
        registry.registerMessageHandler('backdrop', this.handleMessages.bind(this));
        return this;
    }

    getDefaultState(){
        return {
            visible: true,
            transitionTime: 5,
            text: "Starting Soon!",
            color: "#2980b9"
        }
    }

    handleMessages(data){
        if(data.type === "slide-in"){
            this.currentState.visible = true;
        } else if(data.type === "slide-out"){
            this.currentState.visible = false;
        } else if(data.type === "set-text"){
            this.currentState.text= data.value;
        } else if(data.type === "set-color"){
            this.currentState.color = data.value;
        }else if(data.type === "set-transition"){
            this.currentState.transitionTime = data.value;
        }
        return Promise.resolve();
    }

    getState() {
        return this.currentState;
    }

    getName() {
        return "backdrop";
    }
}
module.exports = new BackdropModule();