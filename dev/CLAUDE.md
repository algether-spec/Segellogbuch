# Entwicklungsregeln

## Versionierung & Deployment
Nach jeder Codeänderung automatisch:
1. Patch-Version erhöhen (x.x.N+1) in config.js, sw.js, version.json und index.html (?v=)
2. git add (nur geänderte Dateien, kein -A)
3. git commit (auf Deutsch, Format: typ(bereich): beschreibung + vVersion)
4. git push

Keine Rückfrage – direkt ausführen nach jeder Änderung.

## Branch-Regeln

- Alle Änderungen werden auf **dev** gepusht — NIEMALS auf **main**
- Push auf **main** NUR wenn der Prompt explizit **"merge to main"** oder **"push to main"** enthält
- Patch-Version bei dev-Commits mit `-dev` Suffix — Beispiel: `v2.5.73-dev`
- Vor jedem Push prüfen: `git branch` — sicherstellen dass **dev** aktiv ist
- Merge zu main: Version ohne `-dev` Suffix, dann `git checkout main && git merge dev && git push && git checkout dev`

## Geschützte Funktionen (nie ändern ohne explizite Anweisung)
Siehe LOGIK.md

## Logikschutz

- Bestehende Logik (Zustandsübergänge, Event-Validierung, Track-Berechnung, GPS-Handling, Update-Mechanismus) wird NIE verändert ohne explizite Aufforderung im Prompt.
- Bei CSS/UI-Änderungen: nur style.css und index.html (Optik) anfassen — app.js, track.js, storage.js nur wenn der Prompt das explizit fordert.
- Wenn eine UI-Änderung einen bestehenden Event-Handler, onclick, oder JS-Funktionsaufruf betreffen würde: STOPP — Befund ausgeben und warten. Nicht selbst entscheiden.
- Wenn ein Element umgebaut wird (z.B. button → span): zuerst prüfen ob darauf Event-Handler registriert sind. Falls ja: Befund ausgeben und warten.

---

# Entwicklungsregeln – Segellogbuch

## ⛔ Pflicht vor jeder Änderung

1. **LOGIK.md lesen** bevor UI oder Logik angefasst wird
2. **Geschützte Funktionen** aus LOGIK.md **NIE verändern** (zustandAktualisieren, hafenSperrungAktualisieren, stoppZustandSpeichern, schnellEintragSpeichern, trackPunktAufzeichnenUndPlanen, trackIntervallFuerSog, gpsAbfragen, stoppZustandLaden)
3. **Nach jeder Änderung**: Logik-Check — prüfen ob Aufrufkette intakt ist

## Arbeitsweise

- Schritt für Schritt – immer nur die aktuelle Aufgabe umsetzen
- Nur ändern, was für die aktuelle Aufgabe notwendig ist
- Bestehenden Code respektieren, keine Umstrukturierungen ohne Auftrag
- Keine Zusatzfunktionen ohne expliziten Auftrag

## Dateitrennung

- `index.html` – nur Oberfläche
- `style.css` – nur Layout
- `app.js` – nur Logik
- `storage.js` – nur Laden und Speichern

## Datenmodell

- Strikt an das definierte Datenmodell halten
- Keine Felder ändern oder hinzufügen ohne Auftrag
- `events` und `track` bleiben getrennt

## Speicherung

- Alle Törns als Array in localStorage unter `"segel_logbuch_trips"`
- Speicherung nur über `storage.js`

## Code

- Einfach, klar, nachvollziehbar
- Keine unnötige Komplexität
- Keine doppelten Funktionen

## UI

- Einfach und übersichtlich
- Keine überladenen Formulare

## Pflichtfeld-Validierung

- Törnname Pflicht
- Schiffsführer Pflicht
- Keine leeren Crew-Einträge

## Antwortformat

1. Änderung
2. Dateien
3. Funktion
4. Hinweis
5. Nächster Schritt

## Commit-Nachrichten

