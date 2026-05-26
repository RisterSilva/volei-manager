// =====================================================================
// ESTADO GLOBAL
// =====================================================================
let players = {}; let teams = []; let drawQueue = []; let lastSig = null;
let cfg = { maxPoints: 15, advantage: 2, admin: "Admin", totalMatches: 12 };
let schedule = []; let currentMatchIdx = -1; let matchHistory = []; let auditLog = [];
let teamStats = {}; let teamOrder = []; let fullScheduleView = false; let pendingImport = [];
let pendingEditMatch = null; let confirmCallback = null;
let vis = { stars: true, avg: true, anchor: true };
let _playerStats = {}; let statsView = 'team'; let presenceFilter = 'all'; let rodizioSubTab = 'agenda';
let teamState = [];

// Novas variáveis para modos
let currentRodizioMode = 'dynamic';
let modeLocked = false;
let dynamicQueue = [];        // fila de índices dos times (ordem de entrada)
let winStreak = [];           // vitórias consecutivas por time

// Ordem personalizada dos times (inicial)
let customTeamOrder = [];     // array de índices

// Para persistência
const STORAGE_KEY = 'volei_manager_state';

// =====================================================================
// FUNÇÕES AUXILIARES
// =====================================================================
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const starsHtml = (n) => { let s=''; for(let i=1;i<=5;i++) s+=`<span class="${i<=n?'':'off'}">★</span>`; return `<span class="stars">${s}</span>`; };
const genderBadge = g => g==='F'?'<span class="badge b-f">F</span>':'<span class="badge b-m">M</span>';

function showAlert(container, msg, type){ const el=$(container); if(el) el.innerHTML=`<div class="alert a-${type}">${msg}</div>`; setTimeout(()=>{if(el)el.innerHTML='';},3000); }
function presentList(){ return Object.entries(players).filter(([,p])=>p.present); }
function audit(type,subject,from,to){ auditLog.push({type,subject,from:String(from),to:String(to),date:new Date().toLocaleString('pt-BR'),by:cfg.admin}); saveStateToLocalStorage(); }

function openModal(id){ const modal=$(id); if(modal){ modal.style.display='flex'; } }
function closeModal(id){ const modal=$(id); if(modal){ modal.style.display='none'; } }
function closeOut(e,id){ if(e.target && e.target.id===id) closeModal(id); }

function toggleCollapse(id){
  const card = document.getElementById(id);
  if(!card) return;
  const isCollapsed = card.classList.toggle('collapsed');
  const btn = card.querySelector('.collapse-btn');
  if(btn) btn.textContent = isCollapsed ? '▼' : '▲';
}

function refreshMetrics(){
  const all=Object.values(players);
  $('metrics-row').style.display=all.length?'grid':'none';
  $('total-count').innerText=all.length;
  $('present-count').innerText=all.filter(p=>p.present).length;
  $('male-count').innerText=all.filter(p=>p.gender==='M').length;
  $('female-count').innerText=all.filter(p=>p.gender==='F').length;
}

function renderPlayers(){
  const sorted=Object.entries(players).sort((a,b)=>a[0].localeCompare(b[0],'pt'));
  if(!sorted.length){ $('players-list').innerHTML='<div class="empty-state"><span class="empty-state-icon">👥</span>Nenhum jogador cadastrado</div>'; refreshMetrics(); return; }
  $('players-list').innerHTML=sorted.map(([name,p],idx)=>
    `<div class="player-item ${p.present?'':'inactive'}">
      <span class="player-num">${idx+1}</span>
      ${genderBadge(p.gender)}
      <span class="player-name">${esc(name)}</span>
      ${starsHtml(p.level)}
      ${p.present?'<span class="badge b-ok">presente</span>':'<span class="badge b-off">ausente</span>'}
      <button class="btn btn-sm btn-icon" onclick="editPlayer('${escapeJs(name)}')" title="Editar">✏️</button>
      <button class="btn btn-sm btn-icon btn-red" onclick="removePlayer('${escapeJs(name)}')" title="Remover">🗑️</button>
    </div>`
  ).join('');
  refreshMetrics();
}

function renderPresence(){
  const allPlayers=Object.entries(players).sort((a,b)=>a[0].localeCompare(b[0],'pt'));
  let filtered=allPlayers;
  if(presenceFilter==='present') filtered=allPlayers.filter(([,p])=>p.present);
  if(presenceFilter==='absent') filtered=allPlayers.filter(([,p])=>!p.present);
  const total=allPlayers.length;
  $('pres-total').innerText=total;
  $('pres-present-count').innerText=allPlayers.filter(([,p])=>p.present).length;
  if(!filtered.length){ $('presence-list').innerHTML='<div class="empty-state">Nenhum jogador nesta categoria</div>'; return; }
  $('presence-list').innerHTML=filtered.map(([name,p])=>
    `<div class="player-item ${p.present?'':'inactive'}">
      ${genderBadge(p.gender)}
      <span class="player-name">${esc(name)}</span>
      ${starsHtml(p.level)}
      <label class="toggle"><input type="checkbox" ${p.present?'checked':''} onchange="togglePresence('${escapeJs(name)}',this.checked)"><span class="slider"></span></label>
    </div>`
  ).join('');
}

