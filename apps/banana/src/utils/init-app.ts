import { InitAppOptions, BaseAppComponents, baseInitApp } from '@ue-too/board-pixi-integration';
import Stats from 'stats.js';

import { Train, type TrainPosition } from '@/trains/formation';
import { LayoutStateMachine } from '@/trains/input-state-machine/layout-kmt-state-machine';
import { CurveCreationEngine } from '@/trains/input-state-machine/curve-engine';
import { DefaultJointDirectionManager, TrainPlacementEngine, TrainPlacementStateMachine } from '@/trains/input-state-machine/train-kmt-state-machine';
import { createLayoutStateMachine } from '@/trains/input-state-machine/utils';
import { DebugOverlayRenderSystem } from '@/trains/tracks/debug-overlay-render-system';
import { generateProceduralTrackPath, type ProceduralTrackOptions } from '@/trains/tracks/procedural-tracks';
import { TrackRenderSystem } from '@/trains/tracks/render-system';
import { TrainManager } from '@/trains/train-manager';
import { TrainRenderSystem } from '@/trains/train-render-system';
import { WorldRenderSystem } from '@/world-render-system';
import { BuildingManager, BuildingRenderSystem } from '@/buildings';
import { createKmtInputStateMachineExpansion, KmtExpandedStateMachine } from '@/trains/input-state-machine/kmt-state-machine-extension';

const DEFAULT_BOGIE_OFFSETS = [40, 10, 40];

export type BananaAppComponents = BaseAppComponents & {
  curveEngine: CurveCreationEngine;
  worldRenderSystem: WorldRenderSystem;
  trackRenderSystem: TrackRenderSystem;
  trainRenderSystem: TrainRenderSystem;
  buildingManager: BuildingManager;
  buildingRenderSystem: BuildingRenderSystem;
  trainPlacementEngine: TrainPlacementEngine;
  trainManager: TrainManager;
  layoutStateMachine: LayoutStateMachine;
  kmtStateMachineExpansion: KmtExpandedStateMachine;
  trainStateMachine: TrainPlacementStateMachine;
  debugOverlayRenderSystem: DebugOverlayRenderSystem;
  /** Add a train at the given segment and t. For stress testing. */
  addTrainAtPosition: (
    segmentNumber: number,
    tValue: number,
    direction: 'tangent' | 'reverseTangent',
  ) => boolean;
  /** Add multiple trains on the first segment for performance testing. Returns number added. */
  addStressTestTrains: (count: number) => number;
  /** Generate a procedural track path for stress testing. Returns number of segments created. */
  generateProceduralTracks: (options: ProceduralTrackOptions) => number;
};

/**
 * Initialize the banana PixiJS application with all subsystems.
 *
 * @param canvas - The canvas element to render to
 * @param option - Initialization options forwarded to baseInitApp
 * @returns Resolved banana app components including all render/management systems
 */
