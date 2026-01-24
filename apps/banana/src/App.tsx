import './App.css';
import { Wrapper } from './PixiCanvas';

/**
 * Main React App Component
 * Integrates PixiJS canvas with React
 * @returns {JSX.Element} The root React component
 */
const App = (): React.ReactNode => {
  return (
    <div className="app">
      <Wrapper />
    </div>
  );
}

export default App;
