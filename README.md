# Pi Canvas

Pi Canvas is a Pi package for local technical documents with Markdown, LaTeX, code, and hand-drawn Mermaid diagram decks.
Each deck shows one diagram and its explanation at a time.
Use the side arrows, position dots, or title selector to change slides; focused decks also support keyboard arrow keys.

## Install

Use Node.js 22.19 or later.
Pi 1.5.0 is tested with Node.js 22.19.0 and 26.8.2; see [compatibility evidence](docs/compatibility.md).

Build and install this checkout:

```sh
npm ci
npm run build
pi install ./
```

Local installation requires the built `dist` assets and installed dependencies.
Git-source installation is not supported in this release.

After the owner confirms the npm name and publishes a release, install that release with:

```sh
pi install npm:pi-canvas
```

This command is not evidence that the package is published.
Review package code before installation and project declarations before granting Pi project trust.

## Use

Load the bundled skill explicitly:

```text
/skill:canvas-explain-diagrams Explain this system with an overview, API detail, and storage detail.
```

Automatic skill selection is not guaranteed.
The skill includes complete [architecture](skills/canvas-explain-diagrams/assets/architecture-walkthrough.json) and [process](skills/canvas-explain-diagrams/assets/process-walkthrough.json) examples.

| Tool           | Input and result                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| `canvas_write` | `{document}` creates a document and returns its ID, revision, storage path, summary, and rendering-unverified status. |
| `canvas_read`  | `{documentId}` returns `{documentId, revision, updatedAt, document}` in `structuredContent.stored`.                   |
| `canvas_write` | `{document, documentId, expectedRevision}` replaces the full document if the revision matches.                        |
| `canvas_open`  | `{documentId}` returns an ephemeral local viewer URL; it does not launch a browser.                                   |

For updates, read first and use the returned revision.
On conflict, read again and apply the change to the current document.
A successful write confirms validation and storage, not browser rendering.
The [document format](skills/canvas-explain-diagrams/references/document-format.md) defines fields, IDs, limits, and tool details.

## Rendering and security

- Only Mermaid `flowchart` diagrams are supported, including subgraphs.
  - The viewer uses Mermaid's `handDrawn` look through Rough.js with a fixed nonzero seed.
  - Frontmatter, directives, node metadata (`@{...}`), click actions, HTML, images, and icons are not supported.
  - Wide diagrams keep native-size labels and scroll horizontally instead of shrinking below a readable text size.
- Markdown supports inline/display LaTeX and fenced code, but not raw HTML or images.
  - Mermaid uses strict security and disables HTML labels; generated SVG is sanitized.
  - KaTeX uses `trust: false`, `maxExpand: 1000`, and `maxSize: 20`.
- Viewer scripts, styles, fonts, and renderers are bundled; no CDN is required.
- The read-only server binds to `127.0.0.1` on an ephemeral port.
  - Data requests require a per-server capability token carried by the viewer URL fragment.
  - Host validation, same-origin access, and CSP limit browser access.
  - Treat the full viewer URL as private and keep secrets out of documents.
- A parse error is shown locally with source details instead of removing the rest of the document.
  - Rendering runs on the browser main thread; error handling is not CPU isolation.

## Files and lifecycle

Documents are stored in the Pi working directory at `.pi/canvas/<documentId>.json`.
Only `.pi/canvas/.gitignore` is created for local artifact exclusions; the root `.gitignore` is not changed.
Writes use complete replacement, revision checks, a same-process mutation queue, and atomic rename.
Do not write the same document from multiple Pi processes.

Only `canvas_open` starts the viewer server.
TUI and RPC sessions can open it; print and JSON modes support write/read only.
Shutdown closes the server but does not remove documents.
After reload, new, resume, or fork, open again for a current URL.
Tree navigation and session branching do not restore disk documents; read and create a new ID for a separate document branch.
Remote SSH, container forwarding, and WSLg/Windows browser access remain unverified.

## Verify

```sh
npm run ci
npx playwright install chromium
npm run test:browser
npm pack --dry-run
npm run test:package
```

On a fresh Linux system, use `npx playwright install --with-deps chromium` if browser system libraries are missing.

See [compatibility evidence](docs/compatibility.md) for measured results and [acceptance](docs/acceptance.md) for human checks, future authorized model tests, and release-owner actions.
Automated checks do not establish visual acceptance or reliable automatic skill loading.

## Scope and license

This release does not provide cloud sharing, accounts, collaboration, browser editing, pan/zoom, autoplay, export, partial updates, a standalone persistent server, or arbitrary Mermaid types and external assets.
See [LICENSE](LICENSE) for the GNU Affero General Public License, version 3.
