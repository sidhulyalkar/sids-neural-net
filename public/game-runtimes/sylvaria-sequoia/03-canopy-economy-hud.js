(() => {
  'use strict';

  const S = window.SylvariaSequoia;
  if (!S?.render || !S?.canopyEconomy || !S?.sapRhythm) return;

  const { ctx, W, H, state, clamp } = S;
  const baseRender = S.render;
  const VERSION = 'canopy-contracts-hud-v1';

  const SHOP_PANEL = { x: 206, y: 116, w: 548, h: 408 };
  const SHOP_BUTTON = { x: W - 164, y: H - 50, w: 146, h: 30 };

  function roundRect(x, y, w, h, r = 8) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  function drawCone(x, y, scale = 1, alpha = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#d89a51';
    ctx.strokeStyle = '#ffe09b';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, 6);
    ctx.quadraticCurveTo(0, 11, -7, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(91,47,18,.72)';
    ctx.lineWidth = 1;
    for (let row = -4; row <= 5; row += 4) {
      ctx.beginPath();
      ctx.moveTo(-4.5, row);
      ctx.lineTo(4.5, row + 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWorldTokens(now) {
    if (state.mode !== 'playing') return;
    const time = now * 0.001;
    for (const token of S.canopyEconomy.getVisibleTokens()) {
      const y = S.worldToScreenY(token.y);
      if (y < -36 || y > H + 36) continue;
      const pulse = 1 + Math.sin(time * 4.2 + token.floor) * 0.08;
      ctx.save();
      ctx.globalAlpha = 0.20;
      ctx.fillStyle = '#ffc96c';
      ctx.beginPath();
      ctx.arc(token.x, y, 18 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drawCone(token.x, y, pulse, 0.96);
    }
  }

  function drawWallet() {
    const economy = S.canopyEconomy.getState();
    const w = 118;
    const x = W - w - 16;
    const y = 15;
    ctx.save();
    roundRect(x, y, w, 28, 14);
    ctx.fillStyle = 'rgba(8,14,10,.64)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,218,148,.24)';
    ctx.stroke();
    drawCone(x + 17, y + 14, 0.65, 0.9);
    ctx.fillStyle = 'rgba(255,240,194,.90)';
    ctx.font = '800 10px ui-monospace,monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${economy.wallet} CONES`, x + 32, y + 14);
    ctx.restore();
  }

  function drawSapRhythm() {
    if (state.mode !== 'playing') return;
    const rhythm = S.sapRhythm.getState();
    const text = rhythm.ready ? 'SAP READY · SHIFT' : 'SAP SPENT · LAND ON A HIGHER LOG';
    const w = rhythm.ready ? 144 : 252;
    const x = (W - w) / 2;
    const y = H - 72;
    ctx.save();
    roundRect(x, y, w, 24, 12);
    ctx.fillStyle = rhythm.ready ? 'rgba(52,48,19,.72)' : 'rgba(12,18,14,.66)';
    ctx.fill();
    ctx.strokeStyle = rhythm.ready ? 'rgba(255,213,103,.48)' : 'rgba(171,229,177,.24)';
    ctx.stroke();
    ctx.fillStyle = rhythm.ready ? '#ffe39b' : 'rgba(221,243,216,.76)';
    ctx.font = '800 8px ui-monospace,monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, y + 12);
    ctx.restore();
  }

  function drawMissionPanel() {
    if (state.mode !== 'playing') return;
    const missions = S.canopyEconomy.getState().missions;
    if (!missions.length) return;
    const x = W - 235;
    const y = 54;
    const w = 219;
    const h = 44 + missions.length * 37;
    ctx.save();
    roundRect(x, y, w, h, 9);
    ctx.fillStyle = 'rgba(7,13,10,.58)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212,239,202,.14)';
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#a8d8aa';
    ctx.font = '800 8px ui-monospace,monospace';
    ctx.fillText('CANOPY CONTRACTS', x + 12, y + 10);
    ctx.fillStyle = 'rgba(232,245,222,.38)';
    ctx.font = '7px ui-monospace,monospace';
    ctx.fillText('missions reward Cone Tokens', x + 12, y + 22);

    missions.forEach((mission, index) => {
      const yy = y + 39 + index * 37;
      ctx.fillStyle = mission.completed ? '#c9f1a5' : 'rgba(255,244,214,.82)';
      ctx.font = '800 7.5px ui-monospace,monospace';
      ctx.fillText(`${mission.completed ? '✓ ' : ''}${mission.name}`, x + 12, yy);
      ctx.fillStyle = mission.completed ? 'rgba(201,241,165,.58)' : 'rgba(235,241,218,.48)';
      ctx.font = '6.7px ui-monospace,monospace';
      ctx.fillText(mission.detail, x + 12, yy + 12);
      const barW = 142;
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      ctx.fillRect(x + 12, yy + 24, barW, 3);
      ctx.fillStyle = mission.completed ? '#a7d97c' : '#d8a756';
      ctx.fillRect(x + 12, yy + 24, barW * clamp(mission.ratio || 0, 0, 1), 3);
      ctx.fillStyle = '#e8bd69';
      ctx.textAlign = 'right';
      ctx.fillText(`+${mission.reward}`, x + w - 12, yy + 12);
      ctx.textAlign = 'left';
    });
    ctx.restore();
  }

  function shopRows() {
    const economy = S.canopyEconomy.getState();
    return economy.items.map((item, index) => ({
      ...item,
      x: SHOP_PANEL.x + 34,
      y: SHOP_PANEL.y + 104 + index * 62,
      w: SHOP_PANEL.w - 68,
      h: 48,
      key: String(index + 1),
    }));
  }

  function drawShopButton() {
    if (!(state.mode === 'title' || state.mode === 'gameover')) return;
    const economy = S.canopyEconomy.getState();
    ctx.save();
    roundRect(SHOP_BUTTON.x, SHOP_BUTTON.y, SHOP_BUTTON.w, SHOP_BUTTON.h, 15);
    ctx.fillStyle = 'rgba(22,20,10,.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,216,132,.42)';
    ctx.stroke();
    drawCone(SHOP_BUTTON.x + 18, SHOP_BUTTON.y + 15, 0.62, 0.9);
    ctx.fillStyle = '#ffe1a0';
    ctx.font = '800 8px ui-monospace,monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`B · SHOP · ${economy.wallet}`, SHOP_BUTTON.x + 82, SHOP_BUTTON.y + 15);
    ctx.restore();
  }

  function drawShop() {
    const economy = S.canopyEconomy.getState();
    if (!economy.shopOpen) return;

    ctx.save();
    ctx.fillStyle = 'rgba(3,7,5,.78)';
    ctx.fillRect(0, 0, W, H);
    roundRect(SHOP_PANEL.x, SHOP_PANEL.y, SHOP_PANEL.w, SHOP_PANEL.h, 14);
    ctx.fillStyle = 'rgba(18,25,18,.97)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,221,145,.28)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffe2a3';
    ctx.font = '800 20px ui-monospace,monospace';
    ctx.fillText('CANOPY SHOP', SHOP_PANEL.x + 34, SHOP_PANEL.y + 28);
    drawCone(SHOP_PANEL.x + SHOP_PANEL.w - 116, SHOP_PANEL.y + 40, 0.9, 0.95);
    ctx.fillStyle = '#ffe2a3';
    ctx.font = '800 12px ui-monospace,monospace';
    ctx.fillText(`${economy.wallet} CONE TOKENS`, SHOP_PANEL.x + SHOP_PANEL.w - 94, SHOP_PANEL.y + 33);
    ctx.fillStyle = 'rgba(238,246,224,.52)';
    ctx.font = '8px ui-monospace,monospace';
    ctx.fillText('Buy run-local tools. No permanent stat upgrades. Each queued item is consumed when the next climb begins.', SHOP_PANEL.x + 34, SHOP_PANEL.y + 66);

    for (const row of shopRows()) {
      roundRect(row.x, row.y, row.w, row.h, 8);
      ctx.fillStyle = row.queued ? 'rgba(61,75,38,.56)' : 'rgba(255,255,255,.035)';
      ctx.fill();
      ctx.strokeStyle = row.queued ? 'rgba(183,230,124,.34)' : 'rgba(255,255,255,.09)';
      ctx.stroke();
      ctx.fillStyle = row.queued ? '#c9ee9d' : '#fff0c8';
      ctx.font = '800 9px ui-monospace,monospace';
      ctx.fillText(`${row.key} · ${row.name}`, row.x + 14, row.y + 9);
      ctx.fillStyle = 'rgba(233,242,218,.54)';
      ctx.font = '7.5px ui-monospace,monospace';
      ctx.fillText(row.detail, row.x + 14, row.y + 26);
      ctx.textAlign = 'right';
      ctx.fillStyle = row.queued ? '#c9ee9d' : '#e9b969';
      ctx.font = '800 9px ui-monospace,monospace';
      ctx.fillText(row.queued ? 'QUEUED' : `${row.cost} CONES`, row.x + row.w - 14, row.y + 18);
      ctx.textAlign = 'left';
    }

    ctx.fillStyle = economy.lastShopMessage ? '#ffe09a' : 'rgba(236,244,222,.42)';
    ctx.font = '800 8px ui-monospace,monospace';
    ctx.textAlign = 'center';
    ctx.fillText(economy.lastShopMessage || '1–4 purchase · B / ESC close', W / 2, SHOP_PANEL.y + SHOP_PANEL.h - 28);
    ctx.restore();
  }

  function render(alpha, now) {
    baseRender(alpha, now);
    drawWorldTokens(now);
    drawWallet();
    drawMissionPanel();
    drawSapRhythm();
    drawShopButton();
    drawShop();
  }

  S.render = render;
  S.canopyEconomyHud = {
    version: VERSION,
    shopPanel: { ...SHOP_PANEL },
    shopButton: { ...SHOP_BUTTON },
    getShopRows: shopRows,
  };
})();