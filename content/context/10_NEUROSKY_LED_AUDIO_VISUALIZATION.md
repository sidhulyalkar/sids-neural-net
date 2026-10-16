# Project Context: NeuroSky, LED Strip Mapping, and Real-Time Audio Visualization

## Node Metadata

- **Node type:** personal project / hardware / creative systems
- **Primary cluster:** Real-Time Creative Neurotech
- **Importance:** 82
- **Visibility:** Builder View, Personal View, Full Brain View

## One-liner

Built real-time LED strip visualization systems connected to NeuroSky-style brain input and PC audio output, multiplexed through Raspberry Pi, speakers, and headphones for synchronized visual feedback.

## Narrative

This is a fantastic “full brain” project because it shows Sid’s early instinct for embodied systems: sensors, signals, hardware, real-time feedback, audio, visualization, and playful experimentation.

This should appear on the Life/Personal Systems side of the Neural Net, but still connect strongly to real-time systems, signal processing, Raspberry Pi, audio processing, and BCI curiosity.

## System Concept

The system mapped either NeuroSky-derived neural/attention signals or PC audio output into LED strip visualizations in real time.

A related audio visualization setup routed PC audio output into a Raspberry Pi-controlled LED visualization pipeline while also feeding speakers and headphones. This allowed live audio playback and LED visualization to occur simultaneously.

## Hardware / Signal Flow

Suggested architecture diagram:

`PC Audio Output → Audio Split / Virtual Audio Capture → Raspberry Pi Processing → LED Strip Visualization`

Parallel output:

`PC Audio → Speakers`
`PC Audio → Headphones`
`PC Audio → RasPi / LED Controller`

Potential NeuroSky flow:

`NeuroSky EEG Headset → Attention/Meditation/Raw Signal → Serial/Bluetooth/PC/RasPi → Signal Mapping → LED Strip`

## Technical Ideas

- Real-time signal acquisition
- Audio feature extraction
- Frequency/intensity mapping
- LED strip control
- Raspberry Pi GPIO / controller logic
- Multiplexed audio routing
- Neurofeedback-style visualization
- Low-latency feedback loops

## Suggested Website Copy

Long before building cloud neuroscience infrastructure, Sid was already experimenting with embodied feedback systems: mapping brain-signal and audio streams into real-time LED visualizations using Raspberry Pi hardware, speakers, headphones, and custom signal-routing logic.

## Why It Matters

This project gives emotional and technical continuity to Sid’s current interests in BCI, closed-loop systems, adaptive interfaces, and real-time experimental infrastructure.

## Neural Net Connections

- NeuroSky
- EEG
- Raspberry Pi
- LED Strip
- Audio Visualization
- Real-Time Systems
- Signal Processing
- BCI
- PC Gaming / Music
- Hardware Hacking
