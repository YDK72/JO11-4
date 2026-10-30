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
const WEDSTRIJD_DUUR = 60; // minuten
const KWART_DUUR = 15; // minuten; referentie-eenheid voor de posities-tellingen
const STANDAARD_INDELING = 4; // 4 kwarten van 15 min; alternatief: 8 blokken van 7,5 min
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

function aantalPeriodes(wedstrijd) {
  return wedstrijd.indeling === 8 ? 8 : 4;
}

function periodeDuur(wedstrijd) {
  return WEDSTRIJD_DUUR / aantalPeriodes(wedstrijd);
}

function periodeWoord(wedstrijd) {
  return aantalPeriodes(wedstrijd) === 8 ? 'blok' : 'kwart';
}

// 7.5 -> "7,5"; 15 -> "15"
function fmtGetal(n) {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

function positiesVan(wedstrijd, id) {
  const p = wedstrijd.posities && wedstrijd.posities[id];
  return { primair: (p && p.primair) || '', secundair: (p && p.secundair) || '' };
}

// Zonder ingestelde posities is een speler flexibel: overal inzetbaar.
function isFlexibel(wedstrijd, id) {
  const { primair, secundair } = positiesVan(wedstrijd, id);
  return !primair && !secundair;
}

function isGeschikt(wedstrijd, id, lijn) {
  if (lijn === 'keeper' || isFlexibel(wedstrijd, id)) return true;
  const { primair, secundair } = positiesVan(wedstrijd, id);
  return lijn === primair || lijn === secundair;
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

function nieuweWedstrijd(naam, datum, spelersLijst, aanwezigBron, indeling = STANDAARD_INDELING, positiesBron = null) {
  const wedstrijd = {
    id: uid(),
    naam,
    datum,
    indeling,
    aanwezig: {},
    // posities[spelerId] = { primair, secundair } met een van de LIJNEN of ''
    posities: positiesBron ? JSON.parse(JSON.stringify(positiesBron)) : {},
    kwarten: Array.from({ length: indeling }, () => nieuwKwart(STANDAARD_FORMATIE)),
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

// Wisselt tussen 4 kwarten en 8 blokken. Van 4 naar 8 wordt elk kwart over twee
// blokken gekopieerd (niets gaat verloren); terug naar 4 blijft blok 1, 3, 5 en 7 over.
function zetIndeling(wedstrijd, nieuw) {
  if (wedstrijd.indeling === nieuw) return;
  if (nieuw === 8) {
    wedstrijd.kwarten = wedstrijd.kwarten.flatMap(k => [k, JSON.parse(JSON.stringify(k))]);
  } else {
    wedstrijd.kwarten = wedstrijd.kwarten.filter((_, i) => i % 2 === 0);
  }
  wedstrijd.indeling = nieuw;
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
    if (w.indeling !== 8) w.indeling = 4;
    if (!w.posities) w.posities = {};
    if (!Array.isArray(w.kwarten) || w.kwarten.length !== w.indeling) {
      w.kwarten = Array.from({ length: w.indeling }, () => nieuwKwart(STANDAARD_FORMATIE));
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
  genereerMelding = null; // handmatige wijziging: de melding over de laatste generatie klopt niet meer
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
  document.getElementById('indelingSelect').value = String(aantalPeriodes(wedstrijd));
  document.getElementById('btnVerwijderWedstrijd').disabled = state.wedstrijden.length <= 1;
}

document.getElementById('indelingSelect').addEventListener('change', e => {
  const wedstrijd = huidigeWedstrijd();
  const nieuw = Number(e.target.value) === 8 ? 8 : 4;
  if (nieuw === 4 && !confirm('Terug naar 4 kwarten van 15 minuten: van de 8 blokken blijven blok 1, 3, 5 en 7 over (als kwart 1 t/m 4). Doorgaan?')) {
    e.target.value = String(aantalPeriodes(wedstrijd));
    return;
  }
  zetIndeling(wedstrijd, nieuw);
  huidigKwartIndex = 0;
  opslaan();
  renderAlles();
});

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
  const bron = huidigeWedstrijd();
  const wedstrijd = nieuweWedstrijd(naam, vandaag(), state.players, bron.aanwezig, aantalPeriodes(bron), bron.posities);
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

    const bouwPositieSelect = veld => {
      const td = document.createElement('td');
      const select = document.createElement('select');
      select.className = 'positie-select';
      select.title = veld === 'primair' ? 'Primaire positie' : 'Secundaire positie';
      [['', '—'], ...LIJNEN.map(l => [l, LIJN_LABEL[l]])].forEach(([waarde, label]) => {
        const opt = document.createElement('option');
        opt.value = waarde;
        opt.textContent = label;
        select.appendChild(opt);
      });
      select.value = positiesVan(wedstrijd, p.id)[veld];
      select.addEventListener('change', () => {
        const nieuw = { ...positiesVan(wedstrijd, p.id), [veld]: select.value };
        if (nieuw.primair && nieuw.primair === nieuw.secundair) {
          if (veld === 'primair') nieuw.secundair = '';
          else nieuw.primair = '';
        }
        wedstrijd.posities[p.id] = nieuw;
        opslaan();
        renderAlles();
      });
      td.appendChild(select);
      return td;
    };
    const tdPrimair = bouwPositieSelect('primair');
    const tdSecundair = bouwPositieSelect('secundair');

    const tdRemove = document.createElement('td');
    const btnRemove = document.createElement('button');
    btnRemove.className = 'remove-btn';
    btnRemove.title = 'Speler verwijderen';
    btnRemove.textContent = '✕';
    btnRemove.addEventListener('click', () => {
      state.players = state.players.filter(x => x.id !== p.id);
      state.wedstrijden.forEach(w => {
        delete w.aanwezig[p.id];
        delete w.posities[p.id];
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

    tr.append(tdAanwezig, tdNaam, tdKeeper, tdPrimair, tdSecundair, tdRemove);
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
  const wedstrijd = huidigeWedstrijd();
  const aantal = aantalPeriodes(wedstrijd);
  const duur = periodeDuur(wedstrijd);
  const woord = periodeWoord(wedstrijd);
  const woordHoofd = woord[0].toUpperCase() + woord.slice(1);
  for (let i = 0; i < aantal; i++) {
    const btn = document.createElement('button');
    const helft2Begin = aantal === 8 && i === aantal / 2;
    btn.className = 'kwart-tab' + (i === huidigKwartIndex ? ' actief' : '') + (helft2Begin ? ' nieuwe-helft' : '');
    btn.title = i < aantal / 2 ? '1e helft' : '2e helft';
    const start = i * duur;
    btn.textContent = `${woordHoofd} ${i + 1} (${fmtGetal(start)}'-${fmtGetal(start + duur)}')`;
    btn.addEventListener('click', () => { huidigKwartIndex = i; renderAlles(); });
    el.appendChild(btn);
  }

  document.getElementById('kwartTitel').textContent = aantal === 8 ? 'Opstelling per blok (7,5 min)' : 'Opstelling per kwart';
  document.getElementById('btnKopieerVorig').textContent = `⬅️ Kopieer vorig ${woord}`;
  document.getElementById('btnLeegKwart').textContent = `🗑️ Maak dit ${woord} leeg`;
  document.getElementById('btnGenereerPeriode').textContent = `➕ Genereer dit ${woord}`;
  document.getElementById('formatieLabelTekst').textContent = `Formatie (dit ${woord})`;
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
    if (heeftSpelers && !confirm(`Van formatie wisselen maakt dit ${periodeWoord(wedstrijd)} leeg. Doorgaan?`)) {
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
  const wedstrijd = huidigeWedstrijd();
  const kwart = wedstrijd.kwarten[huidigKwartIndex];
  const heeftSpelers = Object.values(kwart.opstelling).some(arr => arr.some(Boolean));
  if (heeftSpelers && !confirm(`Dit ${periodeWoord(wedstrijd)} helemaal leegmaken?`)) return;
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

// Breedte (in % van het veld) van een spelersvak, zodat vakken op dezelfde rij niet overlappen.
function vakBreedte(formatie, lijn) {
  const n = lijn === 'keeper' ? 1 : formatie[lijn];
  if (n <= 2) return 34;
  return Math.min(30, Math.floor(0.92 * (66 / (n - 1))));
}

function renderVeld() {
  const container = document.getElementById('veldContainer');
  container.innerHTML = veldAchtergrondSvg();

  const wedstrijd = huidigeWedstrijd();
  const kwart = wedstrijd.kwarten[huidigKwartIndex];
  const formatie = formatieVinden(kwart.formatie);
  const aanwezig = state.players.filter(p => wedstrijd.aanwezig[p.id]);
  const toegewezen = alleToegewezenIds(kwart);
  const afwijkers = [];

  // ★ = primaire, ☆ = secundaire positie voor deze linie.
  const markering = (id, lijn) => {
    const { primair, secundair } = positiesVan(wedstrijd, id);
    if (lijn === 'keeper') return '';
    return lijn === primair ? '★ ' : lijn === secundair ? '☆ ' : '';
  };
  const rang = (id, lijn) => {
    if (lijn === 'keeper') return 0;
    const { primair, secundair } = positiesVan(wedstrijd, id);
    if (lijn === primair) return 0;
    if (lijn === secundair) return 1;
    return isFlexibel(wedstrijd, id) ? 2 : 3;
  };

  plekCoordinaten(formatie).forEach(slot => {
    const huidigeId = kwart.opstelling[slot.lijn][slot.index];
    const select = document.createElement('select');
    const afwijkend = huidigeId && !isGeschikt(wedstrijd, huidigeId, slot.lijn);
    select.className = 'veld-plek ' + (huidigeId ? slot.lijn : 'leeg') + (afwijkend ? ' afwijkend' : '');
    if (afwijkend) {
      select.title = 'Staat buiten zijn primaire en secundaire positie';
      afwijkers.push(`${state.players.find(p => p.id === huidigeId).naam} (${LIJN_LABEL[slot.lijn]})`);
    }
    select.style.left = slot.x + '%';
    select.style.top = slot.y + '%';
    select.style.width = vakBreedte(formatie, slot.lijn) + '%';

    const optieLeeg = document.createElement('option');
    optieLeeg.value = '';
    optieLeeg.textContent = huidigeId ? '— Leeg maken —' : '+ Kies speler';
    select.appendChild(optieLeeg);

    // Spelers waarvoor deze linie primair/secundair is komen bovenaan.
    [...aanwezig].sort((a, b) => rang(a.id, slot.lijn) - rang(b.id, slot.lijn)).forEach(p => {
      if (toegewezen.has(p.id) && p.id !== huidigeId) return; // elders al ingezet dit kwart
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = markering(p.id, slot.lijn) + p.naam;
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

  document.getElementById('positieWaarschuwing').textContent =
    afwijkers.length ? `⚠️ Buiten hun primaire/secundaire positie: ${afwijkers.join(', ')}` : '';
}

function renderBank() {
  const el = document.getElementById('bankLijst');
  el.innerHTML = '';
  const wedstrijd = huidigeWedstrijd();
  const kwart = wedstrijd.kwarten[huidigKwartIndex];
  const toegewezen = alleToegewezenIds(kwart);
  const bank = state.players.filter(p => wedstrijd.aanwezig[p.id] && !toegewezen.has(p.id));
  const isLaatsteKwart = huidigKwartIndex === aantalPeriodes(wedstrijd) - 1;
  const woord = periodeWoord(wedstrijd);

  if (!bank.length) {
    el.innerHTML = `<p class="bank-leeg">Niemand op de bank dit ${woord}.</p>`;
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
        chip.title = `Volgend ${woord}: ${LIJN_LABEL[lijn]}`;
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
  return wedstrijd.kwarten.filter(k => alleToegewezenIds(k).has(playerId)).length * periodeDuur(wedstrijd);
}

// Tellingen in kwarten van 15 min: een blok van 7,5 min telt als 0,5, zodat
// wedstrijden met verschillende indeling samen opgeteld kunnen worden.
function positieTellingSpelerInWedstrijd(wedstrijd, playerId) {
  const gewicht = periodeDuur(wedstrijd) / KWART_DUUR;
  const tellingen = { keeper: 0, verdediging: 0, midden: 0, aanval: 0, bank: 0 };
  wedstrijd.kwarten.forEach(kwart => {
    if (alleToegewezenIds(kwart).has(playerId)) {
      ALLE_LIJNEN.forEach(lijn => {
        if (kwart.opstelling[lijn].includes(playerId)) tellingen[lijn] += gewicht;
      });
    } else if (wedstrijd.aanwezig[playerId]) {
      tellingen.bank += gewicht;
    }
  });
  return tellingen;
}

function bouwMinutenRij(naam, minuten, max) {
  const rij = document.createElement('div');
  rij.className = 'minuten-rij';
  rij.innerHTML = `<span class="minuten-naam">${escapeHtml(naam)}</span>
    <span class="minuten-balk-buiten"><span class="minuten-balk-binnen" style="width:${max ? (minuten / max) * 100 : 0}%"></span></span>
    <span class="minuten-getal">${fmtGetal(minuten)}'</span>`;
  return rij;
}

function bouwPositiesTabel(rijen) {
  const table = document.createElement('table');
  table.className = 'posities-tabel';
  table.innerHTML = '<thead><tr><th>Speler</th><th>Keeper</th><th>Verdediging</th><th>Midden</th><th>Aanval</th><th>Bank</th></tr></thead>';
  const tbody = document.createElement('tbody');
  rijen.forEach(({ naam, tellingen }) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(naam)}</td>
      <td>${tellingen.keeper ? fmtGetal(tellingen.keeper) : ''}</td>
      <td>${tellingen.verdediging ? fmtGetal(tellingen.verdediging) : ''}</td>
      <td>${tellingen.midden ? fmtGetal(tellingen.midden) : ''}</td>
      <td>${tellingen.aanval ? fmtGetal(tellingen.aanval) : ''}</td>
      <td>${tellingen.bank ? fmtGetal(tellingen.bank) : ''}</td>`;
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
  const max = WEDSTRIJD_DUUR;
  aanwezig.forEach(p => {
    el.appendChild(bouwMinutenRij(p.naam, minutenSpelerInWedstrijd(wedstrijd, p.id), max));
  });
}

function renderMinutenAlle() {
  const el = document.getElementById('minutenAlle');
  el.innerHTML = '';
  if (!state.wedstrijden.length) return;
  const maxPerWedstrijd = WEDSTRIJD_DUUR;

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

  const totaalBlok = document.createElement('div');
  totaalBlok.className = 'wedstrijd-blok totaal-blok';
  const totaalKop = document.createElement('h4');
  totaalKop.textContent = `Totaal — alle wedstrijden (${state.wedstrijden.length})`;
  totaalBlok.appendChild(totaalKop);

  if (state.wedstrijden.some(w => aantalPeriodes(w) === 8)) {
    const uitleg = document.createElement('p');
    uitleg.className = 'hint';
    uitleg.textContent = 'Aantallen in kwarten van 15 minuten; een blok van 7,5 minuten telt als 0,5.';
    totaalBlok.appendChild(uitleg);
  }

  const totaalRijen = state.players.map(p => {
    const tellingen = { keeper: 0, verdediging: 0, midden: 0, aanval: 0, bank: 0 };
    state.wedstrijden.forEach(w => {
      const t = positieTellingSpelerInWedstrijd(w, p.id);
      ALLE_LIJNEN.concat('bank').forEach(lijn => { tellingen[lijn] += t[lijn]; });
    });
    return { naam: p.naam, tellingen };
  });
  totaalBlok.appendChild(bouwPositiesTabel(totaalRijen));
  el.appendChild(totaalBlok);
}

// ---------- Opstelling genereren ----------

let genereerMelding = null; // { wedstrijdId, tekst }

// Afwegingen van de generator (lagere kosten = beter):
const EERLIJKHEID_GEWICHT = 15; // per extra gespeeld kwart/blok ten opzichte van de rest
const KOST_BUITEN_POSITIE = 20; // zwaarder dan 1 kwart verschil (15), lichter dan 2 kwarten verschil (30)
const KOST_SECUNDAIR = 1;
const KOST_FLEXIBEL = 0.5;
const KOST_ANDERE_LINIE = 0.2; // kleine voorkeur om op dezelfde linie te blijven
const SEC_BONUS = 4;           // voordeel voor een nog benodigde secundaire periode (netto -3 t.o.v. primair)
const AFMAKEN_BONUS = 10;      // doorspelen om een begonnen secundaire periode vol te maken (lager dan 1 kwart verschil = 15)
const KOST_SECUNDAIR_TUSSENDOOR = 3; // een secundaire plek beginnen buiten de rustmomenten (8 blokken)

function schud(lijst) {
  const kopie = [...lijst];
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
  }
  return kopie;
}

function combinaties(lijst, k) {
  if (k === 0) return [[]];
  if (lijst.length < k) return [];
  const [eerste, ...rest] = lijst;
  return [
    ...combinaties(rest, k - 1).map(c => [eerste, ...c]),
    ...combinaties(rest, k),
  ];
}

function spelerNaam(id) {
  const p = state.players.find(x => x.id === id);
  return p ? p.naam : '?';
}

function lijnVan(kwart, id) {
  return ALLE_LIJNEN.find(lijn => kwart.opstelling[lijn].includes(id)) || null;
}

function plaatsingsKost(wedstrijd, id, lijn) {
  if (lijn === 'keeper') return 2;
  if (isFlexibel(wedstrijd, id)) return KOST_FLEXIBEL;
  const { primair, secundair } = positiesVan(wedstrijd, id);
  if (lijn === primair) return 0;
  if (lijn === secundair) return KOST_SECUNDAIR;
  return KOST_BUITEN_POSITIE;
}

// Wijst spelers aan verschillende plekken toe met de laagste totale kosten.
// Optioneel: `bonus(speler, plek)` geeft aan dat die plaatsing een nog benodigde secundaire
// periode oplevert; daarvan krijgen er maximaal `cap` per keer de bonus SEC_BONUS.
function minimaleToewijzing(spelers, slots, kost, bonus = null, cap = 0) {
  let dp = new Map([['0:0', { kost: 0, pad: [] }]]);
  spelers.forEach(sp => {
    const volgende = new Map();
    const zet = (mask, teller, k, pad) => {
      const sleutel = `${mask}:${teller}`;
      const bestaand = volgende.get(sleutel);
      if (!bestaand || k < bestaand.kost) volgende.set(sleutel, { kost: k, pad });
    };
    dp.forEach((toestand, sleutel) => {
      const [maskTekst, tellerTekst] = sleutel.split(':');
      const mask = Number(maskTekst);
      const teller = Number(tellerTekst);
      for (let j = 0; j < slots.length; j++) {
        if (mask & (1 << j)) continue;
        const basis = toestand.kost + kost(sp, slots[j]);
        const pad = [...toestand.pad, j];
        zet(mask | (1 << j), teller, basis, pad);
        if (bonus && teller < cap && bonus(sp, slots[j])) zet(mask | (1 << j), teller + 1, basis - SEC_BONUS, pad);
      }
    });
    dp = volgende;
  });
  let beste = null;
  dp.forEach(t => { if (!beste || t.kost < beste.kost) beste = t; });
  return beste;
}

// Minuten die een speler (in deze wedstrijd, tot kwart/blok `tot`) op zijn secundaire positie speelde.
function secundaireMinuten(wedstrijd, id, tot = wedstrijd.kwarten.length) {
  const { primair, secundair } = positiesVan(wedstrijd, id);
  if (!primair || !secundair) return 0;
  let minuten = 0;
  for (let k = 0; k < tot; k++) {
    if (lijnVan(wedstrijd.kwarten[k], id) === secundair) minuten += periodeDuur(wedstrijd);
  }
  return minuten;
}

// Spelers met een primaire én secundaire positie doen mee aan "minstens één keer secundair".
function heeftSecundaireBehoefte(wedstrijd, id, tot = wedstrijd.kwarten.length) {
  const { primair, secundair } = positiesVan(wedstrijd, id);
  return !!primair && !!secundair && secundaireMinuten(wedstrijd, id, tot) < KWART_DUUR;
}

function maakGenereerContext(wedstrijd) {
  const aanwezig = state.players.filter(p => wedstrijd.aanwezig[p.id]);
  const vast = aanwezig.find(p => p.keeper) || null;
  const andere = state.wedstrijden.filter(w => w.id !== wedstrijd.id);
  const eerderFractie = {}; // aandeel van de eerdere wedstrijdtijd dat de speler speelde (0..1)
  const lijnTelling = {};   // eerder gespeelde kwarten per linie
  aanwezig.forEach(p => {
    const minuten = andere.reduce((som, w) => som + minutenSpelerInWedstrijd(w, p.id), 0);
    eerderFractie[p.id] = minuten / (WEDSTRIJD_DUUR * Math.max(1, andere.length));
    const t = { keeper: 0, verdediging: 0, midden: 0, aanval: 0 };
    andere.forEach(w => {
      const x = positieTellingSpelerInWedstrijd(w, p.id);
      ALLE_LIJNEN.forEach(lijn => { t[lijn] += x[lijn]; });
    });
    lijnTelling[p.id] = t;
  });
  // Willekeurige volgorde bij gelijke stand, zodat opnieuw genereren een andere variant geeft.
  const pool = schud(aanwezig.filter(p => p !== vast));
  return { aanwezig, vast, pool, eerderFractie, lijnTelling };
}

// Vult één kwart/blok in op basis van wat er in de eerdere kwarten/blokken staat:
// - de vaste keeper blijft in de goal;
// - wie het meest gespeeld heeft gaat naar de bank (eerlijke speeltijd gaat voor);
// - posities: primair, dan secundair; buiten die posities alleen als het echt niet anders kan;
// - bij 8 blokken blijven de posities staan op 7,5, 22,5, 37,5 en 52,5 minuten (alleen wissels
//   van/naar de bank); positiewissels kunnen dan alleen op 15, 30 en 45 minuten.
function planPeriode(wedstrijd, i, ctx) {
  const { vast, pool } = ctx;
  const kwart = wedstrijd.kwarten[i];
  const gewicht = periodeDuur(wedstrijd) / KWART_DUUR;
  const sleutel = s => `${s.lijn}:${s.index}`;
  const slots = plekCoordinaten(formatieVinden(kwart.formatie)).filter(s => !vast || s.lijn !== 'keeper');
  const slotPerSleutel = new Map(slots.map(s => [sleutel(s), s]));
  const n = pool.length;

  const gespeeld = {};
  const lijnTelling = {};
  pool.forEach(p => { gespeeld[p.id] = 0; lijnTelling[p.id] = { ...ctx.lijnTelling[p.id] }; });
  for (let k = 0; k < i; k++) {
    ALLE_LIJNEN.forEach(lijn => wedstrijd.kwarten[k].opstelling[lijn].forEach(id => {
      if (id && lijnTelling[id]) lijnTelling[id][lijn] += gewicht;
    }));
    const ids = alleToegewezenIds(wedstrijd.kwarten[k]);
    pool.forEach(p => { if (ids.has(p.id)) gespeeld[p.id]++; });
  }

  const vorigeSlot = {};
  if (i > 0) {
    ALLE_LIJNEN.forEach(lijn => wedstrijd.kwarten[i - 1].opstelling[lijn].forEach((id, index) => {
      if (id && lijnTelling[id]) vorigeSlot[id] = `${lijn}:${index}`;
    }));
  }
  const heeftVorige = Object.keys(vorigeSlot).length > 0;
  const vergrendeld = heeftVorige && aantalPeriodes(wedstrijd) === 8 && i % 2 === 1;

  const prioriteit = {};
  pool.forEach(p => { prioriteit[p.id] = gespeeld[p.id] + 0.5 * ctx.eerderFractie[p.id]; });

  // Wie moet nog minstens 15 minuten secundair spelen? Per rustmoment wordt hooguit een
  // evenredig deel daarvan ingepland, zodat het over de wedstrijd verspreid wordt.
  const aantalP = aantalPeriodes(wedstrijd);
  let momenten = 0;
  for (let k = i; k < aantalP; k++) if (aantalP !== 8 || k % 2 === 0) momenten++;
  const behoeftIds = new Set(pool.filter(p => heeftSecundaireBehoefte(wedstrijd, p.id, i)).map(p => p.id));
  const cap = vergrendeld ? 0 : Math.ceil(behoeftIds.size / Math.max(1, momenten));
  const bonus = (sp, slot) => behoeftIds.has(sp.id) && slot.lijn === positiesVan(wedstrijd, sp.id).secundair;
  // Wie in het vorige blok net op zijn secundaire positie begon (bij 8 blokken: 7,5 minuten) en
  // nog geen 15 minuten heeft, speelt liefst door om die periode vol te maken.
  const afmaken = new Set(pool.filter(p => {
    const x = positiesVan(wedstrijd, p.id);
    return i > 0 && behoeftIds.has(p.id) && x.primair && lijnVan(wedstrijd.kwarten[i - 1], p.id) === x.secundair;
  }).map(p => p.id));

  const kost = (sp, slot) => {
    let k = plaatsingsKost(wedstrijd, sp.id, slot.lijn);
    const x = positiesVan(wedstrijd, sp.id);
    if (vergrendeld && x.primair && slot.lijn === x.secundair) k += KOST_SECUNDAIR_TUSSENDOOR;
    const vorige = vorigeSlot[sp.id];
    if (vorige && vorige.split(':')[0] !== slot.lijn) k += KOST_ANDERE_LINIE;
    return k + 0.02 * lijnTelling[sp.id][slot.lijn] + Math.random() * 0.001;
  };

  const evalueer = speelt => {
    const toegewezen = {};
    const bezet = new Set();
    const rest = [];
    let totaal = 0;
    speelt.forEach(sp => {
      const vorige = vergrendeld ? vorigeSlot[sp.id] : null;
      if (vorige && slotPerSleutel.has(vorige)) {
        bezet.add(vorige);
        toegewezen[vorige] = sp;
        totaal += kost(sp, slotPerSleutel.get(vorige));
      } else {
        rest.push(sp);
      }
    });
    const vrij = slots.filter(s => !bezet.has(sleutel(s)));
    const res = minimaleToewijzing(rest, vrij, kost, vergrendeld ? null : bonus, cap);
    if (!res) return null;
    rest.forEach((sp, k) => { toegewezen[sleutel(vrij[res.pad[k]])] = sp; });
    return { kost: totaal + res.kost, toegewezen };
  };

  const b = Math.max(0, n - slots.length);
  const kandidaten = [...pool].sort((a, c) => prioriteit[c.id] - prioriteit[a.id]).slice(0, Math.min(n, b + 4));
  let beste = null;
  combinaties(kandidaten, b).forEach(bank => {
    const bankIds = new Set(bank.map(p => p.id));
    const speelt = pool.filter(p => !bankIds.has(p.id));
    const ev = evalueer(speelt);
    if (!ev) return;
    const score = ev.kost + EERLIJKHEID_GEWICHT * speelt.reduce((som, p) => som + prioriteit[p.id], 0)
      - AFMAKEN_BONUS * speelt.filter(p => afmaken.has(p.id)).length;
    if (!beste || score < beste.score) beste = { score, toegewezen: ev.toegewezen };
  });

  kwart.opstelling = legeOpstelling(kwart.formatie);
  kwart.bankKleur = {};
  if (vast) kwart.opstelling.keeper[0] = vast.id;
  Object.entries(beste.toegewezen).forEach(([sl, sp]) => {
    const [lijn, index] = sl.split(':');
    kwart.opstelling[lijn][Number(index)] = sp.id;
  });
  return { vergrendeld };
}

// Bankspelers krijgen de kleur van de linie waar ze in het volgende kwart/blok staan.
function werkBankKleurBij(wedstrijd, p) {
  const kwart = wedstrijd.kwarten[p];
  const volgende = wedstrijd.kwarten[p + 1];
  if (!volgende) return;
  const straks = alleToegewezenIds(volgende);
  if (!straks.size) return;
  const nu = alleToegewezenIds(kwart);
  kwart.bankKleur = {};
  state.players.forEach(pl => {
    if (!wedstrijd.aanwezig[pl.id] || nu.has(pl.id) || !straks.has(pl.id)) return;
    const lijn = LIJNEN.find(l => volgende.opstelling[l].includes(pl.id));
    if (lijn) kwart.bankKleur[pl.id] = lijn;
  });
}

// "Secundair: 9 van 11 spelers ..." na het genereren van de hele wedstrijd.
function secundairSamenvatting(wedstrijd, pool) {
  const doen = pool.filter(sp => positiesVan(wedstrijd, sp.id).primair && positiesVan(wedstrijd, sp.id).secundair);
  if (!doen.length) return '';
  const ontbreekt = doen.filter(sp => secundaireMinuten(wedstrijd, sp.id) < KWART_DUUR);
  if (!ontbreekt.length) return `Alle ${doen.length} spelers met een secundaire positie spelen die minstens één keer (15 min).`;
  return `${doen.length - ontbreekt.length} van ${doen.length} spelers spelen minstens één keer (15 min) secundair; nog niet: ${ontbreekt.map(sp => sp.naam).join(', ')}.`;
}

function afwijkingenIn(wedstrijd, kwarten) {
  const namen = new Set();
  kwarten.forEach(kwart => LIJNEN.forEach(lijn => kwart.opstelling[lijn].forEach(id => {
    if (id && !isGeschikt(wedstrijd, id, lijn)) namen.add(spelerNaam(id));
  })));
  return [...namen];
}

// Beoordeelt een complete wedstrijdindeling (lager = beter): eerst eerlijke speeltijd,
// dan zo min mogelijk spelers buiten hun posities, dan zo min mogelijk secundaire plaatsingen.
function scoreWedstrijd(wedstrijd, ctx) {
  const n = ctx.pool.length;
  if (!n) return 0;
  const gespeeld = ctx.pool.map(sp => wedstrijd.kwarten.filter(k => alleToegewezenIds(k).has(sp.id)).length);
  const totaal = gespeeld.reduce((som, g) => som + g, 0);
  const ideaal = totaal % n === 0 ? 0 : 1;
  const spreiding = Math.max(...gespeeld) - Math.min(...gespeeld);
  let afwijkend = 0;
  wedstrijd.kwarten.forEach(kwart => LIJNEN.forEach(lijn => kwart.opstelling[lijn].forEach(id => {
    if (id && !isGeschikt(wedstrijd, id, lijn)) afwijkend++;
  })));
  // Iedereen met primair én secundair moet minstens 15 minuten secundair spelen; meer dan dat is minder gewenst.
  let ontbreekt = 0;
  let teveel = 0;
  ctx.pool.forEach(sp => {
    const { primair, secundair } = positiesVan(wedstrijd, sp.id);
    if (!primair || !secundair) return;
    const kwartjes = secundaireMinuten(wedstrijd, sp.id) / KWART_DUUR;
    if (kwartjes < 1) ontbreekt++;
    else teveel += kwartjes - 1;
  });
  return 100 * Math.max(0, spreiding - ideaal) + 20 * afwijkend + 25 * ontbreekt + teveel;
}

// De indeling gebeurt kwart voor kwart; omdat dat niet vooruitkijkt probeert deze functie
// meerdere varianten en bewaart de beste.
function genereerOpstelling(wedstrijd) {
  const ctx = maakGenereerContext(wedstrijd);
  let besteJson = null;
  let besteScore = Infinity;
  const start = performance.now();
  for (let poging = 0; poging < 60 && (poging < 10 || performance.now() - start < 400); poging++) {
    ctx.pool = schud(ctx.pool);
    wedstrijd.kwarten.forEach((_, i) => planPeriode(wedstrijd, i, ctx));
    const score = scoreWedstrijd(wedstrijd, ctx);
    if (score < besteScore) {
      besteScore = score;
      besteJson = JSON.stringify(wedstrijd.kwarten);
    }
    if (score === 0) break;
  }
  wedstrijd.kwarten = JSON.parse(besteJson);
  wedstrijd.kwarten.forEach((_, p) => werkBankKleurBij(wedstrijd, p));

  const { pool, vast, aanwezig } = ctx;
  const delen = [];
  if (!pool.length) {
    delen.push('Geen veldspelers aanwezig.');
  } else {
    const gespeeld = pool.map(sp => wedstrijd.kwarten.filter(k => alleToegewezenIds(k).has(sp.id)).length * periodeDuur(wedstrijd));
    const min = Math.min(...gespeeld);
    const max = Math.max(...gespeeld);
    delen.push(`Opstelling gegenereerd: elke veldspeler speelt ${min === max ? fmtGetal(min) : `${fmtGetal(min)}–${fmtGetal(max)}`} minuten.`);
  }
  if (vast) delen.push(`${vast.naam} staat steeds in de goal.`);
  const afwijkers = afwijkingenIn(wedstrijd, wedstrijd.kwarten);
  if (afwijkers.length) delen.push(`Let op: ${afwijkers.join(', ')} ${afwijkers.length === 1 ? 'staat' : 'staan'} soms buiten de primaire/secundaire positie (anders was eerlijke speeltijd niet haalbaar).`);
  const secMelding = secundairSamenvatting(wedstrijd, pool);
  if (secMelding) delen.push(secMelding);
  if (aanwezig.length < 8) delen.push('Let op: minder dan 8 spelers, dus niet alle plekken zijn gevuld.');
  return delen.join(' ');
}

function genereerPeriode(wedstrijd, i) {
  const ctx = maakGenereerContext(wedstrijd);
  const woord = periodeWoord(wedstrijd);
  const woordHoofd = woord[0].toUpperCase() + woord.slice(1);
  const meervoud = aantalPeriodes(wedstrijd) === 8 ? 'blokken' : 'kwarten';
  const { vergrendeld } = planPeriode(wedstrijd, i, ctx);
  if (i > 0) werkBankKleurBij(wedstrijd, i - 1);
  werkBankKleurBij(wedstrijd, i);

  const kwart = wedstrijd.kwarten[i];
  const vorige = i > 0 ? wedstrijd.kwarten[i - 1] : null;
  const nu = alleToegewezenIds(kwart);
  const toen = vorige ? alleToegewezenIds(vorige) : new Set();
  const heeftVorige = ctx.pool.some(p => toen.has(p.id));
  const delen = [`${woordHoofd} ${i + 1} gegenereerd.`];

  const bank = ctx.pool.filter(p => !nu.has(p.id)).map(p => p.naam);
  if (bank.length) delen.push(`Bank: ${bank.join(', ')}.`);
  if (heeftVorige) {
    const erin = ctx.pool.filter(p => nu.has(p.id) && !toen.has(p.id))
      .map(p => `${p.naam} (${LIJN_LABEL[lijnVan(kwart, p.id)]})`);
    const eruit = ctx.pool.filter(p => toen.has(p.id) && !nu.has(p.id)).map(p => p.naam);
    const andere = ctx.pool.filter(p => nu.has(p.id) && toen.has(p.id) && lijnVan(kwart, p.id) !== lijnVan(vorige, p.id))
      .map(p => `${p.naam} (${LIJN_LABEL[lijnVan(vorige, p.id)]} → ${LIJN_LABEL[lijnVan(kwart, p.id)]})`);
    if (eruit.length) delen.push(`Eruit: ${eruit.join(', ')}.`);
    if (erin.length) delen.push(`Erin: ${erin.join(', ')}.`);
    if (andere.length) delen.push(`Andere positie: ${andere.join(', ')}.`);
    if (vergrendeld) delen.push('Posities blijven staan; positiewissels kunnen op 15, 30 en 45 minuten.');
  }
  const opSecundair = ctx.pool
    .filter(p => nu.has(p.id) && positiesVan(wedstrijd, p.id).primair && lijnVan(kwart, p.id) === positiesVan(wedstrijd, p.id).secundair)
    .map(p => `${p.naam} (${LIJN_LABEL[lijnVan(kwart, p.id)]})`);
  if (opSecundair.length) delen.push(`Op secundaire positie: ${opSecundair.join(', ')}.`);
  const nogNiet = ctx.pool.filter(p => heeftSecundaireBehoefte(wedstrijd, p.id, i + 1)).map(p => p.naam);
  if (nogNiet.length) delen.push(`Nog niet secundair gespeeld: ${nogNiet.join(', ')}.`);
  const afwijkers = afwijkingenIn(wedstrijd, [kwart]);
  if (afwijkers.length) delen.push(`Let op: ${afwijkers.join(', ')} ${afwijkers.length === 1 ? 'staat' : 'staan'} buiten de primaire/secundaire positie.`);
  const eerdereLeeg = wedstrijd.kwarten.slice(0, i).some(k => !alleToegewezenIds(k).size);
  if (eerdereLeeg) delen.push(`Let op: eerdere ${meervoud} zijn leeg, dus de speeltijd tot nu toe is niet meegerekend.`);
  return delen.join(' ');
}

document.getElementById('btnGenereer').addEventListener('click', () => {
  const wedstrijd = huidigeWedstrijd();
  if (!state.players.some(p => wedstrijd.aanwezig[p.id])) {
    genereerMelding = { wedstrijdId: wedstrijd.id, tekst: 'Vink eerst de aanwezige spelers aan.' };
    renderGenereerMelding();
    return;
  }
  const heeftOpstelling = wedstrijd.kwarten.some(k =>
    LIJNEN.some(lijn => k.opstelling[lijn].some(Boolean)));
  if (heeftOpstelling && !confirm(`Dit overschrijft de opstelling van alle ${aantalPeriodes(wedstrijd)} ${aantalPeriodes(wedstrijd) === 8 ? 'blokken' : 'kwarten'} van deze wedstrijd. Je kunt daarna alles nog zelf aanpassen. Doorgaan?`)) return;
  const tekst = genereerOpstelling(wedstrijd);
  huidigKwartIndex = 0;
  opslaan();
  genereerMelding = { wedstrijdId: wedstrijd.id, tekst };
  renderAlles();
});

document.getElementById('btnGenereerPeriode').addEventListener('click', () => {
  const wedstrijd = huidigeWedstrijd();
  if (!state.players.some(p => wedstrijd.aanwezig[p.id])) {
    genereerMelding = { wedstrijdId: wedstrijd.id, tekst: 'Vink eerst de aanwezige spelers aan.' };
    renderGenereerMelding();
    return;
  }
  const kwart = wedstrijd.kwarten[huidigKwartIndex];
  const heeftOpstelling = LIJNEN.some(lijn => kwart.opstelling[lijn].some(Boolean));
  if (heeftOpstelling && !confirm(`Dit ${periodeWoord(wedstrijd)} opnieuw genereren? De huidige invulling wordt overschreven.`)) return;
  const tekst = genereerPeriode(wedstrijd, huidigKwartIndex);
  opslaan();
  genereerMelding = { wedstrijdId: wedstrijd.id, tekst };
  renderAlles();
});

function renderGenereerMelding() {
  const el = document.getElementById('genereerMelding');
  el.textContent = genereerMelding && genereerMelding.wedstrijdId === huidigeWedstrijd().id ? genereerMelding.tekst : '';
}

// ---------- Haalbaarheidscontrole ----------

// Controleert vooraf of eerlijke speeltijd haalbaar is met de ingestelde posities (formatie van
// kwart/blok 1). Een lijn (of combinatie van lijnen) heeft te weinig geschikte spelers, of juist
// te veel spelers die alleen daar kunnen spelen.
function analyseHaalbaarheid(wedstrijd) {
  const aanwezig = state.players.filter(p => wedstrijd.aanwezig[p.id]);
  const vast = aanwezig.find(p => p.keeper) || null;
  const pool = aanwezig.filter(p => p !== vast);
  const f = formatieVinden(wedstrijd.kwarten[0].formatie);
  const periodes = aantalPeriodes(wedstrijd);
  const meervoud = periodes === 8 ? 'blokken' : 'kwarten';
  const plekken = { verdediging: f.verdediging, midden: f.midden, aanval: f.aanval, keeper: 1 };
  const lijnen = LIJNEN.concat(vast ? [] : ['keeper']);
  const totaal = lijnen.reduce((som, l) => som + plekken[l], 0);
  const n = pool.length;

  const regels = LIJNEN.map(lijn => ({
    lijn,
    plekken: plekken[lijn],
    primair: pool.filter(p => positiesVan(wedstrijd, p.id).primair === lijn).length,
    secundair: pool.filter(p => positiesVan(wedstrijd, p.id).secundair === lijn).length,
    flexibel: pool.filter(p => isFlexibel(wedstrijd, p.id)).length,
    geschikt: pool.filter(p => isGeschikt(wedstrijd, p.id, lijn)).length,
  }));
  if (!n) return { regels, problemen: [], doel: '', formatie: f.label, leeg: true };

  const capHoog = Math.min(periodes, Math.ceil((totaal * periodes) / n));
  const capLaag = n >= totaal ? Math.floor((totaal * periodes) / n) : periodes;
  const label = T => T.map(l => LIJN_LABEL[l]).join(' + ');

  const problemen = [];
  const gemeldBoven = [];
  const gemeldOnder = [];
  const deelverzamelingen = [];
  for (let mask = 1; mask < (1 << lijnen.length); mask++) {
    deelverzamelingen.push(lijnen.filter((_, k) => mask & (1 << k)));
  }
  deelverzamelingen.sort((a, b) => a.length - b.length);

  deelverzamelingen.forEach(T => {
    const plekkenT = T.reduce((som, l) => som + plekken[l], 0);
    const vraag = plekkenT * periodes;
    const geschikt = pool.filter(p => T.some(l => isGeschikt(wedstrijd, p.id, l))).length;
    if (!gemeldBoven.some(g => g.every(l => T.includes(l))) && geschikt * capHoog < vraag) {
      gemeldBoven.push(T);
      problemen.push(`Te weinig geschikte spelers voor ${label(T)}: ${geschikt} geschikt voor ${plekkenT} plek${plekkenT === 1 ? '' : 'ken'} per ${periodeWoord(wedstrijd)}, dus ${n > totaal ? 'zij spelen vaker dan de rest, of er moet' : 'er moet'} iemand buiten zijn posities staan.`);
    }
    const alleen = pool.filter(p => lijnen.every(l => !T.includes(l) ? !isGeschikt(wedstrijd, p.id, l) : true)).length;
    if (!gemeldOnder.some(g => g.every(l => T.includes(l))) && T.length < lijnen.length && alleen * capLaag > vraag) {
      gemeldOnder.push(T);
      problemen.push(`Te veel spelers die alleen ${label(T)} kunnen spelen: ${alleen} spelers voor ${plekkenT} plek${plekkenT === 1 ? '' : 'ken'} per ${periodeWoord(wedstrijd)}. Zij zitten vaker op de bank dan de rest, of er moet iemand buiten zijn posities staan.`);
    }
  });

  const laag = n > totaal ? Math.floor((totaal * periodes) / n) : periodes;
  const hoog = n > totaal ? Math.ceil((totaal * periodes) / n) : periodes;
  const duur = periodeDuur(wedstrijd);
  const doel = laag === hoog
    ? `Eerlijke verdeling: elke veldspeler speelt ${laag} van de ${periodes} ${meervoud} (${fmtGetal(laag * duur)} minuten).`
    : `Eerlijke verdeling: elke veldspeler speelt ${laag} of ${hoog} van de ${periodes} ${meervoud} (${fmtGetal(laag * duur)}–${fmtGetal(hoog * duur)} minuten).`;
  return { regels, problemen, doel, formatie: f.label, leeg: false };
}

// Controleert of de primaire en secundaire posities samen een "sluitende lijst" vormen:
// - de primaire posities zijn ongeveer verdeeld naar het aantal plekken per linie (met reserves);
// - per linie komen er ongeveer evenveel spelers secundair binnen als er primaire spelers van
//   die linie secundair weggaan, zodat iedereen minstens één keer secundair kan spelen
//   zonder dat een linie leegloopt of overvol raakt.
function analyseSluitend(wedstrijd) {
  const aanwezig = state.players.filter(p => wedstrijd.aanwezig[p.id]);
  const vast = aanwezig.find(p => p.keeper) || null;
  const pool = aanwezig.filter(p => p !== vast);
  const f = formatieVinden(wedstrijd.kwarten[0].formatie);
  const plekken = { verdediging: f.verdediging, midden: f.midden, aanval: f.aanval };
  const totaal = LIJNEN.reduce((som, l) => som + plekken[l], 0);
  const n = pool.length;

  // Ideale verdeling van de primaire posities (grootste-restmethode).
  const ideaal = {};
  const resten = [];
  let verdeeld = 0;
  LIJNEN.forEach(lijn => {
    const exact = (n * plekken[lijn]) / totaal;
    ideaal[lijn] = Math.floor(exact);
    verdeeld += ideaal[lijn];
    resten.push([lijn, exact - ideaal[lijn]]);
  });
  resten.sort((a, b) => b[1] - a[1]);
  for (let k = 0; k < n - verdeeld; k++) ideaal[resten[k][0]]++;

  const regels = LIJNEN.map(lijn => {
    const primair = pool.filter(p => positiesVan(wedstrijd, p.id).primair === lijn);
    return {
      lijn,
      primair: primair.length,
      ideaal: ideaal[lijn],
      weg: primair.filter(p => positiesVan(wedstrijd, p.id).secundair).length,
      binnen: pool.filter(p => {
        const x = positiesVan(wedstrijd, p.id);
        return x.secundair === lijn && x.primair && x.primair !== lijn;
      }).length,
    };
  });
  const flexibel = pool.filter(p => isFlexibel(wedstrijd, p.id));
  const zonderSecundair = pool.filter(p => !isFlexibel(wedstrijd, p.id) && !positiesVan(wedstrijd, p.id).secundair);

  const tips = [];
  regels.forEach(r => {
    const naam = LIJN_LABEL[r.lijn];
    if (r.primair - r.ideaal >= 2) tips.push(`${naam}: ${r.primair} spelers hebben dit als primair, ideaal is ${r.ideaal}. Zet er ${r.primair - r.ideaal} over naar een linie met te weinig primaire spelers.`);
    if (r.ideaal - r.primair >= 2) tips.push(`${naam}: maar ${r.primair} spelers hebben dit als primair, ideaal is ${r.ideaal}.`);
    if (r.binnen - r.weg >= 2) tips.push(`${naam}: ${r.binnen} spelers komen hier secundair binnen, maar er gaan er maar ${r.weg} van de primaire spelers secundair weg. Kies bij ${r.binnen - r.weg} van die ${r.binnen} een andere secundaire positie.`);
    if (r.weg - r.binnen >= 2) tips.push(`${naam}: ${r.weg} primaire spelers gaan secundair weg, maar er komen er maar ${r.binnen} binnen. Geef ${r.weg - r.binnen} speler(s) van een andere linie ${naam} als secundaire positie.`);
  });
  if (zonderSecundair.length) tips.push(`Geen secundaire positie: ${zonderSecundair.map(p => p.naam).join(', ')}.`);

  return { regels, flexibel, tips, sluitend: !tips.length, n };
}

function renderHaalbaarheid() {
  const el = document.getElementById('haalbaarheid');
  el.innerHTML = '';
  const wedstrijd = huidigeWedstrijd();
  const a = analyseHaalbaarheid(wedstrijd);
  if (a.leeg) {
    el.innerHTML = '<p class="hint">Vink aanwezige veldspelers aan om de haalbaarheid te zien.</p>';
    return;
  }

  const lijst = document.createElement('ul');
  lijst.className = 'haalbaarheid-regels';
  a.regels.forEach(r => {
    const li = document.createElement('li');
    const tekort = r.geschikt < r.plekken;
    li.className = tekort ? 'tekort' : '';
    li.textContent = `${LIJN_LABEL[r.lijn]}: ${r.plekken} plekken · ${r.geschikt} geschikt (★ ${r.primair}, ☆ ${r.secundair}, flexibel ${r.flexibel})`;
    lijst.appendChild(li);
  });
  el.appendChild(lijst);

  const status = document.createElement('p');
  status.className = 'haalbaarheid-status ' + (a.problemen.length ? 'let-op' : 'ok');
  status.textContent = a.problemen.length
    ? '⚠️ Eerlijke speeltijd met deze posities is niet helemaal haalbaar:'
    : `✅ Eerlijke speeltijd lijkt haalbaar met deze posities. ${a.doel}`;
  el.appendChild(status);

  if (a.problemen.length) {
    const ul = document.createElement('ul');
    ul.className = 'haalbaarheid-problemen';
    a.problemen.forEach(t => {
      const li = document.createElement('li');
      li.textContent = t;
      ul.appendChild(li);
    });
    el.appendChild(ul);
    const uitleg = document.createElement('p');
    uitleg.className = 'hint';
    uitleg.textContent = `${a.doel} De generator geeft voorrang aan eerlijke speeltijd en zet iemand alleen buiten zijn posities als het niet anders kan.`;
    el.appendChild(uitleg);
  }
  const s = analyseSluitend(wedstrijd);
  const sluitKop = document.createElement('h4');
  sluitKop.className = 'sluitend-kop';
  sluitKop.textContent = 'Sluitende lijst (primair en secundair)';
  el.appendChild(sluitKop);

  const sluitLijst = document.createElement('ul');
  sluitLijst.className = 'haalbaarheid-regels';
  s.regels.forEach(r => {
    const li = document.createElement('li');
    const evenwicht = Math.abs(r.binnen - r.weg) <= 1 && Math.abs(r.primair - r.ideaal) <= 1;
    li.className = evenwicht ? '' : 'tekort';
    li.textContent = `${evenwicht ? '✓' : '✗'} ${LIJN_LABEL[r.lijn]}: ${r.primair} primair (ideaal ${r.ideaal}) · ${r.weg} gaan secundair weg · ${r.binnen} komen secundair binnen`;
    sluitLijst.appendChild(li);
  });
  el.appendChild(sluitLijst);

  const sluitStatus = document.createElement('p');
  sluitStatus.className = 'haalbaarheid-status ' + (s.sluitend ? 'ok' : 'let-op');
  sluitStatus.textContent = s.sluitend
    ? '✅ De lijst is sluitend: iedereen kan minstens één keer secundair spelen zonder dat een linie leegloopt.'
    : '⚠️ De lijst is nog niet sluitend:';
  el.appendChild(sluitStatus);
  if (s.tips.length) {
    const ul = document.createElement('ul');
    ul.className = 'haalbaarheid-problemen';
    s.tips.forEach(t => {
      const li = document.createElement('li');
      li.textContent = t;
      ul.appendChild(li);
    });
    el.appendChild(ul);
  }
  if (s.flexibel.length) {
    const fl = document.createElement('p');
    fl.className = 'hint';
    fl.textContent = `Flexibele spelers (geen posities ingesteld) tellen hier niet mee: ${s.flexibel.map(p => p.naam).join(', ')}.`;
    el.appendChild(fl);
  }

  const noot = document.createElement('p');
  noot.className = 'hint';
  noot.textContent = `Berekend met formatie ${a.formatie} (eerste ${periodeWoord(wedstrijd)}); spelers zonder posities tellen overal mee.`;
  el.appendChild(noot);
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
  renderHaalbaarheid();
  renderKwartTabs();
  renderGenereerMelding();
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
