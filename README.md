# Opstelling JO11-4

Een eenvoudige, mobielvriendelijke webapp om per wedstrijd handmatig de opstelling
voor 4 kwarten van 15 minuten (8 vs 8) samen te stellen — geïnspireerd op de app
"Lineup: Opstelling Maken". Geen automatische generator: jij kiest zelf wie waar
staat, per kwart.

## Functionaliteit

- Spelerslijst met aan-/afwezig per wedstrijd, spelers toevoegen/verwijderen.
- Eén vaste keeper (standaard Nick) die automatisch wordt ingevuld, maar per
  kwart handmatig overschreven kan worden.
- 5 formaties (standaard 1-2-3-2), per kwart apart te kiezen.
- Klik-en-kies opstelling per kwart, met een "bank"-lijst van niet-opgestelde
  aanwezige spelers.
- "Kopieer vorig kwart" en "Maak dit kwart leeg" als snelknoppen.
- Overzicht: gespeelde minuten per speler, wissels tussen kwarten, en een
  compact overzicht van alle 4 kwarten naast elkaar (handig om af te drukken).
- Alles in het Nederlands.

## Gegevens bewaren en tussen toestellen delen

Standaard bewaart de app alles **lokaal in de browser** (localStorage) van het
toestel waarop je hem opent. Dat werkt meteen, zonder instellingen, maar de
gegevens staan dan niet automatisch ook op je andere toestellen (bijv. telefoon
én tablet).

Wil je dezelfde gegevens op meerdere toestellen zien, dan kun je **gratis en
zonder inlog** een Firebase-project koppelen. Dit is een eenmalige,
handmatige stap die je zelf moet doen (ik kan geen account voor je aanmaken):

1. Ga naar [console.firebase.google.com](https://console.firebase.google.com/)
   en log in met een Google-account. Klik op **"Project toevoegen"** en volg de
   stappen (Google Analytics mag je uitzetten, dat is niet nodig).
2. Klik in het nieuwe project links op **"Firestore Database"** →
   **"Database maken"**. Kies een locatie in de buurt (bijv. `eur3 (Europa)`) en
   start in **testmodus** (dat betekent: iedereen met de juiste link kan lezen
   en schrijven — dat is precies wat we willen, aangezien er geen login is).
   > Let op: testmodus verloopt na 30 dagen. Ga daarna naar het tabblad
   > **"Regels"** van de database en vervang de regels door:
   > ```
   > rules_version = '2';
   > service cloud.firestore {
   >   match /databases/{database}/documents {
   >     match /teams/{teamId} {
   >       allow read, write: if true;
   >     }
   >   }
   > }
   > ```
   > (Dit houdt de app zonder inlog werkend — de beveiliging zit in de geheime
   > link, niet in een wachtwoord. Deel de link dus alleen met mensen die
   > toegang mogen hebben.)
3. Klik links boven op het tandwiel → **"Projectinstellingen"**. Scroll naar
   **"Jouw apps"** en klik op het `</>`-icoon (Web-app toevoegen). Geef een naam
   (bijv. "opstelling") en klik op **"App registreren"**. Je krijgt nu een
   code-blokje met een object `firebaseConfig = { apiKey: ..., authDomain: ..., ... }`.
4. Open [app.js](app.js) in dit project en zoek bovenaan naar
   `const FIREBASE_CONFIG = null;`. Vervang `null` door het `firebaseConfig`-object
   dat je net hebt gekregen, bijvoorbeeld:
   ```js
   const FIREBASE_CONFIG = {
     apiKey: "AIza...",
     authDomain: "jouw-project.firebaseapp.com",
     projectId: "jouw-project",
     storageBucket: "jouw-project.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
5. Sla op en herlaad de app. Rechtsboven verandert de status van "Lokaal" naar
   "✅ Gesynchroniseerd" zodra het lukt. De link in de adresbalk bevat nu een
   `?team=...`-code — deel die link (via de knop **"🔗 Deel-link"**) met jezelf
   op je andere toestellen, of met een mede-trainer, om dezelfde gegevens te
   zien en te bewerken.

Werkt Firebase niet (geen internet, geen configuratie, of een fout) dan valt de
app automatisch terug op lokale opslag — er gaat nooit iets verloren, alleen de
synchronisatie tussen toestellen ontbreekt dan.

## Lokaal bekijken

Deze app heeft geen build-stap nodig. Start bijvoorbeeld een simpele server:

```bash
python -m http.server 5545
```

en open <http://localhost:5545>.

## Op GitHub Pages zetten

1. Maak een (privé of publieke) GitHub-repository aan en push deze map ernaartoe.
2. Ga naar **Settings → Pages** van de repository, kies bij "Source" de branch
   `main` en map `/ (root)` (of `/opstelling-jo11-4` als de app niet in de
   hoofdmap van de repository staat), en sla op.
3. Na een minuut is de app bereikbaar op `https://<gebruikersnaam>.github.io/<repository>/`.
   Deel die link (met het automatisch toegevoegde `?team=...` erachter) met
   jezelf en eventuele mede-trainers.
