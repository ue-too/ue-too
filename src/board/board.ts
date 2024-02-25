import BoardCamera from "../board-camera";
import { Point } from "..";
import { PointCal } from "point2point";
import {CanvasTouchStrategy, TwoFingerPanZoomForBoard} from "./canvas-touch-strategy";
import { CanvasTrackpadStrategy, TwoFingerPanPinchZoomLimitEntireViewForBoard} from "./canvas-trackpad-strategy";
import { CanvasKMStrategy, DefaultCanvasKMStrategyForBoard } from "./canvas-km-strategy";
import { CameraObserver, CameraState, CameraEventMapping} from "./camera-change-command/camera-observer";
import { CameraListener } from "./camera-change-command/camera-observer";

import { calculateOrderOfMagnitude } from "../util";

export default class Board {
    
    private _fullScreenFlag: boolean = false;

    private _canvas: HTMLCanvasElement; 
    private _context: CanvasRenderingContext2D;

    private _camera: BoardCamera;
    private _cameraObserver: CameraObserver;

    private requestRef: number;
    private _handOverStepControl: boolean = true;
    private lastUpdateTime: number;

    private _touchStrategy: CanvasTouchStrategy;
    private _trackpadStrategy: CanvasTrackpadStrategy;
    private _keyboardMouseStrategy: CanvasKMStrategy;

    private _debugMode: boolean = false;
    private mousePos: Point = {x: 0, y: 0};

    private _verticalGridSize: number = 0;
    private _horizontalGridSize: number = 0;

    private _displayGrid: boolean = false;
    private _displayRuler: boolean = false;

    private attributeObserver: MutationObserver;

    constructor(canvas: HTMLCanvasElement){
        this._canvas = canvas;
        this._context = canvas.getContext("2d");
        this._camera = new BoardCamera();
        this._camera.setMaxZoomLevel(5);
        this._camera.setMinZoomLevel(0.01);
        this._camera.setViewPortWidth(this._canvas.width);
        this._camera.setViewPortHeight(this._canvas.height);
        this.maxTransHalfHeight = 5000;
        this.maxTransHalfWidth = 5000;
        let minZoomLevel = this._canvas.width / (this.maxTransHalfWidth * 2);
        console.log(minZoomLevel);
        if(this._camera.getZoomLevelLimits().min == undefined || minZoomLevel > this._camera.getZoomLevelLimits().min){
            console.log("test width");
            this._camera.setMinZoomLevel(minZoomLevel);
        }
        minZoomLevel = this._canvas.height / (this.maxTransHalfHeight * 2);
        if(this._camera.getZoomLevelLimits().min == undefined || minZoomLevel > this._camera.getZoomLevelLimits().min){
            console.log("test height");
            this._camera.setMinZoomLevel(minZoomLevel);
        }

        this._cameraObserver = new CameraObserver(this._camera);

        this.bindFunctions();

        this._touchStrategy = new TwoFingerPanZoomForBoard(this._canvas, this, this._cameraObserver);
        this._trackpadStrategy = new TwoFingerPanPinchZoomLimitEntireViewForBoard(this._canvas, this, this._cameraObserver);
        this._keyboardMouseStrategy = new DefaultCanvasKMStrategyForBoard(this._canvas, this, this._cameraObserver);

        this._debugMode = false;

        this.attributeObserver = new MutationObserver(this.attributeCallBack.bind(this));

        this.attributeObserver.observe(this._canvas, {attributes: true});
        this.registerEventListeners();
        this.lastUpdateTime = 0;
        if(!this._handOverStepControl){
            this.requestRef = requestAnimationFrame(this.step);
        }
    }

