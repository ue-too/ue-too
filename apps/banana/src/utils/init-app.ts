import { InitAppOptions, BaseAppComponents, baseInitApp } from '@ue-too/board-pixi-integration';
import { toast } from 'sonner';
import Stats from 'stats.js';

import { Train, type TrainPosition } from '@/trains/formation';
import type { JointDirectionManager } from '@/trains/input-state-machine/train-kmt-state-machine';
import { DefaultJointDirectionManager, TrainPlacementEngine, TrainPlacementStateMachine } from '@/trains/input-state-machine/train-kmt-state-machine';
import { LayoutStateMachine } from '@/trains/input-state-machine/layout-kmt-state-machine';
import { CurveCreationEngine } from '@/trains/input-state-machine/curve-engine';
import { createLayoutStateMachine } from '@/trains/input-state-machine/utils';
import { DebugOverlayRenderSystem } from '@/trains/tracks/debug-overlay-render-system';
import { generateProceduralTrackPath, generateParallelTracks, type ProceduralTrackOptions, type ParallelTrackOptions } from '@/trains/tracks/procedural-tracks';
import { TrackRenderSystem } from '@/trains/tracks/render-system';
import { TrainManager } from '@/trains/train-manager';
import { CarStockManager } from '@/trains/car-stock-manager';
import { FormationManager } from '@/trains/formation-manager';
import { TrainRenderSystem } from '@/trains/train-render-system';
import { WorldRenderSystem } from '@/world-render-system';
import { TerrainData } from '@/terrain/terrain-data';
import { TerrainRenderSystem } from '@/terrain/terrain-render-system';
import { BuildingManager, BuildingRenderSystem } from '@/buildings';
import { createKmtInputStateMachineExpansion, KmtExpandedStateMachine } from '@/trains/input-state-machine/kmt-state-machine-extension';
import { CarImageRegistry } from '@/trains/car-image-registry';
import { TimeManager } from '@/time';
import { ScheduleClock, DayOfWeek, TimetableManager } from '@/timetable';
import { StationManager } from '@/stations/station-manager';
import { StationRenderSystem } from '@/stations/station-render-system';
import { StationPlacementEngine, StationPlacementStateMachine } from '@/stations/station-placement-state-machine';
import { CameraMuxWithAnimationAndLock, createCameraMuxWithAnimationAndLock } from '@ue-too/board';
import { Animator, NumberAnimationHelper, Animation } from '@ue-too/animate';
import { Point } from '@ue-too/math';


export type FocusAnimationParams = {
  startWorldPoint: Point;
  targetWorldPoint: Point;
  startZoom: number;
  targetZoom: number;
};

