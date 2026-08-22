(() => {
  'use strict';
  const rail = document.getElementById('runRail');
  if (!rail || document.getElementById('immersiveBtn')) return;
  const button = document.createElement('button');
  button.id = 'immersiveBtn';
  button.type = 'button';
  button.textContent = 'FULLSCREEN';
  button.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
    } catch {}
  });
  rail.appendChild(button);
})();
