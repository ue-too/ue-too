import { createFileRoute } from '@tanstack/react-router';
import { Wrapper } from '@ue-too/board-pixi-react-integration';

import { initApp } from '@/utils/init-app';

export const Route = createFileRoute('/canvas-editor/')({
    component: CanvasEditorComponent,
});

function CanvasEditorComponent() {
    return (
        <Wrapper option={{ fullScreen: true }} initFunction={initApp}>
            <h1>Canvas Editor</h1>
        </Wrapper>
    );
}
