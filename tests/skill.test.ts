import { readdir, readFile, realpath } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"
import { type DiagramDeck, validateDocument } from "../src/document.js"

const skillRoot = fileURLToPath(new URL("../skills/canvas-explain-diagrams/", import.meta.url))
const skillFile = resolve(skillRoot, "SKILL.md")
const assets = ["architecture-walkthrough.json", "process-walkthrough.json"] as const

async function loadFixture(name: (typeof assets)[number]) {
  return JSON.parse(await readFile(resolve(skillRoot, "assets", name), "utf8"))
}

function localLinks(markdown: string) {
  return [...markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1])
}

function isWithinSkill(path: string) {
  const local = relative(skillRoot, path)
  return local !== ".." && !local.startsWith("../") && !isAbsolute(local)
}

// These assertions describe the bundled fixtures, not arbitrary Mermaid or narrative quality.
function expectArchitectureDetails(deck: DiagramDeck) {
  const [overview, api, storage] = deck.slides
  for (const slide of [overview, api, storage]) {
    expect(slide.mermaid).toMatch(/(?:^|\s)Api\["Document API — 文件 API"\]/)
    expect(slide.mermaid).toMatch(/(?:^|\s)Store\["Document Store — 工作區文件儲存與版本資料"\]/)
  }
  for (const edge of ["Api --> Validator[", "Validator --> Handler[", "Handler --> Store["]) {
    expect(api.mermaid).toContain(edge)
  }
  for (const edge of [
    'Api["Document API — 文件 API"] --> Store[',
    "Store --> Queue[",
    "Queue --> Revision[",
    "Revision --> Temp[",
    "Temp --> Commit[",
    "Commit --> Files[",
  ]) {
    expect(storage.mermaid).toContain(edge)
  }
  for (const name of ["Document API", "Request Validator", "Request Handler", "Document Store"]) {
    expect(api.explanationMarkdown).toContain(name)
  }
  for (const name of ["Document Store", "Write Queue", "Revision Check", "Atomic Rename"]) {
    expect(storage.explanationMarkdown).toContain(name)
  }
}

