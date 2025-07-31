import { Coordinator, Entity, System } from "@ue-too/ecs";
import { PHYSICS_COMPONENT, PhysicsComponent, RIGID_BODY_COMPONENT, RigidBodyComponent } from "./component";
import { QuadTree, RectangleBound } from "../quadtree";
import { aabbIntersects } from "../collision";
import { Point, PointCal } from "@ue-too/math";

export class CollisionSystem implements System {

    private coordinator: Coordinator;
    private quadTree: QuadTree<RigidBodyComponent & {entity: Entity}>;

    entities: Set<Entity>;

    constructor(coordinator: Coordinator){
        this.entities = new Set<Entity>();
        this.coordinator = coordinator;
        const rigidBodyComponentType = this.coordinator.getComponentType(RIGID_BODY_COMPONENT);
        const physicsComponentType = this.coordinator.getComponentType(PHYSICS_COMPONENT);
        const signature = rigidBodyComponentType | physicsComponentType;
        this.coordinator.registerSystem("collisionSystem", this);
        this.coordinator.setSystemSignature("collisionSystem", signature);
        this.quadTree = new QuadTree<RigidBodyComponent & {entity: Entity}>(0, new RectangleBound({x: 0, y: 0}, 10000, 10000));
    }

    constructQuadTree(){
        this.quadTree.clear();
        const entities = Array.from(this.entities);
        for(let i = 0; i < entities.length; i++){
            const entity = entities[i];
            const rigidBody = this.coordinator.getComponentFromEntity<RigidBodyComponent>(RIGID_BODY_COMPONENT, entity);
            this.quadTree.insert({...rigidBody, entity: entity});
        }
    }

    broadPhase(): {entityA: Entity, entityB: Entity}[] {
        const possibleCombinations: {entityA: Entity, entityB: Entity}[] = [];
        const entities = Array.from(this.entities);
        for(let i = 0; i < entities.length; i++){
            const entity1 = entities[i];
            const rigidBody1 = this.coordinator.getComponentFromEntity<RigidBodyComponent>(RIGID_BODY_COMPONENT, entity1);
            const objsToCheck = this.quadTree.retrieve({...rigidBody1, entity: entity1});
            for(let j = 0; j < objsToCheck.length; j++){
                const entity2 = objsToCheck[j].entity;
                const rigidBody2 = this.coordinator.getComponentFromEntity<RigidBodyComponent>(RIGID_BODY_COMPONENT, entity2);
                const AABB1 = rigidBody1.AABB;
                const AABB2 = rigidBody2.AABB;
                if(rigidBody1.isStatic && rigidBody2.isStatic){
                    continue;
                }
                if(!aabbIntersects(AABB1, AABB2)){
                    continue;
                }

                possibleCombinations.push({entityA: entity1, entityB: entity2});
            }
        }
        return possibleCombinations;
    }