    attributeCallBack(mutationsList: MutationRecord[], observer: MutationObserver){
        for(let mutation of mutationsList){
            if(mutation.type === "attributes"){
                if(mutation.attributeName === "width"){
                    console.log("width changed");
                    this._camera.setViewPortWidth(this._canvas.width);
                    const minZoomLevel = this._canvas.width / (this.maxTransHalfWidth * 2);
                    if(this._camera.getZoomLevelLimits().min == undefined || minZoomLevel > this._camera.getZoomLevelLimits().min){
                        this._camera.setMinZoomLevel(minZoomLevel);
                    }
                } else if(mutation.attributeName === "height"){
                    console.log("height changed");
                    this._camera.setViewPortHeight(this._canvas.height);
                    const minZoomLevel = this._canvas.height / (this.maxTransHalfHeight * 2);
                    if(this._camera.getZoomLevelLimits().min == undefined || minZoomLevel > this._camera.getZoomLevelLimits().min){
                        this._camera.setMinZoomLevel(minZoomLevel);
                    }
                }
            }
        }
    }

    get fullScreenFlag(): boolean {
        return this._fullScreenFlag;
    }

    set fullScreenFlag(value: boolean) {
        this._fullScreenFlag = value;
    }

    get width(): number {
        return this._canvas.width;
    }

    get height(): number {
        return this._canvas.height;
    }

    set height(value: number) {
        this._canvas.height = value;
        this._camera.setViewPortHeight(value);
        const minZoomLevel = value / (this.maxTransHalfHeight * 2);
        if(this._camera.getZoomLevelLimits().min == undefined || minZoomLevel > this._camera.getZoomLevelLimits().min){
            this._camera.setMinZoomLevel(minZoomLevel);
        }
    }

    set stepControl(value: boolean){
        this._handOverStepControl = value;
    }

    get stepControl(): boolean{ 
        return this._handOverStepControl;
    }

    get restrictXTranslation(): boolean{ 
        return this._camera.restrictXTranslationFromGesture;
    }
    
    set restrictXTranslation(value: boolean){
        if(value){
            this._camera.lockXTranslationFromGesture();
        } else {
            this._camera.releaseLockOnXTranslationFromGesture();
        }
    }

    get restrictYTranslation(): boolean{
        return this._camera.restrictYTranslationFromGesture;
    }

    set restrictYTranslation(value: boolean){
        if(value){
            this._camera.lockYTranslationFromGesture();
        } else {
            this._camera.releaseLockOnYTranslationFromGesture();
        }
    }

    get restrictRotation(): boolean{
        return this._camera.restrictRotationFromGesture;
    }

    set restrictRotation(value: boolean){
        if(value){
            this._camera.lockRotationFromGesture();
        } else {
            this._camera.releaseLockOnRotationFromGesture();
        }
    }

    get restrictZoom(): boolean{
        return this._camera.restrictZoomFromGesture;
    }

    set restrictZoom(value: boolean){
        if(value){
            this._camera.lockZoomFromGesture();
        } else {
            this._camera.releaseLockOnZoomFromGesture();
        }
    }

    get restrictRelativeXTranslation(): boolean{
        return this._camera.restrictRelativeXTranslationFromGesture;
    }

    set restrictRelativeXTranslation(value: boolean){
        if(value){
            this._camera.lockRelativeXTranslationFromGesture();
        } else {
            this._camera.releaseLockOnRelativeXTranslationFromGesture();
        }
    }

    get restrictRelativeYTranslation(): boolean{
        return this._camera.restrictRelativeYTranslationFromGesture;
    }

    set restrictRelativeYTranslation(value: boolean){
        if(value){
            this._camera.lockRelativeYTranslationFromGesture();
        } else {
            this._camera.releaseLockOnRelativeYTranslationFromGesture();
        }
    }

    get maxTransHalfHeight(): number | undefined{
        const boundaries = this._camera.getBoundaries();
        if( boundaries != undefined && boundaries.min != undefined && boundaries.max != undefined && boundaries.min.y != undefined && boundaries.max.y != undefined){
            return (boundaries.max.y - boundaries.min.y) / 2;
        }
        return undefined;
    }

    set maxTransHalfHeight(value: number){
        this._camera.setVerticalBoundaries(-value, value);
    }

