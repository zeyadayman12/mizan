/* Mizan engine: the money math.
   Pure calculations only (no screens, no storage). Used by index.html and by the tests in /tests.
   Every function reads the app data from the global `state`. */
"use strict";

const UNDO_MS = 10*60*1000;     // money-in entries can be undone for 10 minutes after saving

/* ---------- small helpers ---------- */
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function today(){ const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); }
function addDays(s,n){ const d=new Date(s+"T12:00:00"); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
function daysBetween(a,b){ return Math.round((new Date(b+"T12:00:00") - new Date(a+"T12:00:00"))/86400000); }
function r2(x){ return Math.round(x*100)/100; }
function num(v){ const n=parseFloat(String(v).replace(/,/g,"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d))); return isFinite(n)?n:0; }
function monthKey(s){ return s.slice(0,7); }
function shiftMonth(k,n){ const d=new Date(k+"-15T12:00:00"); d.setMonth(d.getMonth()+n); return d.toISOString().slice(0,7); }

/* ---------- undo window ---------- */
function undoLeft(inc){                       // ms left to undo; 0 means final
  if(!inc || !inc.createdAt) return 0;
  const age = Date.now() - inc.createdAt;
  if(age < 0) return 0;                       // clock moved back: treat as final
  return Math.max(0, UNDO_MS - age);
}

/* ---------- split engine ----------
   Sadaqah and savings come off the full amount (sadaqah rounds UP, savings to nearest).
   An optional "set aside" amount goes to a chosen pot next.
   The rest is shared by the other pots' percentages; "Me" receives the rounding remainder,
   so the parts always add up to exactly the amount. */
function pctsFor(source){
  const rule = source && state.settings.sourceRules[source];
  const out = {}; state.settings.pots.forEach(p=> out[p.id] = rule ? (num(rule[p.id])||0) : p.pct);
  return out;
}
function computeSplit(amount, earmark, source, sadPct){
  const S = state.settings, r = S.rounding || 1, pots = S.pots, pc = pctsFor(source);
  if(sadPct!=null && sadPct>pc.sadaqah) pc.sadaqah = sadPct;   // extra sadaqah for this entry only
  const out = {}; pots.forEach(p=>out[p.id]=0);
  if(!(amount>0)) return { split: out, ear: 0, capped: false };
  const up = x=>Math.ceil(x/r-1e-9)*r, near = x=>Math.round(x/r)*r, down = x=>Math.floor(x/r+1e-9)*r;
  let left = amount;
  for(const p of pots.filter(p=>p.base==="gross")){
    let v = p.id==="sadaqah" ? up(amount*pc[p.id]/100) : near(amount*pc[p.id]/100);
    v = Math.max(0, Math.min(v, left)); out[p.id] = v; left -= v;
  }
  let ear = 0;
  if(earmark && earmark.pot && earmark.amount>0 && out.hasOwnProperty(earmark.pot)){ ear = Math.min(earmark.amount, left); out[earmark.pot] += ear; left -= ear; }
  const flex = pots.filter(p=>p.base==="rest"), tot = flex.reduce((s,p)=>s+pc[p.id],0), pool = left;
  for(const p of flex){ if(p.id==="me") continue; const v = tot ? Math.max(0, Math.min(down(pool*pc[p.id]/tot), left)) : 0; out[p.id] += v; left -= v; }
  out.me = (out.me||0) + left;
  for(const k in out) out[k] = r2(out[k]);
  return { split: out, ear: r2(ear), capped: !!(earmark && earmark.amount>ear+1e-9) };
}

/* ---------- balances & derived numbers ---------- */
function loanPaid(l){ return (l.pays||[]).reduce((s,p)=>s+p.amount,0); }
function balances(){
  const b = {}; state.settings.pots.forEach(p=>b[p.id]=0);
  const add=(k,v)=>{ b[k]=(b[k]||0)+v; };
  state.incomes.forEach(i=>{ for(const k in i.split) add(k, i.split[k]); });
  state.spends.forEach(s=>add(s.pot, -s.amount));
  state.moves.forEach(m=>{ add(m.from,-m.amount); add(m.to,m.amount); });
  state.gold.forEach(g=>add("savings", -g.egp));
  state.loans.forEach(l=>{ const sg = l.dir==="lent" ? -1 : 1; add(l.pot, sg*l.amount); add(l.pot, -sg*loanPaid(l)); });
  for(const k in b) b[k]=r2(b[k]);
  return b;
}
function goldStatus(){
  const G = state.settings.gold;
  const savedEver = state.incomes.reduce((s,i)=>s+(i.split.savings||0),0) + state.moves.filter(m=>m.to==="savings").reduce((s,m)=>s+m.amount,0);
  const bought = state.gold.reduce((s,g)=>s+g.egp,0);
  const dueTotal = Math.floor(savedEver/G.every + 1e-9)*G.buy;
  const cash = balances().savings;
  return { savedEver:r2(savedEver), bought:r2(bought), due:r2(Math.max(0, Math.min(dueTotal-bought, cash))), toNext:r2(G.every - (savedEver % G.every)), cash:r2(cash) };
}
function perGram(karat){ const gp = state.settings.goldPrice; return gp && gp.p21>0 ? gp.p21*(karat||21)/21 : 0; }
function goldValue(){
  let value=0, paid=0, unknown=0;
  state.gold.forEach(g=>{ paid+=g.egp; if(g.grams>0) value += g.grams*perGram(g.karat||21); else { unknown++; value += g.egp; } });
  const hasPrice = perGram(21)>0;
  return { value: hasPrice ? r2(value) : null, paid:r2(paid), unknown, hasPrice };
}
function savedTotal(){ const gv = goldValue(); return r2((balances().savings||0) + (gv.hasPrice ? gv.value : gv.paid)); }
function loanTotals(){
  let owedToMe=0, iOwe=0;
  state.loans.forEach(l=>{ const left = l.amount - loanPaid(l); if(left<=0.001) return; if(l.dir==="lent") owedToMe+=left; else iOwe+=left; });
  return { owedToMe:r2(owedToMe), iOwe:r2(iOwe) };
}
function zakatStatus(){
  const N = state.settings.nisab, pg = perGram(N.karat);
  if(!(pg>0)) return { needPrice:true };
  const b = balances(), gv = goldValue();
  let cash = 0; for(const k in b) if(k!=="sadaqah") cash += b[k];
  const wealth = r2(Math.max(0,cash) + (gv.value||0)), nisab = r2(N.grams*pg), above = wealth >= nisab;
  const hs = state.zakat.hawlStart, dueDate = hs ? addDays(hs, 354) : null;
  return { wealth, nisab, above, hawlStart:hs, dueDate, due: !!(above && dueDate && today() >= dueDate), daysLeft: dueDate ? daysBetween(today(), dueDate) : null, amount: Math.ceil(wealth*0.025) };
}
function inflowPerDay(potId){
  if(!state.incomes.length) return 0;
  const first = state.incomes.map(i=>i.date).sort()[0];
  const from = addDays(today(), -90) > first ? addDays(today(), -90) : first;
  let sum = 0;
  state.incomes.forEach(i=>{ if(i.date>=from) sum += (i.split[potId]||0); });
  state.moves.forEach(m=>{ if(m.date>=from){ if(m.to===potId) sum+=m.amount; if(m.from===potId) sum-=m.amount; } });
  return Math.max(0, sum/Math.max(30, daysBetween(from, today())+1));
}
function goalStatus(w, b){
  const open = state.wishes.filter(x=>!x.bought && x.pot===w.pot);
  let cum = 0; for(const x of open){ cum += x.price; if(x.id===w.id) break; }
  const bal = Math.max(0, b[w.pot]||0);
  const covered = Math.max(0, Math.min(w.price, bal - (cum - w.price)));
  const remaining = r2(Math.max(0, cum - bal));
  const res = { covered, remaining, pct: w.price>0 ? covered/w.price*100 : 100 };
  if(remaining<=0){ res.kind="ready"; return res; }
  const rate = inflowPerDay(w.pot);
  res.eta = rate>0 ? addDays(today(), Math.ceil(remaining/rate)) : null;
  if(!w.due){ res.kind="nodate"; return res; }
  const daysLeft = daysBetween(today(), w.due);
  if(daysLeft<0){ res.kind="late"; return res; }
  if(res.eta && res.eta<=w.due){ res.kind="ontrack"; return res; }
  res.kind="behind"; res.extra = Math.ceil(Math.max(0, remaining/(Math.max(daysLeft,1)/30.4) - rate*30.4)/5)*5;
  return res;
}
function monthStats(mk){
  const inc = state.incomes.filter(i=>monthKey(i.date)===mk);
  const bySrc = {}; inc.forEach(i=>bySrc[i.source]=(bySrc[i.source]||0)+i.amount);
  const byPot = {}; let gave=0, zakat=0, spent=0;
  state.spends.filter(s=>monthKey(s.date)===mk).forEach(s=>{ if(s.type==="reset") return; if(s.type==="give") gave+=s.amount; else if(s.type==="zakat") zakat+=s.amount; else { spent+=s.amount; byPot[s.pot]=(byPot[s.pot]||0)+s.amount; } });
  let saved = inc.reduce((a,i)=>a+(i.split.savings||0),0);
  state.moves.filter(m=>monthKey(m.date)===mk).forEach(m=>{ if(m.to==="savings") saved+=m.amount; if(m.from==="savings") saved-=m.amount; });
  const gold = state.gold.filter(g=>monthKey(g.date)===mk);
  return { in:r2(inc.reduce((a,i)=>a+i.amount,0)), bySrc, spent:r2(spent), byPot, gave:r2(gave), zakat:r2(zakat), saved:r2(saved), goldEgp:r2(gold.reduce((a,g)=>a+g.egp,0)) };
}
