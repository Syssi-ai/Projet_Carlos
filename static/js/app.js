const JOURS = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
const JOURS_LABEL = {lundi:'Lundi',mardi:'Mardi',mercredi:'Mercredi',jeudi:'Jeudi',vendredi:'Vendredi',samedi:'Samedi',dimanche:'Dimanche'};
const CODE_GERANT = 'CATEX-GERANT-2026';

let state = {
  view: 'login',
  currentUser: null,
  error: '',
  info: '',
  loading: true,
  subview: null,
  registerRole: 'client',
};

function setState(patch){ state = {...state, ...patch}; render(); }

async function apiFetch(path, options = {}){
  const response = await fetch(path, {
    headers: {'Content-Type':'application/json'},
    credentials: 'same-origin',
    ...options,
  });
  const data = await response.json().catch(()=>({}));
  return {ok: response.ok, status: response.status, ...data};
}

async function getUser(email){
  if(!email) return null;
  const resp = await apiFetch('/api/user/'+encodeURIComponent(email.toLowerCase().trim()));
  return resp.ok ? resp.user : null;
}

async function registerUser(user){
  return apiFetch('/api/register', {method:'POST', body: JSON.stringify(user)});
}

async function loginUser(email, passwordHash){
  return apiFetch('/api/login', {method:'POST', body: JSON.stringify({email, passwordHash})});
}

async function getAvailability(){
  const resp = await apiFetch('/api/availability');
  return resp.availability || defaultAvailability();
}

async function saveAvailability(av){
  return apiFetch('/api/availability', {method:'POST', body: JSON.stringify(av)});
}

async function getAllAppointments(){
  const resp = await apiFetch('/api/appointments');
  return resp.appointments || [];
}

async function saveAppointment(appt){
  return apiFetch('/api/appointments', {method:'POST', body: JSON.stringify(appt)});
}

async function getAppointment(id){
  const resp = await apiFetch('/api/appointment/'+encodeURIComponent(id));
  return resp.ok ? resp.appointment : null;
}

async function getClients(){
  const resp = await apiFetch('/api/clients');
  return resp.clients || [];
}

async function requestReset(email){
  return apiFetch('/api/reset-request', {method:'POST', body: JSON.stringify({email})});
}

async function resetPassword(email, code, newPassword){
  return apiFetch('/api/reset-password', {method:'POST', body: JSON.stringify({email, code, newPassword})});
}

async function updateProfile(user){
  return apiFetch('/api/user/'+encodeURIComponent(user.email), {method:'PUT', body: JSON.stringify(user)});
}

function defaultAvailability(){
  const empty = {dureeCreneau:30};
  JOURS.forEach(j=>empty[j]=[]);
  return empty;
}

function hashPw(pw){ try{ return btoa(unescape(encodeURIComponent('catex::'+pw))); }catch(e){ return pw; } }

function todayISO(){ const d=new Date(); return d.toISOString().slice(0,10); }
function weekdayKeyFromDate(iso){
  const d = new Date(iso+'T00:00:00');
  const idx = d.getDay();
  const map = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  return map[idx];
}
function fmtDateLong(iso){
  const d = new Date(iso+'T00:00:00');
  return d.toLocaleDateString('fr-FR',{weekday:'long', day:'numeric', month:'long', year:'numeric'});
}
function addMinutes(hhmm, mins){
  const [h,m] = hhmm.split(':').map(Number);
  const total = h*60+m+mins;
  const nh = Math.floor(total/60)%24, nm = total%60;
  return String(nh).padStart(2,'0')+':'+String(nm).padStart(2,'0');
}
function timeToMin(hhmm){ const [h,m]=hhmm.split(':').map(Number); return h*60+m; }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }

async function render(){
  const root = document.getElementById('root');
  if(state.loading){ root.innerHTML = '<div class="loading">Chargement de Catex…</div>'; return; }
  if(!state.currentUser){ root.innerHTML = renderAuth(); attachAuthEvents(); return; }
  if(state.currentUser.role === 'gerant'){ root.innerHTML = renderShell(renderManager()); }
  else{ root.innerHTML = renderShell(renderClient()); }
  attachShellEvents();
  attachViewEvents();
}

