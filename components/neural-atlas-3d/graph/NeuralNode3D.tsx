'use client';

import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { AtlasNode } from '../atlasTypes';
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
  const selectedNodeId = useAtlasStore((state) => state.selectedNodeId);
  const activeCategoryId = useAtlasStore((state) => state.activeCategoryId);
  const isActive = selectedNodeId === node.id || activeCategoryId === node.id;

  const handleClick = () => {
    if (node.kind === 'category') focusCategory(node.id);
    else focusLeaf(node.id);
  };
  const stopAndHover = (event: ThreeEvent<PointerEvent>, hovered: boolean) => {
    event.stopPropagation();
    setHoveredNode(hovered ? node.id : null);
  };
  const commonProps = {
    position: node.position,
    color: node.color,
    size: isActive ? node.size * 1.22 : node.size,
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
      <Html position={[node.position[0], node.position[1] - node.size * 0.95, node.position[2]]} center distanceFactor={12}>
        <span className="pointer-events-none whitespace-nowrap border border-white/10 bg-black/45 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan/90 backdrop-blur-md">
          {node.label}
        </span>
      </Html>
    </group>
  );
}
