import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { registerSketchbookTools } from "./tools.js"

/** Loading only registers tools and cleanup. No listener, timer, or file is created. */
export default function sketchbookExtension(pi: ExtensionAPI): void {
  const close = registerSketchbookTools(pi)
  pi.on("session_shutdown", async () => {
    // Pi also emits shutdown before reload, new, resume, and fork replacement.
    await close()
  })
}