    get maxTransHalfWidth(): number | undefined{
        const boundaries = this._camera.getBoundaries();
        if( boundaries != undefined && boundaries.min != undefined && boundaries.max != undefined && boundaries.min.x != undefined && boundaries.max.x != undefined){
            return (boundaries.max.x - boundaries.min.x) / 2;
        }
        return undefined;
    }
    
    set maxTransHalfWidth(value: number){
        this._camera.setHorizontalBoundaries(-value, value);
    }

    get debugMode(): boolean{
        return this._debugMode;
    }

    set debugMode(value: boolean){
        this._debugMode = value;
    }

    get camera(): BoardCamera{
        return this._camera;
    }

    set touchStrategy(strategy: CanvasTouchStrategy){
        this._touchStrategy = strategy;
    }

    get touchStrategy(): CanvasTouchStrategy{
        return this._touchStrategy;
    }

    set trackpadStrategy(strategy: CanvasTrackpadStrategy){
        this._trackpadStrategy = strategy;
    }

    get trackpadStrategy(): CanvasTrackpadStrategy{
        return this._trackpadStrategy;
    }

    set keyboardMouseStrategy(strategy: CanvasKMStrategy){
        this._keyboardMouseStrategy = strategy;
    }

    get keyboardMouseStrategy(): CanvasKMStrategy{
        return this._keyboardMouseStrategy;
    }

    set verticalGridSize(value: number){
        if(value < 0) {
            return;
        }
        this._verticalGridSize = value;
    }

    get verticalGridSize(): number{
        return this._verticalGridSize;
    }

    set horizontalGridSize(value: number){
        if(value < 0) {
            return;
        }
        this._horizontalGridSize = value;
    }

    get horizontalGridSize(): number{
        return this._horizontalGridSize;
    }

    get displayGrid(): boolean{
        return this._displayGrid;
    }

    set displayGrid(value: boolean){
        this._displayGrid = value;
    }

    get displayRuler(): boolean{
        return this._displayRuler;
    }

    set displayRuler(value: boolean){
        this._displayRuler = value;
    }

    bindFunctions(){
        this.step = this.step.bind(this);
        this.pointerMoveHandler = this.pointerMoveHandler.bind(this);
        this.pointerDownHandler = this.pointerDownHandler.bind(this);
    }

    disconnectedCallback(){
        if(!this._handOverStepControl){
            cancelAnimationFrame(this.requestRef);
        }
        this.removeEventListeners();
    }

    private step(timestamp: number){

        let deltaTime = timestamp - this.lastUpdateTime;
        this.lastUpdateTime = timestamp;
        deltaTime = deltaTime / 1000;

        // this._canvas.width = this._canvas.width;
        // this._canvas.height = this._canvas.height;
        this._context.resetTransform();
        this._context.clearRect(-this.maxTransHalfWidth, -this.maxTransHalfHeight, this.maxTransHalfWidth * 2, this.maxTransHalfHeight * 2);

        this._context.translate( this._canvas.width / 2, this._canvas.height / 2 );
        this._context.scale(this._camera.getZoomLevel(), this._camera.getZoomLevel());
        this._context.rotate(this._camera.getRotation());
        this._context.translate(-this._camera.getPosition().x,  this._camera.getPosition().y);

        this._camera.step(deltaTime);

        if(this._debugMode){
            let mouseInWorld = this.convertWindowPoint2WorldCoord(this.mousePos);
            this.drawBoundingBox(this._context);
            this.drawCrossHair(this._context, mouseInWorld, 50);
            this.drawPositionText(this._context, mouseInWorld, 20);
            this.drawReferenceCircle(this._context, {x: 30, y: 20});
            this.drawAxis(this._context, this._camera.getZoomLevel());
            this.drawCameraCenterWithCrossHair(this._context, 50);
        }

        if(this._displayGrid && this._camera.getRotationDeg() == 0){
            this.drawGrid(this._context);
        }

        if(this._displayRuler && this._camera.getRotationDeg() == 0){
            this.drawRuler(this._context);
        }

        // everthing should be above this reqestAnimationFrame should be the last call in step
        if(!this._handOverStepControl){
            this.requestRef = window.requestAnimationFrame(this.step);
        }
    }

