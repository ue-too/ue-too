import { describe, it, expect } from 'bun:test';
import { Car } from '../src/trains/cars';
import { Formation, Train } from '../src/trains/formation';
import type { TrackGraph } from '../src/trains/tracks/track';
import type { JointDirectionManager } from '../src/trains/input-state-machine/train-kmt-state-machine';

const mockTrackGraph = {} as unknown as TrackGraph;
const mockJointDirectionManager = {} as unknown as JointDirectionManager;

function makeTrain(): Train {
    const car = new Car('A', [20], 2.5, 2.5);
    const formation = new Formation('f', [car]);
    return new Train(null, mockTrackGraph, mockJointDirectionManager, formation);
}

describe('Train collision lock', () => {

    describe('setThrottleStep (no lock)', () => {

        it('should set throttle normally when not locked', () => {
            const train = makeTrain();
            train.setThrottleStep('p3');
            expect(train.throttleStep).toBe('p3');
        });

        it('should change throttle multiple times when not locked', () => {
            const train = makeTrain();
            train.setThrottleStep('p1');
            expect(train.throttleStep).toBe('p1');
            train.setThrottleStep('b2');
            expect(train.throttleStep).toBe('b2');
        });

    });

    describe('emergencyStop()', () => {

        it('should set speed to 0', () => {
            const train = makeTrain();
            // Manually set speed via private field access
            (train as unknown as { _speed: number })._speed = 50;
            train.emergencyStop();
            expect(train.speed).toBe(0);
        });

        it('should set throttle to "er"', () => {
            const train = makeTrain();
            train.setThrottleStep('p5');
            train.emergencyStop();
            expect(train.throttleStep).toBe('er');
        });

        it('should set collisionLocked to true', () => {
            const train = makeTrain();
            expect(train.collisionLocked).toBe(false);
            train.emergencyStop();
            expect(train.collisionLocked).toBe(true);
        });

        it('should set all three: speed=0, throttle=er, collisionLocked=true', () => {
            const train = makeTrain();
            (train as unknown as { _speed: number })._speed = 100;
            train.setThrottleStep('p4');
            train.emergencyStop();
            expect(train.speed).toBe(0);
            expect(train.throttleStep).toBe('er');
            expect(train.collisionLocked).toBe(true);
        });

    });

    describe('setThrottleStep blocked when collisionLocked', () => {

        it('should be a no-op when collisionLocked is true', () => {
            const train = makeTrain();
            train.emergencyStop();
            // Attempt to change throttle — should be ignored
            train.setThrottleStep('p3');
            expect(train.throttleStep).toBe('er');
        });

        it('should not change throttle from any value while locked', () => {
            const train = makeTrain();
            train.emergencyStop();
            train.setThrottleStep('N');
            train.setThrottleStep('b1');
            train.setThrottleStep('p5');
            // All changes should have been ignored
            expect(train.throttleStep).toBe('er');
        });

    });

    describe('clearCollisionLock()', () => {

        it('should set collisionLocked to false', () => {
            const train = makeTrain();
            train.emergencyStop();
            expect(train.collisionLocked).toBe(true);
            train.clearCollisionLock();
            expect(train.collisionLocked).toBe(false);
        });

        it('should allow setThrottleStep again after clearing the lock', () => {
            const train = makeTrain();
            train.emergencyStop();
            train.clearCollisionLock();
            train.setThrottleStep('p2');
            expect(train.throttleStep).toBe('p2');
        });

        it('should be a no-op when called on an unlocked train', () => {
            const train = makeTrain();
            expect(train.collisionLocked).toBe(false);
            train.clearCollisionLock();
            expect(train.collisionLocked).toBe(false);
        });

        it('should allow multiple throttle changes after unlock', () => {
            const train = makeTrain();
            train.emergencyStop();
            train.clearCollisionLock();
            train.setThrottleStep('b3');
            expect(train.throttleStep).toBe('b3');
            train.setThrottleStep('p1');
            expect(train.throttleStep).toBe('p1');
        });

    });

    describe('collisionLocked getter', () => {

        it('should be false by default', () => {
            const train = makeTrain();
            expect(train.collisionLocked).toBe(false);
        });

    });

});
