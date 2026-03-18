import { useTranslation } from 'react-i18next';

const LANGUAGES = [
    { code: 'en', label: 'EN' },
    { code: 'zh-TW', label: '中' },
] as const;

export function LanguageSwitcher() {
    const { i18n } = useTranslation();

    return (
        <div className="pointer-events-auto absolute top-3 right-3">
            <div className="bg-background/60 flex gap-0.5 rounded-lg p-0.5 backdrop-blur-sm">
                {LANGUAGES.map(({ code, label }) => (
                    <button
                        key={code}
                        type="button"
                        onClick={() => i18n.changeLanguage(code)}
                        className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                            i18n.language === code
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
        </div>
    );
}
