# GooM toolbar guide and community totals

The ? panel keeps its keyboard shortcuts and has one Play row above them. The guide covers 16 steps: each upper control, search, building section, import and saving. No placement/rotation/device-menu lessons are included. Spotlight geometry uses the actual target in SVG screen coordinates; hidden search is exposed only during its blocked tutorial step and restored afterwards. The tour restores project data and previously open dialogs.

Save / Export shows format buttons and a compact, seven-part readiness line with small dots. Completed dots are lime; details are available as accessible labels/tooltips. The score indicates documentation completeness.

The homepage shows a short six-part feature timeline instead of a manual. The former /guide/ URL redirects to /#workflow. Public counters come from goomPublicStats: the sum of existing activeSeconds across all users and the sum of new-project events since 20 November 2026. Old local project creation history was never collected and is not invented.

Only the two actual new-project confirmation handlers enqueue goomProjectCreated. Import, reopening, reloading and the guide never do. Pending IDs are isolated by user and product and retried with the same operation ID. A verified, profiled account is required; the backend deduplicates IDs in a transaction. Counter documents remain private under the existing deny-by-default rules. Public statistics return only aggregate totals, cache for one minute and show a dash when unavailable.

Backend deployment: firebase deploy --only functions:project-cloud:goomProjectCreated,functions:project-cloud:goomPublicStats --project pztsepscctv --non-interactive