function setPresenceFilter(filter){
  presenceFilter=filter;
  document.querySelectorAll('#panel-presenca .filter-chip').forEach(c=>c.classList.remove('active'));
  event.target.classList.add('active');
  renderPresence();
}
function escapeJs(s){ return s.replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
function addPlayer(){
  const name=$('player-name').value.trim();
  const level=parseInt($('player-level').value);
  const gender=$('player-gender').value;
  if(!name) return showAlert('elenco-alert','Nome obrigatório','red');
  if(players[name]) return showAlert('elenco-alert','Jogador já existe','amber');
  if(isNaN(level)||level<1||level>5) return showAlert('elenco-alert','Nível deve ser entre 1 e 5','red');
  players[name]={level,gender,present:true};
  audit('cadastro',name,'-',`Nível ${level} ${gender}`);
  $('player-name').value=''; $('player-level').value='';
  renderPlayers(); renderPresence();
  saveStateToLocalStorage();
}
function removePlayer(name){ delete players[name]; drawQueue=drawQueue.filter(n=>n!==name); renderPlayers(); renderPresence(); saveStateToLocalStorage(); }
function togglePresence(name,val){ if(players[name]) players[name].present=val; renderPlayers(); renderPresence(); saveStateToLocalStorage(); }
function setAllPresence(val){ Object.keys(players).forEach(n=>players[n].present=val); renderPlayers(); renderPresence(); saveStateToLocalStorage(); }
function clearAllPlayers(){ if(!confirm('Apagar todos os jogadores?')) return; players={}; drawQueue=[]; teams=[]; renderPlayers(); renderPresence(); renderTeams(); $('teams-actions').style.display='none'; saveStateToLocalStorage(); }
function editPlayer(name){
  const p=players[name]; if(!p)return;
  const newName=prompt('Novo nome:',name);
  if(newName && newName!==name){ audit('renomear',name,name,newName); players[newName]={...p}; delete players[name]; teams.forEach(t=>{ const pl=t.players.find(x=>x.name===name); if(pl) pl.name=newName; }); drawQueue=drawQueue.map(n=>n===name?newName:n); renderPlayers(); renderPresence(); saveStateToLocalStorage(); }
  const newLevel=parseInt(prompt(`Nível atual ${p.level}. Novo nível:`,p.level));
  if(!isNaN(newLevel) && newLevel>=1 && newLevel<=5 && newLevel!==p.level){ audit('nivel',newName||name,p.level,newLevel); players[newName||name].level=newLevel; renderPlayers(); renderPresence(); saveStateToLocalStorage(); }
}

function teamSignature(ts){ return ts.map(t=>t.players.map(p=>p.name).sort().join(',')).sort().join('|'); }
function drawTeams(forceNew) {
  const present = presentList();
  const total = present.length;
  const size = parseInt($('team-size').value);
  let count = parseInt($('team-count').value);
  if (count < 2) count = 2;
  if (count > total) {
    showAlert('teams-alert', `Impossível: ${count} times com ${total} jogadores.`, 'red');
    return;
  }
  // Regra dupla
  if (size === 2) {
    if (total !== 2 * count) {
      showAlert('teams-alert', `Duplas exigem exatamente ${2*count} jogadores (${total} disponíveis).`, 'red');
      return;
    }
  }
  // Calcular distribuição: primeiros times cheios, último com resto
  let teamSizes = new Array(count).fill(size);
  let remaining = total - (size * count);
  if (remaining < 0) {
    let lastSize = total - (size * (count - 1));
    let half = Math.ceil(size / 2);
    if (lastSize < half) {
      showAlert('teams-alert', `Último time teria só ${lastSize} jogadores, mínimo ${half}.`, 'red');
      return;
    }
    for (let i = 0; i < count - 1; i++) teamSizes[i] = size;
    teamSizes[count - 1] = lastSize;
  } else if (remaining > 0) {
    showAlert('teams-alert', `Jogadores excedem capacidade total (${size*count}). Aumente times.`, 'red');
    return;
  }
  // Lista de jogadores e ordenação
  let allNames = present.map(([n]) => n);
  allNames.sort(() => Math.random() - 0.5);
  const anchorsM = allNames.filter(n => players[n].gender === 'M' && players[n].level >= 4).sort((a,b) => players[b].level - players[a].level);
  const anchorsF = allNames.filter(n => players[n].gender === 'F' && players[n].level >= 4).sort((a,b) => players[b].level - players[a].level);
  const nonM = allNames.filter(n => players[n].gender === 'M' && players[n].level < 4);
  const nonF = allNames.filter(n => players[n].gender === 'F' && players[n].level < 4);
  const order = [...anchorsM, ...anchorsF, ...nonM, ...nonF];
  // Criar times
  let newTeams = Array.from({ length: count }, (_, i) => ({
    name: `Time ${String.fromCharCode(65 + i)}`,
    color: `hsl(${i * 40 % 360}, 55%, 45%)`,
    players: []
  }));
  // Função para escolher time (menos carregado)
  function bestTeamIndex(gender) {
    let best = -1, bestScore = Infinity;
    for (let i = 0; i < count; i++) {
      if (newTeams[i].players.length >= teamSizes[i]) continue;
      let genderCount = newTeams[i].players.filter(p => p.gender === gender).length;
      let totalLevel = newTeams[i].players.reduce((s,p) => s + p.level, 0);
      let score = genderCount * 100 + totalLevel;
      if (score < bestScore) { bestScore = score; best = i; }
    }
    return best;
  }
  // Alocar
  for (let name of order) {
    let gender = players[name].gender;
    let idx = bestTeamIndex(gender);
    if (idx === -1) { showAlert('teams-alert', 'Erro na alocação.', 'red'); return; }
    newTeams[idx].players.push({ name, level: players[name].level, gender, anchor: players[name].level >= 4 });
  }
  // Verificar times incompletos e montar aviso
  let incomplete = [];
  for (let i = 0; i < count; i++) {
    if (newTeams[i].players.length < size) incomplete.push(`${newTeams[i].name} (${newTeams[i].players.length}/${size})`);
  }
  if (incomplete.length) {
    showAlert('teams-alert', `Times incompletos: ${incomplete.join(', ')}`, 'amber');
  }
  // Atualizar globais
  teams = newTeams;
  drawQueue = [];
  lastSig = teamSignature(teams);
  customTeamOrder = teams.map((_,i)=>i);
  $('outfield-players').style.display = 'none';
  renderTeams();
  $('btn-redraw').style.display = 'inline-flex';
  $('teams-actions').style.display = 'flex';
  $('vis-bar').style.display = 'flex';
  audit('sorteio', 'times', `${size}x${teams.length}`, `tamanhos: ${teamSizes.join(',')}`);
  saveStateToLocalStorage();
}

function renderTeams(){
  const container=$('teams-container');
  if(!teams.length){ container.innerHTML='<div class="empty-state"><span class="empty-state-icon">⚡</span>Nenhum time sorteado</div>'; return; }
  container.innerHTML=`<div class="team-grid">`+teams.map((t,i)=>{
    const avg=t.players.length?(t.players.reduce((s,p)=>s+p.level,0)/t.players.length).toFixed(1):'—';
    const mc=t.players.filter(p=>p.gender==='M').length; const fc=t.players.filter(p=>p.gender==='F').length;
    return `<div class="team-card" style="border-top-color:${t.color}">
      <div class="team-header">
        <span class="team-name">${esc(t.name)}</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="team-stats">${mc}M ${fc}F${vis.avg?` · méd. ${avg}★`:''}</span>
          <button class="btn btn-sm btn-icon" onclick="renameTeam(${i})">✏️</button>
        </div>
      </div>
      ${t.players.sort((a,b)=>b.level-a.level).map(p=>`<div class="team-player">${genderBadge(p.gender)}<span>${esc(p.name)}</span>${vis.stars?starsHtml(p.level):''}${vis.anchor&&p.anchor?'<span class="badge b-anc">âncora</span>':''}</div>`).join('')}
    </div>`;
  }).join('')+`</div>`;
}

function renameTeam(idx){ const newName=prompt('Novo nome:',teams[idx].name); if(newName) teams[idx].name=newName; renderTeams(); renderScheduleAndStandings(); saveStateToLocalStorage(); }
function toggleVis(key){ vis[key]=!vis[key]; renderTeams(); document.querySelector(`.vis-chip[onclick*="${key}"]`).classList.toggle('active',vis[key]); }
function visAll(val){ Object.keys(vis).forEach(k=>vis[k]=val); renderTeams(); document.querySelectorAll('.vis-chip').forEach(c=>c.classList.toggle('active',val)); }
function openManualAdjust(){ if(!teams.length){ alert('Sorteie os times primeiro.'); return; } const sel=$('move-player'); sel.innerHTML=teams.flatMap((t,ti)=>t.players.map(p=>`<option value="${escapeJs(p.name)}|${ti}">${esc(p.name)} (${esc(t.name)})</option>`)).join(''); $('move-team').innerHTML=teams.map((t,ti)=>`<option value="${ti}">${esc(t.name)}</option>`).join(''); openModal('modal-move'); }
function executeMove(){ const val=$('move-player').value.split('|'); const name=val[0]; const fromIdx=parseInt(val[1]); const toIdx=parseInt($('move-team').value); if(fromIdx===toIdx){ closeModal('modal-move'); return; } const idx=teams[fromIdx].players.findIndex(p=>p.name===name); if(idx<0) return; const player=teams[fromIdx].players.splice(idx,1)[0]; player.anchor=player.level>=4; teams[toIdx].players.push(player); audit('mover',name,teams[fromIdx].name,teams[toIdx].name); closeModal('modal-move'); renderTeams(); saveStateToLocalStorage(); }

// =====================================================================
// PERSISTÊNCIA (localStorage)
// =====================================================================
function saveStateToLocalStorage() {
  const state = {
    players, teams, drawQueue, lastSig, cfg, schedule, currentMatchIdx, matchHistory, auditLog,
    teamStats, teamOrder, fullScheduleView, vis, _playerStats, statsView, presenceFilter,
    rodizioSubTab, teamState, currentRodizioMode, modeLocked, dynamicQueue, winStreak, customTeamOrder
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch(e) { console.warn('Erro ao salvar estado', e); }
}

function loadStateFromLocalStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;
  try {
    const state = JSON.parse(saved);
    Object.assign(players, state.players || {});
    teams = state.teams || [];
    drawQueue = state.drawQueue || [];
    lastSig = state.lastSig;
    if (state.cfg) Object.assign(cfg, state.cfg);
    schedule = state.schedule || [];
    currentMatchIdx = state.currentMatchIdx ?? -1;
    matchHistory = state.matchHistory || [];
    auditLog = state.auditLog || [];
    teamStats = state.teamStats || {};
    teamOrder = state.teamOrder || [];
    fullScheduleView = state.fullScheduleView ?? false;
    if (state.vis) Object.assign(vis, state.vis);
    _playerStats = state._playerStats || {};
    statsView = state.statsView || 'team';
    presenceFilter = state.presenceFilter || 'all';
    rodizioSubTab = state.rodizioSubTab || 'agenda';
    teamState = state.teamState || [];
    currentRodizioMode = state.currentRodizioMode || 'dynamic';
    modeLocked = state.modeLocked || false;
    dynamicQueue = state.dynamicQueue || [];
    winStreak = state.winStreak || [];
    customTeamOrder = state.customTeamOrder || teams.map((_,i)=>i);
    renderPlayers();
    renderPresence();
    if (teams.length) renderTeams();
    if (schedule.length && currentMatchIdx >= 0) {
      document.getElementById('rodizio-idle').style.display = 'none';
      document.getElementById('rodizio-active').style.display = 'block';
      renderScheduleAndStandings();
      startMatch(currentMatchIdx);
    }
  } catch(e) { console.warn('Erro ao carregar estado', e); }
}

// =====================================================================
// FUNÇÕES DE RODÍZIO
// =====================================================================
function initTeamState(n){
  return Array.from({length:n},()=>({gamesPlayed:0,playStreak:0,restStreak:0,waitSince:-1,headToHead:{},wins:0}));
}

function updateTeamState(){
  const n=teams.length;
  for(let i=0;i<n;i++){ teamState[i].gamesPlayed=0; teamState[i].playStreak=0; teamState[i].restStreak=0; teamState[i].waitSince=-1; teamState[i].headToHead={}; teamState[i].wins=0; }
  const played=schedule.filter(m=>m.done&&!m.placeholder&&m.idxA!==null&&m.idxB!==null);
  for(let pi=0;pi<played.length;pi++){
    const m=played[pi]; const A=m.idxA,B=m.idxB;
    for(const t of[A,B]){ teamState[t].gamesPlayed++; teamState[t].playStreak=teamState[t].playStreak+1; teamState[t].restStreak=0; teamState[t].waitSince=pi; }
    teamState[A].headToHead[B]=(teamState[A].headToHead[B]||0)+1;
    teamState[B].headToHead[A]=(teamState[B].headToHead[A]||0)+1;
    if(m.winner===A) teamState[A].wins++;
    else if(m.winner===B) teamState[B].wins++;
    for(let t=0;t<n;t++){ if(t!==A&&t!==B){ teamState[t].restStreak=teamState[t].restStreak+1; teamState[t].playStreak=0; } }
  }
}

function makeMatch(idxA,idxB){ return{idxA,idxB,sA:0,sB:0,done:false,winner:-1,placeholder:false,conditional:null}; }
function makePlaceholder(label,conditional){ return{idxA:null,idxB:null,sA:0,sB:0,done:false,winner:-1,placeholder:true,conditional:conditional,label:label}; }

// ==============================================================
// MODO 1 — FILA DINÂMICA
// ==============================================================
function initDynamicMode() {
  let order = (customTeamOrder.length === teams.length) ? [...customTeamOrder] : teams.map((_, idx) => idx);
  dynamicQueue = [...order];
  winStreak = new Array(teams.length).fill(0);
  schedule = [];
  currentMatchIdx = 0;
  const firstMatch = makeMatch(dynamicQueue[0], dynamicQueue[1]);
  schedule.push(firstMatch);
  updateDynamicPlaceholders();
  teamState = initTeamState(teams.length);
  teamStats = {};
  for (let i = 0; i < teams.length; i++) teamStats[i] = { wins: 0, losses: 0 };
  matchHistory = [];
}

function updateDynamicPlaceholders() {
  while (schedule.length > 1) schedule.pop();
  for (let i = 1; i <= 6; i++) {
    if (dynamicQueue.length >= 2) {
      let nextTeam1 = teams[dynamicQueue[0]]?.name || '?';
      let nextTeam2 = teams[dynamicQueue[1]]?.name || '?';
      schedule.push(makePlaceholder(`Próximo: ${nextTeam1} vs ${nextTeam2} (aguardando resultado atual)`, null));
    } else {
      schedule.push(makePlaceholder(`Aguardando mais times na fila...`, null));
    }
  }
}

function nextMatchDynamic() {
  const lastMatch = schedule[currentMatchIdx];
  if (!lastMatch || !lastMatch.done) return null;
  const winnerIdx = lastMatch.winner;
  const loserIdx = (winnerIdx === lastMatch.idxA) ? lastMatch.idxB : lastMatch.idxA;
  winStreak[winnerIdx] = (winStreak[winnerIdx] || 0) + 1;
  winStreak[loserIdx] = 0;
  const queue = dynamicQueue;
  if (queue[0] !== lastMatch.idxA && queue[0] !== lastMatch.idxB) {
    const idxA = queue.indexOf(lastMatch.idxA);
    const idxB = queue.indexOf(lastMatch.idxB);
    if (idxA !== -1 && idxB !== -1) {
      queue.splice(Math.min(idxA, idxB), 2);
      queue.unshift(lastMatch.idxA, lastMatch.idxB);
    }
  }
  if (winStreak[winnerIdx] >= 2) {
    queue.push(winnerIdx);
    queue.shift();
    queue.push(loserIdx);
    queue.shift();
    winStreak[winnerIdx] = 0;
  } else {
    queue.push(loserIdx);
    queue.splice(1, 1);
  }
  if (queue.length < 2) return null;
  const nextMatch = makeMatch(queue[0], queue[1]);
  schedule.push(nextMatch);
  updateDynamicPlaceholders();
  return schedule.length - 1;
}

// ==============================================================
// MODO 2 — COPA RELÂMPAGO
// ==============================================================
function initCupMode() {
  const n = teams.length;
  if (n < 2) return;
  let maxMatches = cfg.totalMatches;
  let groupSize = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(maxMatches))));
  let groupCount = Math.max(2, Math.ceil(n / groupSize));
  let teamsPerGroup = Math.ceil(n / groupCount);
  let groups = [];
  let shuffled = [...teams.map((_, i) => i)];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  for (let g = 0; g < groupCount; g++) {
    groups.push(shuffled.splice(0, teamsPerGroup));
  }
  let groupMatches = [];
  groups.forEach((group, gi) => {
    for (let i = 0; i < group.length; i++) {
      for (let j = i+1; j < group.length; j++) {
        groupMatches.push({ type: 'group', group: gi, a: group[i], b: group[j], done: false, sA: 0, sB: 0, winner: -1 });
      }
    }
  });
  schedule = [];
  groupMatches.forEach(m => {
    schedule.push(makeMatch(m.a, m.b));
    schedule[schedule.length-1].cupData = { type: 'group', group: m.group };
  });
  schedule.push(makePlaceholder("Semifinal 1 (1º Grupo A × 2º Grupo B)", null));
  schedule.push(makePlaceholder("Semifinal 2 (1º Grupo B × 2º Grupo A)", null));
  schedule.push(makePlaceholder("Final (Vencedor SF1 × Vencedor SF2)", null));
  schedule.push(makePlaceholder("Disputa 3º lugar", null));
  currentMatchIdx = 0;
  teamState = initTeamState(teams.length);
  teamStats = {};
  for (let i = 0; i < teams.length; i++) teamStats[i] = { wins: 0, losses: 0 };
  matchHistory = [];
}

