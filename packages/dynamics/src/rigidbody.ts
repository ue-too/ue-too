import { PointCal, Point } from "@ue-too/math";

export interface RigidBody {
    center: Point;
    orientationAngle: number;
    linearVelocity: Point;
    angularVelocity: number;
    AABB: {min: Point, max: Point};
    mass: number;
    staticFrictionCoeff: number;
    momentOfInertia: number;
    step(deltaTime: number): void;
    isStatic(): boolean;
    isMovingStatic(): boolean;
    getMinMaxProjection(unitvector: Point): {min: number, max: number};
    getCollisionAxes(relativeBody: RigidBody): Point[];
    applyForce(force: Point): void;
    applyForceInOrientation(force: Point): void;
    // applyForceAtPoint(force: Point, point: Point): void;
    move(delta: Point): void;
    significantVertex(collisionNormal: Point): Point;
    getSignificantVertices(collisionNormal: Point): Point[];
    getNormalOfSignificantFace(collisionNormal: Point): Point;
    getAdjacentFaces(collisionNormal: Point): {startPoint: {coord: Point, index: number}, endPoint: {coord: Point, index: number}}[];
}

export interface VisualComponent{
    draw(ctx: CanvasRenderingContext2D): void;
}

export abstract class BaseRigidBody implements RigidBody{
    
    protected _center: Point;
    protected _mass: number = 50;
    protected _linearVelocity: Point;
    protected _angularVelocity: number; // in radians
    protected _orientationAngle: number = 0;
    protected linearAcceleartion: Point;
    protected force: Point;
    protected isStaticBody: boolean = false;
    protected _staticFrictionCoeff: number = 0.3;
    protected dynamicFrictionCoeff: number = 0.3;
    protected frictionEnabled: boolean = false;
    protected isMovingStaticBody: boolean = false;
    protected angularDampingFactor: number = 0.005;
    

    constructor(center: Point, _orientationAngle: number = 0, mass: number = 50, isStaticBody: boolean = false, frictionEnabled: boolean = false){
        this._center = center;
        this._orientationAngle = _orientationAngle;
        this._mass = mass;
        this.isStaticBody = isStaticBody;
        this.frictionEnabled = frictionEnabled;
        this.force = {x: 0, y: 0};
        this.linearAcceleartion = {x: 0, y: 0};
        this._linearVelocity = {x: 0, y: 0};
        this._angularVelocity = 0;
    }

    move(delta: Point): void {
        if (!this.isStatic()){
            this._center = PointCal.addVector(this._center, delta);
        }
    }

    rotateRadians(angle: number): void {
        this._orientationAngle += angle;
    }

    getCenter(): Point {
        return this._center;
    }

    getOrientationAngle(): number{
        return this._orientationAngle;
    }

    get angularVelocity(): number{
        return this._angularVelocity;
    }

    set angularVelocity(angularVelocity: number){
        this._angularVelocity = angularVelocity;
    }

    get orientationAngle(): number{
        return this._orientationAngle;
    }

    isStatic(): boolean{
        return this.isStaticBody;
    }

    isMovingStatic(): boolean {
        return this.isMovingStaticBody;
    }

    setLinearVelocity(linearVelocity: Point): void {
        this._linearVelocity = linearVelocity;
    }

    setMovingStatic(movingStatic: boolean):void {
        this.isMovingStaticBody = movingStatic;
    }

    setOrientationAngle(angle: number): void{
        this._orientationAngle = angle;
    }

    applyForce(force: Point): void {
        if (PointCal.magnitude(this.force) !== 0){
            this.force = PointCal.addVector(this.force, force);
        } else {
            this.force = force;
        }
    }

    applyForceInOrientation(force: Point | number): void {
        let forceTransformed: Point;
        if (typeof force === "number") {
            forceTransformed = PointCal.rotatePoint({x: force, y: 0}, this._orientationAngle);
        } else {
            forceTransformed = PointCal.rotatePoint(force, this._orientationAngle);
        }
        this.applyForce(forceTransformed);
    }