function renderShell(innerHtml){
  const u = state.currentUser;
  const isGerant = u.role === 'gerant';
  const tabs = isGerant
    ? [['manager-agenda','Agenda'],['manager-dispos','Disponibilités'],['manager-clients','Clients']]
    : [['client-rdv','Prendre RDV'],['client-mes-rdv','Mes rendez-vous'],['client-profil','Mon profil']];
  return `
    <div class="topbar">
      <div class="brand"><span class="mark">C</span> Catex</div>
      <nav>
        ${tabs.map(([v,label])=>`<button class="navlink ${state.view===v?'active':''}" data-nav="${v}">${label}</button>`).join('')}
      </nav>
      <div class="userbox">
        <span class="name">${escapeHtml(u.prenom)} ${escapeHtml(u.nom)} ${isGerant?'· Gérant':''}</span>
        <button class="btn btn-sm" id="btn-logout">Déconnexion</button>
      </div>
    </div>
    <main>${innerHtml}</main>
    <footer class="disclaimer">Catex — démo de prototype. Les mots de passe et données sont stockés à des fins de démonstration uniquement.</footer>
  `;
}

function escapeHtml(s){ return (s||'').toString().replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function renderAuth(){
  const v = state.view;
  let inner = '';
  if(v === 'login') inner = authLoginForm();
  else if(v === 'register') inner = authRegisterForm();
  else if(v === 'forgot') inner = authForgotForm();
  else inner = authLoginForm();

  return `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="brand"><span class="mark">C</span> Catex</div>
        <p class="auth-sub">Votre espace personnel de rendez-vous</p>
        ${(v==='login'||v==='register') ? `
        <div class="tabs">
          <div class="tab ${v==='login'?'active':''}" data-tab="login">Connexion</div>
          <div class="tab ${v==='register'?'active':''}" data-tab="register">Créer un compte</div>
        </div>` : ''}
        ${state.error ? `<div class="msg msg-error">${escapeHtml(state.error)}</div>` : ''}
        ${state.info ? `<div class="msg msg-info">${escapeHtml(state.info)}</div>` : ''}
        ${inner}
      </div>
    </div>
  `;
}

function authLoginForm(){
  return `
    <form id="form-login">
      <label>Adresse e-mail</label>
      <input type="email" id="login-email" required placeholder="vous@exemple.fr">
      <label>Mot de passe</label>
      <input type="password" id="login-pw" required placeholder="••••••••">
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:4px;">Se connecter</button>
      <div style="text-align:center;margin-top:14px;">
        <button type="button" class="link-btn" data-tab="forgot">Mot de passe oublié ?</button>
      </div>
    </form>
  `;
}

function authRegisterForm(){
  const role = state.registerRole;
  return `
    <form id="form-register">
      <div class="tabs" style="margin-bottom:16px;">
        <div class="tab ${role==='client'?'active':''}" data-role="client">Je suis client</div>
        <div class="tab ${role==='gerant'?'active':''}" data-role="gerant">Je suis le gérant</div>
      </div>
      <div class="row2">
        <div><label>Prénom</label><input type="text" id="reg-prenom" required></div>
        <div><label>Nom</label><input type="text" id="reg-nom" required></div>
      </div>
      <label>Adresse e-mail</label>
      <input type="email" id="reg-email" required placeholder="vous@exemple.fr">
      <label>Numéro de téléphone</label>
      <input type="tel" id="reg-tel" required placeholder="06 12 34 56 78">
      <label>Adresse postale</label>
      <input type="text" id="reg-adresse" required placeholder="12 rue des Lilas, 75000 Paris">
      ${role==='gerant' ? `
      <label>Code gérant</label>
      <input type="text" id="reg-code" placeholder="Code fourni par Catex">
      <div class="field-note">Ce code confirme que vous êtes bien le gérant de l'établissement.</div>
      ` : ''}
      <label>Mot de passe</label>
      <input type="password" id="reg-pw" required minlength="6" placeholder="6 caractères minimum">
      <label>Confirmer le mot de passe</label>
      <input type="password" id="reg-pw2" required minlength="6">
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:4px;">Créer mon compte</button>
    </form>
  `;
}

function authForgotForm(){
  if(state.subview === 'code-sent'){
    return `
      <form id="form-reset">
        <div class="msg msg-info">Dans une vraie application, un e-mail contenant un code de réinitialisation serait envoyé à cette adresse. Pour cette démo, voici le code généré :
          <div class="mono" style="font-size:20px;font-weight:700;margin-top:8px;letter-spacing:0.1em;">${escapeHtml(state.resetCode)}</div>
        </div>
        <input type="hidden" id="reset-email" value="${escapeHtml(state.resetEmail)}">
        <label>Code reçu</label>
        <input type="text" id="reset-code-input" required placeholder="123456">
        <label>Nouveau mot de passe</label>
        <input type="password" id="reset-pw" required minlength="6">
        <button type="submit" class="btn btn-primary" style="width:100%;margin-top:4px;">Réinitialiser le mot de passe</button>
        <div style="text-align:center;margin-top:14px;">
          <button type="button" class="link-btn" data-tab="login">Retour à la connexion</button>
        </div>
      </form>
    `;
  }
  return `
    <form id="form-forgot">
      <p style="font-size:14px;color:var(--text-muted);margin-top:0;">Indiquez l'adresse e-mail associée à votre compte. Nous vous enverrons un code pour choisir un nouveau mot de passe.</p>
      <label>Adresse e-mail</label>
      <input type="email" id="forgot-email" required placeholder="vous@exemple.fr">
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:4px;">Envoyer le code</button>
      <div style="text-align:center;margin-top:14px;">
        <button type="button" class="link-btn" data-tab="login">Retour à la connexion</button>
      </div>
    </form>
  `;
}

function attachAuthEvents(){
  document.querySelectorAll('[data-tab]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const tab = el.getAttribute('data-tab');
      setState({view:tab, error:'', info:'', subview:null});
    });
  });
  document.querySelectorAll('[data-role]').forEach(el=>{
    el.addEventListener('click', ()=> setState({registerRole: el.getAttribute('data-role')}));
  });

  const loginForm = document.getElementById('form-login');
  if(loginForm) loginForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const pw = document.getElementById('login-pw').value;
    const resp = await loginUser(email, hashPw(pw));
    if(!resp.ok){ setState({error: resp.error || 'Adresse e-mail ou mot de passe incorrect.'}); return; }
    setState({currentUser: resp.user, error:'', info:'', view: resp.user.role==='gerant'?'manager-agenda':'client-rdv'});
  });

  const regForm = document.getElementById('form-register');
  if(regForm) regForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const prenom = document.getElementById('reg-prenom').value.trim();
    const nom = document.getElementById('reg-nom').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const tel = document.getElementById('reg-tel').value.trim();
    const adresse = document.getElementById('reg-adresse').value.trim();
    const pw = document.getElementById('reg-pw').value;
    const pw2 = document.getElementById('reg-pw2').value;
    const role = state.registerRole;

    if(pw !== pw2){ setState({error:'Les mots de passe ne correspondent pas.'}); return; }
    if(role==='gerant'){
      const code = document.getElementById('reg-code').value.trim();
      if(code !== CODE_GERANT){ setState({error:'Code gérant invalide.'}); return; }
    }

    const resp = await registerUser({
      prenom,
      nom,
      email,
      telephone: tel,
      adresse,
      role,
      code: role==='gerant' ? document.getElementById('reg-code').value.trim() : undefined,
      passwordHash: hashPw(pw),
    });
    if(!resp.ok){ setState({error: resp.error || 'Impossible de créer le compte.'}); return; }
    setState({currentUser: resp.user, error:'', info:'', view: resp.user.role==='gerant'?'manager-agenda':'client-rdv'});
  });

  const forgotForm = document.getElementById('form-forgot');
  if(forgotForm) forgotForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim().toLowerCase();
    const resp = await requestReset(email);
    if(!resp.ok){ setState({error: resp.error || 'Aucun compte associé à cette adresse e-mail.'}); return; }
    setState({error:'', resetEmail: email, resetCode: resp.code, subview:'code-sent'});
  });

  const resetForm = document.getElementById('form-reset');
  if(resetForm) resetForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = document.getElementById('reset-email').value;
    const codeInput = document.getElementById('reset-code-input').value.trim();
    const newPw = document.getElementById('reset-pw').value;
    const resp = await resetPassword(email, codeInput, newPw);
    if(!resp.ok){ setState({error: resp.error || 'Code invalide ou expiré.'}); return; }
    setState({view:'login', subview:null, error:'', info:'Mot de passe mis à jour. Vous pouvez vous connecter.'});
  });
}

