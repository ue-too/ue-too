import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '../ui/button';

const VISIBLE_COUNT = 5;
const NUMBER_OF_REPEAT = 2;
const ITEM_HEIGHT = 40; // px

const createIndices = (
    startIndex: number,
    endIndex: number,
    length: number
) => {
    return Array.from({ length: endIndex - startIndex + 1 }, (_, i) => {
        if (startIndex + i < length) {
            return startIndex + i;
        } else {
            return startIndex + i - length;
        }
    });
};

const createLoopingIndices = (startIndex: number, length: number) => {
    const indices: number[] = [];
    for (let i = startIndex; i <= length - 1; i++) {
        indices.push(i);
    }

    for (let i = 0; i < startIndex; i++) {
        indices.push(i);
    }

    return indices;
};

const createLoopingIndicesWithEndIndex = (endIndex: number, length: number) => {
    const indices: number[] = [];
    const startIndex = normalizeIndex(endIndex + 1, length);

    return createLoopingIndices(startIndex, length);
};

const normalizeIndex = (index: number, length: number) => {
    index = index % length;

    index = (index + length) % length;
    return index;
};

const smallerDistBetweenIndices = (
    index1: number,
    index2: number,
    length: number
) => {
    const dist1 = Math.abs(index1 - index2);
    const dist2 = length - dist1;
    return Math.min(dist1, dist2);
};

const isCloseToTop = (
    sectionOnTop: 'first' | 'second',
    firstSectionOffset: number,
    secondSectionOffset: number,
    length: number
) => {
    if (sectionOnTop === 'first') {
        return Math.abs(firstSectionOffset) <= VISIBLE_COUNT;
    } else {
        return (
            Math.abs(firstSectionOffset - 2 * length + length) <= VISIBLE_COUNT
        );
    }
};

const isCloseToBottom = (
    sectionOnTop: 'first' | 'second',
    firstSectionOffset: number,
    length: number
) => {
    if (sectionOnTop === 'first') {
        return (
            Math.abs(firstSectionOffset - VISIBLE_COUNT + 2 * length) <=
            VISIBLE_COUNT
        );
    } else {
        return (
            Math.abs(firstSectionOffset + length - VISIBLE_COUNT) <=
            VISIBLE_COUNT
        );
    }
};

const getCurrentIndex = (
    sectionOnTop: 'first' | 'second',
    firstSectionOffset: number,
    optionsLength: number
) => {
    const secondSectionOffset =
        sectionOnTop === 'first'
            ? firstSectionOffset
            : firstSectionOffset - 2 * optionsLength;
    if (sectionOnTop === 'first') {
        return normalizeIndex(
            -firstSectionOffset + Math.floor(VISIBLE_COUNT / 2),
            optionsLength
        );
    } else {
        return normalizeIndex(
            -optionsLength -
                secondSectionOffset +
                Math.floor(VISIBLE_COUNT / 2),
            optionsLength
        );
    }
};

const keyMap = new Map<string, boolean>([
    ['ArrowUp', false],
    ['ArrowDown', false],
]);

