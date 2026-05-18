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

  const handleClick = () => {
    if (node.kind === 'category') focusCategory(node.id);
    else focusLeaf(node.id);
  };
  const stopAndHover = (event: ThreeEvent<PointerEvent>, hovered: boolean) => {
    event.stopPropagation();
    setHoveredNode(hovered ? node.id : null);
  };
  const commonProps = {
    position: vectorToTuple(node.position),
    color: node.color,
    size: isActive || isHovered ? node.scale * 1.18 : node.scale,
    onClick: handleClick,
  };

  return (
    <group
      onPointerOver={(event) => stopAndHover(event, true)}
      onPointerOut={(event) => stopAndHover(event, false)}
    >
      {node.morphology === 'pyramidal' ? (
        <PyramidalNeuron {...commonProps} />
      ) : node.morphology === 'stellate' || node.morphology === 'glial' ? (
        <StellateNeuron {...commonProps} />
      ) : node.morphology === 'interneuron' ? (
        <Interneuron {...commonProps} />
      ) : (
        <SomaMesh {...commonProps} />
      )}
      {(isActive || isHovered) && (
        <mesh position={vectorToTuple(node.position)} scale={node.scale * 1.85}>
          <sphereGeometry args={[0.74, 24, 18]} />
          <meshBasicMaterial color={node.color} transparent opacity={isActive ? 0.18 : 0.1} depthWrite={false} />
        </mesh>
      )}
      <Html position={[node.position.x, node.position.y - node.scale * 0.95, node.position.z]} center distanceFactor={12}>
        <span className="pointer-events-none whitespace-nowrap border border-white/10 bg-black/45 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan/90 backdrop-blur-md">
          {node.shortLabel}
        </span>
      </Html>
    </group>
  );
}