// ===========================================================================
// Combined pan+zoom camera animation
// ===========================================================================
//
// --- Why naive linear interpolation breaks ---
//
// The viewport position of a world point T is:
//
//   screenPos(T) = (T - cameraPos) * zoomLevel
//
// If we interpolate camera position and zoom independently at the same rate:
//
//   p(t) = S + (T - S) * t          (S = start camera pos)
//   z(t) = z0 + (z1 - z0) * t       (z0 = start zoom, z1 = target zoom)
//
// Then the target's viewport position during the animation is:
//
//   screenPos(T, t) = (T - p(t)) * z(t)
//                    = (T - S)(1 - t) * z(t)
//
// At t = 0.5 with z0 = 1, z1 = 5:  z(0.5) = 3, giving (T-S) * 0.5 * 3 = 1.5(T-S).
// That is LARGER than at t = 0, which was (T-S) * 1 * 1 = (T-S).
// The target moves AWAY from center before snapping back — visually, "zoom outruns pan."
//
// --- Monotonic viewport-space interpolation (simple solution) ---
//
// One fix is to ensure the target's screen position decreases monotonically
// toward center:
//
//   screenPos(T, t) = (T - S) * z0 * (1 - t)
//
// This is monotonically decreasing from (T-S)*z0 at t=0 to 0 at t=1.
// Solving for the required camera position p(t):
//
//   (T - p(t)) * z(t) = (T - S) * z0 * (1 - t)
//   T - p(t) = (T - S) * z0 * (1 - t) / z(t)
//   p(t) = T - (T - S) * z0 * (1 - t) / z(t)
//
// Verification:
//   t=0: p(0) = T - (T-S) * z0 / z0       = T - (T-S) = S  ✓
//   t=1: p(1) = T - (T-S) * z0 * 0 / z1   = T              ✓
//
// This works well for close targets where zoom barely changes. However, it
// does NOT handle the case where the start and target are far apart and the
// camera should zoom out first to show the journey, then zoom back in. For
// that we need a fundamentally different path shape — which is what the
// Van Wijk & Nuij paper provides below.
//
// ---------------------------------------------------------------------------
// Van Wijk & Nuij (2003) "Smooth and efficient zooming and panning"
// ---------------------------------------------------------------------------
//
// The paper defines an optimal camera path through (u, w) space where:
//   u = 1-D pan parameter along the straight line between start and target (world units)
//   w = width of the visible world region = viewportPixelWidth / zoomLevel
//
// A metric on (u, w) space captures the perceived cost of combined panning
// and zooming:
//
//   ds² = (ρ²/w²) du² + (1/(ρ²w²)) dw²
//
// where ρ is a free parameter controlling zoom/pan trade-off (higher ρ →
// more zooming, less panning). The paper's user study found ρ ≈ 1.42.
//
// The optimal path is the geodesic (shortest arc-length path) in this metric
// that connects (u₀, w₀) to (u₁, w₁), satisfying:
//   1. Arc-length parameterisation (constant perceived velocity):
//        ρ²u̇² + ẇ²/ρ² = w²
//   2. Geodesic equations (shortest path):
//        ü − 2u̇ẇ/w = 0
//        ẅ + ρ⁴u̇²/w − ẇ²/w = 0
//
// --- Analytic solution (for u₀ ≠ u₁) ---
//
//   u(s) = (w₀/ρ²) cosh(r₀) tanh(ρs + r₀) − (w₀/ρ²) sinh(r₀) + u₀
//   w(s) = w₀ cosh(r₀) / cosh(ρs + r₀)
//   S    = (r₁ − r₀) / ρ                          (total arc length)
//
//   rᵢ = ln(−bᵢ + √(bᵢ² + 1))    (i.e. arcsinh(−bᵢ))
//   b₀ = (w₁² − w₀² + ρ⁴Δu²) / (2w₀ρ²Δu)
//   b₁ = (w₁² − w₀² − ρ⁴Δu²) / (2w₁ρ²Δu)
//   Δu = u₁ − u₀ = ‖targetPoint − startPoint‖
//
// The path traces an ellipse in (u, w) space: the camera zooms out,
// pans across, and zooms back in — with the zoom-out height determined
// automatically by the metric so that no unnecessary detour is taken.
//
// For u₀ = u₁ (pure zoom, no pan):
//   u(s) = u₀
//   w(s) = w₀ exp(k ρ s)
//   S    = |ln(w₁/w₀)| / ρ
//   k    = −1 if w₁ < w₀, else 1
//
// --- Mapping to our coordinate system ---
//
//   w = viewportPixelWidth / zoomLevel   ⟹   zoom(s) = vpW / w(s)
//   Camera position along the 2D line:
//     pos(s) = startPoint + direction × u(s)
//   where direction = (targetPoint − startPoint) / ‖targetPoint − startPoint‖
//
// --- Easing ---
//
// The arc-length parameterisation gives constant perceived velocity.
// We layer an ease-in-out on top (mapping normalised time t ∈ [0,1]
// to s = ease(t) × S) for pleasant acceleration/deceleration at the
// start and end of the animation. The paper notes this as a valid
// extension (§7).
// ---------------------------------------------------------------------------

/** ρ: zoom/pan trade-off. Paper user study average ≈ 1.42. */
const VAN_WIJK_RHO = 1.42;

type OptimalPath = {
  /** Total arc length of the geodesic. */
  S: number;
  /** Pan parameter u at arc-length s. */
  u: (s: number) => number;
  /** Width parameter w at arc-length s. */
  w: (s: number) => number;
};

