import { useEffect, useRef } from 'react';

import { pixelFontToGrid } from './pixel-font';

interface LedMarqueeProps {
    /** Text to render as LED dots */
    text: string;
    /** Number of LED rows */
    rows?: number;
    /** Number of visible LED columns */
    visibleCols?: number;
    /** LED dot color (CSS color string) */
    litColor?: string;
    /** Unlit LED dot color */
    unlitColor?: string;
    /** Font to use for sampling (must be a system/loaded font) */
    font?: string;
    /** Height of the component in pixels */
    height?: number;
    /** Scroll speed in columns per second */
    speed?: number;
    /** Whether to scroll. When false, text is rendered statically. */
    scroll?: boolean;
    /** Use the built-in pixel font instead of canvas text rendering. */
    usePixelFont?: boolean;
    /** Native pixel size for bitmap fonts. When set, renders at this exact
     *  size and samples 1:1 instead of downsampling from a large render. */
    nativePx?: number;
    /** Fixed dot diameter in pixels. When set, overrides height-based
     *  calculation — the component sizes itself from the grid dimensions. */
    dotSize?: number;
    /** When true, lit dots gently pulse in opacity. */
    pulse?: boolean;
    /** Scroll direction: 'horizontal' (default) or 'vertical'. */
    scrollDirection?: 'horizontal' | 'vertical';
    /** Number of visible LED rows (used for vertical scroll). */
    visibleRows?: number;
}

/**
 * Converts text into a grid of lit/unlit booleans by rendering to an
 * offscreen canvas and sampling pixel alpha values — same approach as
 * the train station info-board prototype.
 */
