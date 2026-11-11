/* ===================== AYAAMA UI ===================== */
(function(){
'use strict';
const A=window.Ayaama, $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const KEY='ayaama.v1', WDS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const uid=()=>Math.random().toString(36).slice(2,10);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function todayLocal(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function defaults(){
  let start=todayLocal(); while([0,6].includes(A.weekday(start))) start=A.addDays(start,1);
  let tz='UTC'; try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'}catch(e){}
  return {classes:[],
    settings:{startDate:start,endDate:A.addDays(start,60),startType:'A',schoolDays:[1,2,3,4,5],daysOff:[],tz,calName:'My School Schedule'},
    activities:[],
    games:{on:false,name:'Game day',days:[5,6],skipOff:true},
    reminders:{classAlert:true,classMin:15,morning:true,morningTime:'07:00',evening:true,eveningTime:'19:30',hw:true,hwStart:'19:30',hwEnd:'21:00',hwOn:'activity'}};
}
let state=defaults();
try{const s=JSON.parse(localStorage.getItem(KEY)||'null'); if(s&&s.settings){ const d=defaults(); state={...d,...s,settings:{...d.settings,...s.settings},reminders:{...d.reminders,...s.reminders},games:{...d.games,...s.games}}; }}catch(e){}
const images=[];
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}
function toast(msg){const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2800)}

/* ---------- Step 1: pictures ---------- */
function addFiles(files){
  if(state.mode!=='upload'){ state.mode='upload'; save(); applyMode(); }
  Array.from(files).filter(f=>/^image\//.test(f.type)||/\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name)).forEach(f=>{
    images.push({id:uid(),file:f,url:URL.createObjectURL(f),dayType:'A',status:'Ready to read',progress:0});
  });
  // sensible defaults: 1 picture = every day, 2 = A then B
  if(images.length===1&&!images[0].touched) images[0].dayType='ALL';
  if(images.length>=2){ images.forEach((im,i)=>{ if(!im.touched) im.dayType=i===0?'A':i===1?'B':'ALL'; }); }
  renderThumbs();
}
function renderThumbs(){
  $('#thumbs').innerHTML=images.map(im=>`<div class="thumb" data-id="${im.id}">
    <img src="${im.url}" alt="Schedule picture">
    <div class="meta"><div class="nm">${esc(im.file.name)}</div>
      <div class="seg" role="group" aria-label="Which days is this picture for?">${['A','B','ALL'].map(t=>`<button type="button" data-t="${t}" class="${im.dayType===t?'on':''}" aria-pressed="${im.dayType===t}">${t==='ALL'?'Every day':t+' day'}</button>`).join('')}</div>
      <div class="st ${/^Found/.test(im.status)?'ok':/^Could/.test(im.status)?'err':''}">${esc(im.status)}</div>
      ${im.progress>0&&im.progress<1?`<div class="bar" role="progressbar" aria-valuenow="${Math.round(im.progress*100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.round(im.progress*100)}%"></i></div>`:''}
    </div>
    <button class="btn quiet" type="button" data-del aria-label="Remove picture">✕</button></div>`).join('');
  $('#readBtn').classList.toggle('hidden',!images.some(i=>!i.done));
}
$('#thumbs').addEventListener('click',e=>{
  const card=e.target.closest('.thumb'); if(!card) return; const im=images.find(x=>x.id===card.dataset.id);
  if(e.target.dataset.t){ im.dayType=e.target.dataset.t; im.touched=true; state.classes.filter(c=>c.src===im.id).forEach(c=>c.dayType=im.dayType); sortClasses(); renderThumbs(); renderClasses(); save(); refresh(); }
  if(e.target.hasAttribute('data-del')){ images.splice(images.indexOf(im),1); renderThumbs(); }
});
$('#file').addEventListener('change',e=>{addFiles(e.target.files); e.target.value='';});
const drop=$('#drop');
['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over')}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over')}));
drop.addEventListener('drop',e=>addFiles(e.dataTransfer.files));
/* ---------- Two equal ways in: upload or type ---------- */
function applyMode(){
  const m=state.mode||null;
  $$('.choice').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===m)));
  $('#uploadPane').classList.toggle('hidden',m!=='upload');
  $('#manualPane').classList.toggle('hidden',m!=='manual');
  $('#manualHint').classList.toggle('hidden',m!=='manual');
  $('#rawBox').classList.toggle('hidden',m==='manual'&&!images.some(i=>i.raw));
  $('#s2sub').textContent=m==='manual'?'Add each class with its start and end time. Room and teacher are optional.':'Look over each class and fix anything that looks off. Picture readers make mistakes, so this step matters.';
}
function goList(){ const el=$('#s2'); el.scrollIntoView({behavior:'smooth',block:'start'}); setTimeout(()=>{ const blank=$$('.cls input[data-k=name]').find(i=>!i.value); (blank||$('#addAnother')).focus({preventScroll:true}); },350); }
function setMode(m,{jump=true}={}){
  state.mode=m; save(); applyMode();
  if(m==='manual'){ if(!state.classes.length) addClass('A',{focus:false}); if(jump) goList(); }
}
$$('.choice').forEach(b=>b.addEventListener('click',()=>{
  const m=b.dataset.mode; setMode(m);
  if(m==='upload'&&!images.length){ try{ $('#file').click(); }catch(e){} }
}));
$('#toList').addEventListener('click',goList);

