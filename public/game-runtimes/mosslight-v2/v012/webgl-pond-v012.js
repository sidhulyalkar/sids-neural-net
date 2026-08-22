import{createPondAtlas,POND_SPRITES}from'./art-atlas-v012.js';

const MAX_SPRITES=900,MAX_LIGHTS=6,STRIDE=9,VERTS_PER=6;
const ENEMY_ART=Object.freeze({feller:'fly',foreman:'bee',lobbyist:'mosquito',skidder:'beetle',drone:'dragonfly',chair:'hornet',broker:'moth',surveyor:'crane',mech:'divingBeetle',mulcher:'wasp'});
const TERRAIN_ART=Object.freeze({grass:'reeds',water:'water',mud:'mud',sand:'bank',ice:'algae',bramble:'tangle',shards:'shells'});
const POND_ROOM_NAMES=Object.freeze([
  'Lily Clearing','Reed Path','Mudbank','Shallow Edge','Rain Pool','Fern Hollow','Cattail Bend','Stone Pool','Creek Crossing','Dragonfly Roost',
  'Lower Marsh','Runoff Channel','Rootwater','Shade Pond','Flood Meadow','Mosquito Bloom','Broken Bank','Willow Roots','Deep Pool','Hornet Bank',
  'Dry Bank','Old Dock','Sunwarm Shelf','Creek Cut','Shell Bed','Fallen Log','Warm Shallows','Reed Maze','Open Water','Beetle Pool'
]);

const VS=`#version 300 es
precision highp float;
layout(location=0)in vec2 aPos;
layout(location=1)in vec2 aUV;
layout(location=2)in float aDepth;
layout(location=3)in vec4 aTint;
uniform vec2 uResolution;
out vec2 vUV;
out vec2 vWorld;
out vec4 vTint;
void main(){
  vec2 clip=aPos/uResolution*2.0-1.0;
  gl_Position=vec4(clip.x,-clip.y,aDepth,1.0);
  vUV=aUV;vWorld=aPos;vTint=aTint;
}`;

const FS=`#version 300 es
precision highp float;
in vec2 vUV;
in vec2 vWorld;
in vec4 vTint;
out vec4 outColor;
uniform sampler2D uDiffuse;
uniform sampler2D uHeight;
uniform vec2 uTexel;
uniform vec3 uAmbient;
uniform float uHeightStrength;
uniform int uLightCount;
uniform vec4 uLightPosRadius[${MAX_LIGHTS}];
uniform vec3 uLightColor[${MAX_LIGHTS}];
void main(){
  vec4 base=texture(uDiffuse,vUV);
  if(base.a<.025)discard;
  float hL=texture(uHeight,vUV-vec2(uTexel.x,0.0)).r;
  float hR=texture(uHeight,vUV+vec2(uTexel.x,0.0)).r;
  float hD=texture(uHeight,vUV-vec2(0.0,uTexel.y)).r;
  float hU=texture(uHeight,vUV+vec2(0.0,uTexel.y)).r;
  vec3 normal=normalize(vec3((hL-hR)*uHeightStrength,(hD-hU)*uHeightStrength,1.0));
  vec3 lighting=uAmbient;
  for(int i=0;i<${MAX_LIGHTS};i++){
    if(i>=uLightCount)break;
    vec4 lr=uLightPosRadius[i];
    vec2 delta=lr.xy-vWorld;
    float planar=length(delta);
    float attenuation=1.0-smoothstep(lr.w*.18,lr.w,planar);
    vec3 lightDir=normalize(vec3(delta,lr.z));
    float diffuse=max(dot(normal,lightDir),0.0);
    lighting+=uLightColor[i]*(diffuse*.72+.18)*attenuation;
  }
  vec3 color=base.rgb*vTint.rgb*lighting;
  outColor=vec4(color,base.a*vTint.a);
}`;

