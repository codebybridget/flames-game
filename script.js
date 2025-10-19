/* Constants & DOM  */
const THEME_KEY = 'flames-theme';
const DATA_KEY  = 'flames-data';    
const HISTORY_KEY = 'flames-history';
const SOUND_KEY = 'flames-sound';   

const els = {
  name1: document.getElementById('name1'),
  name2: document.getElementById('name2'),
  name1Out: document.getElementById('name1Out'),
  name2Out: document.getElementById('name2Out'),
  countOut: document.getElementById('countOut'),
  log: document.getElementById('log'),
  flamesArea: document.getElementById('flamesArea'),
  result: document.getElementById('result'),
  meaning: document.getElementById('meaning'),
  playBtn: document.getElementById('playBtn'),
  resetBtn: document.getElementById('resetBtn'),
  themeToggle: document.getElementById('themeToggle'),
  soundToggle: document.getElementById('soundToggle'),
  shareBtn: document.getElementById('shareBtn'),
  historyList: document.getElementById('historyList'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn')
};

/* Small helpers  */
function normalize(name){ return name.toLowerCase().replace(/[^a-z]/g,'').split(''); }
function fmtDateIsoNow(){ return new Date().toISOString(); }
function prettyDate(iso){ const d=new Date(iso); return d.toLocaleString(); }

/* Theme (dark-first) */
(function initTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  if(saved === 'light') document.body.classList.add('light-theme');
})();
els.themeToggle.addEventListener('click', () => {
  const isLight = document.body.classList.toggle('light-theme');
  localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');
});

/*  Sound (WebAudio fun blips) */
let audioCtx = null;
function ensureAudio(){
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

// Fun cartoonish blip: short oscillator burst with quick envelope
function playBlip(freq=880, type='sine', duration=0.12){
  if(localStorage.getItem(SOUND_KEY) === 'off') return;
  try {
    ensureAudio();
    const ctx = audioCtx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = 0.0001;
    o.connect(g); g.connect(ctx.destination);
    const now = ctx.currentTime;
    g.gain.linearRampToValueAtTime(0.18, now + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    o.start(now); o.stop(now + duration + 0.02);
  } catch(e){}
}

// Final chime: three rising notes
function playChime(){
  if(localStorage.getItem(SOUND_KEY) === 'off') return;
  try {
    ensureAudio();
    const ctx = audioCtx;
    const now = ctx.currentTime;
    const freqs = [480, 660, 880];
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = i % 2 === 0 ? 'sine' : 'triangle';
      o.frequency.value = f;
      g.gain.value = 0.0001;
      o.connect(g); g.connect(ctx.destination);
      g.gain.linearRampToValueAtTime(0.18, now + 0.02 + i*0.06);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.28 + i*0.06);
      o.start(now + i*0.06); o.stop(now + 0.42 + i*0.06);
    });
  } catch(e){}
}

// initialize sound toggle UI from localStorage (default ON)
(function initSoundToggle(){
  const saved = localStorage.getItem(SOUND_KEY);
  if(saved === 'off') {
    els.soundToggle.textContent = '🔈';
    els.soundToggle.setAttribute('aria-pressed','false');
  } else {
    localStorage.setItem(SOUND_KEY,'on');
    els.soundToggle.textContent = '🔊';
    els.soundToggle.setAttribute('aria-pressed','true');
  }
})();
els.soundToggle.addEventListener('click', () => {
  const cur = localStorage.getItem(SOUND_KEY) === 'off' ? 'on' : 'off';
  localStorage.setItem(SOUND_KEY, cur);
  els.soundToggle.textContent = cur === 'off' ? '🔈' : '🔊';
  els.soundToggle.setAttribute('aria-pressed', cur === 'on');
});

/*  FLAMES logic  */

function cancelMatches(a,b){
  const aCross=new Array(a.length).fill(false);
  const bCross=new Array(b.length).fill(false);
  for(let i=0;i<a.length;i++){
    for(let j=0;j<b.length;j++){
      if(!aCross[i] && !bCross[j] && a[i] === b[j]){
        aCross[i] = true; bCross[j] = true; break;
      }
    }
  }
  return { aCross, bCross };
}

