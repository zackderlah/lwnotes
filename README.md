# LW Notes

A small note-taking app built with Vite + React, packaged as a desktop application with Electron. Optional Google Drive sync for backups.

**Repository:** [github.com/zackderlah/lwnotes](https://github.com/zackderlah/lwnotes)

**Download installers (when published):** [Releases](https://github.com/zackderlah/lwnotes/releases)

### Install from a release (easy path)

Each release should list **a small set of downloads**. Use the **installer** for your OS and ignore stray internal files (e.g. `app.asar`, `.pak` files) if you see them on older releases—those were unpacked build outputs, not something you install by hand.

| OS | Download | Install |
|----|----------|---------|
| **Windows** | `Note App Setup … .exe` (NSIS) | Run the `.exe` and follow the installer. |
| **macOS** | `Note App … .dmg` | Open the `.dmg`, drag **Note App** into **Applications**. |
| **Linux** | `.AppImage` (portable) or `.deb` (Debian/Ubuntu) | **AppImage:** `chmod +x` then run it, or use your AppImage launcher. **deb:** `sudo apt install ./path-to-your.deb` (or open with Software Install). |

Optional small `latest*.yml` files are for auto-updaters, not for manual install.

## Prerequisites

- Node.js 18+ and npm

## Install

```bash
npm install
```

## Run as a Desktop App (development)

```bash
npm run dev:electron
```

This starts the Vite dev server on `http://localhost:5181` and launches Electron against it. Source changes hot-reload the window.

## Run as a Web App (development, in a browser)

```bash
npm run dev
```

Open the printed URL (`http://localhost:5181`).

## Build a Desktop Installer

```bash
# Build for your current OS
npm run dist

# Or target a specific platform
npm run dist:win     # Windows .exe (NSIS installer)
npm run dist:mac     # macOS .dmg
npm run dist:linux   # Linux AppImage + .deb
```

Installers and unpacked builds are written to the `release/` folder.

### CI builds on GitHub

Pushing a version tag (e.g. `v1.0.0`) runs [`.github/workflows/release.yml`](.github/workflows/release.yml) and attaches installers to a GitHub Release. Add a repository secret **`VITE_GOOGLE_CLIENT_ID`** (your Google OAuth Web client ID) so packaged apps include sign-in.

## Project Structure

- `electron/main.cjs` - Electron main process (creates the window, loads the app).
- `electron/preload.cjs` - Preload script (isolated context bridge placeholder).
- `src/App.jsx` - top-level React state, wires together tabs, sidebar, editor.
- `src/components/Tabs.jsx` - file-folder style top tabs with rename / duplicate / color / delete.
- `src/components/Sidebar.jsx` - left sidebar header + note list.
- `src/components/NoteList.jsx` - scrollable list of notes with right-click menu.
- `src/components/Editor.jsx` - title + body editor with paste/drop image support.
- `src/components/ContextMenu.jsx` - reusable right-click context menu.
- `src/hooks/useHistoryState.js` - single-snapshot undo/redo history.
- `src/data/notes.js` - seed notes, tab definitions, color palette.
- `src/styles/index.css` - design tokens and component styles.

## Shortcuts

- `Ctrl/⌘ + Z` — undo.
- `Ctrl/⌘ + Shift + Z` or `Ctrl + Y` — redo.
- `Ctrl/⌘ + V` inside a note — paste an image.
- Right-click a tab or note for more actions.
- `F2` on a focused tab — rename.
