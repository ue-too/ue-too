import { createFileRoute } from '@tanstack/react-router';

import { DemoLexicalEditor } from '@/components/DemoLexicalEditor';

export const Route = createFileRoute('/editor/demo')({
    component: EditorDemoComponent,
});

function EditorDemoComponent() {
    return (
        <div className="space-y-4 p-4">
            <h1 className="text-xl font-semibold">
                Lexical editor (playground-style)
            </h1>
            <p className="text-neutral-600">
                Rich text with lists, links, code blocks. Toolbar uses shadcn
                components.
            </p>
            <DemoLexicalEditor />
        </div>
    );
}
