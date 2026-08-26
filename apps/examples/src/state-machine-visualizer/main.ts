import { StateMachine, extractMachineGraph } from '@ue-too/being';
import { Board } from '@ue-too/board';

import { LaidOutGraph, layoutGraph } from './layout';
import { RegistryEntry, registry } from './registry';
import { Flash, drawGraph } from './render';

const canvas = document.getElementById('graph') as HTMLCanvasElement;
const board = new Board();
board.attach(canvas);

const machineSelect = document.getElementById(
    'machine-select'
) as HTMLSelectElement;
const currentStateEl = document.getElementById('current-state')!;
const panelErrorEl = document.getElementById('panel-error')!;
const eventRowsEl = document.getElementById('event-rows')!;
const eventLogEl = document.getElementById('event-log')!;
const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
const contextViewEl = document.getElementById('context-view')!;

let machine: StateMachine<any, any, any, any> | null = null;
let layout: LaidOutGraph | null = null;
let flash: Flash = null;

const measureCtx = document.createElement('canvas').getContext('2d')!;
function measureText(text: string): number {
    measureCtx.font = '13px system-ui, sans-serif';
    return measureCtx.measureText(text).width;
}

const MAX_LOG_ENTRIES = 200;
const MAX_CONTEXT_CHARS = 2000;

/**
 * Which edges can fire right now: the edge must leave the current state,
 * and every declared precondition must pass against the live context.
 * Routing-guard edges are not evaluated — their truth depends on
 * post-action context, which can't be known before firing.
 */
function computeEnabledEdges(): boolean[] | null {
    if (!machine || !layout) {
        return null;
    }
    const current = String(machine.currentState);
    const context = machine.context;
    return layout.edges.map(edge => {
        if (edge.from !== current) {
            return false;
        }
        if (
            !edge.preconditions ||
            edge.preconditions.length === 0 ||
            context === undefined
        ) {
            return true;
        }
        const guards = (machine!.states[edge.from]?.guards ?? {}) as Record<
            string,
            (context: unknown) => boolean
        >;
        return edge.preconditions.every(name => {
            const evaluate = guards[name];
            if (evaluate === undefined) {
                return false; // fail closed, matching the machine's veto
            }
            try {
                return evaluate(context);
            } catch {
                return true; // display-only: don't dim on a throwing guard
            }
        });
    });
}

function serializeContext(context: unknown): string {
    if (context === undefined || context === null) {
        return '';
    }
    const seen = new WeakSet<object>();
    let text: string | undefined;
    try {
        text = JSON.stringify(
            context,
            (key, value) => {
                if (typeof value === 'function') {
                    return undefined;
                }
                if (typeof value === 'object' && value !== null) {
                    if (seen.has(value)) {
                        return '[circular]';
                    }
                    seen.add(value);
                }
                return value;
            },
            2
        );
    } catch {
        return '(context not serializable)';
    }
    if (text === undefined) {
        return '(context not serializable)';
    }
    return text.length > MAX_CONTEXT_CHARS
        ? `${text.slice(0, MAX_CONTEXT_CHARS)}\n…`
        : text;
}

let lastContextText: string | null = null;

function appendLog(text: string): void {
    const li = document.createElement('li');
    li.textContent = text;
    eventLogEl.prepend(li);
    while (eventLogEl.children.length > MAX_LOG_ENTRIES) {
        eventLogEl.lastChild!.remove();
    }
}

function findTakenEdgeIndex(from: string, event: string, to: string): number {
    if (!layout) {
        return -1;
    }
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

function fireEvent(
    event: string,
    payloadText: string,
    errorEl: HTMLElement
): void {
    if (!machine) {
        return;
    }
    errorEl.textContent = '';
    let payload: unknown;
    try {
        payload = JSON.parse(payloadText);
    } catch (error) {
        errorEl.textContent = `Invalid JSON: ${String(error)}`;
        return;
    }
    const before = String(machine.currentState);
    let result: { handled: boolean };
    try {
        result = (machine.happens as any)(event, payload);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errorEl.textContent = `Action threw: ${message}`;
        appendLog(`${event} ${payloadText} → action threw: ${message}`);
        return;
    }
    if (result.handled) {
        const after = String(machine.currentState);
        appendLog(`${event} ${payloadText} → ${before} ➜ ${after}`);
        const edgeIndex = findTakenEdgeIndex(before, event, after);
        if (edgeIndex !== -1) {
            flash = { edgeIndex, at: performance.now() };
        }
    } else {
        appendLog(`${event} ${payloadText} → not handled`);
    }
}

function buildEventRows(samplePayloads: Record<string, unknown>): void {
    eventRowsEl.textContent = '';
    if (!layout) {
        return;
    }
    const events: string[] = [];
    for (const edge of layout.edges) {
        if (!events.includes(edge.event)) {
            events.push(edge.event);
        }
    }
    for (const event of events) {
        const row = document.createElement('div');
        row.className = 'event-row';
        const button = document.createElement('button');
        button.textContent = `⚡ ${event}`;
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = 'payload';
        const textarea = document.createElement('textarea');
        textarea.rows = 3;
        textarea.value = JSON.stringify(samplePayloads[event] ?? {}, null, 2);
        const errorEl = document.createElement('div');
        errorEl.className = 'payload-error';
        button.addEventListener('click', () =>
            fireEvent(event, textarea.value, errorEl)
        );
        details.append(summary, textarea);
        row.append(button, details, errorEl);
        eventRowsEl.appendChild(row);
    }
}

function selectMachine(entry: RegistryEntry): void {
    if (machine) {
        machine.wrapup();
        machine = null;
        layout = null;
        eventRowsEl.textContent = '';
    }
    panelErrorEl.textContent = '';
    try {
        const created = entry.create();
        machine = created.machine;
        layout = layoutGraph(extractMachineGraph(created.machine), measureText);
        flash = null;
        buildEventRows(created.samplePayloads);
        eventLogEl.textContent = '';
        appendLog(`loaded ${entry.label}`);
    } catch (error) {
        layout = null;
        eventRowsEl.textContent = '';
        panelErrorEl.textContent = `Failed to create "${entry.label}": ${String(error)}`;
    }
}

for (const entry of registry) {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = entry.label;
    machineSelect.appendChild(option);
}
machineSelect.addEventListener('change', () => {
    const entry = registry.find(e => e.id === machineSelect.value);
    if (entry) {
        selectMachine(entry);
    }
});
selectMachine(registry[0]);

resetBtn.addEventListener('click', () => {
    if (machine) {
        machine.reset();
        flash = null;
        appendLog('machine reset');
    }
});

function step() {
    board.step(performance.now());
    if (board.context && layout) {
        const current = machine ? String(machine.currentState) : null;
        drawGraph(
            board.context,
            layout,
            current,
            flash,
            performance.now(),
            computeEnabledEdges() ?? undefined
        );
    }
    currentStateEl.textContent = machine
        ? `Current state: ${String(machine.currentState)}`
        : 'No machine loaded';
    const contextText = machine ? serializeContext(machine.context) : '';
    if (contextText !== lastContextText) {
        contextViewEl.textContent = contextText;
        lastContextText = contextText;
    }
    requestAnimationFrame(step);
}
requestAnimationFrame(step);
