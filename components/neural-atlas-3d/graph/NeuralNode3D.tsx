'use client';

import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
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

  const handleClick = () => {
    if (node.kind === 'category') focusCategory(node.id);
    else focusLeaf(node.id, node.parentId);
  };
  const stopAndHover = (event: ThreeEvent<PointerEvent>, hovered: boolean) => {
    event.stopPropagation();
    setHoveredNode(hovered ? node.id : null);
  };
  const commonProps = {
    position: vectorToTuple(node.position),
    color: node.color,
    scale: isActive || isHovered ? visualScale * 1.12 : visualScale,
    active: isActive,
    hovered: isHovered,
    selected: isSelected,
    seed: node.id,
    onClick: handleClick,
  };

  const morphology =
    node.morphology === 'purkinje-inspired' || node.morphology === 'axon-terminal'
      ? 'stellate'
      : node.morphology;

  return (
    <group
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
        <mesh position={vectorToTuple(node.position)} scale={visualScale * 1.9}>
          <sphereGeometry args={[0.82, 24, 18]} />
          <meshBasicMaterial color={isSelected ? ATLAS_COLORS.white : node.color} transparent opacity={isActive ? 0.16 : 0.09} depthWrite={false} />
        </mesh>
      )}
      <Html position={[node.position.x, node.position.y - visualScale * 0.95, node.position.z]} center distanceFactor={12}>
        <span className="pointer-events-none whitespace-nowrap border border-white/10 bg-black/45 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan/90 backdrop-blur-md">
          {node.shortLabel}
        </span>
      </Html>
    </group>
  );
}
