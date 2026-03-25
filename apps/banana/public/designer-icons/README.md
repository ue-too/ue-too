# Designer icon drop folder

Each icon has its own directory. Put the final SVG at:

`public/designer-icons/<slug>/<slug>.svg`

The **slug** matches the directory name and the file basename (without `.svg`).

Examples:

- React export `ExportSceneIcon` → `export-scene-icon/export-scene-icon.svg`
- React export `OctagonXIcon` → `octagon-x-icon/octagon-x-icon.svg`
- React export `Info` → `info/info.svg`
- React export `InfoIcon` → `info-icon/info-icon.svg`

The mapping from export name to slug is implemented in `src/pages/icon-handoff/designer-slug.ts` (`iconExportToDesignerFolder`). The **Icon handoff** page at `/icon-handoff` lists every slug next to the live app icon.

Bootstrap missing placeholder files (does not overwrite existing SVGs):

```bash
bun run generate:designer-icons
```

Replace all slots with the default placeholder again:

```bash
DESIGNER_ICONS_FORCE=1 bun run generate:designer-icons
```
