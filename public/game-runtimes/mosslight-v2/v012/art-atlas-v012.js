const CELL=128,ATLAS=1024;
const NAMES=[
  'frog','fly','bee','mosquito','beetle','dragonfly','hornet','moth','crane','divingBeetle','wasp',
  'lilyBed','reeds','driftwood','rock','shrub','mushroom','pickup','lilyPad','tongue','stinger','reflected',
  'water','mud','bank','algae','tangle','shells','gas','shadow','spark'
];

const frames=Object.freeze(Object.fromEntries(NAMES.map((name,index)=>{
  const x=(index%8)*CELL,y=Math.floor(index/8)*CELL;
  return[name,Object.freeze({x,y,w:CELL,h:CELL,u0:x/ATLAS,v0:y/ATLAS,u1:(x+CELL)/ATLAS,v1:(y+CELL)/ATLAS})];
})));

function ellipse(g,x,y,rx,ry,fill,stroke=null,line=2,rot=0){g.save();g.translate(x,y);g.rotate(rot);g.beginPath();g.ellipse(0,0,rx,ry,0,0,Math.PI*2);g.fillStyle=fill;g.fill();if(stroke){g.lineWidth=line;g.strokeStyle=stroke;g.stroke()}g.restore()}
function path(g,pts,fill,stroke=null,line=2){g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=fill;g.fill();if(stroke){g.lineWidth=line;g.strokeStyle=stroke;g.stroke()}}
function wing(g,x,y,rx,ry,rot){g.save();g.translate(x,y);g.rotate(rot);const grad=g.createLinearGradient(-rx,0,rx,0);grad.addColorStop(0,'rgba(240,252,247,.28)');grad.addColorStop(.45,'rgba(237,250,255,.78)');grad.addColorStop(1,'rgba(196,231,235,.18)');g.fillStyle=grad;g.strokeStyle='rgba(31,53,47,.58)';g.lineWidth=2;g.beginPath();g.ellipse(0,0,rx,ry,0,0,Math.PI*2);g.fill();g.stroke();g.restore()}
function eye(g,x,y,r=5){ellipse(g,x,y,r,r,'#f6f5d8','#152319',2);ellipse(g,x+1,y,Math.max(1.8,r*.38),Math.max(1.8,r*.38),'#111812')}
function leg(g,x1,y1,x2,y2,x3,y3,color='#263328',width=3){g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.lineJoin='round';g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.lineTo(x3,y3);g.stroke()}
function bugBody(g,color,accent='#1b2520'){const grad=g.createLinearGradient(28,45,98,80);grad.addColorStop(0,color);grad.addColorStop(1,accent);return grad}
function drawFrog(g){
  ellipse(g,59,71,31,24,'#68c857','#183524',3,-.08);
  ellipse(g,77,53,25,20,'#83d865','#183524',3,-.03);
  ellipse(g,45,80,18,10,'#4eab4d','#183524',3,.25);ellipse(g,49,88,17,7,'#4d9c48','#183524',2,.15);
  ellipse(g,68,87,17,8,'#4d9c48','#183524',2,-.18);ellipse(g,89,75,13,8,'#55b751','#183524',2,.15);
  eye(g,69,39,6);eye(g,86,42,6);
  g.strokeStyle='#20472e';g.lineWidth=2;g.beginPath();g.arc(81,58,11,.15,2.25);g.stroke();
  for(const [x,y,r] of [[48,59,5],[58,72,4],[69,69,3],[43,75,3],[80,61,3]])ellipse(g,x,y,r,r,'rgba(37,110,57,.55)');
  g.strokeStyle='#d7efb5';g.lineWidth=2;g.beginPath();g.moveTo(72,60);g.quadraticCurveTo(84,65,94,60);g.stroke();
}
function drawFly(g){wing(g,49,48,20,9,-.55);wing(g,71,48,20,9,.55);ellipse(g,61,66,13,23,bugBody(g,'#343b36','#111714'),'#0c110e',3);ellipse(g,61,45,11,9,'#202822','#0b0f0d',3);eye(g,55,43,3.8);eye(g,67,43,3.8);for(let i=0;i<3;i++){leg(g,53,61+i*7,36,60+i*11,27,55+i*13);leg(g,69,61+i*7,86,60+i*11,95,55+i*13)}}
function drawBee(g){wing(g,49,49,22,9,-.48);wing(g,74,48,22,9,.48);ellipse(g,62,67,16,28,bugBody(g,'#e3ab33','#9a6619'),'#2a2114',3);for(const y of[55,68,81]){g.fillStyle='#302819';g.fillRect(47,y,30,7)}ellipse(g,62,44,12,10,'#302819','#17130d',3);eye(g,56,42,3.5);eye(g,68,42,3.5);path(g,[[62,96],[56,84],[68,84]],'#d6922a','#2a2114',2)}
function drawMosquito(g){wing(g,48,54,23,7,-.55);wing(g,74,54,23,7,.55);ellipse(g,61,67,7,21,'#435d56','#16241f',2);ellipse(g,61,49,8,8,'#344d48','#16241f',2);g.strokeStyle='#222f2c';g.lineWidth=3;g.beginPath();g.moveTo(62,48);g.lineTo(92,37);g.stroke();for(let i=0;i<3;i++){leg(g,58,60+i*7,36,55+i*12,23,46+i*15,'#2f413c',2);leg(g,65,60+i*7,87,55+i*12,100,46+i*15,'#2f413c',2)}}
function drawBeetle(g){ellipse(g,63,65,25,30,bugBody(g,'#3e8f78','#163f38'),'#132821',3);g.strokeStyle='#b9e0bf';g.lineWidth=2;g.beginPath();g.moveTo(63,38);g.lineTo(63,92);g.stroke();ellipse(g,63,40,15,11,'#203e36','#132821',3);for(let i=0;i<3;i++){leg(g,45,55+i*11,28,50+i*14,19,42+i*18);leg(g,81,55+i*11,98,50+i*14,107,42+i*18)}}
function drawDragonfly(g){wing(g,46,52,27,7,-.25);wing(g,78,52,27,7,.25);wing(g,45,67,27,7,.25);wing(g,79,67,27,7,-.25);ellipse(g,63,60,7,14,'#2f91a4','#173238',2);for(let i=0;i<5;i++)ellipse(g,63,73+i*7,5.5,6.2,i%2?'#225b83':'#2d7a9d','#173238',1.5);ellipse(g,63,42,9,8,'#183a42','#142a2e',2);eye(g,57,41,3);eye(g,69,41,3)}
function drawHornet(g){wing(g,49,50,21,8,-.45);wing(g,75,50,21,8,.45);ellipse(g,62,67,15,26,bugBody(g,'#d87c21','#7e351a'),'#291813',3);for(const y of[57,71,83]){g.fillStyle='#241914';g.fillRect(48,y,28,6)}ellipse(g,62,44,12,10,'#47241a','#24130f',3);path(g,[[62,98],[56,84],[68,84]],'#c75d1c','#291813',2);g.strokeStyle='#271a14';g.lineWidth=2;g.beginPath();g.moveTo(56,37);g.quadraticCurveTo(45,25,40,34);g.moveTo(68,37);g.quadraticCurveTo(79,25,84,34);g.stroke()}
function drawMoth(g){wing(g,47,59,25,21,-.2);wing(g,77,59,25,21,.2);ellipse(g,62,65,8,24,'#8d7259','#31271f',2);ellipse(g,62,43,9,8,'#6c5847','#31271f',2);for(const [x,y] of[[39,57],[48,70],[84,57],[76,70]])ellipse(g,x,y,5,4,'rgba(117,83,62,.85)')}
function drawCrane(g){wing(g,49,55,22,8,-.5);wing(g,74,55,22,8,.5);ellipse(g,62,61,5,19,'#6d776b','#283029',2);ellipse(g,62,44,7,7,'#59665c','#283029',2);for(let i=0;i<3;i++){leg(g,59,56+i*6,33,47+i*15,18,31+i*22,'#4b554c',2);leg(g,65,56+i*6,91,47+i*15,106,31+i*22,'#4b554c',2)}}
function drawDiving(g){ellipse(g,63,65,26,31,bugBody(g,'#254e63','#0d2833'),'#0a1b21',3);ellipse(g,63,42,16,10,'#173847','#0a1b21',3);g.strokeStyle='#72b4c1';g.lineWidth=2;for(const x of[55,63,71]){g.beginPath();g.moveTo(x,42);g.lineTo(x,91);g.stroke()}for(let i=0;i<3;i++){leg(g,44,58+i*10,26,55+i*11,15,60+i*12,'#1a3946',3);leg(g,82,58+i*10,100,55+i*11,111,60+i*12,'#1a3946',3)}}
function drawWasp(g){drawHornet(g);g.save();g.globalAlpha=.28;ellipse(g,63,66,23,34,'#ffcb4c');g.restore()}
function drawLilyBed(g){ellipse(g,65,74,35,16,'rgba(13,52,44,.34)');for(const [x,y,s] of[[44,69,22],[67,61,25],[83,75,20],[58,82,21]]){ellipse(g,x,y,s,s*.62,'#4f9f43','#214d2d',2,.1);g.strokeStyle='rgba(213,234,153,.55)';g.lineWidth=1.5;g.beginPath();g.moveTo(x,y);g.lineTo(x+s*.6,y-2);g.stroke()}ellipse(g,69,53,7,5,'#e7a7c8','#7d4d63',1.5);for(let i=0;i<7;i++){g.save();g.translate(69,53);g.rotate(i*Math.PI*2/7);ellipse(g,0,-7,3,7,'#f5cadb');g.restore()}}
function drawReeds(g){for(let i=0;i<10;i++){const x=31+i*7,y=91-(i%3)*4,h=40+(i%4)*7;g.strokeStyle=i%2?'#5b7b2b':'#7c9635';g.lineWidth=4;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+(i%2?5:-5),y-h*.5,x+(i%3-1)*2,y-h);g.stroke();if(i%3===0)ellipse(g,x+(i%3-1)*2,y-h,4,9,'#8c5e2f','#3b2c1d',1.5)}g.fillStyle='rgba(42,85,37,.35)';g.fillRect(26,89,76,9)}
function drawDriftwood(g){g.save();g.translate(64,65);g.rotate(-.22);const grad=g.createLinearGradient(-43,0,43,0);grad.addColorStop(0,'#5f3e24');grad.addColorStop(.5,'#a56f3a');grad.addColorStop(1,'#5b3822');g.fillStyle=grad;g.strokeStyle='#3b281b';g.lineWidth=3;g.beginPath();g.roundRect(-44,-12,88,24,10);g.fill();g.stroke();for(const x of[-22,3,27]){g.strokeStyle='rgba(56,34,20,.55)';g.beginPath();g.moveTo(x,-10);g.lineTo(x+7,10);g.stroke()}g.restore()}
function drawRock(g){const grad=g.createRadialGradient(48,43,5,65,67,38);grad.addColorStop(0,'#c6ccb9');grad.addColorStop(.5,'#87917d');grad.addColorStop(1,'#48564a');path(g,[[31,83],[25,61],[39,38],[65,27],[91,42],[103,67],[90,89],[56,98]],grad,'#344137',3);g.strokeStyle='rgba(236,242,221,.35)';g.lineWidth=3;g.beginPath();g.moveTo(42,48);g.lineTo(63,37);g.lineTo(79,43);g.stroke()}
function drawShrub(g){for(const [x,y,r,c] of[[43,68,20,'#376f39'],[61,54,24,'#4b8a43'],[80,69,22,'#39773b'],[61,78,25,'#3e7e3f']])ellipse(g,x,y,r,r*.8,c,'#244f2c',2);for(const [x,y] of[[50,52],[71,47],[82,66],[57,75]])ellipse(g,x,y,3,3,'#9ecf6c')}
function drawMushroom(g){g.fillStyle='#ded1ae';g.fillRect(59,61,9,31);const grad=g.createRadialGradient(56,47,4,64,54,28);grad.addColorStop(0,'#ff8b85');grad.addColorStop(1,'#b6364c');g.fillStyle=grad;g.strokeStyle='#5e2734';g.lineWidth=3;g.beginPath();g.arc(64,58,26,Math.PI,Math.PI*2);g.lineTo(90,61);g.lineTo(38,61);g.closePath();g.fill();g.stroke();for(const [x,y,r] of[[49,49,4],[65,42,5],[78,51,3]])ellipse(g,x,y,r,r,'#f7e8cf')}
function drawPickup(g){const grad=g.createRadialGradient(55,50,3,64,64,30);grad.addColorStop(0,'#f9ffe3');grad.addColorStop(.35,'#a7e879');grad.addColorStop(1,'rgba(57,148,91,.12)');ellipse(g,64,64,29,29,grad,'rgba(220,255,196,.7)',2);path(g,[[64,44],[69,58],[84,61],[71,69],[75,84],[64,75],[53,84],[57,69],[44,61],[59,58]],'#f0ffc1','#609b5b',2)}
function drawLilyPad(g){ellipse(g,64,67,38,23,'#4b9240','#244b2f',3,-.06);path(g,[[64,67],[91,51],[79,73]],'#214d31');g.strokeStyle='rgba(212,238,161,.42)';g.lineWidth=2;g.beginPath();g.moveTo(64,67);g.lineTo(42,78);g.stroke()}
function drawTongue(g){const grad=g.createLinearGradient(18,64,110,64);grad.addColorStop(0,'#b84f63');grad.addColorStop(.55,'#ef8094');grad.addColorStop(1,'#ffb2bd');g.strokeStyle='#7d3042';g.lineWidth=18;g.lineCap='round';g.beginPath();g.moveTo(18,64);g.quadraticCurveTo(66,51,108,64);g.stroke();g.strokeStyle=grad;g.lineWidth=12;g.beginPath();g.moveTo(18,64);g.quadraticCurveTo(66,51,108,64);g.stroke();ellipse(g,108,64,11,9,'#ff9aae','#7d3042',2)}
function drawStinger(g){path(g,[[27,64],[83,51],[102,64],[83,77]],'#e6b24e','#5c421b',3);g.strokeStyle='#fff0a3';g.lineWidth=2;g.beginPath();g.moveTo(36,61);g.lineTo(82,55);g.stroke()}
function drawReflected(g){const grad=g.createRadialGradient(64,64,2,64,64,26);grad.addColorStop(0,'#fffbd6');grad.addColorStop(.35,'#dcffb8');grad.addColorStop(1,'rgba(122,224,111,.05)');ellipse(g,64,64,28,28,grad);path(g,[[92,64],[54,48],[62,64],[54,80]],'#efffca','#f7ffe7',2)}
function drawTerrain(g,type){const palettes={water:['rgba(62,144,153,.85)','rgba(25,86,99,.3)'],mud:['rgba(102,75,45,.9)','rgba(60,49,35,.2)'],bank:['rgba(184,160,91,.82)','rgba(103,91,54,.18)'],algae:['rgba(93,139,62,.82)','rgba(43,77,44,.2)'],tangle:['rgba(42,86,39,.88)','rgba(22,52,29,.22)'],shells:['rgba(143,153,139,.78)','rgba(61,72,67,.2)']};const [a,b]=palettes[type];const grad=g.createRadialGradient(55,52,12,64,64,58);grad.addColorStop(0,a);grad.addColorStop(1,b);ellipse(g,64,64,56,48,grad,`rgba(225,239,204,.18)`,2);if(type==='water'){g.strokeStyle='rgba(194,241,236,.48)';g.lineWidth=2;for(const y of[50,66,81]){g.beginPath();g.arc(64,y,28,0,Math.PI);g.stroke()}}else if(type==='mud'){for(const [x,y] of[[41,56],[74,47],[83,72],[52,81]])ellipse(g,x,y,9,4,'rgba(46,37,27,.28)',null,0,.2)}else if(type==='algae'){for(const [x,y,r] of[[39,57,13],[64,45,15],[81,70,14],[56,83,10]])ellipse(g,x,y,r,r*.55,'rgba(125,171,72,.28)')}else if(type==='tangle'){g.strokeStyle='rgba(150,191,82,.7)';g.lineWidth=4;for(let i=0;i<8;i++){g.beginPath();g.moveTo(28+i*10,92);g.quadraticCurveTo(20+i*11,59,35+i*8,29);g.stroke()}}else if(type==='shells'){for(let i=0;i<9;i++){const x=34+(i*29)%64,y=37+(i*19)%54;path(g,[[x-5,y+5],[x,y-8],[x+6,y+4]],'rgba(218,220,201,.64)','rgba(66,74,68,.4)',1)}}}
function drawGas(g){const grad=g.createRadialGradient(64,64,4,64,64,54);grad.addColorStop(0,'rgba(209,238,117,.35)');grad.addColorStop(.55,'rgba(149,193,79,.18)');grad.addColorStop(1,'rgba(102,161,75,0)');ellipse(g,64,64,56,56,grad);for(const [x,y,r] of[[42,51,20],[72,45,18],[82,72,22],[51,78,18]])ellipse(g,x,y,r,r,'rgba(184,222,101,.10)')}
function drawShadow(g){const grad=g.createRadialGradient(64,64,3,64,64,49);grad.addColorStop(0,'rgba(4,12,9,.48)');grad.addColorStop(1,'rgba(4,12,9,0)');ellipse(g,64,64,50,24,grad)}
function drawSpark(g){const grad=g.createRadialGradient(64,64,1,64,64,36);grad.addColorStop(0,'rgba(255,255,226,1)');grad.addColorStop(.25,'rgba(214,248,153,.8)');grad.addColorStop(1,'rgba(161,227,109,0)');ellipse(g,64,64,38,38,grad);for(let i=0;i<8;i++){g.save();g.translate(64,64);g.rotate(i*Math.PI/4);g.fillStyle='rgba(249,255,208,.75)';g.fillRect(28,-1,22,2);g.restore()}}

