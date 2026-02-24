import { useCallback, useEffect, useMemo, useState } from 'react';

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

const normalizeIndex = (index: number, length: number) => {
    // reduce the angle
    index = index % length;

    // force it to be the positive remainder, so that 0 <= angle < 2 * Math.PI
    index = (index + length) % length;
    return index;
};

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
