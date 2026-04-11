import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Github } from '@/assets/icons';
import { APP_DISPLAY_NAME } from '@/branding';

import { LedMarquee } from '@/components/led-marquee';
import { LanguageSwitcher } from '@/components/toolbar/LanguageSwitcher';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { trackEvent } from '@/utils/analytics';

const FLAP_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
const FLAP_PAUSE = 10000;

/** Minimum scale so text stays somewhat readable on tiny viewports. */
const FIT_SCALE_MIN = 0.28;

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
    const [hoveredCta, setHoveredCta] = useState<
        'sim' | 'tutorial' | 'editor' | null
    >(null);
    const [fitScale, setFitScale] = useState(1);
    const measureRef = useRef<HTMLDivElement>(null);
    const isCJK =
        i18n.language.startsWith('zh') || i18n.language.startsWith('ja');

    useLayoutEffect(() => {
        const el = measureRef.current;
        if (!el) return;

        const update = () => {
            requestAnimationFrame(() => {
                const node = measureRef.current;
                if (!node) return;

                const padTop = 72;
                const padSides = 16;
                const padBottom = 12;
                const vh = window.visualViewport?.height ?? window.innerHeight;
                const vw = window.visualViewport?.width ?? window.innerWidth;
                const maxH = vh - padTop - padBottom;
                const maxW = vw - padSides * 2;
                const nh = node.offsetHeight;
                const nw = node.offsetWidth;

                if (nh < 1 || nw < 1 || maxH < 1 || maxW < 1) return;

                const s = Math.min(1, maxH / nh, maxW / nw);
                setFitScale(Math.max(FIT_SCALE_MIN, s));
            });
        };

        update();

        const ro = new ResizeObserver(update);
        ro.observe(el);
        window.addEventListener('resize', update);
        window.visualViewport?.addEventListener('resize', update);
        document.fonts.ready.then(update);

        return () => {
            ro.disconnect();
            window.removeEventListener('resize', update);
            window.visualViewport?.removeEventListener('resize', update);
        };
    }, [i18n.language, reduceMotion]);

    useEffect(() => {
        const prevHtml = document.documentElement.style.overflow;
        const prevBody = document.body.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        return () => {
            document.documentElement.style.overflow = prevHtml;
            document.body.style.overflow = prevBody;
        };
    }, []);

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
        <div className="bg-background text-foreground relative h-dvh max-h-dvh w-full overflow-hidden">
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

            <div className="flex h-full w-full items-center justify-center px-3 pb-3 pt-[4.5rem]">
                <div
                    className="flex justify-center"
                    style={{
                        transform: `scale(${fitScale})`,
                        transformOrigin: 'center center',
                    }}
                >
                    <div
                        ref={measureRef}
                        className="flex w-[min(100vw-1.5rem,56rem)] flex-col items-stretch"
                    >
                        <section className="flex flex-col items-center px-4 pb-6 pt-4 sm:px-6">
                            <div className="relative">
                                <span className="text-muted-foreground absolute -top-6 left-0 text-xs tracking-wide">
                                    {t('nextStop')}
                                </span>
                                <LedMarquee
                                    text={APP_DISPLAY_NAME}
                                    rows={24}
                                    visibleCols={80}
                                    height={120}
                                    speed={12}
                                    scroll={!reduceMotion}
                                />
                            </div>
                            <p className="text-muted-foreground mt-7 text-center text-base sm:text-lg">
                                {t('landingTagline1')}
                            </p>
                            <p className="text-muted-foreground mt-2 text-center text-base sm:text-lg">
                                {t('landingTagline2')}
                            </p>
                            <Link
                                to="/app"
                                className="mt-7 transition-opacity hover:opacity-75"
                                onMouseEnter={() => setHoveredCta('sim')}
                                onMouseLeave={() => setHoveredCta(null)}
                                onClick={() =>
                                    trackEvent('landing-open-simulator')
                                }
                            >
                                <LedMarquee
                                    text={t('openSimulator') + ' →'}
                                    height={isCJK ? 36 : 24}
                                    dotSize={isCJK ? 3 : undefined}
                                    scroll={false}
                                    pulse={
                                        !reduceMotion && hoveredCta !== 'sim'
                                    }
                                    usePixelFont
                                />
                            </Link>
                            <Link
                                to="/app"
                                className="mt-7 transition-opacity hover:opacity-75"
                                onMouseEnter={() => setHoveredCta('tutorial')}
                                onMouseLeave={() => setHoveredCta(null)}
                                onClick={() =>
                                    trackEvent('landing-open-tutorial')
                                }
                            >
                                <LedMarquee
                                    text={t('openTutorial') + ' →'}
                                    height={isCJK ? 36 : 24}
                                    dotSize={isCJK ? 3 : undefined}
                                    scroll={false}
                                    pulse={
                                        !reduceMotion &&
                                        hoveredCta !== 'tutorial'
                                    }
                                    usePixelFont
                                />
                            </Link>
                            <Link
                                to="/train-editor"
                                className="mt-7 transition-opacity hover:opacity-75"
                                onMouseEnter={() => setHoveredCta('editor')}
                                onMouseLeave={() => setHoveredCta(null)}
                                onClick={() =>
                                    trackEvent('landing-open-car-editor')
                                }
                            >
                                <LedMarquee
                                    text={t('openCarEditor') + ' →'}
                                    height={isCJK ? 36 : 24}
                                    dotSize={isCJK ? 3 : undefined}
                                    scroll={false}
                                    pulse={
                                        !reduceMotion &&
                                        hoveredCta !== 'editor'
                                    }
                                    usePixelFont
                                />
                            </Link>
                        </section>

                        <section className="flex flex-col items-center gap-8 px-4 py-6 sm:gap-10 sm:px-6">
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
                                    <ul className="w-full space-y-2 self-start pl-2">
                                        {group.items.map((item, ii) => (
                                            <li
                                                key={ii}
                                                className="text-foreground flex items-start gap-2.5 text-sm leading-snug"
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

                        <footer className="text-muted-foreground px-6 pb-2 pt-8 text-center text-xs">
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
                                <a
                                    href="https://github.com/ue-too/ue-too/tree/main/apps/banana"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`${APP_DISPLAY_NAME} source on GitHub`}
                                    className="hover:text-foreground ml-1 inline-flex items-center align-middle transition-colors whitespace-nowrap"
                                >
                                    <Github className="h-3.5 w-3.5" />
                                </a>
                            </p>
                            {isCJK && (
                                <p className="mt-1">
                                    <Trans
                                        i18nKey="cjkFontCreditFooter"
                                        components={{
                                            cubic11: (
                                                <a
                                                    href="https://github.com/ACh-K/Cubic-11"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="hover:text-foreground underline underline-offset-2"
                                                />
                                            ),
                                        }}
                                    />
                                </p>
                            )}
                        </footer>
                    </div>
                </div>
            </div>
        </div>
    );
}
