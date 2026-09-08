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

export { attachBoardDebugger, attachMachineDebugger } from './attach';
export { DEFAULT_HOTKEY, MachineDebugger } from './debugger';
export type { MachineDebuggerOptions } from './debugger';
export type { AttachHandle, AttachOptions, MachineLike } from './registry';
export type { BoardLike } from './board';
export { HOOK_KEY } from './hook';
export type { BeingDevtoolsHook } from './hook';
