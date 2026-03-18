import {
    ScrollBarDisplay,
    Wrapper,
} from '@ue-too/board-pixi-react-integration';

import { BananaToolbar } from '@/components/toolbar';
import { TimeDisplay } from '@/components/toolbar/TimeDisplay';
import { initApp } from '@/utils/init-app';

import './App.css';

const App = (): React.ReactNode => {
    return (
        <div className="app">
            <Wrapper
                option={{
                    fullScreen: true,
                    boundaries: {
                        min: { x: -5000, y: -5000 },
                        max: { x: 5000, y: 5000 },
                    },
                }}
                initFunction={initApp}
            >
                <ScrollBarDisplay />
                <BananaToolbar />
                <TimeDisplay />
            </Wrapper>
        </div>
    );
};

export default App;