    registerEventListeners(){
        this._trackpadStrategy.setUp();
        this._touchStrategy.setUp();
        this._keyboardMouseStrategy.setUp();
        this._canvas.addEventListener('pointermove', this.pointerMoveHandler.bind(this));
        this._canvas.addEventListener('pointerdown', this.pointerDownHandler.bind(this));
    }

    removeEventListeners(){
        this._trackpadStrategy.tearDown();
        this._touchStrategy.tearDown();
        this._keyboardMouseStrategy.tearDown();
    }

    pointerMoveHandler(e: PointerEvent){
        this.mousePos = {x: e.clientX, y: e.clientY}; 
    }

    pointerDownHandler(e: PointerEvent) {
        console.log("clicked at", this.convertWindowPoint2WorldCoord({x: e.clientX, y: e.clientY}));
    }

    getCoordinateConversionFn(bottomLeftCorner: Point): (interestPoint: Point)=>Point{
        const conversionFn =  (interestPoint: Point)=>{
            const viewPortPoint = PointCal.flipYAxis(PointCal.subVector(interestPoint, bottomLeftCorner));
            return viewPortPoint;
        }
        return conversionFn;
    }

    getInternalCanvas(): HTMLCanvasElement {
        return this._canvas;
    }

    getCamera(): BoardCamera {
        return this._camera;
    }

    convertWindowPoint2ViewPortPoint(bottomLeftCornerOfCanvas: Point, clickPointInWindow: Point): Point {
        const res = PointCal.subVector(clickPointInWindow, bottomLeftCornerOfCanvas);
        return {x: res.x, y: -res.y};
    }

    convertWindowPoint2WorldCoord(clickPointInWindow: Point): Point {
        const pointInCameraViewPort = this.convertWindowPoint2ViewPortPoint({y: this._canvas.getBoundingClientRect().bottom, x: this._canvas.getBoundingClientRect().left}, clickPointInWindow);
        return this._camera.convert2WorldSpace(pointInCameraViewPort);
    }

    drawAxis(context: CanvasRenderingContext2D, zoomLevel: number): void{
        context.lineWidth = 1 / zoomLevel;
        // y axis
        context.beginPath();
        context.strokeStyle = `rgba(87, 173, 72, 0.8)`;
        context.moveTo(0, 0);
        context.lineTo(0, -this.maxTransHalfHeight);
        context.stroke();
        
        // x axis
        context.beginPath();
        context.strokeStyle = `rgba(220, 59, 59, 0.8)`;
        context.moveTo(0, 0);
        context.lineTo(this.maxTransHalfWidth, 0);
        context.stroke();
    }

    drawReferenceCircle(context: CanvasRenderingContext2D, pos: Point): void {
        context.beginPath();
        context.strokeStyle = `rgba(87, 173, 72, 0.8)`;
        // context.moveTo(pos.x, -pos.y);
        context.arc(pos.x, -pos.y, 5, 0, 2 * Math.PI);
        context.stroke();
    }

    drawBoundingBox(context: CanvasRenderingContext2D): void{
        context.beginPath();
        context.strokeStyle = "blue";
        context.lineWidth = 100;
        context.roundRect(-this.maxTransHalfWidth, -this.maxTransHalfHeight, this.maxTransHalfWidth * 2, this.maxTransHalfHeight * 2, 5);
        context.stroke();
        context.lineWidth = 3;
    }

    drawCrossHair(context: CanvasRenderingContext2D, pos: Point, size: number, color: string = "red"): void{
        // size is the pixel shown in the viewport 
        let halfSize = size / 2;
        halfSize = halfSize / this._camera.getZoomLevel();
        context.beginPath();
        context.strokeStyle = color;
        context.lineWidth = 2 / this._camera.getZoomLevel();
        context.moveTo(pos.x - halfSize, -pos.y);
        context.lineTo(pos.x + halfSize, -pos.y);
        context.moveTo(pos.x, -pos.y - halfSize);
        context.lineTo(pos.x, -pos.y + halfSize);
        context.stroke();
        context.lineWidth = 3;
    }

