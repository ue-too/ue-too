import { useState } from 'react';
import { Link } from 'react-router';

import { LedMarquee } from '@/components/led-marquee';

const groups = [
    {
        label: 'Build',
        items: [
            'Bézier Track Drawing',
            'Terrain & Heightmaps',
            'Stations & Buildings',
        ],
    },
    {
        label: 'Simulate',
        items: ['Train Simulation', 'Smooth Navigation', 'Import & Export'],
    },
];

export function LandingPage(): React.ReactNode {
    const [reduceMotion, setReduceMotion] = useState(false);

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Reduce motion toggle */}
            <div className="fixed top-4 right-4 z-10">
                <button
                    onClick={() => setReduceMotion((v) => !v)}
                    className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    title={
                        reduceMotion
                            ? 'Enable animations'
                            : 'Reduce animations'
                    }
                >
                    {reduceMotion ? 'Motion: off' : 'Motion: on'}
                </button>
            </div>

            {/* Hero */}
            <section className="flex flex-col items-center justify-center px-6 pt-40 pb-8">
                <LedMarquee
                    text="Banana"
                    rows={24}
                    visibleCols={80}
                    height={120}
                    speed={12}
                    scroll={!reduceMotion}
                />
                <p className="mt-8 text-center text-lg text-muted-foreground">
                    A 2D top-down railway simulator built with React and PixiJS.
                </p>
                <p className="mt-2 text-center text-lg text-muted-foreground">
                    Draw tracks, sculpt terrain, and run trains.
                </p>
                <Link
                    to="/app"
                    className="mt-8 transition-opacity hover:opacity-75"
                >
                    <LedMarquee
                        text="Open Simulator →"
                        height={24}
                        scroll={false}
                        usePixelFont
                    />
                </Link>
            </section>

            {/* Features */}
            <section className="flex flex-col items-center gap-10 px-6 py-8">
                {groups.map((group) => (
                    <div key={group.label} className="text-center">
                        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            {group.label}
                        </h3>
                        <ul className="mt-4 space-y-2">
                            {group.items.map((item) => (
                                <li
                                    key={item}
                                    className="text-sm text-foreground"
                                >
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </section>

            {/* Footer */}
            <footer className="px-6 pt-16 pb-8 text-center text-xs text-muted-foreground">
                <p>
                    Built with{' '}
                    <a
                        href="https://github.com/ue-too/ue-too"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 hover:text-foreground"
                    >
                        ue-too
                    </a>
                    {' · '}
                    <a
                        href="https://github.com/ue-too/ue-too/issues"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 hover:text-foreground"
                    >
                        Feedback
                    </a>
                </p>
            </footer>
        </div>
    );
}
