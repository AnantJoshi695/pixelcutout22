// Openverse (CC-licence aggregator) for the cases Commons search missed:
// animal fur, isolated products, thin structures, busy backgrounds.
import { appendFileSync, writeFileSync, existsSync } from 'node:fs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const QUERIES = [
  ['fur', 'cat portrait fur'],
  ['fur2', 'golden retriever dog portrait'],
  ['product', 'sneaker white background'],
  ['product2', 'handbag product photo'],
  ['thin', 'flower stem macro'],
  ['thin2', 'bicycle spokes closeup'],
  ['complex', 'crowded market street'],
  ['complex2', 'forest leaves detail'],
];

async function search(q) {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=cc0,pdm&page_size=10`;
  const res = await fetch(url, { headers: { 'User-Agent': 'PixelCutoutTest/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    width: r.width, height: r.height,
    license: `${r.license}${r.license_version ? ' ' + r.license_version : ''}`,
    creator: r.creator,
    foreign: r.foreign_landing_url,
    source: r.source,
  })).filter((r) => r.url && r.width >= 800 && r.height >= 600);
}

const lines = [];
let n = 0;
for (const [tag, q] of QUERIES) {
  try {
    const files = await search(q);
    if (!files.length) { console.log(`  ${tag}: no hit`); continue; }
    const f = files[0];
    const ext = (f.url.match(/\.([a-z0-9]+)(\?|$)/i)?.[1] || 'jpg').toLowerCase();
    const name = `real-${tag}.${ext}`;
    if (existsSync(name)) { console.log(`  ${name} exists, skip`); continue; }
    const res = await fetch(f.url, { headers: { 'User-Agent': 'PixelCutoutTest/1.0' } });
    if (!res.ok) throw new Error(`download HTTP ${res.status}`);
    writeFileSync(name, Buffer.from(await res.arrayBuffer()));
    console.log(`  ${name} :: ${f.width}x${f.height} :: ${f.license} :: ${f.title}`);
    lines.push(`- **${name}** — ${f.title}`, `  - Source: ${f.url}`, `  - Landing: ${f.foreign || 'n/a'}`, `  - Licence: ${f.license}`, `  - Size: ${f.width}x${f.height}`, `  - Author: ${f.creator || 'n/a'}`, '');
    n++;
  } catch (e) {
    console.warn(`  ${tag}: ${e.message}`);
  }
  await sleep(1500);
}
if (lines.length) appendFileSync('SOURCES.md', '\n' + lines.join('\n'), 'utf8');
console.log(`\nwrote ${n} Openverse image(s)`);
