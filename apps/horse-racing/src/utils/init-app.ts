import {
    type BaseAppComponents,
    type InitAppOptions,
    baseInitApp,
} from '@ue-too/board-pixi-integration';

import type { Jockey } from '@/ai';
import { type V2Sim, type V2SimHandle, attachV2Sim } from '@/simulation';
import { parseTrackJson } from '@/simulation/track-from-json';
import type { TrackSegment } from '@/simulation/track-types';

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
export function makeInitApp(
    onReady: (handle: V2SimHandle) => void
): (
    canvas: HTMLCanvasElement,
    opt: Partial<InitAppOptions>
) => Promise<V2AppComponents> {
    return async (canvas, opt) => {
        const components = await baseInitApp(canvas, opt);
        components.camera.setMaxZoomLevel?.(30);

        const segments = await loadTrack(DEFAULT_TRACK_URL);
        const sim = attachV2Sim(components, segments);

        const handle: V2SimHandle = {
            pickHorse: id => sim.pickHorse(id),
            start: () => sim.start(),
            reset: () => sim.reset(),
            getPhase: () => sim.getPhase(),
            getHorses: () => sim.getHorses(),
            getHorseCount: () => sim.getHorseCount(),
            setHorseCount: count => sim.setHorseCount(count),
            setTrack: async (url: string) => {
                const segments = await loadTrack(url);
                sim.setTrack(segments);
            },
            onPhaseChange: cb => sim.onPhaseChange(cb),
            onPrecomputeProgress: cb => sim.onPrecomputeProgress(cb),
            onSimulationReady: cb => sim.onSimulationReady(cb),
            onPlaybackProgress: cb => sim.onPlaybackProgress(cb),
            playback: () => sim.playback(),
            togglePlayback: () => sim.togglePlayback(),
            seekPlayback: (frame: number) => sim.seekPlayback(frame),
            getPlaybackSpeed: () => sim.getPlaybackSpeed(),
            setPlaybackSpeed: (m: number) => sim.setPlaybackSpeed(m),
            setJockey: (jockey: Jockey) => sim.setJockey(jockey),
            setHorseJockey: (horseId: number, jockey: Jockey | null) => sim.setHorseJockey(horseId, jockey),
            getHorseJockeyUrl: (horseId: number) => sim.getHorseJockeyUrl(horseId),
            setHorseJockeyUrl: (horseId: number, url: string | null) => sim.setHorseJockeyUrl(horseId, url),

            exportRace: () => sim.exportRace(),
            getTrackSegments: () => sim.getTrackSegments(),
            runBtBatch: req => sim.runBtBatch(req),
            followHorse: id => sim.followHorse(id),
            getFollowedHorse: () => sim.getFollowedHorse(),
            getCurrentFrame: () => sim.getCurrentFrame(),
            invalidateJockeyUrl: url => sim.invalidateJockeyUrl(url),
            cleanup: () => sim.cleanup(),
        };

        // Let the Wrapper's own teardown handle sim cleanup — pushing onto
        // components.cleanups ensures it fires at the right time in the Pixi
        // lifecycle, avoiding the React Strict Mode double-mount race.
        components.cleanups.push(() => sim.cleanup());

        onReady(handle);
        return { ...components, simHandle: handle, sim };
    };
}
