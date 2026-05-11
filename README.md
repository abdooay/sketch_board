# Sketch Board

`Sketch Board` is a web whiteboard built with `tldraw`, `React`, `TypeScript`, and `Vite`.
It keeps the familiar tldraw interface while adding domain-specific custom shapes and a browser-local custom shape library.

The project is intended to be reusable. You can fork it, adapt it, and use it as a base for your own diagramming product.

## Features

- Default `tldraw` canvas experience with a custom toolbar and style panel
- Built-in `database` custom shape
- Generic `svg-symbol` custom shape for imported SVG icons and symbols
- Custom shape library persisted in browser storage
- Optional Google account cloud autosave backed by private Vercel Blob storage
- Import custom shapes from:
  - local `.svg` files
  - local `.json` library files
  - drag and drop
  - clipboard paste of raw SVG or copied web content containing SVG
- Theme-aware SVG contrast adjustment for monochrome icons
- Canvas persistence across page refreshes via `tldraw` local persistence
- Cloud save can copy existing browser-local projects into the signed-in Google account
- Optional live collaboration through a separately deployed tldraw sync server

## Stack

- `React 19`
- `TypeScript`
- `Vite`
- `tldraw 3.15.4`
- `@tldraw/sync 3.15.4` for optional live collaboration

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
cp .env.example .env.local
```

`VITE_TLDRAW_SYNC_URL` is optional. Leave it empty unless you have a running tldraw sync server.
Cloud save is optional locally unless the Vercel Blob and Google OAuth environment variables are configured.

### Start The Dev Server

```bash
npm run dev
```

The app will usually be available at `http://localhost:5173`.

### Local Agent Control With MCP

This branch includes a local MCP server that can control the running Sketch Board app directly.
That is separate from the older standalone `tldraw()` widget setup in your shell config.

1. Create your local env file:

```bash
cp .env.example .env.local
```

2. Start the app:

```bash
npm run dev
```

3. In another terminal, start the MCP bridge:

```bash
npm run mcp
```

The browser app connects to `VITE_TLDRAW_AGENT_WS_URL`, which defaults to `ws://localhost:4010`
in `.env.example`. The MCP server listens on the same port through `SKETCH_BOARD_AGENT_WS_PORT`
if you need to override it.

For a deployed frontend such as Vercel, you do not need to hardcode a production bridge URL.
You can opt in from your own browser session with a query parameter:

```text
https://your-app.example.com/?agent_ws=ws://localhost:4010
```

That lets the deployed app connect back to your local MCP bridge without affecting other users.

Once the app is open in your browser, the MCP server exposes tools for:

- listing open Sketch Board sessions
- reading the current canvas snapshot
- creating built-in tldraw shapes
- creating Sketch Board custom shapes such as `database` and `svg-symbol`
- updating, deleting, grouping, ungrouping, and connecting shapes
- exporting the canvas as `svg`, `png`, or `json`
- listing the custom shape library items available in the current browser session

Recommended agent flow:

1. Call `list_sketch_board_sessions`.
2. If more than one session is open, pass `sessionId` explicitly.
3. Call `get_snapshot` before making edits.
4. Use `list_custom_shape_library_items` before creating `svg-symbol` shapes.

### Production Build

```bash
npm run build
```

### Preview The Build

```bash
npm run preview
```

## Cloud Save

Cloud save uses Google OAuth for account ownership and Vercel Blob private storage for the document.
The browser never chooses the cloud document path. The server derives it from the signed-in Google
account id, so each Google account gets its own private cloud document.

Required environment variables:

- `BLOB_READ_WRITE_TOKEN`: created by linking a private Vercel Blob store to the project
- `GOOGLE_CLIENT_ID`: from a Google OAuth web client
- `GOOGLE_CLIENT_SECRET`: from the same Google OAuth web client
- `AUTH_COOKIE_SECRET`: a long random value used to sign the session cookie

Google OAuth redirect URI:

```text
https://your-app.example.com/api/auth/callback
```

When a user signs in for the first time, Sketch Board reads the existing browser-local tldraw
projects and custom shape library and uploads them to that Google account's cloud document. Local
browser autosave stays enabled, so existing browser data is not deleted by enabling cloud save.

For local testing of cloud save, run the app through Vercel's dev server so the `/api/*` functions
are available:

```bash
npx vercel dev
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

Open `Import SVG` from the custom shape controls and use any of these:

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

This branch uses `tldraw` 3.x. It does not require `VITE_TLDRAW_LICENSE_KEY`, but the
`Made with tldraw` watermark must remain visible unless your tldraw license allows removing it.

Recommended Vercel settings:

- Framework Preset: `Vite`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

Optional environment variable:

- `VITE_TLDRAW_SYNC_URL`: base URL for your external tldraw sync server, for example `https://sketch-board-sync.example.com`

Cloud save environment variables:

- `BLOB_READ_WRITE_TOKEN`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_COOKIE_SECRET`

Vercel should host the frontend only. The live collaboration feature uses WebSockets, so the
tldraw sync server must run on a platform that supports persistent WebSocket connections.
If `VITE_TLDRAW_SYNC_URL` is not set in production, the app still works for local drawing and
persistence, but the Share Session control shows `Configure sync` instead of starting a room.

#### Dashboard Flow

1. Push this repo to GitHub.
2. Go to `https://vercel.com/new`.
3. Import the GitHub repository.
4. Confirm the Vite settings above.
5. Deploy or redeploy.
6. To enable collaboration, deploy a tldraw sync server separately.
7. Open `Settings` -> `Environment Variables`.
8. Add `VITE_TLDRAW_SYNC_URL` with the sync server base URL.
9. Redeploy the frontend.

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

### Collaboration On Vercel

Vercel is a good fit for this Vite frontend, but it should not be used as the tldraw sync
server for this project. Deploy the sync server separately, then point the frontend to it:

```bash
VITE_TLDRAW_SYNC_URL=https://your-sync-server.example.com
```

For local development, the frontend falls back to:

```bash
http://localhost:8787
```

That local fallback is intentionally disabled in production so a Vercel deployment does not try
to connect to `localhost` in the user's browser.

## Reuse And Forking

This project is licensed under the `MIT License`.

That means you can:

- use it privately or commercially
- modify it
- fork it
- distribute your own version

You must keep the copyright notice and license text.

This applies to the source code in this repository.
It does not replace the separate license terms of third-party dependencies.

In particular, this project depends on `tldraw`.
If you deploy this app in production, your use is also subject to the `tldraw SDK License`.
For this `tldraw` 3.x branch, keep the `Made with tldraw` watermark unless your tldraw license
allows removing it.

## License

See [LICENSE](./LICENSE).

## Third-Party Licensing

- This repository's own code: `MIT`
- `tldraw` SDK: separate tldraw license for production use

See [NOTICE](./NOTICE).
