import { InitAppOptions, BaseAppComponents, baseInitApp } from '@ue-too/board-pixi-integration';

import { CurveCreationEngine, LayoutStateMachine } from '@/trains/input-state-machine/kmt-state-machine';
import { TrainPlacementEngine, TrainPlacementStateMachine } from '@/trains/input-state-machine/train-kmt-state-machine';
import { createLayoutStateMachine } from '@/trains/input-state-machine/utils';
import { DebugOverlayRenderSystem } from '@/trains/tracks/debug-overlay-render-system';
import { TrackRenderSystem } from '@/trains/tracks/render-system';
import { TrainRenderSystem } from '@/trains/train-render-system';
import { WorldRenderSystem } from '@/world-render-system';
import { BuildingManager, BuildingRenderSystem } from '@/buildings';

export type BananaAppComponents = BaseAppComponents & {
  curveEngine: CurveCreationEngine;
  worldRenderSystem: WorldRenderSystem;
  trackRenderSystem: TrackRenderSystem;
  trainRenderSystem: TrainRenderSystem;
  buildingManager: BuildingManager;
  buildingRenderSystem: BuildingRenderSystem;
  trainPlacementEngine: TrainPlacementEngine;
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
  const trainPlacementEngine = new TrainPlacementEngine(curveEngine.trackGraph);
  const trainRenderSystem = new TrainRenderSystem(
    worldRenderSystem,
    trainPlacementEngine.train,
    curveEngine.trackGraph,
    trackRenderSystem,
  );
  const layoutStateMachine = createLayoutStateMachine(curveEngine);
  const trainStateMachine = new TrainPlacementStateMachine(trainPlacementEngine);
  const debugOverlayRenderSystem = new DebugOverlayRenderSystem(
    worldRenderSystem,
    curveEngine.trackGraph,
    baseComponents.camera,
  );

  curveEngine.trackGraph.onSegmentSplit((info) => {
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
    layoutStateMachine,
    trainStateMachine,
    debugOverlayRenderSystem,
  };
};
