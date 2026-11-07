# Compatibility evidence

## Evidence labels

- **Declared** identifies the support contract or a pinned dependency, not a passed test.
- **Source** identifies an inspected implementation or dependency path.
- **Automated** identifies a completed check and its observed result.
- **Unverified** identifies a check that has not been completed.

Source inspection and automated tests do not establish human visual acceptance or model behavior.

## Support matrix

| Area                            | Status             | Evidence or remaining check                                                                                                                         |
| ------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js                         | Automated          | Minimum `>=22.19.0` in `package.json`; CI, build, and local/tarball smoke tests pass on `22.19.0` and `26.8.2`.                                     |
| Pi host                         | Automated          | Pi `1.5.0` and TypeBox `1.3.27`; actual `DefaultResourceLoader` discovery, skill-command expansion, and tool execution pass the package smoke test. |
| Mermaid                         | Automated          | Version `12.3.0`; flowcharts, subgraphs, Chinese text, long labels, and every bundled example slide pass the Chromium suite.                        |
| Hand-drawn output               | Source + Automated | Rough.js `4.6.6`; source trace below plus real rough paths, fixed-seed redraws, markers, styles, and isolated SVG IDs checked in Chromium.          |
| KaTeX                           | Automated          | Version `0.19.1` with nested copies overridden; browser math/security checks pass and `npm audit` reports zero vulnerabilities.                     |
| Skill resources                 | Automated          | Frontmatter, relative local links, strict schema fixtures, allowlist, and connected walkthrough checks pass `tests/skill.test.ts`.                  |
| Built local and tarball loading | Automated          | `npm run test:package` loads actual local and extracted npm-tarball resources and viewer assets without external browser requests.                  |
| Human visual acceptance         | Unverified         | Text size, hand-drawn style, responsive layout, and explanation clarity require user review.                                                        |
| Trusted LAN IPv4                | Source + Automated | Tests and same-host private-interface Chromium smoke pass on macOS; physical second-device access remains unverified.                               |
| Remote access                   | Unverified         | SSH forwarding, containers, and WSLg/Windows browser routing need environment-specific checks.                                                      |
| Real-model tool use             | Unverified         | No API calls or model-cost tests were performed; automatic skill selection is not established.                                                      |

## Completed checks

Earlier baseline verification produced these results:

- `npm run ci` passed on Node.js `22.19.0` and `26.8.2`, including formatting/lint checks, 115 of 115 Vitest tests across six files, and production builds.
- `npx vitest run tests/skill.test.ts` passed 15 of 15 tests independently on Node.js `26.8.2`.
- `npm run test:browser` passed 26 of 26 Chromium tests on both Node.js `22.19.0` and `26.8.2`.
- Compact-frame checks cover a single current-slide title, a bounded viewport, 44-pixel toolbar controls, bottom arrows, labelled position dots, independent selection, and hidden single-slide navigation.
- Camera checks cover initial Fit without upscaling, native-size Reset, zoom bounds, modified-wheel zoom, ordinary document scrolling, pointer capture, resize modes, source view, and listener/observer cleanup.
- Fullscreen checks exercise the native browser API and rejected/unavailable-API fallback, focus restoration, inert/scroll restoration, source changes, unmount, and late native-request completion.
- `npm run test:package` passed actual host/resource discovery and isolated installation checks on Node.js `22.19.0` and `26.8.2` in `scripts/package-smoke.ts`.
  - `DefaultResourceLoader` discovers the bundled skill.
  - `session.followUp(...)` expands a queued skill command without a model call.
  - Real Pi tool-schema validation and write/read/open execution succeed.
  - Chromium loads built local and extracted-tarball assets without external requests.
  - Session shutdown closes the viewer listener.
- `npm audit` reported zero vulnerabilities after the KaTeX override.

`npm pack --ignore-scripts --dry-run --json` confirmed the extension, viewer, fonts, third-party licenses, skill, and retained documentation are included, without source tests, workspace documents, or host implementation copies.
A fresh `npm ci --ignore-scripts` also completed successfully.
No registry publication or release operation is part of these checks.

### Connected-slide update

Verification on Node.js `26.8.2` on 2026-11-07 produced these results:

- `npm test -- tests/skill.test.ts` passed 26 of 26 tests, including duplicate-overview and broken-connection mutations.
- `npm run ci` passed formatting/lint, TypeScript checks, 126 of 126 Vitest tests across six files, and production builds.
- The focused bundled-slide browser checks passed 2 of 2 tests; `npm run test:browser` passed all 26 Chromium tests.
- `npm pack --dry-run` and `npm run test:package` passed, including local and tarball skill loading, viewer assets, and shutdown.

