# Banana

A 2D top-down railway simulator built with React and PixiJS.

> Banana is just a placeholder name for the project. It is not going to be the final name. The origin of the name is from one of the Taipei Metro lines. It's called the <ruby>板<rt>Ban</rt></ruby> <ruby>南<rt>Nan</rt></ruby> 線. (AKA the blue line) My wife and I refer to it as the banana line as a joke.

A live version is available at [banana.vntchang.dev](https://banana.vntchang.dev).

The goal of the project is to create something like NIMBY Rails with a top-down 2D view but with more track layout flexibility. The scheduling system would be more of a mix of NIMBY Rails and A-Train. Also the ability to carry passengers and cargo for different industries like Transport Fever.

It's inside the ue-too monorepo because it depends on many packages in the monorepo. Once the features stabilize, it will be moved to a separate repository.

## Features

### Track System

- Draw railway curves using interactive Bezier curve tools
- Multiple track styles: **ballasted** (traditional gravel) and **slab** (elevated/modern)
- Electrification support with overhead catenary rendering
- Tension adjustment for curve smoothness
- Track segment splitting, deletion, and junction management

### Terrain

- Heightmap-based terrain with multiple elevation bands
- Hypsometric tinting (color-coded elevation)
- Hillshading with adjustable sun angle
- Contour line overlays
- Occlusion meshes for tunnels and underground tracks
- X-ray mode to see underground tracks
- Terrain editor page for painting and sculpting heightmaps

### Trains

- Hierarchical formation system: cars, formations, and nested formations
- Cars with configurable bogies (wheel sets) and spacing
- Throttle control panel with drag-to-set notch interface and speed readout
- Camera follow and lock-on mode for tracking trains
- Depot panel for car stock management
- Formation editor for creating and modifying train compositions
- Train editor page with visual bogie and car image editing

### Stations

- Place stations on track segments with multi-platform support
- Platform-to-track assignment
- Station list panel with pan-to-station navigation

### Buildings

- Configurable building placement with size presets
- Elevation-aware positioning

### Camera & Navigation

- Pan, zoom, and rotate with mouse and trackpad
- Smooth camera animations using Van Wijk & Nuij optimal path interpolation
- Follow and lock-on to moving trains
- Zoom-aware scale ruler

### Import / Export

- Export and import tracks, stations, trains, and terrain
- Full scene export and import

### Other

- Bilingual UI: English and Traditional Chinese (zh-TW)
- Debug overlays for joint/segment/formation IDs and station stops
- Stress test dev tools for performance monitoring
- Experimental MapLibre map overlay

## Running Locally

Clone the monorepo and install dependencies at the root:

```bash
bun install
```

Then start the dev server:

```bash
bun dev:banana
```

## Tech Stack

- **UI**: React, Tailwind CSS, Radix UI
- **Rendering**: PixiJS
- **Canvas**: @ue-too/board, @ue-too/curve, @ue-too/math, @ue-too/animate
- **Build**: Vite
- **i18n**: i18next

Any issues or feedback, please let me know by creating an issue.
