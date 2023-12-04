import { PointCal } from "point2point";
import { Point } from "../";

export class vDial extends HTMLElement{

    private width: number;

    private center: Point;
    private radius: number;

    private svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    private arrow: SVGPathElement;
    private circle: SVGCircleElement;
    private ring: SVGGElement;

    private dialWheel: DialWheel;

    private isDragging: boolean = false;
    private dragStart: Point;
    
    static observedAttributes = ["width"];

    constructor(){
        super();
        this.width = 300;
        this.radius = this.width * 0.9 / 2;
        this.center = {x: this.width / 2, y: this.width / 2};
        this.dialWheel = new DialWheel();
        this.attachShadow({mode: "open"});
        this.shadowRoot.appendChild(this.svg);
        this.setAttribute('style', this.getAttribute('style')+'; display: inline-block');
    }

    connectedCallback(){
        this.circle = createSVGCircleElement(this.center, this.radius);
        this.arrow = createCircleArrowSVGElement(this.center, this.radius * 0.7);
        this.ring = createSVGCompassRingElement(this.center, this.radius * 0.85);
        this.arrow.setAttribute("id", "arrow");
        this.svg.appendChild(this.arrow);
        this.svg.appendChild(this.ring);
        this.svg.appendChild(this.circle);
        this.registerEventListener();
    }

    disconnectedCallback(){
    }

    registerEventListener(){
        this.circle.addEventListener('pointerup', this.pointerupHandler.bind(this));
        this.circle.addEventListener('touchstart', this.touchstartHandler.bind(this));
        this.circle.addEventListener('pointerdown', this.pointerdownHandler.bind(this));
        this.circle.addEventListener('wheel', this.scrollHandler.bind(this));
    }

    attributeChangedCallback(name: string, oldValue: any, newValue: any) {
        if(name == "width"){
            this.width = +newValue;
            this.svg.setAttribute(name, newValue);
            this.svg.setAttribute("height", newValue);
            this.center = {x: this.width / 2, y: this.width / 2};
            this.radius = this.width * 0.95 / 2;
        }
    }

    pointerupHandler(e: PointerEvent){
    }

    pointerdownHandler(e: PointerEvent){
        e.preventDefault();
        if(e.pointerType == "mouse"){
            const topLeftCorner = {x: this.getBoundingClientRect().left, y: this.getBoundingClientRect().top};
            const centerInViewPort = {x: topLeftCorner.x + this.width / 2, y: topLeftCorner.y + this.width / 2};
            const cursorPosInViewPort = {x: e.clientX, y: e.clientY};
            let diff = PointCal.subVector(cursorPosInViewPort, centerInViewPort);
            diff.y = -diff.y;
            let clickedAngle = PointCal.angleFromA2B({x: 0, y: 1}, diff);
            this.dialWheel.spin(clickedAngle);
            this.ring.setAttributeNS(null, "transform", `rotate(${this.dialWheel.getRotation() * 180 / Math.PI} ${this.center.x}, ${this.center.y})`);
            const event = new DialWheelEvent("needlechange", {angleSpan: clickedAngle});
            this.dispatchEvent(event);
        }
    }
    
    pointermoveHandler(e: PointerEvent){
        e.preventDefault();
        if(e.pointerType == "mouse" && this.isDragging){
            const topLeftCorner = {x: this.getBoundingClientRect().left, y: this.getBoundingClientRect().top};
            const centerInViewPort = {x: topLeftCorner.x + this.width / 2, y: topLeftCorner.y + this.width / 2};
            const cursorPosInViewPort = {x: e.clientX, y: e.clientY};
            let diff = PointCal.subVector(cursorPosInViewPort, centerInViewPort);
            diff.y = -diff.y;
            let clickedAngle = PointCal.angleFromA2B(this.dragStart, diff);
            const event = new DialWheelEvent("needleslide", {angleSpan: clickedAngle});
            this.dispatchEvent(event);
        }

    }

    touchstartHandler(e: TouchEvent){
        e.preventDefault();
        if(e.targetTouches.length == 1){
            const topLeftCorner = {x: this.getBoundingClientRect().left, y: this.getBoundingClientRect().top};
            const centerInViewPort = {x: topLeftCorner.x + this.width / 2, y: topLeftCorner.y + this.width / 2};
            const cursorPosInViewPort = {x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY};
            let diff = PointCal.subVector(cursorPosInViewPort, centerInViewPort);
            diff.y = -diff.y;
            let clickedAngle = PointCal.angleFromA2B({x: 0, y: 1}, diff);
            const event = new DialWheelEvent("needlechange", {angleSpan: clickedAngle});
            this.dialWheel.spin(clickedAngle);
            this.ring.setAttributeNS(null, "transform", `rotate(${this.dialWheel.getRotation() * 180 / Math.PI} ${this.center.x}, ${this.center.y})`);
            this.dispatchEvent(event);
        }
    }

    scrollHandler(e: WheelEvent){
        let scrollAmount = e.deltaY;
        console.log("scroll amount", scrollAmount);
    }

