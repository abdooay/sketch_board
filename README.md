# Sketch Board

`Sketch Board` is a web whiteboard built with `tldraw`, `React`, `TypeScript`, and `Vite`.
It keeps the familiar tldraw interface while adding domain-specific custom shapes and a browser-local custom shape library.

The project is intended to be reusable. You can fork it, adapt it, and use it as a base for your own diagramming product.

## Features

- Default `tldraw` canvas experience with a custom toolbar and style panel
- Built-in `database` custom shape
- Generic `svg-symbol` custom shape for imported SVG icons and symbols
- Custom shape library persisted in browser storage
- Import custom shapes from:
  - local `.svg` files
  - local `.json` library files
  - drag and drop
  - clipboard paste of raw SVG or copied web content containing SVG
- Theme-aware SVG contrast adjustment for monochrome icons
- Canvas persistence across page refreshes via `tldraw` local persistence

## Stack

- `React 19`
- `TypeScript`
- `Vite`
- `tldraw 4.5.9`

## Project Structure

```text
src/
  App.tsx
  tldraw/
    custom-shape-import-dialog.tsx
    custom-shape-library.tsx
    custom-shape-registry.tsx
    shapes/
      DatabaseShape.tsx
      DatabaseShapeView.tsx
      SvgSymbolShape.tsx
      SvgSymbolShapeView.tsx
    tools/
      DatabaseTool.ts
      SvgSymbolTool.ts
```

## Local Development

### Prerequisites

- `Node.js 20+` recommended
- `npm`

### Install

```bash
npm install
```

### Start The Dev Server

```bash
npm run dev
```

The app will usually be available at `http://localhost:5173`.

### Production Build

```bash
npm run build
```

### Preview The Build

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

## Custom Shape Library

The custom shape library is browser-local and independent from the canvas document persistence.

Current supported custom library item types:

- `database`
- `svg-symbol`

### Import Options

Open `Import SVG / JSON` from the custom shape controls and use any of these:

- choose files from disk
- drag and drop `.svg` or `.json`
- paste raw SVG markup
- paste copied web content that contains an `<svg>`

### JSON Example

```json
{
  "id": "orders-db",
  "version": 1,
  "type": "database",
  "label": "Orders Database",
  "defaultProps": {
    "w": 260,
    "h": 160,
    "color": "green",
    "fill": "semi",
    "size": "m"
  }
}
```

### SVG Import Notes

- Imported SVG is sanitized before it is stored.
- Only a safe subset of SVG nodes and attributes is preserved.
- Monochrome light/dark SVGs are adjusted at render time to remain visible against the current theme.
- Complex SVG features such as scripts, `foreignObject`, and unsafe external references are intentionally stripped.

## Deployment

### Deploy To Vercel

This project works as a standard Vite deployment on Vercel.

Recommended Vercel settings:

- Framework Preset: `Vite`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

#### Dashboard Flow

1. Push this repo to GitHub.
2. Go to `https://vercel.com/new`.
3. Import the GitHub repository.
4. Confirm the Vite settings above.
5. Deploy.

#### CLI Flow

```bash
npm install -g vercel
vercel login
vercel
```

For a production deployment:

```bash
vercel --prod
```

## Reuse And Forking

This project is licensed under the `MIT License`.

That means you can:

- use it privately or commercially
- modify it
- fork it
- distribute your own version

You must keep the copyright notice and license text.

## License

See [LICENSE](./LICENSE).
