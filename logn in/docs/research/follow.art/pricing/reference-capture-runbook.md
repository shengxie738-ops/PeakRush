# Runbook — capturing the 4 new /pricing reference frames (needs the visible panel)

Prepared 2026-10-01, round 34. Execute in one continuous stretch; the panel window is the scarce
resource, and `take_screenshot` writes straight to disk via `filePath` so nothing round-trips the model.

1. Bring the Qoder in-app Browser (follow.art tab) to the foreground and keep it there.
2. Tear down the measurement iframe FIRST, so the top document has the surface to itself and so the
   user's tab is restored clean:
   `node scripts/emit-reference-probe.mjs --teardown`  → paste the printed one-liner into evaluate_script.
3. For each checkpoint: navigate the top tab to /pricing, drive `.scrollable__area` scrollTop, poll
   until it settles (~1.1s; Lenis does NOT revert a direct assignment on the reference — measured in
   round 28), then screenshot.

   | id   | scrollPx | filePath                                                                 |
   |------|----------|--------------------------------------------------------------------------|
   | V27  | 1150     | evidence/reference/captured/2026-10-01-b/V27-_pricing@inapp.png          |
   | V28  | 1544     | evidence/reference/captured/2026-10-01-b/V28-_pricing@inapp.png          |
   | V29  | 1927     | evidence/reference/captured/2026-10-01-b/V29-_pricing@inapp.png          |
   | V30  | 3511     | evidence/reference/captured/2026-10-01-b/V30-_pricing@inapp.png          |

   V30 is `4283 - 772`, the maximum reachable scroll. It is the only frame that can ever contain the
   promo footer.

4. Finalize immediately, before the window closes:
   `node scripts/finalize-capture-freeze.mjs evidence/reference/captured/2026-10-01-b inapp`
   Every field of the report is computed from the PNG bytes; run it the moment the last frame lands.
   A 4-frame freeze prints `4 records, 26 missing` and still exits 0 — that is the expected shape for
   an *incremental* freeze, because `compare-reference.mjs` aggregates every freeze folder and the
   newest frame per id+viewport wins. Do not "fix" the 26 and do not copy the old 26 PNGs forward.
5. The clone side (must be after the footer merge, because V27-V30 frame a document whose total height
   changes from 4869 to 4283):
   `ONLY=V27,V28,V29,V30 VIEWPORTS=inapp node scripts/capture-local.mjs`
   then `node scripts/compare-reference.mjs`.
6. Restore the user's tab to `/`.

Note: `compare-reference.mjs` iterates *reference* records, so clone frames with no reference
counterpart are skipped silently rather than reported — the new ids stay out of the mean until step 3
actually happens. Adding them to `design/checkpoints.json` alone does not create a gate.

While the panel is up, the other things it unlocks (in rough value order): the 12 remaining
checkpoints' D02-D10 continuous trajectories (GAP-005), the home WebGL frames V05/V06/V12/V13 at a
pinned phase, and a re-shoot of `/gift-card` V23.
