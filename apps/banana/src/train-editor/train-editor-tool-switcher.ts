import { BaseContext, Defer, EventReactions, NO_OP, StateMachine, TemplateState, TemplateStateMachine } from "@ue-too/being";
import type { BogieEditStateMachine } from "./bogie-kmt-state-machine";
import type { BogieAddStateMachine } from "./bogie-add-state-machine";
import type { ImageEditStateMachine } from "./image-edit-state-machine";

export const TRAIN_EDITOR_TOOL_STATES = ['IDLE', 'EDIT_BOGIE', 'ADD_BOGIE', 'EDIT_IMAGE'] as const;

export type TrainEditorToolStates = typeof TRAIN_EDITOR_TOOL_STATES[number];

export type TrainEditorToolEvents = {
    switchToEditBogie: {};
    switchToAddBogie: {};
    switchToEditImage: {};
    switchToIdle: {};
}

export type TrainEditorToolContext = BaseContext;

export type TrainEditorToolStateMachine = StateMachine<TrainEditorToolEvents, TrainEditorToolContext, TrainEditorToolStates>;

class ToolIdleState extends TemplateState<TrainEditorToolEvents, TrainEditorToolContext, TrainEditorToolStates> {
    protected _eventReactions: EventReactions<TrainEditorToolEvents, TrainEditorToolContext, TrainEditorToolStates> = {
        switchToEditBogie: {
            action: NO_OP,
            defaultTargetState: 'EDIT_BOGIE',
        },
        switchToAddBogie: {
            action: NO_OP,
            defaultTargetState: 'ADD_BOGIE',
        },
        switchToEditImage: {
            action: NO_OP,
            defaultTargetState: 'EDIT_IMAGE',
        },
        switchToIdle: {
            action: NO_OP,
        },
    };
}

class ToolEditBogieState extends TemplateState<TrainEditorToolEvents, TrainEditorToolContext, TrainEditorToolStates> {
    private _bogieEditStateMachine: BogieEditStateMachine;

    constructor(bogieEditStateMachine: BogieEditStateMachine) {
        super();
        this._bogieEditStateMachine = bogieEditStateMachine;
    }

    uponEnter(): void {
        this._bogieEditStateMachine.happens('startEditing');
    }

    beforeExit(): void {
        this._bogieEditStateMachine.happens('endEditing');
    }

    protected _defer: Defer<TrainEditorToolContext, TrainEditorToolEvents, TrainEditorToolStates> = {
        action: (_context, event, eventKey) => {
            const result = this._bogieEditStateMachine.happens(eventKey as string, event);
            if (result.handled) {
                return { handled: true, output: result.output };
            }
            return { handled: false };
        },
    };

    protected _eventReactions: EventReactions<TrainEditorToolEvents, TrainEditorToolContext, TrainEditorToolStates> = {
        switchToEditBogie: {
            action: NO_OP,
        },
        switchToAddBogie: {
            action: NO_OP,
            defaultTargetState: 'ADD_BOGIE',
        },
        switchToEditImage: {
            action: NO_OP,
            defaultTargetState: 'EDIT_IMAGE',
        },
        switchToIdle: {
            action: NO_OP,
            defaultTargetState: 'IDLE',
        },
    };
}

class ToolAddBogieState extends TemplateState<TrainEditorToolEvents, TrainEditorToolContext, TrainEditorToolStates> {
    private _bogieAddStateMachine: BogieAddStateMachine;

    constructor(bogieAddStateMachine: BogieAddStateMachine) {
        super();
        this._bogieAddStateMachine = bogieAddStateMachine;
    }

    uponEnter(): void {
        this._bogieAddStateMachine.happens('startAdding');
    }

    beforeExit(): void {
        this._bogieAddStateMachine.happens('endAdding');
    }

    protected _defer: Defer<TrainEditorToolContext, TrainEditorToolEvents, TrainEditorToolStates> = {
        action: (_context, event, eventKey) => {
            const result = this._bogieAddStateMachine.happens(eventKey as string, event);
            if (result.handled) {
                return { handled: true, output: result.output };
            }
            return { handled: false };
        },
    };

    protected _eventReactions: EventReactions<TrainEditorToolEvents, TrainEditorToolContext, TrainEditorToolStates> = {
        switchToEditBogie: {
            action: NO_OP,
            defaultTargetState: 'EDIT_BOGIE',
        },
        switchToAddBogie: {
            action: NO_OP,
        },
        switchToEditImage: {
            action: NO_OP,
            defaultTargetState: 'EDIT_IMAGE',
        },
        switchToIdle: {
            action: NO_OP,
            defaultTargetState: 'IDLE',
        },
    };
}

class ToolEditImageState extends TemplateState<TrainEditorToolEvents, TrainEditorToolContext, TrainEditorToolStates> {
    private _imageEditStateMachine: ImageEditStateMachine;

    constructor(imageEditStateMachine: ImageEditStateMachine) {
        super();
        this._imageEditStateMachine = imageEditStateMachine;
    }

    uponEnter(): void {
        this._imageEditStateMachine.happens('startImageEdit');
    }

    beforeExit(): void {
        this._imageEditStateMachine.happens('endImageEdit');
    }

    protected _defer: Defer<TrainEditorToolContext, TrainEditorToolEvents, TrainEditorToolStates> = {
        action: (_context, event, eventKey) => {
            const result = this._imageEditStateMachine.happens(eventKey as string, event);
            if (result.handled) {
                return { handled: true, output: result.output };
            }
            return { handled: false };
        },
    };

    protected _eventReactions: EventReactions<TrainEditorToolEvents, TrainEditorToolContext, TrainEditorToolStates> = {
        switchToEditBogie: {
            action: NO_OP,
            defaultTargetState: 'EDIT_BOGIE',
        },
        switchToAddBogie: {
            action: NO_OP,
            defaultTargetState: 'ADD_BOGIE',
        },
        switchToEditImage: {
            action: NO_OP,
        },
        switchToIdle: {
            action: NO_OP,
            defaultTargetState: 'IDLE',
        },
    };
}

export const createTrainEditorToolSwitcher = (
    bogieEditStateMachine: BogieEditStateMachine,
    bogieAddStateMachine: BogieAddStateMachine,
    imageEditStateMachine: ImageEditStateMachine,
): TrainEditorToolStateMachine => {
    return new TemplateStateMachine<TrainEditorToolEvents, TrainEditorToolContext, TrainEditorToolStates>(
        {
            IDLE: new ToolIdleState(),
            EDIT_BOGIE: new ToolEditBogieState(bogieEditStateMachine),
            ADD_BOGIE: new ToolAddBogieState(bogieAddStateMachine),
            EDIT_IMAGE: new ToolEditImageState(imageEditStateMachine),
        },
        'IDLE',
        { setup: () => { }, cleanup: () => { } }
    );
};
