# LOGIK.md – Segellogbuch Kernlogik (v2.4.x)

## ⛔ GESCHÜTZTE FUNKTIONEN – NIE ÄNDERN!

Diese Funktionen bilden die Kernlogik. Jede Änderung kann Datenverlust,
falsche Zustände oder defektes Tracking verursachen.

| Funktion | Datei | Zweck |
|---|---|---|
| `zustandAktualisieren()` | app.js | Segeln/Motor-Buttons visuell aktualisieren |
| `hafenSperrungAktualisieren()` | app.js | FAHRT/STOPP-Zustand auf UI anwenden |
| `stoppZustandSpeichern()` | app.js | Fahrt-Zustand in localStorage + Törn schreiben |
| `schnellEintragSpeichern()` | app.js | Schnellbutton → GPS → Event → Speichern |
| `trackPunktAufzeichnenUndPlanen()` | app.js | GPS-Punkt aufzeichnen + nächsten Timer planen |
| `trackIntervallFuerSog()` | app.js | Aufzeichnungsintervall nach Geschwindigkeit |
| `gpsAbfragen()` | app.js | GPS-Position asynchron holen und in Event schreiben |
| `stoppZustandLaden()` | app.js | Fahrt-Zustand aus localStorage lesen |

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

**Aufrufkette nach jedem Event-Save:**
```
schnellEintragSpeichern(typ)
  → stoppZustandSpeichern(neuerZustand)
  → zeigeLogs()
    → logbuchStatusAktualisieren()
      → hafenSperrungAktualisieren(stoppZustandLaden())
        → zustandAktualisieren()
        → trackStarten() ODER trackStoppen()
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

| Element | Bei STOPP |
|---|---|
| Fahrt-Stopp-Bar (Anlegen/Ankern/An Boje) | ausgeblendet → Start-Bar sichtbar |
| Manöver-Grid (Wende/Halse/Reffen) | ausgeblendet |
| Rudergänger-Button | immer sichtbar |
| Segeln/Motor-Buttons | immer sichtbar |

---

## NOTIZ-POPUP

Das Notiz-Popup öffnet sich **ausschließlich** über den „💬 Notiz zum Manöver"-Button.
Event-Buttons speichern direkt ohne Popup (`_pendingNote = ""`).

**Ablauf:**
```
notizZumLetztenManoever()
  → notizPopupZeigen(typ)          – gibt Promise zurück
      → clearInterval(_notizCountdownTimer)  – verhindert akkumulierende Intervals
      → Overlay anzeigen, Textarea leeren, Fokus setzen
      → Countdown 5s starten (setInterval)
      → Bei Texteingabe: Countdown-UI einfrieren (Timer läuft weiter bis 0)
      → Bei 0s ODER Speichern-Button: notizPopupSpeichern()
          → _pendingNote = textarea.value.trim()
          → Promise resolven
  → letztes Event direkt aktualisieren (note-Feld), toernSpeichern()
```

**Spracheingabe (Web Speech API):**
- Nur sichtbar wenn `window.SpeechRecognition` oder `window.webkitSpeechRecognition` verfügbar
- `_notizSpeechRecog` / `_notizSpeechRunning` verwalten laufende Erkennung
- Bei Popup-Schließen wird laufende Erkennung abgebrochen

**Globale Variablen:**
```js
let _pendingNote         = "";     // Inhalt für nächsten Event-Save
let _notizCountdownTimer = null;   // setInterval-Handle
let _notizCountdownWert  = 5;      // Sekunden bis Auto-Speichern
let _notizResolve        = null;   // Promise-Resolver
let _notizSpeechRunning  = false;
let _notizSpeechRecog    = null;
```

---

## TRACK LOGIK

### Zustands-Flags

```js
let _trackTimeout = null;   // gesetzter setTimeout-Handle (null = nicht geplant)
let _trackLaeuft  = false;  // GPS-Anfrage läuft gerade (verhindert Doppelstart)
```

### Ablauf

```
FAHRT beginnt
  → hafenSperrungAktualisieren("fahrt")
    → trackStarten()
      → Prüfung: _trackTimeout !== null ODER _trackLaeuft → return (idempotent!)
      → trackPunktAufzeichnenUndPlanen()
        → _trackLaeuft = true, _trackTimeout = null
        → getCurrentPosition()
          → Erfolg:
              _trackLaeuft = false
              SOG berechnen → intervall bestimmen
              wenn intervall > 0 UND (distM >= minDistM ODER alterSek >= 180):
                  Punkt in track.points speichern
              _trackTimeout = setTimeout(trackPunktAufzeichnenUndPlanen, intervall)
          → Fehler:
              _trackLaeuft = false
              _trackTimeout = setTimeout(trackPunktAufzeichnenUndPlanen, 60000)

