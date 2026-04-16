import { StatsPanel } from './components/StatsPanel.js';
import { ArchModule } from './components/ArchModule.js';
import { MacroDashboard } from './components/MacroDashboard.js';
import { CanvasEdges } from './components/CanvasEdges.js';
import { ThreeModule } from './components/ThreeModule.js';

// Configuration
const CHAPTER_TITLES = {
  1:'Telemachus', 2:'Nestor', 3:'Proteus', 4:'Calypso', 5:'Lotus Eaters',
  6:'Hades', 7:'Aeolus', 8:'Lestrygonians', 9:'Scylla and Charybdis',
  10:'Wandering Rocks', 11:'Sirens', 12:'Cyclops', 13:'Nausicaa',
  14:'Oxen of the Sun', 15:'Circe', 16:'Eumaeus', 17:'Ithaca', 18:'Penelope'
};

const TAG_ORDER = ['The Writer','The Body','Dublin','Literature','Ireland','Performances'];

// Initial State
let currentView = 'network';
let currentTitle = 'Telemachus';
let activeFilters = new Set(TAG_ORDER);
let selectedNode = null;

// D3 State
let nodes, edges, nodesById, node, labels, sim;
let W, H;

// Modules
const stats = new StatsPanel('stats-container');
const arch = new ArchModule('arch-container');
const canvasEdges = new CanvasEdges('graph-container');
const threeModule = new ThreeModule('three-container');
let macro = null;

// Persistent state for the current chapter (needed to reload 3D on switch)
let currentGraphData = null;

// SVG Setup — NOTE: no more <line> elements in the SVG.
// Edges are drawn by CanvasEdges on a <canvas> layer.
const svg = d3.select('#graph');
const mainEl = document.getElementById('graph-container');
const gRoot = svg.append('g').attr('class', 'root');
const gNodes = gRoot.append('g').attr('class', 'nodes');

const zoom = d3.zoom().scaleExtent([0.15, 6])
  .on('zoom', e => {
    gRoot.attr('transform', e.transform);
    // Keep canvas edges in sync with the D3 zoom
    canvasEdges.setTransform(e.transform);
    canvasEdges.draw();
  });
svg.call(zoom);

const tooltip = document.getElementById('tooltip');

// -- Global Dispatch for components
window.dispatchHighlight = (nodeId) => {
    const d = nodesById[nodeId];
    if (d) applyHighlight(d);
};

// -- Functions
function getNeighbors(d) {
  return edges
    .filter(e => (e.source.id ?? e.source) === d.id || (e.target.id ?? e.target) === d.id)
    .map(e => {
      const nid = (e.source.id ?? e.source) === d.id
        ? (e.target.id ?? e.target) : (e.source.id ?? e.source);
      return nodesById[nid];
    }).filter(Boolean);
}

function applyHighlight(d) {
  const neighbors = getNeighbors(d);
  const neighborSet = new Set(neighbors.map(n => n.id));
  node.classed('faded', n => n.id !== d.id && !neighborSet.has(n.id));
  node.classed('highlighted', n => n.id === d.id || neighborSet.has(n.id));
  // Delegate edge highlight to canvas module
  canvasEdges.applyHighlight(d.id, neighborSet);
  return neighbors;
}

function applyFilters() {
  if (!node) return;
  document.querySelectorAll('.legend-item').forEach(el => {
    el.classList.toggle('dimmed', !activeFilters.has(el.dataset.tag));
  });
  node.classed('dimmed', d => !activeFilters.has(d.tag));
  // Delegate filter to canvas module
  canvasEdges.applyFilters(activeFilters, nodesById);
}

function moveTooltip(event) {
  const rect = mainEl.getBoundingClientRect();
  let x = event.clientX - rect.left + 15;
  let y = event.clientY - rect.top - 10;
  if (x + 270 > rect.width) x -= 285;
  if (y + 180 > rect.height) y -= 160;
  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
}

function deselect() {
  selectedNode = null;
  if (node) { node.classed('faded', false).classed('highlighted', false); }
  canvasEdges.clearHighlight();
  applyFilters();
  tooltip.classList.remove('pinned');
  tooltip.style.display = 'none';
}

