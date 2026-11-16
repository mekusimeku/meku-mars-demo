// Validator for the fixed contract file. Shared rule set: MEKU's site consumer vendors the same
// contract JSON byte-for-byte and checks its hash, so both sides read one definition.
import { readFileSync } from 'node:fs';
import { canonical, sha256Hex } from '../summary.mjs';

export const CONTRACT = JSON.parse(readFileSync(new URL('./meku.mars.sim-summary.v0.json', import.meta.url), 'utf8'));
const keysEqual = (obj, keys) => obj && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).sort().join(',') === [...keys].sort().join(',');
const nonNeg = v => Number.isSafeInteger(v) && v >= 0;

export async function contractProblem(doc) {
  const c = CONTRACT, p = c.patterns;
  if (!keysEqual(doc, c.topLevelKeys)) return 'FIELDS';
  if (doc.schema !== c.schema) return 'SCHEMA';
  for (const [k, v] of Object.entries(c.constants)) if (doc[k] !== v) return `CONSTANT_${k}`;
  if (!new RegExp(p.sourceCommit).test(doc.sourceCommit)) return 'SOURCE_COMMIT';
  if (!new RegExp(p.simulationId).test(doc.simulationId)) return 'SIMULATION_ID';
  if (!new RegExp(p.generatedAt).test(doc.generatedAt)) return 'TIME';
  if (!Number.isInteger(doc.seed) || doc.seed < c.limits.seedMin || doc.seed > c.limits.seedMax) return 'SEED';
  if (!nonNeg(doc.step)) return 'STEP';
  if (!Array.isArray(doc.settlements) || doc.settlements.length !== c.settlements.length) return 'SETTLEMENTS';
  for (const [i, s] of doc.settlements.entries()) {
    if (!keysEqual(s, c.settlementKeys) || s.name !== c.settlements[i] || typeof s.online !== 'boolean') return 'SETTLEMENTS';
    if (!nonNeg(s.alerts) || !nonNeg(s.pendingTasks) || !nonNeg(s.quarantinedPackages)) return 'SETTLEMENTS';
    if (!Array.isArray(s.atOrBelowReserve) || s.atOrBelowReserve.some(k => !new RegExp(p.reserveKey).test(k))) return 'SETTLEMENTS';
  }
  if (!Array.isArray(doc.events) || doc.events.length > c.limits.maxEvents) return 'EVENTS';
  for (const e of doc.events) {
    if (!keysEqual(e, c.eventKeys) || !new RegExp(p.eventId).test(e.id) || !nonNeg(e.step)) return 'EVENTS';
    if (typeof e.kind !== 'string' || e.kind.length > c.limits.maxEventKindLength || !c.eventSettlements.includes(e.settlement)) return 'EVENTS';
  }
  if (doc.evidenceDigest !== await sha256Hex(canonical(doc.events))) return 'DIGEST';
  return null;
}
