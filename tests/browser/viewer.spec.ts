import { readdir, readFile, writeFile } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import { asset, documentFixture, getDeck, rendered, save } from "./helpers.js"

test("bundled Markdown, math, code, Chinese subgraphs, sanitized styles and native Rough.js paths coexist", async ({
  page,
  request,
}, testInfo) => {
  const fixture = await save(request, documentFixture())
  // Spy on the actual bundled Rough.js renderer without substituting its output.
  await page.route("**/assets/rough.esm-*.js", async (route) => {
    const response = await route.fetch()
    const script = await response.text()
    const wrapped = script.replace(
      /export\{(\w+) as (\w+)\};?\s*$/,
      (_match, rough, exported) => `
      const nativeSvg = ${rough}.svg;
      ${rough}.svg = (...args) => {
        const renderer = nativeSvg(...args);
        const draw = renderer.draw.bind(renderer);
        renderer.draw = (shape) => {
          window.canvasRoughCalls ??= [];
          window.canvasRoughCalls.push({
            shape: shape.shape,
            seed: shape.options.seed,
            roughness: shape.options.roughness,
          });
          return draw(shape);
        };
        return renderer;
      };
      export { ${rough} as ${exported} };
    `,
    )
    expect(wrapped).not.toBe(script)
    await route.fulfill({ response, body: wrapped })
  })
  const requests: string[] = []
  const referrers: string[] = []
  page.on("request", (request) => {
    requests.push(request.url())
    const referrer = request.headers().referer
    if (referrer) referrers.push(referrer)
  })
  await page.goto(fixture.url)
  await expect(page.getByRole("heading", { name: "Browser fixture", exact: true })).toBeVisible()
  await expect(page.locator(".katex-display")).toHaveCount(1)
  await expect(page.locator(".katex").first()).toBeVisible()
  await expect(page.locator("pre code").first()).toHaveText("const safe = true;\n")
  await expect(page.getByRole("table")).toBeVisible()
  await expect(page.getByRole("link", { name: "Safe link" })).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  )
  const first = page.locator('[data-block-id="first"]')
  const second = page.locator('[data-block-id="second"]')
  await rendered(first)
  await rendered(second)
  await expect(first.locator("svg")).toContainText("服務邊界")
  await expect(first.locator("svg")).toContainText(/deliberately\s*long label/)
  await expect(first.locator("svg .cluster")).toHaveCount(1)
  await expect(first.locator("svg style")).toHaveCount(1)
  expect(await first.locator("svg").getAttribute("viewBox")).toBeTruthy()
  expect(await first.locator("svg marker").count()).toBeGreaterThan(0)
  expect(await first.locator("svg .rough-node path").count()).toBeGreaterThan(2)
  const paths = await first
    .locator("svg .rough-node path")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("d")))
  expect(paths.some((path) => path && /C/.test(path) && path.length > 100)).toBeTruthy()
  const styling = await first
    .locator("svg .rough-node path")
    .evaluateAll((nodes) =>
      nodes.some((node) => getComputedStyle(node).fill === "rgb(221, 238, 239)"),
    )
  expect(styling).toBeTruthy()
  await expect(first.locator("svg foreignObject, svg image, svg script, svg a")).toHaveCount(0)

  // Trace the shipped Mermaid implementation, not only its visual appearance.
  const root = new URL("../../node_modules/mermaid/", import.meta.url)
  const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"))
  expect(pkg.version).toBe("12.3.0")
  const chunkDir = new URL("dist/chunks/mermaid.core/", root)
  const chunks = await readdir(chunkDir)
  const shapeChunks = await Promise.all(
    chunks
      .filter((name) => name.endsWith(".mjs"))
      .map((name) => readFile(new URL(name, chunkDir), "utf8")),
  )
  expect(
    shapeChunks.some(
      (chunk) =>
        /import rough\w* from "roughjs"/.test(chunk) &&
        /if \(node.look === "handDrawn"\) \{\s*const rc = rough\w*\.svg\(shapeSvg\)/.test(chunk),
    ),
  ).toBeTruthy()
  const calls = (await page.evaluate(() => Reflect.get(window, "canvasRoughCalls"))) as Array<{
    shape: string
    seed: number
    roughness: number
  }>
  expect(calls.some((call) => call.seed === 42 && call.roughness > 0)).toBeTruthy()
  expect(calls.some((call) => call.shape === "rectangle")).toBeTruthy()
  const evidence = testInfo.outputPath("rough-path-evidence.json")
  await writeFile(evidence, JSON.stringify({ version: pkg.version, calls, paths }))
  await testInfo.attach("rough-path-evidence", { path: evidence, contentType: "application/json" })
  expect(requests.every((url) => new URL(url).origin === new URL(fixture.url).origin)).toBeTruthy()
  const token = new URLSearchParams(new URL(fixture.url).hash.slice(1)).get("token")
  expect(token).toBeTruthy()
  expect(requests.every((url) => !url.includes(token ?? ""))).toBeTruthy()
  expect(referrers).toEqual([])
  await page.reload()
  await rendered(first)
  await expect(page.locator(".connection-status")).toHaveText("Connected")
})

