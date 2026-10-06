import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

/**
 * verify:release — the aggregate gate (plan §15.1, §17.0).
 * A missing check is a FAILURE, never a pass. Nothing here is allowed to fall back
 * to "looks fine": every row needs a command that ran and produced output.
 */
const results = [];
const run = (name, cmd) => {
  try {
    const out = execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 32e6 });
    results.push({ name, ok: true, detail: out.split('\n').filter(Boolean).slice(-3).join(' | ') });
  } catch (e) {
    const out = String(e.stdout ?? '') + String(e.stderr ?? '');
    results.push({ name, ok: false, detail: out.split('\n').filter(Boolean).slice(-6).join(' | ') || e.message });
  }
};

run('typecheck', 'npm run --silent typecheck');
run('lint', 'npm run --silent lint');
run('test:unit', 'npm run --silent test:unit');
run('test:e2e', 'npm run --silent test:e2e');
run('build', 'npm run --silent build');
run('verify:assets', 'node scripts/validate-assets.mjs');
run('verify:evidence', 'node scripts/validate-evidence.mjs');

const gates = [];
const cmp = (name, ok, detail) => gates.push({ name, ok, detail });

const refDir = 'evidence/reference/captured';
/**
 * Reference frames live in dated freeze folders as well as the legacy top-level report,
 * because they can only be taken while the in-app Browser panel is a visible surface.
 * Counting only the legacy file under-reported 28 real frames as 1.
 */
const refReports = [refDir + '/capture-report.json'];
if (existsSync(refDir)) {
  for (const ent of readdirSync(refDir, { withFileTypes: true })) {
    if (ent.isDirectory() && existsSync(`${refDir}/${ent.name}/capture-report.json`)) {
      refReports.push(`${refDir}/${ent.name}/capture-report.json`);
    }
  }
}
const refRecords = refReports.flatMap((p) => {
  try { return JSON.parse(readFileSync(p, 'utf8')).records ?? []; } catch { return []; }
});
const refStates = new Set(refRecords.map((r) => r.id)).size;
const refViewports = new Set(refRecords.map((r) => r.viewport)).size;
cmp(
  'frozen reference screenshots >= 24 states x 3 viewports',
  refStates >= 24 && refViewports >= 3,
  // The bar is deliberately NOT lowered: reference pixels are only obtainable at the
  // in-app viewport (1376x772@1.5), so states x viewports is 26 x 1, not 26 x 3.
  `captured ${refStates} states x ${refViewports} viewport(s) (${refRecords.length} frames) — need 24 x 3`,
);

const locReport = existsSync('evidence/local/capture-report.json') ? JSON.parse(readFileSync('evidence/local/capture-report.json', 'utf8')).records : [];
cmp('local capture covers every checkpoint', locReport.length >= JSON.parse(readFileSync('design/checkpoints.json', 'utf8')).length, `local ${locReport.length}`);

const cmpReport = existsSync('evidence/diffs/compare-report.json') ? JSON.parse(readFileSync('evidence/diffs/compare-report.json', 'utf8')) : null;
cmp('pixel comparison has run against the frozen reference', !!cmpReport && cmpReport.rows.some((r) => typeof r.diffRatio === 'number'), cmpReport ? `${cmpReport.rows.filter((r) => r.pass).length}/${cmpReport.rows.length} within 5%` : 'no compare-report.json');

const motionDir = 'evidence/motion';
/**
 * This gate used to be `/D10/.test(readFileSync('progress.md'))` — i.e. it could be
 * satisfied by writing the literal "D10" in a prose paragraph. A gate that reads a
 * narrative is not a gate. It now requires D01..D10 evidence files to actually exist.
 */
const motionPresent = existsSync(motionDir)
  ? Array.from({ length: 10 }, (_, i) => 'D' + String(i + 1).padStart(2, '0'))
      .filter((d) => existsSync(`${motionDir}/${d}.json`) || existsSync(`${motionDir}/${d}.md`))
  : [];
cmp(
  '10 dynamic trajectories (D01-D10) recorded with reference + local evidence',
  motionPresent.length === 10,
  `${motionPresent.length}/10 trajectory evidence files in ${motionDir}/ (have: ${motionPresent.join(',') || 'none'})`,
);

const score = existsSync('quality/scorecard.json') ? JSON.parse(readFileSync('quality/scorecard.json', 'utf8')) : null;
cmp('scorecard complete with total >= 92 and every category >= 85%', !!score && typeof score.total === 'number' && score.total >= 92, score ? `total=${score.total ?? 'null'}` : 'no scorecard');

const backlog = JSON.parse(readFileSync('quality/backlog.json', 'utf8'));
const openP0P1 = backlog.filter((b) => (b.severity === 'P0' || b.severity === 'P1') && b.status === 'open');
const blocked = backlog.filter((b) => b.status === 'blocked');
cmp('no open P0/P1', openP0P1.length === 0, openP0P1.map((b) => b.id).join(',') || 'clear');
cmp('no blocked evidence gates', blocked.length === 0, blocked.map((b) => b.id).join(',') || 'clear');

const all = [...results, ...gates];
const failed = all.filter((r) => !r.ok);
console.log(JSON.stringify({ results, gates, passed: all.length - failed.length, failed: failed.length }, null, 2));
if (failed.length) {
  console.error('\nverify:release FAILED — ' + failed.length + ' gate(s):\n- ' + failed.map((f) => f.name + ': ' + String(f.detail).slice(0, 160)).join('\n- '));
  console.error('\nResult state: PARTIAL / BLOCKED. Do not describe this build as a complete high-fidelity clone.');
  process.exit(1);
}
console.log('verify:release PASSED');
