import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { LedMarquee } from '@/components/led-marquee';
import { LanguageSwitcher } from '@/components/toolbar/LanguageSwitcher';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { trackEvent } from '@/utils/analytics';

const FLAP_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
const FLAP_PAUSE = 10000;

function SplitFlapText({ text, animate }: { text: string; animate: boolean }) {
    const target = text.toUpperCase();
    const [displayed, setDisplayed] = useState(target);

    useEffect(() => {
        if (!animate) {
            setDisplayed(target);
            return;
        }

        let cancelled = false;

        function runCycle() {
            if (cancelled) return;

            const chars = target.split('');
            const current = new Array(chars.length).fill(' ');
            setDisplayed(current.join(''));

            const timers: ReturnType<typeof setTimeout>[] = [];

            // Calculate total animation duration
            let maxDelay = 0;

            for (let i = 0; i < chars.length; i++) {
                const targetChar = chars[i];
                const targetIdx = FLAP_CHARS.indexOf(targetChar);

                if (targetIdx === -1) {
                    const delay = i * 80;
                    maxDelay = Math.max(maxDelay, delay);
                    timers.push(
                        setTimeout(() => {
                            if (cancelled) return;
                            current[i] = targetChar;
                            setDisplayed(current.join(''));
                        }, delay)
                    );
                    continue;
                }

                const steps = Math.max(targetIdx, 1);

                for (let s = 0; s <= steps; s++) {
                    const delay = i * 80 + s * 30;
                    maxDelay = Math.max(maxDelay, delay);
                    timers.push(
                        setTimeout(() => {
                            if (cancelled) return;
                            current[i] =
                                s === steps
                                    ? targetChar
                                    : FLAP_CHARS[s % FLAP_CHARS.length];
                            setDisplayed(current.join(''));
                        }, delay)
                    );
                }
            }

            // Schedule next cycle after animation completes + pause
            timers.push(
                setTimeout(() => {
                    if (!cancelled) runCycle();
                }, maxDelay + FLAP_PAUSE)
            );

            return timers;
        }

        const timers = runCycle();

        return () => {
            cancelled = true;
            timers?.forEach(clearTimeout);
        };
    }, [target, animate]);

    return (
        <div className="flex justify-center gap-0.5">
            {displayed.split('').map((ch, i) => (
                <span
                    key={i}
                    className="bg-foreground text-background relative inline-flex h-7 w-5 items-center justify-center rounded-sm text-xs font-bold"
                >
                    {ch}
                    <span className="bg-background/20 absolute inset-x-0 top-1/2 h-px" />
                </span>
            ))}
        </div>
    );
}

export function LandingPage(): React.ReactNode {
    const { t, i18n } = useTranslation();
    const [reduceMotion, setReduceMotion] = useReduceMotion();
    const [ctaHover, setCtaHover] = useState(false);
    const isCJK =
        i18n.language.startsWith('zh') || i18n.language.startsWith('ja');

    const BULLET_COLORS = [
        'border-blue-400 text-blue-400',
        'border-emerald-400 text-emerald-400',
        'border-amber-400 text-amber-400',
    ];

    const groups = [
        {
            label: 'Build',
            i18nLabel: t('build'),
            prefix: 'B',
            items: [
                t('featureTrackDrawing'),
                t('featureTerrain'),
                t('featureStations'),
            ],
        },
        {
            label: 'Simulate',
            i18nLabel: t('simulate'),
            prefix: 'S',
            items: [
                t('featureTrainSim'),
                t('featureFormations'),
                t('featureImportExport'),
                t('featureGranularity'),
                t('featureDynamicFormations'),
            ],
        },
    ];

    return (
        <div className="bg-background text-foreground flex min-h-screen flex-col">
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
            <section className="flex flex-col items-center justify-center px-4 pt-20 pb-8 sm:px-6 sm:pt-40">
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
                <p className="text-muted-foreground mt-8 text-center text-base sm:text-lg">
                    {t('landingTagline1')}
                </p>
                <p className="text-muted-foreground mt-2 text-center text-base sm:text-lg">
                    {t('landingTagline2')}
                </p>
                <Link
                    to="/app"
                    className="mt-8 transition-opacity hover:opacity-75"
                    onMouseEnter={() => setCtaHover(true)}
                    onMouseLeave={() => setCtaHover(false)}
                    onClick={() => trackEvent('landing-open-simulator')}
                >
                    <LedMarquee
                        text={t('openSimulator') + ' →'}
                        height={isCJK ? 36 : 24}
                        dotSize={isCJK ? 3 : undefined}
                        scroll={false}
                        pulse={!reduceMotion && !ctaHover}
                        usePixelFont
                    />
                </Link>
                <Link
                    to="/app"
                    className="mt-8 transition-opacity hover:opacity-75"
                    onMouseEnter={() => setCtaHover(true)}
                    onMouseLeave={() => setCtaHover(false)}
                    onClick={() => trackEvent('landing-open-tutorial')}
                >
                    <LedMarquee
                        text={t('openTutorial') + ' →'}
                        height={isCJK ? 36 : 24}
                        dotSize={isCJK ? 3 : undefined}
                        scroll={false}
                        pulse={!reduceMotion && !ctaHover}
                        usePixelFont
                    />
                </Link>
            </section>

            {/* Features */}
            <section className="flex flex-col items-center gap-8 px-4 py-8 sm:gap-10 sm:px-6">
                {groups.map((group, gi) => (
                    <div
                        key={gi}
                        className="flex w-full max-w-lg flex-col items-center"
                    >
                        <div className="mb-4 flex flex-col items-center gap-1.5">
                            <SplitFlapText
                                text={group.label}
                                animate={!reduceMotion}
                            />
                            {group.i18nLabel.toLowerCase() !==
                                group.label.toLowerCase() && (
                                <SplitFlapText
                                    text={group.i18nLabel}
                                    animate={!reduceMotion}
                                />
                            )}
                        </div>
                        <ul className="space-y-2 self-start pl-2">
                            {group.items.map((item, ii) => (
                                <li
                                    key={ii}
                                    className="text-foreground flex items-start gap-2.5 text-sm"
                                >
                                    <span
                                        className={`${BULLET_COLORS[ii % BULLET_COLORS.length]} mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[8px] font-medium`}
                                    >
                                        {group.prefix}
                                        {ii + 1}
                                    </span>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </section>

            <div className="grow" />
            {/* Footer */}
            <footer className="text-muted-foreground px-6 pt-16 pb-4 text-center text-xs">
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