    step(deltaTime: number): void {
        if (this.frictionEnabled) {
            if (this.isStatic()  || 
                (this.linearVelocity.x == 0 && 
                 this.linearVelocity.y == 0 && 
                 PointCal.magnitude(PointCal.subVector({x: this.force.x, y: this.force.y}, {x: 0, y: 0})) >= 0 && 
                 PointCal.magnitude({x: this.force.x, y: this.force.y}) < this.staticFrictionCoeff * this.mass * 9.81)
                ) {
                if (this.force.z != undefined) {
                    this.force = {x: 0, y: 0, z: this.force.z};
                } else {
                    this.force = {x: 0, y: 0};
                }
                // return;
            } else {
                let kineticFrictionDirection = PointCal.multiplyVectorByScalar(PointCal.unitVector({x: this._linearVelocity.x, y: this._linearVelocity.y}), -1);
                let kineticFriction = PointCal.multiplyVectorByScalar(kineticFrictionDirection, this.dynamicFrictionCoeff * this.mass * 9.81);
                this.force = PointCal.addVector(this.force, kineticFriction);
            }
        }
        const angularDamping = this._angularVelocity != 0 ? this._angularVelocity > 0 ? -this.angularDampingFactor : this.angularDampingFactor : 0;
        // console.log("angular velocity", this._angularVelocity);
        // console.log("angular damping", angularDamping);
        if (Math.abs(this._angularVelocity) < Math.abs(angularDamping)) {
            this._angularVelocity = 0;
        } else {
            this._angularVelocity += angularDamping;
        }
        this._orientationAngle += this._angularVelocity * deltaTime;
        if (PointCal.magnitude({x: this._linearVelocity.x, y: this._linearVelocity.y}) < PointCal.magnitude(PointCal.divideVectorByScalar(PointCal.multiplyVectorByScalar(this.force, deltaTime), this.mass))){
            if (this._linearVelocity.z != undefined) {
                this._linearVelocity = {x: 0, y: 0, z: this._linearVelocity.z};
            } else {
                this._linearVelocity = {x: 0, y: 0};
            }
        }
        const gravitationalForce = -9.81 * this._mass;
        this.force = PointCal.addVector(this.force, {x: 0, y: 0, z: gravitationalForce});
        this._linearVelocity = PointCal.addVector(this._linearVelocity, PointCal.divideVectorByScalar(PointCal.multiplyVectorByScalar(this.force, deltaTime), this.mass));
        this._center = PointCal.addVector(this._center, PointCal.multiplyVectorByScalar(this._linearVelocity, deltaTime));
        if (this._center.z != undefined && this._center.z < 0) {
            this._center.z = 0;
        }
        this.force = {x: 0, y: 0};
    }

    get center(): Point {
        return this._center;
    }

    set center(dest: Point){
        this._center = dest;
    }

    get linearVelocity(): Point {
        return this._linearVelocity;
    }

    set linearVelocity(dest: Point){
        this._linearVelocity = dest;
    }

    get mass(): number{
        return this._mass;
    }

    get staticFrictionCoeff(): number{
        return this._staticFrictionCoeff;
    }

    set staticFrictionCoeff(coeff: number){
        this._staticFrictionCoeff = coeff;
    }

    abstract get momentOfInertia(): number;
    abstract getMinMaxProjection(unitvector: Point): {min: number, max: number};
    abstract getCollisionAxes(relativeBody: RigidBody): Point[];
    abstract get AABB(): {min: Point, max: Point};
    abstract significantVertex(collisionNormal: Point): Point;
    abstract getSignificantVertices(collisionNormal: Point): Point[];
    abstract getNormalOfSignificantFace(collisionNormal: Point): Point;
    abstract getAdjacentFaces(collisionNormal: Point): {startPoint: {coord: Point, index: number}, endPoint: {coord: Point, index: number}}[];
}

export class VisaulCircleBody implements VisualComponent, RigidBody {

    private _circle: Circle;
    private _context: CanvasRenderingContext2D;

