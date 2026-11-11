/* ===================== AYAAMA CORE (pure logic, no DOM) ===================== */
(function(root){
'use strict';
const pad = n => String(n).padStart(2,'0');
const WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* ---- dates as YYYY-MM-DD strings (UTC math, so DST never shifts a day) ---- */
function parseYMD(s){const [y,m,d]=s.split('-').map(Number);return Date.UTC(y,m-1,d)}
function ymd(t){const d=new Date(t);return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate())}
function addDays(s,n){return ymd(parseYMD(s)+n*864e5)}
function weekday(s){return new Date(parseYMD(s)).getUTCDay()}
function niceDate(s){const d=new Date(parseYMD(s));return WD[d.getUTCDay()]+' '+MON[d.getUTCMonth()]+' '+d.getUTCDate()}
function toMin(hhmm){if(!hhmm)return null;const [h,m]=hhmm.split(':').map(Number);if(isNaN(h)||isNaN(m))return null;return h*60+m}
function fromMin(m){return pad(Math.floor(m/60)%24)+':'+pad(m%60)}
function fmt12(hhmm){if(!hhmm)return'';let [h,m]=hhmm.split(':').map(Number);const ap=h>=12?'PM':'AM';h=h%12||12;return h+':'+pad(m)+' '+ap}

/* ======================= OCR TEXT PARSER ======================= */
const SUBJ = new Set(('math algebra geometry calculus precalculus statistics trigonometry english literature writing reading speaking speech public '+
 'history government civics economics psychology sociology philosophy science chemistry biology physics anatomy physiology environmental earth '+
 'health wellness physical education pe gym fitness weight training study hall lunch advisory homeroom seminar lab honors ap ib intro introduction '+
 'spanish french german latin chinese mandarin japanese italian arabic asl language art arts drawing painting ceramics sculpture photography design '+
 'music band chorus choir orchestra theater theatre drama dance computer computing coding programming engineering robotics technology tech media '+
 'film video broadcast journalism yearbook debate business accounting finance marketing culinary foods nutrition human services world global us '+
 'american european studies social creative ela esl career child development forensics astronomy geography digital graphic web cyber').split(/\s+/));
const NOISE_EXACT = /^(today|tomorrow|yesterday|schedule|my schedule|class schedule|classes|courses|home|calendar|grades|assignments|attendance|more|menu|back|done|settings|messages|inbox|day|week|month|list|term|semester|quarter|trimester|[ab]\s*day|day\s*[ab12]|all day|now|next|details|view|edit|search|period|periods)$/i;
const WEEKDAY_START = /^(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(day|nesday|sday|urday|rsday)?\b\.?(?:,|\s|$)/i;
const MONTH_START = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d/i;

function normalizeOcr(text){
  return String(text||'').replace(/\r/g,'')
    .replace(/[\u2010-\u2015\u2212~]/g,'-')
    .replace(/(\d)\s*[;\uFF1A\u2236]\s*(\d{2})/g,'$1:$2')
    .replace(/(\d):(\d)[oO]\b/g,'$1:$20')
    .replace(/(\d):[oO](\d)/g,'$1:0$2')
    .replace(/(^|[^A-Za-z0-9])[lI|](\d):(\d{2})/g,'$11$2:$3')
    .replace(/\b(\d{1,2}) ?: ?(\d{2})\b/g,'$1:$2')
    .replace(/\b(\d{1,2})\.(\d{2})(?=\s*[AaPp]\.?\s?[Mm])/g,'$1:$2')
    .replace(/[ \t\u00A0]+/g,' ');
}

const TIME_RE = /(^|[^\d:])(\d{1,2}):([0-5]\d)(?!\d)(?:\s*([AaPp])\.?\s?[Mm]\.?(?![A-Za-z]))?/g;
const MER_RE = /(^|[\s\-(])([AaPp])\.?[Mm]\.?(?=[\s\-),.]|$)/g;

const MER_START=/^\s*[^\w\s]?\s*[AaPp]\.?\s?[Mm]\.?(?![A-Za-z])/;
/* OCR often drops the colon ("1027", "215"). Restore it when an AM/PM sits right after or on the next line. */
function fixColonless(lines){
  return lines.map((line,i)=>{
    const m=line.match(/^(\s*[^\w\s]?\s*)(\d{1,2})[.,]?(\d{2})(?![\d:%.,])(.*)$/);
    if(!m) return line;
    const h=+m[2], mi=+m[3]; if(h<1||h>12||mi>59) return line;
    if(/\b(room|rm|rn)\b/i.test(m[1])) return line;
    const MER_ONLY=/^\s*[^\w\s]?\s*[AaPp]\.?\s?[Mm]\.?\s*$/;
    const sameLine=MER_START.test(m[4]); const nextLine=MER_START.test(lines[i+1]||'')||(MER_ONLY.test(lines[i+2]||'')&&!/\d:\d\d/.test(lines[i+1]||''));
    if(!sameLine&&!nextLine) return line;
    return m[1]+m[2]+':'+m[3]+m[4];
  });
}
/* "Algebra ll" -> "Algebra II" (OCR reads roman numerals as l / 1 / |) */
function fixRoman(s){
  return s.replace(/(\S\s)([lI|]{1,3})(?=\s|$)/g,(m,pre,r)=>pre+'I'.repeat(r.length)).replace(/(\S\s)([lI|]V)(?=\s|$)/g,(m,pre)=>pre+'IV');
}
function tokenizeLines(text){
  const lines = fixColonless(normalizeOcr(text).split('\n').filter(l=>l.trim()));
  const items=[]; const content=[];
  lines.forEach((line,li)=>{
    const found=[]; let m;
    TIME_RE.lastIndex=0;
    while((m=TIME_RE.exec(line))){
      const start=m.index+m[1].length, h=+m[2], mi=+m[3];
      if(h>23) continue;
      found.push({type:'time',h,m:mi,mer:m[4]?m[4].toUpperCase():null,line:li,pos:start,len:m[0].length-m[1].length});
    }
    let masked=line;
    found.forEach(f=>{masked=masked.slice(0,f.pos)+' '.repeat(f.len)+masked.slice(f.pos+f.len)});
    MER_RE.lastIndex=0;
    while((m=MER_RE.exec(masked))){
      const start=m.index+m[1].length, len=m[0].length-m[1].length;
      found.push({type:'mer',mer:m[2].toUpperCase(),line:li,pos:start,len});
    }
    found.sort((a,b)=>a.pos-b.pos);
    let rest=line;
    found.slice().sort((a,b)=>b.pos-a.pos).forEach(f=>{rest=rest.slice(0,f.pos)+' '+rest.slice(f.pos+f.len)});
    rest=rest.replace(/\s(?:-|to|until|through)(?=\s)/gi,' ').replace(/^\s*(?:-|to)\s+/i,'').replace(/\s+(?:-|to)\s*$/i,'').replace(/\s+/g,' ').trim();
    if(rest==='-') rest='';
    items.push(...found); content.push(rest);
  });
  // a stand-alone AM/PM belongs to the closest earlier time that has none
  for(let i=0;i<items.length;i++){
    const it=items[i]; if(it.type!=='mer') continue;
    for(let j=i-1;j>=0;j--){
      const t=items[j]; if(t.type!=='time') continue;
      if(it.line-t.line<=2 && !t.mer) t.mer=it.mer;
      break;
    }
  }
  return {times:items.filter(x=>x.type==='time'), content, lines};
}

/* Pick which times are starts and ends. OCR drops or garbles times, so instead of pairing
   them blindly we score every reading (pair / start-only / skip) and keep the most plausible. */
function timeMin(t){
  if(t.h>12||t.h===0) return t.h*60+t.m;
  const mer=t.mer||((t.h>=1&&t.h<=5)||t.h===12?'P':'A');
  return (mer==='P'?(t.h%12)+12:(t.h%12))*60+t.m;
}
function findRanges(times,content){
  const n=times.length; if(!n) return [];
  const mins=times.map(timeMin);
  const hasPeriod=times.map(t=>/\b(period|per|block)\b/i.test((content&&content[t.line])||''));
  const memo=new Map();
  function best(i,prevEnd){
    if(i>=n) return {score:0,picks:[]};
    const key=i+'|'+prevEnd; if(memo.has(key)) return memo.get(key);
    let out=null; const consider=(score,picks)=>{ if(!out||score>out.score) out={score,picks}; };
    // skip this time
    { const r=best(i+1,prevEnd); consider(r.score-4,r.picks); }
    const s=mins[i];
    if(s>=prevEnd && s>=5*60 && s<=22*60){
      const gapBonus=(prevEnd>0&&s-prevEnd<=15)?2:0, per=hasPeriod[i]?2:0;
      // a full start-end pair
      if(i+1<n && times[i+1].line-times[i].line<=5){
        const e=mins[i+1], d=e-s;
        if(d>=5&&d<=300){
          const r=best(i+2,e);
          const sc=(d>=20&&d<=240?10:2)+gapBonus+per-(hasPeriod[i+1]&&times[i+1].line!==times[i].line?3:0);
          consider(r.score+sc,[{a:i,b:i+1,start:s,end:e},...r.picks]);
        }
      }
      // a start whose end time went missing
      { const r=best(i+1,s+1); consider(r.score+3+gapBonus+per-(i===n-1?3:0),[{a:i,b:null,start:s,end:null},...r.picks]); }
    }
    memo.set(key,out); return out;
  }
  const picks=best(0,0).picks;
  // fill in missing end times from the school's own rhythm
  const known=picks.filter(p=>p.end!=null);
  const durs=known.map(p=>p.end-p.start).sort((x,y)=>x-y), med=durs.length?durs[Math.floor(durs.length/2)]:50;
  const gaps=[]; for(let k=0;k+1<picks.length;k++){ if(picks[k].end!=null) gaps.push(picks[k+1].start-picks[k].end); }
  const g=gaps.filter(x=>x>=0&&x<=20).sort((x,y)=>x-y), pass=g.length?g[Math.floor(g.length/2)]:5;
  return picks.map((p,k)=>{
    let end=p.end, guessed=false;
    if(end==null){ guessed=true; const nx=picks[k+1]; end=nx?nx.start-pass:p.start+med; if(end-p.start<5) end=p.start+Math.min(med,nx?nx.start-p.start:med); }
    return {start:fromMin(p.start),end:fromMin(Math.min(end,23*60)),startLine:times[p.a].line,endLine:p.b!=null?times[p.b].line:times[p.a].line,guessed};
  });
}

function isNoise(s){
  if(!s) return true;
  const t=s.trim(); if(t.length<3) return true;
  const letters=(t.match(/[A-Za-z]/g)||[]).length;
  if(letters<3 || letters/t.replace(/\s/g,'').length<0.55) return true;
  if(NOISE_EXACT.test(t)||WEEKDAY_START.test(t)||MONTH_START.test(t)) return true;
  if(/\b(LTE|5G|4G|wifi|battery)\b|%/i.test(t)) return true;
  if(/^(periods?|blocks?)\s*\d+\s*(-|to)\s*\d+$/i.test(t)) return true;
  if((t.match(/\b(home|grades|schedule|more|calendar|messages|settings|attendance|assignments|inbox|profile|menu)\b/gi)||[]).length>=2) return true;
  return false;
}
function cleanText(s){
  s=String(s).replace(/^\s*[^\w\s]*\s*[a-z]{1,2}\s+(?=[A-Z])/,'');
  s=fixRoman(s.replace(/^[^A-Za-z0-9]+/,'').replace(/\s+$/,''));
  s=s.replace(/[^A-Za-z0-9)]+$/,'');
  if(s.includes(')')&&!s.includes('(')) s=s.replace(/\)/g,'');
  if(s.includes('(')&&!s.includes(')')) s=s.replace(/\(/g,'');
  return s
    .replace(/(^|\s)[^A-Za-z0-9\s()&'.,\-\/]+(?=\s|$)/g,'')
    .replace(/\s+[a-z]$/,'').replace(/\s{2,}/g,' ').trim();
}
function wordsOf(s){return s.toLowerCase().replace(/[^a-z\s\-]/g,' ').split(/\s+/).filter(Boolean)}
function hasSubject(s){return wordsOf(s).some(w=>SUBJ.has(w))}
function personLike(s){
  const t=(s||'').trim();
  if(!t||/\d/.test(t)) return false;
  if(/^(mr|mrs|ms|miss|dr|mx|coach)\.?\s+[A-Z]/i.test(t)) return true;
  if(/^[A-Z]\.\s?[A-Z][a-z'\-]+$/.test(t)) return true;
  if(/^[A-Z][A-Za-z'\-]+,\s*[A-Z][A-Za-z'\-]+(\s[A-Z]\.?)?$/.test(t)) return !hasSubject(t);
  const w=t.split(/\s+/);
  if(w.length<2||w.length>4) return false;
  if(!w.every(x=>/^[A-Z][a-z'\-]+\.?$|^[A-Z]\.$|^[A-Z][A-Z'\-]+$/.test(x))) return false;
  return !hasSubject(t);
}
function fixTeacher(s){
  const m=s.match(/^([A-Z][A-Za-z'\-]+),\s*([A-Z][A-Za-z'\-]+(?:\s[A-Z]\.?)?)$/);
  return m?(m[2]+' '+m[1]):s;
}
const PERIOD_RE=/\b(?:period|per|pd|block|blk)\b\.?\s*[:#]?\s*(\d{1,2})\b/i, PERIOD_RE2=/\b(\d{1,2})(?:st|nd|rd|th)\s+(?:period|block)\b/i;
const ROOM_RE=/\b(?:room|rm|rn|location|loc)\b\.?\s*[:#.]?\s*([A-Za-z0-9][A-Za-z0-9\-\/]*)/i;

const TEACHER_TAIL=/(?:^|\s)((?:mr|mrs|ms|miss|dr|mx|coach)\.?\s+[A-Z][A-Za-z'\-]+|[A-Z][A-Za-z'\-]+,\s*[A-Z][A-Za-z'\-]+(?:\s[A-Z]\.?)?|[A-Z]\.\s?[A-Z][A-Za-z'\-]+)$/;
function classifyBlock(lines){
  const out={name:'',room:'',teacher:'',period:'',cands:[]};
  const take=(str,m)=>[str.slice(0,m.index),str.slice(m.index+m[0].length)];
  for(const raw of lines){
    let s=(raw||'').trim(); if(!s) continue; let m;
    if(!out.period&&(m=s.match(/^(\d{1,2})\s+(?=[A-Za-z]{2})/))&&!PERIOD_RE.test(s)){ out.period=m[1]; s=s.slice(m[0].length); }
    let parts=[s];
    const splitOn=(re,fn)=>{ const next=[]; parts.forEach(p=>{ const mm=p.match(re); if(mm&&fn(mm)!==false){ next.push(...take(p,mm)); } else next.push(p); }); parts=next; };
    splitOn(PERIOD_RE,mm=>{ if(out.period) return false; out.period=mm[1]; });
    if(!out.period) splitOn(PERIOD_RE2,mm=>{ out.period=mm[1]; });
    splitOn(ROOM_RE,mm=>{ const v=mm[1].replace(/[.,;:]+$/,''); if(/^(teacher|time|course|class|name|number)$/i.test(v)) return false; if(!out.room) out.room=v; });
    // table rows: "1  World History  214  Rivera, Ana"
    if(!out.room) splitOn(/\s([A-Z]?\d{3,4}[A-Z]?)(?=\s+\S)/,mm=>{ out.room=mm[1]; });
    const next=[];
    parts.forEach(p=>{
      p=p.replace(/([A-Za-z]\s)([lI|]{1,3})\s*$/,(m,pre,r)=>pre+'I'.repeat(r.length));
      p.split(/\s*[·•|]\s*/).forEach(q=>{
        q=q.trim(); if(!q) return;
        const tm=q.match(/^(?:teacher|instructor|staff)\s*[:\-]?\s*(.+)$/i);
        if(tm){ if(!out.teacher) out.teacher=fixTeacher(cleanText(tm[1])); return; }
        const dash=q.match(/^(.*\S)\s+-\s+(.+)$/); if(dash&&personLike(cleanText(dash[2]))){ next.push(dash[1],dash[2]); return; }
        const tt=q.match(TEACHER_TAIL); if(tt&&tt.index>0&&/[A-Za-z]{3}/.test(q.slice(0,tt.index))){ next.push(q.slice(0,tt.index),tt[1]); return; }
        next.push(q);
      });
    });
    next.forEach(q=>{ q=cleanText(q.replace(/^(?:course|class|subject)\s*[:\-]\s*/i,'')); if(!isNoise(q)) out.cands.push(q); });
  }
  const c=out.cands.slice();
  if(c.length>=2 && personLike(c[0]) && !personLike(c[1])) [c[0],c[1]]=[c[1],c[0]];
  if(c.length) out.name=c[0];
  if(!out.teacher){ const t=c.slice(1).find(personLike); if(t) out.teacher=fixTeacher(t); }
  return out;
}

function scoreBlocks(blocks){
  let s=0;
  blocks.forEach(b=>{ if(b.name) s+=2; if(b.room) s+=1; if(b.teacher) s+=1; if(b.cands.length>3) s-=1; if(b.name&&hasSubject(b.name)) s+=1; if(b.name&&personLike(b.name)) s-=2; });
  return s;
}
const LONE_PERIOD=/^\s*(?:period|per|block)\s*\d{1,2}\s*$/i;

function parseScheduleText(text){
  const {times,content}=tokenizeLines(text);
  const ranges=findRanges(times,content);
  if(!ranges.length) return {classes:[],score:0,ranges:0,layout:'none'};
  const N=ranges.length, L=content.length;
  const cands={};
  // Layout "after": details on the time's line and below it
  cands.after=ranges.map((r,k)=>{
    const from=r.startLine, to=k+1<N?ranges[k+1].startLine:Math.min(L,r.endLine+6);
    const ls=content.slice(from,to);
    while(k+1<N && ls.length && LONE_PERIOD.test(ls[ls.length-1])) ls.pop();
    for(let j=from-1;j>=Math.max(0,from-2);j--){ if(LONE_PERIOD.test(content[j]||'')){ ls.unshift(content[j]); break; } }
    return classifyBlock(ls);
  });
  // Layout "before": details above the time
  cands.before=ranges.map((r,k)=>{
    const from=k>0?ranges[k-1].endLine+1:Math.max(0,r.startLine-6), to=r.endLine+1;
    return classifyBlock(content.slice(from,to));
  });
  // Layout "columns": OCR read the time column on its own; anchor records on Room lines
  const all=content.map(s=>s.trim()).filter(s=>s&&!(isNoise(cleanText(s))&&!ROOM_RE.test(s)&&!PERIOD_RE.test(s)));
  const roomIdx=[]; all.forEach((s,i)=>{if(ROOM_RE.test(s)) roomIdx.push(i)});
  if(roomIdx.length>=2){
    cands.columns=ranges.map((r,k)=>{
      const ri=roomIdx[k]; if(ri==null) return classifyBlock([]);
      const lo=k>0?roomIdx[k-1]+1:0;
      const pre=all.slice(lo,ri);
      const ls=[];
      // previous record's teacher sits right after its room line: skip it
      let start=0; if(k>0 && pre.length>1 && personLike(cleanText(pre[0]))) start=1;
      const body=pre.slice(start);
      const per=body.filter(x=>PERIOD_RE.test(x)&&cleanText(x.replace(PERIOD_RE,'')).length<3);
      const real=body.filter(x=>!per.includes(x)&&!isNoise(cleanText(x)));
      ls.push(...per.slice(-1), ...real.slice(-1));
      ls.push(all[ri]);
      const nxt=all[ri+1]; if(nxt && personLike(cleanText(nxt))) ls.push(nxt);
      return classifyBlock(ls);
    });
  }
  let layout='after', best=cands.after, bestScore=scoreBlocks(cands.after);
  for(const k of ['before','columns']){ if(!cands[k]) continue; const sc=scoreBlocks(cands[k]); if(sc>bestScore){best=cands[k];bestScore=sc;layout=k;} }
  const classes=ranges.map((r,k)=>{
    const b=best[k]||{};
    return {name:b.name||'',start:r.start,end:r.end,room:b.room||'',teacher:b.teacher||'',period:b.period||'',endGuessed:!!r.guessed};
  });
  return {classes,score:bestScore,ranges:N,layout};
}

/* ======================= SCHEDULE BUILDER ======================= */
function validClass(c){return c&&c.start&&c.end&&toMin(c.end)>toMin(c.start)&&String(c.name||'').trim()}
function usesRotation(st){return st.settings.startType!=='NONE' && st.classes.some(c=>c.dayType==='A'||c.dayType==='B')}
function schoolDayList(st){
  const S=st.settings, out=[];
  if(!S.startDate||!S.endDate||S.endDate<S.startDate) return out;
  const off=new Set(S.daysOff||[]), rot=usesRotation(st);
  let type=S.startType==='B'?'B':'A';
  for(let d=S.startDate; d<=S.endDate; d=addDays(d,1)){
    if(!S.schoolDays.includes(weekday(d))||off.has(d)) continue;
    out.push({date:d,type:rot?type:null});
    if(rot) type=type==='A'?'B':'A';
  }
  return out;
}
function classesFor(st,type){
  return st.classes.filter(c=>validClass(c)&&(c.dayType==='ALL'||type===null||c.dayType===type))
    .sort((a,b)=>toMin(a.start)-toMin(b.start));
}
function buildDays(st, fromDate, toDate){
  const S=st.settings, R=st.reminders;
  const byDate={}; schoolDayList(st).forEach(x=>byDate[x.date]=x);
  const off=new Set(S.daysOff||[]);
  const ends=st.classes.filter(validClass).map(c=>toMin(c.end));
  const typicalEnd=ends.length?Math.max(...ends):15*60;
  const days=[]; const from=fromDate||S.startDate, to=toDate||S.endDate;
  if(!from||!to) return days;
  for(let d=from; d<=to; d=addDays(d,1)){
    const wd=weekday(d), sch=byDate[d], next=byDate[addDays(d,1)];
    const inTerm=d>=S.startDate&&d<=S.endDate;
    const cl=sch?classesFor(st,sch.type):[];
    const day={date:d,wd,inTerm,school:!!sch,type:sch?sch.type:null,off:inTerm&&off.has(d),classes:cl,acts:[],game:null,morning:null,evening:null,hw:null,nextSchool:next||null};
    if(inTerm){
      (st.activities||[]).forEach(a=>{
        if(!a.days||!a.days.includes(wd)) return;
        if(a.skipOff!==false && off.has(d)) return;
        const s=a.afterSchool?(cl.length?Math.max(...cl.map(c=>toMin(c.end))):typicalEnd):toMin(a.start);
        const e=toMin(a.end); if(s==null||e==null||e<=s) return;
        day.acts.push({name:a.name||'Practice',start:fromMin(s),end:fromMin(e),afterSchool:!!a.afterSchool,assumed:!!a.afterSchool&&!cl.length,alert:+a.alert||0,location:a.location||''});
      });
      const g=st.games;
      if(g&&g.on&&g.days.includes(wd)&&!(g.skipOff!==false&&off.has(d))) day.game={name:g.name||'Game day'};
    }
    if(R.morning&&R.morningTime&&sch) day.morning=R.morningTime;
    if(R.evening&&R.eveningTime&&(sch||next)) day.evening=R.eveningTime;
    if(R.hw&&R.hwStart&&R.hwEnd&&toMin(R.hwEnd)>toMin(R.hwStart)&&(inTerm||next)){
      const actNight=day.acts.length>0, schNight=!!next;
      if((R.hwOn==='activity'&&actNight)||(R.hwOn==='school'&&schNight)||(R.hwOn==='both'&&(actNight||schNight))) day.hw={start:R.hwStart,end:R.hwEnd};
    }
    days.push(day);
  }
  return days;
}

/* ======================= ICS GENERATOR (RFC 5545) ======================= */
function icsEscape(s){return String(s==null?'':s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n')}
function utf8len(ch){const c=ch.codePointAt(0);return c<0x80?1:c<0x800?2:c<0x10000?3:4}
function fold(line){
  const out=[]; let cur='', bytes=0;
  for(const ch of line){
    const b=utf8len(ch);
    if(bytes+b>75){ out.push(cur); cur=' '+ch; bytes=1+b; } else { cur+=ch; bytes+=b; }
  }
  out.push(cur); return out.join('\r\n');
}
const dtfCache={};
function tzOffsetMin(tz,date){
  const dtf=dtfCache[tz]||(dtfCache[tz]=new Intl.DateTimeFormat('en-US',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}));
  const p={}; for(const x of dtf.formatToParts(date)) p[x.type]=x.value;
  const asUTC=Date.UTC(+p.year,+p.month-1,+p.day,(+p.hour)%24,+p.minute,+p.second);
  return Math.round((asUTC-Math.floor(date.getTime()/1000)*1000)/60000);
}
function fmtOff(m){const s=m<0?'-':'+';m=Math.abs(m);return s+pad(Math.floor(m/60))+pad(m%60)}
function utcStamp(t){return new Date(t).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}
/* Builds a VTIMEZONE from the browser's own tz database: one observance per real transition. */
function buildVTimezone(tz,fromYear,toYear){
  const H=3*3600e3, start=Date.UTC(fromYear,0,1), end=Date.UTC(toYear+1,0,1);
  let prev=tzOffsetMin(tz,new Date(start)); const initial=prev, trans=[];
  for(let t=start+H;t<=end;t+=H){
    const o=tzOffsetMin(tz,new Date(t));
    if(o!==prev){
      let lo=t-H,hi=t;
      while(hi-lo>60000){ const mid=lo+Math.floor((hi-lo)/120000)*60000; if(mid<=lo)break; if(tzOffsetMin(tz,new Date(mid))===prev) lo=mid; else hi=mid; }
      trans.push({at:hi,from:prev,to:o}); prev=o;
    }
  }
  const std=Math.min(initial,...trans.map(x=>x.to));
  const L=['BEGIN:VTIMEZONE','TZID:'+tz];
  const comp=(kind,dt,from,to)=>L.push('BEGIN:'+kind,'DTSTART:'+dt,'TZOFFSETFROM:'+fmtOff(from),'TZOFFSETTO:'+fmtOff(to),'END:'+kind);
  comp(initial>std?'DAYLIGHT':'STANDARD','19700101T000000',initial,initial);
  trans.forEach(x=>comp(x.to>x.from?'DAYLIGHT':'STANDARD',utcStamp(x.at+x.from*60000).replace('Z',''),x.from,x.to));
  L.push('END:VTIMEZONE'); return L;
}
function rid(){ try{ if(root.crypto&&root.crypto.randomUUID) return root.crypto.randomUUID(); }catch(e){} return 'x'+Math.random().toString(36).slice(2)+Date.now().toString(36); }
function roomLabel(r){ r=String(r||'').trim(); if(!r) return ''; if(/^room\b/i.test(r)) return r; return /^[A-Za-z]?-?\d/.test(r)?'Room '+r:r; }

function buildICS(st,opts){
  opts=opts||{};
  const S=st.settings, tz=S.tz||'UTC', R=st.reminders;
  const stamp=utcStamp(opts.now||Date.now()), batch=opts.batchId||rid();
  const days=buildDays(st, addDays(S.startDate,-1), S.endDate);
  const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Ayaama//Schedule to Calendar 1.0//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH',
    'X-WR-CALNAME:'+icsEscape(S.calName||'My School Schedule'),'X-WR-TIMEZONE:'+tz,
    'X-WR-CALDESC:'+icsEscape('Made with Ayaama. Snap your schedule. Stay on time.')];
  L.push(...buildVTimezone(tz,+S.startDate.slice(0,4)-1,+S.endDate.slice(0,4)+1));
  let n=0; const counts={classes:0,activities:0,games:0,morning:0,evening:0,homework:0,dayoff:0};
  const dt=(d,hhmm)=>d.replace(/-/g,'')+'T'+hhmm.replace(':','')+'00';
  const ev=o=>{
    n++; L.push('BEGIN:VEVENT','UID:'+batch+'-'+n+'@ayaama.app','DTSTAMP:'+stamp);
    if(o.allDay) L.push('DTSTART;VALUE=DATE:'+o.date.replace(/-/g,''),'DTEND;VALUE=DATE:'+addDays(o.date,1).replace(/-/g,''));
    else L.push('DTSTART;TZID='+tz+':'+dt(o.date,o.start),'DTEND;TZID='+tz+':'+dt(o.date,o.end));
    L.push('SUMMARY:'+icsEscape(o.summary));
    if(o.location) L.push('LOCATION:'+icsEscape(o.location));
    if(o.description) L.push('DESCRIPTION:'+icsEscape(o.description));
    if(o.categories) L.push('CATEGORIES:'+o.categories.map(icsEscape).join(','));
    if(o.transparent) L.push('TRANSP:TRANSPARENT');
    if(o.alarm!=null){ const m=+o.alarm||0; L.push('BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+icsEscape(o.alarmText||o.summary),'TRIGGER:'+(m>0?'-PT'+m+'M':'PT0M'),'END:VALARM'); }
    L.push('END:VEVENT');
  };
  const listFor=cls=>cls.map(c=>'• '+c.name+(c.room?' ('+roomLabel(c.room)+')':'')).join('\n');
  const endPlus=(t,k)=>fromMin(Math.min(toMin(t)+k,1439));
  days.forEach(day=>{
    const inTerm=day.inTerm;
    if(inTerm&&day.school) day.classes.forEach(c=>{
      const bits=[]; if(c.period) bits.push('Period '+c.period); if(day.type) bits.push(day.type+' day'); if(c.teacher) bits.push(c.teacher);
      const mins=+R.classMin||0;
      ev({date:day.date,start:c.start,end:c.end,summary:c.name,location:roomLabel(c.room),description:bits.join(' · '),categories:['Class'],
        alarm:R.classAlert?mins:null,alarmText:mins>0?c.name+' starts in '+mins+' minutes':c.name+' is starting'});
      counts.classes++;
    });
    if(inTerm&&day.off&&st.settings.schoolDays.includes(day.wd)){ ev({date:day.date,allDay:true,summary:'No school',categories:['Day off'],transparent:true}); counts.dayoff++; }
    if(inTerm) day.acts.forEach(a=>{
      ev({date:day.date,start:a.start,end:a.end,summary:a.name,location:a.location,description:a.assumed?'No school today, so this uses the usual end of the school day. Check the start time.':a.afterSchool?'Starts when school ends.':'',categories:['Activity'],
        alarm:a.alert>0?a.alert:null,alarmText:a.name+' starts in '+a.alert+' minutes'}); counts.activities++;
    });
    if(inTerm&&day.game){ ev({date:day.date,allDay:true,summary:day.game.name+' (add start time)',description:'Placeholder: edit this event once you know the game time and place.',categories:['Game'],transparent:true}); counts.games++; }
    if(day.morning){
      ev({date:day.date,start:day.morning,end:endPlus(day.morning,10),summary:'Any quizzes or due work today?',
        description:(day.type?'Today is a '+day.type+' day.\n':'')+'Quick check before you leave:\n'+listFor(day.classes)+'\nPack what you need.',
        categories:['Reminder'],alarm:0,alarmText:'Any quizzes or due work today?',transparent:true}); counts.morning++;
    }
    if(day.evening){
      let desc='Look in each class for homework, projects, and quizzes.';
      if(day.nextSchool) desc+='\nTomorrow'+(day.nextSchool.type?' ('+day.nextSchool.type+' day)':'')+':\n'+listFor(classesFor(st,day.nextSchool.type));
      if(day.school&&inTerm) desc+='\nToday'+(day.type?' ('+day.type+' day)':'')+':\n'+listFor(day.classes);
      desc+='\nAdd anything due to your calendar so nothing sneaks up on you.';
      ev({date:day.date,start:day.evening,end:endPlus(day.evening,10),summary:'Check assignments and quizzes',description:desc,categories:['Reminder'],alarm:0,alarmText:'Check assignments and quizzes',transparent:true}); counts.evening++;
    }
    if(day.hw){ ev({date:day.date,start:day.hw.start,end:day.hw.end,summary:'Homework time',description:'Start with whatever is due first.',categories:['Homework']}); counts.homework++; }
  });
  L.push('END:VCALENDAR');
  return {text:L.map(fold).join('\r\n')+'\r\n',count:n,counts};
}

root.Ayaama={normalizeOcr,tokenizeLines,findRanges,parseScheduleText,classifyBlock,personLike,schoolDayList,buildDays,buildICS,buildVTimezone,tzOffsetMin,fold,icsEscape,addDays,weekday,niceDate,fmt12,toMin,fromMin,roomLabel,validClass};
})(typeof window!=='undefined'?window:globalThis);