/* OCR, all in the browser */
let worker=null, currentImg=null;
async function getWorker(){
  if(worker) return worker;
  for(let i=0;i<75&&!window.Tesseract;i++) await new Promise(r=>setTimeout(r,200));
  if(!window.Tesseract) throw new Error('the text reader did not load. Check your internet connection, or type your classes in below.');
  worker=await Tesseract.createWorker('eng',1,{logger:m=>{ if(currentImg&&m.status==='recognizing text'){ currentImg.progress=Math.max(.1,Math.min(.99,currentImg.base+currentImg.span*m.progress)); renderThumbs(); } }});
  return worker;
}
function loadImg(url){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('this picture could not be opened. Try a PNG or JPG screenshot.'));i.src=url})}
async function prep(url){
  const img=await loadImg(url);
  const w=img.naturalWidth,h=img.naturalHeight, k=w<1100?2:(w>2600?2600/w:1);
  const c=document.createElement('canvas'); c.width=Math.round(w*k); c.height=Math.round(h*k);
  const x=c.getContext('2d'); x.imageSmoothingQuality='high'; x.drawImage(img,0,0,c.width,c.height);
  const d=x.getImageData(0,0,c.width,c.height), p=d.data; let sum=0;
  for(let i=0;i<p.length;i+=4){const g=.299*p[i]+.587*p[i+1]+.114*p[i+2];p[i]=p[i+1]=p[i+2]=g;sum+=g}
  if(sum/(p.length/4)<110) for(let i=0;i<p.length;i+=4){p[i]=p[i+1]=p[i+2]=255-p[i]} // dark mode -> light
  x.putImageData(d,0,0); return c;
}
const quality=r=>r.classes.filter(c=>c.name).length*3+r.classes.filter(c=>c.room).length+r.classes.filter(c=>c.teacher).length+r.score;
const complete=r=>r.classes.length>0&&r.classes.length%2===0&&r.classes.every(c=>c.name&&c.room&&c.teacher)||r.classes.length>0&&r.classes.every(c=>c.name&&c.room&&c.teacher)&&r.classes.length>=3;
async function readImage(im){
  currentImg=im; im.status='Loading the reader…'; im.progress=.05; im.base=.05; im.span=.3; renderThumbs();
  const w=await getWorker();
  im.status='Reading…'; renderThumbs();
  // Try a few reading strategies and keep the one that makes the most sense.
  const tries=[{src:'orig',psm:'3'},{src:'prep',psm:'3'},{src:'prep',psm:'6'},{src:'orig',psm:'6'}];
  let best=null, prepped=null;
  for(let i=0;i<tries.length;i++){
    const t=tries[i]; im.base=.05+.95*i/tries.length; im.span=.95/tries.length;
    if(i>0){ im.status='Taking a closer look…'; renderThumbs(); }
    let src=im.url; if(t.src==='prep'){ prepped=prepped||await prep(im.url); src=prepped; }
    await w.setParameters({tessedit_pageseg_mode:t.psm});
    const r=await w.recognize(src); const res=A.parseScheduleText(r.data.text); res.raw=r.data.text;
    if(!best||quality(res)>quality(best)) best=res;
    if(complete(best)) break;
  }
  im.raw=best.raw; im.progress=1; currentImg=null; return best;
}
async function readAll(){
  if(state.mode!=='upload') setMode('upload',{jump:false});
  const btn=$('#readBtn'); btn.disabled=true; btn.textContent='Reading…';
  let total=0;
  for(const im of images){
    if(im.done) continue;
    try{
      const res=await readImage(im);
      state.classes=state.classes.filter(c=>c.src!==im.id);
      res.classes.forEach(c=>state.classes.push({id:uid(),src:im.id,dayType:im.dayType,...c,flag:!c.name||!c.room||!c.teacher||c.endGuessed}));
      im.status=res.classes.length?`Found ${res.classes.length} class${res.classes.length>1?'es':''}`:'Could not find class times here. You can type them in below.';
      im.done=true; total+=res.classes.length;
    }catch(err){ im.status='Could not read it: '+(err&&err.message||err); im.progress=0; currentImg=null; }
    renderThumbs();
  }
  // A and B days usually share bell times. If one image disagrees, ask the user to look.
  const byStart={}; state.classes.forEach(c=>{ (byStart[c.start]=byStart[c.start]||[]).push(c); });
  Object.values(byStart).forEach(list=>{ const ends=new Set(list.map(c=>c.end)); if(ends.size>1) list.forEach(c=>{ c.flag=true; c.endCheck=true; }); });
  btn.disabled=false; btn.textContent='Read my schedule';
  $('#rawText').textContent=images.filter(i=>i.raw).map(i=>'— '+i.file.name+' —\n'+i.raw.trim()).join('\n\n')||'Nothing read yet.';
  if(!state.classes.length) addClass(images[0]?images[0].dayType:'A');
  sortClasses(); renderClasses(); refresh(); save();
  $('#s2').scrollIntoView({behavior:'smooth'});
  if(total) toast(`Found ${total} classes. Please check them over.`);
  return total;
}
$('#readBtn').addEventListener('click',readAll);

