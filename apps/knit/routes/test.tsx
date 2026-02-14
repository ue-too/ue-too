import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { Scroller } from '@/components';
import { ScrollerWithTranslate } from '@/components/scroller/Scroller';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/test')({
    component: TestComponent,
});

type ScrollerType = 'translate' | 'scroll';

const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
] as const;

type Month = (typeof MONTHS)[number];

function TestComponent() {
    const [scrollerType, setScrollerType] = useState<ScrollerType>('translate');

    return (
        <>
            <div className="flex w-full items-center justify-center gap-4">
                {scrollerType === 'scroll' && <Scroller />}
                {scrollerType === 'translate' && (
                    <ScrollerWithTranslate value={MONTHS[0]} options={MONTHS} />
                )}
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
