// ---------- Firebase-configuratie ----------
// Leeg = de app werkt volledig lokaal (per toestel apart, in localStorage).
// Vul dit in met je eigen Firebase-project (zie README.md, sectie "Cross-device
// synchronisatie instellen") om dezelfde gegevens op al je toestellen te zien.
const FIREBASE_CONFIG = null;
// Voorbeeld:
// const FIREBASE_CONFIG = {
//   apiKey: "AIza...",
//   authDomain: "jouw-project.firebaseapp.com",
//   projectId: "jouw-project",
//   storageBucket: "jouw-project.appspot.com",
//   messagingSenderId: "...",
//   appId: "..."
// };

const LIJNEN = ['verdediging', 'midden', 'aanval'];
const LIJN_LABEL = { keeper: 'Keeper', verdediging: 'Verdediging', midden: 'Midden', aanval: 'Aanval' };
const KWART_DUUR = 15; // minuten
const AANTAL_KWARTEN = 4;

const FORMATIES = [
  { label: '1-2-3-2', verdediging: 2, midden: 3, aanval: 2 },
  { label: '1-3-2-2', verdediging: 3, midden: 2, aanval: 2 },
  { label: '1-2-2-3', verdediging: 2, midden: 2, aanval: 3 },
  { label: '1-3-3-1', verdediging: 3, midden: 3, aanval: 1 },
  { label: '1-2-4-1', verdediging: 2, midden: 4, aanval: 1 },
];
const STANDAARD_FORMATIE = '1-2-3-2';

const DEFAULT_SPELERS_NAMEN = ['Noah', 'Kick', 'Nick', 'Daley', 'Benjamin', 'Imran', 'Khalil', 'Damin', 'Axel', 'Rafael', 'Julian'];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function formatieVinden(label) {
  return FORMATIES.find(f => f.label === label) || FORMATIES[0];
}

// Lege opstelling voor een kwart bij een bepaalde formatie.
function legeOpstelling(formatieLabel) {
  const f = formatieVinden(formatieLabel);
  return {
    keeper: [null],
    verdediging: new Array(f.verdediging).fill(null),
    midden: new Array(f.midden).fill(null),
    aanval: new Array(f.aanval).fill(null),
  };
}

function nieuwKwart(formatieLabel) {
  // bankKleur: per bankspeler (id) de linie waarvoor hij klaarstaat het volgende kwart.
  return { formatie: formatieLabel, opstelling: legeOpstelling(formatieLabel), bankKleur: {} };
}

function nieuweSpelerState(naam, keeper) {
  return { id: uid(), naam, aanwezig: true, keeper: !!keeper };
}

function standaardState() {
  return {
    versie: 1,
    teamNaam: "AFC'34 — JO11-4",
    players: DEFAULT_SPELERS_NAMEN.map((naam, i) => nieuweSpelerState(naam, naam === 'Nick')),
    kwarten: Array.from({ length: AANTAL_KWARTEN }, () => nieuwKwart(STANDAARD_FORMATIE)),
  };
}

let state = standaardState();

// De vaste keeper vult de keeperspositie automatisch bij een lege opstelling —
// blijft daarna gewoon een los, handmatig aan te passen vakje zoals alle andere.
function vulVasteKeeperIn() {
  const vast = state.players.find(p => p.keeper && p.aanwezig);
  if (!vast) return;
  state.kwarten.forEach(kwart => {
    if (!kwart.opstelling.keeper[0]) kwart.opstelling.keeper[0] = vast.id;
  });
}

function migreerState() {
  if (!Array.isArray(state.players)) state.players = [];
  if (!Array.isArray(state.kwarten) || state.kwarten.length !== AANTAL_KWARTEN) {
    state.kwarten = Array.from({ length: AANTAL_KWARTEN }, () => nieuwKwart(STANDAARD_FORMATIE));
  }
  state.players.forEach(p => {
    if (p.aanwezig == null) p.aanwezig = true;
    if (p.keeper == null) p.keeper = false;
  });
  state.kwarten.forEach(kwart => {
    if (!kwart.formatie) kwart.formatie = STANDAARD_FORMATIE;
    if (!kwart.opstelling) kwart.opstelling = legeOpstelling(kwart.formatie);
    if (!kwart.bankKleur) kwart.bankKleur = {};
  });
}

// ---------- Opslag: Firebase (indien geconfigureerd) met lokale fallback ----------

