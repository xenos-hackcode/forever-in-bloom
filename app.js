const canvas = document.querySelector('#galaxy');
const ctx = canvas.getContext('2d', {alpha:false});
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const viewer = document.querySelector('#viewer');
const intro = document.querySelector('#intro');
const controls = document.querySelector('.controls');
const hint = document.querySelector('.hint');
let width=0,height=0,focal=600,last=0,travel=0,clock=0,paused=true;
let yaw=0,pitch=0,targetYaw=0,targetPitch=0,selected=0,drag=null,hitAreas=[];
let zoom=1,targetZoom=1;
const pointers=new Map();
let pinchDistance=0;
const depth=4800;
const MESSAGES=['Forever in Bloom','Jennifer & Mosheh','19.12.2026','#TheJMAffairs’26'];
// Everything in the scene is drawn with canvas primitives (paths, gradients, text) —
// no raster screenshots are tumbled around; only a couple of real portrait photos
// (set in photos.js) are composited onto the coded card frame, if any are provided.
let seed=1219;
function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
const images=(typeof PHOTOS!=='undefined'?PHOTOS:[]).map(name=>{const img=new Image();img.src='./'+encodeURIComponent(name);return img;});
if(images.length)Promise.all(images.map(img=>img.decode().catch(()=>null))).then(()=>{document.querySelector('#loading').hidden=true;});
else document.querySelector('#loading').hidden=true;
const CARD_VARIANTS=['monogram','names','quote'];
const CARD_COUNT=12;
const objects=Array.from({length:150},(_,i)=>{
  if(i<CARD_COUNT){
    return {kind:'card',variant:CARD_VARIANTS[i%CARD_VARIANTS.length],
      x:Math.cos(i*2.39996)*(850+(i%3)*360),y:Math.sin(i*2.39996)*(500+(i%3)*180),z:1300+(i%4)*700,
      index:images.length?i%images.length:0,
      size:420+random()*60,angle:(random()-.5)*.12,tilt:(random()-.5)*.18,phase:random()*Math.PI*2};
  }
  if(i%3===0){
    return {kind:'msg',x:(random()-.5)*4200,y:(random()-.5)*2700,z:random()*depth,
      msg:Math.floor(random()*MESSAGES.length),size:1,angle:0,tilt:0,phase:random()*Math.PI*2};
  }
  return {kind:'bokeh',x:(random()-.5)*4600,y:(random()-.5)*2900,z:random()*depth,
    size:4+random()*10,angle:0,tilt:0,phase:random()*Math.PI*2,hue:random()};
});
function roundRect(c,x,y,w,h,r){
  c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();
}
function drawCard(c,o,w,h){
  const image=images[o.index];
  if(image && image.complete && image.naturalWidth){
    const padding=w*.055;
    c.shadowColor='#00000080';c.shadowBlur=w*.16;c.shadowOffsetY=w*.04;
    roundRect(c,-w/2,-h/2,w,h,w*.018);c.fillStyle='#efe3cf';c.fill();
    c.shadowBlur=0;c.shadowOffsetY=0;
    c.strokeStyle='#b99060';c.lineWidth=Math.max(.6,w*.003);
    roundRect(c,-w/2+w*.022,-h/2+w*.022,w*.956,h-w*.044,w*.01);c.stroke();
    const areaWidth=w-padding*2,areaHeight=h-padding*2-w*.1;
    const fit=Math.min(areaWidth/image.naturalWidth,areaHeight/image.naturalHeight);
    const imageWidth=image.naturalWidth*fit,imageHeight=image.naturalHeight*fit;
    c.drawImage(image,-imageWidth/2,-h/2+padding+(areaHeight-imageHeight)/2,imageWidth,imageHeight);
    c.textAlign='center';c.textBaseline='middle';c.fillStyle='#795a3f';
    c.font=`500 ${w*.039}px 'Jost',Arial,sans-serif`;
    c.fillText(o.index===0?'THE INVITATION · 19.12.26':'A TOAST TO OUR FOREVER',0,h/2-padding-w*.035);
    return;
  }
  const r=w*.06;
  c.shadowColor='#000000a0';c.shadowBlur=.11*w;
  const bg=c.createLinearGradient(0,-h/2,0,h/2);
  bg.addColorStop(0,'#fdf8ee');bg.addColorStop(.7,'#f6ead3');bg.addColorStop(1,'#f0e0bd');
  roundRect(c,-w/2,-h/2,w,h,r);c.fillStyle=bg;c.fill();
  c.shadowBlur=0;
  roundRect(c,-w/2+w*.045,-h/2+w*.045,w*.91,h-w*.09,r*.8);
  c.lineWidth=Math.max(1,w*.012);c.strokeStyle='#b5591f';c.stroke();
  c.textAlign='center';c.textBaseline='middle';
  if(o.variant==='monogram'){
    const img=images[o.index];
    if(img&&img.complete&&img.naturalWidth){
      const d=Math.min(w,h)*.58;
      c.save();c.beginPath();c.arc(0,-h*.04,d/2,0,Math.PI*2);c.clip();
      const iw=img.naturalWidth,ih=img.naturalHeight,s=Math.max(d/iw,d/ih);
      c.drawImage(img,-iw*s/2,-h*.04-ih*s/2,iw*s,ih*s);
      c.restore();
      c.beginPath();c.arc(0,-h*.04,d/2,0,Math.PI*2);c.lineWidth=w*.02;c.strokeStyle='#b5591f';c.stroke();
    }else{
      c.font=`500 ${w*.26}px 'Great Vibes',cursive`;c.fillStyle='#b5591f';
      c.fillText('J',-w*.13,-h*.05);
      c.font=`${w*.11}px 'Cormorant Garamond',serif`;c.fillStyle='#2f6f62';c.fillText('&',0,-h*.02);
      c.font=`500 ${w*.26}px 'Great Vibes',cursive`;c.fillStyle='#b5591f';c.fillText('M',w*.14,-h*.05);
    }
    c.font=`600 ${w*.072}px 'Jost',Arial,sans-serif`;c.fillStyle='#5a3a21';
    c.fillText('19 · 12 · 2026',0,h*.36);
  }else if(o.variant==='names'){
    const maxTextWidth=w*.8;
    function fitFont(text,startPx,minPx){
      let px=startPx;
      c.font=`500 ${px}px 'Great Vibes',cursive`;
      while(px>minPx&&c.measureText(text).width>maxTextWidth){
        px-=1;c.font=`500 ${px}px 'Great Vibes',cursive`;
      }
      return px;
    }
    const namePx=Math.min(fitFont('Jennifer',w*.165,w*.08),fitFont('Mosheh',w*.165,w*.08));
    c.font=`500 ${namePx}px 'Great Vibes',cursive`;c.fillStyle='#b5591f';
    c.fillText('Jennifer',0,-h*.14);
    c.font=`${w*.085}px 'Cormorant Garamond',serif`;c.fillStyle='#2f6f62';c.fillText('&',0,h*.02);
    c.font=`500 ${namePx}px 'Great Vibes',cursive`;c.fillStyle='#b5591f';c.fillText('Mosheh',0,h*.2);
    c.font=`${w*.055}px 'Jost',Arial,sans-serif`;c.fillStyle='#5a3a21';c.fillText('❧ ❦ ❧',0,h*.37);
  }else{
    c.font=`italic 500 ${w*.084}px 'Cormorant Garamond',serif`;c.fillStyle='#4a3115';
    const lines=['"A cord of three','strands is not','quickly broken."'];
    lines.forEach((l,i)=>c.fillText(l,0,-h*.12+i*w*.1));
    c.font=`${w*.06}px 'Jost',Arial,sans-serif`;c.fillStyle='#2f6f62';c.fillText('Ecclesiastes 4:12',0,h*.3);
  }
}
function resize(){width=innerWidth;height=innerHeight;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);focal=Math.max(width*.65,height*.75);}
addEventListener('resize',resize);resize();
function project(object){
  let z=((object.z-travel)%depth+depth)%depth-200;
  const x=object.x,y=object.y;
  const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
  const xx=x*cy-z*sy,zz=x*sy+z*cy;
  const yy=y*cp-zz*sp,zzz=y*sp+zz*cp;
  if(zzz<65)return null;
  const scale=focal*zoom/zzz;
  const px=width/2+xx*scale,py=height/2+yy*scale;
  const size=object.size*scale;
  if(px < -size*2 || px > width+size*2 || py < -size*2 || py > height+size*2)return null;
  return {object,x:px,y:py,z:zzz,scale,alpha:Math.min(1,(zzz-65)/240)*Math.max(.08,1-Math.pow(zzz/5100,.7))};
}
let autoResumeAt=0;
function render(now){
  const dt=Math.min((now-last)/1000||0, .05);last=now;
  if(!paused&&!viewer.open&&!document.hidden){travel+=dt*24;clock+=dt;}
  zoom+=(targetZoom-zoom)*(reducedMotion?1:.18);
  if(!paused&&!reducedMotion&&!drag&&now>autoResumeAt){targetYaw+=dt*.42;}
  yaw+=(targetYaw+(!paused&&!reducedMotion?Math.sin(clock*.13)*.12:0)-yaw)*.14;
  pitch+=(targetPitch+(!paused&&!reducedMotion?Math.sin(clock*.17)*.055:0)-pitch)*.14;
  if(images.some(img=>img.complete&&img.naturalWidth))document.querySelector('#loading').hidden=true;
  ctx.fillStyle='#201910';ctx.fillRect(0,0,width,height);
  const vgrad=ctx.createRadialGradient(width/2,height*.42,0,width/2,height*.42,Math.max(width,height)*.75);
  vgrad.addColorStop(0,'#534333');vgrad.addColorStop(.5,'#30281e');vgrad.addColorStop(1,'#171410');
  ctx.fillStyle=vgrad;ctx.fillRect(0,0,width,height);
  hitAreas=[];
  const visible=objects.map(project).filter(Boolean).sort((a,b)=>b.z-a.z);
  for(const p of visible){
    const o=p.object;ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=p.alpha;
    if(o.kind==='card'){
      const h=o.size*p.scale,w=h*.72;
      ctx.rotate(o.angle);ctx.transform(Math.cos(o.tilt+yaw*.5),Math.sin(o.tilt)*.15,0,1,0,0);
      drawCard(ctx,o,w,h);
      if(p.alpha>.18)hitAreas.push({x:p.x,y:p.y,w,h,index:o.index});
    }else if(o.kind==='msg'){
      const fontSize=(o.msg===1?22:26)*p.scale;
      ctx.font=`${o.msg===1?'italic 500':'600'} ${fontSize}px ${o.msg===1?"'Great Vibes',cursive":"'Cormorant Garamond',serif"}`;
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillStyle=o.msg%2===0?'#d6b68d':'#a2b4a0';
      ctx.globalAlpha*=.4;ctx.shadowBlur=0;
      ctx.fillText(MESSAGES[o.msg],0,0);
    }else{
      const r=o.size*p.scale*.5;
      ctx.fillStyle=o.hue>.5?'#d4a874':'#a3ad91';ctx.globalAlpha*=.35;
      ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=r*2.2;
      ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

function setZoom(value){targetZoom=Math.max(.4,Math.min(4,value));document.querySelector('#zoom-reset').textContent=Math.round(targetZoom*100)+'%';}
function distance(){const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y);}
canvas.addEventListener('pointerdown',e=>{
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);
  if(pointers.size===1)drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};
  else {if(drag)drag.moved=true;pinchDistance=distance();}
});
canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size>=2){const next=distance();if(pinchDistance>0)setZoom(targetZoom*next/pinchDistance);pinchDistance=next;return;}
  if(!drag)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  targetYaw-=dx*.005;targetPitch=Math.max(-1.2,Math.min(1.2,targetPitch-dy*.005));
  drag.x=e.clientX;drag.y=e.clientY;
  if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>6)drag.moved=true;
  autoResumeAt=performance.now()+4000;
});
function releasePointer(e){
  if(!pointers.has(e.pointerId))return;
  if(e.type==='pointerup'&&pointers.size===1&&drag&&!drag.moved){const hit=[...hitAreas].reverse().find(p=>Math.abs(e.clientX-p.x)<p.w/2&&Math.abs(e.clientY-p.y)<p.h/2);if(hit)openPhoto(hit.index);}
  pointers.delete(e.pointerId);pinchDistance=pointers.size>=2?distance():0;
  const remaining=[...pointers.values()][0];
  drag=remaining?{...remaining,startX:remaining.x,startY:remaining.y,moved:true}:null;
}
canvas.addEventListener('pointerup',releasePointer);
canvas.addEventListener('pointercancel',releasePointer);
canvas.addEventListener('lostpointercapture',releasePointer);
canvas.addEventListener('wheel',e=>{e.preventDefault();const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?height:1);setZoom(targetZoom*Math.exp(-Math.max(-300,Math.min(300,delta))*.0025));},{passive:false});
document.querySelector('#zoom-in').onclick=()=>setZoom(targetZoom*1.25);
document.querySelector('#zoom-out').onclick=()=>setZoom(targetZoom/1.25);
document.querySelector('#zoom-reset').onclick=()=>setZoom(1);
function showPhoto(i){if(!images.length)return;selected=(i+images.length)%images.length;document.querySelector('#full-photo').src=images[selected].src;document.querySelector('#full-photo').alt=selected===0?'Jennifer and Mosheh wedding invitation':'Wedding toast, gift message and special note';document.querySelector('#caption').textContent=`${selected===0?'The invitation':'A toast to our forever'}   ·   ${selected+1} / ${images.length}`;}
function openPhoto(i){if(!images.length)return;showPhoto(i);viewer.showModal();}
const photosBtn=document.querySelector('#photos');
if(!images.length)photosBtn.hidden=true;else photosBtn.onclick=()=>openPhoto(selected);
document.querySelector('#invite').onclick=()=>{intro.classList.remove('hidden');document.querySelector('.gallery-heading').hidden=true;paused=true;syncPause();};
document.querySelector('#close').onclick=()=>viewer.close();
document.querySelector('#previous').onclick=()=>showPhoto(selected-1);
document.querySelector('#next').onclick=()=>showPhoto(selected+1);
viewer.addEventListener('click',e=>{if(e.target===viewer)viewer.close();});
const pause=document.querySelector('#pause');
function syncPause(){pause.textContent=paused?'▷':'Ⅱ';pause.setAttribute('aria-label',paused?'Play animation':'Pause animation');pause.setAttribute('aria-pressed',String(paused));}
pause.onclick=()=>{paused=!paused;syncPause();};syncPause();
document.addEventListener('keydown',e=>{if(viewer.open){if(e.key==='ArrowLeft')showPhoto(selected-1);if(e.key==='ArrowRight')showPhoto(selected+1);}else if(e.code==='Space'&&e.target===document.body){e.preventDefault();pause.click();}});
const fullscreen=document.querySelector('#fullscreen');
if(!document.fullscreenEnabled)fullscreen.hidden=true;
fullscreen.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{fullscreen.hidden=true;}};
document.addEventListener('fullscreenchange',()=>fullscreen.setAttribute('aria-label',document.fullscreenElement?'Exit fullscreen':'Enter fullscreen'));

