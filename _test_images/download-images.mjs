// Downloads a few CC0 / public-domain photographs from Wikimedia Commons so the
// quality tests run on real camera images rather than only synthetic scenes.
// Every image's licence and source URL is written to SOURCES.md.
import { writeFileSync } from 'node:fs';

const API = 'https://commons.wikimedia.org/w/api.php';
const CATEGORIES = [
  'Category:CC-Zero',
  'Category:Public domain',
  'Category:Featured pictures of people',
];

async function listFiles(cat, limit = 10) {
  const url = `${API}?action=query&generator=categorymembers&gcmtitle=${encodeURIComponent(cat)}&gcmtype=file&gcmlimit=${limit}&prop=imageinfo&iiprop=url|extmetadata|size&format=json&origin=*`;
  const res = await fetch(url, { headers: { 'User-Agent': 'PixelCutoutTest/1.0 (test images)' } });
  if (!res.ok) throw new Error(`${cat}: HTTP ${res.status}`);
  const data = await res.json();
  const pages = data?.query?.pages ?? {};
  return Object.values(pages).map((p) => {
    const ii = p.imageinfo?.[0];
    return {
      title: p.title,
      url: ii?.url,
      width: ii?.width,
      height: ii?.height,
      license: ii?.extmetadata?.LicenseShortName?.value || 'unknown',
      artist: (ii?.extmetadata?.Artist?.value || '').replace(/<[^>]+>/g, '').trim(),
    };
  }).filter((f) => f.url && f.width && f.height);
}

const chosen = [];
for (const cat of CATEGORIES) {
  try {
    const files = await listFiles(cat);
    for (const f of files) {
      if (chosen.some((c) => c.url === f.url)) continue;
      const ratio = f.width / f.height;
      if (ratio < 0.5 || ratio > 2.2) continue;
      chosen.push({ ...f, category: cat });
      if (chosen.length >= 6) break;
    }
  } catch (e) {
    console.warn(`skip ${cat}: ${e.message}`);
  }
  if (chosen.length >= 6) break;
}

if (chosen.length === 0) {
  console.error('No images found — keep the synthetic fallback.');
  process.exit(1);
}

const lines = ['# Test image sources', '', 'Images below are CC0 / public domain from Wikimedia Commons.', ''];
for (let i = 0; i < chosen.length; i++) {
  const c = chosen[i];
  const ext = (c.url.match(/\.([a-z0-9]+)(\?|$)/i)?.[1] || 'jpg').toLowerCase();
  const name = `real-${String(i + 1).padStart(2, '0')}.${ext}`;
  console.log(`downloading ${name} :: ${c.width}x${c.height} :: ${c.license} :: ${c.title}`);
  const res = await fetch(c.url, { headers: { 'User-Agent': 'PixelCutoutTest/1.0 (test images)' } });
  if (!res.ok) { console.warn(`  failed HTTP ${res.status}`); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(name, buf);
  lines.push(`- **${name}** — ${c.title}`, `  - Source: ${c.url}`, `  - Licence: ${c.license}`, `  - Size: ${c.width}x${c.height}`, `  - Author: ${c.artist || 'n/a'}`, '');
}
writeFileSync('SOURCES.md', lines.join('\n'), 'utf8');
console.log(`\nwrote ${chosen.length} image(s) and SOURCES.md`);
