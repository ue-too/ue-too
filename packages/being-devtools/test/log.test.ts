import { describe, expect, it } from 'vitest';

import {
    EventLog,
    MAX_LOG_ENTRIES,
    describeEventResult,
    formatLogEntry,
} from '../src/log';

describe('EventLog', () => {
    it('adds a new entry at the front', () => {
        const log = new EventLog();
        log.append('first');
        const change = log.append('second');
        expect(change.kind).toBe('added');
        expect(log.entries.map(e => e.text)).toEqual(['second', 'first']);
    });

    it('coalesces a repeat of the previous key into a counter', () => {
        const log = new EventLog();
        log.append('move → handled', 'move|A|!noop');
        const change = log.append('move → handled', 'move|A|!noop');
        expect(change.kind).toBe('updated');
        expect(log.entries).toHaveLength(1);
        expect(log.entries[0].count).toBe(2);
        expect(formatLogEntry(log.entries[0])).toBe('move → handled ×2');
    });

    it('does not coalesce across a different key or an unkeyed line', () => {
        const log = new EventLog();
        log.append('a', 'k1');
        log.append('b', 'k2');
        log.append('a', 'k1');
        expect(log.entries).toHaveLength(3);

        const log2 = new EventLog();
        log2.append('a', 'k1');
        log2.append('plain');
        log2.append('a', 'k1');
        expect(log2.entries).toHaveLength(3);
    });

    it('evicts the oldest entries beyond the cap and reports how many', () => {
        const log = new EventLog(3);
        log.append('1');
        log.append('2');
        log.append('3');
        const change = log.append('4');
        expect(change.kind).toBe('added');
        if (change.kind === 'added') {
            expect(change.evicted).toBe(1);
        }
        expect(log.entries.map(e => e.text)).toEqual(['4', '3', '2']);
    });

    it('defaults to MAX_LOG_ENTRIES', () => {
        const log = new EventLog();
        for (let i = 0; i < MAX_LOG_ENTRIES + 5; i++) {
            log.append(String(i));
        }
        expect(log.entries).toHaveLength(MAX_LOG_ENTRIES);
    });

    it('clear empties the log', () => {
        const log = new EventLog();
        log.append('x');
        log.clear();
        expect(log.entries).toHaveLength(0);
    });
});

describe('describeEventResult', () => {
    it('reports an unhandled event with a sentinel key', () => {
        const line = describeEventResult('withdraw', { amount: 5 }, 'ACTIVE', {
            handled: false,
        });
        expect(line.handled).toBe(false);
        expect(line.text).toBe('withdraw {"amount":5} → not handled');
        expect(line.key).toBe('withdraw|ACTIVE|!unhandled');
        expect(line.after).toBe('ACTIVE');
    });

    it('reports a handled event with no transition', () => {
        const line = describeEventResult('tick', undefined, 'RUNNING', {
            handled: true,
        });
        expect(line.text).toBe('tick → handled, no transition');
        expect(line.key).toBe('tick|RUNNING|!noop');
        expect(line.after).toBe('RUNNING');
    });

    it('treats a nextState equal to the source as no transition', () => {
        const line = describeEventResult('tick', undefined, 'RUNNING', {
            handled: true,
            nextState: 'RUNNING',
        });
        expect(line.key).toBe('tick|RUNNING|!noop');
    });

    it('reports a transition with both states in the key', () => {
        const line = describeEventResult('stop', undefined, 'RUNNING', {
            handled: true,
            nextState: 'IDLE',
        });
        expect(line.handled).toBe(true);
        expect(line.text).toBe('stop → RUNNING ➜ IDLE');
        expect(line.key).toBe('stop|RUNNING|IDLE');
        expect(line.before).toBe('RUNNING');
        expect(line.after).toBe('IDLE');
    });
});
