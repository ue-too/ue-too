import { useTranslation } from 'react-i18next';

const LANGUAGES = [
    { code: 'en', label: 'EN' },
    { code: 'zh-TW', label: '繁體中文' },
] as const;

export function LanguageSwitcher() {
    const { i18n } = useTranslation();

    const value =
        LANGUAGES.find((l) => i18n.language === l.code)?.code ??
        (i18n.language.startsWith('zh') ? 'zh-TW' : 'en');

    return (
        <select
            value={value}
            onChange={(e) => void i18n.changeLanguage(e.target.value)}
            className="border-border text-muted-foreground bg-background rounded-md border px-2 py-1 text-xs"
            aria-label="Language"
        >
            {LANGUAGES.map(({ code, label }) => (
                <option key={code} value={code}>
                    {label}
                </option>
            ))}
        </select>
    );
}