const LOCAL_KEY = 'opstelling-jo11-4-state-v1';
const TEAM_ID_KEY = 'opstelling-jo11-4-team-id';
let firestore = null; // { docRef, getDoc, setDoc, onSnapshot }
let laatstOpgeslagenJson = null;
let opslaanTimer = null;

function huidigeTeamId() {
  const uitUrl = new URLSearchParams(location.search).get('team');
  if (uitUrl) return uitUrl;
  return localStorage.getItem(TEAM_ID_KEY);
}

function zetSyncStatus(status) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  const teksten = {
    lokaal: 'Lokaal (nog niet gesynchroniseerd — zie README)',
    verbinden: 'Verbinden...',
    ok: '✅ Gesynchroniseerd',
    fout: '⚠️ Synchroniseren mislukt — lokaal bewaard',
  };
  el.textContent = teksten[status] || '';
}

async function initOpslag() {
  let teamId = huidigeTeamId();
  if (!teamId) teamId = (crypto.randomUUID ? crypto.randomUUID() : uid() + uid() + uid());
  localStorage.setItem(TEAM_ID_KEY, teamId);
  const url = new URL(location.href);
  url.searchParams.set('team', teamId);
  history.replaceState(null, '', url);

  const lokaal = localStorage.getItem(LOCAL_KEY);
  if (lokaal) {
    try { state = JSON.parse(lokaal); } catch (e) { /* corrupte data negeren */ }
  }
  migreerState();

  if (!FIREBASE_CONFIG) {
    zetSyncStatus('lokaal');
    return;
  }

  zetSyncStatus('verbinden');
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js');
    const { getFirestore, doc, getDoc, setDoc, onSnapshot } =
      await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
    const app = initializeApp(FIREBASE_CONFIG);
    const db = getFirestore(app);
    const docRef = doc(db, 'teams', teamId);

    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data().state) {
      state = snap.data().state;
      migreerState();
    } else {
      await setDoc(docRef, { state, bijgewerkt: Date.now() });
    }
    laatstOpgeslagenJson = JSON.stringify(state);

    onSnapshot(docRef, s => {
      if (!s.exists() || !s.data().state) return;
      const nieuwJson = JSON.stringify(s.data().state);
      if (nieuwJson === laatstOpgeslagenJson) return; // dit was onze eigen wijziging
      state = s.data().state;
      migreerState();
      laatstOpgeslagenJson = nieuwJson;
      renderAlles();
    });

    firestore = { docRef, setDoc };
    zetSyncStatus('ok');
  } catch (e) {
    console.error('Firebase-synchronisatie mislukt, alleen lokale opslag actief:', e);
    zetSyncStatus('fout');
  }
}

function opslaan() {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  if (!firestore) return;
  clearTimeout(opslaanTimer);
  opslaanTimer = setTimeout(() => {
    const json = JSON.stringify(state);
    laatstOpgeslagenJson = json;
    firestore.setDoc(firestore.docRef, { state, bijgewerkt: Date.now() }).catch(e => {
      console.error('Opslaan naar Firebase mislukt:', e);
      zetSyncStatus('fout');
    });
  }, 400);
}

// ---------- Spelers ----------

function renderSpelers() {
  const tbody = document.getElementById('spelersTbody');
  tbody.innerHTML = '';
  state.players.forEach(p => {
    const tr = document.createElement('tr');

    const tdAanwezig = document.createElement('td');
    const cbAanwezig = document.createElement('input');
    cbAanwezig.type = 'checkbox';
    cbAanwezig.checked = p.aanwezig;
    cbAanwezig.addEventListener('change', () => {
      p.aanwezig = cbAanwezig.checked;
      opslaan();
      renderAlles();
    });
    tdAanwezig.appendChild(cbAanwezig);

    const tdNaam = document.createElement('td');
    const inpNaam = document.createElement('input');
    inpNaam.type = 'text';
    inpNaam.value = p.naam;
    inpNaam.style.cssText = 'width:100%;border:1px solid transparent;background:transparent;';
    inpNaam.addEventListener('change', () => {
      p.naam = inpNaam.value.trim() || p.naam;
      opslaan();
      renderAlles();
    });
    tdNaam.appendChild(inpNaam);

    const tdKeeper = document.createElement('td');
    const cbKeeper = document.createElement('input');
    cbKeeper.type = 'checkbox';
    cbKeeper.checked = p.keeper;
    cbKeeper.addEventListener('change', () => {
      p.keeper = cbKeeper.checked;
      if (cbKeeper.checked) state.players.forEach(o => { if (o.id !== p.id) o.keeper = false; });
      opslaan();
      renderAlles();
    });
    tdKeeper.appendChild(cbKeeper);

    const tdRemove = document.createElement('td');
    const btnRemove = document.createElement('button');
    btnRemove.className = 'remove-btn';
    btnRemove.title = 'Speler verwijderen';
    btnRemove.textContent = '✕';
    btnRemove.addEventListener('click', () => {
      state.players = state.players.filter(x => x.id !== p.id);
      state.kwarten.forEach(kwart => {
        Object.keys(kwart.opstelling).forEach(lijn => {
          kwart.opstelling[lijn] = kwart.opstelling[lijn].map(id => (id === p.id ? null : id));
        });
        delete kwart.bankKleur[p.id];
      });
      opslaan();
      renderAlles();
    });
    tdRemove.appendChild(btnRemove);

    tr.append(tdAanwezig, tdNaam, tdKeeper, tdRemove);
    tbody.appendChild(tr);
  });
}

