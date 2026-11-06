# Acceptance and external handoff

## Current boundary

The bundled examples and static skill checks do not prove that a model will select the skill or use the tools correctly.
This implementation task authorizes a feature-branch push and pull request, but not paid model evaluations, npm publication, version tags, or release-workflow dispatch.
Human visual acceptance and remote forwarding remain unverified.

## Future authorized model checks

The provider or account owner must authorize API usage before either check is run.
Record the model ID, Pi version, package revision, prompt, tool transcript, output ID/revision, browser evidence, and any errors.
Do not record credentials or a reusable capability token in published evidence.
First send each prompt without an explicit skill command to observe discovery.
If the model does not load the skill, record that result and repeat with `/skill:canvas-explain-diagrams` prefixed to the same prompt.
A successful explicit invocation does not prove reliable automatic selection.

### Architecture prompt

> Create a Pi Canvas walkthrough for a fictional document service used by new backend engineers.
> Start with a system overview, then explain the API, then the storage write path.
> Keep the Client, Document API, and Document Store names and node IDs consistent.
> Include prose, inline and display LaTeX for request latency, and a short fenced TypeScript example.
> Use a subgraph, one Chinese label, and one long label to check layout.
> Save the document and give me a local viewer link without launching a browser.
> Label assumptions and tell me whether rendering was checked.

Expected assertions:

- [ ] The transcript records whether the skill was loaded automatically, explicitly, or not at all.
- [ ] The document passes the strict version-1 schema and content policy.
- [ ] A main deck has overview → API → storage slides, each with a nonempty explanation.
- [ ] Repeated components keep the same node IDs and names.
- [ ] Prose, inline/display LaTeX, fenced TypeScript, Chinese text, a long label, and a subgraph are present.
- [ ] Assumptions are marked as a teaching model instead of source-verified implementation facts.
- [ ] Creation omits `documentId` and `expectedRevision`, and the result reports the generated ID and revision.
- [ ] Opening uses a supported TUI or RPC session and returns a loopback URL without an OS-browser launch.
- [ ] The final response separates storage success from rendering evidence.

### Process prompt

> Create a Pi Canvas guide to replacing a saved document.
> Show the complete flow, then the input and start, then validation and revision checking, then output and end.
> Show how a revision conflict returns to a read instead of overwriting a newer change.
> Include prose, inline and display LaTeX for the next revision, and a fenced TypeScript example.
> Save the guide and return its viewer link.
> Then read the saved guide and add a short conclusion through a revision-checked full replacement.
> Do not write storage JSON directly, and do not claim rendering success without a browser check.

Expected assertions:

- [ ] The document passes the strict version-1 schema and uses only flowcharts.
- [ ] A main deck has overview → start → processing → end slides with corresponding explanations.
- [ ] Repeated steps keep the same node IDs and labels, and the conflict exit is visible.
- [ ] Prose, inline/display LaTeX, and fenced TypeScript are present.
- [ ] The update reads the stored envelope and supplies its revision as `expectedRevision`.
- [ ] The update submits a complete document and keeps existing stable block and slide IDs.
- [ ] A conflict triggers another read, not a blind overwrite.
  - [ ] Record this as untested if no conflict is exercised.
- [ ] No direct storage-file edits or unsupported content occur.
- [ ] The final response reports the saved revision, viewer status, and rendering evidence separately.

## Human browser review

Run a built package in a persistent Pi TUI or RPC session.
Use `canvas_write` to save each bundled asset, then `canvas_open` to obtain current URLs.

- [ ] Confirm all architecture and process slides render with their explanations.
- [ ] Confirm the diagrams have a readable hand-drawn style, arrows, Chinese labels, and long labels.
- [ ] Confirm prose, inline/display math, and code remain readable at narrow and desktop widths.
- [ ] Change slides by the bottom arrows, labelled position dots, and Left/Right keys while a deck has focus.
- [ ] Confirm the compact toolbar, single slide title, bounded graph, and nearby explanation are comfortable to read.
- [ ] Compare initial Fit with Reset zoom; confirm large graphs remain accessible through zoom and dragging.
- [ ] Check native browser fullscreen, in-page fallback, Escape, and focus restoration on the target browser.
- [ ] Check document scrolling and pointer behavior on any required physical touch devices; pinch zoom is not implemented.
- [ ] Confirm two decks retain independent positions and the single-slide deck has no unnecessary navigation.
- [ ] Update a document and confirm stable slide IDs retain the selected slide.
- [ ] Delete the selected slide and confirm a nearby surviving slide is selected.
- [ ] Confirm slide changes do not cause disruptive page jumps.
- [ ] Confirm local render errors leave unrelated blocks visible with readable diagnostic source.
- [ ] Close the session and confirm the viewer reports disconnection while saved files remain.
- [ ] Record acceptance or remaining issues for text size, diagram style, and explanation clarity.

Screenshots and automated render checks support this review but do not replace the user's visual acceptance.
Remote SSH, container forwarding, and WSLg/Windows browser connectivity need separate tests on the target environment.

## Package-owner handoff

1. Confirm the final npm name is available and the repository identity is correct.
2. Configure npm trusted publishing for the intended repository and `release.yml`.
   - Confirm GitHub Actions has the required pull-request permissions.
   - Review the existing release workflow's `PAT_TOKEN` requirement and supply an appropriate owner-managed credential or approved replacement.
   - Never provide secrets in chat, documents, example assets, or commits.
3. Review CI, isolated local/tarball installation evidence, package contents, license, and dependency audit.
4. Obtain explicit release authorization before publishing, creating or pushing a release tag, or dispatching a release workflow.

The implementation does not verify registry ownership or trusted-publisher permissions.
The provider/account owner controls authorization for real-model testing.
The user controls visual and comprehension acceptance.