    linkRotation(rotation: number){
        // in radians
        rotation = rotation * 180 / Math.PI;
        this.dialWheel.setRotation(rotation);
        this.ring.setAttributeNS(null, "transform", `rotate(${rotation} ${this.center.x}, ${this.center.y})`);
    }

    getRotation(){

    }

}

class DialWheel {

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

    getAngleSpan(angle: number): number{
        // in radians
        angle = this.normalizeAngleZero2TwoPI(angle);
        let angleDiff = angle - this.rotation;
        
        if(angleDiff > Math.PI){
            angleDiff = - (Math.PI * 2 - angleDiff);
        }

        if(angleDiff < -Math.PI){
            angleDiff += (Math.PI * 2);
        }
        return angleDiff;
    }

    getAngleSpanDeg(angle: number): number{
        // in degrees
        return this.getAngleSpan(angle * Math.PI / 180) * 180 / Math.PI;
    }

}

function createSVGCircleElement(center: Point, radius: number, strokeWidth: number = 3, hollow: boolean = false){

    let newCircle = document.createElementNS('http://www.w3.org/2000/svg',"circle");
    newCircle.setAttributeNS(null, "cx", `${center.x}`);
    newCircle.setAttributeNS(null, "cy", `${center.y}`);
    newCircle.setAttributeNS(null, "r", `${radius}`);
    newCircle.setAttributeNS(null, "stroke", "black");
    newCircle.setAttributeNS(null, "stroke-width", `${strokeWidth}`);
    newCircle.setAttributeNS(null, "fill-opacity", "0");
    if(hollow){
        newCircle.setAttributeNS(null, "fill", "none");
    }

    return newCircle;
}

function createSVGCompassRingElement(center: Point, radius: number, strokeWidth: number = 0.5){
    let ring = document.createElementNS('http://www.w3.org/2000/svg',"g");
    let baseVector = {x: radius, y: 0};
    const directionArray = ["E", "N", "W", "S"];
    for(let degree = 0; degree < 360; degree ++){
        let curVector = PointCal.rotatePoint(baseVector, degree * Math.PI / 180);
        curVector.y = -curVector.y;
        let curUnitVector = PointCal.unitVector(curVector);
        let anchorPoint = PointCal.addVector(center, curVector);
        let tick = document.createElementNS("http://www.w3.org/2000/svg", "path");
        let tickLength = radius * 0.05;
        if(degree % 90 == 0){
            tickLength = tickLength * (radius * 0.02);
            strokeWidth = strokeWidth * (radius * 0.02);
        } else if (degree % 45 == 0){
            tickLength = tickLength * 2;
            strokeWidth = strokeWidth * 1.5;
        }
        
        let startPoint = PointCal.subVector(anchorPoint, PointCal.multiplyVectorByScalar(curUnitVector, tickLength));
        let endPoint = PointCal.addVector(anchorPoint, PointCal.multiplyVectorByScalar(curUnitVector, tickLength));
        tick.setAttributeNS(null, "d", `M ${startPoint.x} ${startPoint.y} L ${endPoint.x} ${endPoint.y}`);
        tick.setAttributeNS(null, "stroke", "black");
        tick.setAttributeNS(null, "stroke-width", `${strokeWidth}`);
        if(degree % 90 == 0){
            let text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.innerHTML = directionArray[Math.floor(degree / 90)];
            text.setAttributeNS(null, "x", `${PointCal.addVector(endPoint, PointCal.multiplyVectorByScalar(curUnitVector, tickLength / (radius * 0.02))).x}`);
            text.setAttributeNS(null, "y", `${PointCal.addVector(endPoint, PointCal.multiplyVectorByScalar(curUnitVector, tickLength / (radius * 0.02))).y}`);
            text.setAttributeNS(null, "text-anchor", "middle");
            ring.appendChild(text);
        }

        ring.appendChild(tick);
        strokeWidth = 0.5;
    }
    return ring;
}

function createCircleArrowSVGElement(center : Point, radius: number, strokeWidth: number = 3){
    
    let anchorPoint = PointCal.addVector(center, PointCal.multiplyVectorByScalar({x: 0, y: -1}, radius));
    let verticalDeivation = radius * 0.1;
    let horizontalDeviation = verticalDeivation * 1.2;
    let arrowTip1 = PointCal.addVector(anchorPoint, {x: horizontalDeviation, y: verticalDeivation});
    let arrowTip2 = PointCal.addVector(anchorPoint, {x: -horizontalDeviation, y: verticalDeivation});
    let arrow = document.createElementNS('http://www.w3.org/2000/svg',"path");
    arrow.setAttributeNS(null, "d", `M ${anchorPoint.x} ${anchorPoint.y} L ${arrowTip1.x} ${arrowTip1.y} M ${anchorPoint.x} ${anchorPoint.y} L ${arrowTip2.x} ${arrowTip2.y}`);
    arrow.setAttributeNS(null, "stroke", "black");
    arrow.setAttributeNS(null, "stroke-width", `${strokeWidth}`);

    return arrow;
}

export class DialWheelEvent extends Event{

    detail: any;

    constructor(type: string, detail: any, eventInitDict?: EventInit){
        super(type, eventInitDict);
        this.detail = detail;
    }

}
