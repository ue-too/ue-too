import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from '@/assets/icons';
import { Button } from './button';
import { cn } from '@/lib/utils';

const VIEWPORT_PADDING = 8;

type DraggablePanelProps = {
    title: string;
    onClose: () => void;
    children: ReactNode;
    /** Initial position. Defaults to near the left toolbar. */
    defaultPosition?: { x: number; y: number };
    className?: string;
    /** Extra content rendered in the header bar, after the title. */
    headerActions?: ReactNode;
};

/** Clamp position so the panel stays fully within the viewport. */
function clampPosition(
    x: number,
    y: number,
    panelW: number,
    panelH: number
): { x: number; y: number } {
    const maxX = window.innerWidth - panelW - VIEWPORT_PADDING;
    const maxY = window.innerHeight - panelH - VIEWPORT_PADDING;
    return {
        x: Math.max(VIEWPORT_PADDING, Math.min(x, maxX)),
        y: Math.max(VIEWPORT_PADDING, Math.min(y, maxY)),
    };
}

export function DraggablePanel({
    title,
    onClose,
    children,
    defaultPosition,
    className,
    headerActions,
}: DraggablePanelProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState(
        defaultPosition ?? { x: 80, y: window.innerHeight / 2 - 150 }
    );
    const dragState = useRef<{
        startX: number;
        startY: number;
        originX: number;
        originY: number;
    } | null>(null);

    // After first render, clamp position to ensure the panel is fully visible
    useEffect(() => {
        const el = panelRef.current;
        if (!el) return;
        // Wait one frame for layout to settle
        requestAnimationFrame(() => {
            const rect = el.getBoundingClientRect();
            const clamped = clampPosition(
                position.x,
                position.y,
                rect.width,
                rect.height
            );
            if (clamped.x !== position.x || clamped.y !== position.y) {
                setPosition(clamped);
            }
        });
        // Only run on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onPointerDown = useCallback(
        (e: React.PointerEvent) => {
            e.preventDefault();
            e.stopPropagation();
            dragState.current = {
                startX: e.clientX,
                startY: e.clientY,
                originX: position.x,
                originY: position.y,
            };
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
        },
        [position]
    );

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragState.current) return;
        const dx = e.clientX - dragState.current.startX;
        const dy = e.clientY - dragState.current.startY;
        const el = panelRef.current;
        const w = el?.offsetWidth ?? 0;
        const h = el?.offsetHeight ?? 0;
        setPosition(
            clampPosition(
                dragState.current.originX + dx,
                dragState.current.originY + dy,
                w,
                h
            )
        );
    }, []);

    const onPointerUp = useCallback(() => {
        dragState.current = null;
    }, []);

    // Compute max-height for the content area so the panel doesn't overflow the viewport bottom
    const maxContentHeight =
        window.innerHeight -
        position.y -
        VIEWPORT_PADDING -
        // Reserve space for the header (~40px) and content padding (12px)
        52;

    return (
        <div
            ref={panelRef}
            className={cn('pointer-events-auto fixed z-50', className)}
            style={{ left: position.x, top: position.y }}
        >
            <div className="bg-background/80 flex flex-col rounded-xl border shadow-lg backdrop-blur-sm">
                {/* Draggable header */}
                <div
                    className="flex cursor-grab items-center justify-between px-3 py-2 active:cursor-grabbing select-none"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                >
                    <span className="text-foreground text-sm font-medium">
                        {title}
                    </span>
                    <div className="flex items-center gap-0.5">
                        {headerActions}
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={onClose}
                        >
                            <X className="size-3.5" />
                        </Button>
                    </div>
                </div>
                {/* Content */}
                <div
                    className="overflow-y-auto px-3 pb-3"
                    style={{
                        maxHeight: Math.max(maxContentHeight, 100),
                    }}
                >
                    {children}
                </div>
            </div>
        </div>
    );
}
