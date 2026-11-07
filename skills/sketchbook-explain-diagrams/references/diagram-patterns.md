# Article and diagram patterns

Plan the whole article before its slide sequences.
Subgraphs are visual groups, not interactive expansion.

## Whole-article review

Before checking per-slide continuity, read all article blocks and slide explanations in order.

- Check the outline against the reader's main question and give each section or deck a distinct purpose.
- Order concepts from prerequisites to details and define unfamiliar terms at first use.
  - Do not make the reader learn a concept from a later slide to understand an earlier section.
- State the document subject once and remove repeated introductions, definitions, and conclusions that add no information.
- Put context before the relevant deck and end the article with an answer, important limits, and any required next action.
  - Do not end with a diagram-reading instruction instead of the article's conclusion.
- Keep assumptions and omitted failure paths visible when they change the meaning of the answer.

Static fixture checks can catch known outline regressions, not establish arbitrary narrative quality.

## Connected sequence

- Give each deck one main question and each slide a needed contribution to its answer.
- Use the first slide to establish the boundaries and reading path.
  - One slide is sufficient when it answers the question; do not add slides to meet a fixed count.
- Let each later slide expand a known component, explain a known decision, or continue a known process stage.
  - Retain enough familiar components or steps to make the connection visible.
  - Connect the prose naturally through that shared concept instead of repeating a template about the preceding slide, omitted context, and next slide.
  - Explain a focus change or omission only when the reader needs it to preserve meaning.
- Keep repeated node IDs, labels, and meanings consistent.
  - A focused slide need not retain all previous nodes or add new nodes if its explanation adds needed information.
- End with the result or relevant boundary of the deck's question without requiring a separate summary slide.

For each transition, identify the shared component, decision, or process stage.
For each slide, identify the information it adds to the answer.
Merge or remove a slide if it adds no needed explanation, and move an independent question to another deck.
Shared nodes alone do not prove a useful connection.

For "How is a document saved?", system overview → API validation → storage write path is connected.
Validation expands the overview's API, and storage follows the validated request into persistence.
System overview → CSS theme comparison → storage write path is disconnected because the theme does not explain saving.

## Architecture: overview → API → storage

1. Show the system boundary, caller, API, and storage.
2. Expand validation and request handling.
3. Expand storage into its write path and revision boundary.

Keep the API and storage boundary visible when changing focus from validation to persistence.
Add detail nodes only when they answer the current slide's question.
Describe a source-verified system only from inspected evidence, and label a teaching model as an example.

## Process: overview → start → processing → end

1. Show the successful path and important failure exits.
2. Focus on inputs and the starting state.
3. Focus on decisions, transformations, and retries.
4. Focus on outputs, completion, and what remains unverified.

Retain the handoff step between adjacent stages so the reader can follow the same process.
Use edge labels for decisions and Markdown for preconditions or detailed explanations.
Use formulas only to clarify a relationship and code only to explain an operation.

## Compact diagrams and visual checks

- Use short node labels and move detailed qualifications to the explanation.
- Choose an orientation that fits the graph's shape at desktop and 390px.
  - Prefer a compact vertical path over a long horizontal chain when it keeps initial fitted labels readable.
  - Split unnecessary detail into focused slides rather than depending on Reset or Zoom to make the default view usable.
- For the bundled teaching examples, check a minimum default label size of 12 CSS px at both widths.
  - Measure every visible node, edge, and subgraph label in its initial fitted view before any camera action.
  - This is a testable target for these examples, not a promise for arbitrary graphs.
- Inspect the full rendered article and every slide at both widths for heading order, prose, emphasis, clipped content, labels, and failure caveats.
  - Successful parsing or a screenshot of only the initial slide is not a complete visual review.
  - Retain viewport and slide coverage with the browser evidence and report any missing coverage as unverified.
