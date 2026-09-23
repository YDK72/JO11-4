// ---------- Firebase-configuratie ----------
// Leeg = de app werkt volledig lokaal (per toestel apart, in localStorage).
// Vul dit in met je eigen Firebase-project (zie README.md, sectie "Cross-device
// synchronisatie instellen") om dezelfde gegevens op al je toestellen te zien.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCb4aLbRkpzRrZX88zpdb4Oi-FpzCChwuQ",
  authDomain: "opstelling-jo11-4.firebaseapp.com",
  projectId: "opstelling-jo11-4",
  storageBucket: "opstelling-jo11-4.firebasestorage.app",
  messagingSenderId: "173872419685",
  appId: "1:173872419685:web:65fd78e9760a57dfe3c78c",
};

const LIJNEN = ['verdediging', 'midden', 'aanval'];
const ALLE_LIJNEN = ['keeper', 'verdediging', 'midden', 'aanval'];
const LIJN_LABEL = { keeper: 'Keeper', verdediging: 'Verdediging', midden: 'Midden', aanval: 'Aanval' };
const KWART_DUUR = 15; // minuten
const AANTAL_KWARTEN = 4;
const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

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

function vandaag() {
  return new Date().toISOString().slice(0, 10);
}

function formatDatumNL(datumStr) {
  if (!datumStr) return '';
  const [j, m, d] = datumStr.split('-').map(Number);
  if (!j || !m || !d) return datumStr;
  return `${d} ${MAANDEN[m - 1]} ${j}`;
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
  return { id: uid(), naam, keeper: !!keeper };
}

// De vaste keeper vult de keeperspositie automatisch bij een lege opstelling —
// blijft daarna gewoon een los, handmatig aan te passen vakje zoals alle andere.
// Overschrijft nooit een al ingevulde plek, dus veilig om vaker aan te roepen.
function vulVasteKeeperIn(spelersLijst, wedstrijd) {
  const vast = spelersLijst.find(p => p.keeper && wedstrijd.aanwezig[p.id]);
  if (!vast) return;
  wedstrijd.kwarten.forEach(kwart => {
    if (!kwart.opstelling.keeper[0]) kwart.opstelling.keeper[0] = vast.id;
  });
}

function nieuweWedstrijd(naam, datum, spelersLijst, aanwezigBron) {
  const wedstrijd = {
    id: uid(),
    naam,
    datum,
    aanwezig: {},
    kwarten: Array.from({ length: AANTAL_KWARTEN }, () => nieuwKwart(STANDAARD_FORMATIE)),
  };
  spelersLijst.forEach(p => {
    wedstrijd.aanwezig[p.id] = aanwezigBron ? !!aanwezigBron[p.id] : true;
  });
  vulVasteKeeperIn(spelersLijst, wedstrijd);
  return wedstrijd;
}

function standaardState() {
  const players = DEFAULT_SPELERS_NAMEN.map(naam => nieuweSpelerState(naam, naam === 'Nick'));
  const eersteWedstrijd = nieuweWedstrijd('Wedstrijd 1', vandaag(), players);
  return {
    versie: 2,
    teamNaam: "AFC'34 — JO11-4",
    players,
    wedstrijden: [eersteWedstrijd],
    huidigeWedstrijdId: eersteWedstrijd.id,
  };
}

let state = standaardState();

function huidigeWedstrijd() {
  return state.wedstrijden.find(w => w.id === state.huidigeWedstrijdId) || state.wedstrijden[0];
}

