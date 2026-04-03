#!/usr/bin/env node
/**
 * build_chapter.js  —  Fetch and parse any chapter from the Joyce Project API
 *
 * Usage:
 *   node build_chapter.js <chapter_number>
 *
 * Examples:
 *   node build_chapter.js 1       → outputs ch1_graph.json
 *   node build_chapter.js 2       → outputs ch2_graph.json
 *   node build_chapter.js all     → outputs all 18 chapters
 */

const https  = require('https');
const fs     = require('fs');
const path   = require('path');

const BASE = 'https://joyceproject.com';

// ── Helpers ──────────────────────────────────────────────────────────────────

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// ── Color → category map (from Joyce Project /api/tags) ──────────────────────

const COLOR_TO_TAG = {
  '307EE3': 'The Writer',
  'CF2929': 'The Body',
  '9C632A': 'Dublin',
  'F59627': 'Literature',
  '40B324': 'Ireland',
  '40b324': 'Ireland',
  'AB59C2': 'Performances',
};

const TAGS = [
  { name: 'The Writer',   color: '#307EE3' },
  { name: 'The Body',     color: '#CF2929' },
  { name: 'Dublin',       color: '#9C632A' },
  { name: 'Literature',   color: '#F59627' },
  { name: 'Ireland',      color: '#40B324' },
  { name: 'Performances', color: '#AB59C2' },
];

// ── Parser ────────────────────────────────────────────────────────────────────

function parseChapter(htmlSource, notesMap) {
  // Capture annotations, including those with inner <em>/<strong> etc.
  const re = /<a href="([^"]+)" data-color="([^"]+)" data-tag="[^"]*" data-type="annotation">(.*?)<\/a>/gs;

  const noteInstances = {};
  let m, orderIdx = 0;

  while ((m = re.exec(htmlSource)) !== null) {
    const id    = m[1];
    const color = m[2].toUpperCase().replace('40b324'.toUpperCase(), '40B324');
    // Strip inner HTML tags to get plain text
    const text  = m[3].replace(/<[^>]+>/g, '').trim();

    if (!noteInstances[id]) {
      noteInstances[id] = { id, color, texts: [], order: orderIdx++ };
    }
    if (text) noteInstances[id].texts.push(text);
  }

  // Build nodes
  const nodes = Object.values(noteInstances).map(n => ({
    id:      n.id,
    title:   notesMap[n.id] || n.texts[0] || n.id,
    color:   '#' + n.color,
    tag:     COLOR_TO_TAG[n.color] || 'Other',
    snippet: n.texts.slice(0, 3).join(' / '),
    order:   n.order,
    url:     `${BASE.replace('joyceproject', 'www.joyceproject')}/notes/${n.id}`,
  }));

  nodes.sort((a, b) => a.order - b.order);
  nodes.forEach((n, i) => { n.order = i; });

  // Build paragraph co-occurrence edges
  const paras   = htmlSource.split(/<\/p>|<\/h[1-6]>/);
  const re2     = /<a href="([^"]+)" data-color="[^"]+" data-tag="[^"]*" data-type="annotation">(.*?)<\/a>/gs;
  const edgeMap = {};

  paras.forEach(para => {
    const ids = new Set();
    re2.lastIndex = 0;
    while ((m = re2.exec(para)) !== null) {
      if (m[2].replace(/<[^>]+>/g, '').trim()) ids.add(m[1]);
    }
    const arr = [...ids];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const key = [arr[i], arr[j]].sort().join('|||');
        edgeMap[key] = (edgeMap[key] || 0) + 1;
      }
    }
  });

  const edges = Object.entries(edgeMap).map(([key, weight]) => {
    const [source, target] = key.split('|||');
    return { source, target, weight };
  });

  return { nodes, edges, tags: TAGS };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function buildChapter(chapterNumber, chaptersIndex, notesMap) {
  const chapter = chaptersIndex.find(c => c.number === chapterNumber);
  if (!chapter) throw new Error(`Chapter ${chapterNumber} not found`);

  process.stdout.write(`  [${chapter.number}] ${chapter.title} — fetching...`);
  const raw  = await get(`${BASE}/api/chapters/${chapter.id}`);
  const data = JSON.parse(raw);
  process.stdout.write(' parsing...');

  const graph    = parseChapter(data.html_source, notesMap);
  const outFile  = path.join(__dirname, `ch${chapter.number}_graph.json`);

  fs.writeFileSync(outFile, JSON.stringify(graph, null, 2));
  console.log(` ✓  ${graph.nodes.length} nodes, ${graph.edges.length} edges → ${path.basename(outFile)}`);
  return graph;
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.log('Usage: node build_chapter.js <number|all>');
    console.log('  node build_chapter.js 1');
    console.log('  node build_chapter.js all');
    process.exit(1);
  }

  console.log('Fetching chapter index and notes...');
  const [chaptersRaw, notesRaw] = await Promise.all([
    get(`${BASE}/api/chapters`),
    get(`${BASE}/api/notes`),
  ]);

  const chaptersIndex = JSON.parse(chaptersRaw);
  const notesMap      = {};
  JSON.parse(notesRaw).forEach(n => { notesMap[n.id] = n.title; });

  console.log(`  ${chaptersIndex.length} chapters, ${Object.keys(notesMap).length} notes loaded\n`);

  if (arg === 'all') {
    for (const ch of chaptersIndex) {
      await buildChapter(ch.number, chaptersIndex, notesMap);
    }
  } else {
    const num = parseInt(arg, 10);
    if (isNaN(num) || num < 1 || num > 18) {
      console.error('Chapter must be a number between 1 and 18, or "all"');
      process.exit(1);
    }
    await buildChapter(num, chaptersIndex, notesMap);
  }

  console.log('\nDone.');
}

main().catch(err => { console.error(err.message); process.exit(1); });