/* ---------- Step 2: classes ---------- */
/* Suggest times: 7 minutes after the previous class of that day ends, same length.
   First class of a day type copies the earliest class of any day, else 8:00-8:50. */
function suggestTimes(t){
  const ok=c=>A.toMin(c.start)!=null&&A.toMin(c.end)!=null&&A.toMin(c.end)>A.toMin(c.start);
  const same=state.classes.filter(c=>c.dayType===t&&ok(c)).sort((a,b)=>A.toMin(a.start)-A.toMin(b.start));
  if(same.length){ const p=same[same.length-1], dur=A.toMin(p.end)-A.toMin(p.start), s=A.toMin(p.end)+7; if(s+dur<=23*60) return {start:A.fromMin(s),end:A.fromMin(s+dur)}; return {start:'',end:''}; }
  const any=state.classes.filter(ok).sort((a,b)=>A.toMin(a.start)-A.toMin(b.start));
  if(any.length) return {start:any[0].start,end:any[0].end};
  return {start:'08:00',end:'08:50'};
}
let lastType='A';
function addClass(t,{focus=true}={}){
  lastType=t; const tm=suggestTimes(t);
  const c={id:uid(),dayType:t,name:'',start:tm.start,end:tm.end,room:'',teacher:'',period:'',manual:true};
  state.classes.push(c); sortClasses(); renderClasses(); save(); refresh();
  if(focus) setTimeout(()=>{ const el=document.querySelector(`.cls[data-id="${c.id}"] input[data-k=name]`); if(el){ el.focus({preventScroll:true}); el.closest('.cls').scrollIntoView({block:'center',behavior:'smooth'}); } },30);
  return c;
}
$$('[data-add]').forEach(b=>b.addEventListener('click',()=>addClass(b.dataset.add)));
$('#addAnother').addEventListener('click',()=>{
  const t=state.classes.length?lastType:'A'; addClass(t);
});
function copyAB(){
  const a=state.classes.filter(c=>c.dayType==='A'&&c.start&&c.end);
  const have=new Set(state.classes.filter(c=>c.dayType==='B').map(c=>c.start));
  let n=0; a.forEach(c=>{ if(have.has(c.start)) return; state.classes.push({id:uid(),dayType:'B',name:'',start:c.start,end:c.end,room:'',teacher:'',period:'',manual:true}); n++; });
  lastType='B'; sortClasses(); renderClasses(); save(); refresh();
  if(n){ toast(`Added ${n} B-day class${n>1?'es':''} with the same times. Just type the names.`); const first=$$('.cls.t-B input[data-k=name]').find(i=>!i.value); if(first){ first.focus({preventScroll:true}); first.closest('.cls').scrollIntoView({block:'center',behavior:'smooth'}); } }
  else toast('Your B day already has classes at those times.');
  return n;
}
$('#copyAB').addEventListener('click',copyAB);
function sortClasses(){const o={A:0,B:1,ALL:2};state.classes.sort((a,b)=>(o[a.dayType]-o[b.dayType])||((A.toMin(a.start)??9999)-(A.toMin(b.start)??9999)))}
function needMsg(c){ const nm=!String(c.name||'').trim(), tm=!(c.start&&c.end&&A.toMin(c.end)>A.toMin(c.start)); return nm&&tm?'Needs a name and times':nm?'Needs a name':tm?'Needs an end time after the start':''; }
function renderClasses(){
  const el=$('#classList');
  const btn=$('#copyAB'); if(btn) btn.classList.toggle('hidden',!state.classes.some(c=>c.dayType==='A'&&c.start&&c.end));
  if(!state.classes.length){ el.innerHTML='<div class="empty">No classes yet. Upload a screenshot in step 1, or tap <b>Add another class</b> to type them in.</div>'; return; }
  el.innerHTML=state.classes.map(c=>{
    const bad=!A.validClass(c);
    return `<div class="cls t-${c.dayType}" data-id="${c.id}">
    <div class="head"><select data-k="dayType" aria-label="Which days" style="width:auto;min-height:36px;padding:4px 8px;font-weight:700">
      <option value="A" ${c.dayType==='A'?'selected':''}>A day</option><option value="B" ${c.dayType==='B'?'selected':''}>B day</option><option value="ALL" ${c.dayType==='ALL'?'selected':''}>Every day</option></select>
      <span class="flag" data-flag>${bad?needMsg(c):(c.flag?(c.endGuessed?'End time was guessed. Please check':c.endCheck?'End time differs from the other day. Please check':'Please double-check'):'')}</span>
      <button class="btn quiet" type="button" data-del aria-label="Delete class">Delete</button></div>
    <div class="g">
      <div class="full"><label>Class</label><input type="text" data-k="name" value="${esc(c.name)}" placeholder="e.g. Chemistry" autocomplete="off"></div>
      <div><label>Starts</label><input type="time" data-k="start" value="${esc(c.start)}"></div>
      <div><label>Ends</label><input type="time" data-k="end" value="${esc(c.end)}"></div>
      <div><label>Room</label><input type="text" data-k="room" value="${esc(c.room)}" placeholder="e.g. 214" autocomplete="off"></div>
      <div><label>Period</label><input type="text" data-k="period" value="${esc(c.period)}" inputmode="numeric" placeholder="optional"></div>
      <div class="full"><label>Teacher</label><input type="text" data-k="teacher" value="${esc(c.teacher)}" placeholder="optional" autocomplete="off"></div>
    </div></div>`}).join('');
}
$('#classList').addEventListener('input',e=>{
  const card=e.target.closest('.cls'); if(!card||!e.target.dataset.k) return;
  const c=state.classes.find(x=>x.id===card.dataset.id); c[e.target.dataset.k]=e.target.value; c.flag=false; lastType=c.dayType;
  if(e.target.dataset.k==='dayType') card.className='cls t-'+c.dayType;
  card.querySelector('[data-flag]').textContent=needMsg(c);
  save(); refreshSoon();
});
$('#classList').addEventListener('change',e=>{ if(['start','end','dayType'].includes(e.target.dataset.k)){ const f=document.activeElement; sortClasses(); renderClasses(); refresh(); } });
$('#classList').addEventListener('click',e=>{ if(e.target.hasAttribute('data-del')){ const id=e.target.closest('.cls').dataset.id; state.classes=state.classes.filter(c=>c.id!==id); renderClasses(); save(); refresh(); } });