    narrowPhase(possibleCombinations: {entityA: Entity, entityB: Entity}[]): void {
        const contactPoints: Point[] = [];
        for(let i = 0; i < possibleCombinations.length; i++){
            const {entityA, entityB} = possibleCombinations[i];
            if(entityA === entityB){
                continue;
            }
            const rigidBodyA = this.coordinator.getComponentFromEntity<RigidBodyComponent>(RIGID_BODY_COMPONENT, entityA);
            const rigidBodyB = this.coordinator.getComponentFromEntity<RigidBodyComponent>(RIGID_BODY_COMPONENT, entityB);
            const physicsA = this.coordinator.getComponentFromEntity<PhysicsComponent>(PHYSICS_COMPONENT, entityA);
            const physicsB = this.coordinator.getComponentFromEntity<PhysicsComponent>(PHYSICS_COMPONENT, entityB);

            let bodyAZ = rigidBodyA.center.z == undefined ? 0 : rigidBodyA.center.z;
            let bodyBZ = rigidBodyB.center.z == undefined ? 0 : rigidBodyB.center.z;
            if(Math.abs(bodyAZ - bodyBZ) > 0.5){
                continue;
            }

            let {collision, depth, normal: normalAxis} = intersects(rigidBodyA, rigidBodyB);
            if (collision && normalAxis !== undefined && depth !== undefined) {
                // the normal axis points in the direction that push bodyA away from bodyB
                
                let moveDisplacement = PointCal.multiplyVectorByScalar(normalAxis, depth / 2);
                let revMoveDisplacement = PointCal.multiplyVectorByScalar(normalAxis, -depth / 2);

                if (!rigidBodyA.isStatic) {
                    physicsA.linearVelocity = PointCal.addVector(physicsA.linearVelocity, moveDisplacement);
                }
                if (!rigidBodyB.isStatic) {
                    physicsB.linearVelocity = PointCal.addVector(physicsB.linearVelocity, revMoveDisplacement);
                }
                if (rigidBodyA.isStatic) {
                    // bodyA.move(revMoveDisplacement);
                    physicsB.linearVelocity = PointCal.addVector(physicsB.linearVelocity, revMoveDisplacement);
                }
                if (rigidBodyB.isStatic) {
                    physicsA.linearVelocity = PointCal.addVector(physicsA.linearVelocity, moveDisplacement);
                }

                // finding the collision contact point(s)
                const bodyASigNormal = getNormalOfSignificantFace(rigidBodyA, PointCal.multiplyVectorByScalar(normalAxis, -1));
                const bodyBSigNormal = getNormalOfSignificantFace(rigidBodyB, normalAxis);
                const bodyASigVertices = getSignificantVertices(rigidBodyA, PointCal.multiplyVectorByScalar(normalAxis, -1));
                const bodyBSigVertices = getSignificantVertices(rigidBodyB, normalAxis);
                const bodyAParallelIndicator = Math.abs(PointCal.dotProduct(bodyASigNormal, PointCal.multiplyVectorByScalar(normalAxis, -1)));
                const bodyBParallelIndicator = Math.abs(PointCal.dotProduct(bodyBSigNormal, normalAxis));
                
                if (bodyBSigVertices.length == 1 || bodyASigVertices.length == 1){
                    // one of the body is a circle
                    // console.log("involving a circle");
                    if (bodyBSigVertices.length == 1){
                        // bodyB is a circle
                        // contact point is on the perimeter of the circle and the direction is the collision normal
                        contactPoints.push(bodyBSigVertices[0]);
                    } else {
                        // bodyA is a circle
                        // contact point is on the perimeter of the circle and the direction is the collision normal
                        contactPoints.push(bodyASigVertices[0]);
                    }
                }
                else if (bodyAParallelIndicator > bodyBParallelIndicator) {
                    // bodyA has the normal that is the most parallel to the collision normal
                    const adjacentFaces = getAdjacentFaces(rigidBodyA, PointCal.multiplyVectorByScalar(normalAxis, -1));
                    let faceToClip = [...bodyBSigVertices];
                    for(let index = 0; index < adjacentFaces.length - 1; index++){
                        let startPoint = adjacentFaces[index].startPoint.coord;
                        let endPoint = adjacentFaces[index].endPoint.coord;
                        let direction = PointCal.subVector(endPoint, startPoint);
                        let sigStart = PointCal.subVector(faceToClip[0], startPoint);
                        let sigEnd = PointCal.subVector(faceToClip[1], startPoint);
                        let startInside = PointCal.angleFromA2B(direction, sigStart) >= 0;
                        let endInside = PointCal.angleFromA2B(direction, sigEnd) >= 0;
                        if ((startInside ? 1 : 0) ^ (endInside ? 1 : 0)){
                            // one of the point is outside the face
                            let intersectionPoint = PointCal.getLineIntersection(startPoint, endPoint, faceToClip[0], faceToClip[1]);
                            if (intersectionPoint.intersects && intersectionPoint.intersection !== undefined){
                                if(startInside){
                                    faceToClip[1] = intersectionPoint.intersection;
                                } else {
                                    faceToClip[0] = intersectionPoint.intersection;
                                }
                            }
                        }
                    }
                    const referenceFace = adjacentFaces[adjacentFaces.length - 1];
                    let startPoint = referenceFace.startPoint.coord;
                    let endPoint = referenceFace.endPoint.coord;
                    let direction = PointCal.subVector(endPoint, startPoint);
                    let sigStart = PointCal.subVector(faceToClip[0], startPoint);
                    let sigEnd = PointCal.subVector(faceToClip[1], startPoint);
                    let startInside = PointCal.angleFromA2B(direction, sigStart) >= 0;
                    let endInside = PointCal.angleFromA2B(direction, sigEnd) >= 0;
                    if (startInside){
                        contactPoints.push(faceToClip[0]);
                    }
                    if (endInside){
                        contactPoints.push(faceToClip[1]);
                    }
                } else {
                    // bodyB has the normal that is the most parallel to the collision normal
                    const adjacentFaces = getAdjacentFaces(rigidBodyB, normalAxis);
                    let faceToClip = [...bodyASigVertices];
                    if(faceToClip.length == 0){
                        console.log("warning");
                    }
                    let count = 0;
                    for(let index = 0; index < adjacentFaces.length - 1; index++){
                        let startPoint = adjacentFaces[index].startPoint.coord;
                        let endPoint = adjacentFaces[index].endPoint.coord;
                        let direction = PointCal.subVector(endPoint, startPoint);
                        let sigStart = PointCal.subVector(faceToClip[0], startPoint);
                        let sigEnd = PointCal.subVector(faceToClip[1], startPoint);
                        let startInside = PointCal.angleFromA2B(direction, sigStart) >= 0;
                        let endInside = PointCal.angleFromA2B(direction, sigEnd) >= 0;
                        if ((startInside ? 1 : 0) ^ (endInside ? 1 : 0)){
                            count += 1;
                            // one of the point is outside the face
                            let intersectionPoint = PointCal.getLineIntersection(startPoint, endPoint, faceToClip[0], faceToClip[1]);
                            if (intersectionPoint.intersects && intersectionPoint.intersection !== undefined){
                                if(startInside){
                                    faceToClip[1] = intersectionPoint.intersection;
                                } else {
                                    faceToClip[0] = intersectionPoint.intersection;
                                }
                            }
                        }
                    }
                    const referenceFace = adjacentFaces[adjacentFaces.length - 1];
                    let startPoint = referenceFace.startPoint.coord;
                    let endPoint = referenceFace.endPoint.coord;
                    let direction = PointCal.subVector(endPoint, startPoint);
                    let sigStart = PointCal.subVector(faceToClip[0], startPoint);
                    let sigEnd = PointCal.subVector(faceToClip[1], startPoint);
                    let startInside = PointCal.angleFromA2B(direction, sigStart) >= 0;
                    let endInside = PointCal.angleFromA2B(direction, sigEnd) >= 0;
                    if (startInside){
                        contactPoints.push(faceToClip[0]);
                    }
                    if (endInside){
                        contactPoints.push(faceToClip[1]);
                    }
                }

                resolveCollisionWithRotation(rigidBodyA, rigidBodyB, physicsA, physicsB, {normal: normalAxis, contactPoints: contactPoints});
            }
        }
    }

