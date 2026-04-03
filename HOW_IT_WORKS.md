# Joyce Project — Visualization: How It Works

**Chapter 1 (Telemachus) · 168 annotations · 141 connections**

---

## What is a node?

Each **node** represents one annotation from the Joyce Project — a specific word, phrase, name, or reference in the chapter text that the editors chose to annotate. Examples: *Buck Mulligan*, *Thalatta!*, *Stairhead*, *Archangel Michael*.

The node's **title** is the Joyce Project's name for that annotation (fetched from the `/api/notes/` endpoint).

---

## What is an edge (connection)?

Two nodes are connected if their annotated phrases appear **in the same paragraph** of the chapter text.

This co-occurrence logic reflects proximity in Joyce's prose: when two references share a paragraph, Joyce placed them together — intentionally or not. The more times two nodes share a paragraph across the text, the **stronger** their edge (thicker line).

---

## Node size

The **radius** of a node is proportional to its **degree** — the total number of co-occurrence connections it has with other nodes.

A larger node appears in more paragraphs alongside other annotated material. It is a more "connected" or structurally central reference in the chapter.

Scale: `radius = √(degree)`, ranging from 4px (isolated) to 16px (most connected).

---

## Node color (categories)

Colors come directly from the Joyce Project's tagging system. Each annotation belongs to one of six thematic categories:

| Color | Category | What it covers |
|---|---|---|
| Blue `#307EE3` | **The Writer** | Joyce himself, the act of writing, literary technique |
| Red `#CF2929` | **The Body** | Physical sensation, illness, death, the corporeal |
| Brown `#9C632A` | **Dublin** | Places, geography, local institutions |
| Orange `#F59627` | **Literature** | References to other works, authors, classical allusions |
| Green `#40B324` | **Ireland** | Irish identity, history, politics, nationalism |
| Purple `#AB59C2` | **Performances** | Theatre, ritual, ceremony, liturgy, music |

---

## Network view

A **force-directed graph** where:

- Nodes repel each other (prevents overlap)
- Connected nodes attract each other (edges act as springs)
- The layout is not fixed — it settles into an equilibrium that naturally clusters heavily-connected nodes together

**What to look for:** clusters of nodes that co-occur frequently reveal thematic or dramatic concentrations in the chapter. A node that bridges two clusters acts as a pivot between two themes.

---

## Timeline view

Nodes are arranged along two axes:

- **X axis (horizontal):** order of first appearance in the chapter text (left = first, right = last)
- **Y axis (vertical):** one row per category

This shows the **temporal rhythm** of the chapter: when each theme enters, whether some categories cluster at the beginning or end, and how themes interleave as the narrative progresses.

---

## Interactions

| Action | Result |
|---|---|
| **Hover** over a node | Highlights the node and all its direct neighbors; shows tooltip with connections |
| **Click** a node | Pins the selection (highlight stays after mouse moves away) |
| **Click** a pinned node or background | Deselects |
| **↗ Ver nota** (in pinned tooltip) | Opens the annotation's page on joyceproject.com |
| **Click a category** in the legend | Toggles that category on/off |
| **Scroll/pinch** | Zoom in/out |
| **Drag** canvas | Pan |
| **Drag** a node (Network) | Reposition that node; simulation adjusts |

---

## Data source

All data is fetched live from the [Joyce Project API](https://joyceproject.com):

- `/api/chapters/mU-kJZUBeQi-aLQfULNV` — full HTML of Chapter 1 with annotated spans
- `/api/notes/` — all 1000+ note titles and IDs
- `/api/tags/` — the six color categories

The graph is built by parsing the chapter HTML: each `<a data-type="annotation">` span contributes a node; paragraphs containing multiple annotations generate edges between them.

---

## Expanding to other chapters

The architecture supports all 18 chapters. Each chapter has a known ID:

| # | Chapter | ID |
|---|---|---|
| 1 | Telemachus | `mU-kJZUBeQi-aLQfULNV` |
| 2 | Nestor | `mk-kJZUBeQi-aLQfULNV` |
| 3 | Proteus | `m0-kJZUBeQi-aLQfULNV` |
| … | … | … |

To add a chapter: fetch its content from `/api/chapters/{id}`, run the same parser, and either extend the current graph or build a chapter-selector UI.
