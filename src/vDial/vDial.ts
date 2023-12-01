
const template = document.createElement("template");
template.innerHTML = `
            <style>
                /* Your component's styles go here */
            </style>
            <div>
                <svg width="10vw" height="10vw">
                    <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="none"/>
                    <path data="M 50 50 L 50 10" stroke="black" stroke-width="3"/>
                    <path d="M 50 50 L 50 10" stroke="black" fill="transparent"/>
                </svg>
            </div>
            `;

export class vDial extends HTMLElement{

    private rotation: number;
    private svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    
    static observedAttributes = ["width", "height"];

    constructor(){
        super();
        this.rotation = 0;
        this.attachShadow({mode: "open"});
        let newCircle = document.createElementNS('http://www.w3.org/2000/svg',"circle");
        newCircle.setAttributeNS(null, "cx", "50");
        newCircle.setAttributeNS(null, "cy", "50");
        newCircle.setAttributeNS(null, "r", "40");
        newCircle.setAttributeNS(null, "stroke", "black");
        newCircle.setAttributeNS(null, "stroke-width", "3");
        newCircle.setAttributeNS(null, "fill", "none");
        this.svg.appendChild(newCircle);
        this.shadowRoot.appendChild(this.svg);
    }

    connectedCallback(){
    }

    disconnectedCallback(){
    }

    attributeChangedCallback(name: string, oldValue: any, newValue: any) {
        
        this.svg.setAttribute(name, newValue);
    }

}

export class DialWheel {

    private rotation: number;

    constructor(){
        this.rotation = 0;
    }

    getRotation(): number {
        return this.rotation;
    }

    normalizeAngleZero2TwoPI(angle: number){
        // reduce the angle  
        angle = angle % (Math.PI * 2);

        // force it to be the positive remainder, so that 0 <= angle < 360  
        angle = (angle + Math.PI * 2) % (Math.PI * 2); 
        return angle;
    }

    setRotation(rotation: number){
        rotation = this.normalizeAngleZero2TwoPI(rotation);
        this.rotation = rotation;
    }
    
    setRotationDeg(rotationDeg: number){
        this.setRotation(rotationDeg * Math.PI / 180);
    }

    spin(deltaAngle: number){
        // in radians
        this.rotation = this.normalizeAngleZero2TwoPI(this.rotation + deltaAngle);
    }

    spinDeg(deltaAngle: number){
        // in degrees
        this.spin(deltaAngle * Math.PI / 180);
    }

}