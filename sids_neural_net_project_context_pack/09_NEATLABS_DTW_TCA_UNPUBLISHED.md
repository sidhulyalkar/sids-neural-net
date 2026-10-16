# Project Context: NEATLABs Unpublished DTW and Tensor Component Analysis Work

## Node Metadata

- **Node type:** research project / unpublished analysis
- **Primary cluster:** Neural Signal Discovery
- **Organization:** NEATLABs / UCSD
- **Importance:** 95
- **Visibility:** Research View, Full Brain View

## One-liner

Applied Stanford dynamic time warping algorithms and Tensor Component Analysis to multi-terabyte LFP datasets, identifying precise temporal neural patterns consistent with patterns discovered in published studies.

## Narrative

This project deserves its own deep-dive node because it shows Sid working beyond standard pipelines: adapting advanced algorithms to massive neural datasets, running parallel computation, and discovering patterns in high-dimensional LFP activity.

The key story is not only “I ran an algorithm.” It is: Sid connected computational methods to biological structure by applying DTW/TCA to billions of LFP datapoints, finding convergent temporal patterns that aligned with findings from other studies.

## Data Scale

- Approximately 3 billion+ LFP datapoints for DTW analysis.
- Multi-terabyte LFP datasets, approximately 3TB+ for the specific DTW/TCA-style unpublished work and 8TB+ across broader NEATLABs analyses.
- Computation on UCSD/SDSC supercomputing resources and parallel computing workflows.

## Algorithms

- Dynamic Time Warping, based on Stanford/Williams et al.-style temporal alignment methods.
- Tensor Component Analysis for decomposing trial/time/channel/condition structure.
- Parallel MATLAB / Jupyter workflows.
- EEGLAB-style processing.
- Event-aligned LFP analysis.

## Scientific Goal

Identify precise temporal patterns in neural activity across behaviorally relevant events and conditions, especially in tasks involving reward learning, inhibition, decision-making, and TBI-related network alterations.

## Suggested Website Copy

Sid adapted advanced temporal alignment and tensor decomposition methods to massive LFP datasets, using supercomputing and parallel analysis workflows to detect precise neural patterns that converged with findings from the lab’s published studies.

## Suggested Visualization

A tensor cube:
`Trials × Time × Electrodes × Frequency/Condition`

Then a DTW alignment ribbon showing warped neural trajectories aligning across trials or animals.

## Neural Net Connections

- Dynamic Time Warping
- Tensor Component Analysis
- LFP
- SDSC
- Parallel Computing
- MATLAB
- Jupyter
- EEGLAB
- NEATLABs
- Reward Learning
- TBI
- Beta Oscillations
- Delta Activity
