import { useTranslation } from 'react-i18next';

import { trackEvent } from '@/utils/analytics';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const LANGUAGES = [
    { code: 'en', label: 'EN' },
    { code: 'zh-TW', label: '繁體中文' },
] as const;

export function LanguageSwitcher() {
    const { i18n } = useTranslation();

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <button className="border-border text-muted-foreground hover:text-foreground bg-background/80 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs shadow-lg backdrop-blur-sm transition-colors">
                    {LANGUAGES.find(l => l.code === i18n.language)?.label ??
                        'EN'}
                    <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                        aria-hidden="true"
                    >
                        <path
                            d="M2.5 4L5 6.5L7.5 4"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-background/80 backdrop-blur-sm">
                {LANGUAGES.map(({ code, label }) => (
                    <DropdownMenuItem
                        key={code}
                        onClick={() => { i18n.changeLanguage(code); trackEvent('switch-language', { language: code }); }}
                        className={
                            i18n.language === code ? 'font-semibold' : ''
                        }
                    >
                        {label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
