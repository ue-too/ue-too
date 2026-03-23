import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { LedMarquee } from '@/components/led-marquee';
import { LanguageSwitcher } from '@/components/toolbar/LanguageSwitcher';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

export function NotFoundPage(): React.ReactNode {
    const { t, i18n } = useTranslation();
    const [reduceMotion, setReduceMotion] = useReduceMotion();
    const isCJK =
        i18n.language.startsWith('zh') || i18n.language.startsWith('ja');

    return (
        <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-6 px-4 sm:gap-8 sm:px-6">
            {/* Controls */}
            <div className="fixed top-4 right-4 z-10 flex items-center gap-2">
                <LanguageSwitcher />
                <button
                    onClick={() => setReduceMotion(v => !v)}
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

            <LedMarquee
                text="404"
                rows={24}
                visibleRows={16}
                height={120}
                speed={12}
                scroll={!reduceMotion}
                scrollDirection="vertical"
            />
            <p className="text-muted-foreground text-center text-base sm:text-lg">
                {t('notFoundMessage')}
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
                <Link
                    to="/"
                    className="transition-opacity hover:opacity-75"
                >
                    <LedMarquee
                        text={t('backToHome') + ' →'}
                        height={isCJK ? 36 : 24}
                        dotSize={isCJK ? 3 : undefined}
                        scroll={false}
                        usePixelFont
                        pulse={!reduceMotion}
                    />
                </Link>
                <Link
                    to="/app"
                    className="transition-opacity hover:opacity-75"
                >
                    <LedMarquee
                        text={t('openSimulator') + ' →'}
                        height={isCJK ? 36 : 24}
                        dotSize={isCJK ? 3 : undefined}
                        scroll={false}
                        usePixelFont
                        pulse={!reduceMotion}
                    />
                </Link>
            </div>
        </div>
    );
}
