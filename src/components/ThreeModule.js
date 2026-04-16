/**
 * ThreeModule.js
 *
 * Renders the Joyce annotation graph as a stratified 3D space.
 *
 * Visual encoding:
 *   Z-axis   → Thematic layer (abstract/intellectual at top, physical/spatial at bottom)
 *   Shape    → Semantic geometry per category
 *   Size     → Degree (number of weighted connections)
 *   Color    → Category color (consistent with the 2D views)
 *   Edges    → Translucent lines + flowing particles on strong co-occurrences
 *   Planes   → Subtle ghost planes delineating each thematic floor
 *   Labels   → Canvas sprites floating at the edge of each Z-layer
 */

import ForceGraph3D from '3d-force-graph';
import * as THREE from 'three';

// ── Thematic stratification ──
// Abstract, intellectual themes float at top (+Z)
// Physical, geographical themes sink to bottom (-Z)
const Z_PLANES = {
  'The Writer':   280,    // The act of writing — most abstract
  'Literature':   168,    // Cultural references — ideas
  'Performances':  56,    // Ritual, ceremony — between idea and act
  'Ireland':      -56,    // National identity — historical ground
  'Dublin':      -168,    // Geography, places — physical city
  'The Body':    -280,    // The corporeal — lowest stratum
};

const Z_DESCRIPTIONS = {
  'The Writer':   'Joyce · el acto de escribir',
  'Literature':   'Referencias · alegorías · autores',
  'Performances': 'Teatro · ritual · ceremonia · música',
  'Ireland':      'Identidad irlandesa · historia · política',
  'Dublin':       'Lugares · geografía · instituciones',
  'The Body':     'Lo corporal · enfermedad · la muerte',
};

const TAG_COLORS = {
  'The Writer':   '#307EE3',
  'The Body':     '#CF2929',
  'Dublin':       '#9C632A',
  'Literature':   '#F59627',
  'Ireland':      '#40B324',
  'Performances': '#AB59C2',
};

// ── Semantic geometries ──
const GEOM_SYMBOLS = {
  'The Writer':   '⬡',  // icosahedron — complex, self-referential
  'The Body':     '●',  // sphere — organic, pulsing
  'Dublin':       '◼',  // box — architectural, rigid
  'Literature':   '◎',  // torus — circular reference, citation loop
  'Ireland':      '⬬',  // cylinder — column, monument, identity pillar
  'Performances': '◆',  // octahedron — multiple faces, ritual geometry
};

function buildGeometry(tag, size) {
  const s = size / 7;
  switch (tag) {
    case 'The Writer':   return new THREE.IcosahedronGeometry(s * 1.2, 0);
    case 'The Body':     return new THREE.SphereGeometry(s, 14, 10);
    case 'Dublin':       return new THREE.BoxGeometry(s * 1.8, s * 1.8, s * 1.8);
    case 'Literature':   return new THREE.TorusGeometry(s * 0.9, s * 0.35, 8, 14);
    case 'Ireland':      return new THREE.CylinderGeometry(s * 0.6, s * 0.85, s * 2, 8);
    case 'Performances': return new THREE.OctahedronGeometry(s * 1.3, 0);
    default:             return new THREE.SphereGeometry(s, 10, 8);
  }
}

// ── Main class ─────────────────────────────────────────────────────────────────