test("repeat sources have distinct IDs and local marker references; fixed seed survives redraw", async ({
  page,
  request,
}) => {
  const fixture = await save(request, documentFixture())
  await page.goto(fixture.url)
  const first = page.locator('[data-block-id="first"]')
  const second = page.locator('[data-block-id="second"]')
  await rendered(first)
  await rendered(second)
  const geometry = () =>
    first
      .locator("svg .rough-node path")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("d")))
  const before = await geometry()
  const ids = await page
    .locator(".diagram-svg svg [id], .diagram-svg > svg")
    .evaluateAll((nodes) => nodes.map((node) => node.id))
  expect(ids.length).toBe(new Set(ids).size)
  const references = await page.locator(".diagram-svg svg").evaluateAll((svgs) =>
    svgs.every((svg) =>
      [...svg.querySelectorAll("[marker-end], [marker-start], [clip-path]")].every((node) =>
        ["marker-end", "marker-start", "clip-path"].every((attribute) => {
          const match = /url\([^#]*#([^)"']+)/.exec(node.getAttribute(attribute) ?? "")
          return (
            !match || [...svg.querySelectorAll("[id]")].some((target) => target.id === match[1])
          )
        }),
      ),
    ),
  )
  expect(references).toBeTruthy()
  await first.getByRole("button", { name: "Next slide" }).click()
  await rendered(first)
  await first.getByRole("button", { name: "Previous slide" }).click()
  await rendered(first)
  expect(await geometry()).toEqual(before)
})

test("decks switch independently with focused keyboard controls and preserve scroll", async ({
  page,
  request,
}) => {
  await page.goto((await save(request, documentFixture())).url)
  const first = page.locator('[data-block-id="first"]')
  const second = page.locator('[data-block-id="second"]')
  await rendered(first)
  await rendered(second)
  await page.keyboard.press("ArrowRight")
  await expect(first).toHaveAttribute("data-slide-id", "overview")
  await expect(second).toHaveAttribute("data-slide-id", "overview")
  await first.focus()
  const scroll = await page.evaluate(() => scrollY)
  await page.keyboard.press("ArrowRight")
  await rendered(first)
  await expect(first).toHaveAttribute("data-slide-id", "detail")
  await expect(first).toContainText("Explanation first detail.")
  await expect(second).toHaveAttribute("data-slide-id", "overview")
  expect(Math.abs((await page.evaluate(() => scrollY)) - scroll)).toBeLessThan(10)
  await first.getByRole("combobox").selectOption("end")
  await rendered(first)
  await expect(first.getByRole("button", { name: "Next slide" })).toBeDisabled()
  await second.focus()
  await page.keyboard.press("ArrowRight")
  await expect(second).toHaveAttribute("data-slide-id", "detail")
  await expect(first).toHaveAttribute("data-slide-id", "end")
  await second.getByRole("combobox").focus()
  await page.keyboard.press("ArrowLeft")
  await expect(first).toHaveAttribute("data-slide-id", "end")
})

