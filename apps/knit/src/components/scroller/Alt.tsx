import { useCallback, useRef } from 'react';

import { cn } from '@/lib/utils';

import { normalizeIndex } from './utils';

const VISIBLE_COUNT = 5;
const ITEM_HEIGHT = 40; // px
const BUFFER_COUNT = 3;
const WHEEL_THROTTLE_MS = 80;

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

const createIndicesWithoutLooping = (
    startIndex: number,
    length: number,
    count: number
) => {
    const indices: number[] = [];
    const stop = Math.min(startIndex + count, length - 1);

    for (let i = startIndex; i <= stop; i++) {
        indices.push(i);
    }

    return indices;
};

const ScrollerWithTranslate = <T,>({
    options,
    visibleCount = VISIBLE_COUNT,
    index,
    setIndex,
    onFocus,
    onBlur,
    focused,
    wrap = true,
    withTransition = true,
}: {
    options: readonly T[];
    visibleCount: number;
    index: number;
    setIndex: (index: number | ((prev: number) => number)) => void;
    focused: boolean;
    onFocus?: () => void;
    onBlur?: () => void;
    wrap?: boolean;
    withTransition?: boolean;
}) => {
    const startIndex = wrap
        ? normalizeIndex(
              index - Math.floor(visibleCount / 2) - BUFFER_COUNT,
              options.length
          )
        : Math.max(0, index - Math.floor(visibleCount / 2) - BUFFER_COUNT);

    const shouldTransformContainer = !wrap
        ? index - startIndex < Math.floor(visibleCount / 2) + BUFFER_COUNT
        : false;

    const containerOffset = shouldTransformContainer
        ? Math.floor(visibleCount / 2) + BUFFER_COUNT - (index - startIndex)
        : 0;

    const indices = wrap
        ? createLoopingIndices(
              startIndex,
              options.length,
              (Math.floor(visibleCount / 2) + BUFFER_COUNT) * 2
          )
        : createIndicesWithoutLooping(
              startIndex,
              options.length,
              (Math.floor(visibleCount / 2) + BUFFER_COUNT) * 2
          );

    // console.log('shouldTransformContainer', shouldTransformContainer);
    // console.log('containerOffset', containerOffset);
    // console.log('index', index);
    // console.log('startIndex', startIndex);
    // console.log('indices', indices);

    const lastWheelRef = useRef(0);

    const handleWheel = useCallback(
        (event: React.WheelEvent<HTMLDivElement>) => {
            // event.preventDefault();
            const now = Date.now();
            if (now - lastWheelRef.current < WHEEL_THROTTLE_MS) return;
            lastWheelRef.current = now;
            if (event.deltaY > 0) {
                setIndex(prev =>
                    wrap
                        ? normalizeIndex(prev + 1, options.length)
                        : prev + 1 < options.length
                          ? prev + 1
                          : options.length - 1
                );
            } else {
                setIndex(prev =>
                    wrap
                        ? normalizeIndex(prev - 1, options.length)
                        : prev - 1 >= 0
                          ? prev - 1
                          : 0
                );
            }
        },
        [options, setIndex]
    );

    return (
        <div className="flex h-full flex-col items-center justify-center">
            <h1>Scroller with translate</h1>
            <div
                className="flex flex-col overflow-hidden outline-none focus:outline-none"
                style={{
                    height: visibleCount * ITEM_HEIGHT,
                    width: '100%',
                }}
                tabIndex={0}
                onFocus={onFocus}
                onBlur={onBlur}
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
                                    transform: `translateY(${(i - BUFFER_COUNT + containerOffset) * ITEM_HEIGHT}px)`,
                                    transition: withTransition
                                        ? 'transform 0.15s linear'
                                        : 'none',
                                    width: '100%',
                                }}
                                key={`${options.length}-${option}`}
                                className={cn(
                                    'flex shrink-0 items-center justify-center select-none',
                                    {
                                        'bg-amber-100':
                                            idx === index && focused,
                                        'text-red-500': idx === index,
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
        </div>
    );
};

export default ScrollerWithTranslate;
