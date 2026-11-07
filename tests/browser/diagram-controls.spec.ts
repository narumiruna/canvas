import { expect, type Locator, type Page, test } from "@playwright/test"
import { documentFixture, getDeck, rendered, save } from "./helpers.js"

function wideSource() {
  return `flowchart LR\n${Array.from(
    { length: 14 },
    (_, index) =>
      `N${index}["Node ${index} with a deliberately wide native label"] --> N${index + 1}`,
  ).join("\n")}`
}

const zoom = (deck: Locator) => deck.getByRole("status", { name: "Current zoom" })
const control = (deck: Locator, name: string) => deck.getByRole("button", { name, exact: true })

async function percentage(deck: Locator) {
  return Number.parseInt(
    (await deck.locator('output[aria-label="Current zoom"]').textContent()) ?? "",
    10,
  )
}

async function expectGraphInsideViewport(deck: Locator) {
  const viewport = await deck.locator(".diagram-viewport").boundingBox()
  const graphic = await deck.locator(".diagram-svg > svg").boundingBox()
  if (!viewport || !graphic) throw new Error("Missing diagram geometry")
  expect(graphic.x).toBeGreaterThanOrEqual(viewport.x)
  expect(graphic.y).toBeGreaterThanOrEqual(viewport.y)
  expect(graphic.x + graphic.width).toBeLessThanOrEqual(viewport.x + viewport.width + 1)
  expect(graphic.y + graphic.height).toBeLessThanOrEqual(viewport.y + viewport.height + 1)
}

async function rejectFullscreen(page: Page) {
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(new Error("Denied for test"))
  })
}

test("fit shows the whole graph; Reset restores native labels and zoom respects bounds", async ({
  page,
  request,
}) => {
  const content = documentFixture()
  getDeck(content, "first").slides[0].mermaid = wideSource()
  await page.goto((await save(request, content)).url)
  const deck = page.locator('[data-block-id="first"]')
  await rendered(deck)
  const fitted = await percentage(deck)
  expect(fitted).toBeLessThan(100)
  expect(fitted).toBeGreaterThan(0)
  await expectGraphInsideViewport(deck)
  await control(deck, "Reset zoom").click()
  await expect(zoom(deck)).toHaveText("100%")
  const nativeTextSize = await deck
    .locator(".diagram-svg svg text")
    .first()
    .evaluate((text) => {
      const matrix = (text as SVGGraphicsElement).getScreenCTM()
      return Number.parseFloat(getComputedStyle(text).fontSize) * Math.abs(matrix?.a ?? 0)
    })
  expect(nativeTextSize).toBeGreaterThanOrEqual(12)
  await control(deck, "Zoom in").click()
  await expect(zoom(deck)).toHaveText("125%")
  await control(deck, "Zoom out").click()
  await expect(zoom(deck)).toHaveText("100%")
  await control(deck, "Fit to screen").click()
  expect(await percentage(deck)).toBe(fitted)
  await control(deck, "Reset zoom").click()
  for (let count = 0; count < 10 && (await control(deck, "Zoom in").isEnabled()); count++)
    await control(deck, "Zoom in").click()
  await expect(zoom(deck)).toHaveText("400%")
  await expect(control(deck, "Zoom in")).toBeDisabled()
  for (let count = 0; count < 60 && (await control(deck, "Zoom out").isEnabled()); count++)
    await control(deck, "Zoom out").click()
  await expect(control(deck, "Zoom out")).toBeDisabled()
  expect(await percentage(deck)).toBe(Math.min(25, fitted))
})

