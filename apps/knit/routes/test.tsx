import { createFileRoute } from '@tanstack/react-router';

import { Scroller } from '@/components';

export const Route = createFileRoute('/test')({
    component: TestComponent,
});

function TestComponent() {
    return (
        <div className="flex h-full w-full items-center justify-center">
            <Scroller />
        </div>
    );
}