function renderClient(){
  if(state.view === 'client-profil') return renderClientProfil();
  if(state.view === 'client-mes-rdv') return renderClientMesRdv();
  return renderClientPriseRdv();
}

function renderClientProfil(){
  const u = state.currentUser;
  return `
    <h1>Mon profil</h1>
    <p class="page-sub">Vos informations personnelles.</p>
    <div class="card" style="max-width:520px;">
      <form id="form-profil">
        <div class="row2">
          <div><label>Prénom</label><input type="text" id="p-prenom" value="${escapeHtml(u.prenom)}" required></div>
          <div><label>Nom</label><input type="text" id="p-nom" value="${escapeHtml(u.nom)}" required></div>
        </div>
        <label>Adresse e-mail</label>
        <input type="email" id="p-email" value="${escapeHtml(u.email)}" disabled style="opacity:0.6;">
        <label>Numéro de téléphone</label>
        <input type="tel" id="p-tel" value="${escapeHtml(u.telephone)}" required>
        <label>Adresse postale</label>
        <input type="text" id="p-adresse" value="${escapeHtml(u.adresse)}" required>
        ${state.info ? `<div class="msg msg-success">${escapeHtml(state.info)}</div>` : ''}
        <button type="submit" class="btn btn-primary">Enregistrer les modifications</button>
      </form>
    </div>
  `;
}