/* ---------- Step 3: settings ---------- */
function dayBoxes(el,arr,onch){
  el.innerHTML=[1,2,3,4,5,6,0].map(d=>`<label><input type="checkbox" value="${d}" ${arr.includes(d)?'checked':''}><span>${WDS[d]}</span></label>`).join('');
  el.onchange=()=>{ onch(Array.from(el.querySelectorAll('input:checked')).map(i=>+i.value)); save(); refresh(); };
}
let bound=false;
function bindSettings(){
  const S=state.settings, R=state.reminders, G=state.games;
  const set=(sel,obj,key,type)=>{ const el=$(sel); if(type==='chk') el.checked=!!obj[key]; else el.value=obj[key]??''; };
  const bind=(sel,getObj,key,type)=>{ const el=$(sel); set(sel,getObj(),key,type); if(bound) return;
    el.addEventListener(type==='chk'?'change':'input',()=>{ const o=getObj(); o[key]=type==='chk'?el.checked:type==='num'?(Math.max(0,+el.value||0)):el.value; save(); refreshSoon(); syncDisabled(); }); };
  const s=()=>state.settings, r=()=>state.reminders, g=()=>state.games;
  bind('#startDate',s,'startDate'); bind('#endDate',s,'endDate'); bind('#startType',s,'startType'); bind('#calName',s,'calName');
  const tzSel=$('#tz'); let zones=[]; try{zones=Intl.supportedValuesOf('timeZone')}catch(e){}
  if(!zones.includes(S.tz)) zones.unshift(S.tz);
  tzSel.innerHTML=zones.map(z=>`<option ${z===S.tz?'selected':''}>${esc(z)}</option>`).join('');
  if(!bound) tzSel.addEventListener('change',()=>{state.settings.tz=tzSel.value;save();refresh()});
  dayBoxes($('#schoolDays'),S.schoolDays,v=>state.settings.schoolDays=v);
  bind('#gamesOn',g,'on','chk'); bind('#gameName',g,'name'); bind('#gameSkipOff',g,'skipOff','chk');
  dayBoxes($('#gameDays'),G.days,v=>state.games.days=v);
  bind('#rClass',r,'classAlert','chk'); bind('#rClassMin',r,'classMin','num');
  bind('#rMorning',r,'morning','chk'); bind('#rMorningTime',r,'morningTime');
  bind('#rEvening',r,'evening','chk'); bind('#rEveningTime',r,'eveningTime');
  bind('#rHw',r,'hw','chk'); bind('#hwStart',r,'hwStart'); bind('#hwEnd',r,'hwEnd'); bind('#hwOn',r,'hwOn');
  bound=true; syncDisabled(); renderOff(); renderActs();
}
function syncDisabled(){
  const R=state.reminders;
  $('#rClassMin').disabled=!R.classAlert; $('#rMorningTime').disabled=!R.morning; $('#rEveningTime').disabled=!R.evening;
  ['#hwStart','#hwEnd','#hwOn'].forEach(s=>$(s).disabled=!R.hw);
  $('#gamesBox').classList.toggle('hidden',!state.games.on);
}
function renderOff(){
  const S=state.settings; S.daysOff=[...new Set(S.daysOff)].sort();
  $('#offChips').innerHTML=S.daysOff.map(d=>`<span class="chip">${A.niceDate(d)} <button type="button" data-d="${d}" aria-label="Remove ${A.niceDate(d)}">×</button></span>`).join('')||'<span class="hint">No days off yet.</span>';
}
$('#addOff').addEventListener('click',()=>{
  const a=$('#offFrom').value, b=$('#offTo').value; if(!a){toast('Pick a date first.');return}
  const S=state.settings, end=b&&b>=a?b:a;
  for(let d=a,n=0; d<=end&&n<366; d=A.addDays(d,1),n++){ if(a===end||S.schoolDays.includes(A.weekday(d))) S.daysOff.push(d); }
  $('#offFrom').value=''; $('#offTo').value=''; renderOff(); save(); refresh();
});
$('#offChips').addEventListener('click',e=>{ const d=e.target.dataset.d; if(!d) return; state.settings.daysOff=state.settings.daysOff.filter(x=>x!==d); renderOff(); save(); refresh(); });

