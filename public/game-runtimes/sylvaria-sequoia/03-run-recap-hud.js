(() => {
  'use strict';

  const S = window.SylvariaSequoia;
  if (!S?.render || !S?.canopyProgress) return;

  const { ctx, W, H, state, player, clamp } = S;
  const baseRender = S.render;
  const VERSION = 'run-recap-v1';

  function formatSplit(split) {
    if (!split) return null;
    if (split.previousBestSeconds == null) return `CROWN ${split.floor} · ${split.seconds.toFixed(1)}s FIRST SPLIT`;
    if (split.isBest && split.deltaSeconds != null) return `CROWN ${split.floor} · ${Math.abs(split.deltaSeconds).toFixed(1)}s FASTER`;
    if (split.deltaSeconds != null) return `CROWN ${split.floor} · +${Math.max(0, split.deltaSeconds).toFixed(1)}s`;
    return `CROWN ${split.floor} · ${split.seconds.toFixed(1)}s`;
  }

  function closestContract(economy) {
    const missions = economy?.missions || [];
    return missions
      .filter((mission) => !mission.completed && !mission.done)
      .sort((a, b) => (b.ratio || 0) - (a.ratio || 0))[0] || null;
  }

  function recapLines() {
    const progress = S.canopyProgress.getState();
    const economy = S.canopyEconomy?.getState?.() || null;
    const director = S.canopyDirector?.getState?.() || null;
    const contract = closestContract(economy);
    const heightLine = progress.runFloorGain > 0
      ? `NEW HEIGHT · +${progress.runFloorGain}F THIS RUN`
      : `PEAK ${player.highestFloor}F · PB ${progress.bestFloor}`;
    const splitLine = formatSplit(progress.latestSplit);
    const contractLine = contract
      ? `NEXT CONTRACT · ${contract.name} ${Math.round(clamp(contract.ratio || 0, 0, 1) * 100)}%`
      : null;
    return {
      heightLine,
      splitLine,
      contractLine,
      stage: director?.stage || null,
      controls: 'SPACE NEW RUN · 0 SAME SEED · B SHOP',
    };
  }

  function drawRecap() {
    if (state.mode !== 'gameover') return;
    if (S.canopyEconomy?.getState?.().shopOpen) return;

    const lines = recapLines();
    const y = H * 0.69;
    const width = Math.min(510, W * 0.58);
    const x = W / 2 - width / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(16,26,21,.54)';
    ctx.strokeStyle = 'rgba(238,224,185,.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y - 31, width, 92, 11);
    else ctx.rect(x, y - 31, width, 92);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(8,14,11,.86)';
    ctx.shadowBlur = 5;
    ctx.fillStyle = 'rgba(255,241,201,.94)';
    ctx.font = '900 11px system-ui,sans-serif';
    ctx.fillText(lines.heightLine, W / 2, y - 12);

    const middle = lines.splitLine || lines.contractLine || 'THE NEXT CLEAN LINE IS ALREADY THERE';
    ctx.fillStyle = lines.splitLine?.includes('FASTER') ? '#c8f4d8' : 'rgba(224,237,211,.76)';
    ctx.font = '800 9px system-ui,sans-serif';
    ctx.fillText(middle, W / 2, y + 8);

    if (lines.splitLine && lines.contractLine) {
      ctx.fillStyle = 'rgba(204,225,204,.61)';
      ctx.font = '800 8px system-ui,sans-serif';
      ctx.fillText(lines.contractLine, W / 2, y + 24);
    }

    ctx.fillStyle = 'rgba(255,230,170,.62)';
    ctx.font = '800 8px ui-monospace,SFMono-Regular,Menlo,monospace';
    ctx.fillText(lines.controls, W / 2, y + 46);
    ctx.restore();
  }

  function render(alpha, now) {
    baseRender(alpha, now);
    drawRecap();
  }

  S.render = render;
  S.runRecapHud = {
    version: VERSION,
    getState: recapLines,
    design: 'mastery-first recap: height gain, split delta, closest contract, immediate retry choices',
  };
})();