# Pi Sketchbook

Pi Sketchbook is a Pi package for local technical documents with Markdown, LaTeX, code, and hand-drawn Mermaid diagram decks.
Each deck shows one diagram and its explanation at a time.
Review the complete article outline before reviewing its decks.
Build each deck around one question: each slide must connect to the established context and add useful information.
Define required terms before use, remove repeated prose, and conclude each main topic.
Keep repeated component names and meanings consistent; put independent questions in separate decks.
Use the bottom arrows or labelled position dots to change slides; focused decks also support Left/Right keyboard keys.
The document title is the page H1, each deck has a stable H2 chapter title, and its current slide uses H3.
Matching deck and slide titles appear once visually.

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
pi install npm:pi-sketchbook
```

This command is not evidence that the package is published.
Review package code before installation and project declarations before granting Pi project trust.

## Upgrade from Pi Canvas

The package is now `pi-sketchbook`.
Replace `canvas_*` tool calls with `sketchbook_*` and `/skill:canvas-explain-diagrams` with `/skill:sketchbook-explain-diagrams`.
The old names are not aliases.

Existing documents in `.pi/canvas/` are not moved automatically.
Stop all Pi sessions that use the workspace and back up the saved documents before moving them.
If `.pi/sketchbook/` does not exist, move the complete `.pi/canvas/` directory to `.pi/sketchbook/`.
If both directories exist, keep both and resolve document ID conflicts before moving files; do not overwrite either directory.
Document IDs, revisions, and schema version 1 remain unchanged.
Start Pi again to load the renamed tools and skill, then open documents for new viewer URLs.

## Use

Load the bundled skill explicitly:

```text
/skill:sketchbook-explain-diagrams Explain this system with an overview, API detail, and storage detail.
```

Automatic skill selection is not guaranteed.
The skill includes complete [architecture](skills/sketchbook-explain-diagrams/assets/architecture-walkthrough.json) and [process](skills/sketchbook-explain-diagrams/assets/process-walkthrough.json) examples.

| Tool               | Input and result                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `sketchbook_write` | `{document}` creates a document and returns its ID, revision, storage path, summary, and rendering-unverified status. |
| `sketchbook_read`  | `{documentId}` returns `{documentId, revision, updatedAt, document}` in `structuredContent.stored`.                   |
| `sketchbook_write` | `{document, documentId, expectedRevision}` replaces the full document if the revision matches.                        |
| `sketchbook_open`  | `{documentId}` returns an ephemeral local viewer URL; it does not launch a browser.                                   |

For updates, read first and use the returned revision.
On conflict, read again and apply the change to the current document.
A successful write confirms validation and storage, not browser rendering.
The [document format](skills/sketchbook-explain-diagrams/references/document-format.md) defines fields, IDs, limits, heading roles, and tool details.

### Article review

- Start article Markdown headings at H2; do not repeat the document title.
  - Legacy Markdown blocks with H1 are shifted down one heading level when rendered; saved JSON is unchanged.
  - Explanation headings are placed below the slide H3, starting at H4.
- Review the complete heading outline, concept order, first definitions, repeated text, and conclusion before checking slide transitions.
- Inspect the full page and every slide at desktop and 390-pixel widths before claiming visual review.
  - Check default Fit label size, unused frame space, text wrapping, emphasis, and diagram meaning.
  - Report saving, rendering, readability checks, and human acceptance separately.
- Use short labels and compact graphs that can be read without Reset or Zoom.
  - Long-label and large-graph stress tests do not define suitable teaching layouts.

## Rendering and security

- Only Mermaid `flowchart` diagrams are supported, including subgraphs.
  - The viewer uses Mermaid's `handDrawn` look through Rough.js with a fixed nonzero seed.
  - Frontmatter, directives, node metadata (`@{...}`), click actions, HTML, images, and icons are not supported.
  - Diagrams start fitted without upscaling; inline frame height follows the SVG aspect ratio and available width, within a bounded height.
  - Fit can still make large graphs small. Rework a teaching graph that is unreadable at its default scale; Reset, Zoom, and panning remain available for inspecting large graphs.
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

## Diagram controls

The icon toolbar provides Zoom out, Zoom in, Fit to screen, Reset zoom, Fullscreen, and Show source.
Hover or focus a button to show its label.
Show source displays inert text, not executable HTML.

- Fit shows the complete graph; Reset restores 100% native size.
- Zoom is limited to 400%; the lower limit is 25% or the fitted scale when smaller.
- Drag with a mouse or pen to pan a large graph.
  - Ctrl/Command + wheel zooms at the pointer; an ordinary wheel continues document scrolling.
  - Inline touch gestures remain available for document scrolling; pinch zoom is not implemented.
- Focus the diagram viewport to use `+`/`-` to zoom and `0` to fit.
  - Left/Right still switches slides in the focused deck.
- Fullscreen uses the browser API or an in-page fallback.
  - Exit restores focus; Escape closes the fallback.
  - Changing the diagram source or removing its block closes fullscreen and releases background locks.

## Files and lifecycle

Documents are stored in the Pi working directory at `.pi/sketchbook/<documentId>.json`.
Only `.pi/sketchbook/.gitignore` is created for local artifact exclusions; the root `.gitignore` is not changed.
Writes use complete replacement, revision checks, a same-process mutation queue, and atomic rename.
Do not write the same document from multiple Pi processes.

Only `sketchbook_open` starts the viewer server.
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

This release does not provide cloud sharing, accounts, collaboration, browser editing, autoplay, export, partial updates, a standalone persistent server, or arbitrary Mermaid types and external assets.
See [LICENSE](LICENSE) for the GNU Affero General Public License, version 3.