const ScrollerWithTranslate = <T,>({
    value,
    options,
    onSelect,
}: {
    value: T;
    options: readonly T[];
    onSelect: (value: T) => void;
}) => {
    const [startIndex, setStartIndex] = useState(0);

    const [sectionOnTop, setSectionOnTop] = useState<'first' | 'second'>(
        'first'
    );

    const [firstSectionOffset, setFirstSectionOffset] = useState(
        -options.length + Math.floor(VISIBLE_COUNT / 2)
    );

    const secondSectionOffset = useMemo(() => {
        if (sectionOnTop === 'first') {
            return firstSectionOffset;
        } else {
            return firstSectionOffset - 2 * options.length;
        }
    }, [firstSectionOffset, sectionOnTop, options.length]);

    const indices = useMemo(() => {
        return createLoopingIndices(startIndex, options.length);
    }, [startIndex, options.length]);

    const firstSectionOffsetTranslate = `translateY(${firstSectionOffset * ITEM_HEIGHT}px)`;
    const secondSectionOffsetTranslate = `translateY(${secondSectionOffset * ITEM_HEIGHT}px)`;

    const closeToTop = useMemo(() => {
        return isCloseToTop(
            sectionOnTop,
            firstSectionOffset,
            secondSectionOffset,
            options.length
        );
    }, [firstSectionOffset, secondSectionOffset, options, sectionOnTop]);

    const closeToBottom = useMemo(() => {
        return isCloseToBottom(
            sectionOnTop,
            firstSectionOffset,
            options.length
        );
    }, [firstSectionOffset, options, sectionOnTop]);

    const showFirstSection = useMemo(() => {
        const lessThanHorizon = firstSectionOffset <= -options.length;
        const moreThanVisibleCount = firstSectionOffset >= VISIBLE_COUNT;
        return !lessThanHorizon && !moreThanVisibleCount;
    }, [firstSectionOffset, options.length, VISIBLE_COUNT]);

    const showSecondSection = useMemo(() => {
        const windowBottom =
            secondSectionOffset <= -options.length + VISIBLE_COUNT;
        const windowTop = secondSectionOffset >= -2 * options.length;
        return windowBottom && windowTop;
    }, [secondSectionOffset, options.length, VISIBLE_COUNT]);

    const currentIndex = useMemo(() => {
        return getCurrentIndex(
            sectionOnTop,
            firstSectionOffset,
            options.length
        );
    }, [sectionOnTop, firstSectionOffset, options]);

    const advanceItem = useCallback(
        (steps: number = 1) => {
            if (closeToBottom) {
                const normalizedIndex = normalizeIndex(
                    currentIndex + startIndex + steps,
                    options.length
                );
                const nextValue = options[normalizedIndex];
                onSelect(nextValue);
                setSectionOnTop(sectionOnTop === 'first' ? 'second' : 'first');
                if (sectionOnTop === 'first') {
                    setFirstSectionOffset(
                        prevOffset => prevOffset - 1 + 2 * options.length
                    );
                } else {
                    setFirstSectionOffset(prevOffset => prevOffset - 1);
                }
            } else {
                const normalizedIndex = normalizeIndex(
                    currentIndex + startIndex + steps,
                    options.length
                );
                const nextValue = options[normalizedIndex];
                onSelect(nextValue);
                setFirstSectionOffset(prevOffset => prevOffset - 1);
            }
        },
        [
            closeToBottom,
            sectionOnTop,
            options,
            currentIndex,
            onSelect,
            startIndex,
        ]
    );

    const retreatItem = useCallback(() => {
        if (closeToTop) {
            const normalizedIndex = normalizeIndex(
                currentIndex - 1,
                options.length
            );
            const nextValue = options[normalizedIndex];
            onSelect(nextValue);
            setSectionOnTop(sectionOnTop === 'first' ? 'second' : 'first');
            if (sectionOnTop === 'second') {
                setFirstSectionOffset(
                    prevOffset => prevOffset + 1 - 2 * options.length
                );
            } else {
                setFirstSectionOffset(prevOffset => prevOffset + 1);
            }
        } else {
            const normalizedIndex = normalizeIndex(
                currentIndex - 1,
                options.length
            );
            const nextValue = options[normalizedIndex];
            onSelect(nextValue);
            setFirstSectionOffset(prevOffset => prevOffset + 1);
        }
    }, [closeToTop, sectionOnTop, options, currentIndex, onSelect]);

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (event.key === 'ArrowUp' && !keyMap.get('ArrowUp')) {
                keyMap.set('ArrowUp', true);
                retreatItem();
            } else if (event.key === 'ArrowDown' && !keyMap.get('ArrowDown')) {
                keyMap.set('ArrowDown', true);
                advanceItem();
            }
        },
        [advanceItem, retreatItem]
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
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
        };
    }, [handleKeyDown]);

    return (
        <div className="flex h-full flex-col items-center justify-center gap-3">
            <h1>Scroller with translate</h1>
            <div
                className={`flex flex-col overflow-hidden`}
                style={{ height: VISIBLE_COUNT * ITEM_HEIGHT }}
            >
                <div
                    style={{
                        height: options.length * ITEM_HEIGHT,
                        transform: firstSectionOffsetTranslate,
                        transition: showFirstSection
                            ? 'transform 0.25s ease-out'
                            : 'none',
                        visibility: showFirstSection ? 'visible' : 'hidden',
                    }}
                >
                    {indices.map((index, i) => {
                        const option = options[index];
                        if (i === currentIndex && showFirstSection) {
                            return (
                                <div
                                    key={`${index}-${option}-top-section`}
                                    className="flex shrink-0 items-center justify-center bg-amber-100 text-red-500 select-none"
                                    style={{ height: ITEM_HEIGHT }}
                                >
                                    {option as string}
                                </div>
                            );
                        } else {
                            return (
                                <div
                                    key={`${index}-${option}-top-section`}
                                    className="flex shrink-0 items-center justify-center select-none"
                                    style={{ height: ITEM_HEIGHT }}
                                >
                                    {option as string}
                                </div>
                            );
                        }
                    })}
                </div>
                <div
                    style={{
                        height: options.length * ITEM_HEIGHT,
                        transform: secondSectionOffsetTranslate,
                        transition: showSecondSection
                            ? 'transform 0.25s ease-out'
                            : 'none',
                        visibility: showSecondSection ? 'visible' : 'hidden',
                    }}
                >
                    {indices.map((index, i) => {
                        const option = options[index];
                        if (i === currentIndex && showSecondSection) {
                            return (
                                <div
                                    key={`${i}-${option}-bottom-section`}
                                    className="flex shrink-0 items-center justify-center bg-amber-100 text-red-500 select-none"
                                    style={{ height: ITEM_HEIGHT }}
                                >
                                    {option as string}
                                </div>
                            );
                        } else {
                            return (
                                <div
                                    key={`${i}-${option}-bottom-section`}
                                    className="flex shrink-0 items-center justify-center select-none"
                                    style={{ height: ITEM_HEIGHT }}
                                >
                                    {option as string}
                                </div>
                            );
                        }
                    })}
                </div>
            </div>
            <Button
                onClick={() => {
                    retreatItem();
                }}
            >
                Previous Item
            </Button>
            <Button
                onClick={() => {
                    advanceItem();
                }}
            >
                Next Item
            </Button>
            <Button
                onClick={() => {
                    const newIndex = normalizeIndex(
                        startIndex + 1,
                        options.length
                    );

                    const newItemIndex = normalizeIndex(
                        currentIndex + newIndex,
                        options.length
                    );

                    onSelect(options[newItemIndex]);

                    setStartIndex(prevStartIndex =>
                        normalizeIndex(prevStartIndex + 1, options.length)
                    );
                }}
            >
                Next Start Index
            </Button>
        </div>
    );
};

export default ScrollerWithTranslate;
