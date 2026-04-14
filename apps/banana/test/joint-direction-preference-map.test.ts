import { beforeEach, describe, expect, it } from 'bun:test';

import {
    type DirectionType,
    JointDirectionPreferenceMap,
    type SerializedJointDirectionPreference,
} from '../src/trains/tracks/joint-direction-preference-map';

describe('JointDirectionPreferenceMap', () => {
    let map: JointDirectionPreferenceMap;

    beforeEach(() => {
        map = new JointDirectionPreferenceMap();
    });

    // -------------------------------------------------------------------------
    // get
    // -------------------------------------------------------------------------

    describe('get', () => {
        it('returns undefined when no preference is set', () => {
            expect(map.get(1, 'tangent')).toBeUndefined();
            expect(map.get(1, 'reverseTangent')).toBeUndefined();
        });

        it('returns the stored tangent preference', () => {
            map.set(1, 'tangent', 5);
            expect(map.get(1, 'tangent')).toBe(5);
        });

        it('returns the stored reverseTangent preference', () => {
            map.set(2, 'reverseTangent', 7);
            expect(map.get(2, 'reverseTangent')).toBe(7);
        });

        it('returns undefined for a direction not yet set on a joint that has the other direction set', () => {
            map.set(3, 'tangent', 4);
            expect(map.get(3, 'reverseTangent')).toBeUndefined();
        });
    });

    // -------------------------------------------------------------------------
    // set
    // -------------------------------------------------------------------------

    describe('set', () => {
        it('stores tangent and reverseTangent independently', () => {
            map.set(1, 'tangent', 10);
            map.set(1, 'reverseTangent', 20);
            expect(map.get(1, 'tangent')).toBe(10);
            expect(map.get(1, 'reverseTangent')).toBe(20);
        });

        it('overwrites an existing preference', () => {
            map.set(1, 'tangent', 5);
            map.set(1, 'tangent', 99);
            expect(map.get(1, 'tangent')).toBe(99);
        });
    });

    // -------------------------------------------------------------------------
    // clear
    // -------------------------------------------------------------------------

    describe('clear', () => {
        it("clear(jointNumber) removes only that joint's preferences", () => {
            map.set(1, 'tangent', 5);
            map.set(1, 'reverseTangent', 6);
            map.set(2, 'tangent', 7);

            map.clear(1);

            expect(map.get(1, 'tangent')).toBeUndefined();
            expect(map.get(1, 'reverseTangent')).toBeUndefined();
            expect(map.get(2, 'tangent')).toBe(7);
        });

        it('clear() with no argument removes all preferences', () => {
            map.set(1, 'tangent', 5);
            map.set(2, 'reverseTangent', 6);

            map.clear();

            expect(map.get(1, 'tangent')).toBeUndefined();
            expect(map.get(2, 'reverseTangent')).toBeUndefined();
        });
    });

    // -------------------------------------------------------------------------
    // cycle
    // -------------------------------------------------------------------------

    describe('cycle', () => {
        it('selects the first joint when no preference exists', () => {
            const available = new Set([2, 3, 4]);
            const result = map.cycle(1, 'tangent', available);
            expect(result).toBe(2);
            expect(map.get(1, 'tangent')).toBe(2);
        });

        it('advances to the next joint in iteration order', () => {
            const available = new Set([2, 3, 4]);
            map.set(1, 'tangent', 2);
            const result = map.cycle(1, 'tangent', available);
            expect(result).toBe(3);
            expect(map.get(1, 'tangent')).toBe(3);
        });

        it('wraps around to the first joint after the last', () => {
            const available = new Set([2, 3, 4]);
            map.set(1, 'tangent', 4);
            const result = map.cycle(1, 'tangent', available);
            expect(result).toBe(2);
            expect(map.get(1, 'tangent')).toBe(2);
        });

        it('resets to the first joint if the current preference is stale (not in available set)', () => {
            const available = new Set([10, 20]);
            map.set(1, 'tangent', 99); // 99 is not in the available set
            const result = map.cycle(1, 'tangent', available);
            expect(result).toBe(10);
            expect(map.get(1, 'tangent')).toBe(10);
        });

        it('returns the only option when the set has size 1', () => {
            const available = new Set([5]);
            const result = map.cycle(1, 'tangent', available);
            expect(result).toBe(5);
            expect(map.get(1, 'tangent')).toBe(5);
        });

        it('works independently for tangent and reverseTangent on the same joint', () => {
            const available = new Set([2, 3]);
            map.set(1, 'tangent', 2);
            map.set(1, 'reverseTangent', 3);

            const tangentResult = map.cycle(1, 'tangent', available);
            expect(tangentResult).toBe(3);

            const reverseResult = map.cycle(1, 'reverseTangent', available);
            expect(reverseResult).toBe(2);
        });
    });

    // -------------------------------------------------------------------------
    // serialize / deserialize
    // -------------------------------------------------------------------------

    describe('serialize', () => {
        it('returns an empty array for an empty map', () => {
            expect(map.serialize()).toEqual([]);
        });

        it('serializes tangent-only preference', () => {
            map.set(1, 'tangent', 5);
            const data = map.serialize();
            expect(data).toHaveLength(1);
            expect(data[0]).toEqual({ joint: 1, tangent: 5 });
        });

        it('serializes reverseTangent-only preference', () => {
            map.set(2, 'reverseTangent', 7);
            const data = map.serialize();
            expect(data).toHaveLength(1);
            expect(data[0]).toEqual({ joint: 2, reverseTangent: 7 });
        });

        it('serializes both directions for a single joint', () => {
            map.set(3, 'tangent', 10);
            map.set(3, 'reverseTangent', 20);
            const data = map.serialize();
            expect(data).toHaveLength(1);
            expect(data[0]).toEqual({
                joint: 3,
                tangent: 10,
                reverseTangent: 20,
            });
        });

        it('serializes multiple joints', () => {
            map.set(1, 'tangent', 5);
            map.set(2, 'reverseTangent', 6);
            const data = map.serialize();
            expect(data).toHaveLength(2);
            const byJoint = Object.fromEntries(data.map(d => [d.joint, d]));
            expect(byJoint[1]).toEqual({ joint: 1, tangent: 5 });
            expect(byJoint[2]).toEqual({ joint: 2, reverseTangent: 6 });
        });
    });

    describe('deserialize', () => {
        it('produces an empty map from an empty array', () => {
            const result = JointDirectionPreferenceMap.deserialize([]);
            expect(result.serialize()).toEqual([]);
        });

        it('round-trips tangent preference', () => {
            map.set(1, 'tangent', 5);
            const restored = JointDirectionPreferenceMap.deserialize(
                map.serialize()
            );
            expect(restored.get(1, 'tangent')).toBe(5);
            expect(restored.get(1, 'reverseTangent')).toBeUndefined();
        });

        it('round-trips reverseTangent preference', () => {
            map.set(2, 'reverseTangent', 7);
            const restored = JointDirectionPreferenceMap.deserialize(
                map.serialize()
            );
            expect(restored.get(2, 'reverseTangent')).toBe(7);
            expect(restored.get(2, 'tangent')).toBeUndefined();
        });

        it('round-trips both directions on the same joint', () => {
            map.set(3, 'tangent', 10);
            map.set(3, 'reverseTangent', 20);
            const restored = JointDirectionPreferenceMap.deserialize(
                map.serialize()
            );
            expect(restored.get(3, 'tangent')).toBe(10);
            expect(restored.get(3, 'reverseTangent')).toBe(20);
        });

        it('round-trips multiple joints', () => {
            map.set(1, 'tangent', 5);
            map.set(2, 'reverseTangent', 6);
            map.set(3, 'tangent', 8);
            map.set(3, 'reverseTangent', 9);
            const restored = JointDirectionPreferenceMap.deserialize(
                map.serialize()
            );
            expect(restored.get(1, 'tangent')).toBe(5);
            expect(restored.get(2, 'reverseTangent')).toBe(6);
            expect(restored.get(3, 'tangent')).toBe(8);
            expect(restored.get(3, 'reverseTangent')).toBe(9);
        });
    });
});