export class ThreeModule {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.graph = null;
    this._animatedMeshes = [];   // [{mesh, tag, phase}]
    this._raf = null;
    this._nodesById = {};
    this._currentData = null;
    this._paused = false;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  static supportsWebGL() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }

  /** Load or reload with new chapter data */
  load(graphData, chapterTitle = '') {
    this._currentData = graphData;
    this._destroy3D();
    this.container.innerHTML = '';
    this._animatedMeshes = [];

    if (!ThreeModule.supportsWebGL()) {
      this._renderFallback();
      return;
    }

    this._buildOverlay(chapterTitle);
    this._buildGraph(graphData);
  }

  pause() {
    this._paused = true;
    this.graph?.pauseAnimation();
    cancelAnimationFrame(this._raf);
  }

  resume() {
    this._paused = false;
    this.graph?.resumeAnimation();
    if (this._animatedMeshes.length > 0) this._startAnimLoop();
  }

  // ── Private: Graph construction ─────────────────────────────────────────────

  _buildGraph(graphData) {
    const { nodes, edges } = graphData;

    // Weighted degree for node sizing
    const deg = {};
    edges.forEach(e => {
      deg[e.source] = (deg[e.source] || 0) + e.weight;
      deg[e.target] = (deg[e.target] || 0) + e.weight;
    });
    const maxDeg = Math.max(...Object.values(deg), 1);

    const gNodes = nodes.map(n => ({
      ...n,
      degree: deg[n.id] || 0,
      _size: 2.5 + ((deg[n.id] || 0) / maxDeg) * 11,
    }));

    this._nodesById = {};
    gNodes.forEach(n => { this._nodesById[n.id] = n; });

    // Inner container for the Three.js canvas
    const inner = document.createElement('div');
    inner.id = 'three-graph-inner';
    this.container.appendChild(inner);

    this.graph = ForceGraph3D({ controlType: 'orbit', rendererConfig: { antialias: true } })(inner)
      .backgroundColor('#0e0e12')
      .graphData({ nodes: gNodes, links: edges.map(e => ({ ...e })) })

      // Nodes
      .nodeLabel(n => this._buildTooltipHTML(n))
      .nodeThreeObject(n => this._buildNodeMesh(n))
      .nodeThreeObjectExtend(false)
      .onNodeClick(n => this._onNodeClick(n))

      // Edges
      .linkColor(l => {
        const s = this._nodesById[l.source?.id ?? l.source];
        return s ? s.color + '18' : '#ffffff18';
      })
      .linkWidth(l => Math.sqrt(l.weight || 1) * 0.35)
      .linkOpacity(1)
      // Flowing particles only on direct, heavier connections
      .linkDirectionalParticles(l => l.type !== 'extended' && l.weight >= 1.5 ? Math.ceil(l.weight / 1.5) : 0)
      .linkDirectionalParticleWidth(l => Math.sqrt(l.weight || 1) * 0.5)
      .linkDirectionalParticleColor(l => {
        const s = this._nodesById[l.source?.id ?? l.source];
        return s ? s.color + 'cc' : '#ffffffcc';
      })
      .linkDirectionalParticleSpeed(0.004)

      // Simulation
      .warmupTicks(100)
      .cooldownTicks(Infinity)
      .onBackgroundClick(() => this._clearSelection());

    // ── Z-stratification force ──
    // Must be added AFTER graph() and BEFORE/AFTER graphData() —
    // calling d3ReheatSimulation ensures it takes effect.
    this.graph.d3Force('z', this._makeZForce());
    this.graph.d3Force('link').distance(l => 60 / (l.weight || 1)).strength(0.3);
    this.graph.d3Force('charge').strength(-90);

    // Initial camera position: slight elevation to show depth
    this.graph.cameraPosition({ x: 0, y: 80, z: 600 }, { x: 0, y: 0, z: 0 }, 0);

    this._addSceneLights();
    this._addZPlaneHelpers();
    this._addZPlaneLabels();
    this._bindCameraPresets();

    this._startAnimLoop();
  }

  _makeZForce() {
    let _nodes = [];
    const force = (alpha) => {
      _nodes.forEach(n => {
        const targetZ = Z_PLANES[n.tag] ?? 0;
        n.vz = ((n.vz || 0) + (targetZ - (n.z || 0)) * 0.09 * alpha);
      });
    };
    force.initialize = (nodes) => { _nodes = nodes; };
    return force;
  }

  _buildNodeMesh(n) {
    const geom = buildGeometry(n.tag, n._size);
    const color = new THREE.Color(n.color);

    const mat = new THREE.MeshPhongMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.18,
      shininess: 70,
      transparent: true,
      opacity: 0.92,
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.userData = { tag: n.tag, nodeId: n.id };
    // Random phase so nodes don't all pulse in sync
    this._animatedMeshes.push({ mesh, tag: n.tag, phase: Math.random() * Math.PI * 2 });
    return mesh;
  }

  // ── Private: Scene extras ────────────────────────────────────────────────────

  _addSceneLights() {
    const scene = this.graph.scene();
    if (!scene) return;

    // Cool fill from upper-right
    const fillLight = new THREE.PointLight('#4070c0', 1.0, 2000);
    fillLight.position.set(500, 600, 300);
    scene.add(fillLight);

    // Warm rim from below-left
    const rimLight = new THREE.PointLight('#c05030', 0.5, 2000);
    rimLight.position.set(-500, -400, -400);
    scene.add(rimLight);
  }

  _addZPlaneHelpers() {
    const scene = this.graph.scene();
    if (!scene) return;

    // Category colors for plane tint
    Object.entries(Z_PLANES).forEach(([tag, z]) => {
      const color = new THREE.Color(TAG_COLORS[tag] || '#ffffff');

      // Ghost horizontal plane
      const planeGeom = new THREE.PlaneGeometry(1400, 1400, 1, 1);
      const planeMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.012,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const plane = new THREE.Mesh(planeGeom, planeMat);
      plane.position.set(0, 0, z);
      scene.add(plane);

      // Glowing edge ring (thin torus in XY plane at this Z)
      const ringGeom = new THREE.TorusGeometry(500, 0.5, 4, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.18,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.set(0, 0, z);
      scene.add(ring);
    });
  }

  _addZPlaneLabels() {
    const scene = this.graph.scene();
    if (!scene) return;

    Object.entries(Z_PLANES).forEach(([tag, z]) => {
      const color = TAG_COLORS[tag] || '#888';

      // Canvas sprite for tag label
      const canvas = document.createElement('canvas');
      canvas.width = 640; canvas.height = 80;
      const ctx = canvas.getContext('2d');

      ctx.font = 'italic 30px Georgia, serif';
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.5;
      ctx.fillText(`${tag}`, 12, 52);

      // Z-label
      ctx.font = '22px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.2;
      const zStr = `Z ${z > 0 ? '+' : ''}${z}`;
      ctx.fillText(zStr, canvas.width - ctx.measureText(zStr).width - 12, 52);

      const tex = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(240, 30, 1);
      sprite.position.set(-580, 0, z);
      scene.add(sprite);
    });
  }

  // ── Private: Interactions ────────────────────────────────────────────────────

  _buildTooltipHTML(n) {
    return `
      <div style="
        background:rgba(18,18,28,0.97);
        border:1px solid ${n.color}55;
        border-left:3px solid ${n.color};
        padding:10px 14px;
        border-radius:5px;
        font-family:Georgia,serif;
        color:#e8e0d0;
        font-size:12px;
        max-width:220px;
        pointer-events:none;
        box-shadow:0 6px 24px rgba(0,0,0,0.7);
        line-height:1.5;
      ">
        <div style="font-weight:bold;color:${n.color};margin-bottom:3px;font-size:13px">${n.title}</div>
        <div style="font-size:9px;opacity:0.5;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px">${n.tag}</div>
        <div style="font-size:11px;color:#667">${n.degree} co-ocurrencias</div>
        ${n.snippet ? `<div style="font-size:10px;font-style:italic;color:#887;margin-top:5px;border-top:1px solid #2a2a3a;padding-top:5px">"${n.snippet.slice(0, 72)}${n.snippet.length > 72 ? '…' : ''}"</div>` : ''}
      </div>
    `;
  }

  _onNodeClick(n) {
    // Highlight clicked, fade others
    this._animatedMeshes.forEach(({ mesh }) => {
      if (mesh.userData.nodeId === n.id) {
        mesh.material.emissiveIntensity = 0.65;
        mesh.material.opacity = 1.0;
      } else {
        mesh.material.emissiveIntensity = 0.04;
        mesh.material.opacity = 0.15;
      }
    });

    // Open url on double click (same behavior as 2D)
    if (n.url) {
      n._lastClick = n._lastClick || 0;
      const now = Date.now();
      if (now - n._lastClick < 400) window.open(n.url, '_blank', 'noopener');
      n._lastClick = now;
    }
  }

  _clearSelection() {
    this._animatedMeshes.forEach(({ mesh }) => {
      mesh.material.emissiveIntensity = 0.18;
      mesh.material.opacity = 0.92;
    });
  }

  // ── Private: Animation loop ──────────────────────────────────────────────────

  _startAnimLoop() {
    const tick = (time) => {
      if (this._paused) return;
      this._raf = requestAnimationFrame(tick);
      const t = time * 0.001;

      this._animatedMeshes.forEach(({ mesh, tag, phase }) => {
        if (!mesh.parent) return;
        switch (tag) {
          case 'The Body':
            // Organic cellular pulsing
            const pulse = 1 + Math.sin(t * 1.7 + phase) * 0.14;
            mesh.scale.setScalar(pulse);
            break;
          case 'Performances':
            // Ritual multi-axis rotation
            mesh.rotation.y = t * 0.65 + phase;
            mesh.rotation.x = Math.sin(t * 0.37 + phase) * 0.4;
            break;
          case 'Literature':
            // Torus spin — circular reference
            mesh.rotation.x = t * 0.48 + phase;
            mesh.rotation.z = Math.sin(t * 0.22 + phase) * 0.55;
            break;
          case 'The Writer':
            // Slow contemplative rotation of the icosahedron
            mesh.rotation.y = t * 0.28 + phase;
            mesh.rotation.x = Math.sin(t * 0.14 + phase) * 0.12;
            break;
          case 'Ireland':
            // Cylinder pillar — very slow spin
            mesh.rotation.y = t * 0.16 + phase;
            break;
          // Dublin (boxes) stay static — architectural
        }
      });
    };
    this._raf = requestAnimationFrame(tick);
  }

  // ── Private: Overlay UI ──────────────────────────────────────────────────────

  _buildOverlay(chapterTitle) {
    const overlay = document.createElement('div');
    overlay.className = 'three-overlay';

    const layerItems = Object.entries(Z_PLANES)
      .map(([tag, z]) => `
        <div class="tll-item">
          <span class="tll-z">${z > 0 ? '+' : ''}${z}</span>
          <span class="tll-dot" style="background:${TAG_COLORS[tag]}"></span>
          <div class="tll-text">
            <span class="tll-name">${tag}</span>
            <span class="tll-desc">${Z_DESCRIPTIONS[tag]}</span>
          </div>
        </div>
      `).join('');

    const geomItems = Object.entries(GEOM_SYMBOLS)
      .map(([tag, sym]) => `
        <div class="tgl-item">
          <span class="tgl-sym" style="color:${TAG_COLORS[tag]}">${sym}</span>
          <span>${tag}</span>
        </div>
      `).join('');

    overlay.innerHTML = `
      <div class="three-chapter-badge">${chapterTitle}</div>

      <div class="three-camera-presets" id="three-presets">
        <button class="three-preset-btn" id="preset-oblique" title="Vista oblicua">⤢ 3D</button>
        <button class="three-preset-btn" id="preset-side"    title="Vista lateral — ver estratos">⊞ Lateral</button>
        <button class="three-preset-btn" id="preset-top"     title="Vista superior — como la red 2D">⊟ Superior</button>
      </div>

      <div class="three-layer-legend">
        <div class="tll-header">Estratos — Eje Z</div>
        ${layerItems}
      </div>

      <div class="three-geom-legend">
        <div class="tll-header">Geometrías semánticas</div>
        <div class="tgl-grid">${geomItems}</div>
      </div>

      <div class="three-hint">
        Arrastrá para rotar · Scroll para zoom · Click en nodo · Doble-click → Joyce Project
      </div>
    `;

    this.container.appendChild(overlay);
  }

  _bindCameraPresets() {
    const btn = (id, pos, target, dur = 1200) => {
      document.getElementById(id)?.addEventListener('click', () => {
        this.graph?.cameraPosition(pos, target, dur);
      });
    };

    btn('preset-oblique', { x: 0,    y: 80,   z: 680 }, { x: 0, y: 0, z: 0 });
    btn('preset-side',    { x: 680,  y: 0,    z: 0   }, { x: 0, y: 0, z: 0 });
    btn('preset-top',     { x: 0,    y: 680,  z: 0   }, { x: 0, y: 0, z: 0 });
  }

  // ── Private: Cleanup ─────────────────────────────────────────────────────────

  _destroy3D() {
    cancelAnimationFrame(this._raf);
    this._raf = null;
    if (this.graph) {
      this.graph.pauseAnimation();
      this.graph = null;
    }
    this._animatedMeshes = [];
  }

  _renderFallback() {
    this.container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;
                  height:100%;flex-direction:column;gap:14px;color:#555">
        <div style="font-size:2.5rem">🔮</div>
        <p style="font-size:1rem;color:#888">Vista 3D no disponible</p>
        <p style="font-size:0.75rem;color:#444;text-align:center">
          Tu navegador no soporta WebGL.<br/>Probá con Chrome, Firefox o Edge.
        </p>
      </div>
    `;
  }
}
