export type FrontierFocalKeyboardIntent = 'open' | 'close' | 'none';

export function isFrontierTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT'
    || target.tagName === 'TEXTAREA'
    || target.tagName === 'SELECT'
    || target.isContentEditable
    || Boolean(target.closest('[role="textbox"], [role="dialog"] input, video, audio'));
}

export function resolveFrontierFocalKeyboardIntent(input: {
  key: string;
  open: boolean;
  hasHoveredItem: boolean;
  typing: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
}): FrontierFocalKeyboardIntent {
  if (input.open && input.key === 'Escape') return 'close';
  if (input.open || input.typing || input.metaKey || input.ctrlKey || input.altKey) return 'none';
  if ((input.key === ' ' || input.key === 'Spacebar') && input.hasHoveredItem) return 'open';
  return 'none';
}
