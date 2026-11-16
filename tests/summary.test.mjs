import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, scenario, advance } from '../engine.mjs';
import { publicSummary, canonical, sha256Hex, SUMMARY_SCHEMA, MAX_EVENTS } from '../summary.mjs';

const META = { simulationId: 'storm-share-seed-7', generatedAt: '2026-11-16T00:00:00.000Z', sourceCommit: '62abcca764e8636c2a59f29c34d86ff582b85b4e' };
function run(seed = 7) { const s = createState(seed); scenario(s, 'storm'); scenario(s, 'share'); advance(s, 3); scenario(s, 'water'); return s; }

test('summary has exactly the v0 fields, is synthetic and cannot control anything', async () => {
  const sum = await publicSummary(run(), META);
  assert.deepEqual(Object.keys(sum).sort(), ['controlsHabitat','dataClass','evidenceDigest','events','generatedAt','liveTelemetry','modelVersion','schema','seed','settlements','simulated','simulationId','sourceCommit','sourceRepo','step'].sort());
  assert.equal(sum.schema, SUMMARY_SCHEMA);
  assert.equal(sum.simulated, true);
  assert.equal(sum.liveTelemetry, false);
  assert.equal(sum.controlsHabitat, false);
  assert.deepEqual(sum.settlements.map(s => s.name), ['ARES', 'HESTIA', 'PROMETHEUS']);
  assert.ok(sum.events.length <= MAX_EVENTS);
  assert.equal(sum.evidenceDigest, await sha256Hex(canonical(sum.events)));
});

test('same seed and steps give the same summary; event text is not exported', async () => {
  const a = await publicSummary(run(7), META), b = await publicSummary(run(7), META);
  assert.deepEqual(a, b);
  assert.doesNotMatch(JSON.stringify(a), /detail|Inspect greenhouse|kWh/);
});

test('reserve and quarantine states are reported, not hidden', async () => {
  const sum = await publicSummary(run(), META);
  const ares = sum.settlements.find(s => s.name === 'ARES');
  assert.deepEqual(ares.atOrBelowReserve, ['water']);
  assert.equal(ares.quarantinedPackages, 1);
  assert.ok(sum.settlements.find(s => s.name === 'PROMETHEUS').pendingTasks >= 1);
});

test('bad metadata is refused', async () => {
  await assert.rejects(publicSummary(run(), { ...META, sourceCommit: 'main' }), /commit/);
  await assert.rejects(publicSummary(run(), { ...META, generatedAt: 'now' }), /time/);
  await assert.rejects(publicSummary(run(), { ...META, simulationId: 'Bad Id' }), /simulation id/);
});
