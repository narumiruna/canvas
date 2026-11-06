# Diagram patterns

Use one overview followed by slides that answer narrower questions.
A deck changes its diagram and explanation together, while the surrounding document remains readable.
Subgraphs are visual groups, not interactive expansion.

## Architecture: overview → API → storage

1. Show the system boundary, its caller, API, and storage.
2. Expand the API responsibility into validation and request handling.
3. Expand storage into its write path and revision boundary.

Keep a component's node ID and label identical whenever it reappears.
Add detail nodes only when they answer the current slide's question.
State which callers, failure paths, or internals are omitted.
Describe a source-verified system only from inspected evidence; label a teaching model as an example.

The architecture asset includes Chinese labels, a long label, and subgraphs for rendering checks.
These labels are test fixtures, not a recommendation to put long prose inside every node.

## Process: overview → start → processing → end

1. Show the complete successful path and important failure exits.
2. Focus on inputs and the starting state.
3. Focus on decisions, transformations, and retries.
4. Focus on outputs, completion, and what remains unverified.

Reuse the overview's step IDs and names.
Do not omit a failure path that changes the meaning of the process.
Use edge labels for decisions and Markdown for preconditions or detailed explanations.

## Supporting text

Put context before the deck and conclusions after it.
Use formulas only when they clarify a relationship, and code only when it explains an operation.
Keep assumptions distinct from observed behavior.
Use a separate deck only for an independent question; a one-slide reminder can stay visible while the main walkthrough changes.
