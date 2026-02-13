import { useCallback, useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

import { Button } from '../ui/button';

const options: string[] = [
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
];

const VISIBLE_COUNT = 5;
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
    // reduce the angle
    index = index % length;

    // force it to be the positive remainder, so that 0 <= angle < 2 * Math.PI
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

export const ScrollerWithTranslate = () => {
    const [centerIndex, setCenterIndex] = useState(0);
    const [startIndex, setStartIndex] = useState(0);

    const [sectionOnTop, setSectionOnTop] = useState<'first' | 'second'>(
        'first'
    );

    const [firstSectionOffset, setFirstSectionOffset] = useState(0);

    const secondSectionOffset = useMemo(() => {
        if (sectionOnTop === 'first') {
            return firstSectionOffset;
        } else {
            return firstSectionOffset - 2 * options.length;
        }
    }, [firstSectionOffset, sectionOnTop, options.length]);

    const indices = useMemo(() => {
        return createLoopingIndices(startIndex, options.length);
    }, [centerIndex, options.length]);

    const firstSectionOffsetTranslate = `translateY(${firstSectionOffset * ITEM_HEIGHT}px)`;
    const secondSectionOffsetTranslate = `translateY(${secondSectionOffset * ITEM_HEIGHT}px)`;

    const closeToTop = useMemo(() => {
        if (sectionOnTop === 'first') {
            return Math.abs(firstSectionOffset) <= VISIBLE_COUNT;
        } else {
            return (
                Math.abs(secondSectionOffset + options.length) <= VISIBLE_COUNT
            );
        }
    }, [firstSectionOffset, options.length, sectionOnTop]);

    const closeToBottom = useMemo(() => {
        if (sectionOnTop === 'first') {
            return (
                Math.abs(
                    firstSectionOffset - VISIBLE_COUNT + 2 * options.length
                ) <= VISIBLE_COUNT
            );
        } else {
            return (
                Math.abs(firstSectionOffset + options.length - VISIBLE_COUNT) <=
                VISIBLE_COUNT
            );
        }
    }, [firstSectionOffset, options.length, sectionOnTop]);

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

    const advanceItem = useCallback(() => {
        if (closeToBottom) {
            setSectionOnTop(sectionOnTop === 'first' ? 'second' : 'first');
            if (sectionOnTop === 'first') {
                setFirstSectionOffset(
                    prevOffset => prevOffset - 1 + 2 * options.length
                );
            } else {
                setFirstSectionOffset(prevOffset => prevOffset - 1);
            }
        } else {
            setFirstSectionOffset(prevOffset => prevOffset - 1);
        }
    }, [closeToBottom, sectionOnTop]);

    const retreatItem = useCallback(() => {
        if (closeToTop) {
            setSectionOnTop(sectionOnTop === 'first' ? 'second' : 'first');
            if (sectionOnTop === 'second') {
                setFirstSectionOffset(
                    prevOffset => prevOffset + 1 - 2 * options.length
                );
            } else {
                setFirstSectionOffset(prevOffset => prevOffset + 1);
            }
        } else {
            setFirstSectionOffset(prevOffset => prevOffset + 1);
        }
    }, [closeToTop, sectionOnTop]);

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (event.key === 'ArrowUp') {
                retreatItem();
            } else if (event.key === 'ArrowDown') {
                advanceItem();
            }
        },
        [advanceItem, retreatItem]
    );

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return (
        <div className="flex h-full flex-col items-center justify-center">
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
                        if (index === centerIndex) {
                            return (
                                <div
                                    key={`${index}-${option}-top-section`}
                                    className="flex shrink-0 items-center justify-center bg-amber-100 text-red-500 select-none"
                                    style={{ height: ITEM_HEIGHT }}
                                    onClick={() => setCenterIndex(i)}
                                >
                                    {option}
                                </div>
                            );
                        } else {
                            return (
                                <div
                                    key={`${index}-${option}-top-section`}
                                    className="flex shrink-0 items-center justify-center select-none"
                                    style={{ height: ITEM_HEIGHT }}
                                    onClick={() => setCenterIndex(i)}
                                >
                                    {option}
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
                    {options.map((option, i) => {
                        if (i === centerIndex) {
                            return (
                                <div
                                    key={`${i}-${option}-bottom-section`}
                                    className="flex shrink-0 items-center justify-center bg-amber-100 text-red-500 select-none"
                                    style={{ height: ITEM_HEIGHT }}
                                    onClick={() => setCenterIndex(i)}
                                >
                                    {option}
                                </div>
                            );
                        } else {
                            return (
                                <div
                                    key={`${i}-${option}-bottom-section`}
                                    className="flex shrink-0 items-center justify-center select-none"
                                    style={{ height: ITEM_HEIGHT }}
                                    onClick={() => setCenterIndex(i)}
                                >
                                    {option}
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
        </div>
    );
};

export const Scroller = () => {
    const half = Math.floor(VISIBLE_COUNT / 2);
    const [centerIndex, setCenterIndex] = useState(3);

    const startIndex = normalizeIndex(centerIndex - half, options.length);
    const endIndex = startIndex + VISIBLE_COUNT;

    const indices = createIndices(startIndex, endIndex, options.length);

    const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        setCenterIndex(prevCenter => {
            const step = Math.round(event.deltaY / 5);
            const newCenter = prevCenter - step;
            const normalizedNewCenter = normalizeIndex(
                newCenter,
                options.length
            );
            return normalizedNewCenter;
        });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'ArrowUp') {
            setCenterIndex(prevCenter => {
                const newCenter = prevCenter - 1;
                const normalizedNewCenter = normalizeIndex(
                    newCenter,
                    options.length
                );
                return normalizedNewCenter;
            });
        } else if (event.key === 'ArrowDown') {
            setCenterIndex(prevCenter => {
                const newCenter = prevCenter + 1;
                const normalizedNewCenter = normalizeIndex(
                    newCenter,
                    options.length
                );
                return normalizedNewCenter;
            });
        }
    };

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="flex h-full flex-col items-center justify-center">
            <h1>Scroller</h1>
            <div
                className={`flex flex-col overflow-hidden`}
                style={{ height: VISIBLE_COUNT * ITEM_HEIGHT }}
                onWheel={handleWheel}
            >
                <div
                    style={{
                        height: VISIBLE_COUNT * ITEM_HEIGHT,
                    }}
                >
                    {indices.map(index => {
                        if (index === centerIndex) {
                            return (
                                <div
                                    key={`${index}-${options[index]}`}
                                    className="flex shrink-0 items-center justify-center bg-amber-100 text-red-500 select-none"
                                    style={{ height: ITEM_HEIGHT }}
                                    onClick={() => setCenterIndex(index)}
                                >
                                    {options[index]}
                                </div>
                            );
                        } else {
                            return (
                                <div
                                    key={`${index}-${options[index]}`}
                                    className="flex shrink-0 items-center justify-center select-none"
                                    style={{ height: ITEM_HEIGHT }}
                                    onClick={() => setCenterIndex(index)}
                                >
                                    {options[index]}
                                </div>
                            );
                        }
                    })}
                </div>
            </div>
            <Button
                onClick={() =>
                    setCenterIndex(prevCenter => {
                        const normalizedNewCenter = normalizeIndex(
                            prevCenter + 1,
                            options.length
                        );
                        return normalizedNewCenter;
                    })
                }
            >
                Next
            </Button>
            <Button
                onClick={() =>
                    setCenterIndex(prevCenter => {
                        const newCenter = prevCenter - 1;
                        const normalizedNewCenter = normalizeIndex(
                            newCenter,
                            options.length
                        );
                        return normalizedNewCenter;
                    })
                }
            >
                Previous
            </Button>
        </div>
    );
};