/**
 * Compute the Van Wijk & Nuij optimal camera path between two views.
 *
 * @param panDistance - ‖target − start‖ in world units (= u₁, with u₀ = 0)
 * @param w0 - start visible width (viewportPixelWidth / startZoom)
 * @param w1 - end visible width   (viewportPixelWidth / targetZoom)
 * @param rho - zoom/pan trade-off parameter (default {@link VAN_WIJK_RHO})
 */
function computeOptimalPath(
  panDistance: number,
  w0: number,
  w1: number,
  rho: number = VAN_WIJK_RHO,
): OptimalPath {
  const u1 = panDistance;

  // --- Special case: pure zoom (no pan) ---
  if (Math.abs(u1) < 1e-6) {
    const k = w1 < w0 ? -1 : 1;
    const S = Math.abs(Math.log(w1 / w0)) / rho;
    return {
      S,
      u: () => 0,
      w: (s: number) => w0 * Math.exp(k * rho * s),
    };
  }

  // --- General case: combined pan + zoom ---
  const rho2 = rho * rho;
  const rho4 = rho2 * rho2;

  // b₀ = (w₁² − w₀² + ρ⁴Δu²) / (2 w₀ ρ² Δu)
  const b0 = (w1 * w1 - w0 * w0 + rho4 * u1 * u1) / (2 * w0 * rho2 * u1);
  // b₁ = (w₁² − w₀² − ρ⁴Δu²) / (2 w₁ ρ² Δu)
  const b1 = (w1 * w1 - w0 * w0 - rho4 * u1 * u1) / (2 * w1 * rho2 * u1);

  // rᵢ = arcsinh(−bᵢ) = ln(−bᵢ + √(bᵢ²+1))
  const r0 = Math.log(-b0 + Math.sqrt(b0 * b0 + 1));
  const r1 = Math.log(-b1 + Math.sqrt(b1 * b1 + 1));

  const S = (r1 - r0) / rho;
  const coshr0 = Math.cosh(r0);
  const sinhr0 = Math.sinh(r0);

  return {
    S,
    u: (s: number) => {
      // u(s) = (w₀/ρ²) cosh(r₀) tanh(ρs + r₀) − (w₀/ρ²) sinh(r₀) + u₀
      return (w0 / rho2) * coshr0 * Math.tanh(rho * s + r0)
           - (w0 / rho2) * sinhr0;
    },
    w: (s: number) => {
      // w(s) = w₀ cosh(r₀) / cosh(ρs + r₀)
      return w0 * coshr0 / Math.cosh(rho * s + r0);
    },
  };
}

