export class ArchModule {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.render();
    this.active = false;
  }

  toggle() {
    this.active = !this.active;
    const overlay = this.container.querySelector('.arch-overlay');
    overlay.classList.toggle('active', this.active);
  }

  update(chapterTitle) {
    this.container.querySelector('#arch-chapter').textContent = chapterTitle;
    this.renderTriggers(chapterTitle);
  }

  renderTriggers(chapter) {
    const triggers = this.getTriggers(chapter);
    const grid = this.container.querySelector('.arch-grid');
    grid.innerHTML = triggers.map(t => `
      <div class="arch-card">
        <h4>${t.concept}</h4>
        <p>${t.description}</p>
        <div style="margin-top:15px; font-size:0.7rem; color:#666; font-family:monospace;">
          TRIGGER: ${t.trigger}
        </div>
      </div>
    `).join('');
  }

  getTriggers(chapter) {
    // Phenomenological triggers for a Ferry Terminal based on Ulysses
    const baseTriggers = [
      {
        concept: "Ineluctable Modality",
        trigger: "Light & Sight",
        description: "The terminal as a lens. Transitions between the dark interior and the blinding reflection of the Liffey. Using glass and apertures to frame the 'visible' as a series of shifting modalities."
      },
      {
        concept: "Threshold / Omphalos",
        trigger: "The Waiting Room",
        description: "The waiting area as a navel, a point of stillness in a journey. Architecture that centers the passenger before the transition to the vessel."
      },
      {
        concept: "Fluidity of Motion",
        trigger: "Flow Systems",
        description: "Circulation influenced by the tides. Non-linear, rhythmic paths that mimic the movement of the Proteus chapter. The walking pace as a design metric."
      },
      {
        concept: "Sensory Echoes",
        trigger: "Acoustics",
        description: "Capturing the 'two strong shrill whistles'. The terminal as a sound box that amplifies the industrial and maritime noises of the Dublin port into a rhythmic background."
      }
    ];

    if (chapter === 'Proteus') {
      baseTriggers.push({
        concept: "The Shoreline Interface",
        trigger: "Water Interaction",
        description: "Designing the pier not as a hard edge, but as a shifting interface. Materials that change texture when wet, reflecting the 'sand and shell' of the prose."
      });
    }

    return baseTriggers;
  }

  render() {
    this.container.innerHTML = `
      <div class="arch-overlay">
        <button class="close-arch" id="close-arch-btn">Close Concept View</button>
        <div class="arch-header">
          <h3>Architectural Concept Triggers</h3>
          <p style="font-size:0.8rem; color:#888;">Dublin Ferry Terminal / Inspired by <span id="arch-chapter">...</span></p>
        </div>
        <div class="arch-grid"></div>
        <div style="margin-top:auto; font-size:0.65rem; color:#444; border-top:1px solid #222; padding-top:10px;">
          PHX-MODULE: MONO-CHROME BLUEPRINT MODE // ARCHITECTURAL PHENOMENOLOGY v1.0
        </div>
      </div>
    `;

    this.container.querySelector('#close-arch-btn').addEventListener('click', () => this.toggle());
  }
}
