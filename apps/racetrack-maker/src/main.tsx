import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import {Home} from "./pages/Home";
import RaceTrackBuilder from './pages/RaceTrackBuilder';

const Index = () => {
  return (
      <Router>
         <Routes>
              <Route path="/racetrack-maker/" element={<Home/>}/>
              <Route path="/racetrack-maker/builder" element={<RaceTrackBuilder/>}/>
          </Routes> 
      </Router>
  ); 
};

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(<Index/>);
