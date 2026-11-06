import { readdir, readFile, realpath } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"
import { validateDocument } from "../src/document.js"

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
    for (const slide of deck.slides) {
      expect(slide.mermaid).toContain('Api["Document API — 文件 API"]')
      expect(slide.mermaid).toContain('Store["Document Store — 工作區文件儲存與版本資料"]')
      expect(slide.mermaid).toContain("subgraph")
    }
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
    const overviewNodes = new Map(
      [...deck.slides[0].mermaid.matchAll(/(\w+)(?:\[|\{)"([^"]+)"(?:\]|\})/g)].map((match) => [
        match[1],
        match[2],
      ]),
    )
    for (const slide of deck.slides.slice(1)) {
      for (const node of slide.mermaid.matchAll(/(\w+)(?:\[|\{)"([^"]+)"(?:\]|\})/g)) {
        expect(overviewNodes.get(node[1])).toBe(node[2])
      }
    }
  })

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