function renderLetters(container, letters, crosses){
  container.innerHTML = '';
  letters.forEach((ch,i)=>{
    const span = document.createElement('span');
    span.className = 'letter ' + (crosses[i] ? 'crossed' : 'remain');
    span.textContent = ch || ' ';
    container.appendChild(span);
  });
}

function initFlamesVisual(){
  els.flamesArea.innerHTML = '';
  ['F','L','A','M','E','S'].forEach(l=>{
    const d = document.createElement('div');
    d.className = 'flame'; d.textContent = l; els.flamesArea.appendChild(d);
  });
}

function runFlamesSequence(count){
  const labels = ['F','L','A','M','E','S'];
  const meanings = {F:'Friends',L:'Lovers',A:'Affection',M:'Marriage',E:'Enemies',S:'Siblings'};
  if(count === 0) return { final: null, meanings, log:['No letters left: identical names'], removedSequence: [] };
  const state = labels.slice();
  const log = []; const removedSequence = [];
  let idx = 0;
  while(state.length > 1){
    idx = (idx + (count - 1)) % state.length;
    const removed = state.splice(idx,1)[0];
    removedSequence.push(removed);
    log.push(`Count ${count} → remove '${removed}' (remaining: ${state.join('')})`);
  }
  return { final: state[0], meanings, log, removedSequence };
}

function animateFlamesRemoval(removedSeq, onComplete){
  const nodes = Array.from(els.flamesArea.children);
  let step = 0;
  if(removedSeq.length === 0){ onComplete && onComplete(); return; }

  function next(){
    if(step >= removedSeq.length){ onComplete && onComplete(); return; }
    const letter = removedSeq[step];
    const node = nodes.find(n => n.textContent === letter && !n.classList.contains('dead'));
    if(node){
      // fun pop sound and animation
      node.classList.add('removing');
      playBlip(520 + step*40, ['sine','square','sawtooth'][step%3], 0.12);
      setTimeout(()=> {
        node.classList.remove('removing');
        node.classList.add('dead');
        step++;
        setTimeout(next, 180);
      }, 380);
    } else {
      step++;
      setTimeout(next, 120);
    }
  }
  next();
}

