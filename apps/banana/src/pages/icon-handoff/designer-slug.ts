/**
 * Maps a React export name (e.g. `ExportSceneIcon`, `OctagonXIcon`) to the
 * **designer handoff** folder and file basename under `public/designer-icons/`.
 *
 * Convention: `public/designer-icons/<slug>/<slug>.svg`
 *
 * Names ending in `Icon` use the stem (without `Icon`) converted to kebab-case,
 * then `"-icon"` is appended so acronyms like `X` in `OctagonXIcon` split correctly.
 *
 * @param exportName - PascalCase symbol name from `@/assets/icons`
 * @returns kebab-case slug (stable, unique per export)
 *
 * @example
 * `ExportSceneIcon` → `export-scene-icon`
 * `OctagonXIcon` → `octagon-x-icon`
 * `Info` → `info`, `InfoIcon` → `info-icon`
 */
export function iconExportToDesignerFolder(exportName: string): string {
    const hadIconSuffix =
        exportName.endsWith('Icon') && exportName.length > 'Icon'.length + 1;
    const base = hadIconSuffix
        ? exportName.slice(0, -'Icon'.length)
        : exportName;
    let kebab = base
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/([a-z])(\d)/g, '$1-$2')
        .toLowerCase();
    if (hadIconSuffix) {
        kebab += '-icon';
    }
    return kebab;
}
