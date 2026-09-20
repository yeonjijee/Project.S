const COLOR_MAP = {
  "레드":"#c94b32","블루":"#3a6fb0","옐로":"#d9a72c","그린":"#4a8f5c","핑크":"#c9698f",
  "블랙":"#3a3a3d","화이트":"#d8d5cb","골드":"#c9a24b","실버":"#9a9a9d","오렌지":"#d9722c",
  "바이올렛":"#7a5aa8","시안":"#4ab0c9","그레이":"#7d7d7f","브라운":"#8a6a4a"
};
function colorFor(name){
  for(const k in COLOR_MAP){ if(name && name.includes(k)) return COLOR_MAP[k]; }
  return "#c94b32";
}
const KEY = 'projectR_archive';

function getArchive(){
  try{ return JSON.parse(localStorage.getItem(KEY) || '[]'); }catch(e){ return []; }
}
function setArchive(arr){ localStorage.setItem(KEY, JSON.stringify(arr)); }

function render(){
  const arr = getArchive().slice().sort((a,b)=> (b.ts||0)-(a.ts||0));
  el('statCount').textContent = arr.length;
  el('statHeroes').textContent = new Set(arr.map(r=>r.heroName)).size;

  const freq = {};
  arr.forEach(r=>{ freq[r.heroName] = (freq[r.heroName]||0)+1; });
  const top = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,8);
  el('topHeroes').innerHTML = top.map(([name,count])=>{
    const rec = arr.find(r=>r.heroName===name);
    const c = colorFor(rec ? rec.heroColor : '');
    return `<div class="top-hero-pill"><span class="dot" style="background:${c}"></span>${name} · ${count}</div>`;
  }).join('') || '<span style="color:var(--text-faint);font-size:13px;">아직 데이터가 없습니다</span>';

  // 기록 목록(카드 벽)은 지구본으로 대체됐다 — 점을 클릭하면 globe.js가 같은 정보를 보여준다.
  el('emptyState').style.display = arr.length===0 ? 'block' : 'none';
  if(window.refreshGlobePoints) window.refreshGlobePoints(); // 지구본 점도 같이 갱신
}
function escapeHtml(s){ return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function el(id){ return document.getElementById(id); }

function exportArchive(){
  const data = JSON.stringify(getArchive(), null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `project-r_archive_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

el('importFile').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const incoming = JSON.parse(reader.result);
      const current = getArchive();
      const merged = current.concat(incoming);
      setArchive(merged);
      render();
    }catch(err){
      alert('올바른 기록 JSON 파일이 아닙니다.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

function clearArchive(){
  if(confirm('보관된 모든 기록을 삭제할까요? 이 동작은 되돌릴 수 없습니다.')){
    setArchive([]);
    render();
  }
}

const SAMPLE = [
  {ts:Date.now()-86400000*2, heroName:"긴가 레드", heroSeries:"성수전대 긴가맨", heroColor:"레드", userKeywords:["순수함","정에 약함","미숙함"], matchedKeywords:["순수함","미숙함"], freeText:"운동선수가 되고 싶었지만 부상으로 그만뒀다."},
  {ts:Date.now()-86400000*1, heroName:"메가 실버", heroSeries:"전자전대 메가레인저", heroColor:"실버", userKeywords:["자유분방","거리감","자존심"], matchedKeywords:["자유분방","거리감"], freeText:"조직에 잘 섞이지 못하는 게 늘 콤플렉스였다."},
  {ts:Date.now()-3600000*5, heroName:"긴가 옐로", heroSeries:"성수전대 긴가맨", heroColor:"옐로", userKeywords:["단순함","행동력"], matchedKeywords:["단순함"], freeText:""},
];
function loadSample(){
  const current = getArchive();
  setArchive(current.concat(SAMPLE));
  render();
}

render();
