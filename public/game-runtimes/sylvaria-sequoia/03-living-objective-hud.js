(() => {
  'use strict';

  const S = window.SylvariaSequoia;
  if (!S?.render || !S?.livingCanopy) return;

  const { ctx, state, player } = S;
  const baseRender = S.render;
  const VERSION = 'living-objective-hud-v1';

  function drawObjective() {
    if (state.mode !== 'playing') return;
    const objective = S.livingCanopy.getObjective();
    if (!objective) return;
    const right = state.RIGHT_WALL - 12;

    // This small translucent scrub replaces only the old right-side objective
    // text. It deliberately does not become another panel or cover the playfield.
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

  function drawGameOverObjective() {
    if (state.mode !== 'gameover') return;
    const objective = S.livingCanopy.getObjective();
    if (!objective) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(16,18,12,.84)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = 'rgba(234,244,218,.78)';
    ctx.font = '800 9px system-ui,sans-serif';
    ctx.fillText(`${objective.text}${objective.detail ? ` · ${objective.detail}` : ''}`, S.W / 2, S.H * 0.64);
    ctx.restore();
  }

  function render(alpha, now) {
    baseRender(alpha, now);
    drawObjective();
    drawGameOverObjective();
  }

  S.render = render;
  S.livingObjectiveHud = {
    version: VERSION,
    objectiveLadder: ['Heartseeds', 'Living Crown', 'Canopy Wonders', 'Skyheart', 'Endless Elder Canopy'],
    scoreIsSecondary: true,
  };
})();