function migreerState() {
  if (!Array.isArray(state.players)) state.players = [];
  state.players.forEach(p => {
    if (p.keeper == null) p.keeper = false;
  });

  // Oude versie (v1): één doorlopende opstelling zonder wedstrijdhistorie.
  // Zet die om naar de eerste wedstrijd zodat bestaande gegevens bewaard blijven.
  if (Array.isArray(state.kwarten) && !Array.isArray(state.wedstrijden)) {
    const aanwezigBron = {};
    state.players.forEach(p => { aanwezigBron[p.id] = p.aanwezig !== false; });
    const wedstrijd = {
      id: uid(),
      naam: 'Wedstrijd 1',
      datum: vandaag(),
      aanwezig: aanwezigBron,
      kwarten: state.kwarten,
    };
    state.wedstrijden = [wedstrijd];
    state.huidigeWedstrijdId = wedstrijd.id;
    delete state.kwarten;
  }
  state.players.forEach(p => { delete p.aanwezig; });

  if (!Array.isArray(state.wedstrijden) || !state.wedstrijden.length) {
    const w = nieuweWedstrijd('Wedstrijd 1', vandaag(), state.players);
    state.wedstrijden = [w];
    state.huidigeWedstrijdId = w.id;
  }
  if (!state.wedstrijden.some(w => w.id === state.huidigeWedstrijdId)) {
    state.huidigeWedstrijdId = state.wedstrijden[0].id;
  }
  state.wedstrijden.forEach(w => {
    if (!w.id) w.id = uid();
    if (!w.naam) w.naam = 'Wedstrijd';
    if (!w.datum) w.datum = vandaag();
    if (!w.aanwezig) w.aanwezig = {};
    state.players.forEach(p => { if (w.aanwezig[p.id] == null) w.aanwezig[p.id] = true; });
    if (!Array.isArray(w.kwarten) || w.kwarten.length !== AANTAL_KWARTEN) {
      w.kwarten = Array.from({ length: AANTAL_KWARTEN }, () => nieuwKwart(STANDAARD_FORMATIE));
    }
    w.kwarten.forEach(kwart => {
      if (!kwart.formatie) kwart.formatie = STANDAARD_FORMATIE;
      if (!kwart.opstelling) kwart.opstelling = legeOpstelling(kwart.formatie);
      if (!kwart.bankKleur) kwart.bankKleur = {};
    });
  });
  state.versie = 2;
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

// ---------- Wedstrijd kiezen/aanmaken/verwijderen ----------

function renderWedstrijdKiezer() {
  const wedstrijd = huidigeWedstrijd();

  const select = document.getElementById('wedstrijdSelect');
  select.innerHTML = '';
  state.wedstrijden.forEach(w => {
    const opt = document.createElement('option');
    opt.value = w.id;
    opt.textContent = `${w.naam} — ${formatDatumNL(w.datum)}`;
    if (w.id === wedstrijd.id) opt.selected = true;
    select.appendChild(opt);
  });

  document.getElementById('wedstrijdNaam').value = wedstrijd.naam;
  document.getElementById('wedstrijdDatum').value = wedstrijd.datum;
  document.getElementById('btnVerwijderWedstrijd').disabled = state.wedstrijden.length <= 1;
}

document.getElementById('wedstrijdSelect').addEventListener('change', e => {
  state.huidigeWedstrijdId = e.target.value;
  huidigKwartIndex = 0;
  renderAlles();
});

document.getElementById('wedstrijdNaam').addEventListener('change', e => {
  huidigeWedstrijd().naam = e.target.value.trim() || huidigeWedstrijd().naam;
  opslaan();
  renderWedstrijdKiezer();
});

document.getElementById('wedstrijdDatum').addEventListener('change', e => {
  huidigeWedstrijd().datum = e.target.value || vandaag();
  opslaan();
  renderWedstrijdKiezer();
});

document.getElementById('btnNieuweWedstrijd').addEventListener('click', () => {
  const naam = `Wedstrijd ${state.wedstrijden.length + 1}`;
  const wedstrijd = nieuweWedstrijd(naam, vandaag(), state.players, huidigeWedstrijd().aanwezig);
  state.wedstrijden.push(wedstrijd);
  state.huidigeWedstrijdId = wedstrijd.id;
  huidigKwartIndex = 0;
  opslaan();
  renderAlles();
});

document.getElementById('btnVerwijderWedstrijd').addEventListener('click', () => {
  if (state.wedstrijden.length <= 1) return;
  const wedstrijd = huidigeWedstrijd();
  if (!confirm(`Wedstrijd "${wedstrijd.naam}" (${formatDatumNL(wedstrijd.datum)}) definitief verwijderen? Dit kan niet ongedaan gemaakt worden.`)) return;
  state.wedstrijden = state.wedstrijden.filter(w => w.id !== wedstrijd.id);
  state.huidigeWedstrijdId = state.wedstrijden[0].id;
  huidigKwartIndex = 0;
  opslaan();
  renderAlles();
});

// ---------- Spelers ----------

function renderSpelers() {
  const tbody = document.getElementById('spelersTbody');
  tbody.innerHTML = '';
  const wedstrijd = huidigeWedstrijd();
  state.players.forEach(p => {
    const tr = document.createElement('tr');

    const tdAanwezig = document.createElement('td');
    const cbAanwezig = document.createElement('input');
    cbAanwezig.type = 'checkbox';
    cbAanwezig.checked = !!wedstrijd.aanwezig[p.id];
    cbAanwezig.addEventListener('change', () => {
      wedstrijd.aanwezig[p.id] = cbAanwezig.checked;
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
      state.wedstrijden.forEach(w => {
        delete w.aanwezig[p.id];
        w.kwarten.forEach(kwart => {
          Object.keys(kwart.opstelling).forEach(lijn => {
            kwart.opstelling[lijn] = kwart.opstelling[lijn].map(id => (id === p.id ? null : id));
          });
          delete kwart.bankKleur[p.id];
        });
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
  const nieuwePersoon = nieuweSpelerState(naam, false);
  state.players.push(nieuwePersoon);
  // Alleen in de huidige wedstrijd aanwezig; oudere wedstrijden vonden al plaats zonder hem.
  state.wedstrijden.forEach(w => { w.aanwezig[nieuwePersoon.id] = (w.id === state.huidigeWedstrijdId); });
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
  const wedstrijd = huidigeWedstrijd();
  FORMATIES.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.label;
    opt.textContent = `${f.label} (K-V-M-A)`;
    if (f.label === wedstrijd.kwarten[huidigKwartIndex].formatie) opt.selected = true;
    select.appendChild(opt);
  });
  select.onchange = () => {
    const kwart = wedstrijd.kwarten[huidigKwartIndex];
    const heeftSpelers = Object.values(kwart.opstelling).some(arr => arr.some(Boolean));
    if (heeftSpelers && !confirm('Van formatie wisselen maakt dit kwart leeg. Doorgaan?')) {
      select.value = kwart.formatie;
      return;
    }
    kwart.formatie = select.value;
    kwart.opstelling = legeOpstelling(select.value);
    vulVasteKeeperIn(state.players, wedstrijd);
    opslaan();
    renderAlles();
  };
}

document.getElementById('btnKopieerVorig').addEventListener('click', () => {
  if (huidigKwartIndex === 0) return;
  const wedstrijd = huidigeWedstrijd();
  wedstrijd.kwarten[huidigKwartIndex] = JSON.parse(JSON.stringify(wedstrijd.kwarten[huidigKwartIndex - 1]));
  opslaan();
  renderAlles();
});

document.getElementById('btnLeegKwart').addEventListener('click', () => {
  const kwart = huidigeWedstrijd().kwarten[huidigKwartIndex];
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

function renderVeld() {
  const container = document.getElementById('veldContainer');
  container.innerHTML = veldAchtergrondSvg();

  const wedstrijd = huidigeWedstrijd();
  const kwart = wedstrijd.kwarten[huidigKwartIndex];
  const formatie = formatieVinden(kwart.formatie);
  const aanwezig = state.players.filter(p => wedstrijd.aanwezig[p.id]);
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
  const wedstrijd = huidigeWedstrijd();
  const kwart = wedstrijd.kwarten[huidigKwartIndex];
  const toegewezen = alleToegewezenIds(kwart);
  const bank = state.players.filter(p => wedstrijd.aanwezig[p.id] && !toegewezen.has(p.id));
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

// ---------- Overzicht: minuten & posities, per wedstrijd + totalen ----------

function minutenSpelerInWedstrijd(wedstrijd, playerId) {
  return wedstrijd.kwarten.filter(k => alleToegewezenIds(k).has(playerId)).length * KWART_DUUR;
}

function positieTellingSpelerInWedstrijd(wedstrijd, playerId) {
  const tellingen = { keeper: 0, verdediging: 0, midden: 0, aanval: 0 };
  wedstrijd.kwarten.forEach(kwart => {
    ALLE_LIJNEN.forEach(lijn => {
      if (kwart.opstelling[lijn].includes(playerId)) tellingen[lijn]++;
    });
  });
  return tellingen;
}

function bouwMinutenRij(naam, minuten, max) {
  const rij = document.createElement('div');
  rij.className = 'minuten-rij';
  rij.innerHTML = `<span class="minuten-naam">${escapeHtml(naam)}</span>
    <span class="minuten-balk-buiten"><span class="minuten-balk-binnen" style="width:${max ? (minuten / max) * 100 : 0}%"></span></span>
    <span class="minuten-getal">${minuten}'</span>`;
  return rij;
}

function bouwPositiesTabel(rijen) {
  const table = document.createElement('table');
  table.className = 'posities-tabel';
  table.innerHTML = '<thead><tr><th>Speler</th><th>Keeper</th><th>Verdediging</th><th>Midden</th><th>Aanval</th></tr></thead>';
  const tbody = document.createElement('tbody');
  rijen.forEach(({ naam, tellingen }) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(naam)}</td>
      <td>${tellingen.keeper || ''}</td>
      <td>${tellingen.verdediging || ''}</td>
      <td>${tellingen.midden || ''}</td>
      <td>${tellingen.aanval || ''}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  const wrap = document.createElement('div');
  wrap.className = 'tabel-scroll';
  wrap.appendChild(table);
  return wrap;
}

function renderMinutenHuidig() {
  const el = document.getElementById('minutenHuidig');
  el.innerHTML = '';
  const wedstrijd = huidigeWedstrijd();
  const aanwezig = state.players.filter(p => wedstrijd.aanwezig[p.id]);
  if (!aanwezig.length) { el.innerHTML = '<p class="hint">Nog geen aanwezige spelers.</p>'; return; }
  const max = AANTAL_KWARTEN * KWART_DUUR;
  aanwezig.forEach(p => {
    el.appendChild(bouwMinutenRij(p.naam, minutenSpelerInWedstrijd(wedstrijd, p.id), max));
  });
}

function renderMinutenAlle() {
  const el = document.getElementById('minutenAlle');
  el.innerHTML = '';
  if (!state.wedstrijden.length) return;
  const maxPerWedstrijd = AANTAL_KWARTEN * KWART_DUUR;

  state.wedstrijden.forEach(w => {
    const blok = document.createElement('div');
    blok.className = 'wedstrijd-blok';
    const kop = document.createElement('h4');
    kop.textContent = `${w.naam} — ${formatDatumNL(w.datum)}`;
    blok.appendChild(kop);

    const aanwezig = state.players.filter(p => w.aanwezig[p.id]);
    if (!aanwezig.length) {
      const leeg = document.createElement('p');
      leeg.className = 'hint';
      leeg.textContent = 'Geen aanwezige spelers.';
      blok.appendChild(leeg);
    } else {
      const lijst = document.createElement('div');
      lijst.className = 'minuten-overzicht';
      aanwezig.forEach(p => lijst.appendChild(bouwMinutenRij(p.naam, minutenSpelerInWedstrijd(w, p.id), maxPerWedstrijd)));
      blok.appendChild(lijst);
    }
    el.appendChild(blok);
  });

  const totaalBlok = document.createElement('div');
  totaalBlok.className = 'wedstrijd-blok totaal-blok';
  const totaalKop = document.createElement('h4');
  totaalKop.textContent = `Totaal — alle wedstrijden (${state.wedstrijden.length})`;
  totaalBlok.appendChild(totaalKop);

  const totaalLijst = document.createElement('div');
  totaalLijst.className = 'minuten-overzicht';
  const maxTotaal = state.wedstrijden.length * maxPerWedstrijd;
  state.players.forEach(p => {
    const totaal = state.wedstrijden.reduce((som, w) => som + minutenSpelerInWedstrijd(w, p.id), 0);
    totaalLijst.appendChild(bouwMinutenRij(p.naam, totaal, maxTotaal));
  });
  totaalBlok.appendChild(totaalLijst);
  el.appendChild(totaalBlok);
}

function renderPositiesAlle() {
  const el = document.getElementById('positiesAlle');
  el.innerHTML = '';
  if (!state.wedstrijden.length) return;

  state.wedstrijden.forEach(w => {
    const blok = document.createElement('div');
    blok.className = 'wedstrijd-blok';
    const kop = document.createElement('h4');
    kop.textContent = `${w.naam} — ${formatDatumNL(w.datum)}`;
    blok.appendChild(kop);

    const aanwezig = state.players.filter(p => w.aanwezig[p.id]);
    if (!aanwezig.length) {
      const leeg = document.createElement('p');
      leeg.className = 'hint';
      leeg.textContent = 'Geen aanwezige spelers.';
      blok.appendChild(leeg);
    } else {
      const rijen = aanwezig.map(p => ({ naam: p.naam, tellingen: positieTellingSpelerInWedstrijd(w, p.id) }));
      blok.appendChild(bouwPositiesTabel(rijen));
    }
    el.appendChild(blok);
  });

  const totaalBlok = document.createElement('div');
  totaalBlok.className = 'wedstrijd-blok totaal-blok';
  const totaalKop = document.createElement('h4');
  totaalKop.textContent = `Totaal — alle wedstrijden (${state.wedstrijden.length})`;
  totaalBlok.appendChild(totaalKop);

  const totaalRijen = state.players.map(p => {
    const tellingen = { keeper: 0, verdediging: 0, midden: 0, aanval: 0 };
    state.wedstrijden.forEach(w => {
      const t = positieTellingSpelerInWedstrijd(w, p.id);
      ALLE_LIJNEN.forEach(lijn => { tellingen[lijn] += t[lijn]; });
    });
    return { naam: p.naam, tellingen };
  });
  totaalBlok.appendChild(bouwPositiesTabel(totaalRijen));
  el.appendChild(totaalBlok);
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
  renderWedstrijdKiezer();
  renderSpelers();
  renderKwartTabs();
  renderFormatieSelect();
  renderVeld();
  renderBank();
  renderMinutenHuidig();
  renderMinutenAlle();
  renderPositiesAlle();
}

(async function init() {
  await initOpslag();
  state.wedstrijden.forEach(w => vulVasteKeeperIn(state.players, w));
  renderAlles();
})();