/* History handling */
function loadHistory(){
  const raw = localStorage.getItem(HISTORY_KEY);
  return raw ? JSON.parse(raw) : [];
}
function saveHistory(arr){
  localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
  renderHistoryList();
}
function addHistoryEntry(entry){
  const h = loadHistory();
  h.unshift(entry); 
  // keep last 50
  if(h.length > 50) h.length = 50;
  saveHistory(h);
}
function clearHistory(){
  localStorage.removeItem(HISTORY_KEY);
  renderHistoryList();
}
function renderHistoryList(){
  const list = loadHistory();
  const cont = els.historyList;
  cont.innerHTML = '';
  if(!list.length){
    cont.innerHTML = '<div class="muted-help">No history yet — play to create entries.</div>';
    return;
  }
  list.forEach(item => {
    const wrap = document.createElement('div'); wrap.className = 'history-item';
    const left = document.createElement('div');
    left.innerHTML = `<div><strong>${escapeHtml(item.name1)}</strong> &amp; <strong>${escapeHtml(item.name2)}</strong></div>
      <div class="history-meta">${prettyDate(item.when)} • ${item.result} — ${escapeHtml(item.meaning)}</div>`;
    const right = document.createElement('div');
    const copyBtn = document.createElement('button'); copyBtn.className = 'btn ghost small'; copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', ()=> { navigator.clipboard?.writeText(`${item.name1} & ${item.name2} — ${item.result} — ${item.meaning}`); copyBtn.textContent='Copied!'; setTimeout(()=>copyBtn.textContent='Copy',900); });
    right.appendChild(copyBtn);
    wrap.appendChild(left); wrap.appendChild(right);
    cont.appendChild(wrap);
  });
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* Saving & loading last session  */
function saveSession(data){
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}
function loadSession(){
  const raw = localStorage.getItem(DATA_KEY);
  return raw ? JSON.parse(raw) : null;
}

/*  Main Play logic */
function play(addToHistory = true){
  const name1 = els.name1.value.trim();
  const name2 = els.name2.value.trim();
  if(!name1 || !name2){ alert('Please enter both names.'); return; }

  const a = normalize(name1);
  const b = normalize(name2);
  const { aCross, bCross } = cancelMatches(a,b);

  renderLetters(els.name1Out, a, aCross);
  renderLetters(els.name2Out, b, bCross);

  const remainA = a.filter((_,i)=>!aCross[i]).length;
  const remainB = b.filter((_,i)=>!bCross[i]).length;
  const count = remainA + remainB;
  els.countOut.textContent = String(count);

  initFlamesVisual();

  const result = runFlamesSequence(count);
  els.log.textContent = result.log.join('\n');

  // animate removal sequence, then show final & play chime
  animateFlamesRemoval(result.removedSequence, () => {
    if(result.final){
      els.result.textContent = `Result: ${result.final}`;
      els.meaning.textContent = `Meaning: ${result.meanings[result.final] || '—'}`;
    } else {
      els.result.textContent = 'Result: —';
      els.meaning.textContent = 'Meaning: No letters remain — identical names.';
    }
    playChime();

    // Save last session (so refresh restores)
    saveSession({
      name1: name1,
      name2: name2,
      result: els.result.textContent,
      meaning: els.meaning.textContent,
      log: els.log.textContent,
      count: els.countOut.textContent,
      when: fmtDateIsoNow()
    });

    // Add to history if requested (only when user pressed Play)
    if(addToHistory){
      addHistoryEntry({
        name1, name2, result: els.result.textContent.replace(/^Result:\s*/,''),
        meaning: els.meaning.textContent.replace(/^Meaning:\s*/,''),
        when: fmtDateIsoNow()
      });
    }
  });
}

/*  Share / Reset handlers */
els.playBtn.addEventListener('click', ()=> play(true));

els.resetBtn.addEventListener('click', ()=> {
  els.name1.value = '';
  els.name2.value = '';
  els.name1Out.innerHTML = '';
  els.name2Out.innerHTML = '';
  els.countOut.textContent = '—';
  els.log.textContent = '—';
  els.result.textContent = 'Result: —';
  els.meaning.textContent = 'Meaning: —';
  localStorage.removeItem(DATA_KEY);
  initFlamesVisual();
});

els.shareBtn.addEventListener('click', async ()=>{
  const text = `${els.result.textContent} — ${els.meaning.textContent}`;
  // prefer Web Share API (mobile)
  if(navigator.share){
    try{
      await navigator.share({ title: 'FLAMES Result', text, url: location.href });
    }catch(e){}
  } else if(navigator.clipboard && navigator.clipboard.writeText){
    await navigator.clipboard.writeText(text);
    const prev = els.shareBtn.textContent;
    els.shareBtn.textContent = 'Copied!';
    setTimeout(()=> els.shareBtn.textContent = prev, 900);
  } else {
    alert(text);
  }
});

/* History buttons */
els.clearHistoryBtn.addEventListener('click', ()=> {
  if(confirm('Clear history? This cannot be undone.')) clearHistory();
});

/* Init UI on load */
function restoreSessionOnLoad(){
  initFlamesVisual();
  renderHistoryList();

  // restore last session (but do not add to history)
  const s = loadSession();
  if(!s) return;
  els.name1.value = s.name1 || '';
  els.name2.value = s.name2 || '';
  els.countOut.textContent = s.count || '—';
  els.log.textContent = s.log || '—';
  els.result.textContent = s.result || 'Result: —';
  els.meaning.textContent = s.meaning || 'Meaning: —';

 
  if((s.name1 || s.name2) && s.name1 && s.name2){
 
    setTimeout(()=> play(false), 350);
  }
}

restoreSessionOnLoad();