function renderClientPriseRdv(){
  const dateVal = state.selectedDate || todayISO();
  return `
    <h1>Prendre rendez-vous</h1>
    <p class="page-sub">Choisissez une date pour voir les créneaux disponibles.</p>
    <div class="card">
      <label>Date souhaitée</label>
      <input type="date" id="rdv-date" value="${dateVal}" min="${todayISO()}" style="max-width:220px;">
      <div id="slots-zone">
        <div class="loading">Chargement des créneaux…</div>
      </div>
    </div>
  `;
}

function renderClientMesRdv(){
  return `
    <h1>Mes rendez-vous</h1>
    <p class="page-sub">Historique et rendez-vous à venir.</p>
    <div class="card" id="mes-rdv-zone"><div class="loading">Chargement…</div></div>
  `;
}

async function loadSlotsZone(){
  const zone = document.getElementById('slots-zone');
  if(!zone) return;
  const dateInput = document.getElementById('rdv-date');
  const date = dateInput ? dateInput.value : (state.selectedDate || todayISO());
  state.selectedDate = date;

  const av = await getAvailability();
  const wk = weekdayKeyFromDate(date);
  const ranges = av[wk] || [];
  const duree = av.dureeCreneau || 30;

  if(ranges.length === 0){
    zone.innerHTML = `<div class="empty-state">Le gérant n'a défini aucun créneau disponible pour ce jour (${JOURS_LABEL[wk]}).</div>`;
    return;
  }

  const allAppts = await getAllAppointments();
  const bookedOnDate = allAppts.filter(a => a.date === date && a.status === 'confirme').map(a=>a.start);

  let slots = [];
  ranges.forEach(r=>{
    let cursor = r.debut;
    while(timeToMin(cursor) + duree <= timeToMin(r.fin)){
      slots.push(cursor);
      cursor = addMinutes(cursor, duree);
    }
  });
  slots = slots.filter(s => !bookedOnDate.includes(s));

  if(slots.length === 0){
    zone.innerHTML = `<div class="empty-state">Aucun créneau disponible ce jour-là. Essayez une autre date.</div>`;
    return;
  }

  zone.innerHTML = `
    <h2 style="margin-top:20px;">Créneaux disponibles — ${fmtDateLong(date)}</h2>
    <div class="slots-grid">
      ${slots.map(s=>`<button class="slot-btn" data-slot="${s}">${s}</button>`).join('')}
    </div>
  `;
  zone.querySelectorAll('[data-slot]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const start = btn.getAttribute('data-slot');
      const end = addMinutes(start, duree);
      const u = state.currentUser;
      const resp = await saveAppointment({id: uid(), clientEmail: u.email, clientNom: u.nom, clientPrenom: u.prenom, date, start, end, status:'confirme', createdAt: Date.now()});
      if(!resp.ok){ setState({error: resp.error || 'Impossible de réserver le créneau.'}); return; }
      setState({view:'client-mes-rdv', info:'Rendez-vous confirmé pour le '+fmtDateLong(date)+' à '+start+'.'});
    });
  });
}

