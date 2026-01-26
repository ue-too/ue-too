import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { FederatedPointerEvent, Point, Ticker } from 'pixi.js';
import { useAllBoardCameraState, useInitializePixiApp } from './pixi-canvas/usePixiCanvas';
import { PixiAppComponents } from './pixi-based/init-app';
import { CameraState, getScrollBar, translationHeightOf, translationWidthOf } from '@ue-too/board';
import { convertFromCanvas2ViewPort, convertFromViewport2World, convertFromWindow2Canvas } from '@ue-too/board/utils/coordinate-conversions/';
import { PixiGrid } from './knit-grid/grid-pixi';
import { Grid } from './knit-grid/grid';

type StateToEventKey<K extends keyof CameraState> =
    K extends "position" ? "pan" : K extends "zoomLevel" ? "zoom" : "rotate";


/**
 * PixiCanvas Component
 * Integrates PixiJS with React, setting up the canvas, camera, and input handling
 * @returns {JSX.Element} Canvas element for PixiJS rendering
 */
export const PixiCanvas = (option: { fullScreen: boolean} = { fullScreen: true}): React.ReactNode => {

  const {canvasRef} = useInitializePixiApp(option);
  useGrid();

  useAppPointerDown(useCoordinateConversion());

  return (
    <canvas
      ref={canvasRef}
      id="graph"
    />
  );
}

type PixiCanvasContextType = {
  setResult: (result: PixiCanvasResult) => void;
  result: PixiCanvasResult;
}

type PixiCanvasUninitializedResult = {
  initialized: false;
}

type PixiCanvasInitializeFailedResult = {
  initialized: true;
  success: false;
}

type PixiCanvasInitializeSuccessResult = {
  initialized: true;
  success: true;
  components: PixiAppComponents;
}

type PixiCanvasResult = PixiCanvasUninitializedResult | PixiCanvasInitializeFailedResult | PixiCanvasInitializeSuccessResult;

const PixiCanvasContext = createContext<PixiCanvasContextType>({setResult: () => {}, result: {initialized: false}});

export const usePixiCanvas = () => {
  const context = useContext(PixiCanvasContext);
  if(context == null){
    throw new Error('PixiCanvasContext not found, make sure you are using PixiCanvasProvider to wrap your component');
  }
  return context;
};

export const useCanvasSize = () => {
  const {result} = usePixiCanvas();
  const cachedSizeRef = useRef<{width: number, height: number}>({width: 0, height: 0});

  return useSyncExternalStore((cb) => {
    if(result.initialized == false || result.success == false || result.components.app.renderer == null){
      return () => {};
    }
    result.components.app.renderer.on('resize', cb)
    return () => {
      result.components.app.renderer.off('resize', cb);
    }
  }, ()=> {
    if(result.initialized == false || result.success == false || result.components.app.renderer == null) {
      if(cachedSizeRef.current.width === 0 && cachedSizeRef.current.height === 0){
        return cachedSizeRef.current;
      }
      cachedSizeRef.current = {width: 0, height: 0};
      return cachedSizeRef.current;
    }

    const currentSize = {width: result.components.app.renderer.width, height: result.components.app.renderer.height};
    if(currentSize.width === cachedSizeRef.current.width && currentSize.height === cachedSizeRef.current.height){
      return cachedSizeRef.current;
    }
    cachedSizeRef.current = currentSize;
    return currentSize;
  })
}


const OverlayContainer = ({ children }: { children: React.ReactNode }) => {
  const {width, height} = useCanvasSize();
  
  return (
    <div style={{position: 'absolute', top: 0, left: 0, width, height, pointerEvents: 'none'}}>
      {children}
    </div>
  );
};

export const Wrapper = (option: { fullScreen: boolean} = { fullScreen: true}) => {

  const [result, setResult] = useState<PixiCanvasResult>({initialized: false});

  return (
    <div style={{position: 'relative'}}>
      <PixiCanvasContext.Provider value={{setResult, result}}>
        <PixiCanvas fullScreen={option.fullScreen} />
        <OverlayContainer>
          <TestDiv />
          <PositionDisplay />
          <RotationDisplay />
          <ZoomLevelDisplay />
          <ScrollBarDisplay />
        </OverlayContainer>
      </PixiCanvasContext.Provider>
    </div>
  )
};