function renderActs(){
  $('#actList').innerHTML=state.activities.map(a=>`<div class="act" data-id="${a.id}">
    <div class="field"><label class="f">Name</label><input type="text" data-k="name" value="${esc(a.name)}" placeholder="e.g. Soccer practice"></div>
    <label class="f">Days</label><div class="days" data-days>${[1,2,3,4,5,6,0].map(d=>`<label><input type="checkbox" value="${d}" ${a.days.includes(d)?'checked':''}><span>${WDS[d]}</span></label>`).join('')}</div>
    <label class="chk"><input type="checkbox" data-k="afterSchool" ${a.afterSchool?'checked':''}><span>Starts when school ends</span></label>
    <div class="inline">
      <div class="field"><label class="f">Starts</label><input type="time" data-k="start" value="${esc(a.start)}" ${a.afterSchool?'disabled':''}></div>
      <div class="field"><label class="f">Ends</label><input type="time" data-k="end" value="${esc(a.end)}"></div>
    </div>
    <div class="inline">
      <div class="field"><label class="f">Alert (min before)</label><input type="number" data-k="alert" min="0" value="${esc(a.alert)}" inputmode="numeric"></div>
      <div class="field"><label class="f">Place (optional)</label><input type="text" data-k="location" value="${esc(a.location||'')}"></div>
    </div>
    <label class="chk"><input type="checkbox" data-k="skipOff" ${a.skipOff!==false?'checked':''}><span>Skip days off</span></label>
    <p class="hint">On days without school, like Sundays, “starts when school ends” uses the usual end of the school day.</p>
    <button class="btn quiet" type="button" data-del>Remove</button></div>`).join('');
}
$('#addAct').addEventListener('click',()=>{ state.activities.push({id:uid(),name:'Practice',days:[1,2,3,4],afterSchool:true,start:'15:00',end:'18:30',alert:30,location:'',skipOff:true}); renderActs(); save(); refresh(); });
function actUpdate(e){
  const card=e.target.closest('.act'); if(!card) return; const a=state.activities.find(x=>x.id===card.dataset.id); if(!a) return;
  if(e.target.closest('[data-days]')) a.days=Array.from(card.querySelectorAll('[data-days] input:checked')).map(i=>+i.value);
  else if(e.target.dataset.k){ const k=e.target.dataset.k; a[k]=e.target.type==='checkbox'?e.target.checked:e.target.type==='number'?(Math.max(0,+e.target.value||0)):e.target.value; if(k==='afterSchool') card.querySelector('[data-k=start]').disabled=a.afterSchool; }
  save(); refreshSoon();
}
$('#actList').addEventListener('input',actUpdate);
$('#actList').addEventListener('change',e=>{ if(e.target.type==='checkbox') actUpdate(e); });
$('#actList').addEventListener('click',e=>{ if(e.target.hasAttribute('data-del')){ const id=e.target.closest('.act').dataset.id; state.activities=state.activities.filter(a=>a.id!==id); renderActs(); save(); refresh(); } });

