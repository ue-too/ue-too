import { Hash, ListOrdered } from 'lucide-react';

import { DraggablePanel } from '@/components/ui/draggable-panel';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';

type DebugPanelProps = {
    showJointNumbers: boolean;
    onShowJointNumbersChange: (value: boolean) => void;
    showSegmentIds: boolean;
    onShowSegmentIdsChange: (value: boolean) => void;
    onClose: () => void;
};

export function DebugPanel({
    showJointNumbers,
    onShowJointNumbersChange,
    showSegmentIds,
    onShowSegmentIdsChange,
    onClose,
}: DebugPanelProps) {
    return (
        <DraggablePanel
            title="Debug"
            onClose={onClose}
            className="w-56"
        >
            <Separator className="mb-2" />
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-foreground">Joint numbers</span>
                    <Toggle
                        size="sm"
                        pressed={showJointNumbers}
                        onPressedChange={onShowJointNumbersChange}
                        aria-label="Toggle joint numbers"
                    >
                        <Hash className="size-3.5" />
                    </Toggle>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-foreground">Segment IDs</span>
                    <Toggle
                        size="sm"
                        pressed={showSegmentIds}
                        onPressedChange={onShowSegmentIdsChange}
                        aria-label="Toggle segment IDs"
                    >
                        <ListOrdered className="size-3.5" />
                    </Toggle>
                </div>
            </div>
        </DraggablePanel>
    );
}
