import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { registerCanvasTools } from "./tools.js"

/** Loading only registers tools and cleanup. No listener, timer, or file is created. */
export default function canvasExtension(pi: ExtensionAPI): void {
  const close = registerCanvasTools(pi)
  pi.on("session_shutdown", async () => {
    // Pi also emits shutdown before reload, new, resume, and fork replacement.
    await close()
  })
}