    constructor(center: Point = {x: 0, y: 0}, radius: number, drawingContext: CanvasRenderingContext2D, _orientationAngle: number = 0, mass: number = 50, isStatic: boolean = false, frictionEnabled: boolean = true) {
        this._circle = new Circle(center, radius, _orientationAngle, mass, isStatic, frictionEnabled);
        this._context = drawingContext;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        ctx.beginPath();
        ctx.arc(this._circle.center.x, this._circle.center.y, this._circle.radius, 0, 2 * Math.PI);
        ctx.stroke();
    }

    step(deltaTime: number): void {
        this._circle.step(deltaTime);
        this.draw(this._context);
    }

    isStatic(): boolean {
        return this._circle.isStatic();
    }

    isMovingStatic(): boolean {
        return this._circle.isMovingStatic();
    }

    getMinMaxProjection(unitvector: Point): { min: number; max: number; } {
        return this._circle.getMinMaxProjection(unitvector);
    }

    getCollisionAxes(relativeBody: RigidBody): Point[] {
        return this._circle.getCollisionAxes(relativeBody);
    }

    applyForce(force: Point): void {
        this._circle.applyForce(force);
    }

    get AABB(): { min: Point; max: Point; } {
        return this._circle.AABB;
    }

    getMass(): number {
        return this._circle.mass;
    }

    applyForceInOrientation(force: Point): void {
        this._circle.applyForceInOrientation(force);
    }

    move(delta: Point): void {
        this._circle.move(delta);
    }

    getSignificantVertices(collisionNormal: Point): Point[] {
        return this._circle.getSignificantVertices(collisionNormal);
    }

    get center(): Point {
        return this._circle.center;
    }

    set center(dest: Point){
        this._circle.center = dest;
    }

    get linearVelocity(): Point {
        return this._circle.linearVelocity;
    }

    set linearVelocity(dest: Point){
        this._circle.linearVelocity = dest;
    }

    get orientationAngle(){
        return this._circle.orientationAngle;
    }

    significantVertex(collisionNormal: Point): Point {
        return this._circle.significantVertex(collisionNormal);
    }

    set angularVelocity(angularVelocity: number){
        this._circle.angularVelocity = angularVelocity;
    }

    get angularVelocity(): number{
        return this._circle.angularVelocity;
    }

    get mass(): number{
        return this._circle.mass;
    }

    getNormalOfSignificantFace(collisionNormal: Point): Point {
        return this._circle.getNormalOfSignificantFace(collisionNormal);
    }

    get staticFrictionCoeff(): number{
        return this._circle.staticFrictionCoeff;
    }

    set staticFrictionCoeff(coeff: number){
        this._circle.staticFrictionCoeff = coeff;
    }

    getAdjacentFaces(collisionNormal: Point): {startPoint: {coord: Point, index: number}, endPoint: {coord: Point, index: number}}[] {
        return this._circle.getAdjacentFaces(collisionNormal);
    }

    get momentOfInertia(): number {
        return this._circle.momentOfInertia;
    }

}

export class VisualPolygonBody implements VisualComponent, RigidBody {
    
    private _polygon: Polygon;
    private _context: CanvasRenderingContext2D;

    constructor(center: Point = {x: 0, y: 0}, vertices: Point[], drawingContext: CanvasRenderingContext2D, _orientationAngle: number = 0, mass: number = 50, isStatic: boolean = false, frictionEnabled: boolean = true) {
        this._polygon = new Polygon(center, vertices, _orientationAngle, mass, isStatic, frictionEnabled);
        this._context = drawingContext;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        ctx.beginPath();
        let vertices = this._polygon.getVerticesAbsCoord();
        ctx.moveTo(vertices[0].x, vertices[0].y);
        vertices.forEach(vertex => {
            ctx.lineTo(vertex.x, vertex.y);
        });
        ctx.lineTo(vertices[0].x, vertices[0].y);
        ctx.stroke();
        // ctx.beginPath();
        // ctx.rect(this._polygon.AABB.min.x, this._polygon.AABB.min.y, this._polygon.AABB.max.x - this._polygon.AABB.min.x, this._polygon.AABB.max.y - this._polygon.AABB.min.y);
        // ctx.stroke();
    }

