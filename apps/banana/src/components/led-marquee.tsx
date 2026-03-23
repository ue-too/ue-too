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
}

/**
 * Converts text into a grid of lit/unlit booleans by rendering to an
 * offscreen canvas and sampling pixel alpha values — same approach as
 * the train station info-board prototype.
 */
function textToDotMatrix(
    text: string,
    rows: number,
    font: string
): boolean[][] {
    const fontSize = 256;
    const offscreen = document.createElement('canvas');
    const ctx = offscreen.getContext('2d');
    if (!ctx) return [];

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
    visibleCols = 80,
    litColor,
    unlitColor,
    font = 'system-ui, sans-serif',
    height = 80,
    speed = 15,
    scroll = true,
    usePixelFont = false,
}: LedMarqueeProps): React.ReactNode {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const grid = usePixelFont
            ? pixelFontToGrid(text)
            : textToDotMatrix(text, rows, font);
        if (grid.length === 0) return;

        const actualRows = grid.length;
        const textCols = grid[0].length;
        const displayCols = scroll ? visibleCols : textCols;
        const totalCols = displayCols + textCols;

        const dpr = window.devicePixelRatio || 1;
        const spaceRatio = 0.15;
        const dotDiameter = height / (actualRows + spaceRatio * (actualRows - 1));
        const space = dotDiameter * spaceRatio;
        const canvasWidth =
            displayCols * dotDiameter + (displayCols - 1) * space;
        const canvasHeight =
            actualRows * dotDiameter + (actualRows - 1) * space;

        canvas.width = Math.ceil(canvasWidth * dpr);
        canvas.height = Math.ceil(canvasHeight * dpr);
        canvas.style.width = `${canvasWidth}px`;
        canvas.style.height = `${canvasHeight}px`;

        function getColors() {
            const s = getComputedStyle(document.documentElement);
            return {
                lit: litColor ?? s.getPropertyValue('--foreground').trim(),
                unlit: unlitColor ?? s.getPropertyValue('--border').trim(),
            };
        }

        let colorsCache = getColors();

        function draw(offset: number) {
            const ctx = canvas!.getContext('2d');
            if (!ctx) return;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, canvasWidth, canvasHeight);

            const radius = dotDiameter / 2;

            for (let r = 0; r < actualRows; r++) {
                for (let vc = 0; vc < displayCols; vc++) {
                    const cx = radius + vc * (dotDiameter + space);
                    const cy = radius + r * (dotDiameter + space);

                    let isLit: boolean;
                    if (scroll) {
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
                    ctx.fillStyle = isLit
                        ? colorsCache.lit
                        : colorsCache.unlit;
                    ctx.fill();
                }
            }
        }

        let animId = 0;

        if (scroll) {
            let lastTime = performance.now();
            let floatOffset = 0;

            function tick(now: number) {
                const dt = (now - lastTime) / 1000;
                lastTime = now;
                floatOffset += speed * dt;

                if (floatOffset >= totalCols) {
                    floatOffset -= totalCols;
                }

                draw(Math.floor(floatOffset));
                animId = requestAnimationFrame(tick);
            }

            animId = requestAnimationFrame(tick);
        } else {
            draw(0);
        }

        const observer = new MutationObserver(() => {
            colorsCache = getColors();
            if (!scroll) draw(0);
        });
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });

        return () => {
            cancelAnimationFrame(animId);
            observer.disconnect();
        };
    }, [text, rows, visibleCols, font, height, litColor, unlitColor, speed, scroll, usePixelFont]);

    return <canvas ref={canvasRef} />;
}