    update(deltaTime: number): void {
        const possibleCombinations = this.broadPhase();
        this.narrowPhase(possibleCombinations);
    }
}

function getCollisionAxesForCircle(subjectBody: RigidBodyComponent, relativeBody: RigidBodyComponent): Point[]{
    return [PointCal.unitVector(PointCal.subVector(relativeBody.center, subjectBody.center))];
}

function getVerticesAbsCoord(body: RigidBodyComponent): Point[]{
    if(body.shapeType === "circle"){
        return [];
    } else {
        return body.vertices.map(vertex=>{
            return PointCal.addVector(body.center, PointCal.rotatePoint(vertex, body.orientationAngle));
        });
    }
}

function getCollisionAxesForPolygon(subjectBody: RigidBodyComponent, relativeBody: RigidBodyComponent): Point[]{
    return getVerticesAbsCoord(subjectBody).map((vertex, index, absVertices)=>{
        let vector = PointCal.subVector(vertex, absVertices[absVertices.length - 1]);
        if (index > 0){
            vector = PointCal.subVector(vertex, absVertices[index - 1]); 
        }
        return PointCal.unitVector(PointCal.rotatePoint(vector, Math.PI / 2));
    });
}

function getMinMaxProjectionForPolygon(body: RigidBodyComponent, unitvector: Point): { min: number; max: number; } {
    if(body.shapeType !== "polygon"){
        console.error("Invalid shape type");
        return {min: 0, max: 0};
    }
    let vertices = getVerticesAbsCoord(body);
    
    let projections = vertices.map( vertex => {
        return PointCal.dotProduct(vertex, unitvector);
    });
    
    return {min: Math.min(...projections), max: Math.max(...projections)};
}

function getMinMaxProjectionForCircle(body: RigidBodyComponent, unitvector: Point): { min: number; max: number; } {
    if(body.shapeType !== "circle"){
        console.error("Invalid shape type");
        return {min: 0, max: 0};
    }
    let PositiveFurthest = PointCal.addVector(body.center, PointCal.multiplyVectorByScalar(unitvector, body.radius));
    let NegativeFurthest = PointCal.addVector(body.center, PointCal.multiplyVectorByScalar(unitvector, -body.radius));
    return {min: PointCal.dotProduct(NegativeFurthest, unitvector), max: PointCal.dotProduct(PositiveFurthest, unitvector)};
}

