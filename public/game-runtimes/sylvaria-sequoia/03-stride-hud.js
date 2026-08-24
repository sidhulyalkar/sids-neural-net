(() => {
  'use strict';

  const S = window.SylvariaSequoia;
  const { ctx, W, state, player, TUNE, clamp } = S;
  const baseRender = S.render;

  function drawStrideHud() {
    if (state.mode !== 'playing' && state.mode !== 'paused') return;
    const assist = S.flowAssist?.getState?.();
    const stride = assist?.strideMomentum || Math.abs(player.vx);
    const normalized = clamp(stride / TUNE.run.strideMax, 0, 1);
    const actual = Math.abs(player.vx);

    let label = 'STRIDE';
    if (player.hyper) label = 'CROWN RUSH';
    else if (normalized >= 0.72) label = 'RUSH III';
    else if (normalized >= 0.50) label = 'RUSH II';
    else if (normalized >= 0.30) label = 'RUSH I';

    ctx.save();
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = '8px ui-monospace,SFMono-Regular,Menlo,monospace';
    ctx.fillStyle = player.hyper ? '#a8ffc9' : 'rgba(235,255,239,.40)';
    ctx.fillText(`${label} ${Math.round(stride)}`, 22, 99);

    const width = 112;
    const x = 22;
    const y = 112;
    ctx.fillStyle = 'rgba(255,255,255,.10)';
    ctx.fillRect(x, y, width, 4);
    ctx.fillStyle = player.hyper ? '#8dffb8' : normalized >= 0.5 ? '#f0c66b' : '#7fc995';
    ctx.fillRect(x, y, width * normalized, 4);

    // Tiny marker shows physical vx inside the remembered arcade Stride state.
    const actualX = x + width * clamp(actual / TUNE.run.strideMax, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,.80)';
    ctx.fillRect(actualX - 1, y - 2, 2, 8);

    if (player.combo > 0) {
      ctx.fillStyle = 'rgba(235,255,239,.30)';
      ctx.fillText(`FLOW CARRY ${player.combo}×`, 22, 120);
    }
    ctx.restore();
  }

  function render(alpha, now) {
    baseRender(alpha, now);
    drawStrideHud();
  }

  S.render = render;
  S.drawStrideHud = drawStrideHud;
})();
