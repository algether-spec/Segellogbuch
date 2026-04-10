# LOGIK.md – Segellogbuch Kernlogik (v2.4.x)

## ⛔ GESCHÜTZTE FUNKTIONEN – NIE ÄNDERN!

Diese Funktionen bilden die Kernlogik. Jede Änderung kann Datenverlust,
falsche Zustände oder defektes Tracking verursachen.

| Funktion                       | Datei  | Zweck                                               |
| ------------------------------ | ------ | --------------------------------------------------- |
| `zustandAktualisieren()`       | app.js | Segeln/Motor-Buttons visuell aktualisieren          |
| `hafenSperrungAktualisieren()` | app.js | FAHRT/STOPP-Zustand auf UI anwenden                 |
| `stoppZustandSpeichern()`      | app.js | Fahrt-Zustand via storage.js + Törn schreiben       |
| `schnellEintragSpeichern()`    | app.js | Schnellbutton → Event sofort + GPS nachträglich      |
| `gpsAbfragen()`                | app.js | GPS-Position asynchron holen und in Event schreiben |
| `stoppZustandLaden()`          | app.js | Fahrt-Zustand via storage.js lesen                  |

---

## ZUSTANDSLOGIK

### Fahrt-Zustand (stoppZustand)

Vier Zustände, gespeichert in `localStorage["segel_logbuch_stopp"]`:

```
"hafen"   → Im Hafen (Standard nach neuem Törn)
"anker"   → Vor Anker
"boje"    → An Boje
"fahrt"   → Unterwegs
```

**Zustandsübergänge via Events:**

```
Ablegen        → "fahrt"    (START_EREIGNISSE)
Anker lichten  → "fahrt"    (START_EREIGNISSE)
Von Boje       → "fahrt"    (START_EREIGNISSE)

Anlegen        → "hafen"    (STOPP_EREIGNISSE)
Ankern         → "anker"    (STOPP_EREIGNISSE)
An Boje        → "boje"     (STOPP_EREIGNISSE)
```

**Aufrufkette nach jedem Event-Save (Optimistic Update seit v2.5.73-dev):**

```
schnellEintragSpeichern(typ)
  → ev sofort erstellen (pos: null, weather: null, ort: "")
  → stoppZustandSpeichern(neuerZustand)   ← sofort
  → zeigeLogs()                           ← sofort, UI reagiert ohne Wartezeit
    → logbuchStatusAktualisieren()
      → hafenSperrungAktualisieren(stoppZustandLaden())
        → zustandAktualisieren()
        → trackStarten() ODER trackStoppen()
  → toernSpeichern()                      ← sofort
  → gpsUndWetterHolen(3000).then(...)     ← fire-and-forget, nachträglich
      → ev.pos / ev.weather / ev.ort setzen
      → trackManöverPunkt()
      → toernSpeichern()                  ← nach GPS-Antwort
```

### Motor/Segeln-Zustand

Bestimmt durch das **letzte** Motor- oder Segeln-Event in `aktuellerToern.events`:

```
MOTOR_TYPEN = { "Motor an" }
SEGEL_TYPEN = { "Segeln" }
```

"Ablegen" und "Abfahrt" sind nicht in den Typen-Sets – ihr Antrieb wird
dynamisch via `antriebFuerTyp()` ermittelt.

**Fallback-Kette für antriebFuerTyp(typ):**

```
1. MOTOR_TYPEN.has(typ)  → "motor"
2. SEGEL_TYPEN.has(typ)  → "segeln"
3. typ === "Ablegen" | "Abfahrt":
     zustandErmitteln()?.zustand  → letztes Motor/Segeln-Event
     || antriebAusUI()            → aktiver Segeln/Motor-Button (btn-zustand-aktiv)
     || "motor"                   → Standardwert
4. alle anderen:
     zustandErmitteln()?.zustand || ""
```