export const ScrollBarDisplay = () => {

const scrollBar = useViewportScrollBar();
    const initialHorizontalPositionRef = useRef<number>(0);
    const isHorizontalPointerDownRef = useRef<boolean>(false);

    const initialVerticalPositionRef = useRef<number>(0);
    const isVerticalPointerDownRef = useRef<boolean>(false);

    const {result} = usePixiCanvas();

    const horizontalPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        initialHorizontalPositionRef.current = event.clientX;
        isHorizontalPointerDownRef.current = true;
    }

    const horizontalPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        if(result.initialized == false || result.success == false || result.components.app.renderer == null || isHorizontalPointerDownRef.current == false){
            initialHorizontalPositionRef.current = 0;
            return;
        }
        const delta = {x: event.clientX - initialHorizontalPositionRef.current, y: 0};
        initialHorizontalPositionRef.current = event.clientX;
        const viewportDelta = convertFromWindow2Canvas(delta, result.components.canvasProxy);

        const percentage = viewportDelta.x / result.components.camera.viewPortWidth;

        const worldDelta = {x: percentage * (translationWidthOf(result.components.camera.boundaries) ?? 0), y: 0};

        result.components.cameraRig.panByWorld(worldDelta);
    }, [result]);

    const horizontalPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        isHorizontalPointerDownRef.current = false;
    };

    const verticalPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        initialVerticalPositionRef.current = event.clientY;
        isVerticalPointerDownRef.current = true;
    }


    const verticalPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        if(result.initialized == false || result.success == false || result.components.app.renderer == null || isVerticalPointerDownRef.current == false){
            initialVerticalPositionRef.current = 0;
            return;
        }
        const delta = {x: 0, y: event.clientY - initialVerticalPositionRef.current};
        initialVerticalPositionRef.current = event.clientY;
        const viewportDelta = convertFromWindow2Canvas(delta, result.components.canvasProxy);

        const percentage = viewportDelta.y / result.components.camera.viewPortHeight;

        const worldDelta = {x: 0, y: percentage * (translationHeightOf(result.components.camera.boundaries) ?? 0)};

        result.components.cameraRig.panByWorld(worldDelta);
    }, [result]);

    const verticalPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        isVerticalPointerDownRef.current = false;
    };

    return (
        <>
            {/* Horizontal scroll bar */}
            <div
            className="pointer-events-auto"
            style={{
                width: scrollBar.horizontalLength ?? 0,
                height: 10,
                left: scrollBar.horizontal ?? 0,
                bottom: 0,
                backgroundColor: 'red',
                position: 'absolute',
            }} 
            onPointerDown={horizontalPointerDown} 
            onPointerMove={horizontalPointerMove} 
            onPointerUp={horizontalPointerUp} />
            {/* Vertical scroll bar */}
            <div 
            className="pointer-events-auto" 
            style={{
                width: 10,
                height: scrollBar.verticalLength ?? 0,
                right: 0,
                top: scrollBar.vertical ?? 0,
                backgroundColor: 'blue',
                position: 'absolute',
                pointerEvents: 'auto',
            }} 
            onPointerDown={verticalPointerDown} 
            onPointerMove={verticalPointerMove} 
            onPointerUp={verticalPointerUp} />
        </>
    )
}

export const TestDiv = () => {

  const {width, height} = useCanvasSize();

  return (
    <>
      <div>Canvas Size: width: {width}, height: {height}</div>
    </>
  )
};

export const PositionDisplay = () => {
  const position = useBoardCameraState("position");

  return (
    <div>PositionDisplay {position.x} {position.y}</div>
  )
}

export const RotationDisplay = () => {
  const rotation = useBoardCameraState("rotation");

  return (
    <div>RotationDisplay {rotation}</div>
  )
}

export const ZoomLevelDisplay = () => {
  const zoomLevel = useBoardCameraState("zoomLevel");

  return (
    <div>ZoomLevelDisplay {zoomLevel}</div>
  )
}

const grid = new Grid(10, 10);
const pixiGrid = new PixiGrid(grid);

export const useGrid = () => {
    const {result} = usePixiCanvas();

    useEffect(()=>{
        if(result.initialized == false || result.success == false || result.components.app == null){
            return;
        }
        result.components.app.stage.addChild(pixiGrid);
        return () => {
            result.components.app.stage.removeChild(pixiGrid);
        }
    }, [result]);
}

