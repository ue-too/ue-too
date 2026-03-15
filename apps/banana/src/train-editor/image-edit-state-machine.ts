import { BaseContext, EventGuards, EventReactions, Guard, NO_OP, StateMachine, TemplateState, TemplateStateMachine } from "@ue-too/being";
import { Point } from "@ue-too/math";
import type { ImageEditorEngine } from "./image-editor-engine";

export type ImageEditStates = 'INACTIVE' | 'IDLE' | 'DRAGGING' | 'RESIZING';

export type ImageEditEvents = {
    'startImageEdit': {};
    'endImageEdit': {};
    'leftPointerDown': Point;
    'leftPointerUp': Point;
    'leftPointerMove': Point;
    'pointerMove': Point;
}

export type ImageEditContext = BaseContext & {
    imageEngine: ImageEditorEngine;
}

export type ImageEditStateMachine = StateMachine<ImageEditEvents, ImageEditContext, ImageEditStates>;

class ImageInactiveState extends TemplateState<ImageEditEvents, ImageEditContext, ImageEditStates> {
    protected _eventReactions = {
        startImageEdit: {
            action: NO_OP,
            defaultTargetState: 'IDLE' as const,
        },
    } as EventReactions<ImageEditEvents, ImageEditContext, ImageEditStates>;
}

class ImageIdleState extends TemplateState<ImageEditEvents, ImageEditContext, ImageEditStates> {
    constructor() {
        super();
    }

    protected _eventReactions = {
        leftPointerDown: {
            action: this.leftPointerDown.bind(this),
        },
        endImageEdit: {
            action: NO_OP,
            defaultTargetState: 'INACTIVE' as const,
        },
    } as EventReactions<ImageEditEvents, ImageEditContext, ImageEditStates>;

    protected _guards: Guard<ImageEditContext, 'hitHandle' | 'hitImage'> = {
        hitHandle: ((context: ImageEditContext) => {
            return context.imageEngine.projectOnHandle(
                context.imageEngine.convert2WorldPosition(this._lastPointerPos)
            ) !== null;
        }).bind(this),
        hitImage: ((context: ImageEditContext) => {
            return context.imageEngine.projectOnImage(
                context.imageEngine.convert2WorldPosition(this._lastPointerPos)
            );
        }).bind(this),
    };

    protected _eventGuards: Partial<
        EventGuards<
            ImageEditEvents,
            ImageEditStates,
            ImageEditContext,
            typeof this._guards
        >
    > = {
            leftPointerDown: [
                {
                    guard: 'hitHandle',
                    target: 'RESIZING',
                },
                {
                    guard: 'hitImage',
                    target: 'DRAGGING',
                },
            ],
        };

    private _lastPointerPos: Point = { x: 0, y: 0 };

    leftPointerDown(context: ImageEditContext, payload: Point): void {
        this._lastPointerPos = payload;
        const worldPos = context.imageEngine.convert2WorldPosition(payload);
        const handle = context.imageEngine.projectOnHandle(worldPos);
        if (handle) {
            context.imageEngine.startResize(handle, worldPos);
        } else {
            context.imageEngine.startDrag(worldPos);
        }
    }
}

class ImageDraggingState extends TemplateState<ImageEditEvents, ImageEditContext, ImageEditStates> {
    protected _eventReactions = {
        leftPointerMove: {
            action: this.onPointerMove.bind(this),
        },
        pointerMove: {
            action: this.onPointerMove.bind(this),
        },
        leftPointerUp: {
            action: this.leftPointerUp.bind(this),
            defaultTargetState: 'IDLE' as const,
        },
    } as EventReactions<ImageEditEvents, ImageEditContext, ImageEditStates>;

    onPointerMove(context: ImageEditContext, payload: Point): void {
        const worldPos = context.imageEngine.convert2WorldPosition(payload);
        context.imageEngine.updateDrag(worldPos);
    }

    leftPointerUp(context: ImageEditContext): void {
        context.imageEngine.endInteraction();
    }
}

class ImageResizingState extends TemplateState<ImageEditEvents, ImageEditContext, ImageEditStates> {
    protected _eventReactions = {
        leftPointerMove: {
            action: this.onPointerMove.bind(this),
        },
        pointerMove: {
            action: this.onPointerMove.bind(this),
        },
        leftPointerUp: {
            action: this.leftPointerUp.bind(this),
            defaultTargetState: 'IDLE' as const,
        },
    } as EventReactions<ImageEditEvents, ImageEditContext, ImageEditStates>;

    onPointerMove(context: ImageEditContext, payload: Point): void {
        const worldPos = context.imageEngine.convert2WorldPosition(payload);
        context.imageEngine.updateDrag(worldPos);
    }

    leftPointerUp(context: ImageEditContext): void {
        context.imageEngine.endInteraction();
    }
}

export const createImageEditStateMachine = (context: ImageEditContext): ImageEditStateMachine => {
    return new TemplateStateMachine<ImageEditEvents, ImageEditContext, ImageEditStates>(
        {
            INACTIVE: new ImageInactiveState(),
            IDLE: new ImageIdleState(),
            DRAGGING: new ImageDraggingState(),
            RESIZING: new ImageResizingState(),
        },
        'INACTIVE',
        context
    );
}