The update changes explanations and authoring rules, not diagram sources, stable IDs, runtime code, or the document schema.
Fixture-specific assertions check expected components, handoff steps, labels, and recovery paths; they do not validate the meaning of arbitrary decks.
Reader comprehension and real-model behavior remain unverified; see the deck continuity review in [acceptance](acceptance.md).

### Sketchbook rename

Verification on Node.js `26.8.2` on 2026-11-07 produced these results:

- `npm run ci` passed formatting/lint, TypeScript checks, all 126 Vitest tests, and production builds.
- `npm run test:browser` passed all 26 Chromium tests, including the Pi Sketchbook header and page title.
- `npm pack --dry-run` produced the expected `pi-sketchbook` package manifest and renamed skill paths.
- `npm run test:package` passed local and extracted-tarball loading, renamed skill-command expansion, all three `sketchbook_*` tools, `.pi/sketchbook/` storage, viewer branding, and shutdown.

The rename keeps document schema version 1 and does not move existing workspace documents automatically.
Node.js `22.19.0` was not rerun for this rename; its results above are earlier baseline evidence.
GitHub repository renaming, npm name ownership, publication, and human acceptance remain external checks in [acceptance](acceptance.md).

### Article structure and readability

Verification on macOS with Node.js `26.11.1`, Pi `1.5.0`, and Playwright `1.65.0` on 2026-11-07 produced these results:

- `npm run ci` passed formatting, TypeScript checks, 142 of 142 unit tests across seven files, and production builds.
- `npm run test:browser` passed 37 of 37 Chromium tests, including every slide in three complete articles at 390px and 1440px.
- `npm pack --dry-run` and `npm run test:package` passed local and extracted-tarball discovery, tool execution, browser assets, and shutdown.
- `npm audit` reported zero vulnerabilities.
- Stable H2 deck chapters and H3 slide titles, legacy Markdown heading normalization, explanation heading scope, 16px explanation text, technical-name wrapping, and compact bounded frames passed regression checks.
- Existing camera, source-text, SVG sanitization, native/fallback fullscreen, and lifecycle checks remain passing.

The complete-article cases cover all nine bundled slides and all five slides in `tests/fixtures/agent-substrate.json` at both widths, for 28 slide/viewport checks.
They measure every SVG text label in the default fitted view, before Reset or Zoom.

| Article                    | Minimum label at 390px | Minimum label at 1440px |
| -------------------------- | ---------------------- | ----------------------- |
| Architecture example       | 12.62px                | 14.11px                 |
| Process example            | 12.37px                | 12.37px                 |
| Agent Substrate regression | 12.34px                | 12.88px                 |

`test-results/article-review-*/` contains per-slide captures, complete initial/final pages, heading outlines, and label/frame measurements.
The capture helper waits for fonts and paint frames and checks PNG pixels inside every diagram viewport, so a blank full-page frame cannot pass only because an SVG exists in the DOM.
An independent agent review inspected the bundled examples and code; the main agent inspected the Agent Substrate article and all five slides at both widths.
These checks do not establish human visual or comprehension acceptance.
Node.js 22.19.0 was not rerun locally for this update; the existing CI matrix provides a separate check.

On macOS, the existing exact-path tests require a physical temporary-directory path.
Run `export TMPDIR="$(cd "${TMPDIR:-/tmp}" && pwd -P)"` before the checks when TMPDIR contains the `/var` alias for `/private/var`.
The alias otherwise causes baseline path-equality failures; this update does not change storage path behavior.

### Automatic LAN viewer

Verification on macOS with Node.js `26.11.1` on 2026-11-08 produced these results:

- `npm run ci` passed formatting, TypeScript checks, 176 of 176 unit tests across seven files, and production builds.
- `npm run test:browser` passed all 37 Chromium tests with the automatic viewer URLs.
- `npm pack --dry-run` and `npm run test:package` passed local and extracted-tarball discovery, zero registered extension flags, automatic address selection, viewer assets, and shutdown.
- The 73 focused server/tool tests cover wildcard binding, all three private IPv4 ranges, excluded public/internal/IPv6 addresses, loopback URL fallback, duplicate interfaces, discovery failure, unchanged model inputs, token checks, and lifecycle cleanup.
  - Interface discovery is mocked for these unit cases so CI does not require a private address. The sockets still bind to wildcard IPv4.
  - Tests reject mismatched Origin values even when both the request Host and the other origin address are independently allowed.
