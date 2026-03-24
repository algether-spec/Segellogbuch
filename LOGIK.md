# LOGIK.md – Segellogbuch Kernlogik

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

"Ablegen" und "Abfahrt" sind nicht mehr in den Typen-Sets – ihr Antrieb wird
dynamisch via `zustandErmitteln()` → UI-Buttons → Standardwert "motor" ermittelt.

`zustandErmitteln()` liest Events rückwärts und gibt das letzte Motor/Segeln-Event zurück.
`zustandAktualisieren()` setzt die Button-Klassen (`btn-zustand-aktiv`) und deaktiviert
Wende/Halse/Reffen wenn kein Segeln-Zustand aktiv.

### UI-Sperren bei STOPP

| Element | Bei STOPP |
|---|---|
| Fahrt-Stopp-Bar (Anlegen/Ankern/An Boje) | ausgeblendet → Start-Bar sichtbar |
| Manöver-Grid (Wende/Halse/Reffen) | ausgeblendet |
| Rudergänger-Button | immer sichtbar |
| Segeln/Motor-Buttons | immer sichtbar |

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
              wenn intervall > 0: Punkt in track.points speichern
              _trackTimeout = setTimeout(trackPunktAufzeichnenUndPlanen, intervall)
          → Fehler:
              _trackLaeuft = false
              _trackTimeout = setTimeout(trackPunktAufzeichnenUndPlanen, 60000)

STOPP / Törn wechsel
  → trackStoppen()
    → clearTimeout(_trackTimeout), _trackTimeout = null
    → _trackLaeuft = false
```

### Warum idempotent?

`hafenSperrungAktualisieren()` wird bei **jedem** Event-Save aufgerufen
(via `logbuchStatusAktualisieren`). Ohne Idempotenzschutz würde jede Wende,
jedes Reffen usw. den laufenden Timer zurücksetzen → Punkte würden nie
aufgezeichnet.

### Track-Intervalle

| SOG | Intervall |
|---|---|
| 0 kn | kein Punkt, aber in 2 min neu prüfen |
| 0–3 kn | alle 2 min |
| 3–6 kn | alle 1 min |
| 6–15 kn | alle 30 s |
| > 15 kn | alle 15 s |

### Track-Distanz (konfigurierbar)

Einstellbar im Menü (Sidebar), gespeichert unter `localStorage["segel_track_distanz"]`.

| Einstellung | Distanz |
|---|---|
| 0,25 nm (Standard) | 463 m |
| 0,5 nm | 926 m |
| 1,0 nm | 1852 m |
| 2,0 nm | 3704 m |

Punkt wird **immer** gespeichert wenn letzter Punkt älter als **3 Minuten**,
unabhängig von der Distanz (Fallback).

### Datenspeicherung

Punkte werden in `aktuellerToern.track.points[]` gespeichert:

```js
{
  lat:  number,   // 5 Dezimalstellen
  lon:  number,
  sog:  number,   // Knoten
  zeit: string    // "2026-03-21T14:35"
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
  zeit:         string,   // "2026-03-21T14:35"
  ort:          string,
  rudergaenger: { name: string } | null,
  note:         string,
  weather:      { windForce, windKnots, windDirection, description } | null,
  pos:          { lat, lon, sog } | null
}
```

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
