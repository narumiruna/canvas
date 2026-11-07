import { readFile, writeFile } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import { readingFixture } from "../fixtures/reading-layout.js"
import { captureArticle, getDeck, readingMetrics, rendered, save, selectSlide } from "./helpers.js"

for (const { width, fontSize, stacked } of [
  { width: 900, fontSize: 16, stacked: true },
  { width: 1024, fontSize: 16, stacked: false },
  { width: 1024, fontSize: 20, stacked: true },
  { width: 1440, fontSize: 20, stacked: true },
]) {
  test(`reading columns fit available width at ${width}px with ${fontSize}px root text`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto((await save(request, readingFixture())).url)
    await page.addStyleTag({ content: `:root { font-size: ${fontSize}px; }` })
    const deck = page.locator('[data-block-id="reading"]')
    await rendered(deck)
    await expect.poll(async () => (await readingMetrics(deck)).overflow).toBe(false)
    await expect
      .poll(async () => {
        const { frame, explanation, pagination } = await readingMetrics(deck)
        if (!explanation || !pagination) throw new Error("Missing reading regions")
        return (
          explanation.y >= pagination.y + pagination.height - 1 &&
          explanation.x < frame.x + frame.width
        )
      })
      .toBe(stacked)
    const { frame, graph } = await readingMetrics(deck)
    expect(graph.width).toBeLessThanOrEqual(frame.width + 1)
    await expect(deck.locator(".slide-explanation p").first()).toBeVisible()
  })
}

const baseline = JSON.parse(
  await readFile(new URL("../fixtures/reading-layout-baseline.json", import.meta.url), "utf8"),
) as {
  sourceRevision: string
  measurements: Array<{
    width: number
    height: number
    touch: boolean
    slide: string
    firstParagraph: { y: number }
    lineHeight: number
    minFontPx: number
  }>
}

