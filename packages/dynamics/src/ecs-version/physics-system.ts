import { Coordinator, Entity, System } from "@ue-too/ecs";
import { PHYSICS_COMPONENT, PhysicsComponent, RIGID_BODY_COMPONENT, RigidBodyComponent } from "./component";
import { PointCal } from "@ue-too/math";

export class PhysicsSystem implements System {
    entities: Set<Entity>;
    private coordinator: Coordinator;
    private _frictionEnabled: boolean;

    constructor(coordinator: Coordinator){
        this.entities = new Set<Entity>();
        this.coordinator = coordinator;
        const rigidBodyComponentType = this.coordinator.getComponentType(RIGID_BODY_COMPONENT);
        const physicsComponentType = this.coordinator.getComponentType(PHYSICS_COMPONENT);
        const signature = rigidBodyComponentType | physicsComponentType;
        this.coordinator.registerSystem("physicsSystem", this);
        this.coordinator.setSystemSignature("physicsSystem", signature);
    }

    get frictionEnabled(): boolean {
        return this._frictionEnabled;
    }

    update(deltaTime: number): void {

        for(const entity of this.entities){
            const rigidBodyComponent = this.coordinator.getComponentFromEntity<RigidBodyComponent>(RIGID_BODY_COMPONENT, entity);
            const physicsComponent = this.coordinator.getComponentFromEntity<PhysicsComponent>(PHYSICS_COMPONENT, entity);

            if (this._frictionEnabled) {
                if (rigidBodyComponent.isStatic  || 
                    (physicsComponent.linearVelocity.x == 0 && 
                    physicsComponent.linearVelocity.y == 0 && 
                    PointCal.magnitude(PointCal.subVector({x: physicsComponent.force.x, y: physicsComponent.force.y}, {x: 0, y: 0})) >= 0 && 
                    PointCal.magnitude({x: physicsComponent.force.x, y: physicsComponent.force.y}) < rigidBodyComponent.staticFrictionCoeff * rigidBodyComponent.mass * 9.81)
                    ) {
                    if (physicsComponent.force.z != undefined) {
                        physicsComponent.force = {x: 0, y: 0, z: physicsComponent.force.z};
                    } else {
                        physicsComponent.force = {x: 0, y: 0};
                    }
                    // return;
                } else {
                    let kineticFrictionDirection = PointCal.multiplyVectorByScalar(PointCal.unitVector({x: physicsComponent.linearVelocity.x, y: physicsComponent.linearVelocity.y}), -1);
                    let kineticFriction = PointCal.multiplyVectorByScalar(kineticFrictionDirection, rigidBodyComponent.dynamicFrictionCoeff * rigidBodyComponent.mass * 9.81);
                    physicsComponent.force = PointCal.addVector(physicsComponent.force, kineticFriction);
                }
            }
            const angularDamping = physicsComponent.angularVelocity != 0 ? physicsComponent.angularVelocity > 0 ? -physicsComponent.angularDampingFactor : physicsComponent.angularDampingFactor : 0;
            // console.log("angular velocity", this._angularVelocity);
            // console.log("angular damping", angularDamping);
            if (Math.abs(physicsComponent.angularVelocity) < Math.abs(angularDamping)) {
                physicsComponent.angularVelocity = 0;
            } else {
                physicsComponent.angularVelocity += angularDamping;
            }
            rigidBodyComponent.orientationAngle += physicsComponent.angularVelocity * deltaTime;
            if (PointCal.magnitude({x: physicsComponent.linearVelocity.x, y: physicsComponent.linearVelocity.y}) < PointCal.magnitude(PointCal.divideVectorByScalar(PointCal.multiplyVectorByScalar(physicsComponent.force, deltaTime), rigidBodyComponent.mass))){
                if (physicsComponent.linearVelocity.z != undefined) {
                    physicsComponent.linearVelocity = {x: 0, y: 0, z: physicsComponent.linearVelocity.z};
                } else {
                    physicsComponent.linearVelocity = {x: 0, y: 0};
                }
            }
            const gravitationalForce = -9.81 * rigidBodyComponent.mass;
            physicsComponent.force = PointCal.addVector(physicsComponent.force, {x: 0, y: 0, z: gravitationalForce});
            physicsComponent.linearVelocity = PointCal.addVector(physicsComponent.linearVelocity, PointCal.divideVectorByScalar(PointCal.multiplyVectorByScalar(physicsComponent.force, deltaTime), rigidBodyComponent.mass));
            rigidBodyComponent.center = PointCal.addVector(rigidBodyComponent.center, PointCal.multiplyVectorByScalar(physicsComponent.linearVelocity, deltaTime));
            if (rigidBodyComponent.center.z != undefined && rigidBodyComponent.center.z < 0) {
                rigidBodyComponent.center.z = 0;
            }
            physicsComponent.force = {x: 0, y: 0};
            // TODO update aabb of rigid body component
        }
    }
}
