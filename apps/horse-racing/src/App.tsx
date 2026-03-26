import {
    ScrollBarDisplay,
    Wrapper,
} from '@ue-too/board-pixi-react-integration';

import { HorseRacingToolbar } from '@/components/toolbar/HorseRacingToolbar';
import { initApp } from '@/utils/init-app';

const App = (): React.ReactNode => {
    return (
        <div className="app">
            <Wrapper
                option={{
                    fullScreen: true,
                    boundaries: {
                        min: { x: -4000, y: -4000 },
                        max: { x: 4000, y: 4000 },
                    },
                }}
                initFunction={initApp}
            >
                <ScrollBarDisplay />
                <HorseRacingToolbar />
            </Wrapper>
        </div>
    );
};

export default App;