function getMinMaxProjection(body: RigidBodyComponent, unitvector: Point): { min: number; max: number; } {
    switch(body.shapeType){
        case "circle":
            return getMinMaxProjectionForCircle(body, unitvector);
        case "polygon":
            return getMinMaxProjectionForPolygon(body, unitvector);
        default:
            console.error("Invalid shape type");
            return {min: 0, max: 0};
    }
}



function getCollisionAxes(body: RigidBodyComponent, relativeBody: RigidBodyComponent): Point[]{
    switch(body.shapeType){
        case "circle":
            return getCollisionAxesForCircle(body, relativeBody);
        case "polygon":
            return getCollisionAxesForPolygon(body, relativeBody);
        default:
            console.error("Invalid shape type");
            return [];
    }
}

function intersects(bodyA: RigidBodyComponent, bodyB: RigidBodyComponent): {collision: boolean, depth?: number, normal?: Point}{
    let axis: Point[] = [];
    let bodyAAxes = getCollisionAxes(bodyA, bodyB);
    let bodyBAxes = getCollisionAxes(bodyB, bodyA);

    axis.push(...bodyAAxes);
    axis.push(...bodyBAxes);

    let collision = true;
    let minDepth = Number.MAX_VALUE;
    let minAxis = axis[0];

    axis.forEach(projAxis => {
        let bodyAInterval = getMinMaxProjection(bodyA, projAxis);
        let bodyBInterval = getMinMaxProjection(bodyB, projAxis);

        if (bodyAInterval.min >= bodyBInterval.max || bodyBInterval.min >= bodyAInterval.max) {
            collision = false;
        }else {
            let depth = Math.abs(Math.min(bodyAInterval.max, bodyBInterval.max) - Math.max(bodyBInterval.min, bodyAInterval.min));
            if (depth < minDepth) {
                minDepth = depth;
                minAxis = projAxis;
                if (bodyAInterval.max < bodyBInterval.max) {
                    minAxis = PointCal.multiplyVectorByScalar(minAxis, -1);
                }
            }
        }
    });

    if (collision){
        return {collision: collision, depth: minDepth, normal: minAxis};
    }else {
        return {collision: false, depth: undefined, normal: undefined};
    }
}

function getNormalOfSignificantFaceForCircle(collisionNormal: Point): Point{
    return PointCal.unitVector(collisionNormal);
}

function getNormalOfSignificantFaceForPolygon(body: RigidBodyComponent, collisionNormal: Point): Point{
    const vertices = getSignificantVertices(body, collisionNormal);
    const direction = PointCal.unitVectorFromA2B(vertices[0], vertices[1]);
    return PointCal.rotatePoint(direction, -Math.PI / 2);
}

function getNormalOfSignificantFace(body: RigidBodyComponent, collisionNormal: Point): Point{
    switch(body.shapeType){
        case "circle":
            return getNormalOfSignificantFaceForCircle(collisionNormal);
        case "polygon":
            return getNormalOfSignificantFaceForPolygon(body, collisionNormal);
        default:
            console.error("Invalid shape type");
            return {x: 0, y: 0};
    }
}