function updateCupAfterGroupStage() {
  let groupResults = {};
  schedule.forEach(m => {
    if (m.cupData && m.cupData.type === 'group' && m.done) {
      const g = m.cupData.group;
      if (!groupResults[g]) groupResults[g] = {};
      groupResults[g][m.idxA] = groupResults[g][m.idxA] || { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 };
      groupResults[g][m.idxB] = groupResults[g][m.idxB] || { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 };
      groupResults[g][m.idxA].pointsFor += m.sA;
      groupResults[g][m.idxA].pointsAgainst += m.sB;
      groupResults[g][m.idxB].pointsFor += m.sB;
      groupResults[g][m.idxB].pointsAgainst += m.sA;
      if (m.winner === m.idxA) groupResults[g][m.idxA].wins++;
      else if (m.winner === m.idxB) groupResults[g][m.idxB].wins++;
      else { groupResults[g][m.idxA].losses++; groupResults[g][m.idxB].losses++; }
    }
  });
  let qualified = [];
  for (let g in groupResults) {
    const teamsG = Object.keys(groupResults[g]).map(t => parseInt(t));
    teamsG.sort((a,b) => {
      if (groupResults[g][a].wins !== groupResults[g][b].wins) return groupResults[g][b].wins - groupResults[g][a].wins;
      let saldoA = groupResults[g][a].pointsFor - groupResults[g][a].pointsAgainst;
      let saldoB = groupResults[g][b].pointsFor - groupResults[g][b].pointsAgainst;
      if (saldoA !== saldoB) return saldoB - saldoA;
      return a - b;
    });
    qualified.push({ group: g, first: teamsG[0], second: teamsG[1] });
  }
  if (qualified.length >= 2) {
    const sf1 = makeMatch(qualified[0].first, qualified[1].second);
    const sf2 = makeMatch(qualified[1].first, qualified[0].second);
    for (let i = 0; i < schedule.length; i++) {
      if (schedule[i].placeholder && schedule[i].label.includes("Semifinal 1")) {
        schedule[i] = sf1;
        schedule[i].cupData = { type: 'semifinal' };
        break;
      }
    }
    for (let i = 0; i < schedule.length; i++) {
      if (schedule[i].placeholder && schedule[i].label.includes("Semifinal 2")) {
        schedule[i] = sf2;
        schedule[i].cupData = { type: 'semifinal' };
        break;
      }
    }
  }
}