STOPP / Törn wechsel
  → trackStoppen()
    → if (_trackTimeout !== null): clearTimeout(_trackTimeout), _trackTimeout = null
    → _trackLaeuft = false
```

**Bekannte Einschränkung:** `getCurrentPosition()` ist nicht abbrechbar. Wenn
`trackStoppen()` während einer laufenden GPS-Anfrage aufgerufen wird, feuert der
Callback danach noch und setzt `_trackTimeout`. Die nächste Ausführung von
`trackPunktAufzeichnenUndPlanen()` prüft `stoppZustandLaden() !== "fahrt"` und
stoppt dann sauber.

### Warum idempotent?

`hafenSperrungAktualisieren()` wird bei **jedem** Event-Save aufgerufen
(via `logbuchStatusAktualisieren`). Ohne Idempotenzschutz würde jede Wende,
jedes Reffen usw. den laufenden Timer zurücksetzen → Punkte würden nie
aufgezeichnet.

### Track-Intervalle

| SOG | Intervall |
|---|---|
| 0 kn | kein Punkt, aber in 2 min neu prüfen |
| 0–3 kn | alle 2 min (120 s) |
| 3–6 kn | alle 1 min (60 s) |
| 6–15 kn | alle 30 s |
| > 15 kn | alle 15 s |

### Track-Distanz (konfigurierbar)

Einstellbar in ⚙️ Einstellungen, gespeichert unter `localStorage["segel_track_distanz"]`.
Gültige Werte: `[0.1, 0.25, 0.5, 1.0, 2.0]`, Standard: `0.25` nm.

Berechnung: `minDistM = trackDistanzLaden() * 1852` (nm → Meter)
Abstand zum letzten Punkt: `haversineKm(...) * 1000` (km → Meter)

| Einstellung | Distanz |
|---|---|
| 0,1 nm | ~185 m |
| 0,25 nm (Standard) | ~463 m |
| 0,5 nm | ~926 m |
| 1,0 nm | ~1852 m |
| 2,0 nm | ~3704 m |

Punkt wird **immer** gespeichert wenn letzter Punkt älter als **3 Minuten**
(`alterSek >= 180`), unabhängig von der Distanz (Fallback).

### Manöverpunkte in track.points

Bei jedem Event-Save fügt `schnellEintragSpeichern()` die GPS-Position des Events
**zusätzlich** als Track-Punkt ein (wenn GPS verfügbar):

```js
aktuellerToern.track.points.push({ lat, lon, sog, zeit });
aktuellerToern.track.points.sort((a, b) => a.zeit < b.zeit ? -1 : ...);
```

Das sorgt für chronologisch korrekte Track-Punkte auch wenn Manöver und
automatische Track-Punkte gemischt vorliegen.

### Datenspeicherung

Automatische Track-Punkte in `aktuellerToern.track.points[]`:

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
ev.pos = { lat, lon, sog }   // NICHT ev.lat/ev.lon!
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

## LOCALSTORAGE KEYS

| Key | Inhalt |
|---|---|
| `segel_logbuch_trips` | Array aller Törns |
| `segel_logbuch_stopp` | aktueller Fahrt-Zustand ("hafen"/"fahrt"/…) |
| `segel_logbuch_aktiver_toern` | tripId des aktiven Törns |
| `last_values` | letzter Rudergänger + Wind |
| `segel_logbuch_autobackup` | automatisches Backup |
| `segel_logbuch_backup_permanent` | permanentes Backup |
| `segel_track_distanz` | Track-Auflösung in nm (0.1/0.25/0.5/1.0/2.0) |