    step(deltaTime: number): void {
        this._polygon.step(deltaTime);
        this.draw(this._context);
    }

    isStatic(): boolean {
        return this._polygon.isStatic();
    }

    isMovingStatic(): boolean {
        return this._polygon.isMovingStatic();
    }

    getMinMaxProjection(unitvector: Point): { min: number; max: number; } {
        return this._polygon.getMinMaxProjection(unitvector);
    }

    getCollisionAxes(relativeBody: RigidBody): Point[] {
        return this._polygon.getCollisionAxes(relativeBody);
    }

    applyForce(force: Point): void {
        this._polygon.applyForce(force);
    }

    applyForceInOrientation(force: Point): void {
        this._polygon.applyForceInOrientation(force);
    }

    setLinearVelocity(linearVelocity: Point): void {
        this._polygon.setLinearVelocity(linearVelocity);
    }

    move(delta: Point): void {
        this._polygon.move(delta);
    }

    get center(): Point {
        return this._polygon.center;
    }

    set center(dest: Point){
        this._polygon.center = dest;
    }

    get linearVelocity(): Point {
        return this._polygon.linearVelocity;
    }

    set linearVelocity(dest: Point){
        this._polygon.linearVelocity = dest;
    }

    get angularVelocity(): number{
        return this._polygon.angularVelocity;
    }

    set angularVelocity(angularVelocity: number){
        this._polygon.angularVelocity = angularVelocity;
    }

    get orientationAngle(): number{
        return this._polygon.orientationAngle;
    }

    significantVertex(collisionNormal: Point): Point {
        return this._polygon.significantVertex(collisionNormal);
    }

    getSignificantVertices(collisionNormal: Point): Point[] {
        return this._polygon.getSignificantVertices(collisionNormal);
    }

    get AABB(): {min: Point, max: Point}{
        return this._polygon.AABB;
    }

    get mass(): number{
        return this._polygon.mass;
    }
    
    get staticFrictionCoeff(): number{
        return this._polygon.staticFrictionCoeff;
    }

    set staticFrictionCoeff(coeff: number){
        this._polygon.staticFrictionCoeff = coeff;
    }

    get momentOfInertia(): number {
        return this._polygon.momentOfInertia;
    }

    getNormalOfSignificantFace(collisionNormal: Point): Point {
        return this._polygon.getNormalOfSignificantFace(collisionNormal);
    }

    getAdjacentFaces(collisionNormal: Point): {startPoint: {coord: Point, index: number}, endPoint: {coord: Point, index: number}}[] {
        return this._polygon.getAdjacentFaces(collisionNormal);
    }
}

export class Polygon extends BaseRigidBody {

    private vertices: Point[];
    private _momentOfInertia: number;

    constructor(center: Point = {x: 0, y: 0}, vertices: Point[], _orientationAngle: number = 0, mass: number = 50, isStatic: boolean = false, frictionEnabled: boolean = true) {
        super(center, _orientationAngle, mass, isStatic, frictionEnabled);
        this.vertices = vertices;
        this.step = this.step.bind(this);

        let numerator = this.vertices.reduce((acc, vertex, index) => {
            let nextPointIndex = index < this.vertices.length - 1 ? index + 1 : 0;
            let nextPoint = this.vertices[nextPointIndex];
            let crossProduct = PointCal.crossProduct(nextPoint, vertex);
            return acc + PointCal.magnitude(crossProduct) * (PointCal.dotProduct(vertex, vertex) + PointCal.dotProduct(vertex, nextPoint) + PointCal.dotProduct(nextPoint, nextPoint));
        }, 0);

        let denomiator = this.vertices.reduce((acc, vertex, index) => {
            return acc + PointCal.magnitude(PointCal.crossProduct(this.vertices[index < this.vertices.length - 1 ? index + 1 : 0], vertex));
        }, 0);

        
        this._momentOfInertia = this._mass * numerator / (6 * denomiator);
    }


