import { extractMachineGraph } from '@ue-too/being';
import { Board } from '@ue-too/board';

import { BoardLike, resolveBoardMachines } from './board';
import { serializeContext } from './context';
import { computeEnabledEdges } from './enabled';
import { ParsedHotkey, matchesHotkey, parseHotkey } from './hotkey';
import { LaidOutGraph, layoutGraph } from './layout';
import { EventLog, describeEventResult, formatLogEntry } from './log';
import { PanelDom, createPanelDom } from './panel-dom';
import {
    AnyStateMachine,
    AttachHandle,
    AttachOptions,
    AttachedMachine,
    MachineLike,
    MachineRegistry,
} from './registry';
import { Flash, drawGraph } from './render';

/**
 * Options for a {@link MachineDebugger} panel.
 *
 * @category Types
 */
export type MachineDebuggerOptions = {
    /** Render inline into this element instead of as a floating overlay. */
    container?: HTMLElement;
    /** Toggle shortcut (default {@link DEFAULT_HOTKEY}). `false` disables it. */
    hotkey?: string | false;
    /** Start expanded. Defaults to `false` for the overlay, `true` with a container. */
    openByDefault?: boolean;
};

/** @category Types */
export const DEFAULT_HOTKEY = 'ctrl+shift+m';

type Tab = {
    entry: AttachedMachine;
    layout: LaidOutGraph | null;
    layoutError: string | null;
    log: EventLog;
    flash: Flash;
    button: HTMLButtonElement;
};

function findTakenEdgeIndex(
    layout: LaidOutGraph,
    from: string,
    event: string,
    to: string
): number {
    let fallback = -1;
    for (let i = 0; i < layout.edges.length; i++) {
        const edge = layout.edges[i];
        if (edge.from === from && edge.event === event && edge.to === to) {
            if (edge.guard) {
                return i; // guarded edge is the more specific match
            }
            fallback = i;
        }
    }
    return fallback;
}

/**
 * A debugger panel: a pannable state chart plus a sidebar with one tab per
 * attached machine, the current state, a context inspector, fire buttons,
 * reset, and a coalescing event log.
 *
 * @remarks
 * Every attached machine is borrowed. The panel never calls `wrapup()` —
 * that parks a live machine in `TERMINAL` and, for a board machine, stops
 * the real board responding to input. `reset()` is offered because it
 * round-trips through `TERMINAL` and restarts; it is the recovery for a
 * machine stranded by a hand-fired half-gesture.
 *
 * @example
 * ```ts
 * const panel = new MachineDebugger();
 * const handle = panel.attach(machine, { name: 'pan-control' });
 * // later
 * handle.dispose();
 * panel.dispose();
 * ```
 *
 * @category Core
 */
export class MachineDebugger {
    private readonly dom: PanelDom;
    private readonly graphBoard: Board;
    private readonly registry = new MachineRegistry();
    private readonly tabs = new Map<string, Tab>();
    private readonly measureCtx: CanvasRenderingContext2D;
    private readonly hotkey: ParsedHotkey | null;
    private selected: Tab | null = null;
    private rafId: number | null = null;
    private opened = false;
    private disposed = false;
    private lastContextText: string | null = null;

    constructor(options: MachineDebuggerOptions = {}) {
        this.dom = createPanelDom({ container: options.container });
        this.graphBoard = new Board();
        this.graphBoard.attach(this.dom.canvas);
        this.measureCtx = document.createElement('canvas').getContext('2d')!;
        this.hotkey =
            options.hotkey === false
                ? null
                : parseHotkey(options.hotkey ?? DEFAULT_HOTKEY);
        this.dom.pill.addEventListener('click', () => this.open());
        this.dom.closeButton.addEventListener('click', () => this.close());
        this.dom.resetButton.addEventListener('click', () =>
            this.resetSelected()
        );
        window.addEventListener('keydown', this.onKeyDown);
        this.dom.setCount(0);
        this.select(null);
        const openByDefault =
            options.openByDefault ?? options.container !== undefined;
        if (openByDefault) {
            this.open();
        } else {
            this.dom.setOpen(false);
        }
    }

    /** The panel's own graph viewport, so a page can diagram the board it pans. */
    get board(): Board {
        return this.graphBoard;
    }

    get isOpen(): boolean {
        return this.opened;
    }

    /** Number of attached machines. */
    get size(): number {
        return this.registry.size;
    }

    /** Name → machine for every attached machine. */
    get machines(): ReadonlyMap<string, AnyStateMachine> {
        const map = new Map<string, AnyStateMachine>();
        for (const name of this.registry.names) {
            map.set(name, this.registry.get(name)!.machine);
        }
        return map;
    }

