import {
    baseInitApp,
    type BaseAppComponents,
    type InitAppOptions,
} from '@ue-too/board-pixi-integration';

import { parseTrackJson } from '@/simulation/track-from-json';
import type { TrackSegment } from '@/simulation/track-types';
import {
    attachV2Sim,
    type V2Sim,
    type V2SimHandle,
} from '@/simulation/v2';

const DEFAULT_TRACK_URL = '/tracks/test_oval.json';

export type V2AppComponents = BaseAppComponents & {
    simHandle: V2SimHandle;
    sim: V2Sim;
};

async function loadTrack(url: string): Promise<TrackSegment[]> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to load track ${url}: ${res.status}`);
    }
    const json = await res.json();
    return parseTrackJson(json);
}

/**
 * Boot the v2 sim against a Pixi canvas supplied by the Wrapper.
 *
 * `onReady` is how the handle escapes to React — `baseInitApp`'s return
 * value flows back into the Wrapper, not into `RaceV2Page`, so we use a
 * closure-captured callback instead.
 */
export function makeInitRaceV2(
    onReady: (handle: V2SimHandle) => void,
): (canvas: HTMLCanvasElement, opt: Partial<InitAppOptions>) => Promise<V2AppComponents> {
    return async (canvas, opt) => {
        const components = await baseInitApp(canvas, opt);
        components.camera.setMaxZoomLevel?.(30);

        const segments = await loadTrack(DEFAULT_TRACK_URL);
        const sim = attachV2Sim(components, segments);

        const handle: V2SimHandle = {
            pickHorse: (id) => sim.pickHorse(id),
            start: () => sim.start(),
            reset: () => sim.reset(),
            getPhase: () => sim.getPhase(),
            onPhaseChange: (cb) => sim.onPhaseChange(cb),
            cleanup: () => sim.cleanup(),
        };

        onReady(handle);
        return { ...components, simHandle: handle, sim };
    };
}
