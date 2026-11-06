# Document format and tools

## Complete document

Submit this shape as the `document` argument to `canvas_write`.
Do not add envelope fields to the document.

```typescript
type CanvasDocument = {
  schemaVersion: 1
  title: string
  blocks: Array<
    | { id: string; type: "markdown"; markdown: string }
    | {
        id: string
        type: "diagram-deck"
        title: string
        slides: Array<{
          id: string
          title: string
          mermaid: string
          explanationMarkdown: string
        }>
      }
  >
}
```

- Use nonempty titles, IDs, Markdown blocks, and slide explanations.
  - Keep each title within 512 characters.
- Match every ID to `/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/`.
  - Keep block IDs unique within the document.
  - Keep slide IDs unique within their deck.
  - IDs are identifiers, not file paths.
- Use at most 1 MiB of UTF-8 JSON and 1 to 100 blocks per document.
  - Give each deck 1 to 20 slides.
  - Limit each Mermaid source to 32 KiB of UTF-8 text.
- Use only the fields shown above and schema version 1.

Markdown supports prose, inline math such as `$r + 1$`, display math between `$$` lines, and fenced code.
Use a diagram deck even for one diagram; a Mermaid Markdown fence is not a second diagram format.

## Content policy

- Begin each diagram with `flowchart` and a direction such as `LR` or `TD`.
  - Use subgraphs to group architecture components.
  - Submit plain Mermaid source, without Markdown fences.
- Do not use other diagram types, Mermaid frontmatter, configuration directives, node metadata (`@{...}`), click actions, HTML, images, or icons.
- Do not use raw HTML or images in Markdown.
  - Use ordinary links with safe schemes such as HTTPS.
- Do not use LaTeX commands that require trusted HTML or external resources.

The application controls the hand-drawn look, fixed seed, strict security settings, and SVG sanitization.
Do not try to override these settings.

## Tool contract

### Create

`canvas_write({ document })` creates a generated ID at revision 1.
Omit both `documentId` and `expectedRevision` for creation.
The result includes `documentId`, `revision`, `path`, a `blocks` summary, and `renderingVerified: false`.
A successful write means validation and persistence succeeded, not that Mermaid or LaTeX rendered.

### Read and replace

`canvas_read({ documentId })` returns this envelope in `structuredContent.stored` and `details.stored`:

```typescript
{
  documentId: string
  revision: number
  updatedAt: string
  document: CanvasDocument
}
```

Read text is limited to 48,000 bytes or 1,900 lines; the complete envelope remains in the structured result and at the reported file path.

`canvas_write({ document, documentId, expectedRevision })` replaces the complete document.
Use the revision from the latest read as `expectedRevision`.
A conflict leaves the current document unchanged and requires another read before retrying.
After an interrupted response, read to check whether the write already committed.

### Open

`canvas_open({ documentId })` returns an ephemeral loopback viewer URL in TUI or RPC mode.
It does not launch an operating-system browser.
Print and JSON modes can write and read, but cannot keep the viewer server alive.
If opening is unavailable, return the saved ID and revision and explain this limitation.

## Storage and lifecycle

Files are workspace artifacts at `.pi/canvas/<documentId>.json`.
The package creates only a local ignore file at `.pi/canvas/.gitignore`, not a workspace-root ignore rule.
Do not write the same document from multiple Pi processes.
Tree navigation, resume, and fork do not undo disk writes; create a new ID for a separate document branch.
Shutdown closes the viewer server, but preserves saved documents.
After reload, new, resume, or fork, open again for a current URL.
Remote host forwarding and a user's browser access require separate verification.
