# Diagram patterns

Use one overview followed by slides that answer narrower questions.
A deck changes its diagram and explanation together, while the surrounding document remains readable.
Subgraphs are visual groups, not interactive expansion.

## Connected sequence

- State one main question for the deck and choose its reading order before writing diagrams.
- Use the first slide to establish the subject, boundaries, and reading path.
  - One slide is sufficient when it answers the question; do not add slides to meet a fixed count.
- Give each later slide a distinct contribution: expand a known component, explain a known decision, or continue a known process stage.
  - In its explanation, name the connection to the preceding slide or established overview and state what this slide adds.
  - Explain a change of focus and identify omitted context.
  - Retain enough familiar components or steps to make that connection visible in the diagram.
- Keep repeated node IDs, labels, and meanings consistent.
  - A focused slide need not retain all previous nodes or add new nodes if its explanation adds needed information.
- End with the result, conclusion, or relevant boundary of the deck's question.
  - A separate summary slide is not required.

Before saving, read the slides in order.
For each transition, identify the shared component, decision, or process stage.
For each slide, identify the information it adds to the answer.
Merge or remove a slide if it adds no needed explanation.
Move an independent question to another deck.
Shared nodes alone do not prove a useful connection.

For the question "How is a document saved?", a connected sequence is system overview → Document API validation → Document Store write path.
Validation expands the overview's API; the storage slide follows the validated request and explains persistence.
A counterexample is system overview → CSS theme comparison → Document Store write path.
The theme comparison does not explain how the document is saved and belongs in a separate deck.

## Architecture: overview → API → storage

1. Show the system boundary, its caller, API, and storage.
2. Expand the API responsibility into validation and request handling.
3. Expand storage into its write path and revision boundary.

Keep the API and storage boundary visible when changing focus from validation to persistence.
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

Retain the handoff step between adjacent stages so the reader can follow the same process.
Do not omit a failure path that changes the meaning of the process.
Use edge labels for decisions and Markdown for preconditions or detailed explanations.

## Supporting text

Put context before the deck and conclusions after it.
Use formulas only when they clarify a relationship, and code only when it explains an operation.
Keep assumptions distinct from observed behavior.
Use a separate deck only for an independent question; a one-slide reminder can stay visible while the main walkthrough changes.
