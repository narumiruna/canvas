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
| Skill resources                 | Automated          | Frontmatter, relative local links, strict schema fixtures, allowlist, and stable walkthrough structure pass all 15 tests in `tests/skill.test.ts`.  |
| Built local and tarball loading | Automated          | `npm run test:package` loads actual local and extracted npm-tarball resources and viewer assets without external browser requests.                  |
| Human visual acceptance         | Unverified         | Text size, hand-drawn style, responsive layout, and explanation clarity require user review.                                                        |
| Remote access                   | Unverified         | SSH forwarding, containers, and WSLg/Windows browser routing need environment-specific checks.                                                      |
| Real-model tool use             | Unverified         | No API calls or model-cost tests were performed; automatic skill selection is not established.                                                      |

## Completed checks

Local verification produced these results:

- `npm run ci` passed on Node.js `22.19.0` and `26.8.2`, including formatting/lint checks, 93 of 93 Vitest tests across five files, and production builds.
- `npx vitest run tests/skill.test.ts` passed 15 of 15 tests independently on Node.js `26.8.2`.
- `npm run test:browser` passed 16 of 16 Chromium tests on both Node.js `22.19.0` and `26.8.2`.
- Carousel checks cover 44-pixel side arrows, clickable position dots, boundary states, independent decks, and hidden single-slide controls at desktop and narrow widths.
- `npm run test:package` passed actual host/resource discovery and isolated installation checks on Node.js `22.19.0` and `26.8.2` in `scripts/package-smoke.ts`.
  - `DefaultResourceLoader` discovers the bundled skill.
  - `session.followUp('/skill:canvas-explain-diagrams ...')` expands the skill without a model call.
  - Real Pi tool-schema validation and write/read/open execution succeed.
  - Chromium loads built local and extracted-tarball assets without external requests.
  - Session shutdown closes the viewer listener.
- `npm audit` reported zero vulnerabilities after the KaTeX override.

`npm pack --ignore-scripts --dry-run --json` confirmed the extension, viewer, fonts, third-party licenses, skill, and retained documentation are included, without source tests, workspace documents, or host implementation copies.
A fresh `npm ci --ignore-scripts` also completed successfully.
No registry publication or release operation is part of these checks.

## Fixture coverage

[Architecture walkthrough](../skills/canvas-explain-diagrams/assets/architecture-walkthrough.json) provides overview, API, and storage slides with stable component IDs and labels.
It includes subgraphs, Chinese text, a long label, and an independent one-slide deck.
[Process walkthrough](../skills/canvas-explain-diagrams/assets/process-walkthrough.json) provides overview, start, processing, and end slides plus an independent conflict deck.
Both include Markdown prose, inline/display LaTeX, and fenced TypeScript.
All nine bundled slides are covered by browser rendering checks.
The skill test validates data and policy, not Mermaid parsing or visual quality.

## Rendering source trace

Source inspection found this path in the installed Mermaid 12.3.0 distribution:

1. `src/web/diagram.tsx` sets `look: "handDrawn"`, `handDrawnSeed: 42`, `securityLevel: "strict"`, and `htmlLabels: false`.
2. `node_modules/mermaid/dist/chunks/mermaid.core/chunk-AXFCVDMN.mjs:4315` defines `squareRect`, which calls `drawRect`.
3. The same chunk at lines 1864–1883 imports `rough17` from `roughjs` and calls `rough17.svg(shapeSvg)` and `rc.rectangle(...)` in the `node.look === "handDrawn"` branch.
4. `node_modules/roughjs/package.json` identifies Rough.js 4.6.6.

`src/web/diagram.tsx` uses DOMPurify's SVG profile, removes active/external elements and link attributes, and retains only local fragment CSS URLs.
`tests/browser/viewer.spec.ts` observes calls to the actual bundled Rough.js renderer while preserving its output, and checks real paths, styles, markers, fixed-seed redraws, and isolated SVG IDs.
The browser suite also checks native-size label readability at a 390-pixel viewport and rejects quoted or escaped image metadata before Mermaid can request resources.
Server and browser use the same source policy in `src/mermaid-policy.ts`.
Other Mermaid diagram types remain outside the allowlist even if the dependency can parse them.

A representative 66-node, 65-edge flowchart completed in 425 ms in one local Node.js 22.19.0/Chromium run.
This is a single observation, not a performance guarantee or CPU-isolation claim.
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
