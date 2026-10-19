// Targeted CC0 / public-domain images for the difficult cases: hair, fur,
// thin edges, product isolation, complex background.
import { appendFileSync, writeFileSync, existsSync } from 'node:fs';

const API = 'https://commons.wikimedia.org/w/api.php';
const QUERIES = [
  ['hair',        'portrait woman long hair'],
  ['hair2',       'portrait man beard'],
  ['fur',         'cat fur portrait'],
  ['fur2',        'dog fluffy fur'],
  ['product',     'shoe product white background'],
  ['product2',    'perfume bottle product'],
  ['thin',        'flower stem macro'],
  ['thin2',       'bicycle spokes'],
  ['complex',     'crowded street market'],
  ['complex2',    'forest leaves detail'],
];

async function search(q) {
  const url = `${API}?action=query&generator=search&gsrsearch=${encodeURIComponent(`filetype:bitmap ${q}`)}&gsrlimit=8&gsrnamespace=6&prop=imageinfo&iiprop=url|extmetadata|size&format=json&origin=*`;
  const res = await fetch(url, { headers: { 'User-Agent': 'PixelCutoutTest/1.0 (test images)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Object.values(data?.query?.pages ?? {}).map((p) => {
    const ii = p.imageinfo?.[0];
    return {
      title: p.title,
      url: ii?.url,
      width: ii?.width, height: ii?.height,
      license: ii?.extmetadata?.LicenseShortName?.value || 'unknown',
      artist: (ii?.extmetadata?.Artist?.value || '').replace(/<[^>]+>/g, '').trim(),
    };
  }).filter((f) => f.url && f.width);
}

const ok = (l) => /^(cc0|cc-zero|public domain|pd)/i.test(l.trim());
const lines = [];
let n = 0;
for (const [tag, q] of QUERIES) {
  try {
    const files = await search(q);
    const good = files.filter((f) => ok(f.license) && f.width >= 800 && f.height >= 600);
    if (!good.length) { console.log(`  ${tag}: no CC0 hit`); continue; }
    const f = good[0];
    const ext = (f.url.match(/\.([a-z0-9]+)(\?|$)/i)?.[1] || 'jpg').toLowerCase();
    const name = `real-${tag}.${ext}`;
    if (existsSync(name)) continue;
    const res = await fetch(f.url, { headers: { 'User-Agent': 'PixelCutoutTest/1.0 (test images)' } });
    if (!res.ok) throw new Error(`download HTTP ${res.status}`);
    writeFileSync(name, Buffer.from(await res.arrayBuffer()));
    console.log(`  ${name} :: ${f.width}x${f.height} :: ${f.license} :: ${f.title}`);
    lines.push(`- **${name}** — ${f.title}`, `  - Source: ${f.url}`, `  - Licence: ${f.license}`, `  - Size: ${f.width}x${f.height}`, `  - Author: ${f.artist || 'n/a'}`, '');
    n++;
  } catch (e) {
    console.warn(`  ${tag}: ${e.message}`);
  }
}
if (lines.length) appendFileSync('SOURCES.md', '\n' + lines.join('\n'), 'utf8');
console.log(`\nwrote ${n} targeted image(s)`);
