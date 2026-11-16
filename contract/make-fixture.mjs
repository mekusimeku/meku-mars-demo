// Regenerates contract/fixture-seed-7.json from the real engine and exporter.
import { createState, scenario, advance } from '../engine.mjs';
import { publicSummary } from '../summary.mjs';
export const ENGINE_COMMIT = '62abcca764e8636c2a59f29c34d86ff582b85b4e';
export async function makeFixture() {
  const s = createState(7); scenario(s, 'storm'); scenario(s, 'share'); advance(s, 3); scenario(s, 'water');
  return publicSummary(s, { simulationId: 'storm-share-water-seed-7', generatedAt: '2026-11-16T00:00:00.000Z', sourceCommit: ENGINE_COMMIT });
}
if (import.meta.url === `file://${process.argv[1]}`) process.stdout.write(JSON.stringify(await makeFixture(), null, 2) + '\n');