    getVerticesAbsCoord(): Point[]{
        return this.vertices.map(vertex=>{
            return PointCal.addVector(this._center, PointCal.rotatePoint(vertex, this._orientationAngle));
        });
    }

    getCollisionAxes(relativeBody: RigidBody): Point[] {
        return this.getVerticesAbsCoord().map((vertex, index, absVertices)=>{
            let vector = PointCal.subVector(vertex, absVertices[absVertices.length - 1]);
            if (index > 0){
                vector = PointCal.subVector(vertex, absVertices[index - 1]); 
            }
            return PointCal.unitVector(PointCal.rotatePoint(vector, Math.PI / 2));
        });
    }

    getMinMaxProjection(unitvector: Point): { min: number; max: number; } {
        let vertices = this.getVerticesAbsCoord();
        
        let projections = vertices.map( vertex => {
            return PointCal.dotProduct(vertex, unitvector);
        });

        
        return {min: Math.min(...projections), max: Math.max(...projections)};
    }

    get AABB(): { min: Point; max: Point; } {
        let points = this.getVerticesAbsCoord();
        let xCoords = points.map(vertex => vertex.x);
        let yCoords = points.map(vertex => vertex.y);
        return {min: {x: Math.min(...xCoords), y: Math.min(...yCoords)}, max: {x: Math.max(...xCoords), y: Math.max(...yCoords)}};
    }

    significantVertex(collisionNormal: Point): Point {
        let vertices = this.getVerticesAbsCoord();
        let verticesProjected = vertices.map(vertex => PointCal.dotProduct(vertex, collisionNormal));
        let maxIndex = verticesProjected.indexOf(Math.max(...verticesProjected));
        return vertices[maxIndex];
    }

    getSignificantVertices(collisionNormal: Point): Point[]{
        let vertices = this.getVerticesAbsCoord();
        let verticesProjected = vertices.map(vertex => PointCal.dotProduct(vertex, collisionNormal));
        let maxIndex = verticesProjected.indexOf(Math.max(...verticesProjected));
        const tipVertex = vertices[maxIndex];
        let prevPointIndex = maxIndex > 0 ? maxIndex - 1 : vertices.length - 1;
        let nextPointIndex = maxIndex < vertices.length - 1 ? maxIndex + 1 : 0;
        const prevPoint = vertices[prevPointIndex];
        const nextPoint = vertices[nextPointIndex];
        const prevPointProjected = PointCal.dotProduct(prevPoint, collisionNormal);
        const nextPointProjected = PointCal.dotProduct(nextPoint, collisionNormal);
        if (prevPointProjected > nextPointProjected) {
            return [prevPoint, tipVertex];
        } else {
            return [tipVertex, nextPoint];
        }
    }

    getNormalOfSignificantFace(collisionNormal: Point): Point{
        const vertices = this.getSignificantVertices(collisionNormal);
        const direction = PointCal.unitVectorFromA2B(vertices[0], vertices[1]);
        return PointCal.rotatePoint(direction, -Math.PI / 2);
    }