async function loadMesRdvZone(){
  const zone = document.getElementById('mes-rdv-zone');
  if(!zone) return;
  const u = state.currentUser;
  const all = await getAllAppointments();
  const mine = all.filter(a=>a.clientEmail===u.email).sort((a,b)=> (a.date+a.start).localeCompare(b.date+b.start));
  if(mine.length===0){ zone.innerHTML = `<div class="empty-state">Vous n'avez aucun rendez-vous pour le moment.</div>`; return; }
  zone.innerHTML = mine.map(a=>`
    <div class="appt-item" style="cursor:default;">
      <span class="appt-time mono">${fmtDateLong(a.date)} · ${a.start}</span>
      <span class="appt-client">Rendez-vous</span>
      <span class="pill pill-${a.status==='confirme'?'confirme':'annule'}">${a.status==='confirme'?'Confirmé':'Annulé'}</span>
      ${a.status==='confirme' ? `<button class="btn btn-sm btn-danger" data-cancel="${a.id}">Annuler</button>` : ''}
    </div>
  `).join('');
  zone.querySelectorAll('[data-cancel]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const id = btn.getAttribute('data-cancel');
      const appt = await getAppointment(id);
      if(!appt) return;
      appt.status = 'annule';
      await saveAppointment(appt);
      loadMesRdvZone();
    });
  });
}

function renderManager(){
  if(state.view === 'manager-dispos') return renderManagerDispos();
  if(state.view === 'manager-clients') return renderManagerClients();
  return renderManagerAgenda();
}

function renderManagerAgenda(){
  const dateVal = state.agendaDate || todayISO();
  return `
    <h1>Agenda</h1>
    <p class="page-sub">Rendez-vous pris par vos clients.</p>
    <div class="card">
      <div class="agenda-toolbar">
        <label style="margin:0;">Date&nbsp;</label>
        <input type="date" id="agenda-date" value="${dateVal}" style="max-width:220px;margin:0;">
      </div>
      <div id="agenda-zone"><div class="loading">Chargement…</div></div>
    </div>
  `;
}

async function loadAgendaZone(){
  const zone = document.getElementById('agenda-zone');
  if(!zone) return;
  const input = document.getElementById('agenda-date');
  const date = input ? input.value : (state.agendaDate || todayISO());
  state.agendaDate = date;

  const all = await getAllAppointments();
  const dayAppts = all.filter(a=>a.date===date && a.status==='confirme').sort((a,b)=>a.start.localeCompare(b.start));

  if(dayAppts.length===0){
    zone.innerHTML = `<div class="empty-state">Aucun rendez-vous le ${fmtDateLong(date)}.</div>`;
    return;
  }
  zone.innerHTML = `<h2 style="margin-top:18px;">${fmtDateLong(date)}</h2>` + dayAppts.map(a=>`
    <div class="appt-item" data-appt="${a.id}">
      <span class="appt-time mono">${a.start} – ${a.end}</span>
      <span class="appt-client">${escapeHtml(a.clientPrenom)} ${escapeHtml(a.clientNom)}</span>
      <span class="pill pill-confirme">Confirmé</span>
    </div>
  `).join('');
  zone.querySelectorAll('[data-appt]').forEach(el=>{
    el.addEventListener('click', async ()=>{
      const id = el.getAttribute('data-appt');
      const appt = await getAppointment(id);
      if(!appt) return;
      const client = await getUser(appt.clientEmail);
      showClientModal(client, [appt]);
    });
  });
}

