# Design QA — `/v2` Command Deck

## Evidence

- Selected visual source: `docs/new-dashboard/qa/command-deck-reference.png` (1487 × 1058 px).
- Production desktop capture: `docs/new-dashboard/qa/command-deck-desktop.png` (1440 × 1024 CSS px, DPR 1).
- Production mobile capture: `docs/new-dashboard/qa/command-deck-mobile.png` (390 × 844 CSS px, DPR 1).
- Full side-by-side comparison: `docs/new-dashboard/qa/command-deck-comparison.png`.
- Focused comparisons: `command-deck-comparison-header.png` and `command-deck-comparison-content.png` in the same directory.
- Additional mobile captures: channels, links, reports and subscribers in `docs/new-dashboard/qa/mobile-*.png`.
- Custom dropdown captures: `docs/new-dashboard/qa/custom-dropdown-desktop.png` and `docs/new-dashboard/qa/custom-dropdown-mobile.png`.
- Channel-status compatibility capture: `docs/new-dashboard/qa/channel-status-desktop.png`.
- Report-improvements captures: `docs/new-dashboard/qa/reports-improvements-desktop.png` and `docs/new-dashboard/qa/reports-improvements-mobile.png`.
- State: authenticated staging workspace with real API data, all-time period, all channels.
- Runtime: optimized Next.js production build in headless Chromium.

## Fidelity assessment

- The implementation preserves the selected direction's deep-cobalt command bar and hero, horizontal desktop navigation, integrated KPI strip, pale analytics canvas, modular white data surfaces, strong blue primary action and dense but readable dashboard hierarchy.
- Manrope is loaded locally and used throughout `/v2`; weights, numeric alignment, line height and compact labels remain readable at desktop and mobile sizes.
- The generated source's chart was not copied with fabricated values. The production overview uses the available backend data to show connected channels, attribution quality and recent real events in the same modular hierarchy.
- Phosphor is the single icon family across navigation, channels, activity and subscriber surfaces. No custom SVG or placeholder illustration is used.
- Desktop cards, dividers, shadows, radii and spacing were compared at the full frame and in focused header/content crops.
- Mobile uses a dedicated five-destination bottom navigation, stacked filters, two-column KPI cells with a full-width final metric, cards in place of dense tables, and no horizontal overflow.
- The reports flow now keeps the high-level KPI strip and adds progressive detail: source/link reach, creative performance, landing-post performance, unsubscribe timing and attribution quality. Creative and timing breakdowns become compact cards at mobile width.

## Functionality and accessibility

- Verified `/v2`, `/v2/channels`, `/v2/links`, `/v2/reports` and `/v2/subscribers` at 390 px width; every route reached the expected heading and reported zero horizontal overflow.
- Verified primary CTA, period controls, workspace/channel selector, desktop navigation and mobile navigation are present as semantic links, buttons or comboboxes.
- Replaced every native select in `/v2` with one accessible custom combobox. Verified pointer opening and selection, `ArrowDown` + `Enter` selection, `Escape` dismissal, outside-click dismissal, selected-state checkmark and zero horizontal overflow at 390 px.
- Focus-visible rings, semantic labels, reduced-motion handling, practical mobile tap areas and readable contrast are implemented.
- Browser console after the final production pass: no errors or uncaught exceptions.
- Compatibility guard verified: an older API response without `unknownSourceMonitor` no longer crashes the overview or reports page during a staggered deployment.
- Verified legacy channel payloads against Telegram live status: confirmed rights render as green `Працює`; an explicit missing-admin response remains yellow `Потребує уваги`.
- Verified the four report additions against authenticated staging data in the optimized production build: reach is visible per source and link; creative rows aggregate real link metrics; landing posts have an honest empty state; unsubscribe timing shows four mutually exclusive intervals.
- Verified the reports page at 390 px after adding the wider data columns: document and main widths remain exactly 390 px, every report card is 358 px wide, and only the two dense tables use contained horizontal scrolling.

## Iterations resolved

- P0: staging's older overview payload crashed while reading `unknownSourceMonitor.change`; added a safe compatibility fallback.
- P1: the fifth overview KPI left an empty sixth grid cell on mobile; made the final metric span both columns.
- P1: the full channel list pushed recent activity below the useful overview area; limited the overview preview to three channels while retaining the link to the complete section.
- P2: development tooling appeared in screenshots; repeated the final pass against the optimized production build.
- P2: native browser selects broke the Command Deck visual language; replaced them with a shared light/dark dropdown system and verified open states on desktop and mobile.
- P1: legacy `GET /api/channels` omitted `botCanInviteUsers`, which the UI treated as `false`; missing values now receive a live status check and are never converted into a fabricated warning.
- P1: adding reach columns gave report grid items a wider intrinsic size and clipped later mobile cards; made the shared card surface shrinkable so wide tables remain isolated inside their scroll containers.
- P2: the unsubscribe-timing endpoint may arrive after the web deployment; added a compatibility fallback based on the existing unsubscribe feed so staggered VPS deployments do not break the report.

No unresolved P0, P1 or P2 findings remain.

final result: passed