    drawCameraCenterWithCrossHair(context: CanvasRenderingContext2D, size: number): void{
        let pos = this._camera.getPosition();
        this.drawCrossHair(context, pos, size, "teal");
        this.drawPositionText(context, pos, 20, "teal");
    }

    drawGrid(context: CanvasRenderingContext2D): void{
        let topLeftCorner = {y: this._canvas.getBoundingClientRect().top, x: this._canvas.getBoundingClientRect().left};
        topLeftCorner = this.convertWindowPoint2WorldCoord(topLeftCorner);
        let topRightCorner = {y: this._canvas.getBoundingClientRect().top, x: this._canvas.getBoundingClientRect().right};
        topRightCorner = this.convertWindowPoint2WorldCoord(topRightCorner);
        let bottomLeftCorner = {y: this._canvas.getBoundingClientRect().bottom, x: this._canvas.getBoundingClientRect().left};
        bottomLeftCorner = this.convertWindowPoint2WorldCoord(bottomLeftCorner);
        let bottomRightCorner = {y: this._canvas.getBoundingClientRect().bottom, x: this._canvas.getBoundingClientRect().right};
        bottomRightCorner = this.convertWindowPoint2WorldCoord(bottomRightCorner);
        let leftRightDirection = PointCal.unitVectorFromA2B(topLeftCorner, topRightCorner);
        let topDownDirection = PointCal.unitVectorFromA2B(bottomLeftCorner, topLeftCorner);
        let width = PointCal.distanceBetweenPoints(topLeftCorner, topRightCorner);
        let orderOfMagnitude = calculateOrderOfMagnitude(width);
        let divisor = Math.pow(10, orderOfMagnitude);
        let subDivisor = divisor / 10;
        let minHorizontalSmallTick = Math.ceil(topLeftCorner.x / subDivisor) * subDivisor;
        let maxHorizontalSmallTick = Math.floor(topRightCorner.x / subDivisor) * subDivisor;
        let minVerticalSmallTick = Math.ceil(bottomLeftCorner.y / subDivisor) * subDivisor;
        let maxVerticalSmallTick = Math.floor(topLeftCorner.y / subDivisor) * subDivisor;

        for(let i = minHorizontalSmallTick; i <= maxHorizontalSmallTick; i += subDivisor){
            context.beginPath();
            context.strokeStyle = "black";
            context.fillStyle = "black";
            context.lineWidth = 0.5 / this._camera.getZoomLevel();
            context.moveTo(i, -topLeftCorner.y);
            context.lineTo(i, -topLeftCorner.y + this.height / this._camera.getZoomLevel());
            context.stroke();
        }
        for(let i = minVerticalSmallTick; i <= maxVerticalSmallTick; i += subDivisor){
            context.beginPath();
            context.strokeStyle = "black";
            context.fillStyle = "black";
            context.lineWidth = 0.5 / this._camera.getZoomLevel();
            context.moveTo(topLeftCorner.x, -i);
            context.lineTo(topLeftCorner.x + this.width / this._camera.getZoomLevel(), -i);
            context.stroke();
        }
    }

