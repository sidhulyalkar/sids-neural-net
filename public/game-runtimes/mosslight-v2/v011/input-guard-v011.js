const G=window.Sylvaria091,state=G.state;
document.addEventListener('keydown',event=>{
  const key=String(event.key||'').toLowerCase();
  if(key==='enter'&&state.mode==='menu'&&event.target?.tagName==='BUTTON'){
    event.preventDefault();event.stopImmediatePropagation();event.target.click();return;
  }
  if(event.repeat&&(key==='p'||key==='m'))event.stopImmediatePropagation();
},true);
window.SylvariaInputGuard=Object.freeze({version:'0.11.1',repeatSafe:true,focusedMenuEnter:true});