function updateCupAfterSemifinals() {
  let sfWinners = [], sfLosers = [];
  schedule.forEach(m => {
    if (m.cupData && m.cupData.type === 'semifinal' && m.done) {
      sfWinners.push(m.winner);
      sfLosers.push(m.winner === m.idxA ? m.idxB : m.idxA);
    }
  });
  if (sfWinners.length === 2) {
    for (let i = 0; i < schedule.length; i++) {
      if (schedule[i].placeholder && schedule[i].label.includes("Final")) {
        schedule[i] = makeMatch(sfWinners[0], sfWinners[1]);
        schedule[i].cupData = { type: 'final' };
        break;
      }
    }
    for (let i = 0; i < schedule.length; i++) {
      if (schedule[i].placeholder && schedule[i].label.includes("Disputa 3º")) {
        schedule[i] = makeMatch(sfLosers[0], sfLosers[1]);
        schedule[i].cupData = { type: 'third' };
        break;
      }
    }
  }
}

// ==============================================================
// MODO 3 — ROUND ROBIN
// ==============================================================
function initRoundRobinFixed() {
  const n = teams.length;
  if (n < 2) return;
  let matches = [];
  for (let i = 0; i < n; i++) {
    for (let j = i+1; j < n; j++) {
      matches.push({ a: i, b: j });
    }
  }
  let orderedMatches = [];
  if (n <= 8) {
    let teamsList = [...Array(n).keys()];
    let rounds = [];
    for (let i = 0; i < n-1; i++) {
      let round = [];
      for (let j = 0; j < n/2; j++) {
        if (teamsList[j] !== teamsList[n-1-j]) {
          round.push({ a: teamsList[j], b: teamsList[n-1-j] });
        }
      }
      rounds.push(round);
      let last = teamsList.pop();
      teamsList.splice(1, 0, last);
    }
    for (let r of rounds) orderedMatches.push(...r);
    let returnMatches = orderedMatches.map(m => ({ a: m.b, b: m.a }));
    orderedMatches.push(...returnMatches);
  } else {
    orderedMatches = matches;
    let returnMatches = matches.map(m => ({ a: m.b, b: m.a }));
    orderedMatches.push(...returnMatches);
  }
  if (orderedMatches.length > cfg.totalMatches) {
    orderedMatches = orderedMatches.slice(0, cfg.totalMatches);
  }
  schedule = orderedMatches.map(m => makeMatch(m.a, m.b));
  currentMatchIdx = 0;
  teamState = initTeamState(teams.length);
  teamStats = {};
  for (let i = 0; i < teams.length; i++) teamStats[i] = { wins: 0, losses: 0 };
  matchHistory = [];
}

// ==============================================================
// FUNÇÃO PRINCIPAL DE INÍCIO DO RODÍZIO
// ==============================================================
function initRoundRobin() {
  if (!teams.length) return alert('Sorteie os times primeiro.');
  if (modeLocked && schedule.length && schedule.some(m => !m.done)) {
    alert('Não é possível trocar o modo durante um rodízio em andamento. Encerre a noite primeiro.');
    return;
  }
  teamOrder = teams.map((_, i) => i);
  switch (currentRodizioMode) {
    case 'dynamic': initDynamicMode(); break;
    case 'cup': initCupMode(); break;
    case 'roundrobin': initRoundRobinFixed(); break;
    default: initDynamicMode();
  }
  modeLocked = true;
  const tf = document.getElementById('filter-team');
  if (tf) tf.innerHTML = '<option value="">Todos os times</option>' + teams.map((t,i)=>`<option value="${i}">${esc(t.name)}</option>`).join('');
  document.getElementById('rodizio-idle').style.display = 'none';
  document.getElementById('rodizio-active').style.display = 'block';
  switchTab('rodizio');
  startMatch(0);
  renderScheduleAndStandings();
  updatePlacarModeIndicator();
  saveStateToLocalStorage();
}

// ==============================================================
// FINALIZAR PARTIDA
// ==============================================================
function finishMatch(winnerIdx) {
  const m = schedule[currentMatchIdx];
  if (!m || m.done || m.placeholder) return;
  m.done = true;
  m.winner = winnerIdx;
  if (!teamStats[m.idxA]) teamStats[m.idxA] = { wins: 0, losses: 0 };
  if (!teamStats[m.idxB]) teamStats[m.idxB] = { wins: 0, losses: 0 };
  teamStats[m.idxA].wins += (winnerIdx === m.idxA ? 1 : 0);
  teamStats[m.idxA].losses += (winnerIdx === m.idxA ? 0 : 1);
  teamStats[m.idxB].wins += (winnerIdx === m.idxB ? 1 : 0);
  teamStats[m.idxB].losses += (winnerIdx === m.idxB ? 0 : 1);
  matchHistory.push({ ...m });
  [m.idxA, m.idxB].forEach(ti => {
    (teams[ti]?.players || []).forEach(p => {
      if (!_playerStats[p.name]) _playerStats[p.name] = { wins: 0, losses: 0, matches: 0 };
      _playerStats[p.name].matches++;
      if (ti === winnerIdx) _playerStats[p.name].wins++;
      else _playerStats[p.name].losses++;
    });
  });
  updateTeamState();

  if (currentRodizioMode === 'dynamic') {
    const nextIdx = nextMatchDynamic();
    if (nextIdx !== null) {
      renderScheduleAndStandings();
      if (currentMatchIdx === schedule.length - 2) {
        currentMatchIdx++;
        startMatch(currentMatchIdx);
      } else {
        renderMatchHistory();
      }
    } else {
      document.getElementById('score-status').innerHTML = '🏆 Rodízio finalizado!';
    }
  } 
  else if (currentRodizioMode === 'cup') {
    const groupMatchesLeft = schedule.some(m => m.cupData && m.cupData.type === 'group' && !m.done);
    if (!groupMatchesLeft) {
      updateCupAfterGroupStage();
      let nextIdx = schedule.findIndex(m => m.placeholder || (m.cupData && (m.cupData.type === 'semifinal' || m.cupData.type === 'final')));
      if (nextIdx !== -1 && schedule[nextIdx].placeholder) {
        currentMatchIdx = nextIdx;
        startMatch(currentMatchIdx);
      }
    } else {
      let nextMatch = schedule.find((m, idx) => idx > currentMatchIdx && m.cupData && m.cupData.type === 'group' && !m.done);
      if (nextMatch) {
        currentMatchIdx = schedule.indexOf(nextMatch);
        startMatch(currentMatchIdx);
      } else {
        updateCupAfterGroupStage();
        let semiIdx = schedule.findIndex(m => m.cupData && m.cupData.type === 'semifinal' && !m.done);
        if (semiIdx !== -1) {
          currentMatchIdx = semiIdx;
          startMatch(currentMatchIdx);
        }
      }
    }
    const semisDone = schedule.filter(m => m.cupData && m.cupData.type === 'semifinal').every(m => m.done);
    if (semisDone && schedule.some(m => m.cupData && m.cupData.type === 'final' && !m.done)) {
      updateCupAfterSemifinals();
      let finalIdx = schedule.findIndex(m => m.cupData && m.cupData.type === 'final');
      if (finalIdx !== -1 && !schedule[finalIdx].done) {
        currentMatchIdx = finalIdx;
        startMatch(currentMatchIdx);
      }
    }
  }
  else if (currentRodizioMode === 'roundrobin') {
    let nextIdx = schedule.findIndex((m, idx) => idx > currentMatchIdx && !m.done);
    if (nextIdx !== -1) {
      currentMatchIdx = nextIdx;
      startMatch(currentMatchIdx);
    } else {
      document.getElementById('score-status').innerHTML = '🏆 Rodízio finalizado!';
    }
  }
  renderScheduleAndStandings();
  renderMatchHistory();
  document.getElementById('score-status').innerHTML = `🏆 ${teams[winnerIdx]?.name} venceu!`;
  if (currentRodizioMode === 'cup' && schedule[currentMatchIdx] && schedule[currentMatchIdx].placeholder) {
    startMatch(currentMatchIdx);
  }
  saveStateToLocalStorage();
}

