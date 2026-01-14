/**
 * Example: Hierarchical State Machine POC
 *
 * @remarks
 * This example demonstrates how to use hierarchical state machines with
 * composite states that contain child state machines.
 *
 * Scenario: A media player with hierarchical states
 * - Top level: IDLE, PLAYING, PAUSED
 * - PLAYING contains: BUFFERING, STREAMING, ERROR
 * - Events can be handled at child or parent level
 */

import {
  BaseContext,
  TemplateState,
  TemplateStateMachine,
  EventReactions,
} from "./interface";
import {
  CompositeState,
  HierarchicalStateMachine,
} from "./hierarchical";

// ============================================================================
// Context Definition
// ============================================================================

interface MediaPlayerContext extends BaseContext {
  currentTrack: string | null;
  bufferLevel: number;
  isStreaming: boolean;
  errorMessage: string | null;
  setup(): void;
  cleanup(): void;
}

// ============================================================================
// Event Definitions
// ============================================================================

type MediaPlayerEvents = {
  play: { track: string };
  pause: {};
  stop: {};
  bufferComplete: {};
  streamReady: {};
  error: { message: string };
  retry: {};
};

// ============================================================================
// State Type Definitions
// ============================================================================

type TopLevelStates = "IDLE" | "PLAYING" | "PAUSED";
type PlayingChildStates = "BUFFERING" | "STREAMING" | "ERROR";

// ============================================================================
// Child States (for PLAYING composite state)
// ============================================================================

class BufferingState extends TemplateState<MediaPlayerEvents, MediaPlayerContext, PlayingChildStates> {
  protected _eventReactions = {
    bufferComplete: {
      action: (context: MediaPlayerContext) => {
        console.log("Buffer complete!");
        context.bufferLevel = 100;
      },
      defaultTargetState: "STREAMING",
    },
    error: {
      action: (context: MediaPlayerContext, event: MediaPlayerEvents["error"]) => {
        context.errorMessage = event.message;
        console.log(`Error during buffering: ${event.message}`);
      },
      defaultTargetState: "ERROR",
    },
  } satisfies EventReactions<MediaPlayerEvents, MediaPlayerContext, PlayingChildStates> as EventReactions<MediaPlayerEvents, MediaPlayerContext, PlayingChildStates>;

  uponEnter(context: MediaPlayerContext, stateMachine: any, from: PlayingChildStates | "INITIAL") {
    console.log("  → Entered BUFFERING (child state)");
    context.bufferLevel = 0;
  }
}

class StreamingState extends TemplateState<MediaPlayerEvents, MediaPlayerContext, PlayingChildStates> {
  protected _eventReactions = {
    error: {
      action: (context: MediaPlayerContext, event: MediaPlayerEvents["error"]) => {
        context.errorMessage = event.message;
        console.log(`Error during streaming: ${event.message}`);
      },
      defaultTargetState: "ERROR",
    },
  } satisfies EventReactions<MediaPlayerEvents, MediaPlayerContext, PlayingChildStates> as EventReactions<MediaPlayerEvents, MediaPlayerContext, PlayingChildStates>;

  uponEnter(context: MediaPlayerContext, stateMachine: any, from: PlayingChildStates | "INITIAL") {
    console.log("  → Entered STREAMING (child state)");
    context.isStreaming = true;
    context.bufferLevel = 100;
  }

  beforeExit(context: MediaPlayerContext, stateMachine: any, to: PlayingChildStates | "TERMINAL") {
    console.log("  → Exiting STREAMING (child state)");
    context.isStreaming = false;
  }
}

class ErrorState extends TemplateState<MediaPlayerEvents, MediaPlayerContext, PlayingChildStates> {
  protected _eventReactions = {
    retry: {
      action: (context: MediaPlayerContext) => {
        console.log("Retrying...");
        context.errorMessage = null;
      },
      defaultTargetState: "BUFFERING",
    },
  } satisfies EventReactions<MediaPlayerEvents, MediaPlayerContext, PlayingChildStates> as EventReactions<MediaPlayerEvents, MediaPlayerContext, PlayingChildStates>;

  uponEnter(context: MediaPlayerContext, stateMachine: any, from: PlayingChildStates | "INITIAL") {
    console.log(`  → Entered ERROR (child state): ${context.errorMessage}`);
  }
}

// ============================================================================
// Top-Level States
// ============================================================================

class IdleState extends TemplateState<MediaPlayerEvents, MediaPlayerContext, TopLevelStates> {
  protected _eventReactions = {
    play: {
      action: (context: MediaPlayerContext, event: MediaPlayerEvents["play"]) => {
        console.log(`Starting playback: ${event.track}`);
        context.currentTrack = event.track;
      },
      defaultTargetState: "PLAYING",
    },
  } satisfies EventReactions<MediaPlayerEvents, MediaPlayerContext, TopLevelStates>;

  uponEnter(context: MediaPlayerContext, stateMachine: any, from: TopLevelStates | "INITIAL") {
    console.log("Entered IDLE");
  }
}

class PlayingState extends CompositeState<
  MediaPlayerEvents,
  MediaPlayerContext,
  TopLevelStates,
  PlayingChildStates