const painters={frog:drawFrog,fly:drawFly,bee:drawBee,mosquito:drawMosquito,beetle:drawBeetle,dragonfly:drawDragonfly,hornet:drawHornet,moth:drawMoth,crane:drawCrane,divingBeetle:drawDiving,wasp:drawWasp,lilyBed:drawLilyBed,reeds:drawReeds,driftwood:drawDriftwood,rock:drawRock,shrub:drawShrub,mushroom:drawMushroom,pickup:drawPickup,lilyPad:drawLilyPad,tongue:drawTongue,stinger:drawStinger,reflected:drawReflected,water:g=>drawTerrain(g,'water'),mud:g=>drawTerrain(g,'mud'),bank:g=>drawTerrain(g,'bank'),algae:g=>drawTerrain(g,'algae'),tangle:g=>drawTerrain(g,'tangle'),shells:g=>drawTerrain(g,'shells'),gas:drawGas,shadow:drawShadow,spark:drawSpark};

function buildHeight(diffuse){
  const tmp=document.createElement('canvas');tmp.width=tmp.height=ATLAS;const t=tmp.getContext('2d',{willReadFrequently:true}),src=diffuse.getContext('2d').getImageData(0,0,ATLAS,ATLAS),data=src.data;
  for(let i=0;i<data.length;i+=4){const a=data[i+3],lum=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2],h=a?Math.min(255,62+lum*.72):0;data[i]=data[i+1]=data[i+2]=h;data[i+3]=a}
  t.putImageData(src,0,0);const out=document.createElement('canvas');out.width=out.height=ATLAS;const o=out.getContext('2d');o.clearRect(0,0,ATLAS,ATLAS);o.filter='blur(1.25px)';o.drawImage(tmp,0,0);o.filter='none';return out;
}

export function createPondAtlas(){
  const diffuse=document.createElement('canvas');diffuse.width=diffuse.height=ATLAS;const g=diffuse.getContext('2d');g.clearRect(0,0,ATLAS,ATLAS);g.lineCap='round';g.lineJoin='round';
  for(const name of NAMES){const f=frames[name];g.save();g.translate(f.x,f.y);painters[name]?.(g);g.restore()}
  return{diffuse,height:buildHeight(diffuse),frames,size:ATLAS,cell:CELL};
}

export{frames as POND_SPRITES};
