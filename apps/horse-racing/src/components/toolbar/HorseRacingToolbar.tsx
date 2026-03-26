import { Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

export function HorseRacingToolbar() {
    const { t } = useTranslation();

    return (
        <div className="border-border bg-card/90 pointer-events-auto fixed top-4 left-4 z-20 flex items-center gap-2 rounded-lg border px-3 py-2 shadow-sm backdrop-blur">
            <Link
                to="/"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
            >
                <Home className="size-4 shrink-0" aria-hidden />
                <span>{t('toolbarHome')}</span>
            </Link>
        </div>
    );
}