function buildTooltipHTML(d, neighbors, pinned) {
  const neighborHtml = neighbors.length
    ? neighbors.slice(0, 4).map(n => `<span style="color:${n.color}">${n.title}</span>`).join(', ')
      + (neighbors.length > 4 ? `… +${neighbors.length - 4}` : '')
    : '—';
  return `
    ${pinned ? `<span class="tip-close" id="tipClose">✕</span>` : ''}
    <div class="tip-title" style="color:${d.color}">${d.title}</div>
    <div class="tip-tag" style="color:${d.color}">${d.tag}</div>
    <div class="tip-order">Aparición #${d.order + 1} en el capítulo</div>
    ${d.snippet ? `<div class="tip-snippet">"${d.snippet}"</div>` : ''}
    <div class="tip-neighbors">${neighbors.length} co-ocurrencia${neighbors.length !== 1 ? 's' : ''}: ${neighborHtml}</div>
    ${pinned ? `<div class="tip-link" id="tipLink">↗ Ver nota en Joyce Project</div>` : ''}
  `;
}

async function showMacroView() {
    currentView = 'macro';
    deselect();
    sim?.stop();

    // UI Toggles
    document.getElementById('graph-container').style.display = 'none';
    document.getElementById('stats-container').style.display = 'none';
    document.getElementById('macro-container').style.display = 'flex';

    document.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btnMacro').classList.add('active');

    if (!macro) {
        macro = new MacroDashboard('macro-container', (chapterNum) => {
            document.getElementById('chapterSelect').value = chapterNum;
            document.getElementById('chapterSelect').dispatchEvent(new Event('change'));
        });
        await macro.init();
    } else {
        macro.render();
    }
}

function hideMacroView() {
    document.getElementById('graph-container').style.display = 'block';
    document.getElementById('stats-container').style.display = 'flex';
    document.getElementById('macro-container').style.display = 'none';
}

function showThreeView() {
    currentView = '3d';
    deselect();
    sim?.stop();
    canvasEdges.setVisible(false);

    document.getElementById('graph-container').style.display = 'none';
    document.getElementById('stats-container').style.display = 'none';
    document.getElementById('macro-container').style.display = 'none';
    document.getElementById('three-container').style.display = 'block';

    document.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn3D').classList.add('active');

    // Load or reload with current chapter data
    if (currentGraphData) {
        threeModule.load(currentGraphData, currentTitle);
    }
}

function hideThreeView() {
    threeModule.pause();
    document.getElementById('three-container').style.display = 'none';
}

