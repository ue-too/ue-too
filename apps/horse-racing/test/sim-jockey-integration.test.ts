import { readFileSync } from 'fs';
import { join } from 'path';

import type { Jockey } from '../src/ai';
import { Race } from '../src/simulation/race';
import { parseTrackJson } from '../src/simulation/track-from-json';
import type { InputState } from '../src/simulation/types';

function loadOvalTrack() {
    const path = join(__dirname, '../public/tracks/test_oval.json');
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
    return parseTrackJson(raw);
}

/** A jockey that always returns a fixed action for every non-player horse. */
class StubJockey implements Jockey {
    constructor(private action: InputState) {}
    lastRace: Race | null = null;

    infer(race: Race): Map<number, InputState> {
        this.lastRace = race;
        const map = new Map<number, InputState>();
        const playerId = race.state.playerHorseId;
        for (const h of race.state.horses) {
            if (h.id !== playerId) {
                map.set(h.id, { ...this.action });
            }
        }
        return map;
    }

    dispose(): void {}
}

describe('V2Sim jockey integration', () => {
    it('Race.tick receives merged AI + player inputs', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 4);
        race.start(0); // horse 0 is player

        const stubJockey = new StubJockey({ tangential: 1, normal: 0 });
        const playerInput: InputState = { tangential: -1, normal: 0.5 };

        // Simulate what V2Sim.tick does: get AI inputs, merge player, call race.tick
        const aiInputs = stubJockey.infer(race);
        aiInputs.set(0, playerInput); // player overrides

        race.tick(aiInputs);

        // After one tick, horse 0 should have gained less velocity than AI horses
        // because it got tangential: -1 (braking) while AI horses got tangential: 1 (full throttle).
        // The cruise controller adds a baseline forward force, so both will be positive,
        // but the AI horse should be going faster.
        const playerHorse = race.state.horses[0];
        const aiHorse = race.state.horses[1];

        // AI horse should be moving forward (positive tangential vel)
        expect(aiHorse.tangentialVel).toBeGreaterThan(0);
        // Player horse got brake input — should have less velocity than the AI horse
        expect(playerHorse.tangentialVel).toBeLessThan(aiHorse.tangentialVel);
    });

    it('with NullJockey, AI horses receive zero input', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 4);
        race.start(null); // no player — watch mode

        // NullJockey returns empty map → all horses get {0, 0} (zero input)
        const emptyInputs = new Map<number, InputState>();
        race.tick(emptyInputs);

        // With zero input all horses receive identical cruise-controller force,
        // so they should all have the same tangential velocity after one tick.
        const firstVel = race.state.horses[0].tangentialVel;
        for (const h of race.state.horses) {
            expect(h.tangentialVel).toBeCloseTo(firstVel, 5);
        }
    });
});
