import { Coordinator, Entity, System } from "@ue-too/ecs";
import { PHYSICS_COMPONENT, PhysicsComponent, RIGID_BODY_COMPONENT, RigidBodyComponent } from "./component";
import { PointCal } from "@ue-too/math";
import { updateAABB } from "./collision-system";

export class PhysicsSystem implements System {
    entities: Set<Entity>;
    private coordinator: Coordinator;
    private _frictionEnabled: boolean;

    constructor(coordinator: Coordinator){
        this.entities = new Set<Entity>();
        this.coordinator = coordinator;
        let rigidBodyComponentType = this.coordinator.getComponentType(RIGID_BODY_COMPONENT);
        let physicsComponentType = this.coordinator.getComponentType(PHYSICS_COMPONENT);
        if(rigidBodyComponentType === undefined){
            console.info('RigidBodyComponent not registered; registering it now');
            this.coordinator.registerComponent(RIGID_BODY_COMPONENT);
            rigidBodyComponentType = this.coordinator.getComponentType(RIGID_BODY_COMPONENT);
        }
        if(physicsComponentType === undefined){
            console.info('PhysicsComponent not registered; registering it now');
            this.coordinator.registerComponent(PHYSICS_COMPONENT);
            physicsComponentType = this.coordinator.getComponentType(PHYSICS_COMPONENT);
        }
        const signature = 1 << rigidBodyComponentType | 1 << physicsComponentType;
        this.coordinator.registerSystem("physicsSystem", this);
        this.coordinator.setSystemSignature("physicsSystem", signature);
        this._frictionEnabled = true;
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
            
            // Apply gravity and forces first
            const gravitationalForce = -9.81 * rigidBodyComponent.mass;
            physicsComponent.force = PointCal.addVector(physicsComponent.force, {x: 0, y: 0, z: gravitationalForce});
            const deltaLinearVelocity = PointCal.divideVectorByScalar(PointCal.multiplyVectorByScalar(physicsComponent.force, deltaTime), rigidBodyComponent.mass);
            physicsComponent.linearVelocity = PointCal.addVector(physicsComponent.linearVelocity, deltaLinearVelocity);
            
            // Update position
            const deltaCenter = PointCal.multiplyVectorByScalar(physicsComponent.linearVelocity, deltaTime);
            rigidBodyComponent.center = PointCal.addVector(rigidBodyComponent.center, deltaCenter);
            
            // Ground collision - only reset z velocity when hitting ground
            if (rigidBodyComponent.center.z != undefined && rigidBodyComponent.center.z < 0) {
                rigidBodyComponent.center.z = 0;
                if (physicsComponent.linearVelocity.z != undefined) {
                    physicsComponent.linearVelocity.z = 0;
                }
            }
            
            // Reset force
            physicsComponent.force = {x: 0, y: 0};
            rigidBodyComponent.AABB = updateAABB(rigidBodyComponent);
        }
    }
}
