# PeakRush frontend implementation
Stack: Vue 3, TypeScript, Vite, Vue Router, Element Plus and Element Plus icons. Native Chinese font fallbacks; no external font/CDN runtime dependency.

## Run
Use the workspace app-start.ps1 for coordinated local startup. For standalone frontend work:
- npm ci
- npm run dev (127.0.0.1:5400; /api and /actuator proxy to gateway port 8080)
- npm run build
- npm test

## Implemented routes
- /: welcome homepage, with a PeakRush entry in the header.
- /signin and /signup: real PeakRush login/registration. A successful submission shares the bearer session with the business entry and returns to a validated /app/ destination.
- /app/: selected orange storefront. Default current activity + upcoming activity rows (up to six unique products); tab selection filters a session; real remaining stock and countdown.
- /app/activities/:id: activity detail and product purchase.
- /app/orders: owned list/filter/detail, actual mock-payment endpoint, cancellation and expiry states.
- /app/admin: product CRUD, activity draft edit/create, warmup/activation/offline, actual metrics, V0–V3 experiment configuration/results import/export/comparison (historical V4 remains visible), DLQ retry/abort, lab fault controls.

The welcome and business entries use separate HTML documents and styles. Ordinary anchors cross between them; Vue Router handles navigation within each entry. Business login links retain pathname, query and fragment, and expired sessions return through /signin. The business header's 返回首页 link returns to /. Direct business URLs and refreshes use the MPA fallback in both Vite dev and preview. This project targets desktop browsers.

## Purchase correctness
Every attempt persists user/activity/item-scoped Idempotency-Key, quantity, issued path and returned requestId before awaiting a potentially ambiguous response. Unknown-result retries reuse the old path and key, allowing backend idempotency lookup even after activity/path expiry. Known PENDING resumes polling. A 120-second polling window never changes PENDING to FAILED. Closing a dialog, changing activity or changing account invalidates UI response generations. No successful purchase/order/metric is fabricated.

## Service contract
docs/API_CONTRACT.md is the authority. Admin experiment detail is read from /export (list payload does not contain results); comparison reads actual verification_load.py http.qps/http.p95Ms/orders.orderTps/serverOrNetworkErrorRatio. Missing data is —/未采集. Fault delays are constrained to backend maximum 30000 ms.

## Verification
- npm install succeeded.
- vue-tsc --noEmit + vite build passed after implementation and response-race fixes.
- Transport unit tests cover stable idempotency headers, ambiguous network errors, malformed success responses, business rejection, auth expiry and service failure.
- Visual/UI integration: selected-design QA passed for the documented V3 main flows. Root verified purchase/PENDING/payment/cancel, order filtering, 390 px layout, activity creation, metrics/experiment data, keyboard focus and empty console errors/warnings. Untested fault/edge UI coverage is listed in root design-qa.md. Subagent CUA cannot see the main-thread IAB; root is handling browser evidence. See root design-qa.md. HTTP/build results are not treated as rendered visual verification.

## Current delivery scope
User narrowed this release to V0–V3. New activities and experiments default to V3. V4 is labeled 后续开发 and disabled as a new selection; historical records and existing recovery code are retained.