test("resize refits a complete graph and preserves manual zoom until Fit is selected", async ({
  page,
  request,
}) => {
  const content = documentFixture()
  getDeck(content, "first").slides[0].mermaid = wideSource()
  await page.goto((await save(request, content)).url)
  const deck = page.locator('[data-block-id="first"]')
  await rendered(deck)
  const initial = await percentage(deck)
  await page.setViewportSize({ width: 640, height: 700 })
  await expect.poll(() => percentage(deck)).toBeLessThan(initial)
  await expectGraphInsideViewport(deck)
  await control(deck, "Reset zoom").click()
  await control(deck, "Zoom in").click()
  await expect(zoom(deck)).toHaveText("125%")
  const camera = await deck.locator(".diagram-svg").getAttribute("style")
  await page.setViewportSize({ width: 960, height: 820 })
  await expect(deck.locator(".diagram-svg")).not.toHaveAttribute("style", camera ?? "")
  await expect(zoom(deck)).toHaveText("125%")
  await control(deck, "Fit to screen").click()
  await expect.poll(() => percentage(deck)).toBeLessThan(100)
  await expectGraphInsideViewport(deck)
})

test("drag and modified wheel control the camera; normal wheel scrolls and source stays inert", async ({
  page,
  request,
}) => {
  const content = documentFixture()
  const source = wideSource()
  getDeck(content, "first").slides[0].mermaid = source
  await page.goto((await save(request, content)).url)
  const deck = page.locator('[data-block-id="first"]')
  await rendered(deck)
  await control(deck, "Reset zoom").click()
  const viewport = deck.locator(".diagram-viewport")
  const stage = deck.locator(".diagram-svg")
  const before = await stage.getAttribute("style")
  await viewport.scrollIntoViewIfNeeded()
  const box = await viewport.boundingBox()
  if (!box) throw new Error("Missing viewport")
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 90, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()
  await expect(stage).not.toHaveAttribute("style", before ?? "")
  const panned = await stage.getAttribute("style")
  const scroll = await page.evaluate(() => scrollY)
  await page.mouse.wheel(0, 120)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scroll)
  await expect(stage).toHaveAttribute("style", panned ?? "")
  await viewport.scrollIntoViewIfNeeded()
  await viewport.hover()
  await page.keyboard.down("Control")
  await page.mouse.wheel(0, -160)
  await page.keyboard.up("Control")
  await expect.poll(() => percentage(deck)).toBeGreaterThan(100)
  await control(deck, "Show source").click()
  await expect(deck.locator(".diagram-source code")).toHaveText(source)
  await expect(viewport).toBeHidden()
  for (const name of ["Zoom out", "Zoom in", "Fit to screen", "Reset zoom"])
    await expect(control(deck, name)).toBeDisabled()
  const sourceCamera = await stage.getAttribute("style")
  await viewport.dispatchEvent("wheel", { deltaY: -120, ctrlKey: true })
  await expect(stage).toHaveAttribute("style", sourceCamera ?? "")
  await expect(deck.locator(".diagram-source svg, .diagram-source script")).toHaveCount(0)
  await control(deck, "Show diagram").click()
  await viewport.focus()
  await page.keyboard.press("0")
  expect(await percentage(deck)).toBeLessThan(100)
  await page.keyboard.press("+")
  const increased = await percentage(deck)
  await page.keyboard.press("-")
  expect(await percentage(deck)).toBeLessThan(increased)
  // Unmodified arrows still belong to the parent deck, not the camera.
  await page.keyboard.press("ArrowRight")
  await rendered(deck)
  await expect(deck).toHaveAttribute("data-slide-id", "detail")
})

test("source remains inert text when a compromised response fails the rendering policy", async ({
  page,
  request,
}) => {
  const content = documentFixture()
  const fixture = await save(request, content)
  const source = 'flowchart LR\n A["<img src=/assets/source-sentinel onerror=alert(1)>"]'
  getDeck(content, "first").slides[0].mermaid = source
  const resources: string[] = []
  page.on("request", (request) => {
    if (request.url().includes("source-sentinel")) resources.push(request.url())
  })
  await page.route("**/api/documents/**", async (route) => {
    const response = await route.fetch()
    if (response.status() === 304) return route.fulfill({ response })
    const stored = await response.json()
    await route.fulfill({ response, json: { ...stored, document: content } })
  })
  await page.goto(fixture.url)
  const deck = page.locator('[data-block-id="first"]')
  await expect(deck.getByRole("alert")).toContainText("Block first, slide overview")
  await expect(deck.locator("pre code")).toHaveText(source)
  await control(deck, "Show source").click()
  await expect(deck.locator("pre code")).toHaveCount(1)
  await expect(deck.locator("pre code")).toHaveText(source)
  await expect(deck.locator("img, script, [onerror]")).toHaveCount(0)
  await expect(control(deck, "Show diagram")).toBeEnabled()
  expect(resources).toEqual([])
  await rendered(page.locator('[data-block-id="second"]'))
})

