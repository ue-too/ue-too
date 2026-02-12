import { useEffect, useMemo, useState } from 'react';

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
    const half = Math.floor(VISIBLE_COUNT / 2);
    const [centerIndex, setCenterIndex] = useState(0);
    const [startIndex, setStartIndex] = useState(0);

    const indices = useMemo(() => {
        return createLoopingIndices(startIndex, options.length);
    }, [centerIndex, options.length]);

    const indicesWithEndIndex = useMemo(() => {
        return createLoopingIndicesWithEndIndex(startIndex - 1, options.length);
    }, [centerIndex, options.length]);

    const smallerDist = smallerDistBetweenIndices(
        normalizeIndex(centerIndex - half, options.length),
        startIndex,
        options.length
    );

    console.log('startIndex', startIndex);
    console.log('centerIndex', centerIndex);
    console.log(indices);

    const translateAmount = -(centerIndex - half) * ITEM_HEIGHT;
    const translate = `translateY(${translateAmount}px)`;
    const translateAmountWithEndIndex =
        -(centerIndex - half - options.length) * ITEM_HEIGHT;
    const translateWithEndIndex = `translateY(${translateAmountWithEndIndex}px)`;

    return (
        <div className="flex h-full flex-col items-center justify-center">
            <h1>Scroller with translate</h1>
            <div
                className={`flex flex-col overflow-hidden`}
                style={{ height: VISIBLE_COUNT * ITEM_HEIGHT }}
            >
                <div
                    style={{
                        height: VISIBLE_COUNT * ITEM_HEIGHT,
                        transform: translate,
                        transition: 'transform 0.25s ease-out',
                    }}
                >
                    {indicesWithEndIndex.map((index, i) => {
                        const option = options[index];
                        if (index === centerIndex) {
                            return (
                                <div
                                    key={`${i}-${option}-${index}-with-end-index`}
                                    className="flex shrink-0 items-center justify-center bg-amber-100 text-red-500 select-none"
                                    style={{ height: ITEM_HEIGHT }}
                                    onClick={() => setCenterIndex(index)}
                                >
                                    {option}
                                </div>
                            );
                        } else {
                            return (
                                <div
                                    key={`${i}-${option}-${index}-with-end-index`}
                                    className="flex shrink-0 items-center justify-center select-none"
                                    style={{ height: ITEM_HEIGHT }}
                                    onClick={() => setCenterIndex(index)}
                                >
                                    {option}
                                </div>
                            );
                        }
                    })}
                </div>
                <div
                    style={{
                        height: VISIBLE_COUNT * ITEM_HEIGHT,
                        transform: translate,
                        transition: 'transform 0.25s ease-out',
                    }}
                >
                    {indices.map((index, i) => {
                        const option = options[index];
                        if (index === centerIndex) {
                            return (
                                <div
                                    key={`${i}-${option}-${index}`}
                                    className="flex shrink-0 items-center justify-center bg-amber-100 text-red-500 select-none"
                                    style={{ height: ITEM_HEIGHT }}
                                    onClick={() => setCenterIndex(index)}
                                >
                                    {option}
                                </div>
                            );
                        } else {
                            return (
                                <div
                                    key={`${i}-${option}-${index}`}
                                    className="flex shrink-0 items-center justify-center select-none"
                                    style={{ height: ITEM_HEIGHT }}
                                    onClick={() => setCenterIndex(index)}
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
                    setCenterIndex(prevCenter => {
                        const normalizedNewCenter = normalizeIndex(
                            prevCenter + 1,
                            options.length
                        );
                        return normalizedNewCenter;
                    });
                }}
            >
                Next
            </Button>
            <Button
                onClick={() => {
                    setCenterIndex(prevCenter => {
                        const normalizedNewCenter = normalizeIndex(
                            prevCenter - 1,
                            options.length
                        );
                        return normalizedNewCenter;
                    });
                }}
            >
                Previous
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