    /**
     * Attaches a machine as a new tab.
     *
     * @throws Error when `options.name` is already attached to this panel.
     */
    attach(machine: MachineLike, options: AttachOptions = {}): AttachHandle {
        this.assertNotDisposed();
        const entry = this.registry.attach(machine, options, e =>
            this.subscribe(this.createTab(e))
        );
        this.dom.setCount(this.registry.size);
        if (this.selected === null) {
            this.select(entry.name);
        }
        return { dispose: () => this.detach(entry.name) };
    }

    /**
     * Attaches every `being` machine the board exposes (see
     * {@link resolveBoardMachines}). Attaches what it finds; throws only
     * when it finds nothing.
     */
    attachBoard(
        board: BoardLike,
        options: { namePrefix?: string } = {}
    ): AttachHandle {
        this.assertNotDisposed();
        const found = resolveBoardMachines(board, options.namePrefix);
        if (found.length === 0) {
            throw new Error(
                'No being state machines found on this board: its parsers and camera mux expose none.'
            );
        }
        const handles: AttachHandle[] = [];
        try {
            for (const item of found) {
                handles.push(
                    this.attach(item.machine, {
                        name: item.name,
                        samplePayloads: item.samplePayloads,
                    })
                );
            }
        } catch (error) {
            for (const handle of handles) {
                handle.dispose();
            }
            throw error;
        }
        return {
            dispose: () => {
                for (const handle of handles) {
                    handle.dispose();
                }
            },
        };
    }

    open(): void {
        if (this.disposed || this.opened) {
            return;
        }
        this.opened = true;
        this.dom.setOpen(true);
        if (this.rafId === null) {
            this.rafId = requestAnimationFrame(this.step);
        }
    }

    close(): void {
        if (!this.opened) {
            return;
        }
        this.opened = false;
        this.dom.setOpen(false);
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    toggle(): void {
        if (this.opened) {
            this.close();
        } else {
            this.open();
        }
    }

    /** Detaches every machine, stops the render loop, and removes the panel. */
    dispose(): void {
        if (this.disposed) {
            return;
        }
        this.close();
        this.disposed = true;
        window.removeEventListener('keydown', this.onKeyDown);
        this.registry.detachAll();
        this.tabs.clear();
        this.selected = null;
        this.graphBoard.tearDown();
        this.dom.destroy();
    }

    private assertNotDisposed(): void {
        if (this.disposed) {
            throw new Error('This MachineDebugger has been disposed.');
        }
    }

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (this.hotkey !== null && matchesHotkey(event, this.hotkey)) {
            event.preventDefault();
            this.toggle();
        }
    };

    private readonly step = (now: number): void => {
        if (!this.opened) {
            this.rafId = null;
            return;
        }
        this.graphBoard.step(now);
        const ctx = this.graphBoard.context;
        const tab = this.selected;
        if (ctx !== undefined && tab !== null && tab.layout !== null) {
            drawGraph(
                ctx,
                tab.layout,
                String(tab.entry.machine.currentState),
                tab.flash,
                now,
                computeEnabledEdges(tab.entry.machine, tab.layout)
            );
        }
        this.dom.currentState.textContent =
            tab === null
                ? 'No machine attached'
                : `Current state: ${String(tab.entry.machine.currentState)}`;
        const contextText =
            tab === null ? '' : serializeContext(tab.entry.machine.context);
        if (contextText !== this.lastContextText) {
            this.dom.contextView.textContent = contextText;
            this.lastContextText = contextText;
        }
        this.rafId = requestAnimationFrame(this.step);
    };

    private readonly measureText = (text: string): number => {
        this.measureCtx.font = '13px system-ui, sans-serif';
        return this.measureCtx.measureText(text).width;
    };