function textToDotMatrix(
    text: string,
    rows: number,
    font: string,
    nativePx?: number
): boolean[][] {
    const offscreen = document.createElement('canvas');
    const ctx = offscreen.getContext('2d');
    if (!ctx) return [];

    if (nativePx) {
        // Bitmap font path: render at an integer multiple of native size,
        // then sample the center of each native pixel to avoid subpixel AA.
        const scale = 32;
        const fontSize = nativePx * scale;
        ctx.font = `${fontSize}px ${font}`;
        ctx.imageSmoothingEnabled = false;
        const metrics = ctx.measureText(text);
        const textWidth = Math.ceil(metrics.width);

        offscreen.width = textWidth + scale * 2;
        offscreen.height = fontSize + scale * 4;

        ctx.font = `${fontSize}px ${font}`;
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = 'black';
        ctx.textBaseline = 'top';
        ctx.fillText(text, scale, scale);

        const imgData = ctx.getImageData(
            0,
            0,
            offscreen.width,
            offscreen.height
        );

        // RMS sample each native-pixel-sized cell
        const nativeW = Math.ceil(offscreen.width / scale);
        const nativeH = Math.ceil(offscreen.height / scale);
        const grid: boolean[][] = [];
        for (let ny = 0; ny < nativeH; ny++) {
            const row: boolean[] = [];
            const sy = ny * scale;
            const eyEnd = Math.min((ny + 1) * scale, offscreen.height);
            for (let nx = 0; nx < nativeW; nx++) {
                const sx = nx * scale;
                const exEnd = Math.min((nx + 1) * scale, offscreen.width);
                let alphaSquareSum = 0;
                let count = 0;
                for (let py = sy; py < eyEnd; py++) {
                    for (let px = sx; px < exEnd; px++) {
                        const idx = (py * offscreen.width + px) * 4 + 3;
                        alphaSquareSum +=
                            imgData.data[idx] * imgData.data[idx];
                        count++;
                    }
                }
                const rms =
                    count > 0 ? Math.sqrt(alphaSquareSum / count) : 0;
                row.push(rms > 80);
            }
            grid.push(row);
        }

        // Trim empty rows
        let firstRow = 0;
        while (
            firstRow < grid.length &&
            grid[firstRow].every((v) => !v)
        ) {
            firstRow++;
        }
        let lastRow = grid.length - 1;
        while (lastRow > firstRow && grid[lastRow].every((v) => !v)) {
            lastRow--;
        }

        const trimmed = grid.slice(firstRow, lastRow + 1);
        if (trimmed.length === 0) return [];

        // Trim empty cols
        let firstCol = trimmed[0].length;
        let lastCol = 0;
        for (const row of trimmed) {
            for (let c = 0; c < row.length; c++) {
                if (row[c]) {
                    firstCol = Math.min(firstCol, c);
                    lastCol = Math.max(lastCol, c);
                }
            }
        }

        return trimmed.map((row) => row.slice(firstCol, lastCol + 1));
    }

    // Vector font path: render large, downsample via RMS
    const fontSize = 256;
    ctx.font = `bold ${fontSize}px ${font}`;
    const metrics = ctx.measureText(text);

    const textWidth = Math.ceil(metrics.width);
    const textHeight = fontSize;
    offscreen.width = textWidth + 20;
    offscreen.height = textHeight + 20;

    ctx.font = `bold ${fontSize}px ${font}`;
    ctx.fillStyle = 'black';
    ctx.textBaseline = 'top';
    ctx.fillText(text, 10, 10);

    const imgData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);

    const cols = Math.round((offscreen.width / offscreen.height) * rows);
    const cellW = offscreen.width / cols;
    const cellH = offscreen.height / rows;

    const grid: boolean[][] = [];

    for (let r = 0; r < rows; r++) {
        const row: boolean[] = [];
        const startY = Math.floor(r * cellH);
        const endY = Math.min(offscreen.height, Math.floor((r + 1) * cellH));

        for (let c = 0; c < cols; c++) {
            const startX = Math.floor(c * cellW);
            const endX = Math.min(
                offscreen.width,
                Math.floor((c + 1) * cellW)
            );

            let alphaSquareSum = 0;
            let count = 0;
            for (let y = startY; y < endY; y++) {
                for (let x = startX; x < endX; x++) {
                    const idx = (y * offscreen.width + x) * 4 + 3;
                    alphaSquareSum += imgData.data[idx] * imgData.data[idx];
                    count++;
                }
            }
            const rmsAlpha = count > 0 ? Math.sqrt(alphaSquareSum / count) : 0;
            row.push(rmsAlpha > 80);
        }
        grid.push(row);
    }

    return grid;
}

