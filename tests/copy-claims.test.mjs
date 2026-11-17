// Public copy must stay honest: synthetic simulation labels present, and no positive claim of
// real hardware, quantum hardware, live telemetry, crew/biological data or real-world outcomes.
// Scans index.html visible text and attribute text (meta content, alt, aria-label, title,
// placeholder), app.mjs, engine.mjs user-visible string literals and README.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = f => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const decode = s => s.replace(/&amp;/g, '&').replace(/&#39;|&apos;|&rsquo;/g, "'").replace(/&[a-z#0-9]+;/gi, ' ');
const visible = html => decode(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
const ATTRS = /\b(?:content|alt|aria-label|aria-description|title|placeholder)\s*=\s*("([^"]*)"|'([^']*)')/gi;
const attributes = html => [...html.matchAll(ATTRS)].map(m => decode(m[2] ?? m[3] ?? ''));
// String literals ('…', "…", `…`) in a module: what the engine can put on screen.
const literals = src => [...src.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map(m => m[1] ?? m[2] ?? m[3] ?? '');

const FORBIDDEN = [
  /\bquantum\s+(?:hardware|computers?|computing|processors?|processing(?:\s+units?)?|chips?|qpus?|devices?|machines?|advantage|supremacy)\b/i,
  /\bqpus?\b/i,
  /\bqubits?\b/i,
  /\b(?:real|physical|dedicated|custom|our|actual)\s+(?:chips?|silicon|asics?|hardware|processors?|gpus?|fpgas?)\b/i,
  /\bneuromorphic\b/i,
  /\b(?:live|real\s?time|real|actual)\s+(?:mars\s+|habitat\s+|space\s+)?telemetry\b/i,
  /\b(?:astronaut|crew|biological|medical|patient)\s+(?:data|telemetry|readings?|vitals)\b/i,
  /\b(?:guaranteed|certified|proven)\s+(?:safe|results?|outcomes?|returns?)\b/i,
  /\b(?:nasa|spacex|esa)\s+(?:approved|certified|partner|data)\b/i,
];
// A negation counts only when it is one of the three words directly before the claim.
const NEGATION = /^(?:no|not|never|without|nor|cannot|can't|isn't|aren't|doesn't|don't|won't|zero)$/i;

function forbiddenClaims(text) {
  const hits = [];
  // Clause boundaries: sentence ends, newlines, colon, semicolon, em/en dash.
  for (const raw of text.split(/[.!?\n:;—–]/)) {
    const clause = raw.replace(/[‘’]/g, "'").replace(/[-‐‑_/]+/g, ' ').replace(/\s+/g, ' ');
    for (const re of FORBIDDEN) {
      for (const m of clause.matchAll(new RegExp(re.source, re.flags + 'g'))) {
        const words = clause.slice(0, m.index).trim().split(' ').filter(Boolean).slice(-3);
        if (words.some(w => NEGATION.test(w.replace(/[^\w']/g, '')))) continue;
        hits.push(m[0]);
      }
    }
  }
  return hits;
}

test('scanner catches planted and bypass claims', () => {
  for (const claim of [
    'Runs on our quantum hardware.', 'Runs on quantum-hardware.', 'Powered by a quantum processing unit.',
    'Computed on real chips.', 'Streams live telemetry from ARES.', 'Real-time telemetry from HESTIA.', 'Includes astronaut data.',
    'No delays: our quantum hardware computes it.', 'Not slow — real chips compute it.', 'No waiting; live telemetry included.',
    'Without any setup the answer arrives from our quantum hardware.', 'Not a toy, this is real hardware.',
  ]) assert.notDeepEqual(forbiddenClaims(claim), [], claim);
});

test('scanner ignores direct disclaimers (including cannot/can\'t)', () => {
  for (const ok of [
    'No live telemetry, real missions or financial operations.', 'This is not quantum hardware.',
    'This cannot use quantum hardware.', "MARS can't read live telemetry.", 'MARS can’t read live telemetry.',
    'Results are simulation data, not live telemetry.',
  ]) assert.deepEqual(forbiddenClaims(ok), [], ok);
});

test('extractors see attribute text and engine string literals', () => {
  assert.deepEqual(attributes('<meta name="description" content="A b"><img alt=\'C d\'><button aria-label="E" title="F">'), ['A b', 'C d', 'E', 'F']);
  assert.deepEqual(literals(`const a='x y';const b="z";const c=\`w \${1}\`;`), ['x y', 'z', 'w ${1}']);
});

test('public page (text and attributes), app, engine and README make no hardware or real-world claims', () => {
  const html = read('index.html');
  assert.ok(attributes(html).length > 0, 'index.html attributes found');
  for (const [name, text] of [
    ['index.html text', visible(html)],
    ['index.html attributes', attributes(html).join('\n')],
    ['app.mjs', read('app.mjs')],
    ['engine.mjs strings', literals(read('engine.mjs')).join('\n')],
    ['README.md', read('README.md')],
  ]) assert.deepEqual(forbiddenClaims(text), [], name);
});

test('public page and README label the work as synthetic simulation', () => {
  const page = visible(read('index.html'));
  assert.match(page, /SIMULATED · BROWSER ONLY/);
  assert.match(page, /Every reading is synthetic/);
  assert.match(page, /No live telemetry/);
  assert.match(read('README.md'), /synthetic research simulation/);
});
