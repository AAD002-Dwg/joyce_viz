/**
 * CanvasEdges.js
 *
 * Draws graph edges on a <canvas> element instead of SVG <line> elements.
 * This bypasses the SVG DOM bottleneck for dense chapters (Ch.15 has 2000+ edges).
 *
 * Design: the canvas sits absolutely on top of the SVG, pixel-matched in size.
 * On each simulation tick, we clear the canvas and redraw all edges in one pass —
 * a single WebGL-style batch instead of mutating thousands of DOM attributes.
 *
 * The current D3 zoom transform is applied manually via canvas context transforms
 * so edges stay perfectly aligned with the SVG nodes.
 */
export class CanvasEdges {
  constructor(containerId) {
    this.container = document.getElementById(containerId);

    // Create and insert the canvas
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'edges-canvas';
    this.container.insertBefore(this.canvas, this.container.firstChild);

    this.ctx = this.canvas.getContext('2d');
    this.edges = [];
    this.transform = { k: 1, x: 0, y: 0 };   // current D3 zoom transform
    this._raf = null;
    this._highlightedEdges = new Set();         // source-target keys for highlighted
    this._fadedEdges = new Set();               // source-target keys for faded
    this._visible = true;

    this._resizeObserver = new ResizeObserver(() => this._syncSize());
    this._resizeObserver.observe(this.container);
    this._syncSize();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Load new edge data (called from loadGraph) */
  setEdges(edges) {
    this.edges = edges;
    this._highlightedEdges.clear();
    this._fadedEdges.clear();
  }

  /** Called every simulation tick with the current D3 zoom transform */
  setTransform(transform) {
    this.transform = transform;
  }

  /** Show or hide the canvas (e.g. during timeline view) */
  setVisible(v) {
    this._visible = v;
    this.canvas.style.display = v ? 'block' : 'none';
    if (v) this.draw();
  }

  /** 
   * Mark edges as highlighted or faded.
   * @param {string|null} pivotNodeId - node id that is hovered/selected, or null to reset
   * @param {Set} neighborSet - set of neighbor ids
   */
  applyHighlight(pivotNodeId, neighborSet) {
    this._highlightedEdges.clear();
    this._fadedEdges.clear();

    if (pivotNodeId !== null) {
      for (const e of this.edges) {
        const sid = e.source.id ?? e.source;
        const tid = e.target.id ?? e.target;
        const key = sid + '|||' + tid;
        if (sid === pivotNodeId || tid === pivotNodeId) {
          this._highlightedEdges.add(key);
        } else {
          this._fadedEdges.add(key);
        }
      }
    }

    this.draw();
  }

  /**
   * Apply category filter — fades edges where either endpoint tag is hidden.
   * @param {Set} activeFilters - set of active tag names
   * @param {Object} nodesById - id → node map
   */
  applyFilters(activeFilters, nodesById) {
    this._highlightedEdges.clear();
    this._fadedEdges.clear();

    if (activeFilters.size < 6) { // 6 = total categories
      for (const e of this.edges) {
        const sid = e.source.id ?? e.source;
        const tid = e.target.id ?? e.target;
        const s = nodesById[sid];
        const t = nodesById[tid];
        if (!activeFilters.has(s?.tag) || !activeFilters.has(t?.tag)) {
          this._fadedEdges.add(sid + '|||' + tid);
        }
      }
    }

    this.draw();
  }

  /** Clear all highlight / fade state */
  clearHighlight() {
    this._highlightedEdges.clear();
    this._fadedEdges.clear();
    this.draw();
  }

  /** Main draw call — batches all edges in one canvas pass */
  draw() {
    if (!this._visible) return;
    if (this._raf) return; // already queued

    this._raf = requestAnimationFrame(() => {
      this._raf = null;
      this._drawFrame();
    });
  }

  destroy() {
    this._resizeObserver.disconnect();
    cancelAnimationFrame(this._raf);
    this.canvas.remove();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _syncSize() {
    const { width, height } = this.container.getBoundingClientRect();
    // Use device pixel ratio for sharp rendering on HiDPI screens
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width  = width  * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width  = width  + 'px';
    this.canvas.style.height = height + 'px';
    this._dpr = dpr;
    this.draw();
  }

  _drawFrame() {
    const ctx = this.ctx;
    const { k, x, y } = this.transform;
    const dpr = this._dpr || 1;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply DPR scaling + D3 zoom transform
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(x, y);
    ctx.scale(k, k);

    // Render in 3 passes for correct layering:
    // 1. Extended (dashed, barely visible)
    // 2. Normal  (solid, low opacity)
    // 3. Highlighted (bright, solid)

    // Pass 1: extended edges (drawn below everything)
    for (const e of this.edges) {
      if (e.type !== 'extended') continue;
      const sid = e.source.id ?? e.source;
      const tid = e.target.id ?? e.target;
      const key = sid + '|||' + tid;
      if (this._highlightedEdges.has(key)) continue; // drawn in pass 3
      this._strokeEdge(ctx, e, this._fadedEdges.has(key) ? 'faded-ext' : 'extended');
    }

    // Pass 2: normal (direct) edges
    for (const e of this.edges) {
      if (e.type === 'extended') continue;
      const sid = e.source.id ?? e.source;
      const tid = e.target.id ?? e.target;
      const key = sid + '|||' + tid;
      if (this._highlightedEdges.has(key)) continue; // drawn in pass 3
      this._strokeEdge(ctx, e, this._fadedEdges.has(key) ? 'faded' : 'normal');
    }

    // Pass 3: highlighted on top
    for (const e of this.edges) {
      const sid = e.source.id ?? e.source;
      const tid = e.target.id ?? e.target;
      const key = sid + '|||' + tid;
      if (!this._highlightedEdges.has(key)) continue;
      this._strokeEdge(ctx, e, 'highlighted');
    }

    ctx.restore();
  }

  _strokeEdge(ctx, e, style) {
    const sx = e.source.x ?? 0, sy = e.source.y ?? 0;
    const tx = e.target.x ?? 0, ty = e.target.y ?? 0;
    const w = Math.sqrt(e.weight || 1);

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);

    switch (style) {
      case 'normal':
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = w;
        ctx.setLineDash([]);
        break;
      case 'extended':
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = w * 0.7;
        ctx.setLineDash([4 / (this.transform.k || 1), 4 / (this.transform.k || 1)]);
        break;
      case 'highlighted':
        ctx.strokeStyle = 'rgba(200,200,255,0.65)';
        ctx.lineWidth = Math.max(w, 1.5);
        ctx.setLineDash([]);
        break;
      case 'faded':
        ctx.strokeStyle = 'rgba(255,255,255,0.01)';
        ctx.lineWidth = w;
        ctx.setLineDash([]);
        break;
      case 'faded-ext':
        ctx.strokeStyle = 'rgba(255,255,255,0.005)';
        ctx.lineWidth = w * 0.5;
        ctx.setLineDash([]);
        break;
    }

    ctx.stroke();
  }
}
