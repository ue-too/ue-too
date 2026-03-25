# Banana — icon inventory

This document lists every icon surface in the **Banana** app for design handoff (redraw, style alignment, or asset export).  
Code imports icons only from **`@/assets/icons`** (`src/assets/icons/index.ts`). Lucide symbols are re-exported in `src/assets/icons/lucide.ts`; custom SVGs live alongside as React components.

**Visual handoff page:** open **`/icon-handoff`** in the Banana dev server — it shows each icon’s **current** React preview, a **designer** slot loaded from `public/designer-icons/<slug>/<slug>.svg`, and the same “used for” text as below (UI + descriptions follow **English** / **繁體中文** via the language switcher; strings live under `translation.iconHandoff` in `src/i18n/locales/icon-handoff-en.ts` and `icon-handoff-zh-TW.ts`). See `public/designer-icons/README.md` for folder rules and `bun run generate:designer-icons` for placeholder bootstrap.

**Package:** Lucide React `^0.563.0` — designer reference: [Lucide icons](https://lucide.dev/icons/).

---

## 1. Custom app icons (React components)

First-party SVGs in code (not from Lucide). Strong candidates for bespoke illustration or exported assets.

| Export | File | Used for |
|--------|------|----------|
| `BulldozerIcon` | `src/assets/icons/bulldozer.tsx` | Toggle **track layout deletion** mode (remove track segments). Shown when layout editing is active. Source note in file: adapted from Tabler Icons. |
| `ExportTrackIcon` | `src/assets/icons/export-track.tsx` | **Export tracks and stations** to JSON (hover submenu action). |
| `ImportTrackIcon` | `src/assets/icons/import-track.tsx` | **Import tracks and stations** from JSON. |
| `ExportTrainIcon` | `src/assets/icons/export-train.tsx` | **Export trains** (formations / train data) to JSON. |
| `ImportTrainIcon` | `src/assets/icons/import-train.tsx` | **Import trains** from JSON. |
| `ExportSceneIcon` | `src/assets/icons/export-scene.tsx` | **Export full scene** (everything bundled). |
| `ImportSceneIcon` | `src/assets/icons/import-scene.tsx` | **Import full scene** from JSON. |

**Wiring:** `ExportSubmenu.tsx` (all six import/export scene variants + Lucide triggers), `LayoutDeletionToolbar.tsx` (bulldozer).

---

## 2. Lucide icons — what each one is for

Use the **exact export name** when matching [lucide.dev](https://lucide.dev/icons/) or briefing a designer.

| Icon | Used for |
|------|----------|
| `Activity` | Debug panel: toggle **FPS / performance stats** overlay. |
| `ArrowDown` | Formation editor: move a **composition segment down** in order (swap with next). |
| `ArrowLeftRight` | **Train panel:** reverse travel direction of the selected train. **Formation editor:** reverse order of cars in a formation (“reverse composition”). |
| `ArrowUp` | Formation editor: move a **composition segment up** in order (swap with previous). |
| `Bug` | Main toolbar: open / close the **debug** panel. |
| `Building2` | *Reserved:* main toolbar button for **building placement** is **commented out** in code; icon kept for when that mode returns. |
| `Check` | Station list: confirm **finished picking platforms** for a station (exit platform-assignment mode). |
| `CheckIcon` | Dropdown menu: shows **selected item** in selectable menu rows (shadcn pattern). |
| `Clock` | Main toolbar: open / close **timetable panel** (shift scheduling, routes, and auto-driving assignments). |
| `ChevronDown` | Formation editor: **collapsed** state chevron on formation cards; **append** selected stock car / depot formation to the end of the composition. |
| `ChevronLeft` | Simulation time control: **decrease time speed** (step down through speed presets). |
| `ChevronRight` | Simulation time control: **increase time speed** (step up through speed presets). |
| `ChevronRightIcon` | Dropdown menu: **submenu** affordance (row has a nested menu). |
| `ChevronUp` | Formation editor: **expanded** state chevron on formation cards; **prepend** selected stock car / depot formation to the start of the composition. |
| `CircleCheckIcon` | Toast (**Sonner**): **success** notification icon. |
| `CircleIcon` | Dropdown menu: **radio-style** unselected bullet for single-choice items. |
| `Crosshair` | **Train panel:** start/stop **camera follow** on the selected train. **Station list:** **pan / locate** the map on a station. |
| `Download` | **Export submenu:** parent button that opens import/export flyout (download metaphor). **Terrain editor:** **export terrain** JSON. **Train editor:** **export car definition** JSON (needs valid bogies). |
| `Eraser` | Terrain editor: **erase water** brush mode (remove painted water). |
| `Eye` | Debug panel: toggle **terrain X-ray** (see through / debug terrain rendering). |
| `Focus` | Train panel: **focus camera** on the selected train (animated zoom/pan to train). |
| `Gauge` | Export submenu: **import car definition from train editor** (speedometer metaphor for vehicle spec). |
| `Github` | Landing page footer: link to **Banana app source** on GitHub (`aria-label`: Banana source on GitHub). |
| `GripHorizontal` | Train editor: toggle **edit train car image** mode (resize/move sprite). |
| `Hash` | Debug panel: toggle **track joint numbers** overlay. |
| `Image` | Train editor: **import** raster image onto the car body. |
| `Info` | Map attribution bar: **toggle expanded map attribution** (OpenStreetMap / Protomaps credits). |
| `InfoIcon` | Toast: **info** notification icon. |
| `Landmark` | Main toolbar: open / close **station list** panel. Debug panel: toggle **station location** markers. |
| `Layers` | Main toolbar: toggle **elevation gradient** overlay on the scene. Formation editor: section label icon for formations **in depot** (vs on track). Terrain editor: **toggle map overlay** under the paint canvas. |
| `Link2` | Formation editor: badge and button for **coupling** compatible trains; debug panel: **coupling proximity lines** overlay. |
| `List` | Main toolbar: open / close **train list** panel. |
| `ListOrdered` | Main toolbar: open / close **formation editor** (ordered consist / formation management). Debug panel: toggle **segment IDs** on track. |
| `Loader2Icon` | Toast: **loading** state (spinner). |
| `Map` | Main toolbar (when enabled): **show / hide** basemap under the canvas. |
| `MapPin` | Debug panel: toggle **station stop** positions overlay. |
| `Merge` | Formation editor: **consolidate** nested formations into a flat composition (when nested groups exist). |
| `Mountain` | Terrain controls: **terrain fill visibility** toggle (mountain = ground terrain). Export submenu: **import terrain** data. |
| `MousePointer2` | Train editor: **edit bogies** mode (place/adjust wheel positions). |
| `OctagonXIcon` | Toast: **error** notification icon. |
| `Package` | Terrain editor: **export terrain as scene** bundle for use in the main Banana app. |
| `Pause` | Simulation time control: **pause** the world clock (shown while running). |
| `Pencil` | Depot: **rename** a car in stock (edit name). Formation editor: **rename** formation (inline edit trigger). |
| `Play` | Simulation time control: **resume** the world clock (shown while paused). |
| `Plus` | Depot: **create new car** in stock; duplicate **template** into stock. Formation editor: **create new formation**. Train editor: **add bogie** mode. |
| `Scissors` | Formation editor: **decouple** trains at a boundary between cars (split consist at scissors control). |
| `Settings2` | Station list: enter **pick platforms** mode to assign platforms to a station. |
| `Snowflake` | Terrain controls: **white occlusion / snow-style** terrain shading toggle. |
| `Spline` | Main toolbar: show / hide **preview curve arcs** when laying track. |
| `Sun` | Lighting widget: adjust **sun angle** (0–360°) for scene lighting. |
| `TrainFront` | Main toolbar: **train placement** mode. Formation selector bar: decorative label next to “Formation” dropdown. Formation editor: **on-track** formations section header. Debug panel: toggle **formation IDs** overlay. |
| `TrainTrack` | Main toolbar: enter / exit **track layout** editing mode. |
| `Trash2` | Remove **selected train**; delete **station**; delete **formation** or composition row; remove **car** from depot; remove **track-layout** button exists in commented building UI. Primary destructive list icon across panels. |
| `TriangleAlertIcon` | Toast: **warning** notification icon. |
| `Upload` | Terrain editor: **import terrain** JSON. Train editor: **import car definition** JSON. |
| `Warehouse` | Main toolbar: **depot** panel (car stock). Second button uses same icon for **station placement** mode (warehouse / yard metaphor). |
| `X` | **Close** draggable panels (generic). Station list: **cancel** platform-picking mode. |

**Quick alphabetical index (57):**
`Activity`, `ArrowDown`, `ArrowLeftRight`, `ArrowUp`, `Bug`, `Building2`, `Check`, `CheckIcon`, `Clock`, `ChevronDown`, `ChevronLeft`, `ChevronRight`, `ChevronRightIcon`, `ChevronUp`, `CircleCheckIcon`, `CircleIcon`, `Crosshair`, `Download`, `Eraser`, `Eye`, `Focus`, `Gauge`, `Github`, `GripHorizontal`, `Hash`, `Image`, `Info`, `InfoIcon`, `Landmark`, `Layers`, `Link2`, `List`, `ListOrdered`, `Loader2Icon`, `Map`, `MapPin`, `Merge`, `Mountain`, `MousePointer2`, `OctagonXIcon`, `Package`, `Pause`, `Pencil`, `Play`, `Plus`, `Scissors`, `Settings2`, `Snowflake`, `Spline`, `Sun`, `TrainFront`, `TrainTrack`, `Trash2`, `TriangleAlertIcon`, `Upload`, `Warehouse`, `X`

### Rough grouping by feature (for briefs)

| Area | Lucide names |
|------|----------------|
| Main toolbar / modes | `Bug`, `Building2`, `Clock`, `Landmark`, `Layers`, `List`, `ListOrdered`, `Map`, `Spline`, `TrainFront`, `TrainTrack`, `Trash2`, `Warehouse` |
| Time / playback | `ChevronLeft`, `ChevronRight`, `Pause`, `Play` |
| Terrain / environment | `Eraser`, `Layers`, `Mountain`, `Package`, `Snowflake`, `Sun` |
| Stations / depots / trains | `ArrowLeftRight`, `Crosshair`, `Focus`, `Pencil`, `Plus`, `Settings2`, `TrainFront`, `Trash2` |
| Formation editor | `ArrowDown`, `ArrowUp`, `ArrowLeftRight`, `ChevronDown`, `ChevronUp`, `Layers`, `Link2`, `Merge`, `Pencil`, `Plus`, `Scissors`, `TrainFront`, `Trash2` |
| Export submenu (Lucide only) | `Download`, `Gauge`, `Mountain` |
| Train editor | `Download`, `GripHorizontal`, `Image`, `MousePointer2`, `Plus`, `Upload` |
| Debug panel | `Activity`, `Eye`, `Hash`, `Landmark`, `Link2`, `ListOrdered`, `MapPin`, `TrainFront` |
| Map / info | `Info` |
| Landing | `Github` |
| Toasts (Sonner) | `CircleCheckIcon`, `InfoIcon`, `Loader2Icon`, `OctagonXIcon`, `TriangleAlertIcon` |
| Dropdown / menus | `CheckIcon`, `ChevronRightIcon`, `CircleIcon` |
| Draggable panels | `X` |

---

## 3. Other graphical marks (not in `@/assets/icons`)

| Location | Used for |
|----------|----------|
| `public/favicon.svg` | Browser tab **favicon** for Banana. |
| `src/components/toolbar/LanguageSwitcher.tsx` | Tiny **inline chevron** beside the locale label (opens language menu); not part of the Lucide barrel. |

---

## 4. Technical notes for implementation

- **Default props:** Custom icons use `IconProps` from `src/assets/icons/icon-types.ts` (`SVGProps<SVGSVGElement>` plus optional `title`).
- **Adding a Lucide icon:** Export it from `src/assets/icons/lucide.ts`, then import from `@/assets/icons`. Do not import `lucide-react` from feature files.
- **Replacing a Lucide icon with a custom asset:** Add a component under `src/assets/icons/`, export it from `index.ts`, and swap the import at call sites.
- **Designer SVG path:** Slug = `iconExportToDesignerFolder(exportName)` in `src/pages/icon-handoff/designer-slug.ts` (e.g. `ExportSceneIcon` → `export-scene-icon`). Files live at `public/designer-icons/<slug>/<slug>.svg`. The handoff page reads those URLs at runtime; wiring them into React components is a separate integration step after art is approved.