    drawRuler(context: CanvasRenderingContext2D): void{
        let topLeftCorner = {y: this._canvas.getBoundingClientRect().top, x: this._canvas.getBoundingClientRect().left};
        topLeftCorner = this.convertWindowPoint2WorldCoord(topLeftCorner);
        let topRightCorner = {y: this._canvas.getBoundingClientRect().top, x: this._canvas.getBoundingClientRect().right};
        topRightCorner = this.convertWindowPoint2WorldCoord(topRightCorner);
        let bottomLeftCorner = {y: this._canvas.getBoundingClientRect().bottom, x: this._canvas.getBoundingClientRect().left};
        bottomLeftCorner = this.convertWindowPoint2WorldCoord(bottomLeftCorner);
        let bottomRightCorner = {y: this._canvas.getBoundingClientRect().bottom, x: this._canvas.getBoundingClientRect().right};
        bottomRightCorner = this.convertWindowPoint2WorldCoord(bottomRightCorner);
        let leftRightDirection = PointCal.unitVectorFromA2B(topLeftCorner, topRightCorner);
        let topDownDirection = PointCal.unitVectorFromA2B(bottomLeftCorner, topLeftCorner);
        let width = PointCal.distanceBetweenPoints(topLeftCorner, topRightCorner);
        let orderOfMagnitude = calculateOrderOfMagnitude(width);
        let divisor = Math.pow(10, orderOfMagnitude);
        let halfDivisor = divisor / 2;
        let subDivisor = divisor / 10;
        let minHorizontalLargeTick = Math.ceil(topLeftCorner.x / divisor) * divisor;
        let maxHorizontalLargeTick = Math.floor(topRightCorner.x / divisor) * divisor;
        let minVerticalLargeTick = Math.ceil(bottomLeftCorner.y / divisor) * divisor;
        let maxVerticalLargeTick = Math.floor(topLeftCorner.y / divisor) * divisor;
        let minHorizontalMediumTick = Math.ceil(topLeftCorner.x / halfDivisor) * halfDivisor;
        let maxHorizontalMediumTick = Math.floor(topRightCorner.x / halfDivisor) * halfDivisor;
        let minVerticalMediumTick = Math.ceil(bottomLeftCorner.y / halfDivisor) * halfDivisor;
        let maxVerticalMediumTick = Math.floor(topLeftCorner.y / halfDivisor) * halfDivisor;
        let minHorizontalSmallTick = Math.ceil(topLeftCorner.x / subDivisor) * subDivisor;
        let maxHorizontalSmallTick = Math.floor(topRightCorner.x / subDivisor) * subDivisor;
        let minVerticalSmallTick = Math.ceil(bottomLeftCorner.y / subDivisor) * subDivisor;
        let maxVerticalSmallTick = Math.floor(topLeftCorner.y / subDivisor) * subDivisor;
        let horizontalLargeTickCrampedness = (maxHorizontalLargeTick - minHorizontalLargeTick) / divisor;
        let verticalLargeTickCrampedness = (maxVerticalLargeTick - minVerticalLargeTick) / divisor;
        let horizontalMediumTickCrampedness = (maxHorizontalMediumTick - minHorizontalMediumTick) / halfDivisor;
        let verticalMediumTickCrampedness = (maxVerticalMediumTick - minVerticalMediumTick) / halfDivisor;
       
        let divisorInActualPixel = divisor / this._camera.getZoomLevel();
        let halfDivisorInActualPixel = halfDivisor / this._camera.getZoomLevel();
        let subDivisorInActualPixel = subDivisor / this._camera.getZoomLevel();


        for(let i = minHorizontalLargeTick; i <= maxHorizontalLargeTick; i += divisor){
            context.beginPath();
            context.strokeStyle = "black";
            context.fillStyle = "black";
            context.lineWidth = 5 / this._camera.getZoomLevel();
            let resPoint = PointCal.addVector({x: i, y: topLeftCorner.y}, PointCal.multiplyVectorByScalar(topDownDirection, 50 / this._camera.getZoomLevel()));
            context.moveTo(resPoint.x, -resPoint.y);
            resPoint = PointCal.addVector({x: i, y: topLeftCorner.y}, PointCal.multiplyVectorByScalar(topDownDirection, -50 / this._camera.getZoomLevel()));
            context.lineTo(resPoint.x, -resPoint.y);
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.font = `bold ${20 / this._camera.getZoomLevel()}px Helvetica`;
            const textDimensions = context.measureText(`${i.toFixed(0)}`);
            const height = textDimensions.fontBoundingBoxAscent + textDimensions.fontBoundingBoxDescent;
            context.fillText(`${i.toFixed(0)}`, resPoint.x , -(resPoint.y - height / 2 - height * 0.2));
            context.stroke();
        }
        for(let i = minVerticalLargeTick; i <= maxVerticalLargeTick; i += divisor){
            context.beginPath();
            context.strokeStyle = "black";
            context.fillStyle = "black";
            context.lineWidth = 5 / this._camera.getZoomLevel();
            let resPoint = PointCal.addVector({x: topLeftCorner.x, y: i}, PointCal.multiplyVectorByScalar(leftRightDirection, -50 / this._camera.getZoomLevel()));
            context.moveTo(resPoint.x, -resPoint.y);
            resPoint = PointCal.addVector({x: topLeftCorner.x, y: i}, PointCal.multiplyVectorByScalar(leftRightDirection, 50 / this._camera.getZoomLevel()));
            context.lineTo(resPoint.x, -resPoint.y);
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.font = `bold ${20 / this._camera.getZoomLevel()}px Helvetica`;
            
            const textDimensions = context.measureText(`${i.toFixed(0)}`);
            context.fillText(`${i.toFixed(0)}`, resPoint.x +  textDimensions.width / 2 + textDimensions.width * 0.3, -resPoint.y );
            context.stroke();
        }
        for(let i = minHorizontalMediumTick; i <= maxHorizontalMediumTick; i += halfDivisor){
            if(i % divisor == 0) continue;
            context.beginPath();
            context.strokeStyle = "black";
            context.fillStyle = "black";
            context.lineWidth = 3 / this._camera.getZoomLevel();
            let resPoint = PointCal.addVector({x: i, y: topLeftCorner.y}, PointCal.multiplyVectorByScalar(topDownDirection, 25 / this._camera.getZoomLevel()));
            context.moveTo(resPoint.x, -resPoint.y);
            resPoint = PointCal.addVector({x: i, y: topLeftCorner.y}, PointCal.multiplyVectorByScalar(topDownDirection, -25 / this._camera.getZoomLevel()));
            context.lineTo(resPoint.x, -resPoint.y);
            context.font = `${15 / this._camera.getZoomLevel()}px Helvetica`;
            const textDimensions = context.measureText(`${i.toFixed(0)}`);
            if(halfDivisorInActualPixel > textDimensions.width) {
                context.textAlign = "center";
                context.textBaseline = "middle";
                const height = textDimensions.fontBoundingBoxAscent + textDimensions.fontBoundingBoxDescent;
                context.fillText(`${i.toFixed(0)}`, resPoint.x , -(resPoint.y - height / 2 - height * 0.2));
            }
            context.stroke();
        }
        for(let i = minVerticalMediumTick; i <= maxVerticalMediumTick; i += halfDivisor){
            if(i % divisor == 0) continue;
            context.beginPath();
            context.strokeStyle = "black";
            context.fillStyle = "black";
            context.lineWidth = 3 / this._camera.getZoomLevel();
            let resPoint = PointCal.addVector({x: topLeftCorner.x, y: i}, PointCal.multiplyVectorByScalar(leftRightDirection, -25 / this._camera.getZoomLevel()));
            context.moveTo(resPoint.x, -resPoint.y);
            resPoint = PointCal.addVector({x: topLeftCorner.x, y: i}, PointCal.multiplyVectorByScalar(leftRightDirection, 25 / this._camera.getZoomLevel()));
            context.lineTo(resPoint.x, -resPoint.y);
            context.font = `${18 / this._camera.getZoomLevel()}px Helvetica`;
            const textDimensions = context.measureText(`${i.toFixed(0)}`);
            const height = textDimensions.fontBoundingBoxAscent + textDimensions.fontBoundingBoxDescent;
            if(halfDivisorInActualPixel > height) {
                context.textAlign = "center";
                context.textBaseline = "middle";
                context.fillText(`${i.toFixed(0)}`, resPoint.x +  textDimensions.width / 2 + textDimensions.width * 0.3, -resPoint.y );
            }
            context.stroke();
        }
        for(let i = minHorizontalSmallTick; i <= maxHorizontalSmallTick; i += subDivisor){
            if(i % divisor == 0 || i % halfDivisor == 0) continue;
            context.beginPath();
            context.strokeStyle = "black";
            context.fillStyle = "black";
            context.lineWidth = 1 / this._camera.getZoomLevel();
            let resPoint = PointCal.addVector({x: i, y: topLeftCorner.y}, PointCal.multiplyVectorByScalar(topDownDirection, 12.5 / this._camera.getZoomLevel()));
            context.moveTo(resPoint.x, -resPoint.y);
            resPoint = PointCal.addVector({x: i, y: topLeftCorner.y}, PointCal.multiplyVectorByScalar(topDownDirection, -12.5 / this._camera.getZoomLevel()));
            context.lineTo(resPoint.x, -resPoint.y);
            context.font = `${10 / this._camera.getZoomLevel()}px Helvetica`;
            const textDimensions = context.measureText(`${i.toFixed(0)}`);
            if(subDivisorInActualPixel > textDimensions.width) {
                context.textAlign = "center";
                context.textBaseline = "middle";
                const height = textDimensions.fontBoundingBoxAscent + textDimensions.fontBoundingBoxDescent;
                context.fillText(`${i.toFixed(0)}`, resPoint.x , -(resPoint.y - height / 2 - height * 0.2));
            }
            context.stroke();
        }
        for(let i = minVerticalSmallTick; i <= maxVerticalSmallTick; i += subDivisor){
            if(i % divisor == 0 || i % halfDivisor == 0) continue;
            context.beginPath();
            context.strokeStyle = "black";
            context.fillStyle = "black";
            context.lineWidth = 1 / this._camera.getZoomLevel();
            let resPoint = PointCal.addVector({x: topLeftCorner.x, y: i}, PointCal.multiplyVectorByScalar(leftRightDirection, -12.5 / this._camera.getZoomLevel()));
            context.moveTo(resPoint.x, -resPoint.y);
            resPoint = PointCal.addVector({x: topLeftCorner.x, y: i}, PointCal.multiplyVectorByScalar(leftRightDirection, 12.5 / this._camera.getZoomLevel()));
            context.lineTo(resPoint.x, -resPoint.y);
            context.font = `${12 / this._camera.getZoomLevel()}px Helvetica`;
            const textDimensions = context.measureText(`${i.toFixed(0)}`);
            const height = textDimensions.fontBoundingBoxAscent + textDimensions.fontBoundingBoxDescent;
            if(subDivisorInActualPixel > height) {
                context.textAlign = "center";
                context.textBaseline = "middle";
                context.fillText(`${i.toFixed(0)}`, resPoint.x +  textDimensions.width / 2 + textDimensions.width * 0.3, -resPoint.y );
            }
            context.stroke();
        }
    }

