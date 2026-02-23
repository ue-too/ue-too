import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import { cn } from '@/lib/utils';

import { Button } from '../ui/button';

const normalizeIndex = (index: number, length: number) => {
    index = index % length;

    index = (index + length) % length;
    return index;
};

const VISIBLE_COUNT = 5;
const ITEM_HEIGHT = 40; // px
const BUFFER_COUNT = 3;
const WHEEL_THROTTLE_MS = 80;

const keyMap = new Map<string, boolean>([
    ['ArrowUp', false],
    ['ArrowDown', false],
]);

const createLoopingIndices = (
    startIndex: number,
    length: number,
    count: number
) => {
    const indices: number[] = [];
    const stop = Math.min(startIndex + count, length - 1);

    for (let i = startIndex; i <= stop; i++) {
        indices.push(i);
    }

    if (startIndex + count > length - 1) {
        for (let i = 0; i < startIndex + count - length + 1; i++) {
            indices.push(i);
        }
    }

    return indices;
};

const ScrollerWithTranslate = <T,>({
    options,
    visibleCount = VISIBLE_COUNT,
    index,
    setIndex,
}: {
    options: readonly T[];
    visibleCount: number;
    index: number;
    setIndex: (index: number | ((prev: number) => number)) => void;
}) => {
    const startIndex = normalizeIndex(
        index - Math.floor(visibleCount / 2) - BUFFER_COUNT,
        options.length
    );

    const keyMap = useMemo(
        () =>
            new Map<string, boolean>([
                ['ArrowUp', false],
                ['ArrowDown', false],
            ]),
        []
    );

    const indices = createLoopingIndices(
        startIndex,
        options.length,
        visibleCount + BUFFER_COUNT + 1
    );

    const lastWheelRef = useRef(0);

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (event.key === 'ArrowUp' && !keyMap.get('ArrowUp')) {
                keyMap.set('ArrowUp', true);
                setIndex(prev => normalizeIndex(prev - 1, options.length));
            } else if (event.key === 'ArrowDown' && !keyMap.get('ArrowDown')) {
                keyMap.set('ArrowDown', true);
                setIndex(prev => normalizeIndex(prev + 1, options.length));
            }
        },
        [options, setIndex, keyMap]
    );

    const handleWheel = useCallback(
        (event: React.WheelEvent<HTMLDivElement>) => {
            // event.preventDefault();
            const now = Date.now();
            if (now - lastWheelRef.current < WHEEL_THROTTLE_MS) return;
            lastWheelRef.current = now;
            if (event.deltaY > 0) {
                setIndex(prev => normalizeIndex(prev + 1, options.length));
            } else {
                setIndex(prev => normalizeIndex(prev - 1, options.length));
            }
        },
        [options, setIndex]
    );

    const handleKeyUp = useCallback(
        (event: KeyboardEvent) => {
            if (event.key === 'ArrowUp') {
                keyMap.set('ArrowUp', false);
            } else if (event.key === 'ArrowDown') {
                keyMap.set('ArrowDown', false);
            }
        },
        [keyMap]
    );

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
        };
    }, [handleKeyDown, handleKeyUp, handleWheel]);

    return (
        <div className="flex h-full flex-col items-center justify-center">
            <h1>Scroller with translate</h1>
            <div
                className={`flex flex-col overflow-hidden`}
                style={{
                    height: visibleCount * ITEM_HEIGHT,
                    width: '100%',
                }}
                onWheel={handleWheel}
            >
                <div
                    style={{
                        height: options.length * ITEM_HEIGHT,
                        width: '100%',
                        position: 'relative',
                    }}
                    className="flex flex-col items-center justify-center"
                >
                    {indices.map((idx, i) => {
                        const option = options[idx];
                        return (
                            <div
                                style={{
                                    height: ITEM_HEIGHT,
                                    position: 'absolute',
                                    top: 0,
                                    transform: `translateY(${(i - BUFFER_COUNT) * ITEM_HEIGHT}px)`,
                                    transition: 'transform 0.25s ease-out',
                                }}
                                key={`${options.length}-${option}`}
                                className={cn(
                                    'flex shrink-0 items-center justify-center select-none',
                                    {
                                        'bg-amber-100 text-red-500':
                                            idx === index,
                                    }
                                )}
                                onClick={() => {
                                    setIndex(idx);
                                }}
                            >
                                {option as string}
                            </div>
                        );
                    })}
                </div>
            </div>
            <Button
                onClick={() => {
                    setIndex(prev => normalizeIndex(prev - 1, options.length));
                }}
            >
                Previous Item
            </Button>
            <Button
                onClick={() => {
                    setIndex(prev => normalizeIndex(prev + 1, options.length));
                }}
            >
                Next Item
            </Button>
        </div>
    );
};

export default ScrollerWithTranslate;