for (const width of [390, 1280]) {
  test(`carousel arrows and dots navigate independently at ${width}px`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width, height: 960 })
    await page.goto((await save(request, documentFixture())).url)
    const first = page.locator('[data-block-id="first"]')
    const second = page.locator('[data-block-id="second"]')
    await rendered(first)
    const previous = first.getByRole("button", { name: "Previous slide" })
    const next = first.getByRole("button", { name: "Next slide" })
    const viewport = first.locator(".deck-viewport")
    const dots = first.locator(".slide-pagination")
    await expect(previous).toBeDisabled()
    await expect(next).toBeEnabled()
    await expect(first.locator(".deck-arrow-icon")).toHaveCount(2)
    await expect(dots.getByRole("button")).toHaveCount(3)
    await expect(dots.getByRole("button", { name: "Slide 1: Overview" })).toHaveAttribute(
      "aria-current",
      "step",
    )
    await expect(next).toHaveAttribute("aria-controls", (await viewport.getAttribute("id")) ?? "")
    const previousBox = await previous.boundingBox()
    const nextBox = await next.boundingBox()
    const viewportBox = await viewport.boundingBox()
    if (!previousBox || !nextBox || !viewportBox) throw new Error("Missing carousel layout")
    expect(previousBox.width).toBeGreaterThanOrEqual(44)
    expect(previousBox.height).toBeGreaterThanOrEqual(44)
    expect(nextBox.width).toBeGreaterThanOrEqual(44)
    expect(previousBox.x + previousBox.width).toBeLessThanOrEqual(viewportBox.x)
    expect(nextBox.x).toBeGreaterThanOrEqual(viewportBox.x + viewportBox.width)
    await next.click()
    await rendered(first)
    await expect(first).toHaveAttribute("data-slide-id", "detail")
    await expect(previous).toBeEnabled()
    await expect(dots.getByRole("button", { name: "Slide 2: Detail" })).toHaveAttribute(
      "aria-current",
      "step",
    )
    await expect(second).toHaveAttribute("data-slide-id", "overview")
    await dots.getByRole("button", { name: "Slide 3: End" }).click()
    await rendered(first)
    await expect(first).toHaveAttribute("data-slide-id", "end")
    await expect(next).toBeDisabled()
    await expect(dots.locator('[aria-current="step"]')).toHaveCount(1)
    await previous.click()
    await expect(first).toHaveAttribute("data-slide-id", "detail")
    await dots.getByRole("button", { name: "Slide 1: Overview" }).click()
    await expect(previous).toBeDisabled()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test("conditional polling keeps stable selection and chooses the nearest old slide after deletion", async ({
  page,
  request,
}) => {
  const document = documentFixture()
  let fixture = await save(request, document)
  const responses: number[] = []
  const conditional: string[] = []
  page.on("response", (response) => {
    if (response.url().includes("/api/documents/")) responses.push(response.status())
  })
  page.on("request", (request) => {
    const etag = request.headers()["if-none-match"]
    if (etag) conditional.push(etag)
  })
  await page.goto(fixture.url)
  const first = page.locator('[data-block-id="first"]')
  await rendered(first)
  await first.getByRole("combobox").selectOption("detail")
  const deck = getDeck(document, "first")
  deck.slides[1].explanationMarkdown = "Updated detail explanation."
  deck.slides = [deck.slides[2], deck.slides[0], deck.slides[1]]
  fixture = await save(request, document, fixture.stored)
  await expect(first).toContainText("Updated detail explanation.")
  await expect(first).toHaveAttribute("data-slide-id", "detail")
  await expect.poll(() => responses.includes(304)).toBeTruthy()
  expect(conditional.length).toBeGreaterThan(0)
  deck.slides = deck.slides.filter((slide) => slide.id !== "detail")
  await save(request, document, fixture.stored)
  // In the last stored order, overview is the closest surviving old neighbor.
  await expect(first).toHaveAttribute("data-slide-id", "overview")
  await expect(page.locator('[data-block-id="second"]')).toHaveAttribute(
    "data-slide-id",
    "overview",
  )
})

test("hidden polling pauses, resumes, and disconnection preserves last content", async ({
  page,
  request,
}) => {
  await page.goto((await save(request, documentFixture())).url)
  await rendered(page.locator('[data-block-id="first"]'))
  let requests = 0
  page.on("request", (request) => {
    if (request.url().includes("/api/documents/")) requests++
  })
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  const count = requests
  await page.waitForTimeout(2200)
  expect(requests).toBe(count)
  await page.route("**/api/documents/**", (route) => route.abort("connectionrefused"))
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await expect(page.locator(".connection-status")).toContainText("Connection lost")
  await expect(page.getByRole("heading", { name: "Browser fixture", exact: true })).toBeVisible()
  await rendered(page.locator('[data-block-id="first"]'))
  await page.unroute("**/api/documents/**")
  await expect(page.locator(".connection-status")).toHaveText("Connected")
})

