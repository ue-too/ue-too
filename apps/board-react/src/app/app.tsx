// Uncomment this line to use CSS modules
// import styles from './app.module.css';
import NxWelcome from './nx-welcome';
import { Route, Routes, Link } from 'react-router-dom';
import { useBoardCameraState, useCameraInput } from '@ue-too/board-react-adapter';
import  {Board} from '@ue-too/board-react-adapter/components';

function PositionDisplay() {

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

export function App() {
  return (
    <div>
      <Board width={300} height={300} animationCallback={(timestamp, context)=>{
        context.beginPath();
        context.rect(0, 0, 100, 100);
        context.fill();
      }}>
        <PositionDisplay />
      </Board>
      <Board width={300} height={300} animationCallback={(timestamp, context)=>{
        context.fillStyle = 'red';
        context.beginPath();
        context.rect(0, 0, 100, 100);
        context.fill();
      }}/>
    </div>
  );
}

export default App;
