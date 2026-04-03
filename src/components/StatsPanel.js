export class StatsPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.render();
  }

  update(params) {
    const { nodes, edges, tags } = params;

    // Calculate Stats
    const totalNodes = nodes.length;
    const totalEdges = edges.length;

    // Category Distribution
    const counts = {};
    nodes.forEach(n => { counts[n.tag] = (counts[n.tag] || 0) + 1; });
    const distHtml = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => {
        const percentage = Math.round((count / totalNodes) * 100);
        const color = nodes.find(n => n.tag === tag)?.color || '#666';
        return `
          <div class="stat-item">
            <span style="color:${color}">${tag}</span>
            <span class="stat-value">${percentage}%</span>
          </div>
        `;
      }).join('');

    // Hub Nodes (Highest degree)
    const deg = {};
    edges.forEach(e => {
        const sourceId = e.source.id || e.source;
        const targetId = e.target.id || e.target;
        deg[sourceId] = (deg[sourceId] || 0) + e.weight;
        deg[targetId] = (deg[targetId] || 0) + e.weight;
    });

    const hubNodes = nodes
      .map(n => ({ ...n, degree: deg[n.id] || 0 }))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 5);

    const hubsHtml = hubNodes.map(n => `
      <li class="hub-item" onclick="window.dispatchHighlight('${n.id}')">
        <span style="color:${n.color}">●</span> ${n.title}
        <span style="float:right; color:#666">${n.degree}</span>
      </li>
    `).join('');

    // Update parts of the UI
    this.container.querySelector('#stat-total-nodes').textContent = totalNodes;
    this.container.querySelector('#stat-total-edges').textContent = totalEdges;
    this.container.querySelector('#stat-distribution').innerHTML = distHtml;
    this.container.querySelector('#stat-hubs').innerHTML = hubsHtml;
  }

  render() {
    this.container.innerHTML = `
      <div class="stats-panel-content">
        <h2>General Stats</h2>
        <div class="stat-item">
          <span>Total Annotations</span>
          <span id="stat-total-nodes" class="stat-value">0</span>
        </div>
        <div class="stat-item">
          <span>Co-occurrences</span>
          <span id="stat-total-edges" class="stat-value">0</span>
        </div>

        <h2 style="margin-top:20px">Thematic Weight</h2>
        <div id="stat-distribution"></div>

        <h2 style="margin-top:20px">Central Concepts (Hubs)</h2>
        <ul id="stat-hubs" class="hub-list"></ul>
      </div>
    `;
  }
}
