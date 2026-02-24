import { baseInitApp } from '@ue-too/board-pixi-integration';
import {
    ScrollBarDisplay,
    Wrapper,
} from '@ue-too/board-pixi-react-integration';

import './App.css';

/**
 * Main React App Component
 * Integrates PixiJS canvas with React
 * @returns {JSX.Element} The root React component
 */
const App = (): React.ReactNode => {
    return (
        <div className="app">
            <Wrapper option={{ fullScreen: true }} initFunction={baseInitApp}>
                <ScrollBarDisplay />
            </Wrapper>
        </div>
    );
};

export default App;
