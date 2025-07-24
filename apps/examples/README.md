# UE-Too Development Server

This is the development server for UE-Too, providing interactive examples and demos of the library's features.

## Structure

The examples are now organized as individual pages rather than function-based examples:

- **Main Page** (`index.html`) - Landing page with overview of all examples
- **Base Example** (`base/`) - Basic canvas with pan, zoom, and rotate functionality
- **Ruler Example** (`ruler/`) - Ruler overlay with measurement tools
- **Navigation Example** (`navigation/`) - Advanced navigation controls
- **Pixi Integration** (`pixi-integration/`) - Integration with PixiJS
- **Konva Integration** (`konva-integration/`) - Integration with Konva.js
- **Fabric Integration** (`fabric-integration/`) - Integration with Fabric.js
- **Camera Animation** (`camera-animation/`) - Camera animation examples
- **Image Example** (`image-example/`) - Image manipulation examples

## Running the Development Server

```bash
npm run serve
```

The server will start on `http://localhost:5173` (or the next available port).

## Navigation

Each example page includes:
- Consistent navigation bar linking to all examples
- Proper styling and layout
- Canvas element for the example
- Standalone TypeScript file implementing the functionality

## Adding New Examples

To add a new example:

1. Create a new directory in the root of `apps/examples/`
2. Add `index.html` with the standard template (copy from existing example)
3. Add `main.ts` with the example implementation
4. Update the navigation links in all `index.html` files
5. Add the directory to `tsconfig.json` include array
6. Add a card to the main `index.html` examples grid

## File Structure

```
apps/examples/
├── index.html                 # Main landing page
├── base/
│   ├── index.html            # Base example page
│   └── main.ts               # Base example implementation
├── ruler/
│   ├── index.html            # Ruler example page
│   └── main.ts               # Ruler example implementation
├── navigation/
│   ├── index.html            # Navigation example page
│   └── main.ts               # Navigation example implementation
├── pixi-integration/
│   ├── index.html            # Pixi integration page
│   └── main.ts               # Pixi integration implementation
├── konva-integration/
│   ├── index.html            # Konva integration page
│   └── main.ts               # Konva integration implementation
├── fabric-integration/
│   ├── index.html            # Fabric integration page
│   └── main.ts               # Fabric integration implementation
├── camera-animation/
│   ├── index.html            # Camera animation page
│   ├── main.ts               # Camera animation implementation
│   └── tile.png              # Example image asset
├── image-example/
│   ├── index.html            # Image example page
│   └── main.ts               # Image example implementation
└── src/                      # Legacy function-based examples (deprecated)
    ├── main.ts
    └── examples/
```

## Development

The development server uses Vite and includes:
- Hot module replacement (HMR)
- TypeScript support
- Path aliases for `@ue-too/core` imports
- Automatic port selection

## Building for Production

```bash
npm run build
```

This will create a production build in `dist/apps/examples/`. 