import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { APP_DISPLAY_NAME } from '@/branding';
import { LanguageSwitcher } from '@/components/toolbar/LanguageSwitcher';
import { cn } from '@/lib/utils';

import {
    ICON_HANDOFF_ROWS,
    type IconHandoffAssetRow,
    type IconHandoffComponentRow,
} from './icon-handoff-data';
import { ICON_COMPONENTS } from './icon-registry';

function CurrentIconPreview({ exportName }: { exportName: string }) {
    const C = ICON_COMPONENTS[exportName];
    if (!C) {
        return (
            <span className="text-muted-foreground font-mono text-xs">—</span>
        );
    }
    const spin = exportName === 'Loader2Icon';
    return (
        <C
            className={cn(
                'size-8 shrink-0 text-foreground',
                spin && 'animate-spin'
            )}
            aria-hidden
        />
    );
}

function DesignerIconPreview({ slug }: { slug: string }) {
    const src = `/designer-icons/${slug}/${slug}.svg`;
    return (
        <div
            className={cn(
                'flex size-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-muted-foreground/35 bg-muted/25 p-2'
            )}
        >
            <img
                src={src}
                alt=""
                className="max-h-14 max-w-14 object-contain text-foreground"
            />
        </div>
    );
}

function HandoffTable({
    title,
    subtitle,
    rows,
}: {
    title: string;
    subtitle?: string;
    rows: readonly (IconHandoffComponentRow | IconHandoffAssetRow)[];
}) {
    const { t } = useTranslation(undefined, { keyPrefix: 'iconHandoff' });

    return (
        <section className="mb-14">
            <h2 className="text-foreground mb-1 text-xl font-semibold tracking-tight">
                {title}
            </h2>
            {subtitle ? (
                <p className="text-muted-foreground mb-4 max-w-3xl text-sm">
                    {subtitle}
                </p>
            ) : null}
            <div className="border-border overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <thead>
                        <tr className="bg-muted/40 border-b">
                            <th className="text-foreground w-[200px] px-3 py-2.5 font-medium">
                                {t('tableName')}
                            </th>
                            <th className="text-foreground w-[120px] px-3 py-2.5 font-medium">
                                {t('tableCurrent')}
                            </th>
                            <th className="text-foreground w-[120px] px-3 py-2.5 font-medium">
                                {t('tableDesigner')}
                            </th>
                            <th className="text-foreground px-3 py-2.5 font-medium">
                                {t('tableUsedFor')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(row => {
                            if (row.kind === 'asset') {
                                return (
                                    <tr
                                        key={row.designerSlug}
                                        className="border-border border-b last:border-b-0"
                                    >
                                        <td className="text-foreground align-top px-3 py-3 font-mono text-xs">
                                            <div className="font-sans text-sm font-medium">
                                                {t(`assetLabel.${row.descKey}`)}
                                            </div>
                                            <div className="text-muted-foreground mt-1 text-[11px]">
                                                {row.designerSlug}/
                                                {row.designerSlug}.svg
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 align-middle">
                                            {row.currentSrc ? (
                                                <div className="flex size-20 items-center justify-center rounded-lg border bg-muted/20 p-2">
                                                    <img
                                                        src={row.currentSrc}
                                                        alt=""
                                                        className="max-h-12 max-w-12 object-contain"
                                                    />
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">
                                                    {t('inlineSvgNote')}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 align-middle">
                                            <DesignerIconPreview
                                                slug={row.designerSlug}
                                            />
                                        </td>
                                        <td className="text-muted-foreground align-top px-3 py-3 leading-relaxed">
                                            {t(`desc.${row.descKey}`, {
                                                appName: APP_DISPLAY_NAME,
                                            })}
                                        </td>
                                    </tr>
                                );
                            }
                            return (
                                <tr
                                    key={row.exportName}
                                    className="border-border border-b last:border-b-0"
                                >
                                    <td className="text-foreground align-top px-3 py-3 font-mono text-xs">
                                        <div>{row.exportName}</div>
                                        <div className="text-muted-foreground mt-1 text-[11px]">
                                            {row.designerSlug}/
                                            {row.designerSlug}.svg
                                        </div>
                                    </td>
                                    <td className="px-3 py-3 align-middle">
                                        <div className="flex size-20 items-center justify-center rounded-lg border bg-muted/20">
                                            <CurrentIconPreview
                                                exportName={row.exportName}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-3 py-3 align-middle">
                                        <DesignerIconPreview
                                            slug={row.designerSlug}
                                        />
                                    </td>
                                    <td className="text-muted-foreground align-top px-3 py-3 leading-relaxed">
                                        {t(`desc.${row.exportName}`, {
                                            appName: APP_DISPLAY_NAME,
                                        })}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

export function IconHandoffPage(): ReactNode {
    const { t } = useTranslation(undefined, { keyPrefix: 'iconHandoff' });

    const customRows = ICON_HANDOFF_ROWS.filter(
        (r): r is IconHandoffComponentRow =>
            r.kind === 'component' && r.category === 'custom'
    );
    const lucideRows = ICON_HANDOFF_ROWS.filter(
        (r): r is IconHandoffComponentRow =>
            r.kind === 'component' && r.category === 'lucide'
    );
    const assetRows = ICON_HANDOFF_ROWS.filter(
        (r): r is IconHandoffAssetRow => r.kind === 'asset'
    );

    return (
        <div className="bg-background text-foreground min-h-screen">
            <div className="fixed top-4 right-4 z-10">
                <LanguageSwitcher />
            </div>

            <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
                <div className="mb-10 flex flex-wrap items-baseline justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight">
                            {t('title')}
                        </h1>
                        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
                            {t('intro', { appName: APP_DISPLAY_NAME })}{' '}
                            <a
                                href="https://lucide.dev/icons/"
                                className="text-primary underline-offset-2 hover:underline"
                                target="_blank"
                                rel="noreferrer"
                            >
                                {t('lucideLinkLabel')}
                            </a>
                            {t('introClosing')}
                        </p>
                    </div>
                    <Link
                        to="/"
                        className="text-muted-foreground hover:text-foreground text-sm underline-offset-2 hover:underline"
                    >
                        {t('backToLanding')}
                    </Link>
                </div>

                <div className="bg-muted/30 border-border mb-10 rounded-xl border p-4 text-sm leading-relaxed">
                    <p className="text-foreground font-medium">
                        {t('conventionTitle')}
                    </p>
                    <p className="text-muted-foreground mt-2 whitespace-pre-line">
                        {t('conventionP1')}
                    </p>
                    <p className="text-muted-foreground mt-3 whitespace-pre-line">
                        {t('conventionP2')}
                    </p>
                    <p className="text-muted-foreground mt-3 whitespace-pre-line">
                        {t('conventionP3')}
                    </p>
                    <p className="text-muted-foreground mt-3 whitespace-pre-line">
                        {t('conventionP4')}
                    </p>
                </div>

                <HandoffTable
                    title={t('sectionCustomTitle')}
                    subtitle={t('sectionCustomSubtitle')}
                    rows={customRows}
                />

                <HandoffTable
                    title={t('sectionLucideTitle')}
                    subtitle={t('sectionLucideSubtitle')}
                    rows={lucideRows}
                />

                <HandoffTable
                    title={t('sectionOtherTitle')}
                    subtitle={t('sectionOtherSubtitle')}
                    rows={assetRows}
                />

                <footer className="text-muted-foreground border-border mt-4 border-t pt-6 text-xs">
                    {t('footerIntro')}{' '}
                    <code className="bg-muted rounded px-1 py-0.5 font-mono">
                        {t('footerFile')}
                    </code>{' '}
                    {t('footerOutro')}
                </footer>
            </div>
        </div>
    );
}
