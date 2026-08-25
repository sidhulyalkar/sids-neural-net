(() => {
  'use strict';

  const S = window.SylvariaSequoia;
  if (!S?.render || !S?.livingCanopy) return;

  const { ctx, state } = S;
  const baseRender = S.render;
  const VERSION = 'living-objective-hud-v1';
  const REVISION = 'traversal-focus-v2';

  function drawObjective() {
    // The run recap owns game-over guidance. Keeping the persistent objective
    // traversal-only prevents it from colliding with the mastery recap and keeps
    // one clear attention hierarchy on the playfield.
    if (state.mode !== 'playing') return;
    const objective = S.livingCanopy.getObjective();
    if (!objective) return;
    const right = state.RIGHT_WALL - 12;

    ctx.save();
    ctx.fillStyle = 'rgba(16,36,31,.74)';
    ctx.fillRect(right - 205, 25, 208, 22);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(8,18,15,.88)';
    ctx.shadowBlur = 4;
    const color = objective.kind === 'skyheart'
      ? '#eacbff'
      : objective.kind === 'wonder'
        ? '#d7f5ef'
        : objective.kind === 'crown'
          ? '#e5ffbd'
          : objective.kind === 'endless'
            ? '#ffe8a5'
            : '#f2e7bf';
    ctx.fillStyle = color;
    ctx.font = '900 8px system-ui,sans-serif';
    ctx.fillText(objective.text, right, 28);
    if (objective.detail) {
      ctx.fillStyle = 'rgba(225,237,215,.52)';
      ctx.font = '700 7px system-ui,sans-serif';
      ctx.fillText(objective.detail, right, 38);
    }
    ctx.restore();
  }

  function render(alpha, now) {
    baseRender(alpha, now);
    drawObjective();
  }

  S.render = render;
  S.livingObjectiveHud = {
    version: VERSION,
    revision: REVISION,
    visibleDuring: 'playing-only',
    objectiveLadder: ['Heartseeds', 'Living Crown', 'Canopy Wonders', 'Skyheart', 'Endless Elder Canopy'],
    scoreIsSecondary: true,
  };
})();
