# pi-sketchbook

## 0.1.1

### Patch Changes

- 35ddef1: Fix article heading hierarchy and size inline diagram frames to their content.
  Review complete article outlines before slide continuity, and verify every example slide at desktop and narrow widths.

## 0.1.0

### Minor Changes

- 9c3a9ce: Add a compact diagram frame with zoom, fit, native-size reset, drag and modified-wheel controls, source view, and fullscreen. Move slide navigation below the graph and remove repeated slide titles.
- 3b3bf87: Add a local Pi Sketchbook extension and skill for versioned Mermaid walkthroughs with Markdown, LaTeX, code blocks, and independent hand-drawn diagram decks.
- 3b3bf87: Rename the project and npm package to Pi Sketchbook (`pi-sketchbook`).
  Use the `sketchbook_write`, `sketchbook_read`, and `sketchbook_open` tools and the `sketchbook-explain-diagrams` skill.
  Store new documents in `.pi/sketchbook/`; existing documents are not moved automatically.
  See the README upgrade instructions before moving saved documents or updating integrations.

### Patch Changes

- 469f37b: Add side-arrow controls and clickable slide-position dots while preserving keyboard navigation and single-slide behavior.
