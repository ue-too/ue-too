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

    const [firstSectionOffset, setFirstSectionOffset] = useState(0);
    const [firstTopOffset, setFirstTopOffset] = useState(-options.length);

    const secondSectionOffset = firstSectionOffset;

    const indices = useMemo(() => {
        return createLoopingIndices(startIndex, options.length);
    }, [startIndex, options.length]);

    const firstSectionOffsetTranslate = `translateY(${firstSectionOffset * ITEM_HEIGHT}px)`;
    const secondSectionOffsetTranslate = `translateY(${secondSectionOffset * ITEM_HEIGHT}px)`;

    const currentIndex = useMemo(() => {
        return getCurrentIndex(
            sectionOnTop,
            firstSectionOffset,
            options.length
        );
    }, [sectionOnTop, firstSectionOffset, options]);

    const isAtBottom = useMemo(() => {
        const position =
            sectionOnTop === 'first'
                ? firstTopOffset + firstSectionOffset
                : firstSectionOffset;
        return position >= VISIBLE_COUNT;
    }, [sectionOnTop, firstSectionOffset, options]);

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (event.key === 'ArrowUp' && !keyMap.get('ArrowUp')) {
                keyMap.set('ArrowUp', true);
                const newOffset = normalizeIndex(
                    firstSectionOffset + 1,
                    options.length
                );
                if (isAtBottom) {
                    setFirstTopOffset(-2 * options.length);
                }
                setFirstSectionOffset(prevOffset =>
                    normalizeIndex(prevOffset + 1, options.length)
                );
            } else if (event.key === 'ArrowDown' && !keyMap.get('ArrowDown')) {
                keyMap.set('ArrowDown', true);
                setFirstSectionOffset(prevOffset => prevOffset - 1);
            }
        },
        [isAtBottom]
    );

    const showFirstSection = useMemo(() => {
        if (sectionOnTop === 'first') {
            const position = -options.length + firstSectionOffset;
            return (
                position > -options.length - 1 && position < VISIBLE_COUNT + 1
            );
        } else {
            const position = firstSectionOffset;
            return (
                position > -options.length - 1 && position < VISIBLE_COUNT + 1
            );
        }
    }, [sectionOnTop, firstSectionOffset, options]);

    const showSecondSection = useMemo(() => {
        if (sectionOnTop === 'second') {
            const position = -options.length + secondSectionOffset;
            return (
                position > -options.length - 1 && position < VISIBLE_COUNT + 1
            );
        } else {
            const position = secondSectionOffset;
            return (
                position > -options.length - 1 && position < VISIBLE_COUNT + 1
            );
        }
    }, [sectionOnTop, secondSectionOffset, options]);

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
                style={{
                    position: 'relative',
                    height: VISIBLE_COUNT * ITEM_HEIGHT,
                    width: '100%',
                }}
            >
                <div
                    style={{
                        height: options.length * ITEM_HEIGHT,
                        transform: firstSectionOffsetTranslate,
                        transition: showFirstSection
                            ? 'transform 0.25s ease-out'
                            : 'none',
                        position: 'absolute',
                        visibility: showFirstSection ? 'visible' : 'hidden',
                        top: firstTopOffset * ITEM_HEIGHT,
                        left: 0,
                        width: '100%',
                    }}
                >
                    {indices.map((index, i) => {
                        const option = options[index];
                        return (
                            <div
                                key={`${index}-${option}-top-section`}
                                className="flex shrink-0 items-center justify-center select-none"
                                style={{ height: ITEM_HEIGHT }}
                            >
                                {option as string}
                            </div>
                        );
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
                        position: 'absolute',
                        top:
                            sectionOnTop === 'second'
                                ? -options.length * ITEM_HEIGHT
                                : 0,
                        left: 0,
                        width: '100%',
                    }}
                >
                    {indices.map((index, i) => {
                        const option = options[index];
                        return (
                            <div
                                key={`${i}-${option}-bottom-section`}
                                className="flex shrink-0 items-center justify-center select-none"
                                style={{ height: ITEM_HEIGHT }}
                            >
                                {option as string}
                            </div>
                        );
                    })}
                </div>
            </div>
            <Button
                onClick={() => {
                    setFirstSectionOffset(prevOffset => prevOffset + 1);
                }}
            >
                Previous Item
            </Button>
            <Button
                onClick={() => {
                    setFirstSectionOffset(prevOffset => prevOffset - 1);
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
            <Button
                onClick={() => {
                    setSectionOnTop(prevSectionOnTop =>
                        prevSectionOnTop === 'first' ? 'second' : 'first'
                    );
                }}
            >
                Next Section On Top
            </Button>
        </div>
    );
};

export default ScrollerWithTranslate;
