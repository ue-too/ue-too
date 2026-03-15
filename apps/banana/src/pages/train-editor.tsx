import {
    InitAppOptions,
    baseInitApp,
} from '@ue-too/board-pixi-integration';
import {
    ScrollBarDisplay,
    Wrapper,
} from '@ue-too/board-pixi-react-integration';

import '@/App.css';
import { BogieEditorEngine } from '@/train-editor/bogie-editor-engine';
import { BogieEditorRenderSystem } from '@/train-editor/bogie-editor-render-system';
import { ImageEditorEngine } from '@/train-editor/image-editor-engine';
import { ImageRenderSystem } from '@/train-editor/image-render-system';
import { createBogieEditStateMachine } from '@/train-editor/bogie-kmt-state-machine';
import { createBogieAddStateMachine } from '@/train-editor/bogie-add-state-machine';
import { createImageEditStateMachine } from '@/train-editor/image-edit-state-machine';
import { createTrainEditorToolSwitcher } from '@/train-editor/train-editor-tool-switcher';
import { createTrainEditorKmtExtension } from '@/train-editor/train-editor-kmt-extension';
import { TrainEditorToolbar } from '@/train-editor/train-editor-toolbar';
import type { TrainEditorComponents } from '@/train-editor/types';

const initTrainEditor = async (
    canvas: HTMLCanvasElement,
    option: Partial<InitAppOptions>
): Promise<TrainEditorComponents> => {
    const components = await baseInitApp(canvas, option);

    // Bogie editor
    const bogieEditorEngine = new BogieEditorEngine(
        components.camera,
        components.canvasProxy
    );
    const bogieEditorRenderSystem = new BogieEditorRenderSystem(
        bogieEditorEngine,
        components.camera
    );

    // Image editor
    const imageEditorEngine = new ImageEditorEngine(
        components.camera,
        components.canvasProxy
    );
    const imageRenderSystem = new ImageRenderSystem(imageEditorEngine, components.camera);

    // State machines
    const bogieEditStateMachine = createBogieEditStateMachine(bogieEditorEngine);
    const bogieAddStateMachine = createBogieAddStateMachine(bogieEditorEngine);
    const imageEditStateMachine = createImageEditStateMachine({
        imageEngine: imageEditorEngine,
        setup: () => {},
        cleanup: () => {},
    });

    const toolSwitcher = createTrainEditorToolSwitcher(
        bogieEditStateMachine,
        bogieAddStateMachine,
        imageEditStateMachine
    );

    const trainEditorKmtStateMachine = createTrainEditorKmtExtension(
        toolSwitcher,
        components.observableInputTracker
    );

    // Replace the default KMT state machine with our extended one
    components.kmtParser.stateMachine = trainEditorKmtStateMachine;

    // Add render systems to stage
    components.app.stage.addChild(imageRenderSystem.container);
    components.app.stage.addChild(bogieEditorRenderSystem.container);

    // Setup
    imageRenderSystem.setup();
    bogieEditorRenderSystem.setup();

    // Cleanup
    components.cleanups.push(() => {
        bogieEditorRenderSystem.cleanup();
        components.app.stage.removeChild(bogieEditorRenderSystem.container);
        bogieEditorRenderSystem.container.destroy({ children: true });

        imageRenderSystem.cleanup();
        components.app.stage.removeChild(imageRenderSystem.container);
        imageRenderSystem.container.destroy({ children: true });
    });

    return {
        ...components,
        bogieEditorEngine,
        bogieEditorRenderSystem,
        imageEditorEngine,
        imageRenderSystem,
        trainEditorKmtStateMachine,
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
                initFunction={initTrainEditor as any}
            >
                <ScrollBarDisplay />
                <TrainEditorToolbar />
            </Wrapper>
        </div>
    );
};

export { TrainEditor };
