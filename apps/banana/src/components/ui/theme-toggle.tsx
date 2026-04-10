import { useEffect, useState } from 'react';

import { Moon, Sun } from '@/assets/icons';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'banana-theme';

function getInitialTheme(): Theme {
    if (typeof window === 'undefined') return 'light';
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
}

function applyTheme(theme: Theme) {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
}

type ThemeToggleProps = {
    className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
    const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

    useEffect(() => {
        applyTheme(theme);
        window.localStorage.setItem(STORAGE_KEY, theme);
    }, [theme]);

    const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={toggle}
                    aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                    className={cn(
                        "bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground border shadow-lg backdrop-blur-sm transition-colors [&_svg:not([class*='size-'])]:size-3.5",
                        className
                    )}
                >
                    {theme === 'dark' ? <Sun /> : <Moon />}
                </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </TooltipContent>
        </Tooltip>
    );
}
