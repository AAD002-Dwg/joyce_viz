export class MacroDashboard {
    constructor(containerId, onChapterClick) {
        this.container = document.getElementById(containerId);
        this.onChapterClick = onChapterClick;
        this.data = [];
        this.filteredChapters = new Set(Array.from({ length: 18 }, (_, i) => i + 1));
        this.tags = ['The Writer', 'The Body', 'Dublin', 'Literature', 'Ireland', 'Performances'];
        this.tagColors = {
            'The Writer': '#307EE3',
            'The Body': '#CF2929',
            'Dublin': '#9C632A',
            'Literature': '#F59627',
            'Ireland': '#40B324',
            'Performances': '#AB59C2'
        };
        this.loading = false;
    }

    async init() {
        if (this.data.length > 0) return;
        this.loading = true;
        this.renderLoading(0);

        try {
            // Sequential lazy load with per-chapter progress —
            // avoids firing 18 concurrent fetches (some JSONs are 400+ KB).
            for (let i = 0; i < 18; i++) {
                const progress = Math.round((i / 18) * 100);
                this.renderLoading(progress);

                const r = await fetch(`ch${i + 1}_graph.json`);
                const d = await r.json();

                const counts = { chapter: i + 1 };
                this.tags.forEach(t => {
                    counts[t] = d.nodes.filter(n => n.tag === t).length;
                });
                this.data.push(counts);
            }

            this.loading = false;
            this.render();
        } catch (e) {
            console.error("Macro Init Error:", e);
            this.container.innerHTML = `<div style="color:red; padding:20px;">Error loading symphony data. Please try again.</div>`;
        }
    }

    renderLoading(progress = 0) {
        const filled = Math.round(progress);
        this.container.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#666;">
                <p style="margin-bottom:20px; font-style:italic;">Composing the Symphony of Ulysses...</p>
                <div style="width:260px; background:#1a1a26; border-radius:4px; overflow:hidden; border:1px solid #2a2a3a;">
                    <div style="height:4px; background:#6080c0; width:${filled}%; transition:width 0.3s ease;"></div>
                </div>
                <p style="font-size:0.7rem; margin-top:12px; font-family:monospace; color:#3a3a5a;">Chapter ${Math.ceil(progress / (100/18)) || 1} / 18</p>
            </div>
        `;
    }

    toggleChapter(num) {
        if (this.filteredChapters.has(num)) {
            if (this.filteredChapters.size > 1) this.filteredChapters.delete(num);
        } else {
            this.filteredChapters.add(num);
        }
        this.render();
    }

    render() {
        if (this.loading) return;

        const activeData = this.data.filter(d => this.filteredChapters.has(d.chapter));

        this.container.innerHTML = `
            <div class="macro-header">
                <h2>Sinfonía de Ulises: Evolución Temática</h2>
                <div class="chapter-filters">
                    ${Array.from({ length: 18 }, (_, i) => i + 1).map(n => `
                        <div class="chap-filter ${this.filteredChapters.has(n) ? 'active' : ''}" 
                             onclick="window.macro.toggleChapter(${n})">
                            CAP. ${n}
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="macro-viz" id="macro-viz">
                <div id="macro-tooltip" class="macro-tooltip" style="display:none;"></div>
            </div>
        `;

        // Attach global reference for onclick handlers
        window.macro = this;

        this.renderChart(activeData);
    }

    renderChart(data) {
        const viz = document.getElementById('macro-viz');
        const width = viz.clientWidth;
        const height = viz.clientHeight;

        const svg = d3.select(viz).append('svg')
            .attr('viewBox', [0, 0, width, height]);

        const margin = { top: 20, right: 30, bottom: 40, left: 50 };
        const innerW = width - margin.left - margin.right;
        const innerH = height - margin.top - margin.bottom;

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Scales
        const x = d3.scalePoint()
            .domain(data.map(d => d.chapter))
            .range([0, innerW])
            .padding(0.5);

        const stack = d3.stack()
            .keys(this.tags)
            .offset(d3.stackOffsetWiggle)
            .order(d3.stackOrderNone);

        const series = stack(data);

        const y = d3.scaleLinear()
            .domain([
                d3.min(series, s => d3.min(s, d => d[0])),
                d3.max(series, s => d3.max(s, d => d[1]))
            ])
            .range([innerH, 0]);

        const area = d3.area()
            .x(d => x(d.data.chapter))
            .y0(d => y(d[0]))
            .y1(d => y(d[1]))
            .curve(d3.curveBasis);

        // Tooltip
        const tip = d3.select('#macro-tooltip');

        // Draw areas
        g.selectAll('.macro-area')
            .data(series)
            .join('path')
            .attr('class', 'macro-area')
            .attr('fill', d => this.tagColors[d.key])
            .attr('d', area)
            .on('mouseover', function(event, d) {
                d3.select(this).style('fill-opacity', 1);
                tip.style('display', 'block')
                   .html(`<strong>${d.key}</strong><br/>Thematic weight in this section`);
            })
            .on('mousemove', function(event) {
                tip.style('left', (event.offsetX + 15) + 'px')
                   .style('top', (event.offsetY - 10) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this).style('fill-opacity', 0.6);
                tip.style('display', 'none');
            });

        // X Axis
        g.append('g')
            .attr('class', 'macro-axis')
            .attr('transform', `translate(0,${innerH + 10})`)
            .call(d3.axisBottom(x).tickFormat(d => `Cap. ${d}`));

        // Chapter vertical lines & click zones
        const chapterGroups = g.selectAll('.chap-interaction')
            .data(data)
            .join('g')
            .attr('class', 'chap-interaction')
            .style('cursor', 'pointer');

        chapterGroups.append('line')
            .attr('x1', d => x(d.chapter))
            .attr('x2', d => x(d.chapter))
            .attr('y1', 0)
            .attr('y2', innerH)
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1)
            .attr('stroke-opacity', 0.05);

        // Invisible click box for chapter selection
        const boxW = innerW / data.length;
        chapterGroups.append('rect')
            .attr('x', d => x(d.chapter) - boxW/2)
            .attr('y', 0)
            .attr('width', boxW)
            .attr('height', innerH)
            .attr('fill', 'transparent')
            .on('mouseover', function() {
                d3.select(this.parentNode).select('line').attr('stroke-opacity', 0.3);
            })
            .on('mouseout', function() {
                d3.select(this.parentNode).select('line').attr('stroke-opacity', 0.05);
            })
            .on('click', (event, d) => {
                this.onChapterClick(d.chapter);
            });
            
        chapterGroups.append('text')
            .attr('x', d => x(d.chapter))
            .attr('y', innerH + 25)
            .attr('text-anchor', 'middle')
            .attr('fill', '#444')
            .style('font-size', '8px')
            .text(d => `SELECT`);
    }
}