export const initApp = async (
  canvas: HTMLCanvasElement,
  option: Partial<InitAppOptions> = { fullScreen: false },
): Promise<BananaAppComponents> => {
  const baseComponents = await baseInitApp(canvas, option);

  // FPS / performance monitoring with stats.js
  const stats = new Stats();
  stats.showPanel(0); // 0: FPS, 1: MS, 2: MB
  stats.dom.style.position = 'fixed';
  stats.dom.style.top = '0';
  stats.dom.style.right = '0';
  stats.dom.style.left = 'auto';
  stats.dom.style.zIndex = '10000';
  document.body.appendChild(stats.dom);
  const statsTick = (): void => {
    stats.update();
  };
  baseComponents.app.ticker.add(statsTick);
  baseComponents.cleanups.push(() => {
    baseComponents.app.ticker.remove(statsTick);
    if (stats.dom.parentElement) {
      stats.dom.parentElement.removeChild(stats.dom);
    }
  });

  baseComponents.camera.setMaxZoomLevel(30);

  const curveEngine = new CurveCreationEngine(baseComponents.canvasProxy, baseComponents.camera);
  const layoutSubStateMachine = createLayoutStateMachine(curveEngine);
  const worldRenderSystem = new WorldRenderSystem();
  const trackRenderSystem = new TrackRenderSystem(
    worldRenderSystem,
    curveEngine.trackGraph.trackCurveManager,
    curveEngine,
    baseComponents.camera,
    { renderer: baseComponents.app.renderer },
  );
  const buildingManager = new BuildingManager();
  const buildingRenderSystem = new BuildingRenderSystem(worldRenderSystem, buildingManager);

  const trainManager = new TrainManager();
  const trackGraph = curveEngine.trackGraph;
  const jointDirectionManager = new DefaultJointDirectionManager(trackGraph);
  const trainPlacementEngine = new TrainPlacementEngine(trackGraph, {
    onPlaced: (placed) => {
      trainManager.addTrain(placed);
      return new Train(null, trackGraph, jointDirectionManager);
    },
  });
  const trainRenderSystem = new TrainRenderSystem(
    worldRenderSystem,
    () => trainManager.getPlacedTrains(),
    trainPlacementEngine.train,
    trackGraph,
    trackRenderSystem,
    { renderer: baseComponents.app.renderer },
  );
  // const layoutStateMachine = createLayoutStateMachine(curveEngine);
  const trainStateMachine = new TrainPlacementStateMachine(trainPlacementEngine);
  const debugOverlayRenderSystem = new DebugOverlayRenderSystem(
    worldRenderSystem,
    trackGraph,
    baseComponents.camera,
  );

  const kmtInputStateMachine = createKmtInputStateMachineExpansion(layoutSubStateMachine, trainStateMachine, baseComponents.observableInputTracker);
  baseComponents.kmtParser.stateMachine = kmtInputStateMachine;
  baseComponents.kmtInputStateMachine = kmtInputStateMachine;

  curveEngine.trackGraph.onSegmentSplit((info) => {
    for (const { train } of trainManager.getPlacedTrains()) {
      train.remapOnSegmentSplit(info);
    }
    trainPlacementEngine.train.remapOnSegmentSplit(info);
  });

  baseComponents.app.stage.addChild(worldRenderSystem.container);

  baseComponents.app.ticker.add((ticker) => {
    trainRenderSystem.update(ticker.deltaMS);
  });

  const addTrainAtPosition = (
    segmentNumber: number,
    tValue: number,
    direction: 'tangent' | 'reverseTangent',
  ): boolean => {
    const segment = trackGraph.getTrackSegmentWithJoints(segmentNumber);
    if (!segment) return false;
    const point = segment.curve.getPointbyPercentage(tValue);
    const position: TrainPosition = {
      trackSegment: segmentNumber,
      tValue,
      direction,
      point,
    };
    const train = new Train(
      position,
      trackGraph,
      jointDirectionManager,
    );
    trainManager.addTrain(train);
    return true;
  };

  const addStressTestTrains = (count: number): number => {
    const segmentNumbers = trackGraph.trackCurveManager.livingEntities;
    if (segmentNumbers.length === 0) return 0;
    const segmentNumber = segmentNumbers[0];
    let added = 0;
    for (let i = 0; i < count; i++) {
      const t = 0.3 + (i / Math.max(count, 1)) * 0.4;
      if (addTrainAtPosition(segmentNumber, t, 'tangent')) added += 1;
    }
    return added;
  };

  const generateProceduralTracks = (options: ProceduralTrackOptions): number => {
    return generateProceduralTrackPath(trackGraph, options);
  };

  return {
    ...baseComponents,
    curveEngine,
    worldRenderSystem,
    trackRenderSystem,
    trainRenderSystem,
    buildingManager,
    buildingRenderSystem,
    trainPlacementEngine,
    trainManager,
    layoutStateMachine: layoutSubStateMachine,
    kmtStateMachineExpansion: kmtInputStateMachine,
    trainStateMachine,
    debugOverlayRenderSystem,
    addTrainAtPosition,
    addStressTestTrains,
    generateProceduralTracks,
  };
};
