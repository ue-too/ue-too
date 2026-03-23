import { useTranslation } from 'react-i18next';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const LANGUAGES = [
    { code: 'en', label: 'EN' },
    { code: 'zh-TW', label: '中' },
] as const;

export function LanguageSwitcher() {
    const { i18n } = useTranslation();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="border-border text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors">
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
            <DropdownMenuContent align="end">
                {LANGUAGES.map(({ code, label }) => (
                    <DropdownMenuItem
                        key={code}
                        onClick={() => i18n.changeLanguage(code)}
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
