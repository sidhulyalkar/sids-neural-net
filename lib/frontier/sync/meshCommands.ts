export const FRONTIER_MESH_COMMAND_EVENT = 'frontier:mesh-command';
export const FRONTIER_MESH_RESPONSE_EVENT = 'frontier:mesh-response';

export type FrontierMeshCommand = {
  action: 'create-offer' | 'accept-offer' | 'accept-answer' | 'close';
  payload?: string;
};

export type FrontierMeshResponse = {
  action?: FrontierMeshCommand['action'];
  payload?: string;
  status?: string;
  error?: string;
};

export function dispatchFrontierMeshCommand(command: FrontierMeshCommand): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<FrontierMeshCommand>(FRONTIER_MESH_COMMAND_EVENT, { detail: command }));
}
