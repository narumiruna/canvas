import { Component, type ReactNode } from "react"
import ReactMarkdown, { defaultUrlTransform } from "react-markdown"
import rehypeKatex from "rehype-katex"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"

interface Props {
  markdown: string
  context: string
}

function rehypeSafeKatex({ context }: { context: string }) {
  const render = rehypeKatex({ trust: false, maxExpand: 1000, maxSize: 20, strict: "error" })
  return (...[tree, file]: Parameters<typeof render>) => {
    render(tree, file)
    // KaTeX can return colored fallback markup instead of a katex-error span.
    // Preserve every parser diagnostic independently of that markup shape.
    for (const message of file.messages) {
      if (message.source !== "rehype-katex") continue
      const place = message.place
      const start = place && "start" in place ? place.start.offset : undefined
      const end = place && "end" in place ? place.end.offset : undefined
      const source = String(file.value).slice(start ?? 0, end)
      tree.children.push({
        type: "element",
        tagName: "div",
        properties: { className: ["render-error"], role: "alert" },
        children: [
          {
            type: "element",
            tagName: "p",
            properties: {},
            children: [
              {
                type: "text",
                value: `${context}: Formula error: ${message.cause instanceof Error ? message.cause.message : message.reason}`,
              },
            ],
          },
          {
            type: "element",
            tagName: "pre",
            properties: {},
            children: [
              {
                type: "element",
                tagName: "code",
                properties: {},
                children: [{ type: "text", value: source }],
              },
            ],
          },
        ],
      })
    }
  }
}

function safeUrl(value: string) {
  const safe = defaultUrlTransform(value)
  if (/^(?:https?:|mailto:|#|\/|\.\.?\/)/i.test(safe)) return safe
  return safe.includes(":") ? "" : safe
}

class MarkdownBoundary extends Component<
  Props & { children: ReactNode },
  { error: string | null }
> {
  state: { error: string | null } = { error: null }

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) }
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="render-error">
          <p>
            {this.props.context}: Markdown or formula error: {this.state.error}
          </p>
          <pre>
            <code>{this.props.markdown}</code>
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

export function Markdown({ markdown, context }: Props) {
  return (
    <MarkdownBoundary key={markdown} markdown={markdown} context={context}>
      <div className="markdown">
        <ReactMarkdown
          skipHtml
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[[rehypeSafeKatex, { context }]]}
          urlTransform={safeUrl}
          components={{
            img: ({ alt }) => <span className="image-omitted">[Image omitted: {alt ?? ""}]</span>,
            a: ({ href, children }) => (
              <a href={href} rel="noopener noreferrer" referrerPolicy="no-referrer">
                {children}
              </a>
            ),
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </MarkdownBoundary>
  )
}
