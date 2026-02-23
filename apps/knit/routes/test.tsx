import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { Scroller } from '@/components';
import Alt from '@/components/scroller/Alt';
import TranslateScroller from '@/components/scroller/TranslateScroller';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/test')({
    component: TestComponent,
});

type ScrollerType = 'translate' | 'scroll';

const MONTHS = [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
    '12',
    '13',
    '14',
    '15',
    '16',
    '17',
    '18',
    '19',
    '20',
    '21',
    '22',
    '23',
    '24',
    '25',
    '26',
    '27',
    '28',
    '29',
    '30',
    '31',
] as const;

const DAYS = [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
    '12',
    '13',
    '14',
    '15',
    '16',
    '17',
    '18',
    '19',
    '20',
    '21',
    '22',
    '23',
    '24',
    '25',
    '26',
    '27',
    '28',
    '29',
    '30',
    '31',
] as const;

const twoNineDays = DAYS.slice(0, 29);

type Month = (typeof MONTHS)[number];
type Day = (typeof DAYS)[number];

function TestComponent() {
    const [scrollerType, setScrollerType] = useState<ScrollerType>('translate');

    const [selectedMonth, setSelectedMonth] = useState<Day>(DAYS[0]);

    const [days, setDays] = useState<readonly Day[]>(DAYS);

    console.log('selectedMonth', selectedMonth);

    return (
        <>
            <div className="flex w-full items-center justify-center gap-4">
                {scrollerType === 'scroll' && <Scroller />}
                {scrollerType === 'translate' && (
                    <Alt
                        value={selectedMonth}
                        options={days}
                        onSelect={setSelectedMonth}
                    />
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
                <Button onClick={() => setDays(twoNineDays)}>
                    Switch to 29 days
                </Button>
                <Button onClick={() => setDays(DAYS)}>Switch to 31 days</Button>
            </div>
        </>
    );
}