    private createTab(entry: AttachedMachine): Tab {
        let layout: LaidOutGraph | null = null;
        let layoutError: string | null = null;
        try {
            layout = layoutGraph(
                extractMachineGraph(entry.machine),
                this.measureText
            );
        } catch (error) {
            layoutError =
                error instanceof Error ? error.message : String(error);
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tab';
        button.textContent = entry.name;
        button.addEventListener('click', () => this.select(entry.name));
        this.dom.tabStrip.appendChild(button);
        const tab: Tab = {
            entry,
            layout,
            layoutError,
            log: new EventLog(),
            flash: null,
            button,
        };
        this.tabs.set(entry.name, tab);
        tab.log.append(`attached ${entry.name}`);
        if (layoutError !== null) {
            tab.log.append(`(chart unavailable: ${layoutError})`);
        } else if (typeof entry.machine.onEventResult !== 'function') {
            tab.log.append(
                '(this machine does not expose onEventResult — no event log)'
            );
        }
        return tab;
    }

    /**
     * Logs and flashes every event the machine handles, whoever fired it.
     * Runs after the state has handled the event but before the
     * transition, so `currentState` is still the source state.
     */
    private subscribe(tab: Tab): (() => void) | undefined {
        const { machine } = tab.entry;
        const layout = tab.layout;
        if (layout === null || typeof machine.onEventResult !== 'function') {
            return undefined;
        }
        const dispose = machine.onEventResult((args, result) => {
            const before = String(machine.currentState);
            const line = describeEventResult(
                String(args[0]),
                args[1],
                before,
                result
            );
            this.appendLog(tab, line.text, line.key);
            if (line.handled) {
                const edgeIndex = findTakenEdgeIndex(
                    layout,
                    before,
                    line.event,
                    line.after
                );
                if (edgeIndex !== -1) {
                    tab.flash = { edgeIndex, at: performance.now() };
                }
            }
        });
        return typeof dispose === 'function' ? dispose : undefined;
    }

    private detach(name: string): void {
        const tab = this.tabs.get(name);
        if (tab === undefined) {
            return;
        }
        this.registry.detach(name);
        tab.button.remove();
        this.tabs.delete(name);
        this.dom.setCount(this.registry.size);
        if (this.selected === tab) {
            const next = this.tabs.keys().next();
            this.select(next.done ? null : next.value);
        }
    }

    private select(name: string | null): void {
        const tab = name === null ? null : (this.tabs.get(name) ?? null);
        if (this.selected !== null) {
            this.selected.button.classList.remove('active');
        }
        this.selected = tab;
        this.lastContextText = null;
        this.dom.panelError.textContent =
            tab !== null && tab.layoutError !== null
                ? `Chart unavailable: ${tab.layoutError}`
                : '';
        this.dom.eventRows.textContent = '';
        this.dom.log.textContent = '';
        if (tab === null) {
            return;
        }
        tab.button.classList.add('active');
        this.buildEventRows(tab);
        for (const entry of tab.log.entries) {
            const li = document.createElement('li');
            li.textContent = formatLogEntry(entry);
            this.dom.log.appendChild(li);
        }
    }

    private appendLog(tab: Tab, text: string, key?: string): void {
        const change = tab.log.append(text, key);
        if (tab !== this.selected) {
            return;
        }
        const logEl = this.dom.log;
        if (change.kind === 'updated') {
            const first = logEl.firstElementChild;
            if (first !== null) {
                first.textContent = formatLogEntry(change.entry);
            }
            return;
        }
        const li = document.createElement('li');
        li.textContent = formatLogEntry(change.entry);
        logEl.prepend(li);
        while (logEl.children.length > tab.log.entries.length) {
            logEl.lastElementChild!.remove();
        }
    }

    private buildEventRows(tab: Tab): void {
        if (tab.layout === null) {
            return;
        }
        const events: string[] = [];
        for (const edge of tab.layout.edges) {
            if (!events.includes(edge.event)) {
                events.push(edge.event);
            }
        }
        for (const event of events) {
            const row = document.createElement('div');
            row.className = 'event-row';
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = `⚡ ${event}`;
            const details = document.createElement('details');
            const summary = document.createElement('summary');
            summary.textContent = 'payload';
            const textarea = document.createElement('textarea');
            textarea.rows = 3;
            textarea.value = JSON.stringify(
                tab.entry.samplePayloads[event] ?? {},
                null,
                2
            );
            const errorEl = document.createElement('div');
            errorEl.className = 'payload-error';
            button.addEventListener('click', () =>
                this.fireEvent(tab, event, textarea.value, errorEl)
            );
            details.append(summary, textarea);
            row.append(button, details, errorEl);
            this.dom.eventRows.appendChild(row);
        }
    }

    private fireEvent(
        tab: Tab,
        event: string,
        payloadText: string,
        errorEl: HTMLElement
    ): void {
        errorEl.textContent = '';
        let payload: unknown;
        try {
            payload = JSON.parse(payloadText);
        } catch (error) {
            errorEl.textContent = `Invalid JSON: ${String(error)}`;
            return;
        }
        try {
            (
                tab.entry.machine.happens as (
                    event: string,
                    payload: unknown
                ) => unknown
            )(event, payload);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            errorEl.textContent = `Action threw: ${message}`;
            this.appendLog(
                tab,
                `${event} ${payloadText} → action threw: ${message}`
            );
        }
    }

    private resetSelected(): void {
        const tab = this.selected;
        if (tab === null) {
            return;
        }
        tab.entry.machine.reset();
        tab.flash = null;
        this.appendLog(tab, 'machine reset');
    }
}
