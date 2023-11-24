export class PlaceHolder{}

export class vCanvas extends HTMLElement {
    
    private width: number;
    private height: number;
    private _canvas: HTMLCanvasElement;
    static observedAttributes = ["width", "height", "full-screen", "style"];

    constructor(){
        super();
        this._canvas = document.createElement('canvas');
    }

    attributeChangedCallback(name: string, oldValue: any, newValue: any) {
        // console.log(`Attribute ${name} has changed.`);
        if (name == "width"){
            this.width = +newValue;
        }
        if (name == "height"){
            this.height = +newValue;
        }
        if (name == "full-screen"){
            // console.log("full-screen", newValue);
            if (newValue !== null && newValue !== "false"){
                this.width = window.innerWidth;
                this.height = window.innerHeight;
                this._canvas.width = window.innerWidth;
                this._canvas.height = window.innerHeight;
            }
        }
        if (name == "style"){
            this._canvas.setAttribute(name, newValue);
        }
    }

    getInternalCanvas(): HTMLCanvasElement {
        return this._canvas;
    }

    connectedCallback(){
        this.shadowRoot.appendChild(this._canvas);
        
    }

    disconnectedCallback(){
        
    }
}