function compile(gl,type,src){const shader=gl.createShader(type);gl.shaderSource(shader,src);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)||'shader compile failed');return shader}
function program(gl){const p=gl.createProgram(),v=compile(gl,gl.VERTEX_SHADER,VS),f=compile(gl,gl.FRAGMENT_SHADER,FS);gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||'program link failed');return p}
function tex(gl,source){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);return t}
function hash32(value){let h=2166136261>>>0;for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let x=seed>>>0;return()=>{x+=0x6d2b79f5;let t=x;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function drawFlower(g,x,y,r,color){g.fillStyle=color;for(let i=0;i<5;i++){g.save();g.translate(x,y);g.rotate(i*Math.PI*2/5);g.beginPath();g.ellipse(0,-r,r*.45,r,0,0,Math.PI*2);g.fill();g.restore()}g.fillStyle='#f2d36e';g.beginPath();g.arc(x,y,r*.48,0,Math.PI*2);g.fill()}
function pondBackground(W,H,depth){
  const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d'),r=rng(hash32(`pond:${depth}`));
  const base=g.createLinearGradient(0,0,W,H);base.addColorStop(0,'#315d2d');base.addColorStop(.45,'#517a34');base.addColorStop(1,'#294e2c');g.fillStyle=base;g.fillRect(0,0,W,H);
  const light=g.createRadialGradient(W*.48,H*.48,40,W*.48,H*.48,W*.55);light.addColorStop(0,'rgba(220,224,128,.20)');light.addColorStop(.62,'rgba(123,159,72,.08)');light.addColorStop(1,'rgba(6,30,24,.30)');g.fillStyle=light;g.fillRect(0,0,W,H);
  const water=g.createLinearGradient(0,0,0,90);water.addColorStop(0,'#163f46');water.addColorStop(1,'#2b6561');g.fillStyle=water;g.beginPath();g.moveTo(0,0);g.lineTo(W,0);g.lineTo(W,42);for(let x=W;x>=0;x-=48)g.quadraticCurveTo(x-24,50+r()*20,x-48,42+r()*18);g.lineTo(0,0);g.fill();
  const waterBottom=g.createLinearGradient(0,H-86,0,H);waterBottom.addColorStop(0,'#2c665e');waterBottom.addColorStop(1,'#123942');g.fillStyle=waterBottom;g.beginPath();g.moveTo(0,H);g.lineTo(W,H);g.lineTo(W,H-36);for(let x=W;x>=0;x-=48)g.quadraticCurveTo(x-24,H-55-r()*15,x-48,H-39-r()*14);g.lineTo(0,H);g.fill();
  for(let i=0;i<42;i++){const x=22+r()*(W-44),y=82+r()*(H-164),s=1+r()*2.1;g.strokeStyle=`rgba(35,79,35,${.22+r()*.22})`;g.lineWidth=1;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+s*2,y-s*5,x+s*4,y-s*7);g.stroke()}
  for(let i=0;i<28;i++){const x=28+r()*(W-56),y=92+r()*(H-184),rr=1.5+r()*2.3;drawFlower(g,x,y,rr,r()>.6?'#e6a2c8':r()>.45?'#ddd99b':'#92bde0')}
  for(let i=0;i<24;i++){const x=r()*W,y=i%2?r()*58:H-58+r()*45,rx=13+r()*17,ry=7+r()*9;g.save();g.translate(x,y);g.rotate((r()-.5)*.25);g.fillStyle='#4d8d3e';g.strokeStyle='rgba(22,64,39,.75)';g.lineWidth=2;g.beginPath();g.ellipse(0,0,rx,ry,0,0,Math.PI*2);g.fill();g.stroke();g.restore()}
  for(let i=0;i<16;i++){const x=20+r()*(W-40),y=88+r()*(H-176),rr=3+r()*6;g.fillStyle='rgba(110,116,91,.34)';g.beginPath();g.arc(x,y,rr,0,Math.PI*2);g.fill()}
  const vignette=g.createRadialGradient(W*.5,H*.48,W*.2,W*.5,H*.5,W*.7);vignette.addColorStop(.5,'rgba(5,18,13,0)');vignette.addColorStop(1,'rgba(4,16,14,.42)');g.fillStyle=vignette;g.fillRect(0,0,W,H);
  const h=document.createElement('canvas');h.width=W;h.height=H;const hg=h.getContext('2d');hg.fillStyle='#808080';hg.fillRect(0,0,W,H);return{diffuse:c,height:h};
}

export function createPondRenderer(G){
  const{W,H,state,canvas,DIRS}=G,F=G.fn,legacy=F.render;
  const surface=document.createElement('canvas');surface.id='pondCanvas';surface.width=canvas.width;surface.height=canvas.height;surface.setAttribute('aria-hidden','true');canvas.insertAdjacentElement('afterend',surface);
  let gl=null,p=null,vao=null,vbo=null,atlas=null,diffuseTex=null,heightTex=null,bgDiffuse=null,bgHeight=null,bgDepth=-1,ready=false,failed=false,lastError='';
  const vertexData=new Float32Array(MAX_SPRITES*VERTS_PER*STRIDE),pool=Array.from({length:MAX_SPRITES},()=>({})),active=[],lights=Array.from({length:MAX_LIGHTS},()=>({x:0,y:0,z:80,radius:120,color:[0,0,0]})),lightPosData=new Float32Array(MAX_LIGHTS*4),lightColorData=new Float32Array(MAX_LIGHTS*3);let count=0,drawn=0,lightCount=0;
  const loc={};
  function setup(){
    try{
      gl=surface.getContext('webgl2',{alpha:false,antialias:true,depth:false,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:'high-performance'});
      if(!gl)throw new Error('WebGL2 unavailable');p=program(gl);vao=gl.createVertexArray();vbo=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,vertexData.byteLength,gl.DYNAMIC_DRAW);const bytes=STRIDE*4;
      gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,bytes,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,bytes,8);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.FLOAT,false,bytes,16);gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,4,gl.FLOAT,false,bytes,20);
      loc.res=gl.getUniformLocation(p,'uResolution');loc.texel=gl.getUniformLocation(p,'uTexel');loc.ambient=gl.getUniformLocation(p,'uAmbient');loc.strength=gl.getUniformLocation(p,'uHeightStrength');loc.lightCount=gl.getUniformLocation(p,'uLightCount');loc.lightPos=gl.getUniformLocation(p,'uLightPosRadius[0]');loc.lightColor=gl.getUniformLocation(p,'uLightColor[0]');loc.diffuse=gl.getUniformLocation(p,'uDiffuse');loc.height=gl.getUniformLocation(p,'uHeight');
      atlas=createPondAtlas();diffuseTex=tex(gl,atlas.diffuse);heightTex=tex(gl,atlas.height);gl.useProgram(p);gl.uniform1i(loc.diffuse,0);gl.uniform1i(loc.height,1);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.DEPTH_TEST);ready=true;failed=false;document.documentElement.classList.add('pond-webgl');
    }catch(error){lastError=String(error?.message||error);ready=false;failed=true;document.documentElement.classList.remove('pond-webgl')}
  }
  surface.addEventListener('webglcontextlost',event=>{event.preventDefault();ready=false;failed=true;lastError='WebGL context lost';document.documentElement.classList.remove('pond-webgl')});
  surface.addEventListener('webglcontextrestored',()=>{failed=false;setup()});
  setup();
  function emit(sprite,x,y,w,h,{rot=0,layer=4,foot=y+h*.45,tint=[1,1,1,1]}={}){if(count>=MAX_SPRITES||!POND_SPRITES[sprite])return;const c=pool[count++];c.sprite=sprite;c.x=x;c.y=y;c.w=w;c.h=h;c.rot=rot;c.layer=layer;c.foot=foot;c.tint=tint}
  function emitShadow(x,y,w,h,layer=3){emit('shadow',x,y,w,h,{layer,foot:y+h*.5,tint:[1,1,1,.78]})}
  function spriteForBoss(){return state.worldDepth<=10?'dragonfly':state.worldDepth<=20?'hornet':'divingBeetle'}
  function collect(){
    count=0;
    for(const t of state.terrain){if(!t.active)continue;const sprite=TERRAIN_ART[t.type];if(sprite)emit(sprite,t.x,t.y,t.r*2.15,t.r*1.75,{layer:.4,foot:t.y-t.r*.2,tint:t.cracked?[.82,.82,.82,.9]:[1,1,1,.92]})}
    for(const c of state.gasClouds)emit('gas',c.x,c.y,c.r*2.25,c.r*2.25,{layer:1.4,foot:c.y,tint:c.type==='wild'?[.8,1,.86,.86]:[.92,1,.67,.9]});
    for(const b of state.foliage){if(!b.cut)emit('reeds',b.x,b.y,30,34,{layer:2.1,foot:b.y+12,tint:[.82,.96,.72,.9]})}
    for(const m of state.mushrooms){if(!m.cut){emitShadow(m.x,m.y+8,24,10,2.3);emit('mushroom',m.x,m.y,28,28,{layer:2.4,foot:m.y+12,tint:m.type==='venomcap'?[.92,1,.65,1]:[1,1,1,1]})}}
    for(const t of state.trees){const size=Math.max(52,t.r*2.5);emitShadow(t.x,t.y+9,size*.85,size*.25,2.5);emit(t.alive?'lilyBed':'driftwood',t.x,t.y,size,size*.78,{layer:2.6,foot:t.y+size*.32,tint:t.alive?[1,1,1,1]:[.72,.65,.54,.9]})}
    for(const d of state.debris)if(!d.dead){emitShadow(d.x,d.y+6,d.r*2.1,14,2.7);emit('driftwood',d.x,d.y,d.r*2.4,36,{rot:d.angle,layer:2.8,foot:d.y+12})}
    for(const b of state.brittle)if(!b.dead){emitShadow(b.x,b.y+8,b.r*2,14,2.7);emit('rock',b.x,b.y,b.r*2.1,b.r*1.7,{rot:b.angle*.2,layer:2.9,foot:b.y+b.r*.5})}
    for(const item of state.pickups){emit('spark',item.x,item.y,42,42,{layer:4.4,foot:item.y,tint:[.8,1,.68,.7]});emit('pickup',item.x,item.y,25,25,{rot:state.roomTime*.5+item.phase,layer:4.5,foot:item.y})}
    for(const e of state.enemies){if(e.dead)continue;const sprite=ENEMY_ART[e.type]||'fly',scale=e.type==='mech'||e.type==='mulcher'?2.5:2.15,w=Math.max(38,e.r*scale),h=w;emitShadow(e.x,e.y+e.r*.7,w*.78,w*.22,5);emit(sprite,e.x,e.y,w,h,{rot:e.angle||0,layer:5.1,foot:e.y+e.r*.65,tint:e.hitFlash>0?[1.3,.9,.82,1]:[1,1,1,1]});if(['telegraph','evade-telegraph'].includes(e.state))emit('spark',e.x,e.y,w*1.45,w*1.45,{layer:5.2,foot:e.y,tint:[1,.82,.42,.4]})}
    const b=state.boss;if(b&&!b.dead){const sprite=spriteForBoss(),size=Math.max(112,b.r*2.8);emitShadow(b.x,b.y+b.r*.8,size*.82,size*.22,5.3);emit(sprite,b.x,b.y,size,size,{rot:Math.sin(state.roomTime*1.7)*.08,layer:5.4,foot:b.y+b.r*.72,tint:b.heat>.65?[1.18,.82,.55,1]:[1,1,1,1]});if(b.telegraph>0)emit('spark',b.x,b.y,size*1.25,size*1.25,{layer:5.45,foot:b.y,tint:[1,.7,.38,.44]})}
    for(const s of state.shots){const angle=Math.atan2(s.vy,s.vx),sprite=s.friendly?'reflected':'stinger',size=s.friendly?25:18;emit(sprite,s.x,s.y,size,size*.62,{rot:angle,layer:6.1,foot:s.y,tint:s.friendly?[.86,1,.72,1]:[1,.86,.62,1]})}
    const p=state.player;if(p){const frogSize=Math.max(48,p.r*3.05),d=DIRS[p.cutDirection]||DIRS.right,angle=Math.atan2(d.y,d.x);emitShadow(p.x,p.y+p.r*.7,frogSize*.82,frogSize*.22,6.2);emit('frog',p.x,p.y-p.pose*1.5,frogSize,frogSize,{rot:angle,layer:6.3,foot:p.y+p.r*.68,tint:p.shieldCharges>0?[.86,1,1,1]:[1,1,1,1]});if(p.shieldCharges>0)emit('spark',p.x,p.y,frogSize*1.35,frogSize*1.35,{layer:6.35,foot:p.y,tint:[.62,.9,1,.28]})}
    for(const s of state.slashes){const d=DIRS[s.direction]||DIRS.right,angle=Math.atan2(d.y,d.x),life=Math.max(0,Math.min(1,s.life/.15)),len=Math.max(34,s.reach-5),cx=s.x+d.x*(len*.5+9),cy=s.y+d.y*(len*.5+9);emit('tongue',cx,cy,len,18,{rot:angle,layer:7.1,foot:cy,tint:[1,1,1,.65+.35*life]});emit('spark',s.x+d.x*s.reach,s.y+d.y*s.reach,38,38,{layer:7.2,foot:s.y+d.y*s.reach,tint:[1,.9,.68,.18+.25*life]})}
    for(const p of state.particles){emit('spark',p.x,p.y,Math.max(5,p.size*4.5),Math.max(5,p.size*4.5),{layer:7.4,foot:p.y,tint:[1,1,1,Math.min(.65,p.life/p.maxLife)]})}
  }
  function addLight(x,y,z,radius,color){if(lightCount>=MAX_LIGHTS)return;const l=lights[lightCount++];l.x=x;l.y=y;l.z=z;l.radius=radius;l.color=color}
  function collectLights(){
    lightCount=0;const p=state.player;if(p)addLight(p.x,p.y,92,185,[.34,.54,.20]);
    let hostile=null,hd=Infinity,friendly=null,fd=Infinity;for(const s of state.shots){const d=p?Math.hypot(s.x-p.x,s.y-p.y):9999;if(s.friendly){if(d<fd){fd=d;friendly=s}}else if(d<hd){hd=d;hostile=s}}
    if(hostile)addLight(hostile.x,hostile.y,68,135,[.62,.36,.12]);if(friendly)addLight(friendly.x,friendly.y,74,155,[.28,.62,.24]);
    for(const c of state.gasClouds){if(lightCount>=MAX_LIGHTS)break;addLight(c.x,c.y,52,Math.max(100,c.r*1.65),[.22,.36,.09])}
    if(state.boss&&!state.boss.dead&&lightCount<MAX_LIGHTS)addLight(state.boss.x,state.boss.y,110,220,state.boss.heat>.65?[.58,.22,.08]:[.26,.22,.10]);
  }
  function syncCanvas(){if(surface.width!==canvas.width||surface.height!==canvas.height){surface.width=canvas.width;surface.height=canvas.height}gl.viewport(0,0,surface.width,surface.height)}
  function ensureBackground(){if(bgDepth===state.worldDepth&&bgDiffuse&&bgHeight)return;const bg=pondBackground(W,H,state.worldDepth);if(bgDiffuse)gl.deleteTexture(bgDiffuse);if(bgHeight)gl.deleteTexture(bgHeight);bgDiffuse=tex(gl,bg.diffuse);bgHeight=tex(gl,bg.height);bgDepth=state.worldDepth}
  function useTextures(a,b,w,h){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,a);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,b);gl.uniform2f(loc.texel,1/w,1/h)}
  function writeQuadFrame(command,f,offset){const hw=command.w*.5,hh=command.h*.5,c=Math.cos(command.rot),s=Math.sin(command.rot),depth=Math.max(-.99,Math.min(.99,(command.layer*1000+command.foot)/(1000*12)))*.5,t=command.tint;function put(i,lx,ly,u,v){const j=offset+i*STRIDE;vertexData[j]=command.x+lx*c-ly*s;vertexData[j+1]=command.y+lx*s+ly*c;vertexData[j+2]=u;vertexData[j+3]=v;vertexData[j+4]=depth;vertexData[j+5]=t[0];vertexData[j+6]=t[1];vertexData[j+7]=t[2];vertexData[j+8]=t[3]}put(0,-hw,-hh,f.u0,f.v0);put(1,hw,-hh,f.u1,f.v0);put(2,hw,hh,f.u1,f.v1);put(3,-hw,-hh,f.u0,f.v0);put(4,hw,hh,f.u1,f.v1);put(5,-hw,hh,f.u0,f.v1)}
  function writeQuad(command,offset){writeQuadFrame(command,POND_SPRITES[command.sprite],offset)}
  function uniforms(){gl.useProgram(p);gl.uniform2f(loc.res,W,H);gl.uniform3f(loc.ambient,.69,.72,.64);gl.uniform1f(loc.strength,5.25);gl.uniform1i(loc.lightCount,lightCount);lightPosData.fill(0);lightColorData.fill(0);for(let i=0;i<lightCount;i++){const l=lights[i],j=i*4,k=i*3;lightPosData[j]=l.x;lightPosData[j+1]=l.y;lightPosData[j+2]=l.z;lightPosData[j+3]=l.radius;lightColorData[k]=l.color[0];lightColorData[k+1]=l.color[1];lightColorData[k+2]=l.color[2]}gl.uniform4fv(loc.lightPos,lightPosData);gl.uniform3fv(loc.lightColor,lightColorData)}
  function drawBackground(){const command={x:W*.5,y:H*.5,w:W,h:H,rot:0,layer:-1,foot:0,tint:[1,1,1,1]},frame={u0:0,v0:0,u1:1,v1:1};writeQuadFrame(command,frame,0);useTextures(bgDiffuse,bgHeight,W,H);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferSubData(gl.ARRAY_BUFFER,0,vertexData.subarray(0,VERTS_PER*STRIDE));gl.drawArrays(gl.TRIANGLES,0,6)}
  function drawBatch(){active.length=count;for(let i=0;i<count;i++)active[i]=pool[i];active.sort((a,b)=>a.layer-b.layer||a.foot-b.foot);drawn=Math.min(count,MAX_SPRITES);for(let i=0;i<drawn;i++)writeQuad(active[i],i*VERTS_PER*STRIDE);useTextures(diffuseTex,heightTex,atlas.size,atlas.size);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferSubData(gl.ARRAY_BUFFER,0,vertexData.subarray(0,drawn*VERTS_PER*STRIDE));gl.drawArrays(gl.TRIANGLES,0,drawn*VERTS_PER)}
  function render(){if(!ready||failed||!gl||gl.isContextLost())return false;try{syncCanvas();ensureBackground();collect();collectLights();gl.clearColor(.04,.11,.08,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.bindVertexArray(vao);uniforms();drawBackground();drawBatch();return true}catch(error){lastError=String(error?.message||error);ready=false;failed=true;document.documentElement.classList.remove('pond-webgl');return false}}
  function displayRoomName(depth=state.worldDepth){return POND_ROOM_NAMES[(depth-1)%POND_ROOM_NAMES.length]||`Pond ${depth}`}
  return{version:'0.12.0',engineVersion:'0.11.1',surface,render,legacy,displayRoomName,get ready(){return ready&&!failed},snapshot:()=>({version:'0.12.0',engineVersion:'0.11.1',mode:ready&&!failed?'webgl2':'canvas-fallback',ready:ready&&!failed,error:lastError,sprites:drawn,lights:lightCount,maxSprites:MAX_SPRITES,roomName:displayRoomName(),enemyArt:{...ENEMY_ART},terrainArt:{...TERRAIN_ART}})};
}