- Auf Deutsch
- Format: `typ(bereich): beschreibung`
- Typen: `feat`, `fix`, `refactor`, `docs`

---

## Aufgaben-Rezepte

### Aufgabe: "event-validierung einbauen"

⚠️ KEINE RÜCKFRAGEN. Alle Informationen sind vollständig unten angegeben. Sofort mit Schritt 1 beginnen.

**Schritt 1 – LOGIK.md lesen**
Lies `LOGIK.md` vollständig.

**Schritt 2 – Konstanten in `app.js` einfügen**
Nach den bestehenden Konstanten, vor den Funktionen – exakt diesen Block einfügen:

```js
// ── Event-Validierung ────────────────────────────────────────
const ERLAUBTE_ZUSTAENDE = {
  Ablegen: ["hafen"],
  "Anker lichten": ["anker"],
  "Von Boje": ["boje"],
  Anlegen: ["fahrt"],
  Ankern: ["fahrt"],
  "An Boje": ["fahrt"],
  Wende: ["fahrt"],
  Halse: ["fahrt"],
  Reffen: ["fahrt"],
  "Motor an": ["fahrt"],
  Segeln: ["fahrt"],
  Ruderwechsel: ["fahrt"],
};

const SOG_GRENZWERTE = {
  Ankern: 0.5,
  "An Boje": 0.5,
  Anlegen: 1.0,
};
```

**Schritt 3 – Hilfsfunktionen in `app.js` einfügen**
Direkt vor `schnellEintragSpeichern` – exakt diesen Block einfügen:

```js
function eventErlaubt(typ, zustand) {
  const erlaubt = ERLAUBTE_ZUSTAENDE[typ];
  if (!erlaubt) return true;
  return erlaubt.includes(zustand);
}

function sogWarnungPruefen(typ, sog) {
  const grenze = SOG_GRENZWERTE[typ];
  if (!grenze || sog == null) return null;
  if (sog > grenze) return `⚠️ SOG ${sog} kn – zu schnell für „${typ}"`;
  return null;
}

function antriebKonsistenzPruefen(typ, antrieb) {
  if (["Wende", "Halse", "Reffen"].includes(typ) && antrieb !== "segeln") {
    return `⚠️ „${typ}" nur bei aktivem Segeln möglich`;
  }
  return null;
}

function validierungsWarnung(meldung) {
  const toast = document.createElement("div");
  toast.className = "validierung-toast";
  toast.textContent = meldung;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
```

**Schritt 4 – `schnellEintragSpeichern(typ)` ergänzen**
Als ALLERERSTES in der Funktion einfügen, vor allen anderen Zeilen – die restliche Funktion bleibt zu 100% unverändert:

```js
// Event-Validierung
const _zustand = stoppZustandLaden();
const _sog = aktuellerToern?.track?.points?.slice(-1)[0]?.sog ?? null;
const _antrieb = zustandErmitteln()?.type ?? "";

if (!eventErlaubt(typ, _zustand)) {
  validierungsWarnung(`„${typ}" ist im Zustand „${_zustand}" nicht möglich`);
  return;
}
const _sogHinweis = sogWarnungPruefen(typ, _sog);
if (_sogHinweis) validierungsWarnung(_sogHinweis);

const _antriebHinweis = antriebKonsistenzPruefen(typ, _antrieb);
if (_antriebHinweis) validierungsWarnung(_antriebHinweis);
```

**Schritt 5 – CSS in `style.css` einfügen**
Am Ende der Datei – exakt diesen Block einfügen:

```css
.validierung-toast {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: #c0392b;
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 9999;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  animation: fadeInOut 3s ease forwards;
}

@keyframes fadeInOut {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(10px);
  }
  15% {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
  75% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
```

**Schritt 6 – Logik-Check**
Prüfe ob die Aufrufkette in `schnellEintragSpeichern` intakt ist.

**Schritt 7 – Commit**

```
feat(validierung): Event-Zustand-, SOG- und Antrieb-Prüfung eingebaut
```