document.getElementById('nieuweSpelerForm').addEventListener('submit', e => {
  e.preventDefault();
  const inp = document.getElementById('nieuweSpelerNaam');
  const naam = inp.value.trim();
  if (!naam) return;
  state.players.push(nieuweSpelerState(naam, false));
  inp.value = '';
  opslaan();
  renderAlles();
});

// ---------- Kwart-tabs & formatie ----------

let huidigKwartIndex = 0;

function renderKwartTabs() {
  const el = document.getElementById('kwartTabs');
  el.innerHTML = '';
  for (let i = 0; i < AANTAL_KWARTEN; i++) {
    const btn = document.createElement('button');
    btn.className = 'kwart-tab' + (i === huidigKwartIndex ? ' actief' : '');
    const start = i * KWART_DUUR;
    btn.textContent = `Kwart ${i + 1} (${start}'-${start + KWART_DUUR}')`;
    btn.addEventListener('click', () => { huidigKwartIndex = i; renderAlles(); });
    el.appendChild(btn);
  }
}

function renderFormatieSelect() {
  const select = document.getElementById('formatieSelect');
  select.innerHTML = '';
  FORMATIES.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.label;
    opt.textContent = `${f.label} (K-V-M-A)`;
    if (f.label === state.kwarten[huidigKwartIndex].formatie) opt.selected = true;
    select.appendChild(opt);
  });
  select.onchange = () => {
    const kwart = state.kwarten[huidigKwartIndex];
    const heeftSpelers = Object.values(kwart.opstelling).some(arr => arr.some(Boolean));
    if (heeftSpelers && !confirm('Van formatie wisselen maakt dit kwart leeg. Doorgaan?')) {
      select.value = kwart.formatie;
      return;
    }
    kwart.formatie = select.value;
    kwart.opstelling = legeOpstelling(select.value);
    if (huidigKwartIndex === 0) vulVasteKeeperIn();
    opslaan();
    renderAlles();
  };
}

document.getElementById('btnKopieerVorig').addEventListener('click', () => {
  if (huidigKwartIndex === 0) return;
  const vorige = state.kwarten[huidigKwartIndex - 1];
  state.kwarten[huidigKwartIndex] = JSON.parse(JSON.stringify(vorige));
  opslaan();
  renderAlles();
});

document.getElementById('btnLeegKwart').addEventListener('click', () => {
  const kwart = state.kwarten[huidigKwartIndex];
  const heeftSpelers = Object.values(kwart.opstelling).some(arr => arr.some(Boolean));
  if (heeftSpelers && !confirm('Dit kwart helemaal leegmaken?')) return;
  kwart.opstelling = legeOpstelling(kwart.formatie);
  opslaan();
  renderAlles();
});

// ---------- Veld ----------

// Posities (in %) voor elke plek van een formatie, van eigen doel naar voren.
function plekCoordinaten(formatie) {
  const rijen = [
    { lijn: 'aanval', n: formatie.aanval, y: 19 },
    { lijn: 'midden', n: formatie.midden, y: 47 },
    { lijn: 'verdediging', n: formatie.verdediging, y: 74 },
    { lijn: 'keeper', n: 1, y: 91 },
  ];
  const marge = 17;
  const breedte = 100 - marge * 2;
  const slots = [];
  rijen.forEach(({ lijn, n, y }) => {
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? 50 : marge + (i * breedte) / (n - 1);
      slots.push({ lijn, index: i, x, y });
    }
  });
  return slots;
}

