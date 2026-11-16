import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONTRACT, contractProblem } from '../contract/validate.mjs';
import { makeFixture } from '../contract/make-fixture.mjs';
import { canonical, sha256Hex, SUMMARY_SCHEMA, MODEL_VERSION, SOURCE_REPO, MAX_EVENTS } from '../summary.mjs';

const committed = JSON.parse(readFileSync(new URL('../contract/fixture-seed-7.json', import.meta.url), 'utf8'));

test('exporter constants are the fixed contract constants', () => {
  assert.equal(SUMMARY_SCHEMA, CONTRACT.schema);
  assert.equal(MODEL_VERSION, CONTRACT.constants.modelVersion);
  assert.equal(SOURCE_REPO, CONTRACT.constants.sourceRepo);
  assert.equal(MAX_EVENTS, CONTRACT.limits.maxEvents);
});

test('the real exporter output satisfies the fixed contract and equals the committed fixture', async () => {
  const made = await makeFixture();
  assert.equal(await contractProblem(made), null);
  assert.deepEqual(made, committed);
});

test('boundary: tampering, control claims, extra fields and bad provenance are refused', async () => {
  const cases = [
    [{ ...committed, events: [{ ...committed.events[0], kind: 'habitat override' }, ...committed.events.slice(1)] }, 'DIGEST'],
    [{ ...committed, controlsHabitat: true }, 'CONSTANT_controlsHabitat'],
    [{ ...committed, liveTelemetry: true }, 'CONSTANT_liveTelemetry'],
    [{ ...committed, simulated: false }, 'CONSTANT_simulated'],
    [{ ...committed, command: 'vent-airlock' }, 'FIELDS'],
    [{ ...committed, sourceRepo: 'someone/else' }, 'CONSTANT_sourceRepo'],
    [{ ...committed, sourceCommit: 'main' }, 'SOURCE_COMMIT'],
    [{ ...committed, seed: 0 }, 'SEED'],
    [{ ...committed, events: [{ ...committed.events[0], detail: 'text' }] }, 'EVENTS'],
    [{ ...committed, events: Array.from({ length: 33 }, (_, i) => ({ id: `evt-${i}`, step: 0, settlement: 'ARES', kind: 'x' })) }, 'EVENTS'],
  ];
  for (const [doc, code] of cases) assert.equal(await contractProblem(doc), code);
});

test('a digest proves consistency, not authorship: a forger who recomputes it passes the digest check', async () => {
  const forgedEvents = [{ id: 'evt-1', step: 0, settlement: 'ARES', kind: 'invented' }];
  const forged = { ...committed, events: forgedEvents, evidenceDigest: await sha256Hex(canonical(forgedEvents)) };
  assert.equal(await contractProblem(forged), null);
  assert.match(CONTRACT.evidenceDigest.doesNotProve, /who produced/);
});
