import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { LanguageSwitcher } from '@/components/toolbar/LanguageSwitcher';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

export function LandingPage(): React.ReactNode {
    const { t } = useTranslation();
    const [reduceMotion, setReduceMotion] = useReduceMotion();

    return (
        <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-8 px-6">
            <div className="fixed top-4 right-4 z-10 flex items-center gap-2">
                <LanguageSwitcher />
                <button
                    type="button"
                    onClick={() => setReduceMotion((v) => !v)}
                    className="border-border text-muted-foreground hover:text-foreground rounded-md border px-2 py-1 text-xs transition-colors"
                    title={
                        reduceMotion
                            ? t('enableAnimations')
                            : t('reduceAnimations')
                    }
                >
                    {reduceMotion ? t('motionOff') : t('motionOn')}
                </button>
            </div>

            <div className="max-w-lg text-center">
                <h1
                    className={
                        reduceMotion
                            ? 'text-4xl font-semibold tracking-tight sm:text-5xl'
                            : 'text-4xl font-semibold tracking-tight transition-transform duration-500 ease-out hover:scale-[1.02] sm:text-5xl'
                    }
                >
                    {t('heroTitle')}
                </h1>
                <p className="text-muted-foreground mt-4 text-base sm:text-lg">
                    {t('heroSubtitle')}
                </p>
            </div>

            <Link
                to="/app"
                className="bg-primary text-primary-foreground hover:opacity-90 inline-flex rounded-lg px-6 py-3 text-sm font-medium transition-opacity"
            >
                {t('openSimulator')}
            </Link>
        </div>
    );
}
