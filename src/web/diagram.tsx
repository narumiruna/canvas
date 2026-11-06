import DOMPurify from "dompurify"
import mermaid from "mermaid"
import { useEffect, useRef, useState } from "react"
import { assertMermaidPolicy } from "../mermaid-policy.js"

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  look: "handDrawn",
  handDrawnSeed: 42,
  theme: "default",
  fontFamily: "system-ui, sans-serif",
  htmlLabels: false,
  flowchart: { htmlLabels: false },
  suppressErrorRendering: true,
})

// Mermaid has shared mutable state. Serialize all renders, including those from
// different decks. Failed renders must not stop the queue.
let queue: Promise<unknown> = Promise.resolve()
let nextId = 0

function sanitizeSvg(svg: string) {
  const clean = DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["foreignObject", "image", "a", "script"],
    FORBID_ATTR: ["href", "xlink:href"],
  })
  const parsed = new DOMParser().parseFromString(clean, "image/svg+xml")
  if (parsed.documentElement.localName !== "svg") throw new Error("Invalid sanitized diagram SVG")
  // DOMPurify does not sanitize CSS. Only local fragment URLs are needed for
  // Mermaid markers and clip paths. Drop imports and every other CSS URL.
  const localCss = (css: string) =>
    css
      .replace(/@import[^;{}]*(?:;|$)/gi, "")
      .replace(
        /url\s*\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi,
        (
          _match,
          double: string | undefined,
          single: string | undefined,
          bare: string | undefined,
        ) => {
          const value = (double ?? single ?? bare ?? "").trim()
          return /^#[\w:.-]+$/.test(value) ? `url(${value})` : "none"
        },
      )
  for (const style of parsed.querySelectorAll("style")) {
    style.textContent = localCss(style.textContent ?? "")
  }
  for (const node of parsed.querySelectorAll("*")) {
    for (const attribute of [...node.attributes]) {
      if (/url\s*\(/i.test(attribute.value) || attribute.name === "style") {
        node.setAttribute(attribute.name, localCss(attribute.value))
      }
    }
  }
  return new XMLSerializer().serializeToString(parsed.documentElement)
}

interface Props {
  source: string
  blockId: string
  slideId: string
}

type Result = { source: string; svg: string } | { source: string; error: string }

export function Diagram({ source, blockId, slideId }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const generation = useRef(0)
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    const current = ++generation.current
    const id = `canvas-diagram-${++nextId}`
    let cancelled = false
    const render = async () => {
      if (cancelled) return
      try {
        // Defense in depth: never let a document override the rendering policy.
        assertMermaidPolicy(source)
        const rendered = await mermaid.render(id, source)
        const svg = sanitizeSvg(rendered.svg)
        if (!cancelled && generation.current === current) setResult({ source, svg })
      } catch (error) {
        if (!cancelled && generation.current === current) {
          setResult({ source, error: error instanceof Error ? error.message : String(error) })
        }
      }
    }
    queue = queue.then(render, render)
    return () => {
      cancelled = true
      generation.current++
    }
  }, [source])

  useEffect(() => {
    const element = host.current
    if (!element) return
    // Only sanitized SVG reaches this DOM boundary.
    if (result?.source === source && "svg" in result) {
      element.innerHTML = result.svg
      const svg = element.querySelector("svg")
      const width = svg?.viewBox.baseVal.width
      // Keep graph text at its native size. Narrow screens scroll the diagram
      // instead of shrinking a wide architecture into unreadable labels.
      if (svg && width && Number.isFinite(width)) svg.style.minWidth = `${Math.max(256, width)}px`
    } else element.replaceChildren()
  }, [result, source])

  const active = result?.source === source ? result : null
  return (
    <section className="diagram" aria-label={`Diagram for slide ${slideId}`} aria-busy={!active}>
      <div ref={host} className="diagram-svg" />
      {!active && <p role="status">Rendering diagram…</p>}
      {active && "error" in active && (
        <div role="alert" className="render-error">
          <p>
            Block {blockId}, slide {slideId}: {active.error}
          </p>
          <pre>
            <code>{source}</code>
          </pre>
        </div>
      )}
    </section>
  )
}