test("native fullscreen uses the same SVG and restores focus after browser exit", async ({
  page,
  request,
}) => {
  await page.goto((await save(request, documentFixture())).url)
  const deck = page.locator('[data-block-id="first"]')
  await rendered(deck)
  test.skip(!(await page.evaluate(() => document.fullscreenEnabled)), "Native API unavailable")
  const graphic = await deck.locator(".diagram-svg > svg").elementHandle()
  const button = control(deck, "Fullscreen")
  await button.click()
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.className))
    .toBe("diagram")
  await expect(control(deck, "Exit fullscreen")).toBeVisible()
  expect(await graphic?.evaluate((node) => node.isConnected)).toBe(true)
  await page.evaluate(() => document.exitFullscreen())
  await expect(control(deck, "Fullscreen")).toBeFocused()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("")
})

test("rejected fullscreen isolates the background, traps focus, and restores styles on Escape", async ({
  page,
  request,
}) => {
  await rejectFullscreen(page)
  await page.goto((await save(request, documentFixture())).url)
  const deck = page.locator('[data-block-id="first"]')
  await rendered(deck)
  const graphic = await deck.locator(".diagram-svg > svg").elementHandle()
  await page.evaluate(() => {
    document.body.style.setProperty("overflow", "scroll", "important")
    document.documentElement.style.overflow = "auto"
    const intro = document.querySelector<HTMLElement>('[data-block-id="intro"]')
    if (intro) intro.inert = true
  })
  await control(deck, "Fullscreen").click()
  const dialog = page.getByRole("dialog", { name: "Diagram for slide overview" })
  await expect(dialog).toHaveAttribute("aria-modal", "true")
  await expect(deck.locator(".diagram-viewport")).toBeFocused()
  expect(await graphic?.evaluate((node) => node.isConnected)).toBe(true)
  expect(
    await page.locator('[data-block-id="second"]').evaluate((node) => (node as HTMLElement).inert),
  ).toBe(true)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden")
  await control(deck, "Zoom out").focus()
  await page.keyboard.press("Shift+Tab")
  await expect(deck.locator(".diagram-viewport")).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(control(deck, "Zoom out")).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(control(deck, "Fullscreen")).toBeFocused()
  expect(await page.evaluate(() => document.body.style.getPropertyValue("overflow"))).toBe("scroll")
  expect(await page.evaluate(() => document.body.style.getPropertyPriority("overflow"))).toBe(
    "important",
  )
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("auto")
  expect(
    await page.locator('[data-block-id="intro"]').evaluate((node) => (node as HTMLElement).inert),
  ).toBe(true)
  expect(
    await page.locator('[data-block-id="second"]').evaluate((node) => (node as HTMLElement).inert),
  ).toBe(false)
})