/* ---------- Intro / countdown ---------- */
const WEDDING_DATE=new Date('2026-12-19T08:00:00+01:00').getTime();
function tickCountdown(){
  const now=Date.now();
  let diff=Math.max(0,WEDDING_DATE-now);
  const days=Math.floor(diff/86400000);diff-=days*86400000;
  const hrs=Math.floor(diff/3600000);diff-=hrs*3600000;
  const mins=Math.floor(diff/60000);diff-=mins*60000;
  const secs=Math.floor(diff/1000);
  document.querySelector('#cd-days').textContent=String(days).padStart(2,'0');
  document.querySelector('#cd-hours').textContent=String(hrs).padStart(2,'0');
  document.querySelector('#cd-mins').textContent=String(mins).padStart(2,'0');
  document.querySelector('#cd-secs').textContent=String(secs).padStart(2,'0');
}
tickCountdown();setInterval(tickCountdown,1000);

/* ---------- Falling petals ---------- */
if(!reducedMotion){
  const petalLayer=document.querySelector('#petals');
  const glyphs=['🌸','🌺','🥀','🏵️'];
  const count=matchMedia('(max-width:600px)').matches?10:18;
  for(let i=0;i<count;i++){
    const p=document.createElement('span');
    p.className='petal';
    p.textContent=glyphs[i%glyphs.length];
    p.style.left=(random()*100)+'%';
    p.style.fontSize=(14+random()*14)+'px';
    p.style.animationDuration=(9+random()*10)+'s, '+(3+random()*3)+'s';
    p.style.animationDelay=(-random()*14)+'s, '+(-random()*3)+'s';
    petalLayer.appendChild(p);
  }
}