`zustandErmitteln()` liest Events rückwärts und gibt das letzte Motor/Segeln-Event zurück.
`antriebAusUI()` liest `btn-zustand-aktiv`-Klasse der Segeln/Motor-Buttons.
`zustandAktualisieren()` setzt die Button-Klassen und deaktiviert Wende/Halse/Reffen
wenn kein Segeln-Zustand aktiv.

### Event-Validierung

**ERLAUBTE_ZUSTAENDE** – erlaubte Fahrt-Zustände pro Ereignistyp:

```
"Ablegen":       ["hafen"]
"Anker lichten": ["anker"]
"Von Boje":      ["boje"]
"Anlegen":       ["fahrt"]
"Ankern":        ["fahrt"]
"An Boje":       ["fahrt"]
"Wende":         ["fahrt"]
"Halse":         ["fahrt"]
"Reffen":        ["fahrt"]
Motor an, Segeln, Ruderwechsel: kein Eintrag → immer erlaubt
"Notiz" (📝): Kategorie "Notiz", kein Eintrag in ERLAUBTE_ZUSTAENDE → immer erlaubt
```

**ANTRIEB_PFLICHT_TYPEN** – Antrieb muss aktiv sein:

```
{ "Ablegen", "Abfahrt", "Anker lichten", "Von Boje" }
```

Antrieb gilt als aktiv wenn `zustandErmitteln() !== null` ODER `antriebAusUI() !== null`.
Fehlt der Antrieb → `validierungsWarnung("Bitte zuerst Motor oder Segeln aktivieren")`.

**eventErlaubt(typ, zustand):**

1. Kein Eintrag in ERLAUBTE_ZUSTAENDE → immer erlaubt
2. Zustand nicht in der erlaubten Liste → verboten
3. Typ in ANTRIEB_PFLICHT_TYPEN und kein Antrieb aktiv → verboten

### UI-Sperren bei STOPP

| Element                                  | Bei STOPP                         |
| ---------------------------------------- | --------------------------------- |
| Fahrt-Stopp-Bar (Anlegen/Ankern/An Boje) | ausgeblendet → Start-Bar sichtbar |
| Manöver-Grid (Wende/Halse/Reffen)        | ausgeblendet                      |
| Rudergänger-Button                       | immer sichtbar                    |
| Segeln/Motor-Buttons                     | immer sichtbar                    |

---

## NOTIZ-POPUP

Das Notiz-Popup öffnet sich über „💬 Manöver" (letztes Event bearbeiten) oder „📝 Notiz" (neuen Notiz-Event anlegen).
Event-Buttons speichern direkt ohne Popup (`_pendingNote = ""`).

**Ablauf:**

```
notizZumLetztenManoever(typ?)
  → typ === "Notiz": notizPopupZeigen("📝 Notiz")
      → Overlay anzeigen, Textarea leeren, Fokus setzen
      → Speichern-Button: notizPopupSpeichern()
          → _pendingNote = textarea.value.trim()
          → Promise resolven
      → Schließen-Button: notizPopupSchliessen()
          → _pendingNote = "", Promise mit "" resolven
  → kein typ: letztes Event direkt aktualisieren (note-Feld), toernSpeichern()
```

**Spracheingabe (Web Speech API):**

- Nur sichtbar wenn `window.SpeechRecognition` oder `window.webkitSpeechRecognition` verfügbar
- `_notizSpeechRecog` / `_notizSpeechRunning` verwalten laufende Erkennung
- Bei Popup-Schließen wird laufende Erkennung abgebrochen

**Globale Variablen:**

```js
let _pendingNote = ""; // Inhalt für nächsten Event-Save
let _notizResolve = null; // Promise-Resolver
let _notizSpeechRunning = false;
let _notizSpeechRecog = null;
```

---

## TRACK LOGIK

Track-Aufzeichnung ist in **`track.js`** ausgelagert (ab v2.5.0).
`app.js` ruft nur `trackStarten()`, `trackStoppen()` und `trackManöverPunkt()` auf.

### Zustands-Variablen (track.js)

```js
let _watchId    = null; /* watchPosition-Handle (null = nicht aktiv)  */
let _letzterPkt = null; /* letzter gespeicherter Punkt (für Distanz/Zeit-Check) */
```