function loadGraph(graphData) {
  if (sim) sim.stop();
  deselect();
  gNodes.selectAll('*').remove();
  gRoot.selectAll('.tl-deco').remove();

  nodes = graphData.nodes.map(d => ({ ...d }));
  edges = graphData.edges.map(d => ({ ...d }));
  nodesById = {};
  nodes.forEach(n => { nodesById[n.id] = n; });

  // Store data for 3D view
  currentGraphData = graphData;

  // Pass edges to the canvas layer
  canvasEdges.setEdges(edges);
  canvasEdges.setVisible(true);

  const deg = {};
  edges.forEach(e => {
    deg[e.source] = (deg[e.source] || 0) + e.weight;
    deg[e.target] = (deg[e.target] || 0) + e.weight;
  });
  const rScale = d3.scaleSqrt()
    .domain([0, d3.max(Object.values(deg)) || 1])
    .range([4, 16]);
  nodes.forEach(n => { n.radius = rScale(deg[n.id] || 0); });

  // Only nodes rendered in SVG — edges are on canvas
  node = gNodes.selectAll('g')
    .data(nodes).join('g')
    .attr('class', 'node')
    .call(d3.drag()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

  node.append('circle')
    .attr('r', d => d.radius)
    .attr('fill', d => d.color + 'aa')
    .attr('stroke', d => d.color);

  labels = node.append('text')
    .attr('x', d => d.radius + 3)
    .attr('y', 3)
    .text(d => d.title.length > 20 ? d.title.slice(0, 18) + '…' : d.title);

  if (!document.getElementById('showLabels').checked) labels.style('display', 'none');

  // Node Events
  node
    .on('mouseover', function (event, d) {
      if (selectedNode) return;
      const neighbors = applyHighlight(d);
      tooltip.innerHTML = buildTooltipHTML(d, neighbors, false);
      tooltip.style.display = 'block';
      moveTooltip(event);
    })
    .on('mousemove', function (event) {
      if (selectedNode) return;
      moveTooltip(event);
    })
    .on('mouseleave', function () {
      if (selectedNode) return;
      node.classed('faded', false).classed('highlighted', false);
      canvasEdges.clearHighlight();
      applyFilters();
      tooltip.style.display = 'none';
    })
    .on('click', function (event, d) {
      event.stopPropagation();
      if (selectedNode === d) { deselect(); return; }
      selectedNode = d;
      const neighbors = applyHighlight(d);
      tooltip.innerHTML = buildTooltipHTML(d, neighbors, true);
      tooltip.classList.add('pinned');
      tooltip.style.display = 'block';
      moveTooltip(event);
      document.getElementById('tipClose')?.addEventListener('click', e => { e.stopPropagation(); deselect(); });
      document.getElementById('tipLink')?.addEventListener('click', e => { e.stopPropagation(); window.open(d.url, '_blank', 'noopener'); });
    });

  // Initial Layout
  currentView = 'network';
  document.getElementById('btnNetwork').classList.add('active');
  document.getElementById('btnTimeline').classList.remove('active');

  W = mainEl.clientWidth;
  H = mainEl.clientHeight;

  sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(edges).id(d => d.id).distance(d => 80 / d.weight).strength(0.35))
    .force('charge', d3.forceManyBody().strength(-130))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collision', d3.forceCollide().radius(d => d.radius + 3))
    .force('x', d3.forceX(W / 2).strength(0.03))
    .force('y', d3.forceY(H / 2).strength(0.03))
    .on('tick', () => {
      if (currentView !== 'network') return;
      // SVG nodes
      node.attr('transform', d => `translate(${d.x},${d.y})`);
      // Canvas edges (they read x/y directly from node objects — just redraw)
      canvasEdges.draw();
    });

  // Update modules
  stats.update({ nodes, edges });
  arch.update(currentTitle);

  document.getElementById('info').textContent =
    `${nodes.length} anotaciones · ${edges.length} co-ocurrencias · click en un nodo para ver su nota`;
  applyFilters();
}

function fitToView(dur) {
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
  const x0 = d3.min(xs), x1 = d3.max(xs), y0 = d3.min(ys), y1 = d3.max(ys);
  const p = 60, s = Math.min((W - 2 * p) / (x1 - x0), (H - 2 * p) / (y1 - y0), 1.4);
  svg.transition().duration(dur).call(
    zoom.transform,
    d3.zoomIdentity.translate(W / 2, H / 2).scale(s).translate(-(x0 + x1) / 2, -(y0 + y1) / 2)
  );
}

// -- Event Listeners
document.getElementById('btnMacro').addEventListener('click', showMacroView);
document.getElementById('btn3D').addEventListener('click', showThreeView);

document.getElementById('chapterSelect').addEventListener('change', async function () {
    hideMacroView();
    hideThreeView();
    const num = parseInt(this.value, 10);
  const title = CHAPTER_TITLES[num];
  this.disabled = true;
  document.getElementById('info').textContent = `Loading ${title}…`;
  try {
    const res = await fetch(`ch${num}_graph.json`);
    const data = await res.json();
    currentTitle = title;
    document.getElementById('chapterTitle').textContent = title;
    svg.call(zoom.transform, d3.zoomIdentity);
    loadGraph(data);
  } catch (e) {
    document.getElementById('info').textContent = `Error loading chapter ${num}`;
  } finally {
    this.disabled = false;
  }
});

document.getElementById('btnNetwork').addEventListener('click', () => {
    hideMacroView();
    hideThreeView();
    currentView = 'network';
    document.getElementById('btnNetwork').classList.add('active');
    document.getElementById('btnTimeline').classList.remove('active');
    gRoot.selectAll('.tl-deco').remove();
    canvasEdges.setVisible(true);
    labels.attr('x', d => d.radius + 3).attr('y', 3);
    sim.alpha(0.4).restart();
});

