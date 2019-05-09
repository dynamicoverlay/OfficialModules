
class CameraModule {

    constructor(){
        this.currentState = this.getDefaultState();
    }
    
    create(registry, app, io, config) {
        registry.registerPanel('camera/panel.html', 'Camera');
        registry.registerGraphic('camera/graphics.html', 'Camera');
        registry.registerMessageHandler('camera', this.handleMessages.bind(this));
        return this;
    }

    getDefaultState(){
        return {
            scale: 300,
            position: 'bottom_left',
            visible: false
        }
    }

    handleMessages(data){
        if(typeof data === "string"){
            if(data === "show"){
                this.currentState.visible = true;
            } else if(data === "hide"){
                this.currentState.visible = false;
            }
        } else {
            if(data.type === "scale"){
                this.currentState.scale = data.value;
            } else if(data.type === "move"){
                this.currentState.position = data.value;
            }
        }
        return Promise.resolve();
    }

    getState() {
        return this.currentState;
    }

    getName() {
        return "camera";
    }
}
module.exports = new CameraModule();