### Ablauf

```
FAHRT beginnt
  → hafenSperrungAktualisieren("fahrt")
    → trackStarten()
      → Prüfung: _watchId !== null → return (idempotent!)
      → _letzterPkt aus bestehenden track.points initialisieren
      → navigator.geolocation.watchPosition(_trackWatchCallback, ...)

  _trackWatchCallback(pos) bei jeder neuen GPS-Position:
    → Zustand prüfen: nicht "fahrt" → trackStoppen()
    → sogKn berechnen
    → SOG ≤ sogSchwelleLaden() kn und alterSek < 180 → kein Punkt, return (GPS-Jitter-Filter)
    → distM >= minDistM ODER alterSek >= trackIntervallLaden() → _trackPunktSpeichern()

STOPP / Törn wechsel
  → trackStoppen()
    → clearWatch(_watchId), _watchId = null
    → _letzterPkt = null, _highAcc = false
```

### Warum idempotent?

`hafenSperrungAktualisieren()` wird bei **jedem** Event-Save aufgerufen
(via `logbuchStatusAktualisieren`). Der Guard `if (_watchId !== null) return`
verhindert, dass eine laufende watchPosition bei jeder Wende/Reffen neu gestartet
und damit zurückgesetzt wird.

### Track-Distanz (konfigurierbar)

Einstellbar in ⚙️ Einstellungen, gespeichert unter `localStorage["segel_track_distanz"]`.
Gültige Werte: `[0.05, 0.1, 0.2, 0.3, 0.4, 0.5]`, Standard: `0.1` nm.

### GPS-Jitter-Filter SOG-Schwelle (konfigurierbar)

Einstellbar in ⚙️ Einstellungen, gespeichert unter `localStorage["segel_sog_schwelle"]`.
Gültige Werte: `[0.05, 0.1, 0.2, 0.3, 0.4, 0.5]` kn, Standard: `0.1` kn.
Punkte mit SOG ≤ Schwelle werden nicht gespeichert (außer Fallback nach 180 s).

Berechnung: `minDistM = trackDistanzLaden() * 1852` (nm → Meter)
Abstand zum letzten Punkt: `haversineKm(...) * 1000` (km → Meter)

| Einstellung        | Distanz |
| ------------------ | ------- |
| 0,05 nm            | ~93 m   |
| 0,1 nm (Standard)  | ~185 m  |
| 0,2 nm             | ~370 m  |
| 0,3 nm             | ~556 m  |
| 0,4 nm             | ~741 m  |
| 0,5 nm             | ~926 m  |

Punkt wird **immer** gespeichert wenn letzter Punkt älter als das **Fallback-Intervall**
(`alterSek >= trackIntervallLaden()`), unabhängig von der Distanz.
Gültige Werte: `[30, 60, 90, 120, 150, 180]` s, Standard: `120` s.

### watchPosition-Optionen

```js
{ maximumAge: 0, timeout: 15000, enableHighAccuracy: true }
```

`enableHighAccuracy` ist fix auf `true` gesetzt.
`maximumAge: 0` erzwingt immer einen frischen GPS-Fix.
`timeout: 15000` gibt Android genug Zeit für einen neuen Fix.

### Manöverpunkte: trackManöverPunkt()

Bei jedem Event-Save ruft `schnellEintragSpeichern()` `trackManöverPunkt()` auf
(wenn GPS verfügbar). Manöverpunkte werden **immer** gespeichert – kein
Distanz-Check. Danach chronologische Sortierung aller track.points.

```js
// schnellEintragSpeichern (app.js):
if (ev.pos) trackManöverPunkt(ev.pos.lat, ev.pos.lon, ev.pos.sog, zeitIso);
```

### Start-Boost

60 Sekunden nach `trackStarten()` wird `_startBoost = true` gesetzt.
In dieser Phase gilt: Intervall = 10 s, Mindestdistanz = 0 m (jeder Punkt wird
gespeichert der älter als 10 s ist, unabhängig von Distanz/Intervall-Einstellung).
Nach 60 s setzt `_startBoostTimer` beide Werte zurück auf die Nutzereinstellungen.

