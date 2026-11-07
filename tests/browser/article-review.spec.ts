import { readFile, writeFile } from "node:fs/promises"
import { expect, type Locator, type Page, test } from "@playwright/test"
import { type SketchbookDocument, validateDocument } from "../../src/document.js"
import { rendered, save, selectSlide } from "./helpers.js"

const fixtures = [
  {
    name: "architecture",
    path: new URL(
      "../../skills/sketchbook-explain-diagrams/assets/architecture-walkthrough.json",
      import.meta.url,
    ),
  },
  {
    name: "process",
    path: new URL(
      "../../skills/sketchbook-explain-diagrams/assets/process-walkthrough.json",
      import.meta.url,
    ),
  },
  { name: "agent-substrate", path: new URL("../fixtures/agent-substrate.json", import.meta.url) },
]

async function diagramMetrics(deck: Locator) {
  return deck.evaluate((element) => {
    const frame = element.querySelector(".diagram-viewport")?.getBoundingClientRect()
    const svg = element.querySelector<SVGSVGElement>(".diagram-svg > svg")
    if (!frame || !svg) throw new Error("Missing rendered diagram")
    const bounds = svg.getBoundingClientRect()
    const fonts = [...svg.querySelectorAll("text")]
      .filter((label) => label.textContent?.trim())
      .map((label) => {
        const matrix = label.getScreenCTM()
        return (
          Number.parseFloat(getComputedStyle(label).fontSize) *
          Math.hypot(matrix?.a ?? 0, matrix?.b ?? 0)
        )
      })
    return {
      labels: fonts.length,
      minFontPx: Math.min(...fonts),
      maxFontPx: Math.max(...fonts),
      frameHeight: frame.height,
      graphHeight: bounds.height,
      frameWidth: frame.width,
      graphWidth: bounds.width,
    }
  })
}

async function captureArticle(page: Page, path: string) {
  await page.evaluate(async () => {
    window.scrollTo(0, 0)
    await document.fonts.ready
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
  })
  const regions = await page.locator(".diagram-viewport").evaluateAll((frames) =>
    frames.map((frame) => {
      const bounds = frame.getBoundingClientRect()
      return {
        x: Math.floor(bounds.left + scrollX + 1),
        y: Math.floor(bounds.top + scrollY + 1),
        width: Math.floor(bounds.width - 2),
        height: Math.floor(bounds.height - 2),
      }
    }),
  )
  const capture = await page.screenshot({
    path,
    fullPage: true,
    scale: "css",
    animations: "disabled",
  })
  const painted = await page.evaluate(
    async ({ base64, regions }) => {
      const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }))
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const context = canvas.getContext("2d")
      if (!context) throw new Error("Cannot inspect article capture")
      context.drawImage(bitmap, 0, 0)
      const counts = regions.map(({ x, y, width, height }) => {
        const pixels = context.getImageData(x, y, width, height).data
        let count = 0
        for (let index = 0; index < pixels.length; index += 4) {
          if (Math.min(pixels[index], pixels[index + 1], pixels[index + 2]) < 240) count++
        }
        return count
      })
      bitmap.close()
      return counts
    },
    { base64: capture.toString("base64"), regions },
  )
  for (const count of painted) {
    expect(count, "Every diagram must also paint in the complete-page capture").toBeGreaterThan(100)
  }
}

for (const fixture of fixtures) {
  for (const width of [390, 1440]) {
    test(`${fixture.name} complete article and every slide are readable at ${width}px`, async ({
      page,
      request,
    }, testInfo) => {
      test.setTimeout(60_000)
      const content: SketchbookDocument = validateDocument(
        JSON.parse(await readFile(fixture.path, "utf8")),
      )
      const errors: string[] = []
      page.on("pageerror", (error) => errors.push(error.message))
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
      await page.goto((await save(request, content)).url)
      await expect(page.locator("main h1")).toHaveCount(1)
      await expect(page.locator("main h1")).toHaveText(content.title)
      for (const block of content.blocks) {
        if (block.type === "diagram-deck") {
          await rendered(page.locator(`.deck[data-block-id="${block.id}"]`))
        }
      }
      await captureArticle(page, testInfo.outputPath("article-initial.png"))
      const chapters = await page.locator("main h2").allTextContents()
      if (fixture.name === "agent-substrate") {
        expect(chapters).toEqual(["入門", "運作方式", "安全隔離", "適用情境與限制", "參考資料"])
        await expect(page.locator('[data-block-id="intro"] table')).toHaveCount(0)
      }
      const evidence = []
      for (const block of content.blocks) {
        if (block.type !== "diagram-deck") continue
        const deck = page.locator(`.deck[data-block-id="${block.id}"]`)
        for (const slide of block.slides) {
          if (block.slides.length > 1) await selectSlide(deck, slide.id)
          await expect(deck).toHaveAttribute("data-slide-id", slide.id)
          await rendered(deck)
          await expect(deck.locator(".deck-heading h2")).toHaveText(block.title)
          await expect(deck.locator(".deck-heading h3")).toHaveText(slide.title)
          await expect(page.locator("main h2")).toHaveText(chapters)
          await expect(page.locator("main h1")).toHaveCount(1)
          await expect(page.getByRole("alert")).toHaveCount(0)
          await expect
            .poll(async () => (await diagramMetrics(deck)).minFontPx)
            .toBeGreaterThanOrEqual(12)
          const metrics = await diagramMetrics(deck)
          expect(metrics.labels).toBeGreaterThan(0)
          expect(metrics.graphWidth).toBeLessThanOrEqual(metrics.frameWidth + 1)
          expect(metrics.frameHeight - metrics.graphHeight).toBeLessThanOrEqual(64)
          const explanationFont = await deck
            .locator(".slide-explanation")
            .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
          expect(explanationFont).toBeGreaterThanOrEqual(16)
          const text = await page.locator(".markdown p, .markdown li").allTextContents()
          expect(text.filter((paragraph) => paragraph.includes("**"))).toEqual([])
          const screenshot = testInfo.outputPath(`${slide.id}.png`)
          await deck.screenshot({ path: screenshot })
          await testInfo.attach(slide.id, { path: screenshot, contentType: "image/png" })
          evidence.push({ blockId: block.id, slideId: slide.id, ...metrics })
        }
      }
      expect(errors).toEqual([])
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true)
      await captureArticle(page, testInfo.outputPath("article-final.png"))
      const outline = await page
        .locator("main h1, main h2, main h3, main h4, main h5, main h6")
        .evaluateAll((headings) =>
          headings.map((heading) => ({ level: heading.tagName, text: heading.textContent })),
        )
      const path = testInfo.outputPath("article-review.json")
      await writeFile(
        path,
        JSON.stringify({ fixture: fixture.name, width, chapters, outline, evidence }, null, 2),
      )
      await testInfo.attach("article-review", { path, contentType: "application/json" })
    })
  }
}
