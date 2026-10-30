# Design QA — `/v2` Command Deck

## Evidence

- Selected visual source: `docs/new-dashboard/qa/command-deck-reference.png` (1487 × 1058 px).
- Production desktop capture: `docs/new-dashboard/qa/command-deck-desktop.png` (1440 × 1024 CSS px, DPR 1).
- Production mobile capture: `docs/new-dashboard/qa/command-deck-mobile.png` (390 × 844 CSS px, DPR 1).
- Full side-by-side comparison: `docs/new-dashboard/qa/command-deck-comparison.png`.
- Focused comparisons: `command-deck-comparison-header.png` and `command-deck-comparison-content.png` in the same directory.
- Additional mobile captures: channels, links, reports and subscribers in `docs/new-dashboard/qa/mobile-*.png`.
- State: authenticated staging workspace with real API data, all-time period, all channels.
- Runtime: optimized Next.js production build in headless Chromium.

## Fidelity assessment

- The implementation preserves the selected direction's deep-cobalt command bar and hero, horizontal desktop navigation, integrated KPI strip, pale analytics canvas, modular white data surfaces, strong blue primary action and dense but readable dashboard hierarchy.
- Manrope is loaded locally and used throughout `/v2`; weights, numeric alignment, line height and compact labels remain readable at desktop and mobile sizes.
- The generated source's chart was not copied with fabricated values. The production overview uses the available backend data to show connected channels, attribution quality and recent real events in the same modular hierarchy.
- Phosphor is the single icon family across navigation, channels, activity and subscriber surfaces. No custom SVG or placeholder illustration is used.
- Desktop cards, dividers, shadows, radii and spacing were compared at the full frame and in focused header/content crops.
- Mobile uses a dedicated five-destination bottom navigation, stacked filters, two-column KPI cells with a full-width final metric, cards in place of dense tables, and no horizontal overflow.

## Functionality and accessibility

- Verified `/v2`, `/v2/channels`, `/v2/links`, `/v2/reports` and `/v2/subscribers` at 390 px width; every route reached the expected heading and reported zero horizontal overflow.
- Verified primary CTA, period controls, workspace/channel selector, desktop navigation and mobile navigation are present as semantic links, buttons or selects.
- Focus-visible rings, semantic labels, reduced-motion handling, practical mobile tap areas and readable contrast are implemented.
- Browser console after the final production pass: no errors or uncaught exceptions.
- Compatibility guard verified: an older API response without `unknownSourceMonitor` no longer crashes the overview or reports page during a staggered deployment.

## Iterations resolved

- P0: staging's older overview payload crashed while reading `unknownSourceMonitor.change`; added a safe compatibility fallback.
- P1: the fifth overview KPI left an empty sixth grid cell on mobile; made the final metric span both columns.
- P1: the full channel list pushed recent activity below the useful overview area; limited the overview preview to three channels while retaining the link to the complete section.
- P2: development tooling appeared in screenshots; repeated the final pass against the optimized production build.

No unresolved P0, P1 or P2 findings remain.

final result: passed