document.getElementById('btnTimeline').addEventListener('click', () => {
    hideMacroView();
    hideThreeView();
    currentView = 'timeline';
    document.getElementById('btnTimeline').classList.add('active');
    document.getElementById('btnNetwork').classList.remove('active');
    sim.stop();

    // Hide canvas edges in timeline view (no positional meaning)
    canvasEdges.setVisible(false);

    const pad = { top: 48, right: 30, bottom: 32, left: 116 };
    const innerW = W - pad.left - pad.right;
    const innerH = H - pad.top - pad.bottom;
    const rowH = innerH / TAG_ORDER.length;

    const xScale = d3.scaleLinear().domain([0, nodes.length - 1]).range([0, innerW]);
    const yMid = {};
    const tagColors = {};
    nodes.forEach(n => { tagColors[n.tag] = n.color; });
    TAG_ORDER.forEach((tag, i) => { yMid[tag] = pad.top + rowH * i + rowH / 2; });

    gRoot.selectAll('.tl-deco').remove();
    const deco = gRoot.insert('g', ':first-child')
        .attr('class', 'tl-deco')
        .style('pointer-events', 'none');

    TAG_ORDER.forEach((tag, i) => {
        deco.append('rect')
            .attr('x', pad.left).attr('y', pad.top + rowH * i)
            .attr('width', innerW).attr('height', rowH)
            .attr('fill', tagColors[tag] || '#444').attr('opacity', 0.04);
        deco.append('text').attr('class', 'tag-row-label')
            .attr('x', pad.left - 8).attr('y', yMid[tag] + 4)
            .attr('text-anchor', 'end').style('fill', tagColors[tag] || '#666').text(tag);
    });

    const buckets = {};
    nodes.forEach(n => {
        n.tx = pad.left + xScale(n.order);
        const bx = Math.round(n.tx);
        const key = `${n.tag}|${bx}`;
        buckets[key] = (buckets[key] || 0);
        n.ty = yMid[n.tag] + (buckets[key] % 2 === 0 ? 1 : -1) * Math.floor(buckets[key] / 2) * (n.radius * 2 + 1);
        buckets[key]++;
    });

    labels.attr('x', 0).attr('y', d => -(d.radius + 3));
    gNodes.selectAll('g.node')
        .transition().duration(650).ease(d3.easeCubicInOut)
        .attr('transform', d => `translate(${d.tx},${d.ty})`);
});

document.getElementById('showLabels').addEventListener('change', function () {
  labels.style('display', this.checked ? null : 'none');
});

svg.on('click', deselect);

window.addEventListener('resize', () => {
  W = mainEl.clientWidth; H = mainEl.clientHeight;
  if (currentView === 'network') {
    sim.force('center', d3.forceCenter(W / 2, H / 2))
       .force('x', d3.forceX(W / 2).strength(0.03))
       .force('y', d3.forceY(H / 2).strength(0.03))
       .alpha(0.1).restart();
  }
});

// -- Legend Generation
const legendEl = document.getElementById('legend');
TAG_ORDER.forEach(tagName => {
  const item = document.createElement('div');
  item.className = 'legend-item';
  item.dataset.tag = tagName;
  item.innerHTML = `<div class="legend-dot" style="background:#666"></div>${tagName}`;
  item.addEventListener('click', () => {
    if (activeFilters.has(tagName)) activeFilters.delete(tagName);
    else activeFilters.add(tagName);
    applyFilters();
  });
  legendEl.appendChild(item);
});

// -- Initial Data Load
(async function init() {
    try {
        const res = await fetch('ch1_graph.json');
        const data = await res.json();
        // Update legend colors once we have node data
        document.querySelectorAll('.legend-item').forEach(item => {
            const tag = item.dataset.tag;
            const nodeWithTag = data.nodes.find(n => n.tag === tag);
            if (nodeWithTag) item.querySelector('.legend-dot').style.background = nodeWithTag.color;
        });
        loadGraph(data);
    } catch(e) { console.error("Init Error:", e); }
})();
