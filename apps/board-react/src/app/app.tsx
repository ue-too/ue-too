// Uncomment this line to use CSS modules
// import styles from './app.module.css';
import NxWelcome from './nx-welcome';
import { Route, Routes, Link } from 'react-router-dom';
import { BoardProvider, useAnimationFrameWithBoard, useBoard, useBoardCameraState, useCameraInput, useCanvasDimension, useCanvasProxyWithRef } from '@ue-too/board-react-adapter';
import  {Board} from '@ue-too/board-react-adapter/components';
import { PixiCanvas } from './pixi-canvas';
import { useEffect } from 'react';

function PositionDisplay() {

  console.log('PositionDisplay');

  const position = useBoardCameraState("position");

  const cameraInput = useCameraInput();

  return (
    <div>
      <div>position: {position.x}, {position.y}</div>
      <button onClick={()=>{
        cameraInput.zoomBy(0.5);
      }}>
        reset position
      </button>

    </div>
  );

}

function CanvasDimensionDisplay() {

  console.log('CanvasDimensionDisplay');

  const canvasDimension = useCanvasDimension();
  return (
    <div>
      <div>canvasDimension: {canvasDimension.width.toFixed(0)}, {canvasDimension.height.toFixed(0)}</div>
    </div>
  );
}

function BoardCanvas() {

  const board = useBoard();

  useAnimationFrameWithBoard((timestamp, context)=>{
    board.step(timestamp);
    context.fillStyle = 'red';
    context.fillRect(0, 0, 100, 100);
  });

  // useEffect(()=>{
  //   board.fullScreen = true;
  // }, [board]);

  return (
    <div style={{width: '100%'}}>
      <canvas style={{ width: '100%', aspectRatio: '1/1'}} ref={
        (ref) => {
          if(ref == null){
            board.tearDown();
            return;
          }
          board.attach(ref);
        }
      } ></canvas>

    </div>
  );
}

export function App() {
  return (
    <>
      <BoardProvider>
        <BoardCanvas />
      </BoardProvider>
      <canvas style={{width: '100%',}}></canvas>
      {/* <div style={{width: '300px', height: '200px', position: 'relative', borderWidth: '50px 20px', borderStyle: 'solid', borderColor: 'black', boxSizing: 'border-box'}}>
        <div style={{ width: `${200 * 3 / 5}px`, height: `${200 * 3 / 5}px`, position: 'absolute', backgroundColor: 'red', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', borderRadius: '50%' }}>

        </div>

      </div> */}
      {/* <Board width={300} height={300} animationCallback={(timestamp, context)=>{
        context.fillStyle = 'red';
        context.beginPath();
        context.rect(0, 0, 100, 100);
        context.fill();
      }}/> */}
      {/* <PixiCanvas /> */}
    </>
  );
}

export default App;
