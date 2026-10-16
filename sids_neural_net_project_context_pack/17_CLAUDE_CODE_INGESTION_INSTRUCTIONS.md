# Claude Code Ingestion Instructions for Project Context Pack

## Goal

Use this context pack to create rich content nodes inside Sid’s Neural Net.

## Implementation Steps

1. Create a folder:
   `content/context/`

2. Copy all markdown files in this pack into that folder.

3. Add a context loader:
   `lib/content/load-context-docs.ts`

4. Parse frontmatter if added later, otherwise infer metadata from filenames and headings.

5. Convert each context doc into:
   - one or more `NeuralNode` records
   - one `case-study` or `project` detail route where appropriate
   - multiple concept/skill/technology child nodes
   - edges linking organizations, technologies, and projects

6. Add a `manual-priority.yaml` file to ensure these private/non-public projects are not buried by GitHub ingestion.

## Required Priority Overrides

```yaml
datajoint-multimodal-infrastructure:
  importance: 100
  featured: true
  modeVisibility:
    - recruiter
    - research
    - full-brain

harvard-sabatini-datajoint-pipeline:
  importance: 100
  featured: true

neatlabs-core-research:
  importance: 100
  featured: true

neatlabs-dtw-tca-unpublished:
  importance: 95
  featured: true

lu-lab-deeplabcut-facemap:
  importance: 95
  featured: true

datajoint-elements-and-templates:
  importance: 95
  featured: true

spikeinterface-array-ephys:
  importance: 92
  featured: true

workflow-monitoring-system:
  importance: 90
  featured: true

neurosky-led-audio-visualization:
  importance: 82
  featured: false
  modeVisibility:
    - builder
    - personal
    - full-brain
```

## Display Rules

- Do not expose confidential customer details beyond what Sid provides.
- Mark private projects as `source: manual/private`.
- Use “selected internal work” or “client deployment” framing when exact implementation details cannot be public.
- Show high-level architecture, technologies, impact, and role clearly.
- Avoid pretending all work is public if it is not.
- For private projects, link to public adjacent repos, publications, or case-study summaries where possible.

## Suggested Site Section

Add a page:

`/context-map`

or integrate these into:

- `/neural-net`
- `/case-studies`
- `/projects`
- `/timeline`

## Important UX Note

In Recruiter View, prioritize:
1. DataJoint Multimodal Infrastructure
2. Harvard/Sabatini deployment
3. DataJoint Elements/Templates
4. NEATLABs Core Research
5. Publications
6. Panoptic Bio
7. neuroFMx / neurOS / mechanistic interpretability
8. Lu Lab DeepLabCut/Facemap
9. Workflow Monitoring System

In Full Brain View, include everything including NeuroSky LED/audio, Shasta, adventure, older biomedical ML projects, and personal creative experiments.
