# Neural Atlas: Storytelling & Copy Brief

This document is a design/copy brief, not direct implementation. Use it to guide final storytelling polish.

---

## Core Positioning

**Who is this for?**
- Recruiters evaluating technical talent
- Researchers seeking collaborators
- Founders/engineers exploring neuroscience-AI intersection
- Anyone curious about the person behind the work

**What should they think after visiting?**
> "This person builds serious neural/AI systems, but also has unusually strong creative taste."

**What should they feel?**
- Impressed by technical depth
- Intrigued by the interface itself
- Confident they can find what they need
- A sense of discovery and exploration

---

## Hero Copy Options

### Option A: Direct & Technical
```
Sidharth Hulyalkar
Applied AI scientist/engineer building neural data systems,
multimodal ML infrastructure, and strange useful interfaces.
```

### Option B: Evocative
```
Sidharth Hulyalkar
Building the infrastructure where neurons meet neural networks.
Neuroscience data systems. Multimodal ML. Real-time perception.
```

### Option C: Minimal
```
Sidharth Hulyalkar
Neural Systems / Applied AI / Infrastructure
```

### Option D: Question Hook
```
Sidharth Hulyalkar
What happens when neuroscience meets machine learning infrastructure?
```

**Recommendation**: Option A or B. Option A is clearer for recruiters. Option B is more memorable.

---

## Category Label Options

| Current | Option A (Technical) | Option B (Metaphorical) | Option C (Hybrid) |
|---------|---------------------|------------------------|-------------------|
| About | About | Signal Origin | Origin Signal |
| Professional Work | Field Systems | Field Work | Field Systems |
| Projects | Build Archive | Build Log | Code Archive |
| Publications | Literature Trace | Paper Chambers | Publications |
| Research Ideas | Research Agenda | Future Circuits | Research Ideas |
| Personal Interests | Personal | Field Inputs | Personal Interests |
| Photography | Visual Archive | Visual Field Notes | Photography |
| Contact | Contact | Signal Output | Contact |

**Recommendation**: Use Column C (Hybrid) - keeps clarity while adding character.

---

## Category Preview Copy

Brief summaries shown when hovering a category.

### About / Origin Signal
> "Applied AI scientist/engineer specializing in neuroscience data infrastructure, multimodal ML systems, and real-time neural interfaces."

### Field Systems (Professional Work)
> "Research infrastructure deployed at Harvard, Allen Institute, and neuroscience labs worldwide. Data pipelines that power real science."

### Code Archive (Projects)
> "Open-source tools, experimental systems, and engineering artifacts. From BCI classifiers to neural foundation model frameworks."

### Literature Trace (Publications)
> "Peer-reviewed work on neural behavior, electrophysiology, and computational methods. Contributions to neuroscience and ML research."

### Future Circuits (Research Ideas)
> "Where I'm heading: brain foundation models, mechanistic interpretability for neural data, session stitching, and closed-loop systems."

### Field Inputs (Personal Interests)
> "Mountain biking, skiing, hiking, Shasta. The inputs that shape perception and keep the system calibrated."

### Visual Field Notes (Photography)
> "Landscape, texture, timing. Training attention through the lens."

### Contact
> "Research conversations, collaboration, applied AI opportunities. Let's build something."

---

## Microcopy Set

Subtle interface language that reinforces the neural metaphor without being heavy-handed.

### Navigation Actions
- "Follow signal" - select a category
- "Return to cortex" - back to overview
- "Open chamber" - view leaf detail
- "Close chamber" - dismiss detail panel
- "Related synapses" - show related nodes

### State Indicators
- "Signal propagating..." - during transition
- "Arriving at [category]..." - during camera travel
- "Reading [node title]" - detail open state

### Prompts
- "Click a neuron to explore"
- "Scroll to navigate the space"
- "Press Escape to return"

### Archive Route
- "Full Neural Graph Archive" - title
- "The complete graph of all connections" - subtitle
- "Return to Atlas" - back link

**Usage Guidelines**:
- Use sparingly - not every button needs a neural metaphor
- Standard actions can use standard labels (Close, Back, View)
- Reserve metaphorical copy for key moments (first load, transitions)

---

## Recruiter / Researcher Clarity Guardrails

The atlas should be striking, but visitors must still quickly find:

### Must Be Findable in < 10 Seconds
- Name and role
- Main work categories
- How to navigate

### Must Be Findable in < 30 Seconds
- Projects with GitHub links
- Publications with DOIs
- Contact information
- Professional background summary

### Quick-Access Paths
- Hero copy includes quick links to Projects, Publications, Contact
- Command palette (Cmd+K) for direct navigation
- Breadcrumbs always visible during navigation
- "About" category provides resume-like summary

### Don't Hide These Behind Exploration
- GitHub link
- LinkedIn link
- Email or contact form
- Key project highlights
- Publication list

---

## Tone Rules

### Do
- Be precise about technical work
- Use confident, active voice
- Allow subtle poetry without being pretentious
- Let the interface speak for itself
- Keep copy brief - this is a visual experience

### Don't
- Use generic portfolio language ("passionate about", "driven to")
- Over-explain the metaphor ("like neurons in a brain")
- Make every element neural-themed (it becomes tiresome)
- Use jargon without purpose
- Be self-deprecating or overly humble
- Add emojis or casual web speak

### Examples

**Bad**: "I'm super passionate about building cool AI stuff!"
**Good**: "Building neural data infrastructure for research labs."

**Bad**: "Welcome to my brain-inspired portfolio experience!"
**Good**: [No explanation needed - the interface shows it]

**Bad**: "Click on the glowing neurons to explore my amazing projects."
**Good**: "Click a neuron to explore"

---

## First 10 Seconds Experience

The initial impression is critical. In the first 10 seconds, the visitor should:

1. See the name clearly
2. Understand this is a portfolio/professional site
3. Recognize the categories as navigation
4. Feel invited to explore (not overwhelmed)
5. Notice the technical craft without being distracted by it

### Sequence
1. **0-2s**: Scene fades in, central neurons appear
2. **2-4s**: Name and role visible in overlay
3. **4-6s**: Dendrites draw in, categories settle
4. **6-10s**: Interaction is obvious, user can click

### What to Avoid
- Long loading states
- Text-heavy splash screens
- Auto-playing animations that delay interaction
- Tutorial overlays before the user can see anything
- Audio (never auto-play audio)

---

## Implementation Notes

This brief does not require code changes. It's a reference for:
- Prompt 15 (Final Storytelling Polish)
- Any copy updates during polish passes
- Design reviews and consistency checks

When implementing, prefer:
- Editing strings in overlay components
- Updating atlasDataAdapter category descriptions
- Refining panel copy in LeafDetailPanel

Do not:
- Add new components just for copy
- Create complex copy management systems
- Over-engineer localization (English only for now)
