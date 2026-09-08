import { EventResult } from '@ue-too/being';

/** Default cap on retained log lines. @category Types */
export const MAX_LOG_ENTRIES = 200;

/**
 * One line of the event log. `count` > 1 means consecutive identical
 * `key`s were coalesced into this line.
 *
 * @category Types
 */
export type LogEntry = {
    text: string;
    key?: string;
    count: number;
};

/**
 * What {@link EventLog.append} did, so a view can update incrementally.
 *
 * @category Types
 */
export type LogChange =
    | { kind: 'added'; entry: LogEntry; evicted: number }
    | { kind: 'updated'; entry: LogEntry };

/**
 * A bounded, newest-first log that coalesces consecutive lines sharing a
 * key into one line with a `×N` counter.
 *
 * @remarks
 * Without coalescing, a live board machine's ~60 Hz `pointerMove` stream
 * evicts the whole log in about three seconds of panning.
 *
 * @category Core
 */
export class EventLog {
    private _entries: LogEntry[] = [];

    constructor(private readonly maxEntries: number = MAX_LOG_ENTRIES) {}

    /** Newest first. */
    get entries(): readonly LogEntry[] {
        return this._entries;
    }

    append(text: string, key?: string): LogChange {
        const newest = this._entries[0];
        if (key !== undefined && newest !== undefined && newest.key === key) {
            newest.count += 1;
            newest.text = text;
            return { kind: 'updated', entry: newest };
        }
        const entry: LogEntry = { text, key, count: 1 };
        this._entries.unshift(entry);
        let evicted = 0;
        while (this._entries.length > this.maxEntries) {
            this._entries.pop();
            evicted += 1;
        }
        return { kind: 'added', entry, evicted };
    }

    clear(): void {
        this._entries = [];
    }
}

/** Display text for a log entry, with the coalescing counter. @category Helpers */
export function formatLogEntry(entry: LogEntry): string {
    return entry.count > 1 ? `${entry.text} ×${entry.count}` : entry.text;
}

/**
 * A described `onEventResult` callback, ready to log and to match against
 * the chart's edges.
 *
 * @category Types
 */
export type EventLine = {
    event: string;
    text: string;
    key: string;
    handled: boolean;
    before: string;
    /** The state after the event; equals `before` when nothing moved. */
    after: string;
};

/**
 * Turns one `onEventResult` callback into a log line and a coalescing key.
 *
 * @remarks
 * `!unhandled` and `!noop` are sentinels that cannot collide with a real
 * state name (unlike the transition key, which interpolates one), so a
 * state literally named "unhandled" cannot coalesce into the wrong line.
 *
 * @category Helpers
 */
export function describeEventResult(
    event: string,
    payload: unknown,
    before: string,
    result: EventResult<string, unknown>
): EventLine {
    const payloadText =
        payload === undefined ? '' : ` ${JSON.stringify(payload)}`;
    if (!result.handled) {
        return {
            event,
            text: `${event}${payloadText} → not handled`,
            key: `${event}|${before}|!unhandled`,
            handled: false,
            before,
            after: before,
        };
    }
    const after =
        result.nextState === undefined ? before : String(result.nextState);
    if (after === before) {
        return {
            event,
            text: `${event}${payloadText} → handled, no transition`,
            key: `${event}|${before}|!noop`,
            handled: true,
            before,
            after,
        };
    }
    return {
        event,
        text: `${event}${payloadText} → ${before} ➜ ${after}`,
        key: `${event}|${before}|${after}`,
        handled: true,
        before,
        after,
    };
}
