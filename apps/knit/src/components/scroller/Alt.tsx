import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '../ui/button';

const normalizeIndex = (index: number, length: number) => {
    index = index % length;

    index = (index + length) % length;
    return index;
};

const VISIBLE_COUNT = 5;
const ITEM_HEIGHT = 40; // px

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
    value,
    options,
    onSelect,
}: {
    value: T;
    options: readonly T[];
    onSelect: (value: T) => void;
}) => {
    const [index, setIndex] = useState(0);

    const [optionsLength, setOptionsLength] = useState(options.length);

    if (optionsLength !== options.length) {
        setOptionsLength(options.length);

        if (index > options.length - 1) {
            setIndex(options.length - 1);
        }
    }

    const startIndex = normalizeIndex(
        index - Math.floor(VISIBLE_COUNT / 2) - 1,
        options.length
    );

    const indices = createLoopingIndices(
        startIndex,
        options.length,
        VISIBLE_COUNT + 1
    );

    console.log(indices);
    console.log(startIndex);
    console.log('index', index);

    return (
        <div className="flex h-full flex-col items-center justify-center">
            <h1>Scroller with translate</h1>
            <div
                className={`flex flex-col overflow-hidden`}
                style={{
                    height: VISIBLE_COUNT * ITEM_HEIGHT,
                    width: '100%',
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
                    {indices.map((index, i) => {
                        const option = options[index];
                        return (
                            <div
                                style={{
                                    height: ITEM_HEIGHT,
                                    position: 'absolute',
                                    top: 0,
                                    transform: `translateY(${(i - 1) * ITEM_HEIGHT}px)`,
                                    transition: 'transform 0.25s ease-out',
                                }}
                                key={`${options.length}-${option}`}
                                className="flex shrink-0 items-center justify-center select-none"
                            >
                                {option as string}
                            </div>
                        );
                    })}
                </div>
            </div>
            <Button
                onClick={() => {
                    setIndex(prevIndex =>
                        normalizeIndex(prevIndex - 1, options.length)
                    );
                }}
            >
                Previous Item
            </Button>
            <Button
                onClick={() => {
                    setIndex(prevIndex =>
                        normalizeIndex(prevIndex + 1, options.length)
                    );
                }}
            >
                Next Item
            </Button>
        </div>
    );
};

export default ScrollerWithTranslate;
