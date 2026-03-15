import type { BaseAppComponents } from '@ue-too/board-pixi-integration';
import type { BogieEditorEngine } from './bogie-editor-engine';
import type { BogieEditorRenderSystem } from './bogie-editor-render-system';
import type { ImageEditorEngine } from './image-editor-engine';
import type { ImageRenderSystem } from './image-render-system';
import type { TrainEditorKmtStateMachine } from './train-editor-kmt-extension';

export type TrainEditorComponents = BaseAppComponents & {
    bogieEditorEngine: BogieEditorEngine;
    bogieEditorRenderSystem: BogieEditorRenderSystem;
    imageEditorEngine: ImageEditorEngine;
    imageRenderSystem: ImageRenderSystem;
    trainEditorKmtStateMachine: TrainEditorKmtStateMachine;
};
