import {
    BaseAppComponents,
    InitAppOptions,
    baseInitApp,
} from '@ue-too/board-pixi-integration';
import {
    ScrollBarDisplay,
    Wrapper,
} from '@ue-too/board-pixi-react-integration';
import { Container } from 'pixi.js';

import '@/App.css';
import { BogieEditorEngine } from '@/train-editor/bogie-editor-engine';
import { BogieEditorRenderSystem } from '@/train-editor/bogie-editor-render-system';

type TrainEditorComponents = BaseAppComponents & {
    bogieEditorEngine: BogieEditorEngine;
    bogieEditorRenderSystem: BogieEditorRenderSystem;
};

const initTrainEditor = async (
    canvas: HTMLCanvasElement,
    option: Partial<InitAppOptions>
): Promise<TrainEditorComponents> => {
    const components = await baseInitApp(canvas, option);

    const bogieEditorEngine = new BogieEditorEngine(
        components.camera,
        components.canvasProxy
    );
    const bogieEditorRenderSystem = new BogieEditorRenderSystem(
        bogieEditorEngine
    );

    components.app.stage.addChild(bogieEditorRenderSystem.container);
    bogieEditorRenderSystem.setup();

    components.cleanups.push(() => {
        bogieEditorRenderSystem.cleanup();
        components.app.stage.removeChild(bogieEditorRenderSystem.container);
        bogieEditorRenderSystem.container.destroy({ children: true });
    });

    return {
        ...components,
        bogieEditorEngine,
        bogieEditorRenderSystem,
    };
};

const TrainEditor = (): React.ReactNode => {
    return (
        <div className="app">
            <Wrapper
                option={{
                    fullScreen: true,
                    boundaries: {
                        min: { x: -1000, y: -1000 },
                        max: { x: 1000, y: 1000 },
                    },
                }}
                initFunction={initTrainEditor}
            >
                <ScrollBarDisplay />
            </Wrapper>
        </div>
    );
};

export { TrainEditor };
