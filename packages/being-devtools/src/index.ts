/**
 * @packageDocumentation
 * Attachable devtools for `@ue-too/being` state machines.
 *
 * @remarks
 * Attach a floating debugger panel to any running machine with one call:
 *
 * ```ts
 * import { attachMachineDebugger } from '@ue-too/being-devtools';
 *
 * attachMachineDebugger(machine, { name: 'pan-control' });
 * ```
 *
 * The panel draws the machine's state chart, highlights the current state,
 * dims transitions whose preconditions currently fail, logs every event the
 * machine handles (coalescing repeats), shows the context, and lets you fire
 * events by hand. Ctrl+Shift+M (Cmd+Shift+M on macOS) toggles it.
 */

export { layoutGraph } from './layout';
export type { LaidOutEdge, LaidOutGraph, LaidOutNode } from './layout';
export { drawGraph } from './render';
export type { Flash } from './render';
export { matchesHotkey, parseHotkey } from './hotkey';
export type { HotkeyEventLike, ParsedHotkey } from './hotkey';
export {
    EventLog,
    MAX_LOG_ENTRIES,
    describeEventResult,
    formatLogEntry,
} from './log';
export type { EventLine, LogChange, LogEntry } from './log';