function renderManagerDispos(){
  return `
    <h1>Mes disponibilités</h1>
    <p class="page-sub">Définissez vos horaires d'ouverture pour que les clients puissent réserver un créneau.</p>
    <div class="card">
      <label style="max-width:220px;">Durée d'un créneau (minutes)</label>
      <select id="duree-creneau" style="max-width:220px;">
        <option value="15">15 min</option>
        <option value="30">30 min</option>
        <option value="45">45 min</option>
        <option value="60">60 min</option>
      </select>
      <div id="dispo-zone"><div class="loading">Chargement…</div></div>
      <button class="btn btn-primary" id="save-dispo" style="margin-top:16px;">Enregistrer mes disponibilités</button>
      <div id="dispo-msg"></div>
    </div>
  `;
}

let dispoState = null;

async function loadDispoZone(){
  const zone = document.getElementById('dispo-zone');
  if(!zone) return;
  if(!dispoState){ dispoState = await getAvailability(); }
  document.getElementById('duree-creneau').value = String(dispoState.dureeCreneau || 30);
  renderDispoRows();
}

function renderDispoRows(){
  const zone = document.getElementById('dispo-zone');
  zone.innerHTML = JOURS.map(j=>{
    const ranges = dispoState[j] || [];
    return `
      <div class="day-row">
        <div class="day-label">${JOURS_LABEL[j]}</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;flex:1;">
          ${ranges.map((r,i)=>`
            <span class="range-item">
              <input type="time" value="${r.debut}" data-day="${j}" data-idx="${i}" data-field="debut">
              <span>–</span>
              <input type="time" value="${r.fin}" data-day="${j}" data-idx="${i}" data-field="fin">
              <span class="remove-x" data-remove-day="${j}" data-remove-idx="${i}">×</span>
            </span>
          `).join('')}
          <button type="button" class="add-range" data-add-day="${j}">+ créneau</button>
        </div>
      </div>
    `;
  }).join('');

  zone.querySelectorAll('input[data-day]').forEach(inp=>{
    inp.addEventListener('change', ()=>{
      const day = inp.getAttribute('data-day');
      const idx = Number(inp.getAttribute('data-idx'));
      const field = inp.getAttribute('data-field');
      dispoState[day][idx][field] = inp.value;
    });
  });
  zone.querySelectorAll('[data-remove-day]').forEach(x=>{
    x.addEventListener('click', ()=>{
      const day = x.getAttribute('data-remove-day');
      const idx = Number(x.getAttribute('data-remove-idx'));
      dispoState[day].splice(idx,1);
      renderDispoRows();
    });
  });
  zone.querySelectorAll('[data-add-day]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const day = btn.getAttribute('data-add-day');
      if(!dispoState[day]) dispoState[day]=[];
      dispoState[day].push({debut:'09:00', fin:'12:00'});
      renderDispoRows();
    });
  });
}

function renderManagerClients(){
  return `
    <h1>Mes clients</h1>
    <p class="page-sub">Liste de vos clients et de leurs informations personnelles.</p>
    <div class="card"><div id="clients-zone"><div class="loading">Chargement…</div></div></div>
  `;
}