- A separate smoke check used no host argument and automatically selected the host's real private IPv4 address with Chromium `158.0.8127.18` at 1440px and 390px.
  - `lsof` confirmed a wildcard IPv4 listener; both the detected private address and loopback served requests with their own matching Origin.
  - Bundled assets, Markdown, math, diagrams, slide navigation, authenticated 200/304 polling, and revision updates passed without external requests or page errors.
  - Missing/wrong/query-string tokens, wildcard/foreign Host values, mismatched Origin values, and write methods were denied.
  - Shutdown disconnected the browser and closed the listener while saved state and the last loaded browser content remained.
  - Ignored `test-results/auto-lan-smoke/` contains screenshots and a token-free report with built-source hashes.

The viewer now binds to `0.0.0.0` by default; no host configuration remains.
The returned URL uses the first detected non-internal private IPv4 address in operating-system interface order, or `127.0.0.1` if none is detected.
A loopback URL fallback does not restrict the wildcard listener to loopback.
Host validation is not client-IP filtering, and HTTP is unencrypted; use only trusted networks and operating-system firewall policy.
Physical second-device routing, firewall permissions, Wi-Fi isolation, VPN/virtual-interface selection, and human acceptance remain unverified.
The currently running Pi process needs `/reload` and a fresh `sketchbook_open` call to use the new built extension.
See the [LAN device handoff](acceptance.md#lan-device-handoff).
No firewall settings, router settings, publication, tags, or releases were changed.
The existing Vite chunk-size warning remains; this change does not alter the renderer bundle.

## Fixture coverage

[Architecture walkthrough](../skills/sketchbook-explain-diagrams/assets/architecture-walkthrough.json) provides overview, API, and storage slides with stable component IDs and short labels.
It includes subgraphs, Chinese text, and an independent one-slide deck.
[Process walkthrough](../skills/sketchbook-explain-diagrams/assets/process-walkthrough.json) provides overview, input, processing, and result slides plus an independent conflict deck.
Both include Markdown prose, inline/display LaTeX, fenced TypeScript, an opening H2, and a final conclusion.
All nine bundled slides are covered at narrow and desktop widths, alongside the source-linked Agent Substrate regression fixture.
Long-label and large-graph stress cases remain in separate browser fixtures.
The skill test protects known outline and continuity regressions, not arbitrary narrative quality.

## Rendering source trace

Source inspection found this path in the installed Mermaid 12.3.0 distribution:

1. `src/web/diagram.tsx` sets `look: "handDrawn"`, `handDrawnSeed: 42`, `securityLevel: "strict"`, and `htmlLabels: false`.
2. `node_modules/mermaid/dist/chunks/mermaid.core/chunk-AXFCVDMN.mjs:4315` defines `squareRect`, which calls `drawRect`.
3. The same chunk at lines 1864–1883 imports `rough17` from `roughjs` and calls `rough17.svg(shapeSvg)` and `rc.rectangle(...)` in the `node.look === "handDrawn"` branch.
4. `node_modules/roughjs/package.json` identifies Rough.js 4.6.6.

`src/web/diagram.tsx` uses DOMPurify's SVG profile, removes active/external elements and link attributes, and retains only local fragment CSS URLs.
`tests/browser/viewer.spec.ts` observes calls to the actual bundled Rough.js renderer while preserving its output, and checks real paths, styles, markers, fixed-seed redraws, and isolated SVG IDs.
The browser suite also checks native-size label readability after Reset at a 390-pixel viewport and rejects quoted or escaped image metadata before Mermaid can request resources.
Server and browser use the same source policy in `src/mermaid-policy.ts`.
Other Mermaid diagram types remain outside the allowlist even if the dependency can parse them.

A representative 66-node, 65-edge flowchart completed in 444 ms in one local Node.js 22.19.0/Chromium run.
This is a single observation, not a performance guarantee or CPU-isolation claim.
Initial Fit can reduce large-graph labels below readable size; Reset, zoom, and panning provide access to native-size content.
The frame does not rewrite Mermaid orientation or node content.
The browser tests save `rough-path-evidence.json`, `large-flowchart-timing.json`, and fixture screenshots under ignored `test-results/`; CI retains these as artifacts.
Vite reports large Mermaid chunks over 500 kB; lazy renderer chunks remain local, and bundle size is not a passed performance target.

## Reproduce

```sh
node --version
npm ci
npm run ci
npx playwright install chromium
npm run test:browser
npm pack --dry-run
npm run test:package
npm audit
```

Repeat these checks after dependency or rendering changes.
See [acceptance and external handoff](acceptance.md) for checks that automation does not complete.