test("rapid switching and revision updates cannot commit stale Mermaid output", async ({
  page,
  request,
}) => {
  const document = documentFixture()
  const deck = getDeck(document, "first")
  deck.slides[1].mermaid = `flowchart LR\n${Array.from({ length: 65 }, (_, i) => `N${i}["Slow ${i}"] --> N${i + 1}`).join("\n")}`
  let fixture = await save(request, document)
  // Keep an old render pending while user events and revisions arrive.
  await page.route("**/assets/flowDiagram-*.js", async (route) => {
    const response = await route.fetch()
    const script = await response.text()
    const wrapped = script.replace(
      /export\{(\w+) as diagram\}from"([^"]+)";/,
      (_match, symbol, module) => `
      import { ${symbol} as testDiagram } from "${module}";
      const originalDraw = testDiagram.renderer.draw;
      testDiagram.renderer.draw = async (...args) => {
        if (args[0].includes("Slow")) await new Promise((accept) => setTimeout(accept, 300));
        return originalDraw(...args);
      };
      export { testDiagram as diagram };
    `,
    )
    expect(wrapped).not.toBe(script)
    await route.fulfill({ response, body: wrapped })
  })
  await page.goto(fixture.url)
  const first = page.locator('[data-block-id="first"]')
  await rendered(first)
  const start = Date.now()
  await first.getByRole("combobox").selectOption("detail")
  await first.getByRole("combobox").selectOption("overview")
  await first.getByRole("combobox").selectOption("end")
  deck.slides[2].mermaid = 'flowchart LR\n Latest["Latest revision"] --> Z["Final result"]'
  deck.slides[2].explanationMarkdown = "Latest explanation."
  fixture = await save(request, document, fixture.stored)
  await expect(first).toContainText("Latest explanation.")
  await expect(first.locator("svg")).toContainText("Latest revision")
  await rendered(first)
  await expect(first.locator("svg")).not.toContainText("Slow")
  await page.waitForTimeout(400)
  await expect(first.locator("svg")).toContainText("Latest revision")
  test
    .info()
    .annotations.push({ type: "render-duration-ms", description: String(Date.now() - start) })
})

test("a representative 65-edge flowchart completes with recorded rendering time", async ({
  page,
  request,
}, testInfo) => {
  const document = documentFixture()
  const deck = getDeck(document, "first")
  deck.slides[1].mermaid = `flowchart TD\n${Array.from({ length: 65 }, (_, i) => `N${i}["Step ${i}"] --> N${i + 1}`).join("\n")}`
  const fixture = await save(request, document)
  await page.goto(fixture.url)
  const first = page.locator('[data-block-id="first"]')
  await rendered(first)
  const start = Date.now()
  await first.getByRole("combobox").selectOption("detail")
  await rendered(first)
  await expect(first.locator("svg .rough-node")).toHaveCount(66)
  await expect(first.getByRole("alert")).toHaveCount(0)
  const durationMs = Date.now() - start
  testInfo.annotations.push({ type: "large-flowchart-render-ms", description: String(durationMs) })
  const evidence = testInfo.outputPath("large-flowchart-timing.json")
  await writeFile(
    evidence,
    JSON.stringify({
      nodes: 66,
      edges: 65,
      durationMs,
      sourceBytes: Buffer.byteLength(deck.slides[1].mermaid),
    }),
  )
  await testInfo.attach("large-flowchart-timing", {
    path: evidence,
    contentType: "application/json",
  })
})

for (const name of ["architecture-walkthrough", "process-walkthrough"]) {
  test(`bundled ${name} renders every slide at a narrow viewport`, async ({
    page,
    request,
  }, testInfo) => {
    const document = await asset(request, name)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto((await save(request, document)).url)
    for (const block of document.blocks) {
      if (block.type !== "diagram-deck") continue
      const deck = page.locator(`[data-block-id="${block.id}"]`)
      if (block.slides.length === 1) {
        await expect(deck.getByRole("navigation")).toHaveCount(0)
        await expect(deck.locator(".deck-arrow, .slide-pagination")).toHaveCount(0)
      }
      for (const slide of block.slides) {
        if (block.slides.length > 1) await deck.getByRole("combobox").selectOption(slide.id)
        await rendered(deck)
        await expect(deck.getByRole("heading", { name: slide.title, exact: true })).toBeVisible()
        await expect(deck.getByRole("alert")).toHaveCount(0)
        expect(await deck.locator("svg .rough-node path").count()).toBeGreaterThan(0)
        const textScale = await deck
          .locator("svg text")
          .first()
          .evaluate((node) => {
            const matrix = (node as SVGTextElement).getScreenCTM()
            return Number.parseFloat(getComputedStyle(node).fontSize) * Math.abs(matrix?.a ?? 0)
          })
        expect(textScale).toBeGreaterThanOrEqual(12)
      }
    }
    expect(
      await page.evaluate(() => window.document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy()
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true })
  })
}
