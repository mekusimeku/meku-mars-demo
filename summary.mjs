// MEKU MARS public simulation summary, contract meku.mars.sim-summary.v0 (PROPOSED).
// Read-only export of the browser teaching model's state for MEKU MYCELIUM.
// Synthetic only: no live telemetry, no habitat control, no keys, no Python core data.
// Not loaded by index.html; the public page is unchanged.

export const SUMMARY_SCHEMA = 'meku.mars.sim-summary.v0';
export const MODEL_VERSION = 'mars-genesis-browser-v1';
export const SOURCE_REPO = 'mekusimeku/meku-mars-demo';
export const MAX_EVENTS = 32;

/** Sorted-key JSON. MYCELIUM recomputes the digest with the same rule. */
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}

export async function sha256Hex(text) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

const RESERVES = { water: 20, oxygen: 20, food: 10, energy: 10, battery: 5, equipment: 1, human_work: 0, robot_work: 0 };

/**
 * @param state a state from engine.mjs createState()
 * @param meta  { simulationId, generatedAt (ISO UTC ms), sourceCommit (40 hex) } supplied by the caller
 */
export async function publicSummary(state, meta) {
  if (!state || typeof state !== 'object' || !state.nodes) throw Error('Unknown state.');
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(meta?.simulationId ?? '')) throw Error('Invalid simulation id.');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(meta?.generatedAt ?? '')) throw Error('Invalid time.');
  if (!/^[0-9a-f]{40}$/.test(meta?.sourceCommit ?? '')) throw Error('Invalid source commit.');
  const settlements = Object.values(state.nodes).map(node => ({
    name: node.name,
    online: node.online === true,
    alerts: node.alerts.length,
    pendingTasks: node.tasks.filter(t => t.status === 'pending').length,
    quarantinedPackages: node.memory.filter(p => p.status === 'quarantined').length,
    atOrBelowReserve: Object.keys(RESERVES).filter(k => RESERVES[k] > 0 && node.stock[k] <= RESERVES[k]).sort(),
  }));
  const events = state.events.slice(0, MAX_EVENTS).map(e => ({ id: e.id, step: e.step, settlement: e.settlement, kind: e.kind }));
  return {
    schema: SUMMARY_SCHEMA,
    simulated: true,
    dataClass: 'public-synthetic',
    sourceRepo: SOURCE_REPO,
    sourceCommit: meta.sourceCommit,
    simulationId: meta.simulationId,
    modelVersion: MODEL_VERSION,
    seed: state.seed,
    step: state.step,
    generatedAt: meta.generatedAt,
    settlements,
    events,
    evidenceDigest: await sha256Hex(canonical(events)),
    liveTelemetry: false,
    controlsHabitat: false,
  };
}
