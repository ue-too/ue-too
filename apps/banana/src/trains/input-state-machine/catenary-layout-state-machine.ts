import type {
    BaseContext,
    CreateStateType,
    EventGuards,
    EventReactions,
    Guard,
    StateMachine,
} from '@ue-too/being';
import { NO_OP, TemplateState, TemplateStateMachine } from '@ue-too/being';
import type { Point } from '@ue-too/math';

export const CATENARY_LAYOUT_STATES = [
    'IDLE_FOR_SOURCE',
    'PREVIEWING',
] as const;

export type CatenaryLayoutStates = CreateStateType<
    typeof CATENARY_LAYOUT_STATES
>;

export type CatenaryLayoutEvents = {
    leftPointerUp: { x: number; y: number };
    pointerMove: { x: number; y: number };
    escapeKey: {};
    F: {};
    startCatenary: {};
    endCatenary: {};
};

export interface CatenaryLayoutContext extends BaseContext {
    /** Try to pick a segment at the given world position. Returns true if a source was selected. */
    selectSource: (position: Point) => boolean;
    /** Called on pointer move so the engine can track cursor position. */
    updateCursor: (position: Point) => void;
    /** Flip which side of the track the catenary poles are placed on. */
    flipSide: () => void;
    /** Commit the catenary onto the selected segment. Returns true on success. */
    commitCatenary: () => boolean;
    /** Discard the current preview and clear the source. */
    cancelPreview: () => void;
    /** Convert raw window coordinates to world space. */
    convert2WorldPosition: (position: Point) => Point;
    /** Whether the engine currently holds a previewable source. */
    readonly hasPreview: boolean;
}

export class CatenaryLayoutIdleForSourceState extends TemplateState<
    CatenaryLayoutEvents,
    CatenaryLayoutContext,
    CatenaryLayoutStates
> {
    protected _eventReactions: EventReactions<
        CatenaryLayoutEvents,
        CatenaryLayoutContext,
        CatenaryLayoutStates
    > = {
        leftPointerUp: {
            action: (context, event) => {
                const position = context.convert2WorldPosition(event);
                context.selectSource(position);
            },
            defaultTargetState: 'IDLE_FOR_SOURCE',
        },
        pointerMove: {
            action: (context, event) => {
                const position = context.convert2WorldPosition(event);
                context.updateCursor(position);
            },
            defaultTargetState: 'IDLE_FOR_SOURCE',
        },
        startCatenary: {
            action: NO_OP,
            defaultTargetState: 'IDLE_FOR_SOURCE',
        },
        endCatenary: {
            action: (context) => {
                context.cancelPreview();
            },
            defaultTargetState: 'IDLE_FOR_SOURCE',
        },
    };

    protected _guards: Guard<CatenaryLayoutContext, string> = {
        hasPreview: (context) => context.hasPreview,
    };

    protected _eventGuards: Partial<
        EventGuards<
            CatenaryLayoutEvents,
            CatenaryLayoutStates,
            CatenaryLayoutContext,
            Guard<CatenaryLayoutContext, string>
        >
    > = {
        leftPointerUp: [
            {
                guard: 'hasPreview',
                target: 'PREVIEWING',
            },
        ],
    };
}

export class CatenaryLayoutPreviewingState extends TemplateState<
    CatenaryLayoutEvents,
    CatenaryLayoutContext,
    CatenaryLayoutStates
> {
    protected _eventReactions: EventReactions<
        CatenaryLayoutEvents,
        CatenaryLayoutContext,
        CatenaryLayoutStates
    > = {
        leftPointerUp: {
            action: (context, event) => {
                const position = context.convert2WorldPosition(event);
                const pickedNewSource = context.selectSource(position);
                if (!pickedNewSource) {
                    context.commitCatenary();
                }
            },
            defaultTargetState: 'IDLE_FOR_SOURCE',
        },
        pointerMove: {
            action: (context, event) => {
                const position = context.convert2WorldPosition(event);
                context.updateCursor(position);
            },
            defaultTargetState: 'PREVIEWING',
        },
        F: {
            action: (context) => {
                context.flipSide();
            },
            defaultTargetState: 'PREVIEWING',
        },
        escapeKey: {
            action: (context) => {
                context.cancelPreview();
            },
            defaultTargetState: 'IDLE_FOR_SOURCE',
        },
        endCatenary: {
            action: (context) => {
                context.cancelPreview();
            },
            defaultTargetState: 'IDLE_FOR_SOURCE',
        },
    };

    protected _guards: Guard<CatenaryLayoutContext, string> = {
        hasPreview: (context) => context.hasPreview,
    };

    protected _eventGuards: Partial<
        EventGuards<
            CatenaryLayoutEvents,
            CatenaryLayoutStates,
            CatenaryLayoutContext,
            Guard<CatenaryLayoutContext, string>
        >
    > = {
        leftPointerUp: [
            {
                guard: 'hasPreview',
                target: 'PREVIEWING',
            },
        ],
    };
}

export type CatenaryLayoutStateMachine = StateMachine<
    CatenaryLayoutEvents,
    CatenaryLayoutContext,
    CatenaryLayoutStates
>;

export function createCatenaryLayoutStateMachine(
    context: CatenaryLayoutContext
): CatenaryLayoutStateMachine {
    return new TemplateStateMachine<
        CatenaryLayoutEvents,
        CatenaryLayoutContext,
        CatenaryLayoutStates
    >(
        {
            IDLE_FOR_SOURCE: new CatenaryLayoutIdleForSourceState(),
            PREVIEWING: new CatenaryLayoutPreviewingState(),
        },
        'IDLE_FOR_SOURCE',
        context
    );
}
