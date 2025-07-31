import { Coordinator, Entity, System } from "@ue-too/ecs";
import { PHYSICS_COMPONENT, PhysicsComponent, RENDER_COMPONENT, RIGID_BODY_COMPONENT, RenderComponent, RigidBodyComponent } from "./component";
import type { Point } from "@ue-too/math";
import { getVerticesAbsCoordRaw } from "./collision-system";

export class Canvas2DContextRenderSystem implements System {
    entities: Set<Entity>;
    private coordinator: Coordinator;
    private context: CanvasRenderingContext2D;

    constructor(coordinator: Coordinator, context: CanvasRenderingContext2D){
        this.context = context;
        this.coordinator = coordinator;
        this.entities = new Set<Entity>();
        this.coordinator.registerSystem("renderSystem", this);
        let renderComponentType = this.coordinator.getComponentType(RENDER_COMPONENT);
        let rigidBodyComponentType = this.coordinator.getComponentType(RIGID_BODY_COMPONENT);
        if(renderComponentType === undefined){
            console.info('RenderComponent not registered; registering it now');
            this.coordinator.registerComponent(RENDER_COMPONENT);
            renderComponentType = this.coordinator.getComponentType(RENDER_COMPONENT);
        }
        if(rigidBodyComponentType === undefined){
            console.info('RigidBodyComponent not registered; registering it now');
            this.coordinator.registerComponent(RIGID_BODY_COMPONENT);
            rigidBodyComponentType = this.coordinator.getComponentType(RIGID_BODY_COMPONENT);
        }
        this.coordinator.setSystemSignature("renderSystem", 1 << renderComponentType | 1 << rigidBodyComponentType);
    }

    update(deltaTime: number): void {
        for(const entity of this.entities){
            const renderComponent = this.coordinator.getComponentFromEntity<RenderComponent>(RENDER_COMPONENT, entity);
            if(renderComponent.show){
                const rigidBodyComponent = this.coordinator.getComponentFromEntity<RigidBodyComponent>(RIGID_BODY_COMPONENT, entity);
                const physicsComponent = this.coordinator.getComponentFromEntity<PhysicsComponent>(PHYSICS_COMPONENT, entity);
                switch(rigidBodyComponent.shapeType){
                    case "circle":
                        drawCircle(this.context, rigidBodyComponent.center, rigidBodyComponent.radius, rigidBodyComponent.orientationAngle);
                        break;
                    case "polygon":
                        drawPolygonWithRelativeVertices(this.context, rigidBodyComponent.vertices, rigidBodyComponent.center, rigidBodyComponent.orientationAngle);
                        break;
                }
            }
        }
    }
}

function drawCircle(context: CanvasRenderingContext2D, center: Point, radius: number, orientationAngle: number){
    context.save();
    context.strokeStyle = "red";
    context.beginPath();
    context.arc(center.x, center.y, radius, 0, 2 * Math.PI);
    context.fill();
    context.restore();
}

function drawPolygonWithRelativeVertices(context: CanvasRenderingContext2D, vertices: Point[], center: Point, orientationAngle: number){
    const verticesAbsCoord = getVerticesAbsCoordRaw(vertices, center, orientationAngle);
    drawPolygonWithAbsoluteVertices(context, verticesAbsCoord, orientationAngle);
}

function drawPolygonWithAbsoluteVertices(context: CanvasRenderingContext2D, vertices: Point[], orientationAngle: number){
    context.save();
    context.strokeStyle = "red";
    context.beginPath();
    context.moveTo(vertices[0].x, vertices[0].y);
    for(let i = 1; i < vertices.length; i++){
        context.lineTo(vertices[i].x, vertices[i].y);
    }
    context.closePath();
    context.stroke();
    context.restore();
}