function enterGallery(){
  intro.classList.add('hidden');
  controls.hidden=false;hint.hidden=false;
  document.querySelector('.gallery-heading').hidden=false;
  paused=reducedMotion;syncPause();
  if(document.fullscreenEnabled&&matchMedia('(max-width:720px)').matches){
    document.documentElement.requestFullscreen().catch(()=>{});
  }
}
document.querySelector('#enter').addEventListener('click',enterGallery);
document.querySelector('#enter-gallery')?.addEventListener('click',enterGallery);

/* ---------- Nav drawer ---------- */
const menuToggle=document.querySelector('#menu-toggle');
const navDrawer=document.querySelector('#nav-drawer');
const navBackdrop=document.querySelector('#nav-backdrop');
const navClose=document.querySelector('#nav-close');
function openNav(){
  navDrawer.classList.add('open');navDrawer.setAttribute('aria-hidden','false');
  navBackdrop.hidden=false;menuToggle.setAttribute('aria-expanded','true');
}
function closeNav(){
  navDrawer.classList.remove('open');navDrawer.setAttribute('aria-hidden','true');
  navBackdrop.hidden=true;menuToggle.setAttribute('aria-expanded','false');
}
menuToggle.addEventListener('click',()=>navDrawer.classList.contains('open')?closeNav():openNav());
navClose.addEventListener('click',closeNav);
navBackdrop.addEventListener('click',closeNav);
document.querySelectorAll('.nav-link').forEach(link=>link.addEventListener('click',e=>{
  closeNav();
  const target=document.querySelector(link.getAttribute('href'));
  if(target){e.preventDefault();intro.classList.remove('hidden');target.scrollIntoView({behavior:reducedMotion?'auto':'smooth',block:'start'});}
}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&navDrawer.classList.contains('open'))closeNav();});

