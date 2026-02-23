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

const thirtyDays = DAYS.slice(0, 30);

const twoNineDays = DAYS.slice(0, 29);

type Month = (typeof MONTHS)[number];
type Day = (typeof DAYS)[number];

function TestComponent() {
    const [scrollerType, setScrollerType] = useState<ScrollerType>('translate');

    const [selectedMonth, setSelectedMonth] = useState<Day>(DAYS[0]);

    const [days, setDays] = useState<readonly Day[]>(DAYS);

    const [index, setIndex] = useState(0);
    const [monthIndex, setMonthIndex] = useState(0);

    const [daysLength, setDaysLength] = useState(days.length);

    // Derive so when days shrinks and selected is out of range we show the clamped value immediately (no one-frame lag)
    if (daysLength !== days.length) {
        if (index > days.length - 1) {
            setIndex(days.length - 1);
        }
        setDaysLength(days.length);
    }

    console.log('selectedMonth', MONTHS[monthIndex]);
    console.log('selectedDay', days[index]);

    return (
        <>
            <div className="flex w-full items-center justify-center gap-4">
                {scrollerType === 'scroll' && <Scroller />}
                {scrollerType === 'translate' && (
                    <Alt
                        index={monthIndex}
                        setIndex={setMonthIndex}
                        options={MONTHS}
                        visibleCount={5}
                    />
                )}
                <Alt
                    index={index}
                    setIndex={setIndex}
                    options={days}
                    visibleCount={5}
                />
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
                <Button onClick={() => setDays(thirtyDays)}>
                    Switch to 30 days
                </Button>
                <Button
                    onClick={() =>
                        console.log('submitting with day', days[index])
                    }
                >
                    Submit
                </Button>
            </div>
        </>
    );
}
