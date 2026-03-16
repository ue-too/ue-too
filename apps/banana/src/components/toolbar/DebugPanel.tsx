import { Hash, ListOrdered, TrainFront } from 'lucide-react';

import { DraggablePanel } from '@/components/ui/draggable-panel';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';

type DebugPanelProps = {
    showJointNumbers: boolean;
    onShowJointNumbersChange: (value: boolean) => void;
    showSegmentIds: boolean;
    onShowSegmentIdsChange: (value: boolean) => void;
    showFormationIds: boolean;
    onShowFormationIdsChange: (value: boolean) => void;
    onClose: () => void;
};

export function DebugPanel({
    showJointNumbers,
    onShowJointNumbersChange,
    showSegmentIds,
    onShowSegmentIdsChange,
    showFormationIds,
    onShowFormationIdsChange,
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
                <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-foreground">Formation IDs</span>
                    <Toggle
                        size="sm"
                        pressed={showFormationIds}
                        onPressedChange={onShowFormationIdsChange}
                        aria-label="Toggle formation IDs"
                    >
                        <TrainFront className="size-3.5" />
                    </Toggle>
                </div>
            </div>
        </DraggablePanel>
    );
}
