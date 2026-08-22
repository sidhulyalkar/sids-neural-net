const G=window.Sylvaria091;
document.addEventListener('keydown',event=>{
  const key=String(event.key||'').toLowerCase();
  if(event.repeat&&(key==='p'||key==='m'))event.stopImmediatePropagation();
},true);
window.SylvariaInputGuard=Object.freeze({version:'0.11.1',repeatSafe:true});
