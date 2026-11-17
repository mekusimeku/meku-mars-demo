// Public copy must stay honest: synthetic simulation labels present, and no positive claim of
// real hardware, quantum hardware, live telemetry, crew/biological data or real-world outcomes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = f => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const visible = html => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ');

const FORBIDDEN = [
  /\bquantum\s+(?:hardware|computer|computing|processor|chip|advantage|supremacy)\b/i,
  /\bqubits?\b/i,
  /\b(?:real|physical|dedicated|custom|our)\s+(?:chips?|silicon|asics?|hardware|processors?)\b/i,
  /\bneuromorphic\b/i,
  /\b(?:live|real[- ]time|real)\s+(?:mars\s+)?telemetry\b/i,
  /\b(?:astronaut|crew|biological|medical)\s+(?:data|telemetry|readings?)\b/i,
  /\b(?:guaranteed|certified|proven)\s+(?:safe|results?|outcomes?|returns?)\b/i,
  /\b(?:nasa|spacex|esa)\s+(?:approved|certified|partner|data)\b/i,
];

// A match preceded in its own sentence by a negation ("No live telemetry", "not quantum hardware") is a disclaimer.
export function forbiddenClaims(text) {
  const hits = [];
  for (const re of FORBIDDEN) {
    for (const m of text.matchAll(new RegExp(re.source, re.flags + 'g'))) {
      const before = text.slice(Math.max(0, m.index - 80), m.index).split(/[.!?\n]/).pop();
      if (/\b(?:no|not|never|without|nor)\b/i.test(before)) continue;
      hits.push(m[0]);
    }
  }
  return hits;
}

test('scanner catches planted claims and ignores disclaimers', () => {
  assert.notDeepEqual(forbiddenClaims('Runs on our quantum hardware.'), []);
  assert.notDeepEqual(forbiddenClaims('Streams live telemetry from ARES.'), []);
  assert.notDeepEqual(forbiddenClaims('Includes astronaut data.'), []);
  assert.notDeepEqual(forbiddenClaims('Computed on a real chip.'), []);
  assert.deepEqual(forbiddenClaims('No live telemetry, real missions or quantum hardware.'), []);
  assert.deepEqual(forbiddenClaims('Results are simulation data, not live telemetry.'), []);
});

test('public page, app copy and README make no hardware or real-world claims', () => {
  for (const [name, text] of [['index.html', visible(read('index.html'))], ['app.mjs', read('app.mjs')], ['README.md', read('README.md')]]) {
    assert.deepEqual(forbiddenClaims(text), [], name);
  }
});

test('public page and README label the work as synthetic simulation', () => {
  const page = visible(read('index.html'));
  assert.match(page, /SIMULATED · BROWSER ONLY/);
  assert.match(page, /Every reading is synthetic/);
  assert.match(page, /No live telemetry/);
  assert.match(read('README.md'), /synthetic research simulation/);
});
