import { useCallback, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

type DraggablePanelProps = {
    title: string;
    onClose: () => void;
    children: ReactNode;
    /** Initial position. Defaults to right-center of viewport. */
    defaultPosition?: { x: number; y: number };
    className?: string;
    /** Extra content rendered in the header bar, after the title. */
    headerActions?: ReactNode;
};

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
        defaultPosition ?? { x: window.innerWidth - 240, y: window.innerHeight / 2 - 150 }
    );
    const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

    const onPointerDown = useCallback(
        (e: React.PointerEvent) => {
            // Only drag from the header area
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
        setPosition({
            x: dragState.current.originX + dx,
            y: dragState.current.originY + dy,
        });
    }, []);

    const onPointerUp = useCallback(() => {
        dragState.current = null;
    }, []);

    return (
        <div
            ref={panelRef}
            className={cn(
                'pointer-events-auto fixed z-50',
                className
            )}
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
                <div className="px-3 pb-3">
                    {children}
                </div>
            </div>
        </div>
    );
}
