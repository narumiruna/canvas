import { type APIRequestContext, expect, type Locator } from "@playwright/test"
import type { DiagramDeck, SketchbookDocument, StoredDocument } from "../../src/document.js"

const coordinator = "http://127.0.0.1:4179"

export interface Fixture {
  stored: StoredDocument
  url: string
}

export async function save(
  request: APIRequestContext,
  document: SketchbookDocument,
  previous?: StoredDocument,
) {
  const response = await request.post(`${coordinator}/documents`, {
    data: {
      document,
      ...(previous ? { documentId: previous.documentId, expectedRevision: previous.revision } : {}),
    },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  return (await response.json()) as Fixture
}

export async function asset(request: APIRequestContext, name: string) {
  const response = await request.get(`${coordinator}/assets/${name}`)
  expect(response.ok()).toBeTruthy()
  return (await response.json()) as SketchbookDocument
}

export const source = `flowchart LR
  subgraph Service["服務邊界"]
    A["讀取文件 — a deliberately long label for responsive SVG rendering"] --> B["寫入"]
  end
  classDef important fill:#ddeeef,stroke:#246;
  class A important;
  linkStyle 0 stroke:#246,stroke-width:2px;`

export function documentFixture(): SketchbookDocument {
  const deck = (id: string): DiagramDeck => ({
    id,
    type: "diagram-deck",
    title: `Deck ${id}`,
    slides: [
      {
        id: "overview",
        title: "Overview",
        mermaid: source,
        explanationMarkdown: `Explanation ${id} overview with $x^2$.`,
      },
      {
        id: "detail",
        title: "Detail",
        mermaid: `flowchart LR\n A["Detail ${id}"] --> C["Core"]`,
        explanationMarkdown: `Explanation ${id} detail.`,
      },
      {
        id: "end",
        title: "End",
        mermaid: `flowchart LR\n C["Core"] --> Z["End ${id}"]`,
        explanationMarkdown: `Explanation ${id} end.`,
      },
    ],
  })
  return {
    schemaVersion: 1,
    title: "Browser fixture",
    blocks: [
      {
        id: "intro",
        type: "markdown",
        markdown:
          "# Reading guide\n\nInline $a^2+b^2=c^2$.\n\n$$\nE=mc^2\n$$\n\n```typescript\nconst safe = true;\n```\n\n| Name | Value |\n| --- | --- |\n| revision | 1 |\n\n[Safe link](https://example.com/guide)",
      },
      deck("first"),
      { id: "between", type: "markdown", markdown: "Text between independent decks." },
      deck("second"),
      { id: "tail", type: "markdown", markdown: "Last text stays readable." },
    ],
  }
}

export async function rendered(deck: Locator) {
  await expect(deck.locator(".diagram")).toHaveAttribute("aria-busy", "false")
  await expect(deck.locator(".diagram-svg > svg")).toBeVisible()
}

export async function selectSlide(deck: Locator, id: string) {
  await deck.locator(`.slide-dot[data-slide-id="${id}"]`).click()
}

export function getDeck(document: SketchbookDocument, id: string) {
  const block = document.blocks.find((block) => block.id === id)
  if (block?.type !== "diagram-deck") throw new Error(`Missing fixture deck ${id}`)
  return block
}