export type BananaAppComponents = BaseAppComponents & {
  scheduleClock: ScheduleClock;
  timetableManager: TimetableManager;
  /** Mutable ref so the TimeManager callback always uses the current timetable manager. */
  timetableRef: { current: TimetableManager };
  curveEngine: CurveCreationEngine;
  worldRenderSystem: WorldRenderSystem;
  terrainData: TerrainData;
  terrainRenderSystem: TerrainRenderSystem;
  trackRenderSystem: TrackRenderSystem;
  trainRenderSystem: TrainRenderSystem;
  buildingManager: BuildingManager;
  buildingRenderSystem: BuildingRenderSystem;
  trainPlacementEngine: TrainPlacementEngine;
  trainManager: TrainManager;
  carStockManager: CarStockManager;
  formationManager: FormationManager;
  jointDirectionManager: JointDirectionManager;
  layoutStateMachine: LayoutStateMachine;
  kmtStateMachineExpansion: KmtExpandedStateMachine;
  trainStateMachine: TrainPlacementStateMachine;
  debugOverlayRenderSystem: DebugOverlayRenderSystem;
  carImageRegistry: CarImageRegistry;
  timeManager: TimeManager;
  cameraMux: CameraMuxWithAnimationAndLock;
  startFocusAnimation: (params: FocusAnimationParams) => void;
  startFollowAnimation: (params: FocusAnimationParams, getPosition: () => Point | null) => void;
  stopFollowing: () => void;
  isFollowing: () => boolean;
  animations: Animator[];
  stationManager: StationManager;
  stationRenderSystem: StationRenderSystem;
  /** The stats.js DOM element for toggling visibility. */
  statsDom: HTMLDivElement;
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
  /** Spawn N parallel straight tracks, each with one train. Returns number spawned. */
  spawnParallelTracksWithTrains: (count: number) => number;
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
  stats.dom.style.top = '4rem';
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

  const timeManager = new TimeManager(baseComponents.app);

  const animations: Animator[] = [];

  // Mutable state captured by the animation callback closure.
  let focusStartWorldPoint: Point = { x: 0, y: 0 };
  let focusTargetWorldPoint: Point = { x: 0, y: 0 };
  let focusPanDistance = 0;
  let currentPath: OptimalPath = { S: 1, u: () => 0, w: () => 1 };

  // The Animation<number> drives a normalised progress t ∈ [0, 1].
  // The ease function provides acceleration/deceleration on top of
  // the paper's arc-length parameterisation.
  // On each frame we map t → s = t × S, then sample the Van Wijk path.
  const focusAnimation = new Animation([
    { percentage: 0, value: 0 },
    { percentage: 1, value: 1 },
  ], (t: number) => {
    const s = t * currentPath.S;
    const u = currentPath.u(s);
    const w = currentPath.w(s);

    // Convert w back to zoom level: w = vpW / zoom  ⟹  zoom = vpW / w
    const vpW = baseComponents.camera.viewPortWidth;
    const zoom = vpW / w;

    // Convert 1-D pan parameter u back to 2-D world position.
    // u is the distance along the line from startPoint to targetPoint.
    const fraction = focusPanDistance > 1e-6 ? u / focusPanDistance : 0;
    const dx = focusTargetWorldPoint.x - focusStartWorldPoint.x;
    const dy = focusTargetWorldPoint.y - focusStartWorldPoint.y;
    const pos = {
      x: focusStartWorldPoint.x + dx * fraction,
      y: focusStartWorldPoint.y + dy * fraction,
    };

    cameraMux.notifyZoomInputAnimation(zoom);
    baseComponents.cameraRig.zoomTo(zoom);
    cameraMux.notifyPanToAnimationInput(pos);
    baseComponents.cameraRig.panToWorld(pos);
  }, new NumberAnimationHelper(), 1000);

  focusAnimation.easeFunction = (x: number): number => {
    return -(Math.cos(Math.PI * x) - 1) / 2;
  };

  const startFocusAnimation = (params: FocusAnimationParams): void => {
    const { startWorldPoint, targetWorldPoint, startZoom, targetZoom } = params;
    focusStartWorldPoint = startWorldPoint;
    focusTargetWorldPoint = targetWorldPoint;

    const vpW = baseComponents.camera.viewPortWidth;
    const w0 = vpW / startZoom;
    const w1 = vpW / targetZoom;

    const dx = targetWorldPoint.x - startWorldPoint.x;
    const dy = targetWorldPoint.y - startWorldPoint.y;
    focusPanDistance = Math.sqrt(dx * dx + dy * dy);

    currentPath = computeOptimalPath(focusPanDistance, w0, w1);

    cameraMux.initatePanTransition();
    cameraMux.initateZoomTransition();
    focusAnimation.start();
  };

  // --- Lock-on / follow train ---
  // After the focus animation completes, the pan state machine transitions to
  // LOCKED_ON_OBJECT. On each tick we feed the train's current position via
  // lockedOnObjectPanToInput, which keeps the camera centered on the moving
  // train while blocking normal user panning.
  let followPositionGetter: (() => Point | null) | null = null;

  const stopFollowing = (): void => {
    followPositionGetter = null;
    cameraMux.panStateMachine.happens('unlock');
  };

  const startFollowAnimation = (
    _params: FocusAnimationParams,
    getPosition: () => Point | null,
  ): void => {
    // If already following, stop first.
    if (followPositionGetter) {
      stopFollowing();
    }

    followPositionGetter = getPosition;

    // Directly lock onto the train — no transition animation.
    // Set camera to the train's current position and enter LOCKED_ON_OBJECT.
    const pos = getPosition();
    if (pos) {
      baseComponents.cameraRig.panToWorld(pos);
      baseComponents.cameraRig.zoomTo(_params.targetZoom);
      cameraMux.panStateMachine.happens('lockedOnObjectPanToInput', { target: pos });
    }
  };

  const isFollowing = (): boolean => followPositionGetter !== null;

  baseComponents.app.ticker.add((time: { deltaMS: number }) => {
    for (const animation of animations) {
      animation.animate(time.deltaMS);
    }
    focusAnimation.animate(time.deltaMS);

    // While locked on, continuously update camera to follow the train.
    if (followPositionGetter) {
      const pos = followPositionGetter();
      if (pos) {
        const res = cameraMux.panStateMachine.happens('lockedOnObjectPanToInput', { target: pos });
        if (res.handled) {
          baseComponents.cameraRig.panToWorld(pos);
        }
      }
    }
  });

  const curveEngine = new CurveCreationEngine(baseComponents.canvasProxy, baseComponents.camera);
  const layoutSubStateMachine = createLayoutStateMachine(curveEngine);
  const worldRenderSystem = new WorldRenderSystem();

  // Terrain: 10000x10000m grid centered on origin, 25m cell size, flat at ground level
  const terrainData = TerrainData.createFlat({
    originX: -5000,
    originY: -5000,
    cellsX: 400,
    cellsY: 400,
    cellSize: 25,
  });
  const terrainRenderSystem = new TerrainRenderSystem(
    worldRenderSystem,
    terrainData,
    { renderer: baseComponents.app.renderer },
  );

  const trackRenderSystem = new TrackRenderSystem(
    worldRenderSystem,
    curveEngine.trackGraph.trackCurveManager,
    curveEngine,
    baseComponents.camera,
    { renderer: baseComponents.app.renderer },
    terrainData,
  );
  const buildingManager = new BuildingManager();
  const buildingRenderSystem = new BuildingRenderSystem(worldRenderSystem, buildingManager);

  const stationManager = new StationManager();
  const stationRenderSystem = new StationRenderSystem(
    worldRenderSystem,
    stationManager,
    curveEngine.trackGraph,
    { renderer: baseComponents.app.renderer },
  );

  const trainManager = new TrainManager();
  const carStockManager = new CarStockManager();
  const formationManager = new FormationManager(carStockManager);
  const trackGraph = curveEngine.trackGraph;
  const jointDirectionManager = new DefaultJointDirectionManager(trackGraph);
  const trainPlacementEngine = new TrainPlacementEngine(baseComponents.canvasProxy, trackGraph, baseComponents.camera, {
    onPlaced: (placed) => {
      // Detach the formation from the manager — it's now owned by the placed train
      formationManager.detachFormation(placed.formation.id);
      trainManager.addTrain(placed);
      // Reset to default formation for next placement
      trainPlacementEngine.setFormation(null);
      toast.success('Train placed on the simulation map');
      return new Train(null, trackGraph, jointDirectionManager);
    },
  });
  const carImageRegistry = new CarImageRegistry();
  const trainRenderSystem = new TrainRenderSystem(
    worldRenderSystem,
    () => trainManager.getPlacedTrains(),
    () => trainPlacementEngine.train,
    trackGraph,
    trackRenderSystem,
    { renderer: baseComponents.app.renderer },
    carImageRegistry,
  );
  // const layoutStateMachine = createLayoutStateMachine(curveEngine);
  const trainStateMachine = new TrainPlacementStateMachine(trainPlacementEngine);
  const stationPlacementEngine = new StationPlacementEngine(
    baseComponents.canvasProxy,
    trackGraph,
    baseComponents.camera,
    stationManager,
    stationRenderSystem,
  );
  const stationStateMachine = new StationPlacementStateMachine(stationPlacementEngine);
  const debugOverlayRenderSystem = new DebugOverlayRenderSystem(
    worldRenderSystem,
    trackGraph,
    baseComponents.camera,
  );
  debugOverlayRenderSystem.setPlacedTrainsGetter(() => trainManager.getPlacedTrains());
  debugOverlayRenderSystem.setStationManager(stationManager);
  debugOverlayRenderSystem.setProximityDetector(trainRenderSystem.proximityDetector);

  // Share the proximity detector with the train manager for coupling queries
  trainManager.setProximityDetector(trainRenderSystem.proximityDetector);

  // Timetable: schedule clock starts at Monday 06:00
  const scheduleClock = new ScheduleClock(DayOfWeek.Monday, { hours: 6, minutes: 0, seconds: 0 });
  // Mutable ref so that the TimeManager callback always uses the current
  // timetable manager, even after deserialization replaces it.
  const timetableRef: { current: TimetableManager } = { current: null! };
  let timetableManager = new TimetableManager(
    scheduleClock,
    trackGraph,
    trainManager,
    stationManager,
  );
  timetableRef.current = timetableManager;

  // When a train is removed from the track, return its formation to the depot
  trainManager.setOnBeforeRemove((train) => {
    formationManager.addFormation(train.formation);
  });

  const kmtInputStateMachine = createKmtInputStateMachineExpansion(layoutSubStateMachine, trainStateMachine, stationStateMachine, baseComponents.observableInputTracker);
  baseComponents.kmtParser.stateMachine = kmtInputStateMachine;
  baseComponents.kmtInputStateMachine = kmtInputStateMachine;

  curveEngine.trackGraph.onSegmentSplit((info) => {
    for (const { train } of trainManager.getPlacedTrains()) {
      train.remapOnSegmentSplit(info);
    }
    trainPlacementEngine.train.remapOnSegmentSplit(info);
  });

  baseComponents.app.stage.addChild(worldRenderSystem.container);

  const unsubTimeManager = timeManager.subscribe((currentTime: number, deltaTime: number) => {
    // Timetable auto-drivers set throttle before physics update
    timetableRef.current.update(currentTime, deltaTime);
    trainRenderSystem.update(deltaTime);
    debugOverlayRenderSystem.updateFormationLabels();
    debugOverlayRenderSystem.updateProximityLines();
  });

  const unsubTrainChanges = trainManager.subscribeToChanges(() => {
    trainRenderSystem.forceSync();
  });

  baseComponents.cleanups.push(() => {
    unsubTimeManager();
    unsubTrainChanges();
    timeManager.dispose();
    timetableRef.current.dispose();
  });

  const cameraMux = createCameraMuxWithAnimationAndLock();
  baseComponents.inputOrchestrator.cameraMux = cameraMux;

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

  const spawnParallelTracksWithTrains = (count: number): number => {
    const segmentIds = generateParallelTracks(trackGraph, { count, length: 500 });
    let placed = 0;
    for (const segId of segmentIds) {
      if (addTrainAtPosition(segId, 0.5, 'tangent')) placed += 1;
    }
    trainRenderSystem.forceSync();
    return placed;
  };

  return {
    ...baseComponents,
    curveEngine,
    worldRenderSystem,
    terrainData,
    terrainRenderSystem,
    trackRenderSystem,
    trainRenderSystem,
    buildingManager,
    buildingRenderSystem,
    trainPlacementEngine,
    trainManager,
    carStockManager,
    formationManager,
    jointDirectionManager,
    cameraMux,
    startFocusAnimation,
    startFollowAnimation,
    stopFollowing,
    isFollowing,
    layoutStateMachine: layoutSubStateMachine,
    kmtStateMachineExpansion: kmtInputStateMachine,
    trainStateMachine,
    debugOverlayRenderSystem,
    carImageRegistry,
    timeManager,
    scheduleClock,
    timetableManager,
    timetableRef,
    stationManager,
    stationRenderSystem,
    statsDom: stats.dom,
    addTrainAtPosition,
    addStressTestTrains,
    generateProceduralTracks,
    spawnParallelTracksWithTrains,
    animations,
  };
};
