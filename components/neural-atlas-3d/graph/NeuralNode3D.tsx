'use client';

import { useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { Group } from 'three';
import type { AtlasNode } from '../atlasTypes';
import { vectorToTuple } from '../atlasTypes';
import { useAtlasStore } from '../atlasStore';
import { SomaMesh } from '../morphology/SomaMesh';
import { PyramidalNeuron } from '../morphology/PyramidalNeuron';
import { StellateNeuron } from '../morphology/StellateNeuron';
import { Interneuron } from '../morphology/Interneuron';
import { ATLAS_COLORS } from '../visualConstants';

type NeuralNode3DProps = {
  node: AtlasNode;
};

export function NeuralNode3D({ node }: NeuralNode3DProps) {
  const groupRef = useRef<Group>(null);
  const focusCategory = useAtlasStore((state) => state.focusCategory);
  const focusLeaf = useAtlasStore((state) => state.focusLeaf);
  const setHoveredNode = useAtlasStore((state) => state.setHoveredNode);
  const selectedLeafId = useAtlasStore((state) => state.selectedLeafId);
  const activeCategoryId = useAtlasStore((state) => state.activeCategoryId);
  const hoveredNodeId = useAtlasStore((state) => state.hoveredNodeId);
  const isHovered = hoveredNodeId === node.id;
  const isActive = selectedLeafId === node.id || activeCategoryId === node.id;
  const isSelected = selectedLeafId === node.id;
  const visualScale =
    node.scale *
    (node.kind === 'category' ? 1.34 : 0.86) *
    (node.featured ? 1.08 : 1) *
    (0.9 + Math.min(100, node.importance) / 500);
  const motionSeed = useMemo(() => node.id.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0), [node.id]);
  const showLabel = node.kind === 'category' || isHovered || isActive;

  const handleClick = () => {
    if (node.kind === 'category') focusCategory(node.id);
    else focusLeaf(node.id, node.parentId);
  };
  const stopAndHover = (event: ThreeEvent<PointerEvent>, hovered: boolean) => {
    event.stopPropagation();
    setHoveredNode(hovered ? node.id : null);
  };
  const commonProps = {
    color: node.color,
    scale: isActive || isHovered ? visualScale * 1.12 : visualScale,
    active: isActive,
    hovered: isHovered,
    selected: isSelected,
    seed: node.id,
  };

  const morphology =
    node.morphology === 'purkinje-inspired' || node.morphology === 'axon-terminal'
      ? 'stellate'
      : node.morphology;

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;

    const time = clock.elapsedTime;
    const phase = motionSeed * 0.013;
    const breath = 1 + Math.sin(time * 0.7 + phase) * (isActive ? 0.022 : 0.012);

    group.rotation.z = Math.sin(time * 0.18 + phase) * 0.035;
    group.rotation.x = Math.cos(time * 0.14 + phase) * 0.018;
    group.scale.setScalar(breath);
  });

  return (
    <group
      ref={groupRef}
      position={vectorToTuple(node.position)}
      onClick={(event) => {
        event.stopPropagation();
        handleClick();
      }}
      onPointerOver={(event) => stopAndHover(event, true)}
      onPointerOut={(event) => stopAndHover(event, false)}
    >
      {morphology === 'pyramidal' ? (
        <PyramidalNeuron {...commonProps} />
      ) : morphology === 'stellate' || morphology === 'glial' ? (
        <StellateNeuron {...commonProps} />
      ) : morphology === 'interneuron' ? (
        <Interneuron {...commonProps} />
      ) : (
        <SomaMesh {...commonProps} />
      )}
      {(isActive || isHovered) && (
        <mesh scale={visualScale * 1.9}>
          <sphereGeometry args={[0.82, 24, 18]} />
          <meshBasicMaterial color={isSelected ? ATLAS_COLORS.white : node.color} transparent opacity={isActive ? 0.16 : 0.09} depthWrite={false} />
        </mesh>
      )}
      {showLabel && (
        <Html position={[0, -visualScale * 0.95, 0]} center distanceFactor={12}>
          <span className="pointer-events-none whitespace-nowrap border border-white/10 bg-black/40 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan/90 backdrop-blur-md">
            {node.shortLabel}
          </span>
        </Html>
      )}
    </group>
  );
}
