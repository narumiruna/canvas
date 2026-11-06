export const MAX_MERMAID_BYTES = 32 * 1024

/** Shared by storage and browser before Mermaid can parse or load resources. */
export function assertMermaidPolicy(source: string): void {
  if (new TextEncoder().encode(source).byteLength > MAX_MERMAID_BYTES) {
    throw new Error(`Mermaid source exceeds ${MAX_MERMAID_BYTES} bytes`)
  }
  if (/^\s*---|%%\s*\{/m.test(source)) {
    throw new Error(
      "Mermaid configuration is not permitted: frontmatter and directives are not supported",
    )
  }
  const definition = source
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("%%"))
    .join("\n")
    .trimStart()
  if (!/^flowchart\b/.test(definition)) {
    throw new Error("Only flowchart diagrams support the tested hand-drawn renderer")
  }
  // Metadata is YAML: quoted and escaped keys can select image/icon renderers.
  // Reject the whole optional syntax instead of trying to recognize those keys.
  if (/@\s*\{/.test(source) || /!\s*\[/.test(source)) {
    throw new Error("Mermaid node metadata and image labels are not supported")
  }
  if (
    /(?:^|[;\n])\s*click\b/i.test(source) ||
    /<\/?[a-z!][^>]*>/i.test(source) ||
    /\b(?:https?|data|javascript|file|ftp):/i.test(source) ||
    /\burl\s*\(|@import\b/i.test(source) ||
    /\b(?:image|icon|img|href)\s*:/i.test(source) ||
    /\b(?:fa|fab|fas|iconify):/i.test(source)
  ) {
    throw new Error("HTML, click actions, external resources, images and icons are not supported")
  }
}