    drawPositionText(context: CanvasRenderingContext2D, pos: Point, offset: number, color: string="red"): void{
        offset = offset / this._camera.getZoomLevel();
        context.font = `${20 / this._camera.getZoomLevel()}px Arial`;
        context.fillStyle = color;
        context.fillText(`x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}`, pos.x + offset, -pos.y - offset);
    }

    resetCamera(){
        this._camera.resetCameraWithAnimation();
    }

    spinCameraWithAnimation(rotation: number){
        this._camera.spinWithAnimationFromGesture(rotation);
    }

    setCameraAngle(rotation: number){
        this._camera.spinFromGesture(rotation);
    }

    getStepFunction(): (timestamp: number)=>void{
        if (this._handOverStepControl){
            return this.step.bind(this);
        } else {
            return null;
        }
    }

    getContext(): CanvasRenderingContext2D{
        return this._context;
    }

    subscribeToCameraUpdate(listener: CameraListener){
        this._cameraObserver.subscribe(listener);
    }

    unsubscribeToCameraUpdate(listener: CameraListener){
        this._cameraObserver.unsubscribe(listener);
    }

    on<K extends keyof CameraEventMapping>(eventName: K, callback: (event: CameraEventMapping[K], cameraState: CameraState)=>void): void {
        this._cameraObserver.on(eventName, callback);
    }

    clearCameraUpdateCallbacks(){
        this._cameraObserver.clearCallbacks();
    }
}