    getAdjacentFaces(collisionNormal: Point): {startPoint: {coord: Point, index: number}, endPoint: {coord: Point, index: number}}[]{
        let vertices = this.getVerticesAbsCoord();
        let verticesProjected = vertices.map(vertex => PointCal.dotProduct(vertex, collisionNormal));
        let maxIndex = verticesProjected.indexOf(Math.max(...verticesProjected));
        const tipVertex = vertices[maxIndex];
        let prevPointIndex = maxIndex > 0 ? maxIndex - 1 : vertices.length - 1;
        let nextPointIndex = maxIndex < vertices.length - 1 ? maxIndex + 1 : 0;
        const prevPoint = vertices[prevPointIndex];
        const nextPoint = vertices[nextPointIndex];
        const prevPointProjected = PointCal.dotProduct(prevPoint, collisionNormal);
        const nextPointProjected = PointCal.dotProduct(nextPoint, collisionNormal);
        const adjacentFaces: Point[] = [];
        const adjacentFacesWithIndex: {startPoint: {coord: Point, index: number}, endPoint: {coord: Point, index: number}}[] = [];
        if (prevPointProjected > nextPointProjected) {
            adjacentFaces.push(prevPoint, tipVertex);
            adjacentFacesWithIndex.push({startPoint: {coord: prevPoint, index: prevPointIndex}, endPoint: {coord: tipVertex, index: maxIndex}});

            // the nextface is the next face
            adjacentFacesWithIndex.unshift({startPoint: {coord: tipVertex, index: maxIndex}, endPoint: {coord: nextPoint, index: nextPointIndex}});
            // need to get the previous face of the previous face
            let prevPrevPointIndex = prevPointIndex > 0 ? prevPointIndex - 1 : vertices.length - 1;
            adjacentFacesWithIndex.unshift({startPoint: {coord: vertices[prevPrevPointIndex], index: prevPrevPointIndex}, endPoint: {coord: prevPoint, index: prevPointIndex}});
        } else {
            adjacentFaces.push(tipVertex, nextPoint);
            adjacentFacesWithIndex.push({startPoint: {coord: tipVertex, index: maxIndex}, endPoint: {coord: nextPoint, index: nextPointIndex}});

            // need to get the next face of the next face
            let nextNextPointIndex = nextPointIndex < vertices.length - 1 ? nextPointIndex + 1 : 0;
            adjacentFacesWithIndex.unshift({startPoint: {coord: nextPoint, index: nextPointIndex}, endPoint: {coord: vertices[nextNextPointIndex], index: nextNextPointIndex}})

            // the prevoius face is the previous face
            adjacentFacesWithIndex.unshift({startPoint: {coord: prevPoint, index: prevPointIndex}, endPoint: {coord: tipVertex, index: maxIndex}});
        }
        
        return adjacentFacesWithIndex;
    }

    get momentOfInertia(): number {
        return this._momentOfInertia;
    }

}

export class Circle extends BaseRigidBody {

    private _radius: number;
    private _momentOfInertia: number;

    constructor(center: Point = {x: 0, y: 0}, radius: number, _orientationAngle: number = 0, mass: number = 50, isStatic: boolean = false, frictionEnabled: boolean = true) {
        super(center, _orientationAngle, mass, isStatic, frictionEnabled);
        this._radius = radius;
        this.step = this.step.bind(this);
        this._momentOfInertia = this._mass * this._radius * this._radius / 2;
    }

    getMinMaxProjection(unitvector: Point): { min: number; max: number; } {
        let PositiveFurthest = PointCal.addVector(this._center, PointCal.multiplyVectorByScalar(unitvector, this._radius));
        let NegativeFurthest = PointCal.addVector(this._center, PointCal.multiplyVectorByScalar(unitvector, -this._radius));
        return {min: PointCal.dotProduct(NegativeFurthest, unitvector), max: PointCal.dotProduct(PositiveFurthest, unitvector)};
    }

    getCollisionAxes(relativeBody: RigidBody): Point[] {
        return [PointCal.unitVector(PointCal.subVector(relativeBody.center, this._center))];
    }

    get AABB(): { min: Point; max: Point; } {
        return {min: PointCal.subVector(this._center, {x: this._radius, y: this._radius}), max: PointCal.addVector(this._center, {x: this._radius, y: this._radius})};
    }

    significantVertex(collisionNormal: Point): Point {
        return PointCal.addVector(this._center, PointCal.multiplyVectorByScalar(collisionNormal, this._radius));
    }

    get radius(): number {
        return this._radius;
    }

    getSignificantVertices(collisionNormal: Point): Point[]{
        return [PointCal.addVector(this._center, PointCal.multiplyVectorByScalar(collisionNormal, this._radius))];
    }

    getNormalOfSignificantFace(collisionNormal: Point): Point{
        return PointCal.unitVector(collisionNormal);
    }

    getAdjacentFaces(collisionNormal: Point): {startPoint: {coord: Point, index: number}, endPoint: {coord: Point, index: number}}[]{
        return [];
    }

    get momentOfInertia(): number {
        return this._momentOfInertia;
    }
}
