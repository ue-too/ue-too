import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/canvas-editor/')({
    component: CanvasEditorComponent,
});

function CanvasEditorComponent() {
    return (
        <div>
            <h1>Canvas Editor</h1>
        </div>
    );
}
