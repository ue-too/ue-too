import { createContext, useContext, useRef, useState, useSyncExternalStore } from 'react';
import { Application, Renderer } from 'pixi.js';
import { useAllBoardCameraState, useInitializePixiApp } from './pixi-canvas/usePixiCanvas';
import { PixiAppComponents } from './pixi-based/init-app';
import { CameraState } from '@ue-too/board';

type StateToEventKey<K extends keyof CameraState> =
    K extends "position" ? "pan" : K extends "zoomLevel" ? "zoom" : "rotate";


/**
 * PixiCanvas Component
 * Integrates PixiJS with React, setting up the canvas, camera, and input handling
 * @returns {JSX.Element} Canvas element for PixiJS rendering
 */
export const PixiCanvas = (): React.ReactNode => {

  console.log('PixiCanvas');
  const {canvasRef} = useInitializePixiApp();

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


export const Wrapper = () => {

  const [result, setResult] = useState<PixiCanvasResult>({initialized: false});

  return (
    <PixiCanvasContext.Provider value={{setResult, result}}>
      <PixiCanvas />
      <div style={{position: 'absolute', top: 0, left: 0}}>
        <TestDiv />
        <PositionDisplay />
        <RotationDisplay />
        <ZoomLevelDisplay />
      </div>
    </PixiCanvasContext.Provider>
  )
};

export const TestDiv = () => {

  const {width, height} = useCanvasSize();

  return (
    <div>Test {width} {height}</div>
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