async function loadClientsZone(){
  const zone = document.getElementById('clients-zone');
  if(!zone) return;
  const clients = await getClients();
  if(clients.length===0){ zone.innerHTML = `<div class="empty-state">Aucun client inscrit pour le moment.</div>`; return; }
  zone.innerHTML = `
    <table>
      <thead><tr><th>Nom</th><th>E-mail</th><th>Téléphone</th><th>Adresse</th></tr></thead>
      <tbody>
        ${clients.map(c=>`
          <tr class="clickable" data-client="${c.email}">
            <td>${escapeHtml(c.prenom)} ${escapeHtml(c.nom)}</td>
            <td>${escapeHtml(c.email)}</td>
            <td>${escapeHtml(c.telephone)}</td>
            <td>${escapeHtml(c.adresse)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  zone.querySelectorAll('[data-client]').forEach(row=>{
    row.addEventListener('click', async ()=>{
      const email = row.getAttribute('data-client');
      const client = await getUser(email);
      const allAppointments = await getAllAppointments();
      const appts = allAppointments.filter(a=>a.clientEmail===email).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
      showClientModal(client, appts);
    });
  });
}

function showClientModal(client, appts){
  const modalHtml = `
    <div class="modal-bg" id="client-modal-bg">
      <div class="modal">
        <h2>${escapeHtml(client.prenom)} ${escapeHtml(client.nom)}</h2>
        <div class="info-line"><span>E-mail</span><span>${escapeHtml(client.email)}</span></div>
        <div class="info-line"><span>Téléphone</span><span>${escapeHtml(client.telephone)}</span></div>
        <div class="info-line"><span>Adresse</span><span>${escapeHtml(client.adresse)}</span></div>
        <h2 style="margin-top:20px;">Rendez-vous</h2>
        ${appts.length===0 ? '<p style="color:var(--text-muted);font-size:14px;">Aucun rendez-vous.</p>' :
          appts.map(a=>`<div class="info-line"><span>${fmtDateLong(a.date)} · ${a.start}</span><span class="pill pill-${a.status==='confirme'?'confirme':'annule'}">${a.status==='confirme'?'Confirmé':'Annulé'}</span></div>`).join('')
        }
        <div class="modal-actions"><button class="btn" id="close-modal">Fermer</button></div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  document.getElementById('close-modal').addEventListener('click', ()=>{
    document.getElementById('client-modal-bg').remove();
  });
  document.getElementById('client-modal-bg').addEventListener('click', (e)=>{
    if(e.target.id === 'client-modal-bg') e.target.remove();
  });
}

function attachShellEvents(){
  document.querySelectorAll('[data-nav]').forEach(el=>{
    el.addEventListener('click', ()=>{
      dispoState = null;
      setState({view: el.getAttribute('data-nav'), error:'', info:''});
    });
  });
  const logoutBtn = document.getElementById('btn-logout');
  if(logoutBtn) logoutBtn.addEventListener('click', ()=>{
    setState({currentUser:null, view:'login', error:'', info:'', subview:null});
  });
}

function attachViewEvents(){
  const profilForm = document.getElementById('form-profil');
  if(profilForm) profilForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const u = {...state.currentUser};
    u.prenom = document.getElementById('p-prenom').value.trim();
    u.nom = document.getElementById('p-nom').value.trim();
    u.telephone = document.getElementById('p-tel').value.trim();
    u.adresse = document.getElementById('p-adresse').value.trim();
    const resp = await updateProfile(u);
    if(!resp.ok){ setState({error: resp.error || 'Impossible de mettre à jour le profil.'}); return; }
    setState({currentUser: resp.user, info:'Profil mis à jour avec succès.'});
  });

  const rdvDate = document.getElementById('rdv-date');
  if(rdvDate){ loadSlotsZone(); rdvDate.addEventListener('change', loadSlotsZone); }

  if(document.getElementById('mes-rdv-zone')) loadMesRdvZone();

  const agendaDate = document.getElementById('agenda-date');
  if(agendaDate){ loadAgendaZone(); agendaDate.addEventListener('change', loadAgendaZone); }

  if(document.getElementById('dispo-zone')){
    loadDispoZone();
    document.getElementById('duree-creneau').addEventListener('change', (e)=>{
      dispoState.dureeCreneau = Number(e.target.value);
    });
    document.getElementById('save-dispo').addEventListener('click', async ()=>{
      const resp = await saveAvailability(dispoState);
      document.getElementById('dispo-msg').innerHTML = resp.ok ? '<div class="msg msg-success" style="margin-top:14px;">Disponibilités enregistrées.</div>' : `<div class="msg msg-error" style="margin-top:14px;">${escapeHtml(resp.error || 'Impossible d\'enregistrer les disponibilités.')}</div>`;
    });
  }

  if(document.getElementById('clients-zone')) loadClientsZone();
}

(async function init(){
  setState({loading:false});
})();
