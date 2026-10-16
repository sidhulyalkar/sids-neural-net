export const FRONTIER_MESH_PROFILE_UPDATE_EVENT = 'frontier:mesh-profile-update';

export function publishFrontierMeshProfileUpdate(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(FRONTIER_MESH_PROFILE_UPDATE_EVENT));
}
