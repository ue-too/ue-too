import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { throttle } from 'throttle-debounce';

import { Scroller } from '@/components';
import Alt from '@/components/scroller/Alt';
import { normalizeIndex } from '@/components/scroller/utils';
import { Button } from '@/components/ui/button';

/** Throttle delay (ms) for arrow key repeat to avoid animation jitter. */
const ARROW_THROTTLE_MS = 300;

export const Route = createFileRoute('/test')({
    component: () => <TestComponent date={new Date()} withTransition={false} />,
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
    '01',
    '02',
    '03',
    '04',
    '05',
    '06',
    '07',
    '08',
    '09',
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

/** Number of days in each month (non-leap year). February is 28. */
const DAYS_PER_MONTH = [
    31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
] as const;

const createYears = (startYear: number, endYear: number): readonly string[] => {
    const years: string[] = [];
    for (let year = startYear; year <= endYear; year++) {
        years.push(year.toString());
    }
    return years;
};

const START_YEAR = 2020;

const YEARS = createYears(START_YEAR, START_YEAR + 30);

/**
 * Returns whether the given year is a leap year.
 */
const isLeapYear = (year: number): boolean => {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
};

/**
 * Returns the days options array for the given month (0–11) and year.
 * Used for February leap-year handling.
 */
const getDaysForMonth = (
    monthIndex: number,
    yearIndex: number
): readonly Day[] => {
    const count =
        monthIndex === 1
            ? isLeapYear(parseInt(YEARS[yearIndex]))
                ? 29
                : 28
            : DAYS_PER_MONTH[monthIndex];
    return DAYS.slice(0, count);
};

type Month = (typeof MONTHS)[number];
type Day = (typeof DAYS)[number];

const TestComponent = ({
    date,
    withTransition = true,
}: {
    date: Date;
    withTransition: boolean;
}) => {
    const [scrollerType, setScrollerType] = useState<ScrollerType>('translate');

    const [yearIndex, setYearIndex] = useState(() => date.getFullYear() - 2020);

    const [index, setIndex] = useState(date.getDate() - 1);
    const [monthIndex, setMonthIndex] = useState(date.getMonth());

    const days = useMemo(
        () => getDaysForMonth(monthIndex, yearIndex),
        [monthIndex, yearIndex]
    );

    const [daysLength, setDaysLength] = useState(days.length);

    // Derive so when days shrinks and selected is out of range we show the clamped value immediately (no one-frame lag)
    if (daysLength !== days.length) {
        if (index > days.length - 1) {
            setIndex(days.length - 1);
        }
        setDaysLength(days.length);
    }

    const [focusedScrollerId, setFocusedScrollerId] = useState<
        'month' | 'days' | 'year' | null
    >(null);

    const keyMapRef = useRef(
        new Map<string, boolean>([
            ['ArrowUp', false],
            ['ArrowDown', false],
        ])
    );

    const focusedScrollerIdRef = useRef(focusedScrollerId);
    const daysLengthRef = useRef(days.length);
    const withTransitionRef = useRef(withTransition);
    focusedScrollerIdRef.current = focusedScrollerId;
    daysLengthRef.current = days.length;
    withTransitionRef.current = withTransition;

    const runStepUpRef = useRef(() => {
        const id = focusedScrollerIdRef.current;
        if (id === null) return;
        const len = daysLengthRef.current;
        if (id === 'month') {
            setMonthIndex(prev => normalizeIndex(prev - 1, MONTHS.length));
        } else if (id === 'days') {
            setIndex(prev => normalizeIndex(prev - 1, len));
        } else if (id === 'year') {
            setYearIndex(prev => (prev - 1 >= 0 ? prev - 1 : 0));
        }
    });
    const runStepDownRef = useRef(() => {
        const id = focusedScrollerIdRef.current;
        if (id === null) return;
        const len = daysLengthRef.current;
        if (id === 'month') {
            setMonthIndex(prev => normalizeIndex(prev + 1, MONTHS.length));
        } else if (id === 'days') {
            setIndex(prev => normalizeIndex(prev + 1, len));
        } else if (id === 'year') {
            setYearIndex(prev =>
                prev + 1 < YEARS.length ? prev + 1 : YEARS.length - 1
            );
        }
    });

    const stepUpThrottledRef = useRef(
        throttle(ARROW_THROTTLE_MS, () => runStepUpRef.current())
    );
    const stepDownThrottledRef = useRef(
        throttle(ARROW_THROTTLE_MS, () => runStepDownRef.current())
    );

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (focusedScrollerId === null) return;
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (keyMapRef.current.get('ArrowUp')) return;
                keyMapRef.current.set('ArrowUp', true);
                if (withTransitionRef.current) {
                    stepUpThrottledRef.current();
                } else {
                    runStepUpRef.current();
                }
            } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (keyMapRef.current.get('ArrowDown')) return;
                keyMapRef.current.set('ArrowDown', true);
                if (withTransitionRef.current) {
                    stepDownThrottledRef.current();
                } else {
                    runStepDownRef.current();
                }
            }
        },
        [focusedScrollerId]
    );

    const handleKeyUp = useCallback((event: KeyboardEvent) => {
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            keyMapRef.current.set('ArrowUp', false);
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            keyMapRef.current.set('ArrowDown', false);
        }
    }, []);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
        };
    }, [handleKeyDown, handleKeyUp]);

    return (
        <>
            <div className="flex w-full items-center justify-center gap-4">
                {scrollerType === 'scroll' && <Scroller />}
                {scrollerType === 'translate' && (
                    <div className="flex gap-4">
                        <Alt
                            index={yearIndex}
                            setIndex={setYearIndex}
                            options={YEARS}
                            visibleCount={5}
                            focused={focusedScrollerId === 'year'}
                            onFocus={() => setFocusedScrollerId('year')}
                            onBlur={() => setFocusedScrollerId(null)}
                            wrap={false}
                            withTransition={withTransition}
                        />
                        <Alt
                            index={monthIndex}
                            setIndex={setMonthIndex}
                            options={MONTHS}
                            visibleCount={5}
                            focused={focusedScrollerId === 'month'}
                            onFocus={() => setFocusedScrollerId('month')}
                            onBlur={() => setFocusedScrollerId(null)}
                            withTransition={withTransition}
                        />
                        <Alt
                            index={index}
                            setIndex={setIndex}
                            options={days}
                            visibleCount={5}
                            focused={focusedScrollerId === 'days'}
                            onFocus={() => setFocusedScrollerId('days')}
                            onBlur={() => setFocusedScrollerId(null)}
                            withTransition={withTransition}
                        />
                    </div>
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
                <Button
                    onClick={() =>
                        console.log(
                            'submitting with date',
                            `${MONTHS[monthIndex]} ${days[index]} ${YEARS[yearIndex]}`
                        )
                    }
                >
                    Submit
                </Button>
            </div>
        </>
    );
};
