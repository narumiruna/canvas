import { readdir, readFile, realpath } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { describe, expect, test } from "vitest"
import { type DiagramDeck, type SketchbookDocument, validateDocument } from "../src/document.js"

const skillRoot = fileURLToPath(new URL("../skills/sketchbook-explain-diagrams/", import.meta.url))
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
function diagramNodes(source: string) {
  const nodes = source.replace(/^\s*subgraph[^\n]+/gm, "")
  return new Map(
    [...nodes.matchAll(/(\w+)(?:\[|\{)"([^"]+)"(?:\]|\})/g)].map((match) => [match[1], match[2]]),
  )
}

function expectArchitectureDetails(deck: DiagramDeck) {
  const [overview, api, storage] = deck.slides
  const labels = new Map([
    ["Client", "Client"],
    ["Api", "API"],
    ["Store", "Store"],
    ["Validator", "Validator"],
    ["Handler", "Handler"],
    ["Queue", "Queue"],
    ["Revision", "Revision check"],
    ["Temp", "Temp JSON"],
    ["Commit", "Rename"],
    ["Files", "Files"],
  ])
  const stages = [
    { slide: overview, nodes: ["Client", "Api", "Store"] },
    { slide: api, nodes: ["Client", "Api", "Validator", "Handler", "Store"] },
    { slide: storage, nodes: ["Api", "Store", "Queue", "Revision", "Temp", "Commit", "Files"] },
  ]
  for (const { slide, nodes } of stages) {
    const actual = diagramNodes(slide.mermaid)
    expect([...actual.keys()].sort()).toEqual([...nodes].sort())
    for (const [id, label] of actual) expect(label).toBe(labels.get(id))
  }
  for (const edge of ["Api --> Validator[", "Validator --> Handler[", "Handler --> Store["]) {
    expect(api.mermaid).toContain(edge)
  }
  for (const edge of [
    'Api["API"] --> Store[',
    "Store --> Queue[",
    "Queue --> Revision[",
    "Revision --> Temp[",
    "Temp --> Commit[",
    "Commit --> Files[",
  ]) {
    expect(storage.mermaid).toContain(edge)
  }
  for (const name of ["API", "Validator", "Handler", "Store"]) {
    expect(api.explanationMarkdown).toContain(name)
  }
  for (const name of ["Store", "Queue", "Revision check", "Temp JSON", "Rename", "Files"]) {
    expect(storage.explanationMarkdown).toContain(name)
  }
  expect(api.explanationMarkdown).toContain("invalid input stops without a write")
  expect(storage.explanationMarkdown).toContain("rejects a stale replacement")
  expect(storage.explanationMarkdown).toContain("only after a match")
}

function expectProcessStages(deck: DiagramDeck) {
  const [overview, start, processing, end] = deck.slides
  const overviewNodes = diagramNodes(overview.mermaid)
  expect(Object.fromEntries(overviewNodes)).toEqual({
    Read: "Read",
    Edit: "Edit",
    Validate: "Validate",
    Compare: "Revision?",
    Commit: "Commit",
    Conflict: "Conflict",
    Result: "Saved",
  })
  const stages = [
    { slide: start, nodes: ["Read", "Edit"], explanation: ["Read", "Edit"] },
    {
      slide: processing,
      nodes: ["Edit", "Validate", "Compare", "Commit", "Conflict", "Read"],
      explanation: ["Edit", "Validate", "Read", "Commit", "Conflict"],
    },
    { slide: end, nodes: ["Commit", "Result"], explanation: ["Commit", "Result"] },
  ]
  for (const { slide, nodes, explanation } of stages) {
    const actual = diagramNodes(slide.mermaid)
    expect([...actual.keys()].sort()).toEqual([...nodes].sort())
    for (const [id, label] of actual) expect(label).toBe(overviewNodes.get(id))
    for (const id of explanation) {
      expect(slide.explanationMarkdown).toContain(overviewNodes.get(id))
    }
  }
  expect(start.mermaid).toContain('Read["Read"] --> Edit[')
  expect(processing.mermaid).toContain('Edit["Edit"] --> Validate[')
  expect(processing.mermaid).toContain("Validate --> Compare{")
  expect(processing.mermaid).toContain("Compare -->|Match| Commit[")
  expect(processing.mermaid).toContain("Compare -->|Stale| Conflict[")
  expect(processing.mermaid).toContain("Conflict --> Read[")
  expect(end.mermaid).toContain('Commit["Commit"] --> Result[')
  expect(overview.explanationMarkdown).toContain("Conflict makes no write and returns to Read")
  expect(processing.explanationMarkdown).toContain("not a blind retry")
  expect(end.explanationMarkdown).toContain(
    "does not verify Mermaid, math, readability, or content correctness",
  )
}

const articleOutlines = {
  "architecture-walkthrough.json": {
    blocks: [
      "architecture-intro",
      "architecture-deck",
      "architecture-context",
      "architecture-boundary",
      "architecture-conclusion",
    ],
    headings: [
      "Scope and terms",
      "Request path",
      "Latency model",
      "Public interface",
      "Conclusion",
    ],
    definitions: [
      "教學模型",
      "Document API",
      "Document Store",
      "revision is the stored version number",
    ],
    conclusion: [
      "Validation",
      "revision checks",
      "atomic replacement",
      "not rendering",
      "implementation",
    ],
  },
  "process-walkthrough.json": {
    blocks: [
      "process-intro",
      "process-deck",
      "process-note",
      "process-conflict",
      "process-conclusion",
    ],
    headings: [
      "Inputs and revision",
      "Replacement path",
      "Failure boundary",
      "Conflict recovery",
      "Conclusion",
    ],
    definitions: ["revision, a version number", "complete replacement", "expectedRevision"],
    conclusion: [
      "validation",
      "matching revision",
      "commit",
      "conflict",
      "unverified",
      "human acceptance",
    ],
  },
} as const

function fixtureMarkdown(document: SketchbookDocument) {
  return document.blocks.flatMap((block) =>
    block.type === "markdown"
      ? [block.markdown]
      : block.slides.map((slide) => slide.explanationMarkdown),
  )
}

// A known article outline and its prerequisite terms are regression checks, not a prose evaluator.
function expectArticleOutline(document: SketchbookDocument, name: (typeof assets)[number]) {
  const expected = articleOutlines[name]
  expect(document.blocks.map((block) => block.id)).toEqual(expected.blocks)
  const headings = document.blocks.flatMap((block) => {
    if (block.type === "diagram-deck") {
      for (const slide of block.slides) {
        expect(slide.explanationMarkdown).not.toMatch(/^#{1,3}\s/m)
      }
      return [block.title]
    }
    expect(block.markdown).not.toMatch(/^#\s/m)
    return [...block.markdown.matchAll(/^## (.+)$/gm)].map((match) => match[1])
  })
  expect(headings).toEqual(expected.headings)
  expect(headings).not.toContain(document.title)
  const intro = document.blocks[0]
  const conclusion = document.blocks.at(-1)
  expect(intro.type).toBe("markdown")
  expect(conclusion?.type).toBe("markdown")
  if (intro.type !== "markdown" || conclusion?.type !== "markdown") return
  for (const term of expected.definitions) expect(intro.markdown).toContain(term)
  for (const term of expected.conclusion) expect(conclusion.markdown).toContain(term)
  for (const markdown of fixtureMarkdown(document)) {
    expect(markdown).not.toMatch(/preceding slide|next slide|omitted here|rendering fixtures?/i)
  }
}

function expectParsedEmphasis(markdown: string) {
  const html = renderToStaticMarkup(
    createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, markdown),
  )
  expect(html).not.toContain("**")
  return html
}

function expectCompactLabels(document: SketchbookDocument) {
  const labels = new Map<string, string>()
  for (const block of document.blocks) {
    if (block.type !== "diagram-deck") continue
    for (const slide of block.slides) {
      for (const [id, label] of diagramNodes(slide.mermaid)) {
        if (labels.has(id)) expect(label).toBe(labels.get(id))
        labels.set(id, label)
      }
      // A fixture-specific label budget cannot measure rendered CSS pixels.
      for (const [, label] of slide.mermaid.matchAll(/"([^"]+)"/g)) {
        expect([...label].length).toBeLessThanOrEqual(16)
      }
      if (diagramNodes(slide.mermaid).size > 2) {
        expect(slide.mermaid).toMatch(/^flowchart TD\b/)
      }
    }
  }
}

describe("bundled Sketchbook skill", () => {
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
    expect(fields.name).toBe("sketchbook-explain-diagrams")
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

  test("requires whole-article review before slide continuity and saving", async () => {
    const skill = await readFile(skillFile, "utf8")
    const patterns = await readFile(resolve(skillRoot, "references/diagram-patterns.md"), "utf8")
    const articleReview = skill.indexOf("review the whole article's outline")
    const slideReview = skill.indexOf("before checking each slide's contribution and continuity")
    const save = skill.indexOf("5. Use `sketchbook_write`")
    expect(articleReview).toBeGreaterThan(0)
    expect(slideReview).toBeGreaterThan(articleReview)
    expect(save).toBeGreaterThan(slideReview)
    for (const check of ["concept order", "first definitions", "repetition", "conclusion"]) {
      expect(skill).toContain(check)
    }
    expect(patterns).toContain("read all article blocks and slide explanations in order")
    expect(patterns).toContain("define unfamiliar terms at first use")
    expect(patterns).toContain("State the document subject once")
    expect(patterns).toContain("end the article with an answer, important limits")
    expect(patterns).toContain("not establish arbitrary narrative quality")
    expect(patterns).toContain("instead of repeating a template")
  })

  test("documents viewer headings and separate evidence states", async () => {
    const format = await readFile(resolve(skillRoot, "references/document-format.md"), "utf8")
    expect(format).toContain("`document.title` owns the page H1")
    expect(format).toContain("Start article Markdown headings at H2")
    expect(format).toContain("`deck.title` becomes a stable H2")
    expect(format).toContain("active slide title becomes H3")
    expect(format).toContain("start at H4 so they cannot compete")
    expect(format).toContain("`**資料範圍**：依` rather than `**資料範圍：**依`")
    for (const state of ["Saved", "Rendered", "Readable", "Content-correct", "Human acceptance"]) {
      expect(format).toContain(`- **${state}**:`)
    }
    expect(format).toContain("agent checks do not establish this state")
    expect(format).toContain("mark missing evidence as unverified")
  })

  test("requires complete desktop and mobile visual coverage at the initial fitted size", async () => {
    const skill = await readFile(skillFile, "utf8")
    const patterns = await readFile(resolve(skillRoot, "references/diagram-patterns.md"), "utf8")
    expect(skill).toContain(
      "inspect the full rendered article and every slide at desktop and 390px",
    )
    expect(skill).toContain(
      "explicitly report which viewport, article, or slide coverage remains unverified",
    )
    expect(patterns).toContain("minimum default label size of 12 CSS px at both widths")
    expect(patterns).toContain("every visible node, edge, and subgraph label")
    expect(patterns).toContain("initial fitted view before any camera action")
    expect(patterns).toContain("not a promise for arbitrary graphs")
    expect(patterns).toContain("rather than depending on Reset or Zoom")
    expect(patterns).toContain("only the initial slide is not a complete visual review")
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
      const prose = fixtureMarkdown(fixture).join("\n")
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

  test.each(assets)(
    "%s has the reviewed article outline and compact teaching labels",
    async (name) => {
      const document = validateDocument(await loadFixture(name))
      expectArticleOutline(document, name)
      expectCompactLabels(document)
      for (const markdown of fixtureMarkdown(document)) expectParsedEmphasis(markdown)
    },
  )

  test("the CJK emphasis example renders without raw delimiters", async () => {
    const document = validateDocument(await loadFixture("architecture-walkthrough.json"))
    const markdown = fixtureMarkdown(document)[0]
    expect(expectParsedEmphasis(markdown)).toContain("<strong>資料範圍</strong>：此")
    const broken = markdown.replace("**資料範圍**：此", "**資料範圍：**此")
    expect(broken).not.toBe(markdown)
    expect(() => expectParsedEmphasis(broken)).toThrow()
  })

  test.each(assets)("known outline checks catch authoring failures in %s", async (name) => {
    const original = validateDocument(await loadFixture(name))
    const mutate = (change: (document: SketchbookDocument) => void) => {
      const document = structuredClone(original)
      change(document)
      expect(() => validateDocument(document)).not.toThrow()
      expect(() => expectArticleOutline(document, name)).toThrow()
    }
    mutate((document) => {
      const intro = document.blocks[0]
      if (intro.type === "markdown") intro.markdown = `# ${document.title}\n\n${intro.markdown}`
    })
    mutate((document) => {
      const intro = document.blocks[0]
      if (intro.type === "markdown") {
        intro.markdown = intro.markdown.replace(
          articleOutlines[name].definitions[0],
          "undefined term",
        )
      }
    })
    mutate((document) => {
      const intro = document.blocks[0]
      document.blocks[0] = document.blocks[1]
      document.blocks[1] = intro
    })
    mutate((document) => {
      const deck = document.blocks[1]
      if (deck.type === "diagram-deck") {
        deck.slides[0].explanationMarkdown = `## Competing chapter\n\n${deck.slides[0].explanationMarkdown}`
      }
    })
    mutate((document) => {
      const intro = document.blocks[0]
      if (intro.type === "markdown") {
        intro.markdown = intro.markdown.replace(/^## .+/, `## ${document.title}`)
      }
    })
    mutate((document) => {
      document.blocks.pop()
    })
    mutate((document) => {
      const conclusion = document.blocks.at(-1)
      if (conclusion?.type === "markdown") {
        conclusion.markdown = "## Conclusion\n\nUse the arrows to read the diagrams."
      }
    })
  })

  test.each(assets)("label checks catch long labels and horizontal chains in %s", async (name) => {
    const document = validateDocument(await loadFixture(name))
    const deck = document.blocks.find(
      (block): block is DiagramDeck => block.type === "diagram-deck",
    )
    if (!deck) throw new Error("Missing teaching deck")
    const source = deck.slides[0].mermaid
    deck.slides[0].mermaid = source.replace(
      /"[^"]+"/,
      '"A long prose explanation that belongs in Markdown"',
    )
    expect(() => validateDocument(document)).not.toThrow()
    expect(() => expectCompactLabels(document)).toThrow()
    deck.slides[0].mermaid = source.replace("flowchart TD", "flowchart LR")
    expect(() => validateDocument(document)).not.toThrow()
    expect(() => expectCompactLabels(document)).toThrow()
  })

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
    for (const slide of deck.slides) expect(slide.mermaid).toMatch(/^flowchart TD\b/)
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
      from: 'Edit["Edit"]',
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
    { asset: "architecture-walkthrough.json", index: 2, caveat: "only after a match" },
    { asset: "process-walkthrough.json", index: 2, caveat: "not a blind retry" },
  ] as const)(
    "fixture checks catch a lost failure caveat in $asset",
    async ({ asset, index, caveat }) => {
      const fixture = await loadFixture(asset)
      const deck = fixture.blocks.find((block: { type: string }) => block.type === "diagram-deck")
      expect(deck.slides[index].explanationMarkdown).toContain(caveat)
      deck.slides[index].explanationMarkdown = deck.slides[index].explanationMarkdown.replace(
        caveat,
        "without safeguards",
      )
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