/* ---------- Step 4: preview + download ---------- */
function warnings(){
  const w=[], S=state.settings;
  if(!state.classes.length) w.push('Add at least one class in step 2.');
  const bad=state.classes.filter(c=>!A.validClass(c)); if(bad.length) w.push(`${bad.length} class${bad.length>1?'es need':' needs'} a name and an end time after the start time. Until then ${bad.length>1?'they':'it'} will be left out.`);
  if(!S.startDate||!S.endDate||S.endDate<S.startDate) w.push('Set a first and last day in step 3. The last day has to come after the first.');
  const hasA=state.classes.some(c=>c.dayType==='A'), hasB=state.classes.some(c=>c.dayType==='B');
  if(S.startType!=='NONE'&&hasA!==hasB) w.push(`You have ${hasA?'A':'B'} day classes but no ${hasA?'B':'A'} day classes yet. ${hasA?'B':'A'} days will only show “Every day” classes.`);
  if(S.startType==='NONE'&&(hasA||hasB)) w.push('“No rotation” is on, so A day and B day classes will all show up every school day.');
  if(!S.schoolDays.length) w.push('Pick at least one day of the week that school meets.');
  return w;
}
function renderPreview(){
  $('#warns').innerHTML=warnings().map(x=>`<div class="warnbox">${esc(x)}</div>`).join('');
  const S=state.settings, el=$('#preview');
  if(!S.startDate||!S.endDate||S.endDate<S.startDate){el.innerHTML='';$('#stat').textContent='';return}
  let from=S.startDate; while(A.weekday(from)!==1) from=A.addDays(from,-1);
  const days=A.buildDays(state,from,A.addDays(from,13));
  let html='';
  days.forEach((d,i)=>{
    if(i%7===0) html+=`<div class="wkhd">Week of ${A.niceDate(d.date)}</div>`;
    const items=[];
    if(d.morning) items.push(`<li class="rem"><time>${A.fmt12(d.morning)}</time><span>🔔 Any quizzes or due work today?</span></li>`);
    if(d.school) d.classes.forEach(c=>items.push(`<li><time>${A.fmt12(c.start)}</time><span>${esc(c.name)}${c.room?' · '+esc(A.roomLabel(c.room)):''}</span></li>`));
    d.acts.forEach(a=>items.push(`<li class="ac"><time>${A.fmt12(a.start)}</time><span>${esc(a.name)} until ${A.fmt12(a.end)}</span></li>`));
    if(d.game) items.push(`<li class="ac"><time>All day</time><span>🏆 ${esc(d.game.name)}</span></li>`);
    if(d.evening) items.push(`<li class="rem"><time>${A.fmt12(d.evening)}</time><span>🔔 Check assignments and quizzes</span></li>`);
    if(d.hw) items.push(`<li class="rem"><time>${A.fmt12(d.hw.start)}</time><span>📚 Homework time until ${A.fmt12(d.hw.end)}</span></li>`);
    const tag=d.school?(d.type?`<span class="tag ${d.type}">${d.type} day</span>`:'<span class="tag ALL">School day</span>'):(!d.inTerm?'<span class="tag off">Not in term</span>':d.off?'<span class="tag off">Day off</span>':'<span class="tag off">No school</span>');
    html+=`<div class="day ${d.school?'':'off'}" data-date="${d.date}" data-type="${d.type||''}"><div class="dh"><span>${A.niceDate(d.date)}</span>${tag}</div>${items.length?`<ul>${items.join('')}</ul>`:''}</div>`;
  });
  el.innerHTML=html;
  try{ const r=A.buildICS(state), c=r.counts; $('#stat').textContent=`Your calendar has ${r.count} events: ${c.classes} classes, ${c.activities} practices or activities, ${c.morning+c.evening} reminders, and ${c.homework} homework blocks${c.games?', plus '+c.games+' game days':''}.`; }catch(e){ $('#stat').textContent=''; console.error(e); }
}
let rt=null; function refreshSoon(){clearTimeout(rt);rt=setTimeout(refresh,250)}
function refresh(){ renderPreview(); }
function makeFile(){
  if(!state.classes.some(A.validClass)){toast('Add at least one class with a name and times first.');return null}
  const S=state.settings; if(!S.startDate||!S.endDate||S.endDate<S.startDate){toast('Set your first and last day first.');return null}
  const r=A.buildICS(state), name=(S.calName||'Ayaama Calendar').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-')||'Ayaama-Calendar';
  return {blob:new Blob([r.text],{type:'text/calendar;charset=utf-8'}),name:name+'.ics',text:r.text};
}
$('#dlBtn').addEventListener('click',()=>{
  const f=makeFile(); if(!f) return; window.__lastICS=f.text;
  const a=document.createElement('a'); a.href=URL.createObjectURL(f.blob); a.download=f.name; document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000);
  toast('Calendar downloaded. Follow the steps below to add it.');
});
try{ if(navigator.canShare&&navigator.canShare({files:[new File(['x'],'t.ics',{type:'text/calendar'})]})) $('#shareBtn').classList.remove('hidden'); }catch(e){}
$('#shareBtn').addEventListener('click',async()=>{ const f=makeFile(); if(!f) return; try{ await navigator.share({files:[new File([f.blob],f.name,{type:'text/calendar'})],title:'My school calendar'}); }catch(e){} });
$('#resetBtn').addEventListener('click',()=>{ if(!confirm('Clear all classes and settings saved on this device?')) return; localStorage.removeItem(KEY); location.reload(); });

/* init */
sortClasses(); renderThumbs(); renderClasses(); bindSettings(); applyMode(); refresh();
window.__ayaama={setMode,copyAB,addClass,get state(){return state}, setState(v){state=v; save(); sortClasses(); renderClasses(); bindSettings(); refresh();}, images, readAll};
})();
