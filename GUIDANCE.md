# GooM toolbar guide and community totals

The ? panel keeps its keyboard shortcuts and has one Play row above them. The guide covers 16 steps: each upper control, search, building section, import and saving. No placement/rotation/device-menu lessons are included. Spotlight geometry uses the actual target in SVG screen coordinates; hidden search is exposed only during its blocked tutorial step and restored afterwards. The tour restores project data and previously open dialogs.

Save / Export shows format buttons and a compact, seven-part readiness line with small dots. Completed dots are lime; details are available as accessible labels/tooltips. The score indicates documentation completeness.

The homepage shows a short six-part feature timeline instead of a manual. The former /guide/ URL redirects to /#workflow. Public counters come from goomPublicStats: the sum of existing activeSeconds across all users and the sum of new-project events since 20 November 2026. Old local project creation history was never collected and is not invented.

Only the two actual new-project confirmation handlers enqueue goomProjectCreated. Import, reopening, reloading and the guide never do. Pending IDs are isolated by user and product and retried with the same operation ID. A verified, profiled account is required; the backend deduplicates IDs in a transaction. Counter documents remain private under the existing deny-by-default rules. Public statistics return only aggregate totals, cache for one minute and show a dash when unavailable.

Backend deployment: firebase deploy --only functions:project-cloud:goomProjectCreated,functions:project-cloud:goomPublicStats --project pztsepscctv --non-interactive


## Maps and community gauges — 21 November 2026

The welcome screen uses the same lime as the PZTS launch button and no longer offers the guide. The ? menu still launches the toolbar guide. The site timeline has a dark background with contrasting text.

The map picker has one overhead imagery view, a wider viewport, right-side geolocation and a bottom-right add button. Its A4 frame matches the imported 1684×1191 working image and 3508×2480 detailed source. Czech tiles use ČÚZK orthophotos with World Imagery fallback; other locations use World Imagery. Zoom is bounded to avoid extreme enlargement of coarse parent tiles. Existing projects and their stored backgrounds remain supported.

Building polygons come from the building layer of public OpenFreeMap / OpenMapTiles vector tiles. A bounded, local MVT decoder reads only polygons; there are at most four parallel requests and sixteen tiles per import. Geometry is clipped to the capture, sanitized, stored with the project, and drawn as closed straight anthracite paths in light mode and vector export. If geometry is unavailable, photographic edge processing remains available. Source credits are plain links and metadata, with no information badge.

Community totals remain real server aggregates. Hours are on the left with a lime arc; projects on the right with a pale-blue arc. Both fill from bottom to top toward round milestones shown in their accessible values and tooltips. Visible readiness captions and heading are removed; each dot keeps its tooltip and accessible label. Dialog close buttons use no outline frame.