// ==============================================================
// FUNÇÕES DE PLACAR E NAVEGAÇÃO
// ==============================================================
function startMatch(idx){
  const m=schedule[idx];
  if(!m) return;
  if(m.placeholder||m.idxA===null||m.idxB===null){
    $('current-match-info').innerHTML=`<em style="color:var(--text-secondary)">${m.label||'Aguardando resultado anterior...'}</em>`;
    renderScheduleAndStandings();
    return;
  }
  currentMatchIdx=idx;
  $('placar-idle').style.display='none';
  $('placar-active').style.display='block';
  $('teamA-name').textContent=teams[m.idxA]?.name||'Time A';
  $('teamB-name').textContent=teams[m.idxB]?.name||'Time B';
  $('scoreA').textContent=m.sA;
  $('scoreB').textContent=m.sB;
  $('match-label').textContent=`Partida ${idx+1}`;
  $('score-status').innerHTML='';
  $('current-match-info').innerHTML=`⚡ <strong>${teams[m.idxA].name}</strong> vs <strong>${teams[m.idxB].name}</strong>`;
  updatePlacarModeIndicator();
  renderScheduleAndStandings();
}

function adjustScore(team,delta){
  const m=schedule[currentMatchIdx];
  if(!m||m.done||m.placeholder) return;
  if(team==='A'){ m.sA=Math.max(0,m.sA+delta); $('scoreA').textContent=m.sA; }
  else { m.sB=Math.max(0,m.sB+delta); $('scoreB').textContent=m.sB; }
  const maxPts=cfg.maxPoints; const adv=cfg.advantage;
  const sA=m.sA; const sB=m.sB;
  if((sA>=maxPts||sB>=maxPts)&&Math.abs(sA-sB)>=adv){
    const winner=sA>sB?m.idxA:m.idxB;
    setTimeout(()=>finishMatch(winner),200);
  }
  $('score-status').innerHTML=sA>sB?`→ ${teams[m.idxA].name} vencendo`:sB>sA?`→ ${teams[m.idxB].name} vencendo`:'Empate';
  saveStateToLocalStorage();
}

function forceFinishMatch(){
  const m=schedule[currentMatchIdx];
  if(!m||m.done||m.placeholder) return;
  const winner=m.sA>=m.sB?m.idxA:m.idxB;
  finishMatch(winner);
}

function nextMatch(){
  const next = schedule.findIndex((m, idx) => idx > currentMatchIdx && !m.done && !m.placeholder);
  if (next === -1) { alert('Nenhuma próxima partida disponível.'); return; }
  startMatch(next);
  switchTab('placar');
}

function nextMatchFromPlacar() {
  const m = schedule[currentMatchIdx];
  if (!m || !m.done) {
    alert('A partida atual ainda não foi encerrada. Defina o vencedor primeiro.');
    return;
  }
  nextMatch();
}

function resetCurrentMatchConfirm(){
  askConfirm('Resetar placar','Zerar o placar da partida atual?',()=>{
    const m=schedule[currentMatchIdx];
    if(m&&!m.done){ m.sA=0; m.sB=0; $('scoreA').textContent=0; $('scoreB').textContent=0; $('score-status').innerHTML=''; saveStateToLocalStorage(); }
  });
}

function endSession(){
  if(!confirm('Encerrar a sessão de hoje?')) return;
  modeLocked = false;
  $('rodizio-idle').style.display='block';
  $('rodizio-active').style.display='none';
  $('placar-idle').style.display='block';
  $('placar-active').style.display='none';
  schedule = [];
  currentMatchIdx = -1;
  saveStateToLocalStorage();
}

function updatePlacarModeIndicator() {
  let modeName = '';
  switch (currentRodizioMode) {
    case 'dynamic': modeName = '🟢 Fila Dinâmica (Trava 2)'; break;
    case 'cup': modeName = '🔵 Copa Relâmpago'; break;
    case 'roundrobin': modeName = '🟡 Rodízio Fixo (Round Robin)'; break;
    default: modeName = '—';
  }
  const span = document.getElementById('placar-mode-name');
  if (span) span.textContent = modeName;
}

// ==============================================================
// RENDERIZAÇÃO DE AGENDA E CLASSIFICAÇÃO
// ==============================================================
function renderMatchHistory(){
  const histDiv=$('match-history');
  if(!histDiv) return;
  const start=Math.max(0,currentMatchIdx-2);
  const end=Math.min(schedule.length,currentMatchIdx+4);
  const slice=schedule.slice(start,end);
  histDiv.innerHTML=`<div class="card"><div class="card-header"><span class="card-title">Partidas recentes e próximas</span></div><div class="card-body" style="max-height:320px; overflow-y:auto">`+
    slice.map((m,i)=>{
      const realIdx=start+i;
      const isCurrent=realIdx===currentMatchIdx;
      if(m.placeholder){
        return`<div class="match-row" style="opacity:0.5; font-style:italic"><span class="match-num">${realIdx+1}</span><span class="match-teams">${esc(m.label||'A definir')}</span><span>—</span></div>`;
      }
      const nameA=teams[m.idxA]?.name||'?';
      const nameB=teams[m.idxB]?.name||'?';
      const score=m.done?`${m.sA}×${m.sB}`:(isCurrent?`${m.sA}×${m.sB}`:'—');
      const status=isCurrent?'<span class="badge b-live">ao vivo</span>':m.done?'<span class="badge b-ok">final</span>':'';
      return`<div class="match-row ${isCurrent?'live':''} ${m.done?'done':''}" onclick="jumpToMatch(${realIdx})"><span class="match-num">${realIdx+1}</span><span class="match-teams">${esc(nameA)} vs ${esc(nameB)}</span><span class="mono">${score}</span>${status}<button class="btn btn-sm" onclick="event.stopPropagation();editMatchPrompt(${realIdx})">✏️</button></div>`;
    }).join('')+`</div></div>`;
}

