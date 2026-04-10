import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

type SaveCarDefinitionDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialName: string;
    /** True when saving over an existing entry — changes the title/description copy. */
    updatingExisting?: boolean;
    onConfirm: (name: string) => void;
};

export function SaveCarDefinitionDialog({
    open,
    onOpenChange,
    initialName,
    updatingExisting = false,
    onConfirm,
}: SaveCarDefinitionDialogProps) {
    const { t } = useTranslation();
    const [name, setName] = useState(initialName);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setName(initialName);
            setTimeout(() => inputRef.current?.select(), 0);
        }
    }, [open, initialName]);

    const confirm = () => {
        const trimmed = name.trim();
        if (!trimmed) return;
        onConfirm(trimmed);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>
                        {updatingExisting
                            ? t('saveCarDefinitionUpdateTitle')
                            : t('saveCarDefinitionTitle')}
                    </DialogTitle>
                    <DialogDescription>
                        {updatingExisting
                            ? t('saveCarDefinitionUpdateDescription')
                            : t('saveCarDefinitionDescription')}
                    </DialogDescription>
                </DialogHeader>
                <input
                    ref={inputRef}
                    className="bg-background w-full rounded border px-2 py-1.5 text-sm"
                    value={name}
                    placeholder={t('carDefinitionNamePlaceholder')}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') confirm();
                        if (e.key === 'Escape') onOpenChange(false);
                    }}
                />
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        {t('cancel')}
                    </Button>
                    <Button onClick={confirm} disabled={!name.trim()}>
                        {t('save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
