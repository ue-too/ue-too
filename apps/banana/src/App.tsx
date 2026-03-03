import {
    ScrollBarDisplay,
    Wrapper,
} from '@ue-too/board-pixi-react-integration';

import { BananaToolbar } from '@/components/toolbar';
import { initApp } from '@/utils/init-app';

import './App.css';

const App = (): React.ReactNode => {
    return (
        <div className="app">
            <Wrapper option={{ fullScreen: true }} initFunction={initApp}>
                <ScrollBarDisplay />
                <BananaToolbar />
            </Wrapper>
        </div>
    );
};

export default App;
