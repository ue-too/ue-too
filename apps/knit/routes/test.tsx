import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { Scroller } from '@/components';
import { ScrollerWithTranslate } from '@/components/scroller/Scroller';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/test')({
    component: TestComponent,
});

type ScrollerType = 'translate' | 'scroll';

function TestComponent() {
    const [scrollerType, setScrollerType] = useState<ScrollerType>('scroll');

    return (
        <>
            <div className="flex w-full items-center justify-center gap-4">
                {scrollerType === 'scroll' && <Scroller />}
                {scrollerType === 'translate' && <ScrollerWithTranslate />}
            </div>
            <div className="flex justify-center">
                <Button
                    onClick={() =>
                        setScrollerType(prev =>
                            prev === 'scroll' ? 'translate' : 'scroll'
                        )
                    }
                >
                    {scrollerType === 'scroll' ? 'Translate' : 'Scroll'}
                </Button>
            </div>
        </>
    );
}
