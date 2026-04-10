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

export const DUPLICATE_TO_SIDE_STATES = [
    'IDLE_FOR_SOURCE',
    'PREVIEWING',
] as const;

export type DuplicateToSideStates = CreateStateType<
    typeof DUPLICATE_TO_SIDE_STATES
>;

export type DuplicateToSideEvents = {
    leftPointerUp: { x: number; y: number };
    pointerMove: { x: number; y: number };
    escapeKey: {};
    F: {};
    startDuplicate: {};
    endDuplicate: {};
};

export interface DuplicateToSideContext extends BaseContext {
    /** Try to pick a segment at the given world position. Returns true if a source was selected. */
    selectSource: (position: Point) => boolean;
    /** Called on pointer move so the engine can track cursor position. */
    updateCursor: (position: Point) => void;
    /** Flip which side of the source the preview renders on. */
    flipSide: () => void;
    /** Commit the current preview as a real track segment. Returns true on success. */
    commitDuplicate: () => boolean;
    /** Discard the current preview and clear the source. */
    cancelPreview: () => void;
    /** Convert raw window coordinates to world space. */
    convert2WorldPosition: (position: Point) => Point;
    /** Whether the engine currently holds a previewable source. */
    readonly hasPreview: boolean;
}

export class DuplicateToSideIdleForSourceState extends TemplateState<
    DuplicateToSideEvents,
    DuplicateToSideContext,
    DuplicateToSideStates
> {
    protected _eventReactions: EventReactions<
        DuplicateToSideEvents,
        DuplicateToSideContext,
        DuplicateToSideStates
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
        startDuplicate: {
            action: NO_OP,
            defaultTargetState: 'IDLE_FOR_SOURCE',
        },
        endDuplicate: {
            action: context => {
                context.cancelPreview();
            },
            defaultTargetState: 'IDLE_FOR_SOURCE',
        },
    };

    protected _guards: Guard<DuplicateToSideContext, string> = {
        hasPreview: context => context.hasPreview,
    };

    protected _eventGuards: Partial<
        EventGuards<
            DuplicateToSideEvents,
            DuplicateToSideStates,
            DuplicateToSideContext,
            Guard<DuplicateToSideContext, string>
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

export class DuplicateToSidePreviewingState extends TemplateState<
    DuplicateToSideEvents,
    DuplicateToSideContext,
    DuplicateToSideStates
> {
    protected _eventReactions: EventReactions<
        DuplicateToSideEvents,
        DuplicateToSideContext,
        DuplicateToSideStates
    > = {
        leftPointerUp: {
            action: (context, event) => {
                const position = context.convert2WorldPosition(event);
                const pickedNewSource = context.selectSource(position);
                if (!pickedNewSource) {
                    context.commitDuplicate();
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
            action: context => {
                context.flipSide();
            },
            defaultTargetState: 'PREVIEWING',
        },
        escapeKey: {
            action: context => {
                context.cancelPreview();
            },
            defaultTargetState: 'IDLE_FOR_SOURCE',
        },
        endDuplicate: {
            action: context => {
                context.cancelPreview();
            },
            defaultTargetState: 'IDLE_FOR_SOURCE',
        },
    };

    protected _guards: Guard<DuplicateToSideContext, string> = {
        hasPreview: context => context.hasPreview,
    };

    protected _eventGuards: Partial<
        EventGuards<
            DuplicateToSideEvents,
            DuplicateToSideStates,
            DuplicateToSideContext,
            Guard<DuplicateToSideContext, string>
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

export type DuplicateToSideStateMachine = StateMachine<
    DuplicateToSideEvents,
    DuplicateToSideContext,
    DuplicateToSideStates
>;

export function createDuplicateToSideStateMachine(
    context: DuplicateToSideContext
): DuplicateToSideStateMachine {
    return new TemplateStateMachine<
        DuplicateToSideEvents,
        DuplicateToSideContext,
        DuplicateToSideStates
    >(
        {
            IDLE_FOR_SOURCE: new DuplicateToSideIdleForSourceState(),
            PREVIEWING: new DuplicateToSidePreviewingState(),
        },
        'IDLE_FOR_SOURCE',
        context
    );
}
