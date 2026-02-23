import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useState,
} from 'react';

import { cn } from '@/lib/utils';

import { Button } from '../ui/button';

const normalizeIndex = (index: number, length: number) => {
    index = index % length;

    index = (index + length) % length;
    return index;
};

const VISIBLE_COUNT = 3;
const ITEM_HEIGHT = 40; // px
const BUFFER_COUNT = 5;

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
    onSelect,
    visibleCount = VISIBLE_COUNT,
}: {
    options: readonly T[];
    onSelect: (value: T) => void;
    visibleCount: number;
}) => {
    const [index, setIndex] = useState(0);

    // Clamp to valid range during render so transform/highlight are correct immediately (no transition)
    const displayIndex =
        options.length === 0 ? 0 : Math.min(index, options.length - 1);

    useEffect(() => {
        if (index > options.length - 1) {
            const newIndex = options.length - 1;
            onSelect(options[newIndex]);
            setIndex(newIndex);
        }
    }, [options.length]); // only run when length changes; sync state after displayIndex already rendered correctly

    const startIndex = normalizeIndex(
        displayIndex - Math.floor(visibleCount / 2) - BUFFER_COUNT,
        options.length
    );

    const indices = createLoopingIndices(
        startIndex,
        options.length,
        visibleCount + BUFFER_COUNT + 1
    );

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (event.key === 'ArrowUp' && !keyMap.get('ArrowUp')) {
                keyMap.set('ArrowUp', true);
                const newIndex = normalizeIndex(
                    displayIndex - 1,
                    options.length
                );
                onSelect(options[newIndex]);
                setIndex(newIndex);
            } else if (event.key === 'ArrowDown' && !keyMap.get('ArrowDown')) {
                keyMap.set('ArrowDown', true);
                const newIndex = normalizeIndex(
                    displayIndex + 1,
                    options.length
                );
                onSelect(options[newIndex]);
                setIndex(newIndex);
            }
        },
        [displayIndex, options, onSelect]
    );

    const handleWheel = useCallback(
        (event: WheelEvent) => {
            if (event.deltaY > 0) {
                const newIndex = normalizeIndex(
                    displayIndex + 1,
                    options.length
                );
                onSelect(options[newIndex]);
                setIndex(newIndex);
            } else {
                const newIndex = normalizeIndex(
                    displayIndex - 1,
                    options.length
                );
                onSelect(options[newIndex]);
                setIndex(newIndex);
            }
        },
        [displayIndex, options, onSelect]
    );

    const handleKeyUp = useCallback((event: KeyboardEvent) => {
        if (event.key === 'ArrowUp') {
            keyMap.set('ArrowUp', false);
        } else if (event.key === 'ArrowDown') {
            keyMap.set('ArrowDown', false);
        }
    }, []);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        document.addEventListener('wheel', handleWheel);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
            document.removeEventListener('wheel', handleWheel);
        };
    }, [handleKeyDown, handleKeyUp, handleWheel]);

    console.log(indices);

    return (
        <div className="flex h-full flex-col items-center justify-center">
            <h1>Scroller with translate</h1>
            <div
                className={`flex flex-col overflow-hidden`}
                style={{
                    height: visibleCount * ITEM_HEIGHT,
                    width: '100%',
                }}
                onPointerDown={e => {
                    console.log('pointer down', e);
                }}
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
                                            idx === displayIndex,
                                    }
                                )}
                                onClick={() => {
                                    onSelect(option);
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
                    const newIndex = normalizeIndex(
                        displayIndex - 1,
                        options.length
                    );
                    onSelect(options[newIndex]);
                    setIndex(newIndex);
                }}
            >
                Previous Item
            </Button>
            <Button
                onClick={() => {
                    const newIndex = normalizeIndex(
                        displayIndex + 1,
                        options.length
                    );
                    onSelect(options[newIndex]);
                    setIndex(newIndex);
                }}
            >
                Next Item
            </Button>
        </div>
    );
};

export default ScrollerWithTranslate;