export function LedMarquee({
    text,
    rows = 16,
    visibleCols,
    litColor,
    unlitColor,
    font = 'system-ui, sans-serif',
    height = 80,
    speed = 15,
    scroll = true,
    usePixelFont = false,
    nativePx,
    dotSize,
    pulse = false,
    scrollDirection = 'horizontal',
    visibleRows,
}: LedMarqueeProps): React.ReactNode {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        let cancelled = false;
        let animId = 0;
        let observer: MutationObserver | null = null;

        function start() {
            if (cancelled || !canvas) return;

            const grid = usePixelFont
                ? pixelFontToGrid(text)
                : textToDotMatrix(text, rows, font, nativePx);
            if (grid.length === 0) return;

            const actualRows = grid.length;
            const textCols = grid[0].length;
            const isVertical = scrollDirection === 'vertical';
            const displayCols = visibleCols
                ? Math.max(visibleCols, textCols)
                : textCols;
            const totalCols = displayCols + textCols;
            const displayRows =
                isVertical && visibleRows
                    ? Math.max(visibleRows, actualRows)
                    : actualRows;
            const totalVRows = displayRows + actualRows;
            const drawCols = isVertical ? textCols : displayCols;
            const drawRows = isVertical ? displayRows : actualRows;

            const dpr = window.devicePixelRatio || 1;
            const spaceRatio = 0.15;
            const dotDiameter =
                dotSize ??
                height / (drawRows + spaceRatio * (drawRows - 1));
            const space = dotDiameter * spaceRatio;
            const canvasWidth =
                drawCols * dotDiameter + (drawCols - 1) * space;
            const canvasHeight =
                drawRows * dotDiameter + (drawRows - 1) * space;

            canvas.width = Math.ceil(canvasWidth * dpr);
            canvas.height = Math.ceil(canvasHeight * dpr);
            canvas.style.width = `${canvasWidth}px`;
            canvas.style.height = `${canvasHeight}px`;

            function getColors() {
                const s = getComputedStyle(document.documentElement);
                return {
                    lit:
                        litColor ??
                        s.getPropertyValue('--foreground').trim(),
                    unlit:
                        unlitColor ??
                        s.getPropertyValue('--border').trim(),
                };
            }

            let colorsCache = getColors();

            function draw(offset: number, litOpacity = 1) {
                const ctx = canvas!.getContext('2d');
                if (!ctx) return;

                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.clearRect(0, 0, canvasWidth, canvasHeight);

                const radius = dotDiameter / 2;

                for (let r = 0; r < drawRows; r++) {
                    for (let vc = 0; vc < drawCols; vc++) {
                        const cx = radius + vc * (dotDiameter + space);
                        const cy = radius + r * (dotDiameter + space);

                        let isLit: boolean;
                        if (scroll && isVertical) {
                            const srcRow = r - offset + actualRows;
                            isLit =
                                srcRow >= 0 &&
                                srcRow < actualRows &&
                                vc < textCols &&
                                grid[srcRow][vc];
                        } else if (scroll) {
                            const srcCol = vc + offset - displayCols;
                            isLit =
                                srcCol >= 0 &&
                                srcCol < textCols &&
                                grid[r][srcCol];
                        } else {
                            isLit = vc < textCols && grid[r][vc];
                        }

                        ctx.beginPath();
                        ctx.arc(cx, cy, radius * 0.85, 0, Math.PI * 2);
                        if (isLit && litOpacity < 1) {
                            ctx.globalAlpha = litOpacity;
                            ctx.fillStyle = colorsCache.lit;
                            ctx.fill();
                            ctx.globalAlpha = 1;
                        } else {
                            ctx.fillStyle = isLit
                                ? colorsCache.lit
                                : colorsCache.unlit;
                            ctx.fill();
                        }
                    }
                }
            }

            if (scroll) {
                let lastTime = performance.now();
                let floatOffset = 0;

                function tick(now: number) {
                    if (cancelled) return;
                    const dt = (now - lastTime) / 1000;
                    lastTime = now;
                    floatOffset += speed * dt;

                    const total = isVertical ? totalVRows : totalCols;
                    if (floatOffset >= total) {
                        floatOffset -= total;
                    }

                    draw(Math.floor(floatOffset));
                    animId = requestAnimationFrame(tick);
                }

                animId = requestAnimationFrame(tick);
            } else if (pulse) {
                function pulseTick(now: number) {
                    if (cancelled) return;
                    // Gentle sine pulse: opacity oscillates between 0.4 and 1.0
                    const opacity =
                        0.7 + 0.3 * Math.sin((now / 1000) * Math.PI);
                    draw(0, opacity);
                    animId = requestAnimationFrame(pulseTick);
                }

                animId = requestAnimationFrame(pulseTick);
            } else {
                draw(0);
            }

            observer = new MutationObserver(() => {
                colorsCache = getColors();
                if (!scroll) draw(0);
            });
            observer.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['class'],
            });
        }

        // Wait for fonts to load before sampling
        document.fonts.ready.then(start);

        return () => {
            cancelled = true;
            cancelAnimationFrame(animId);
            observer?.disconnect();
        };
    }, [text, rows, visibleCols, visibleRows, font, height, litColor, unlitColor, speed, scroll, usePixelFont, nativePx, dotSize, pulse, scrollDirection]);

    return <canvas ref={canvasRef} className="max-w-full h-auto" />;
}