export const useCoordinateConversion = () => {

    const {result} = usePixiCanvas();
    return useCallback((event: PointerEvent) => {
        event.preventDefault();
        const point = {x: event.clientX, y: event.clientY};
        console.log('point', point);
        if(result.initialized == false || result.success == false || result.components.camera == null){
            return {x: 0, y: 0};
        }

        const canvasPoint = convertFromWindow2Canvas(point, result.components.canvasProxy);
        const viewportPoint = convertFromCanvas2ViewPort(canvasPoint, {x: result.components.canvasProxy.width / 2, y: result.components.canvasProxy.height / 2}, false); 
        const worldPoint = convertFromViewport2World(viewportPoint, result.components.camera.position, result.components.camera.zoomLevel, result.components.camera.rotation, false);

        const cell = grid.getCell(worldPoint);
        if(cell == null){
            return {row: -1, column: -1, cell: null};
        }
        console.log()
        console.log('cell', cell);
        return cell;
    }, [result]);
}

export const useBoardCameraState = <K extends keyof CameraState>(state: K): CameraState[K] => {
  const {result} = usePixiCanvas();
  const stateKey = (state === "position" ? "pan" : state === "zoomLevel" ? "zoom" : "rotate") as StateToEventKey<K>;

  const cachedPositionRef = useRef<{ x: number; y: number }>({x: 0, y: 0});
  const cachedRotationRef = useRef<number>(0);
  const cachedZoomLevelRef = useRef<number>(1);

  return useSyncExternalStore(
      (cb) => { if(result.initialized == false || result.success == false || result.components.camera == null){ return () => {}; } return result.components.camera.on(stateKey, cb); },
      () => {
        // For position (object), we need to cache to avoid creating new objects
          if (state === "position") {
              if(result.initialized == false || result.success == false || result.components.camera == null){
                if(cachedPositionRef.current.x === 0 && cachedPositionRef.current.y === 0){
                  return cachedPositionRef.current as CameraState[K];
                }
                cachedPositionRef.current = {x: 0, y: 0};
                return cachedPositionRef.current as CameraState[K];
              }
              const currentPosition = result.components.camera.position;
              const cached = cachedPositionRef.current;
              
              if (cached && cached.x === currentPosition.x && cached.y === currentPosition.y) {
                  // Return cached snapshot to maintain referential equality
                  return cached as CameraState[K];
              }
              
              // Cache the new position object
              const newPosition = {...currentPosition};
              cachedPositionRef.current = newPosition;
              return cachedPositionRef.current as CameraState[K];
          } else if(state === "rotation"){
            if(result.initialized == false || result.success == false || result.components.camera == null){
              if(cachedRotationRef.current === 0){
                return cachedRotationRef.current as CameraState[K];
              }
              cachedRotationRef.current = 0;
              return cachedRotationRef.current as CameraState[K];
            }
            cachedRotationRef.current = result.components.camera.rotation;
            return cachedRotationRef.current as CameraState[K];
          } else {
            if(result.initialized == false || result.success == false || result.components.camera == null){
              if(cachedZoomLevelRef.current === 1){
                return cachedZoomLevelRef.current as CameraState[K];
              }
              cachedZoomLevelRef.current = 1;
              return cachedZoomLevelRef.current as CameraState[K];
            }
            cachedZoomLevelRef.current = result.components.camera.zoomLevel;
            return cachedZoomLevelRef.current as CameraState[K];

          }
      },
  );
}

export const useAppTicker = (callback: (time: Ticker) => void, enabled: boolean = true) => {

  const {result} = usePixiCanvas();

  useEffect(()=>{
    if(result.initialized == false || result.success == false || result.components.app == null || !enabled){
      return;
    }

    result.components.app.ticker.add(callback);

    return () => {
      result.components.app.ticker.remove(callback);
    }
  }, [result, callback, enabled]);
}

export const useAppPointerDown = (callback: (event: PointerEvent) => void) => {
    const {result} = usePixiCanvas();

    useEffect(()=>{
        if(result.initialized == false || result.success == false || result.components.app == null){
            return;
        }
        result.components.app.canvas.addEventListener('pointerdown', callback);
        return () => {
            result.components.app.canvas.removeEventListener('pointerdown', callback);
        }
    }, [result, callback]);
};

export const useViewportScrollBar = () => {
  const {result} = usePixiCanvas();

  const cameraState = useAllBoardCameraState();

  const res = useMemo(()=>{
    if(result.initialized == false || result.success == false || result.components.camera == null){
      return {horizontalLength: undefined, verticalLength: undefined, horizontal: undefined, vertical: undefined};
    }
    return getScrollBar(result.components.camera);
  }, [result, cameraState]);

  return res;
}
