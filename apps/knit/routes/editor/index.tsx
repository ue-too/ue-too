import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/editor/')({
    component: EditorComponent,
});

function EditorComponent() {
    return (
        <div>
            <h1>Editor</h1>
        </div>
    );
}
