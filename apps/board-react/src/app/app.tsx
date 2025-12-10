// Uncomment this line to use CSS modules
// import styles from './app.module.css';
import NxWelcome from './nx-welcome';
import Board from '../components/Board';
import { Route, Routes, Link } from 'react-router-dom';

export function App() {
  return (
    <div>
      <Board width={300} height={300} animationCallback={(timestamp, context)=>{
        context.beginPath();
        context.rect(0, 0, 100, 100);
        context.fill();
      }}/>
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
