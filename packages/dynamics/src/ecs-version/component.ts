import { Point } from "@ue-too/math";

export const RIGID_BODY_COMPONENT = "RigidBodyComponent";
export const PHYSICS_COMPONENT = "PhysicsComponent";
export const RENDER_COMPONENT = "RenderComponent";
export const INPUT_COMPONENT = "InputComponent";

export type RigidBodyComponent = {
    center: Point;
    orientationAngle: number;
    AABB: {min: Point, max: Point};
    mass: number;
    staticFrictionCoeff: number;
    dynamicFrictionCoeff: number;
    momentOfInertia: number;
    isStatic: boolean;
    isMovingStatic: boolean;
} & ({
    shapeType: "circle";
    radius: number;
} | {
    shapeType: "polygon";
    vertices: Point[];
});

export type PhysicsComponent = {
    force: Point;
    angularDampingFactor: number;
    linearAcceleration: Point;
    angularAcceleration: number;
    linearVelocity: Point;
    angularVelocity: number;
}

export type RenderComponent = {
    show: boolean;
}

export type Direction = "idle" | "up" | "down" | "left" | "right";

export type InputComponent = {
    direction: Direction;
}
