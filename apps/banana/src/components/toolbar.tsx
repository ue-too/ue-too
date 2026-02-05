import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    Bold,
    ImageIcon,
    Italic,
    Link,
    List,
    ListOrdered,
    Redo,
    Underline,
    Undo,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export function Toolbar() {
    return (
        <Card className="pointer-events-auto w-fit flex-row items-center gap-1 px-2 py-1.5">
            {/* History Controls */}
            <Button variant="ghost" size="icon-sm" aria-label="Undo">
                <Undo />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Redo">
                <Redo />
            </Button>

            <Separator orientation="vertical" className="mx-1 h-6!" />

            {/* Text Formatting */}
            <Button variant="ghost" size="icon-sm" aria-label="Bold">
                <Bold />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Italic">
                <Italic />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Underline">
                <Underline />
            </Button>

            <Separator orientation="vertical" className="mx-1 h-6!" />

            {/* Alignment */}
            <Button variant="ghost" size="icon-sm" aria-label="Align left">
                <AlignLeft />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Align center">
                <AlignCenter />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Align right">
                <AlignRight />
            </Button>

            <Separator orientation="vertical" className="mx-1 h-6!" />

            {/* Lists */}
            <Button variant="ghost" size="icon-sm" aria-label="Bullet list">
                <List />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Numbered list">
                <ListOrdered />
            </Button>

            <Separator orientation="vertical" className="mx-1 h-6!" />

            {/* Insert */}
            <Button variant="ghost" size="sm" className="gap-1.5">
                <Link className="size-4" />
                <span>Link</span>
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5">
                <ImageIcon className="size-4" />
                <span>Image</span>
            </Button>
        </Card>
    );
}