test("unavailable fullscreen closes safely on source replacement and error recovery stays local", async ({
  page,
  request,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", { value: undefined })
  })
  const content = documentFixture()
  const fixture = await save(request, content)
  await page.goto(fixture.url)
  const deck = page.locator('[data-block-id="first"]')
  const other = page.locator('[data-block-id="second"]')
  await rendered(deck)
  await rendered(other)
  await control(deck, "Reset zoom").click()
  await control(deck, "Zoom in").click()
  await control(deck, "Fullscreen").click()
  await expect(page.getByRole("dialog")).toBeVisible()
  getDeck(content, "first").slides[0].mermaid = "flowchart LR\n A[unterminated"
  const broken = await save(request, content, fixture.stored)
  await expect(deck.getByRole("alert")).toContainText("Block first, slide overview")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(deck.locator("pre code")).toHaveCount(1)
  await expect(deck.locator("pre code")).toHaveText(getDeck(content, "first").slides[0].mermaid)
  await expect(control(deck, "Reset zoom")).toBeDisabled()
  await expect(control(deck, "Zoom in")).toBeDisabled()
  await control(deck, "Show source").click()
  await expect(deck.locator("pre code")).toHaveCount(1)
  await rendered(other)
  expect(await other.evaluate((node) => (node as HTMLElement).inert)).toBe(false)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("")
  getDeck(content, "first").slides[0].mermaid = 'flowchart LR\n Fresh["Fresh source"] --> Ready'
  await save(request, content, broken.stored)
  await rendered(deck)
  await expect(deck.locator(".diagram-svg > svg")).toContainText("Fresh source")
  await expect(control(deck, "Show source")).toBeVisible()
  await expect(control(deck, "Zoom in")).toBeEnabled()
  await expect(deck.locator("pre code")).toHaveCount(0)
  await expect(zoom(deck)).not.toHaveText("125%")
})

test("unmount closes the fallback without leaving scroll locks, inert siblings, or focus traps", async ({
  page,
  request,
}) => {
  await rejectFullscreen(page)
  const content = documentFixture()
  const fixture = await save(request, content)
  await page.goto(fixture.url)
  const deck = page.locator('[data-block-id="first"]')
  await rendered(deck)
  await control(deck, "Fullscreen").click()
  await expect(page.getByRole("dialog")).toBeVisible()
  content.blocks = content.blocks.filter((block) => block.id !== "first")
  await save(request, content, fixture.stored)
  await expect(deck).toHaveCount(0)
  await expect(page.getByRole("dialog")).toHaveCount(0)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("")
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("")
  const other = page.locator('[data-block-id="second"]')
  expect(await other.evaluate((node) => (node as HTMLElement).inert)).toBe(false)
  await other.focus()
  await expect(other).toBeFocused()
  await page.keyboard.press("ArrowRight")
  await rendered(other)
  await expect(other).toHaveAttribute("data-slide-id", "detail")
})

for (const outcome of ["resolve", "reject"] as const) {
  test(`a pending native fullscreen ${outcome} after unmount cannot reopen or retain fullscreen`, async ({
    page,
    request,
  }) => {
    await page.addInitScript(() => {
      let active: Element | null = null
      Object.defineProperty(document, "fullscreenElement", { get: () => active })
      Element.prototype.requestFullscreen = function () {
        return new Promise<void>((resolve, reject) => {
          Reflect.set(window, "settleSketchbookFullscreen", (outcome: string) => {
            if (outcome === "reject") reject(new Error("Late rejection"))
            else {
              active = this
              document.dispatchEvent(new Event("fullscreenchange"))
              resolve()
            }
          })
        })
      }
      document.exitFullscreen = async () => {
        active = null
        document.dispatchEvent(new Event("fullscreenchange"))
      }
    })
    const content = documentFixture()
    const fixture = await save(request, content)
    await page.goto(fixture.url)
    const deck = page.locator('[data-block-id="first"]')
    await rendered(deck)
    await control(deck, "Fullscreen").click()
    await expect(control(deck, "Fullscreen")).toBeDisabled()
    content.blocks = content.blocks.filter((block) => block.id !== "first")
    await save(request, content, fixture.stored)
    await expect(deck).toHaveCount(0)
    await page.evaluate(
      (outcome) => Reflect.get(window, "settleSketchbookFullscreen")(outcome),
      outcome,
    )
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true)
    await expect(page.getByRole("dialog")).toHaveCount(0)
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("")
    expect(
      await page
        .locator('[data-block-id="second"]')
        .evaluate((node) => (node as HTMLElement).inert),
    ).toBe(false)
  })
}
