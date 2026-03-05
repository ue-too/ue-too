import { InitAppOptions, BaseAppComponents, baseInitApp } from '@ue-too/board-pixi-integration';
import Stats from 'stats.js';

import { Train } from '@/trains/formation';
import { CurveCreationEngine, LayoutStateMachine } from '@/trains/input-state-machine/kmt-state-machine';
import { DefaultJointDirectionManager, TrainPlacementEngine, TrainPlacementStateMachine } from '@/trains/input-state-machine/train-kmt-state-machine';
import { createLayoutStateMachine } from '@/trains/input-state-machine/utils';
import { DebugOverlayRenderSystem } from '@/trains/tracks/debug-overlay-render-system';
import { TrackRenderSystem } from '@/trains/tracks/render-system';
import { TrainManager } from '@/trains/train-manager';
import { TrainRenderSystem } from '@/trains/train-render-system';
import { WorldRenderSystem } from '@/world-render-system';
import { BuildingManager, BuildingRenderSystem } from '@/buildings';

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
  trainStateMachine: TrainPlacementStateMachine;
  debugOverlayRenderSystem: DebugOverlayRenderSystem;
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

  const curveEngine = new CurveCreationEngine();
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
      return new Train(null, [...DEFAULT_BOGIE_OFFSETS], trackGraph, jointDirectionManager);
    },
  });
  const trainRenderSystem = new TrainRenderSystem(
    worldRenderSystem,
    () => trainManager.getPlacedTrains(),
    trainPlacementEngine.train,
    trackGraph,
    trackRenderSystem,
  );
  const layoutStateMachine = createLayoutStateMachine(curveEngine);
  const trainStateMachine = new TrainPlacementStateMachine(trainPlacementEngine);
  const debugOverlayRenderSystem = new DebugOverlayRenderSystem(
    worldRenderSystem,
    trackGraph,
    baseComponents.camera,
  );

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
    layoutStateMachine,
    trainStateMachine,
    debugOverlayRenderSystem,
  };
};