function veldAchtergrondSvg() {
  return `<svg class="veld-svg-achtergrond" viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="194" height="274" class="veld-lijn"/>
    <line x1="3" y1="140" x2="197" y2="140" class="veld-lijn"/>
    <circle cx="100" cy="140" r="26" class="veld-lijn"/>
    <rect x="58" y="3" width="84" height="20" class="veld-lijn"/>
    <rect x="58" y="257" width="84" height="20" class="veld-lijn"/>
  </svg>`;
}

function alleToegewezenIds(kwart) {
  const ids = new Set();
  Object.values(kwart.opstelling).forEach(arr => arr.forEach(id => { if (id) ids.add(id); }));
  return ids;
}

function spelerNaam(id) {
  const p = state.players.find(x => x.id === id);
  return p ? p.naam : '?';
}

function renderVeld() {
  const container = document.getElementById('veldContainer');
  container.innerHTML = veldAchtergrondSvg();

  const kwart = state.kwarten[huidigKwartIndex];
  const formatie = formatieVinden(kwart.formatie);
  const aanwezig = state.players.filter(p => p.aanwezig);
  const toegewezen = alleToegewezenIds(kwart);

  plekCoordinaten(formatie).forEach(slot => {
    const huidigeId = kwart.opstelling[slot.lijn][slot.index];
    const select = document.createElement('select');
    select.className = 'veld-plek ' + (huidigeId ? slot.lijn : 'leeg');
    select.style.left = slot.x + '%';
    select.style.top = slot.y + '%';

    const optieLeeg = document.createElement('option');
    optieLeeg.value = '';
    optieLeeg.textContent = huidigeId ? '— Leeg maken —' : '+ Kies speler';
    select.appendChild(optieLeeg);

    aanwezig.forEach(p => {
      if (toegewezen.has(p.id) && p.id !== huidigeId) return; // elders al ingezet dit kwart
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.naam;
      if (p.id === huidigeId) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener('change', () => {
      kwart.opstelling[slot.lijn][slot.index] = select.value || null;
      opslaan();
      renderAlles();
    });

    container.appendChild(select);
  });
}

function renderBank() {
  const el = document.getElementById('bankLijst');
  el.innerHTML = '';
  const kwart = state.kwarten[huidigKwartIndex];
  const toegewezen = alleToegewezenIds(kwart);
  const bank = state.players.filter(p => p.aanwezig && !toegewezen.has(p.id));
  const isLaatsteKwart = huidigKwartIndex === AANTAL_KWARTEN - 1;

  if (!bank.length) {
    el.innerHTML = '<p class="bank-leeg">Niemand op de bank dit kwart.</p>';
    return;
  }

  bank.forEach(p => {
    const gekozenLijn = kwart.bankKleur[p.id] || null;
    const div = document.createElement('div');
    div.className = 'bank-speler' + (gekozenLijn ? ' bank-lijn-' + gekozenLijn : '');

    const naam = document.createElement('span');
    naam.className = 'bank-speler-naam';
    naam.textContent = p.naam;
    div.appendChild(naam);

    if (!isLaatsteKwart) {
      const chips = document.createElement('div');
      chips.className = 'bank-lijn-chips';
      LIJNEN.forEach(lijn => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'bank-lijn-chip ' + lijn + (gekozenLijn === lijn ? ' actief' : '');
        chip.title = `Volgend kwart: ${LIJN_LABEL[lijn]}`;
        chip.textContent = LIJN_LABEL[lijn][0];
        chip.addEventListener('click', () => {
          if (kwart.bankKleur[p.id] === lijn) delete kwart.bankKleur[p.id];
          else kwart.bankKleur[p.id] = lijn;
          opslaan();
          renderBank();
        });
        chips.appendChild(chip);
      });
      div.appendChild(chips);
    }

    el.appendChild(div);
  });
}

// ---------- Overzicht: minuten, wissels, alle kwarten ----------

function renderMinutenOverzicht() {
  const el = document.getElementById('minutenOverzicht');
  el.innerHTML = '';
  const aanwezig = state.players.filter(p => p.aanwezig);
  if (!aanwezig.length) { el.innerHTML = '<p class="hint">Nog geen aanwezige spelers.</p>'; return; }
  const max = AANTAL_KWARTEN * KWART_DUUR;
  aanwezig.forEach(p => {
    const kwartenGespeeld = state.kwarten.filter(k => alleToegewezenIds(k).has(p.id)).length;
    const minuten = kwartenGespeeld * KWART_DUUR;
    const rij = document.createElement('div');
    rij.className = 'minuten-rij';
    rij.innerHTML = `<span class="minuten-naam">${escapeHtml(p.naam)}</span>
      <span class="minuten-balk-buiten"><span class="minuten-balk-binnen" style="width:${(minuten / max) * 100}%"></span></span>
      <span class="minuten-getal">${minuten}'</span>`;
    el.appendChild(rij);
  });
}

function renderWisselOverzicht() {
  const el = document.getElementById('wisselOverzicht');
  el.innerHTML = '';
  for (let i = 0; i < AANTAL_KWARTEN - 1; i++) {
    const van = alleToegewezenIds(state.kwarten[i]);
    const naar = alleToegewezenIds(state.kwarten[i + 1]);
    const eruit = [...van].filter(id => !naar.has(id));
    const erin = [...naar].filter(id => !van.has(id));

    const kop = document.createElement('div');
    kop.className = 'wisselmoment-kop';
    kop.textContent = `Kwart ${i + 1} → Kwart ${i + 2}`;
    el.appendChild(kop);

    const lijst = document.createElement('ul');
    lijst.className = 'wisselmoment-lijst';
    eruit.forEach(id => {
      const li = document.createElement('li');
      li.className = 'wissel-uit';
      li.textContent = `⬅ ${spelerNaam(id)} eruit`;
      lijst.appendChild(li);
    });
    erin.forEach(id => {
      const li = document.createElement('li');
      li.className = 'wissel-in';
      li.textContent = `➡ ${spelerNaam(id)} erin`;
      lijst.appendChild(li);
    });
    if (!eruit.length && !erin.length) {
      const li = document.createElement('li');
      li.className = 'wissel-geen';
      li.textContent = 'Geen wijzigingen';
      lijst.appendChild(li);
    }
    el.appendChild(lijst);
  }
}

function renderAlleKwartenGrid() {
  const el = document.getElementById('alleKwartenGrid');
  el.innerHTML = '';
  state.kwarten.forEach((kwart, i) => {
    const formatie = formatieVinden(kwart.formatie);
    const kaart = document.createElement('div');
    kaart.className = 'mini-kwart-kaart';

    const start = i * KWART_DUUR;
    const kop = document.createElement('div');
    kop.className = 'mini-kwart-kop';
    kop.textContent = `Kwart ${i + 1} (${start}'-${start + KWART_DUUR}') · ${kwart.formatie}`;
    kaart.appendChild(kop);

    const veld = document.createElement('div');
    veld.className = 'mini-veld';
    plekCoordinaten(formatie).forEach(slot => {
      const id = kwart.opstelling[slot.lijn][slot.index];
      if (!id) return;
      const tok = document.createElement('div');
      tok.className = 'mini-token ' + slot.lijn;
      tok.style.left = slot.x + '%';
      tok.style.top = slot.y + '%';
      tok.textContent = spelerNaam(id);
      veld.appendChild(tok);
    });
    kaart.appendChild(veld);

    const toegewezen = alleToegewezenIds(kwart);
    const bank = state.players.filter(p => p.aanwezig && !toegewezen.has(p.id)).map(p => p.naam);
    const bankEl = document.createElement('div');
    bankEl.className = 'mini-bank';
    bankEl.textContent = 'Bank: ' + (bank.join(', ') || '—');
    kaart.appendChild(bankEl);

    el.appendChild(kaart);
  });
}

// ---------- Overig ----------

document.getElementById('btnPrint').addEventListener('click', () => window.print());

document.getElementById('btnDeelLink').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    const btn = document.getElementById('btnDeelLink');
    const origineel = btn.textContent;
    btn.textContent = '✅ Link gekopieerd!';
    setTimeout(() => { btn.textContent = origineel; }, 2000);
  } catch (e) {
    prompt('Kopieer deze link handmatig:', location.href);
  }
});

document.getElementById('teamNaam').addEventListener('blur', e => {
  state.teamNaam = e.target.textContent.trim() || state.teamNaam;
  opslaan();
});

document.querySelectorAll('.collapse-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.target);
    const collapsed = target.style.display === 'none';
    target.style.display = collapsed ? '' : 'none';
    btn.textContent = collapsed ? '−' : '+';
  });
});

// ---------- Render alles & init ----------

function renderAlles() {
  document.getElementById('teamNaam').textContent = state.teamNaam;
  renderSpelers();
  renderKwartTabs();
  renderFormatieSelect();
  renderVeld();
  renderBank();
  renderMinutenOverzicht();
  renderWisselOverzicht();
  renderAlleKwartenGrid();
}

(async function init() {
  await initOpslag();
  vulVasteKeeperIn();
  renderAlles();
})();
