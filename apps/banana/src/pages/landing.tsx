import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { LedMarquee } from '@/components/led-marquee';
import { LanguageSwitcher } from '@/components/toolbar/LanguageSwitcher';

export function LandingPage(): React.ReactNode {
    const { t, i18n } = useTranslation();
    const [reduceMotion, setReduceMotion] = useState(false);
    const isCJK =
        i18n.language.startsWith('zh') || i18n.language.startsWith('ja');

    const groups = [
        {
            label: t('build'),
            items: [
                t('featureTrackDrawing'),
                t('featureTerrain'),
                t('featureStations'),
            ],
        },
        {
            label: t('simulate'),
            items: [
                t('featureTrainSim'),
                t('featureFormations'),
                t('featureImportExport'),
            ],
        },
    ];

    return (
        <div className="bg-background text-foreground min-h-screen">
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

            {/* Hero */}
            <section className="flex flex-col items-center justify-center px-6 pt-40 pb-8">
                <div className="relative">
                    <span className="text-muted-foreground absolute -top-6 left-0 text-xs tracking-wide">
                        {t('nextStop')}
                    </span>
                    <LedMarquee
                        text="Banana"
                        rows={24}
                        visibleCols={80}
                        height={120}
                        speed={12}
                        scroll={!reduceMotion}
                    />
                </div>
                <p className="text-muted-foreground mt-8 text-center text-lg">
                    {t('landingTagline1')}
                </p>
                <p className="text-muted-foreground mt-2 text-center text-lg">
                    {t('landingTagline2')}
                </p>
                <Link
                    to="/app"
                    className="mt-8 transition-opacity hover:opacity-75"
                >
                    <LedMarquee
                        text={t('openSimulator') + ' →'}
                        height={isCJK ? 36 : 24}
                        dotSize={isCJK ? 3 : undefined}
                        scroll={false}
                        pulse={!reduceMotion}
                        usePixelFont
                    />
                </Link>
            </section>

            {/* Features */}
            <section className="flex flex-col items-center gap-10 px-6 py-8">
                {groups.map(group => (
                    <div key={group.label} className="text-center">
                        <h3 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                            {group.label}
                        </h3>
                        <ul className="mt-4 list-disc space-y-2 text-left">
                            {group.items.map(item => (
                                <li
                                    key={item}
                                    className="text-foreground text-sm"
                                >
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </section>

            {/* Footer */}
            <footer className="text-muted-foreground px-6 pt-16 pb-8 text-center text-xs">
                <p>
                    <Trans
                        i18nKey="builtWithFooter"
                        components={{
                            ueToo: (
                                <a
                                    href="https://github.com/ue-too/ue-too"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-foreground underline underline-offset-2"
                                />
                            ),
                            issues: (
                                <a
                                    href="https://github.com/ue-too/ue-too/issues"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-foreground underline underline-offset-2"
                                />
                            ),
                        }}
                    />
                </p>
            </footer>
        </div>
    );
}