/* ---------- Hero slideshow ---------- */
if(!reducedMotion){
  const slides=document.querySelectorAll('.hero-slide');
  let slideIndex=0;
  if(slides.length>1)setInterval(()=>{
    slides[slideIndex].classList.remove('active');
    slideIndex=(slideIndex+1)%slides.length;
    slides[slideIndex].classList.add('active');
  },1000);
}

/* ---------- RSVP form ---------- */
const rsvpForm=document.querySelector('#rsvp-form');
if(rsvpForm){
  let attending='';
  rsvpForm.querySelectorAll('.attend-btn').forEach(btn=>btn.addEventListener('click',()=>{
    rsvpForm.querySelectorAll('.attend-btn').forEach(b=>b.classList.remove('selected'));
    btn.classList.add('selected');attending=btn.dataset.value;
  }));
  rsvpForm.addEventListener('submit',e=>{
    e.preventDefault();
    const data=new FormData(rsvpForm);
    const lines=[
      'RSVP — Jennifer & Mosheh',
      `Name: ${data.get('name')||''}`,
      `Email: ${data.get('email')||''}`,
      data.get('phone')?`Phone: ${data.get('phone')}`:null,
      `Attending: ${attending||'Not specified'}`,
      data.get('message')?`Message: ${data.get('message')}`:null,
    ].filter(Boolean).join('\n');
    window.open('https://wa.me/2348039449592?text='+encodeURIComponent(lines),'_blank');
  });
}