function getSignificantVerticesForPolygon(body: RigidBodyComponent, collisionNormal: Point): Point[] {
    if(body.shapeType !== "polygon"){
        console.error("Invalid shape type");
        return [];
    }
    let vertices = getVerticesAbsCoord(body);
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

function getSignificantVerticesForCircle(body: RigidBodyComponent, collisionNormal: Point): Point[] {
    if(body.shapeType !== "circle"){
        console.error("Invalid shape type");
        return [];
    }
    return [PointCal.addVector(body.center, PointCal.multiplyVectorByScalar(collisionNormal, body.radius))];
}

function getSignificantVertices(body: RigidBodyComponent, collisionNormal: Point): Point[]{
    switch(body.shapeType){
        case "circle":
            return getSignificantVerticesForCircle(body, collisionNormal);
        case "polygon":
            return getSignificantVerticesForPolygon(body, collisionNormal);
        default:
            console.error("Invalid shape type");
            return [];
    }
}

function getAdjacentFacesForPolygon(body: RigidBodyComponent, collisionNormal: Point): {startPoint: {coord: Point, index: number}, endPoint: {coord: Point, index: number}}[]{
    if(body.shapeType !== "polygon"){
        console.error("Invalid shape type");
        return [];
    }
    let vertices = getVerticesAbsCoord(body);
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

function getAdjacentFacesForCircle(body: RigidBodyComponent, collisionNormal: Point): {startPoint: {coord: Point, index: number}, endPoint: {coord: Point, index: number}}[]{
    return [];
}

function getAdjacentFaces(body: RigidBodyComponent, collisionNormal: Point): {startPoint: {coord: Point, index: number}, endPoint: {coord: Point, index: number}}[]{
    switch(body.shapeType){
        case "circle":
            return getAdjacentFacesForCircle(body, collisionNormal);
        case "polygon":
            return getAdjacentFacesForPolygon(body, collisionNormal);
        default:
            console.error("Invalid shape type");
            return [];
    }
}

function resolveCollisionWithRotation(bodyA: RigidBodyComponent, bodyB: RigidBodyComponent, physicsA: PhysicsComponent, physicsB: PhysicsComponent, contactManifold: {normal: Point, contactPoints: Point[]}){
    if (bodyA.isStatic && bodyB.isStatic) {
        return;
    }
    
    let restitution = 0.4;
    let inverseMassA = bodyA.isStatic || bodyA.isMovingStatic ? 0 : 1 / bodyA.mass;
    let inverseMassB = bodyB.isStatic || bodyB.isMovingStatic ? 0 : 1 / bodyB.mass;

    let inverseMMOIA = bodyA.isStatic || bodyA.isMovingStatic ? 0 : 1 / bodyA.momentOfInertia;
    let inverseMMOIB = bodyB.isStatic || bodyB.isMovingStatic ? 0 : 1 / bodyB.momentOfInertia;

    const Js: Point[] = [];
    for(let index = 0; index < contactManifold.contactPoints.length; index++){
        const contactPoint = contactManifold.contactPoints[index];
        const rA = PointCal.subVector(contactPoint, bodyA.center);
        const rB = PointCal.subVector(contactPoint, bodyB.center);
        const rAPerpendicular = {x: -rA.y, y: rA.x};
        const rBPerpendicular = {x: -rB.y, y: rB.x}; 

        const angularVelocityA = PointCal.multiplyVectorByScalar(rAPerpendicular, physicsA.angularVelocity);
        const angularVelocityB = PointCal.multiplyVectorByScalar(rBPerpendicular, physicsB.angularVelocity);

        // console.log("inverse mass a", inverseMassA);
        // console.log("inverse mass b", inverseMassB);

        let relativeVelocity = PointCal.subVector(PointCal.addVector(physicsA.linearVelocity, angularVelocityA), PointCal.addVector(physicsA.linearVelocity, angularVelocityB));
        // console.log("relative velocity: ", relativeVelocity);
        // console.log("linear velocity of a", bodyA.getLinearVelocity());
        // console.log("linear veolcity of b", bodyB.getLinearVelocity());
        let relativeVelocityNormal = PointCal.dotProduct(relativeVelocity, contactManifold.normal);
        const rAPerpendicularNormal = PointCal.dotProduct(rAPerpendicular, contactManifold.normal);
        const rBPerpendicularNormal = PointCal.dotProduct(rBPerpendicular, contactManifold.normal);
        
        const denominator = inverseMassA + inverseMassB + rAPerpendicularNormal * rAPerpendicularNormal * inverseMMOIA + rBPerpendicularNormal * rBPerpendicularNormal * inverseMMOIB;
        let J = -(1 + restitution) * relativeVelocityNormal;
        J /= denominator;

        J /= contactManifold.contactPoints.length;

        Js.push(PointCal.multiplyVectorByScalar(contactManifold.normal, J));
    }

    Js.forEach((impulse, index) => {
        let deltaVelocityA = PointCal.multiplyVectorByScalar(impulse, inverseMassA);
        let deltaVelocityB = PointCal.multiplyVectorByScalar(impulse, inverseMassB);

        physicsA.linearVelocity = PointCal.addVector(physicsA.linearVelocity, deltaVelocityA);
        let resA = PointCal.crossProduct(PointCal.subVector(contactManifold.contactPoints[index], bodyA.center), impulse).z;
        resA = resA == undefined ? 0 : resA;
        let resB = PointCal.crossProduct(PointCal.subVector(contactManifold.contactPoints[index], bodyB.center), impulse).z;
        resB = resB == undefined ? 0 : resB;
        physicsA.angularVelocity += resA * inverseMMOIA;
        physicsB.angularVelocity -= resB * inverseMMOIB;
        physicsB.linearVelocity = PointCal.subVector(physicsB.linearVelocity, deltaVelocityB);
    });
}