`trackStoppen()` bricht den Timer ab und setzt `_startBoost = false`.
Zustandsvariablen: `_startBoost`, `_startBoostTimer`.

### Debounce-Speicherung

`_trackPunktSpeichern()` ruft `toernSpeichern()` nicht sofort auf, sondern
verzögert via `_speicherTimer` (5 Sekunden). Kommen mehrere Punkte in kurzer
Zeit (z.B. bei Neustart nach HighAcc-Wechsel), wird nur einmal gespeichert.

Bei `trackStoppen()` wird ein laufender Timer sofort abgebrochen und
`toernSpeichern()` direkt aufgerufen → kein Datenverlust beim Stopp.

### Datenspeicherung

Alle Track-Punkte in `aktuellerToern.track.points[]`:

```js
{
  lat:  number,   // 5 Dezimalstellen
  lon:  number,
  sog:  number,   // Knoten
  zeit: string    // "2026-03-21T14:35:00" (ISO, 19 Zeichen)
}
```

GPS-Position in Events (Manöver) wird unter `ev.pos` gespeichert:

```js
ev.pos = { lat, lon, sog }; // NICHT ev.lat/ev.lon!
```

---

## DATENMODELL (Event)

```js
{
  id:           string,   // generateId()
  type:         string,   // "Wende", "Ablegen", "Motor an", …
  kategorie:    string,   // kategorieFuerTyp(type)
  antrieb:      string,   // "segeln" | "motor" | ""
  zeit:         string,   // "2026-03-21T14:35:00" (ISO, 19 Zeichen mit Sekunden)
  ort:          string,
  rudergaenger: { name: string } | null,
  note:         string,
  weather:      { windForce, windKnots, windDirection, description } | null,
  pos:          { lat, lon, sog } | null
}
```

**Hinweis:** `ev.zeit` hat seit v2.3.1 Sekundengenauigkeit (`slice(0,19)`).
Ältere Events (`ev.date` + `ev.time`, 16 Zeichen) werden via `evZeitIso(ev)`
auf 19 Zeichen normalisiert (`:00` wird angehängt).

---

## LIVE-POSITION

`livePositionAktualisieren(lat, lon, sogKn)` wird von `_trackWatchCallback()` bei
jeder GPS-Position aufgerufen (Hook via `typeof`-Guard).

- Erstellt `_liveMarker` (blauer Kreis) und `_liveCircle` (Halo) auf `_hauptKarte`
- Aktualisiert Tooltip mit aktuellem SOG
- Zentriert Karte + zeichnet Track neu (`trackKarteRendern(aktuellerToern)`) – nur wenn Karte-Tab aktiv
- `liveMarkerEntfernen()` entfernt Marker bei Törn-Wechsel und Track-Stopp

---

## LOCALSTORAGE KEYS

| Key                              | Inhalt                                       |
| -------------------------------- | -------------------------------------------- |
| `segel_logbuch_trips`            | Array aller Törns                            |
| `segel_logbuch_stopp`            | aktueller Fahrt-Zustand ("hafen"/"fahrt"/…)  |
| `segel_logbuch_aktiver_toern`    | tripId des aktiven Törns                     |
| `last_values`                    | letzter Rudergänger + Wind                   |
| `segel_logbuch_autobackup`       | automatisches Backup                         |
| `segel_logbuch_backup_permanent` | permanentes Backup                           |
| `segel_track_distanz`            | Track-Auflösung in nm (0.05/0.1/0.2/0.3/0.4/0.5) |
| `segel_sog_schwelle`             | SOG-Schwelle für GPS-Jitter-Filter (kn)       |
| `segel_track_intervall`          | Fallback-Intervall in Sekunden (30–180)       |
| `segel_track_accuracy`           | Max. GPS-Ungenauigkeit in Metern (25/50/100/200) |