> {
  protected _context: MediaPlayerContext;
  // Parent-level event reactions (handled if child doesn't handle them)
  constructor(context: MediaPlayerContext) {
    super();
    this._context = context;
  }

  protected _eventReactions = {
    pause: {
      action: (context: MediaPlayerContext) => {
        console.log("Pausing playback");
      },
      defaultTargetState: "PAUSED",
    },
    stop: {
      action: (context: MediaPlayerContext) => {
        console.log("Stopping playback");
        context.currentTrack = null;
      },
      defaultTargetState: "IDLE",
    },
  } satisfies EventReactions<MediaPlayerEvents, MediaPlayerContext, TopLevelStates> as EventReactions<MediaPlayerEvents, MediaPlayerContext, TopLevelStates>;

  protected getChildStateMachine() {
    // Create child state machine for PLAYING state
    // Context should be set before this is called
    if (!this._context) {
      throw new Error("Context must be set on CompositeState before getChildStateMachine is called");
    }

    const childStates = {
      BUFFERING: new BufferingState(),
      STREAMING: new StreamingState(),
      ERROR: new ErrorState(),
    };

    const childMachine = new TemplateStateMachine<MediaPlayerEvents, MediaPlayerContext, PlayingChildStates>(
      childStates,
      "BUFFERING",
      this._context,
      false // Don't auto-start, we'll manage it
    );

    return {
      stateMachine: childMachine,
      defaultChildState: "BUFFERING" as PlayingChildStates,
      rememberHistory: true, // Remember last child state when re-entering PLAYING
    };
  }

  override uponEnter(context: MediaPlayerContext, stateMachine: any, from: TopLevelStates | "INITIAL") {
    console.log("Entered PLAYING (composite state)");
    super.uponEnter(context, stateMachine, from);
  }

  override beforeExit(context: MediaPlayerContext, stateMachine: any, to: TopLevelStates | "TERMINAL") {
    console.log("Exiting PLAYING (composite state)");
    super.beforeExit(context, stateMachine, to);
  }
}

class PausedState extends TemplateState<MediaPlayerEvents, MediaPlayerContext, TopLevelStates> {
  protected _eventReactions = {
    play: {
      action: (context: MediaPlayerContext) => {
        console.log("Resuming playback");
      },
      defaultTargetState: "PLAYING",
    },
    stop: {
      action: (context: MediaPlayerContext) => {
        console.log("Stopping from paused state");
        context.currentTrack = null;
      },
      defaultTargetState: "IDLE",
    },
  } satisfies EventReactions<MediaPlayerEvents, MediaPlayerContext, TopLevelStates>;

  uponEnter(context: MediaPlayerContext, stateMachine: any, from: TopLevelStates | "INITIAL") {
    console.log("Entered PAUSED");
  }
}

// ============================================================================
// Example Usage
// ============================================================================

export function runHierarchicalStateMachineExample() {
  console.log("=== Hierarchical State Machine POC Example ===\n");

  // Create context
  const context: MediaPlayerContext = {
    currentTrack: null,
    bufferLevel: 0,
    isStreaming: false,
    errorMessage: null,
    setup() {
      this.currentTrack = null;
      this.bufferLevel = 0;
      this.isStreaming = false;
      this.errorMessage = null;
    },
    cleanup() {
      console.log("Media player context cleaned up");
    },
  };

  // Create top-level states
  const topLevelStates = {
    IDLE: new IdleState(),
    PLAYING: new PlayingState(context),
    PAUSED: new PausedState(),
  };

  // Create hierarchical state machine
  const machine = new HierarchicalStateMachine<MediaPlayerEvents, MediaPlayerContext, TopLevelStates>(
    topLevelStates,
    "IDLE",
    context
  );

  // Listen to state changes
  machine.onStateChange((currentState, nextState) => {
    const currentPath = machine.getCurrentStatePath();
    console.log(`\n[State Change] ${currentState} → ${nextState}`);
    console.log(`[State Path] ${currentPath}`);
    console.log(`[Active Path] [${machine.getActiveStatePath().join(" → ")}]\n`);
  });

  // Test the hierarchical state machine
  console.log("1. Starting in IDLE state");
  console.log(`   Current path: ${machine.getCurrentStatePath()}\n`);

  console.log("2. Playing a track (transitions to PLAYING.BUFFERING)");
  machine.happens("play", { track: "song.mp3" });
  console.log(`   Current path: ${machine.getCurrentStatePath()}`);
  console.log(`   Is in PLAYING? ${machine.isInStatePath("PLAYING")}`);
  console.log(`   Is in PLAYING.BUFFERING? ${machine.isInStatePath("PLAYING.BUFFERING")}\n`);

  console.log("3. Buffer completes (transitions to PLAYING.STREAMING)");
  machine.happens("bufferComplete");
  console.log(`   Current path: ${machine.getCurrentStatePath()}\n`);

  console.log("4. Pausing (handled by parent PLAYING state)");
  machine.happens("pause");
  console.log(`   Current path: ${machine.getCurrentStatePath()}\n`);

  console.log("5. Resuming (transitions back to PLAYING, remembers STREAMING)");
  machine.happens("play", { track: "song.mp3" });
  console.log(`   Current path: ${machine.getCurrentStatePath()}\n`);

  console.log("6. Error occurs (transitions to PLAYING.ERROR)");
  machine.happens("error", { message: "Network connection lost" });
  console.log(`   Current path: ${machine.getCurrentStatePath()}\n`);

  console.log("7. Retrying (transitions to PLAYING.BUFFERING)");
  machine.happens("retry");
  console.log(`   Current path: ${machine.getCurrentStatePath()}\n`);

  console.log("8. Stopping (handled by parent PLAYING state, transitions to IDLE)");
  machine.happens("stop");
  console.log(`   Current path: ${machine.getCurrentStatePath()}\n`);

  console.log("=== Example Complete ===\n");
}

// Uncomment to run:
// runHierarchicalStateMachineExample();
