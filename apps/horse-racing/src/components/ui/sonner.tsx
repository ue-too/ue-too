import { useTheme } from 'next-themes';
import type { CSSProperties } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

export function Toaster({ ...props }: ToasterProps) {
    const { theme = 'system' } = useTheme();

    return (
        <Sonner
            theme={theme as ToasterProps['theme']}
            className="toaster group"
            style={
                {
                    '--normal-bg': 'var(--popover)',
                    '--normal-text': 'var(--popover-foreground)',
                    '--normal-border': 'var(--border)',
                    '--border-radius': 'var(--radius)',
                    ...props.style,
                    zIndex: 100000,
                } as CSSProperties
            }
            {...props}
        />
    );
}
