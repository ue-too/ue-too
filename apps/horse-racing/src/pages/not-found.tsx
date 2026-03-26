import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { LanguageSwitcher } from '@/components/toolbar/LanguageSwitcher';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

export function NotFoundPage(): React.ReactNode {
    const { t } = useTranslation();
    const [reduceMotion, setReduceMotion] = useReduceMotion();

    return (
        <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-6 px-4">
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

            <p
                className={
                    reduceMotion
                        ? 'text-8xl font-bold tabular-nums'
                        : 'text-8xl font-bold tabular-nums motion-safe:animate-pulse'
                }
                aria-hidden
            >
                404
            </p>
            <p className="text-muted-foreground text-center text-base sm:text-lg">
                {t('notFoundMessage')}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                <Link
                    to="/"
                    className="text-primary hover:underline text-center text-sm font-medium"
                >
                    {t('backToHome')}
                </Link>
                <Link
                    to="/app"
                    className="text-primary hover:underline text-center text-sm font-medium"
                >
                    {t('openSimulator')}
                </Link>
            </div>
        </div>
    );
}