function processNodes(source: string) {
  return new Map(
    [...source.matchAll(/(\w+)(?:\[|\{)"([^"]+)"(?:\]|\})/g)].map((match) => [match[1], match[2]]),
  )
}

function expectProcessStages(deck: DiagramDeck) {
  const [overview, start, processing, end] = deck.slides
  const overviewNodes = processNodes(overview.mermaid)
  const stages = [
    { slide: start, nodes: ["Start", "Read", "Edit"], explanation: ["Read", "Edit", "Validate"] },
    {
      slide: processing,
      nodes: ["Edit", "Validate", "Compare", "Commit", "Conflict", "Read"],
      explanation: ["Edit", "Validate", "Read", "Commit", "Result"],
    },
    { slide: end, nodes: ["Commit", "Result", "End"], explanation: ["Commit", "Result"] },
  ]
  for (const { slide, nodes, explanation } of stages) {
    const actual = processNodes(slide.mermaid)
    expect([...actual.keys()].sort()).toEqual([...nodes].sort())
    for (const [id, label] of actual) expect(label).toBe(overviewNodes.get(id))
    for (const id of explanation) {
      expect(slide.explanationMarkdown).toContain(overviewNodes.get(id))
    }
  }
  expect(start.mermaid).toContain('Start["Start"] --> Read[')
  expect(start.mermaid).toContain("Read --> Edit[")
  expect(processing.mermaid).toContain('Edit["Prepare complete replacement"] --> Validate[')
  expect(processing.mermaid).toContain("Validate --> Compare{")
  expect(processing.mermaid).toContain("Compare -->|Yes| Commit[")
  expect(processing.mermaid).toContain("Compare -->|No| Conflict[")
  expect(processing.mermaid).toContain("Conflict --> Read[")
  expect(end.mermaid).toContain('Commit["Commit replacement"] --> Result[')
  expect(end.mermaid).toContain("Result --> End[")
}

describe("bundled Canvas skill", () => {
  test("has portable, concise routing frontmatter", async () => {
    const skill = await readFile(skillFile, "utf8")
    const frontmatter = skill.match(/^---\n([\s\S]+?)\n---\n/)
    expect(frontmatter).not.toBeNull()
    const fields = Object.fromEntries(
      (frontmatter?.[1] ?? "")
        .trim()
        .split("\n")
        .map((line) => {
          const field = line.match(/^([a-z-]+): (.+)$/)
          expect(field, `Simple YAML scalar expected: ${line}`).not.toBeNull()
          return [field?.[1], field?.[2]]
        }),
    )
    expect(Object.keys(fields).sort()).toEqual(["description", "name"])
    expect(fields.name).toBe("canvas-explain-diagrams")
    expect(fields.name).toBe(relative(dirname(skillRoot), skillRoot))
    expect(fields.name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    expect(fields.name.length).toBeLessThanOrEqual(64)
    expect(fields.description.trim().length).toBeGreaterThan(0)
    expect(fields.description.length).toBeLessThanOrEqual(1024)
    expect(fields.description).toMatch(/architecture/i)
    expect(fields.description).toMatch(/process/i)
    expect(fields.description).toMatch(/when/i)
    expect(skill.split("\n").length).toBeLessThan(100)
  })

  test("directly links every resource and keeps local links inside the skill", async () => {
    const resources = (await readdir(skillRoot, { recursive: true, withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => resolve(entry.parentPath, entry.name))
      .filter((path) => path !== skillFile)
    const skill = await readFile(skillFile, "utf8")
    const directTargets = localLinks(skill).map((link) => resolve(skillRoot, link))
    expect(directTargets.sort()).toEqual(resources.sort())
    expect(resources).toHaveLength(4)

    for (const file of [skillFile, ...resources.filter((path) => path.endsWith(".md"))]) {
      for (const link of localLinks(await readFile(file, "utf8"))) {
        expect(link, "Bundled links must be relative local paths").not.toMatch(/^(?:[a-z]+:|\/)/i)
        const target = resolve(dirname(file), link.split("#")[0])
        expect(isWithinSkill(target), `${file}: ${link}`).toBe(true)
        expect(isWithinSkill(await realpath(target)), `${file}: ${link}`).toBe(true)
      }
    }
  })

  for (const name of assets) {
    test(`${name} satisfies the strict schema and contains mixed-format content`, async () => {
      const fixture = await loadFixture(name)
      expect(() => validateDocument(fixture)).not.toThrow()
      expect(Buffer.byteLength(JSON.stringify(fixture), "utf8")).toBeLessThanOrEqual(1024 * 1024)
      const prose = fixture.blocks
        .filter((block: { type: string }) => block.type === "markdown")
        .map((block: { markdown: string }) => block.markdown)
        .join("\n")
      expect(prose).toMatch(/\S/)
      expect(prose).toMatch(/(?<!\$)\$[^$\n]+\$(?!\$)/)
      expect(prose).toMatch(/\n\$\$\n[\s\S]+?\n\$\$/)
      expect(prose).toMatch(/```typescript\n[\s\S]+?\n```/)
      const decks = fixture.blocks.filter(
        (block: { type: string }) => block.type === "diagram-deck",
      )
      expect(decks.length).toBeGreaterThanOrEqual(2)
      expect(decks.some((deck: { slides: unknown[] }) => deck.slides.length === 1)).toBe(true)
      for (const deck of decks) {
        for (const slide of deck.slides) {
          expect(slide.mermaid).toMatch(/^flowchart\s+(?:LR|RL|TD|TB|BT)\b/)
          expect(slide.explanationMarkdown.trim()).not.toBe("")
        }
      }
    })
  }

  test("architecture progresses from overview to API to storage with stable nodes", async () => {
    const fixture = await loadFixture("architecture-walkthrough.json")
    const deck = fixture.blocks.find((block: { id: string }) => block.id === "architecture-deck")
    expect(deck.slides.map((slide: { id: string }) => slide.id)).toEqual([
      "architecture-overview",
      "architecture-api",
      "architecture-storage",
    ])
    expectArchitectureDetails(deck)
    for (const slide of deck.slides) expect(slide.mermaid).toContain("subgraph")
    expect(deck.slides[1].mermaid).toContain(
      "Request Validator — check the complete document before any storage operation",
    )
  })

  test("process progresses from overview to start, processing, and end with stable steps", async () => {
    const fixture = await loadFixture("process-walkthrough.json")
    const deck = fixture.blocks.find((block: { id: string }) => block.id === "process-deck")
    expect(deck.slides.map((slide: { id: string }) => slide.id)).toEqual([
      "process-overview",
      "process-start",
      "process-processing",
      "process-end",
    ])
    expectProcessStages(deck)
  })

  test.each([
    { asset: "architecture-walkthrough.json", index: 1 },
    { asset: "architecture-walkthrough.json", index: 2 },
    { asset: "process-walkthrough.json", index: 1 },
    { asset: "process-walkthrough.json", index: 2 },
    { asset: "process-walkthrough.json", index: 3 },
  ] as const)(
    "fixture checks catch a duplicate overview in $asset slide $index",
    async ({ asset, index }) => {
      const fixture = await loadFixture(asset)
      const deck = fixture.blocks.find((block: { type: string }) => block.type === "diagram-deck")
      deck.slides[index].mermaid = deck.slides[0].mermaid
      expect(() => validateDocument(fixture)).not.toThrow()
      expect(() =>
        asset === "architecture-walkthrough.json"
          ? expectArchitectureDetails(deck)
          : expectProcessStages(deck),
      ).toThrow()
    },
  )

  test.each([
    {
      asset: "architecture-walkthrough.json",
      index: 1,
      from: "Handler --> Store",
      to: "Handler --> Elsewhere",
    },
    { asset: "architecture-walkthrough.json", index: 2, from: "Api[", to: "OtherApi[" },
    { asset: "process-walkthrough.json", index: 2, from: "Edit[", to: "OtherEdit[" },
    { asset: "process-walkthrough.json", index: 3, from: "Commit[", to: "OtherCommit[" },
    {
      asset: "process-walkthrough.json",
      index: 2,
      from: "Conflict --> Read[",
      to: "Conflict --> Commit[",
    },
    {
      asset: "process-walkthrough.json",
      index: 2,
      from: 'Edit["Prepare complete replacement"]',
      to: 'Edit["Unrelated operation"]',
    },
  ] as const)(
    "fixture checks catch broken $from continuity in $asset",
    async ({ asset, index, from, to }) => {
      const fixture = await loadFixture(asset)
      const deck = fixture.blocks.find((block: { type: string }) => block.type === "diagram-deck")
      expect(deck.slides[index].mermaid).toContain(from)
      deck.slides[index].mermaid = deck.slides[index].mermaid.replace(from, to)
      expect(() => validateDocument(fixture)).not.toThrow()
      expect(() =>
        asset === "architecture-walkthrough.json"
          ? expectArchitectureDetails(deck)
          : expectProcessStages(deck),
      ).toThrow()
    },
  )

  test.each([
    "sequenceDiagram\nAlice->>Bob: unsupported",
    "graph LR\n A --> B",
    "---\ntitle: Override\n---\nflowchart LR\n A --> B",
    '%%{init: {"securityLevel": "loose"}}%%\nflowchart LR\n A --> B',
    'flowchart LR\n A --> B\n click A "https://example.com"',
    'flowchart LR\n A["<b>HTML label</b>"]',
    'flowchart LR\n A@{ img: "https://example.com/image.png" }',
    'flowchart LR\n A@{ icon: "fa:home" }',
  ])("rejects unsupported or unsafe Mermaid source: %s", async (mermaid) => {
    const fixture = await loadFixture("architecture-walkthrough.json")
    const deck = fixture.blocks.find((block: { type: string }) => block.type === "diagram-deck")
    deck.slides[0].mermaid = mermaid
    expect(() => validateDocument(fixture)).toThrow()
  })

  test("rejects an extra field and duplicate fixture IDs", async () => {
    const extra = await loadFixture("architecture-walkthrough.json")
    extra.unexpected = true
    expect(() => validateDocument(extra)).toThrow()

    const duplicateBlock = await loadFixture("architecture-walkthrough.json")
    duplicateBlock.blocks[1].id = duplicateBlock.blocks[0].id
    expect(() => validateDocument(duplicateBlock)).toThrow()

    const duplicateSlide = await loadFixture("process-walkthrough.json")
    const deck = duplicateSlide.blocks.find(
      (block: { type: string }) => block.type === "diagram-deck",
    )
    deck.slides[1].id = deck.slides[0].id
    expect(() => validateDocument(duplicateSlide)).toThrow()
  })
})