for (const viewport of [
  { width: 1440, height: 1000, touch: false },
  { width: 1280, height: 960, touch: false },
  { width: 390, height: 844, touch: false },
  { width: 390, height: 844, touch: true },
]) {
  test.describe(`reading layout ${viewport.width}x${viewport.height}, touch=${viewport.touch}`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: viewport.touch,
      isMobile: viewport.touch,
    })

    test("compact reading improves without smaller labels; wide and tall graphs stay contained", async ({
      page,
      request,
    }, testInfo) => {
      const content = readingFixture()
      const authored = getDeck(content, "reading")
      await page.goto((await save(request, content)).url)
      const deck = page.locator('[data-block-id="reading"]')
      await rendered(deck)
      await captureArticle(page, testInfo.outputPath("article-initial.png"))
      const before = baseline.measurements.find(
        (measurement) =>
          measurement.width === viewport.width &&
          measurement.height === viewport.height &&
          measurement.touch === viewport.touch &&
          measurement.slide === "compact",
      )
      if (!before) throw new Error("Missing controlled reading baseline")
      expect(baseline.sourceRevision).toBe("348c400")
      const evidence = []
      for (const slide of authored.slides) {
        await selectSlide(deck, slide.id)
        await rendered(deck)
        await expect(deck.locator(".deck-heading h2")).toHaveText(authored.title)
        await expect(deck.locator(".deck-heading h3")).toHaveText(slide.title)
        await expect(deck.locator(".diagram")).toHaveCount(1)
        await expect(deck.locator(".diagram-svg > svg")).toHaveCount(1)
        await expect(deck.locator(".slide-explanation")).toHaveCount(1)
        await expect(deck.locator(".diagram-secondary-controls")).toBeHidden()
        await expect(deck.getByRole("alert")).toHaveCount(0)
        if (viewport.width <= 600) {
          await expect(deck.locator(".deck-kind")).toBeHidden()
          await expect(deck.locator(".diagram-pan-hint")).toBeHidden()
        }
        const metrics = await readingMetrics(deck)
        const { frame, graph, explanation, pagination, firstParagraph } = metrics
        if (!explanation || !pagination || !firstParagraph)
          throw new Error("Missing reading composition")
        expect(metrics.overflow).toBe(false)
        expect(metrics.bodyFontPx).toBeGreaterThanOrEqual(16)
        expect(metrics.labels).toBeGreaterThan(0)
        expect(metrics.minFontPx).toBeGreaterThan(0)
        expect(frame.height).toBeLessThanOrEqual(576)
        expect(graph.x).toBeGreaterThanOrEqual(frame.x - 1)
        expect(graph.y).toBeGreaterThanOrEqual(frame.y - 1)
        expect(graph.x + graph.width).toBeLessThanOrEqual(frame.x + frame.width + 1)
        expect(graph.y + graph.height).toBeLessThanOrEqual(frame.y + frame.height + 1)
        expect(pagination.y).toBeGreaterThanOrEqual(frame.y + frame.height - 1)
        if (viewport.width >= 1024) {
          expect(explanation.x).toBeGreaterThanOrEqual(frame.x + frame.width - 1)
          expect(explanation.y).toBeLessThan(frame.y + frame.height)
          expect(pagination.x + pagination.width).toBeLessThanOrEqual(explanation.x + 1)
        } else {
          expect(explanation.y).toBeGreaterThanOrEqual(pagination.y + pagination.height - 1)
          expect(explanation.x).toBeGreaterThanOrEqual(frame.x)
          expect(explanation.x + explanation.width).toBeLessThanOrEqual(frame.x + frame.width)
        }
        const clippedHeadings = await deck
          .locator(".deck-heading h2, .deck-heading h3")
          .evaluateAll((nodes) =>
            nodes.some((node) => {
              const style = getComputedStyle(node)
              return (
                style.textOverflow === "ellipsis" ||
                node.scrollHeight > node.clientHeight + 1 ||
                node.scrollWidth > node.clientWidth + 1
              )
            }),
          )
        expect(clippedHeadings).toBe(false)
        const paragraphs = slide.explanationMarkdown
          .split("\n\n")
          .filter((paragraph) => !paragraph.startsWith("```"))
        await expect(deck.locator(".slide-explanation p")).toHaveText(paragraphs)
        for (const paragraph of await deck.locator(".slide-explanation p").all())
          await expect(paragraph).toBeVisible()
        const code = /```typescript\n([\s\S]*?)\n```/.exec(slide.explanationMarkdown)?.[1]
        if (code) await expect(deck.locator(".slide-explanation pre code")).toHaveText(`${code}\n`)
        if (slide.id === "compact") {
          expect(metrics.minFontPx).toBeGreaterThanOrEqual(12)
          // The same authored content must improve composition, not shrink labels.
          expect(metrics.minFontPx).toBeGreaterThanOrEqual(before.minFontPx - 0.05)
          if (viewport.width === 390) {
            expect(firstParagraph.y).toBeLessThanOrEqual(
              before.firstParagraph.y - before.lineHeight + 0.5,
            )
          }
        }
        const path = testInfo.outputPath(`reading-${slide.id}.png`)
        await deck.screenshot({ path })
        await testInfo.attach(slide.id, { path, contentType: "image/png" })
        evidence.push({
          slide: slide.id,
          ...metrics,
          ...(slide.id === "compact"
            ? {
                explanationStartChangePx: firstParagraph.y - before.firstParagraph.y,
                fittedLabelChangePx: metrics.minFontPx - before.minFontPx,
              }
            : {}),
        })
      }
      await captureArticle(page, testInfo.outputPath("article-final.png"))
      const path = testInfo.outputPath("reading-layout.json")
      await writeFile(
        path,
        JSON.stringify(
          {
            fixture: "readingFixture",
            ...viewport,
            sourceRevision: baseline.sourceRevision,
            baseline: before,
            evidence,
          },
          null,
          2,
        ),
      )
      await testInfo.attach("reading-layout", { path, contentType: "application/json" })
    })

    if (viewport.touch) {
      test("touch help describes controls and article scrolling, not unsupported camera gestures", async ({
        page,
        request,
        context,
      }) => {
        await page.addInitScript(() => {
          Element.prototype.requestFullscreen = () =>
            Promise.reject(new Error("Denied for touch test"))
        })
        await page.goto((await save(request, readingFixture())).url)
        const deck = page.locator('[data-block-id="reading"]')
        await rendered(deck)
        const disclosure = deck.getByRole("button", { name: "More controls" })
        const frame = deck.locator(".diagram-viewport")
        const help = deck.locator(".diagram-pan-hint")
        expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true)
        await expect(help).toBeHidden()
        await expect(frame).toHaveAccessibleName("Interactive diagram")
        await expect(frame).toHaveAccessibleDescription(/controls.*zoom.*scroll/i)
        await expect(frame).not.toHaveAccessibleDescription(/pan|pinch|wheel|drag/i)
        await disclosure.tap()
        await expect(disclosure).toHaveAttribute("aria-expanded", "true")
        await expect(help).toBeVisible()
        await expect(help).toContainText(/controls.*zoom.*scroll/i)
        await expect(help).not.toContainText(/pan|pinch|wheel|drag/i)
        await expect(deck.getByRole("button", { name: "Zoom in", exact: true })).toBeVisible()
        await disclosure.tap()
        await frame.scrollIntoViewIfNeeded()
        expect(await frame.evaluate((node) => getComputedStyle(node).touchAction)).toBe("pan-y")
        const stage = deck.locator(".diagram-svg")
        const camera = await stage.getAttribute("style")
        const scroll = await page.evaluate(() => scrollY)
        const box = await frame.boundingBox()
        if (!box) throw new Error("Missing touch diagram")
        const client = await context.newCDPSession(page)
        const x = box.x + box.width / 2
        const y = box.y + box.height - 20
        await client.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y }],
        })
        for (let step = 1; step <= 8; step++) {
          await client.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x, y: y - step * 18 }],
          })
          await page.waitForTimeout(16)
        }
        await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
        await client.detach()
        await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scroll + 40)
        await expect(stage).toHaveAttribute("style", camera ?? "")
        await deck.getByRole("button", { name: "Fullscreen", exact: true }).tap()
        await expect(page.getByRole("dialog")).toBeVisible()
        await expect(disclosure).toHaveAttribute("aria-expanded", "false")
        await disclosure.tap()
        await expect(help).toBeVisible()
        await expect(help).toContainText(/controls.*zoom.*exit fullscreen.*scroll/i)
        await expect(frame).toHaveAccessibleDescription(/controls.*zoom.*exit fullscreen.*scroll/i)
        await expect(frame).not.toHaveAccessibleDescription(/pan|pinch|wheel|drag/i)
        await deck.getByRole("button", { name: "Exit fullscreen", exact: true }).tap()
        await expect(page.getByRole("dialog")).toHaveCount(0)
      })
    }
  })
}