function renderScheduleAndStandings(){
  if(!schedule.length&&!teams.length) return;
  const rows=teams.map((t,i)=>({name:t.name,wins:teamStats[i]?.wins||0,losses:teamStats[i]?.losses||0,played:(teamStats[i]?.wins||0)+(teamStats[i]?.losses||0),streak:teamState[i]?.playStreak||0,rest:teamState[i]?.restStreak||0})).sort((a,b)=>b.wins-a.wins||b.played-a.played);
  $('standings-table').innerHTML=`<thead><tr><th>#</th><th>Time</th><th>J</th><th>V</th><th>D</th><th title="Jogos seguidos">🔥</th><th title="Descansos seguidos">💤</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td style="font-weight:600">${i+1}</td><td style="font-weight:600">${esc(r.name)}</td><td class="mono">${r.played}</td><td class="mono">${r.wins}</td><td class="mono">${r.losses}</td><td class="mono" style="color:${r.streak>=2?'var(--red)':'inherit'}">${r.streak}</td><td class="mono" style="color:${r.rest>=2?'var(--amber)':'inherit'}">${r.rest}</td></tr>`).join('')}</tbody>`;
  let filtered=schedule.map((m,i)=>({...m,idx:i}));
  const filter=window._rodFilter||'all';
  if(filter==='pendentes') filtered=filtered.filter(m=>!m.done&&m.idx!==currentMatchIdx);
  else if(filter==='live') filtered=filtered.filter(m=>m.idx===currentMatchIdx&&!m.done);
  else if(filter==='done') filtered=filtered.filter(m=>m.done);
  const teamFilter=parseInt($('filter-team')?.value);
  if(!isNaN(teamFilter)&&$('filter-team')?.value!=='') filtered=filtered.filter(m=>!m.placeholder&&(m.idxA===teamFilter||m.idxB===teamFilter));
  if(!fullScheduleView){ const start=Math.max(0,currentMatchIdx-1); filtered=filtered.slice(start,start+8); }
  $('schedule-list').innerHTML=filtered.map(m=>{
    if(m.placeholder){ return`<div class="match-row" style="opacity:0.5; font-style:italic"><span class="match-num">${m.idx+1}</span><span class="match-teams">${esc(m.label||'A definir')}</span><span>—</span></div>`; }
    const nameA=teams[m.idxA]?.name||'?'; const nameB=teams[m.idxB]?.name||'?';
    return`<div class="match-row ${m.idx===currentMatchIdx?'live':''} ${m.done?'done':''}" onclick="editMatchPrompt(${m.idx})"><span class="match-num">${m.idx+1}</span><span class="match-teams">${esc(nameA)} vs ${esc(nameB)}</span><span class="mono">${m.done?`${m.sA}×${m.sB}`:'—'}</span>${m.idx===currentMatchIdx?'<span class="badge b-live">ao vivo</span>':m.done?'<span class="badge b-ok">final</span>':''}</div>`;
  }).join('');
  renderMatchHistory();
}

function setFilter(f){ window._rodFilter=f; renderScheduleAndStandings(); Array.from(event.target.parentNode.children).forEach(c=>c.classList.remove('active')); event.target.classList.add('active'); }
function setFilterTeam(){ renderScheduleAndStandings(); }
function toggleFullSchedule(){ fullScheduleView=!fullScheduleView; $('btn-full-schedule').textContent=fullScheduleView?'Ver menos':'Ver todas'; renderScheduleAndStandings(); }

function editMatchPrompt(idx){ const m=schedule[idx]; if(!m||m.placeholder) return; askConfirm(`Editar partida ${idx+1}?`,`${teams[m.idxA].name} vs ${teams[m.idxB].name}`,()=>{ openEditMatch(idx); }); }
function openEditMatch(idx){ const m=schedule[idx]; pendingEditMatch=idx; $('edit-match-info').innerHTML=`<p style="font-weight:600;margin-bottom:8px">${teams[m.idxA].name} vs ${teams[m.idxB].name}</p>`; $('edit-sa').value=m.sA; $('edit-sb').value=m.sB; openModal('modal-edit-match'); }
function saveEditedMatch(){ 
  const idx=pendingEditMatch; const m=schedule[idx]; 
  const newSA=parseInt($('edit-sa').value)||0; const newSB=parseInt($('edit-sb').value)||0; 
  m.sA=newSA; m.sB=newSB; m.done=true; m.winner=newSA>newSB?m.idxA:newSB>newSA?m.idxB:m.idxA; 
  audit('edicao-partida',`Partida ${idx+1}`,`${m.sA}×${m.sB}`,`${newSA}×${newSB}`); 
  closeModal('modal-edit-match'); 
  updateTeamState();
  teamStats = {};
  schedule.forEach(match => {
    if (match.done && !match.placeholder && match.winner !== -1) {
      if (!teamStats[match.idxA]) teamStats[match.idxA] = { wins: 0, losses: 0 };
      if (!teamStats[match.idxB]) teamStats[match.idxB] = { wins: 0, losses: 0 };
      teamStats[match.idxA].wins += (match.winner === match.idxA ? 1 : 0);
      teamStats[match.idxA].losses += (match.winner === match.idxA ? 0 : 1);
      teamStats[match.idxB].wins += (match.winner === match.idxB ? 1 : 0);
      teamStats[match.idxB].losses += (match.winner === match.idxB ? 0 : 1);
    }
  });
  renderScheduleAndStandings(); 
  if(idx===currentMatchIdx) startMatch(idx);
  saveStateToLocalStorage();
}

function askConfirm(title,msg,onYes){ $('confirm-msg').innerHTML=msg; confirmCallback=onYes; openModal('modal-confirm'); }
function confirmYes(){ if(confirmCallback) confirmCallback(); confirmCallback=null; closeModal('modal-confirm'); }
function confirmNo(){ confirmCallback=null; closeModal('modal-confirm'); }
window.confirmYes=confirmYes; window.confirmNo=confirmNo;
document.getElementById('confirm-no-btn').addEventListener('click', confirmNo);
document.getElementById('confirm-yes-btn').addEventListener('click', confirmYes);
document.getElementById('edit-no-btn').addEventListener('click',()=>closeModal('modal-edit-match'));
document.getElementById('edit-yes-btn').addEventListener('click',saveEditedMatch);

function showRodizioSubTab(tab){
  rodizioSubTab=tab;
  $('rodizio-agenda').style.display=tab==='agenda'?'block':'none';
  $('rodizio-classificacao').style.display=tab==='classificacao'?'block':'none';
  document.querySelectorAll('.sub-tab').forEach(btn=>btn.classList.remove('active'));
  if(tab==='agenda') document.querySelector('.sub-tab:first-child').classList.add('active');
  else document.querySelector('.sub-tab:last-child').classList.add('active');
}

function initTournamentFromTeams(){ if(teams.length<2) return alert('Sorteie os times primeiro.'); const sorted=teams.map((t,i)=>({name:t.name,wins:teamStats[i]?.wins||0})).sort((a,b)=>b.wins-a.wins); let bracket=[]; if(sorted.length===4) bracket=[[sorted[0],sorted[3]],[sorted[1],sorted[2]]]; else if(sorted.length===3) bracket=[[sorted[0],sorted[2]],[sorted[1],null]]; else bracket=[[sorted[0],sorted[1]]]; let html='<div class="card"><div class="card-header"><span class="card-title">🏆 Chaveamento</span></div><div class="card-body">'; bracket.forEach((m,i)=>html+=`<div class="match-row">${i+1}º: ${esc(m[0]?.name||'---')} vs ${esc(m[1]?.name||'---')}</div>`); html+=`<div style="margin-top:16px;padding:16px;background:var(--surface-1);border-radius:var(--radius)"><strong>Finalista 1:</strong> ${esc(bracket[0]?.[0]?.name||'?')}<br><strong>Finalista 2:</strong> ${esc(bracket[1]?.[0]?.name||'?')}</div></div></div>`; $('torneio-container').innerHTML=html; }
function exportTorneioCSV(){ alert('Exportação disponível.'); }

// ==============================================================
// ESTATÍSTICAS
// ==============================================================
function setStatsView(view){
  statsView=view;
  $('stats-team-view').style.display=view==='team'?'block':'none';
  $('stats-player-view').style.display=view==='player'?'block':'none';
  document.querySelectorAll('.stats-btn').forEach(b=>b.classList.remove('active'));
  event.target.classList.add('active');
  renderStats();
}
function renderStats(){
  const teamRows=teams.map((t,i)=>{ const w=teamStats[i]?.wins||0; const l=teamStats[i]?.losses||0; const p=w+l; const pct=p?Math.round(w/p*100):0; return{name:t.name,w,l,p,pct}; }).sort((a,b)=>b.w-a.w);
  $('team-stats-container').innerHTML=teamRows.map(r=>`<div class="team-stat-row"><span class="team-stat-name">${esc(r.name)}</span><div class="team-stat-numbers"><span>🏆 ${r.w}V</span><span>💔 ${r.l}D</span><span>📊 ${r.p}J</span><span>⭐ ${r.pct}%</span></div></div>`).join('');
  const playerRows=Object.entries(players).map(([n,p])=>{ const s=_playerStats[n]||{wins:0,losses:0,matches:0}; const pct=s.matches?Math.round(s.wins/s.matches*100):0; return{name:n,gender:p.gender,level:p.level,...s,pct}; }).sort((a,b)=>b.wins-a.wins);
  $('stats-player-table').innerHTML=`<thead><tr><th>Jogador</th><th>Nível</th><th>J</th><th>V</th><th>D</th><th>%V</th></tr></thead><tbody>${playerRows.map(r=>`<tr><td style="font-weight:500">${genderBadge(r.gender)} ${esc(r.name)}</td><td>${starsHtml(r.level)}</td><td class="mono">${r.matches}</td><td class="mono">${r.wins}</td><td class="mono">${r.losses}</td><td class="mono">${r.pct}%</td></tr>`).join('')}</tbody>`;
  $('history-table').innerHTML=`<thead><tr><th>Ação</th><th>Alvo</th><th>De</th><th>Para</th><th>Data</th><th>Por</th></tr></thead><tbody>${auditLog.slice().reverse().slice(0,30).map(h=>`<tr><td style="font-weight:500">${h.type}</td><td style="font-weight:500">${esc(h.subject)}</td><td>${h.from}</td><td>${h.to}</td><td style="font-size:12px;color:var(--text-tertiary)">${h.date}</td><td>${esc(h.by)}</td></tr>`).join('')}</tbody>`;
}

// ==============================================================
// IMPORTAÇÃO / EXPORTAÇÃO
// ==============================================================
function downloadModelo(){ const wsData=[["Nome","Nível","Sexo","Presença"],["João Silva",3,"M","S"],["Maria Santos",4,"F","S"],["Carlos Lima",2,"M","N"]]; const wb=XLSX.utils.book_new(); const ws=XLSX.utils.aoa_to_sheet(wsData); XLSX.utils.book_append_sheet(wb,ws,"Modelo"); XLSX.writeFile(wb,"modelo_volei.xlsx"); }
function handleFile(file){ const reader=new FileReader(); reader.onload=e=>{ const data=new Uint8Array(e.target.result); const workbook=XLSX.read(data,{type:'array'}); const sheet=workbook.Sheets[workbook.SheetNames[0]]; const rows=XLSX.utils.sheet_to_json(sheet,{header:1}); processImportRows(rows); }; reader.readAsArrayBuffer(file); }
function processImportRows(rows){ pendingImport=[]; const header=rows[0]?.map(c=>String(c).toLowerCase().trim()); const hasHeader=header&&(header.includes('nome')||header.includes('name')); const start=hasHeader?1:0; for(let i=start;i<rows.length;i++){ const row=rows[i]; if(!row[0]||(typeof row[0]==='string'&&!row[0].trim())) continue; const name=String(row[0]).trim(); const level=parseInt(row[1]); const gender=String(row[2]).toUpperCase().charAt(0); let present=true; const presVal=row[3]?String(row[3]).toUpperCase():'S'; if(presVal==='N'||presVal==='NAO'||presVal==='FALSE') present=false; if(!isNaN(level)&&level>=1&&level<=5&&(gender==='M'||gender==='F')&&name&&!players[name]) pendingImport.push({name,level,gender,present}); } if(!pendingImport.length){ showAlert('import-preview','Nenhum jogador novo encontrado','amber'); return; } $('import-preview').innerHTML=`<div class="card" style="margin-top:16px"><div class="card-header"><span class="card-title">📋 Prévia: ${pendingImport.length} jogadores</span></div><div class="card-body"><ul style="padding-left:16px">${pendingImport.map(p=>`<li style="margin-bottom:4px">${esc(p.name)} — Nível ${p.level} ${p.gender} ${p.present?'✅':'❌'}</li>`).join('')}</ul></div></div>`; $('import-actions').style.display='flex'; }
function confirmImport(){ pendingImport.forEach(p=>{ players[p.name]={level:p.level,gender:p.gender,present:p.present}; }); pendingImport=[]; $('import-preview').innerHTML=''; $('import-actions').style.display='none'; renderPlayers(); renderPresence(); showAlert('import-preview','Importação concluída com sucesso!','green'); saveStateToLocalStorage(); }
function cancelImport(){ pendingImport=[]; $('import-preview').innerHTML=''; $('import-actions').style.display='none'; }
function exportCSV(type){ let csv="\uFEFF"; if(type==='elenco'){ csv+="Nome,Sexo,Nível,Presente\n"; Object.entries(players).forEach(([n,p])=>csv+=`"${n}",${p.gender},${p.level},${p.present?"Sim":"Não"}\n`); downloadCSV(csv,"elenco_volei.csv"); } else if(type==='times'){ csv+="Time,Jogador,Sexo,Nível\n"; teams.forEach(t=>t.players.forEach(p=>csv+=`"${t.name}","${p.name}",${p.gender},${p.level}\n`)); downloadCSV(csv,"times_volei.csv"); } }
function downloadCSV(content,filename){ const blob=new Blob([content],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href); }

// ==============================================================
// DADOS DE TESTE
// ==============================================================
function generateTestData(){
  const count=parseInt($('test-count')?.value);
  if(isNaN(count)||count<1){ alert('Quantidade inválida'); return; }
  const dist=$('test-gender-dist')?.value||'balanced';
  let maleCount=Math.ceil(count/2); let femaleCount=count-maleCount;
  if(dist==='more_m'){ maleCount=Math.min(count-1,Math.floor(count*0.7)); femaleCount=count-maleCount; }
  else if(dist==='more_f'){ femaleCount=Math.min(count-1,Math.floor(count*0.7)); maleCount=count-femaleCount; }
  else if(dist==='random'){ maleCount=Math.floor(Math.random()*(count+1)); femaleCount=count-maleCount; }
  const nomesM=['Carlos','Bruno','Diego','Felipe','Gabriel','Henrique','Igor','João','Lucas','Marcos','Rafael','Samuel','Thiago','Victor','Wesley','Anderson'];
  const nomesF=['Ana','Beatriz','Carla','Daniela','Eduarda','Fernanda','Gabriela','Helena','Isabela','Julia','Larissa','Maria','Natalia','Patricia','Renata','Sofia'];
  let added=0;
  for(let i=0;i<maleCount;i++){ let nome=nomesM[i%nomesM.length]; let suf=2; while(players[nome]) nome=`${nomesM[i%nomesM.length]}${suf++}`; players[nome]={level:Math.floor(Math.random()*5)+1,gender:'M',present:true}; added++; }
  for(let i=0;i<femaleCount;i++){ let nome=nomesF[i%nomesF.length]; let suf=2; while(players[nome]) nome=`${nomesF[i%nomesF.length]}${suf++}`; players[nome]={level:Math.floor(Math.random()*5)+1,gender:'F',present:true}; added++; }
  closeModal('modal-test');
  renderPlayers(); renderPresence();
  showAlert('elenco-alert',`${added} jogadores de teste gerados com sucesso!`,'green');
  saveStateToLocalStorage();
}

// ==============================================================
// CONFIGURAÇÕES
// ==============================================================
function saveConfig(){
  cfg.maxPoints=parseInt($('cfg-max').value)||15;
  cfg.advantage=parseInt($('cfg-adv').value)||2;
  cfg.admin=$('cfg-admin').value.trim()||'Admin';
  cfg.totalMatches=parseInt($('cfg-total-matches').value)||12;
  closeModal('modal-cfg');
  showAlert('elenco-alert','Configurações salvas!','green');
  saveStateToLocalStorage();
}

// ==============================================================
// ORDENAÇÃO DE TIMES
// ==============================================================
function openTeamOrderModal() {
  if (!teams.length) { alert('Nenhum time sorteado.'); return; }
  const container = document.getElementById('order-teams-list');
  container.innerHTML = '';
  let order = (customTeamOrder.length === teams.length) ? [...customTeamOrder] : teams.map((_, i) => i);
  function renderOrderList() {
    container.innerHTML = order.map((idx, pos) => `
      <div class="order-item">
        <span class="order-drag" style="cursor:grab;">☰</span>
        <strong>${pos+1}.</strong> ${esc(teams[idx].name)}
        <div style="margin-left:auto;">
          <button class="btn btn-sm" onclick="moveTeamOrder(${pos}, -1)">↑</button>
          <button class="btn btn-sm" onclick="moveTeamOrder(${pos}, 1)">↓</button>
        </div>
      </div>
    `).join('');
  }
  window.moveTeamOrder = function(pos, delta) {
    const newPos = pos + delta;
    if (newPos < 0 || newPos >= order.length) return;
    [order[pos], order[newPos]] = [order[newPos], order[pos]];
    renderOrderList();
  };
  window.applyTeamOrder = function() {
    customTeamOrder = [...order];
    closeModal('modal-order-teams');
    alert('Ordem dos times atualizada!');
    saveStateToLocalStorage();
  };
  renderOrderList();
  const btnApply = document.createElement('button');
  btnApply.textContent = 'Aplicar ordem';
  btnApply.className = 'btn btn-primary';
  btnApply.style.marginTop = '16px';
  btnApply.onclick = () => window.applyTeamOrder();
  container.appendChild(btnApply);
  openModal('modal-order-teams');
}

// ==============================================================
// REORDENAR GRUPOS NA COPA
// ==============================================================
function openGroupOrderModal() {
  if (currentRodizioMode !== 'cup' || !schedule.length) {
    alert('Modo Copa não está ativo ou não há grupos gerados.');
    return;
  }
  let groups = {};
  schedule.forEach(m => {
    if (m.cupData && m.cupData.type === 'group' && !m.done) {
      const g = m.cupData.group;
      if (!groups[g]) groups[g] = new Set();
      groups[g].add(m.idxA);
      groups[g].add(m.idxB);
    }
  });
  const groupList = Object.keys(groups).map(g => ({ id: g, teams: Array.from(groups[g]) }));
  if (groupList.length === 0) { alert('Nenhum grupo disponível para reordenar.'); return; }
  const container = document.getElementById('group-order-container');
  container.innerHTML = '';
  groupList.forEach(g => {
    const div = document.createElement('div');
    div.className = 'card';
    div.style.marginBottom = '12px';
    div.innerHTML = `<div class="card-header"><span class="card-title">Grupo ${parseInt(g.id)+1}</span></div><div class="card-body" id="group-${g.id}"></div>`;
    container.appendChild(div);
    const groupDiv = div.querySelector(`.card-body`);
    let order = [...g.teams];
    function renderGroup() {
      groupDiv.innerHTML = order.map((teamIdx, pos) => `
        <div class="order-item">
          <strong>${pos+1}.</strong> ${esc(teams[teamIdx]?.name || '?')}
          <div style="margin-left:auto;">
            <button class="btn btn-sm" onclick="moveInGroup('${g.id}', ${pos}, -1)">↑</button>
            <button class="btn btn-sm" onclick="moveInGroup('${g.id}', ${pos}, 1)">↓</button>
          </div>
        </div>
      `).join('');
    }
    window[`moveInGroup_${g.id}`] = function(pos, delta) {
      const newPos = pos + delta;
      if (newPos < 0 || newPos >= order.length) return;
      [order[pos], order[newPos]] = [order[newPos], order[pos]];
      renderGroup();
    };
    window[`applyGroupOrder_${g.id}`] = function() {
      const groupMatches = schedule.filter(m => m.cupData && m.cupData.type === 'group' && m.cupData.group == g.id);
      let newMatches = [];
      for (let i = 0; i < order.length; i++) {
        for (let j = i+1; j < order.length; j++) {
          newMatches.push({ a: order[i], b: order[j] });
        }
      }
      let matchIdx = 0;
      for (let i = 0; i < schedule.length; i++) {
        if (schedule[i].cupData && schedule[i].cupData.type === 'group' && schedule[i].cupData.group == g.id) {
          if (matchIdx < newMatches.length) {
            schedule[i].idxA = newMatches[matchIdx].a;
            schedule[i].idxB = newMatches[matchIdx].b;
            schedule[i].sA = 0; schedule[i].sB = 0; schedule[i].done = false; schedule[i].winner = -1;
            matchIdx++;
          }
        }
      }
      renderScheduleAndStandings();
      saveStateToLocalStorage();
      alert(`Grupo ${parseInt(g.id)+1} reordenado.`);
    };
    renderGroup();
    const btnApply = document.createElement('button');
    btnApply.textContent = 'Aplicar ordem deste grupo';
    btnApply.className = 'btn btn-sm btn-primary';
    btnApply.style.marginTop = '12px';
    btnApply.onclick = window[`applyGroupOrder_${g.id}`];
    groupDiv.appendChild(btnApply);
  });
  openModal('modal-group-order');
}

// ==============================================================
// NAVEGAÇÃO E INICIALIZAÇÃO
// ==============================================================
function switchTab(name){
  const panels=['elenco','presenca','times','placar','rodizio','estatisticas','torneio','importar'];
  panels.forEach(t=>{
    $(`panel-${t}`).classList.toggle('active',t===name);
    document.querySelector(`.tab[onclick*="switchTab('${t}')"]`)?.classList.toggle('active',t===name);
  });
  if(name==='estatisticas') renderStats();
  if(name==='times') renderTeams();
  if(name==='rodizio'&&schedule.length) renderScheduleAndStandings();
  if(name==='placar') updatePlacarModeIndicator();
}

function dragOverHandler(e){ e.preventDefault(); document.querySelector('.dropzone').classList.add('over'); }
function dragLeaveHandler(e){ document.querySelector('.dropzone').classList.remove('over'); }
function dropHandler(e){ e.preventDefault(); document.querySelector('.dropzone').classList.remove('over'); handleFile(e.dataTransfer.files[0]); }
function jumpToMatch(idx){ if(idx>=0&&idx<schedule.length&&!schedule[idx].done&&!schedule[idx].placeholder){ currentMatchIdx=idx; startMatch(idx); switchTab('placar'); } }

function selectMode(mode){
  if (modeLocked && schedule.length && schedule.some(m => !m.done)) {
    alert('Não é possível trocar o modo durante um rodízio em andamento. Encerre a noite primeiro.');
    return;
  }
  currentRodizioMode = mode;
  document.querySelectorAll('.mode-option').forEach(opt => {
    if (opt.getAttribute('data-mode') === mode) opt.classList.add('selected');
    else opt.classList.remove('selected');
  });
  updateModePreview();
}

function updateModePreview(){
  const n = teams.length;
  let previewText = '';
  switch (currentRodizioMode) {
    case 'dynamic':
      previewText = `🟢 Fila Dinâmica: vencedor permanece, após 2 vitórias seguidas o time sai.`;
      break;
    case 'cup':
      previewText = `🔵 Copa Relâmpago: grupos, semifinais e final. Máximo de ${cfg.totalMatches} partidas.`;
      break;
    case 'roundrobin':
      previewText = `🟡 Rodízio Fixo: todos contra todos (ida/volta). Máximo de ${cfg.totalMatches} partidas.`;
      break;
    default: previewText = 'Selecione um modo.';
  }
  document.getElementById('mode-preview').innerHTML = previewText;
}

// Extensão do renderTeams para exibir o seletor
const originalRenderTeams = renderTeams;
window.renderTeams = function() {
  originalRenderTeams();
  if (teams.length) {
    document.getElementById('mode-selector-container').style.display = 'block';
    updateModePreview();
  } else {
    document.getElementById('mode-selector-container').style.display = 'none';
  }
};

// Inicialização e eventos
document.getElementById('btn-test').addEventListener('click', function(e) {
  e.stopPropagation();
  openModal('modal-test');
});
document.getElementById('btn-cfg').addEventListener('click', function(e) {
  e.stopPropagation();
  $('cfg-max').value = cfg.maxPoints;
  $('cfg-adv').value = cfg.advantage;
  $('cfg-admin').value = cfg.admin;
  $('cfg-total-matches').value = cfg.totalMatches;
  openModal('modal-cfg');
});
document.getElementById('download-modelo').onclick=(e)=>{ e.preventDefault(); downloadModelo(); };
window.addEventListener('load',()=>{
  loadStateFromLocalStorage();
  renderPlayers();
  renderPresence();
  const teamFilter=$('filter-team');
  if(teamFilter) teamFilter.innerHTML='<option value="">Todos os times</option>'+teams.map((t,i)=>`<option value="${i}">${esc(t.name)}</option>`).join('');
  showRodizioSubTab('agenda');
  document.querySelector('.mode-option[data-mode="dynamic"]').classList.add('selected');
  updateModePreview();
  updatePlacarModeIndicator();
});

// Atribuições globais
window.toggleCollapse=toggleCollapse;
window.setPresenceFilter=setPresenceFilter;
window.showRodizioSubTab=showRodizioSubTab;
window.finishMatch = finishMatch;
window.initRoundRobin = initRoundRobin;
window.endSession = endSession;
window.selectMode = selectMode;
window.nextMatchFromPlacar = nextMatchFromPlacar;
window.openTeamOrderModal = openTeamOrderModal;
window.openGroupOrderModal = openGroupOrderModal;