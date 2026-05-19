# LOGIK.md – Segellogbuch Kernlogik (v2.5.x)

## ⛔ GESCHÜTZTE FUNKTIONEN – NIE ÄNDERN!

Diese Funktionen bilden die Kernlogik. Jede Änderung kann Datenverlust,
falsche Zustände oder defektes Tracking verursachen.

| Funktion                       | Datei     | Zweck                                               |
| ------------------------------ | --------- | --------------------------------------------------- |
| `zustandAktualisieren()`       | app.js    | Motor/Segeln/Motorsegeln-Buttons visuell aktualisieren |
| `hafenSperrungAktualisieren()` | app.js    | FAHRT/STOPP-Zustand auf UI anwenden                 |
| `stoppZustandSpeichern()`      | app.js    | Fahrt-Zustand in localStorage + Törn schreiben      |
| `schnellEintragSpeichern()`    | app.js    | Schnellbutton → GPS → Event → Speichern             |
| `gpsAbfragen()`                | app.js    | GPS-Position asynchron holen und in Event schreiben |
| `stoppZustandLaden()`          | app.js    | Fahrt-Zustand aus localStorage lesen                |
| `mobSpeichern()`               | app.js    | MOB-Event bypass-Validierung, immer auslösbar       |
| `mobGeborgenSpeichern()`       | app.js    | Recovery-Event mit Dauer + Typ speichern            |
| `trackStarten()`               | track.js  | GPS-watchPosition starten                           |
| `trackStoppen()`               | track.js  | GPS-watchPosition beenden, Track speichern          |
| `trackManöverPunkt()`          | track.js  | Manöverpunkt immer speichern (kein Distanz-Check)   |
| `haversineKm()`                | track.js  | Distanzberechnung zwischen zwei GPS-Punkten         |

---

## DATEITRENNUNG (ab v2.5.0)

| Datei          | Inhalt                                                    |
| -------------- | --------------------------------------------------------- |
| `app.js`       | Kern-Logik, GPS, Zustand, Events, Navigation, Init        |
| `storage.js`   | Laden/Speichern localStorage                              |
| `track.js`     | GPS-Track-Aufzeichnung                                    |
| `karte.js`     | Leaflet Maps (Track-Karte, Logbuch-Karte, Manöverpunkte)  |
| `statistik.js` | Törnstatistik, Trackliste, Törnabschluss, Törnübersicht   |
| `modals.js`    | Notiz-Popup, MOB-Overlay, Sicherheit, Tageskontrolle, Schiffsführer |
| `config.js`    | APP_VERSION, Auto-Update-Logik                            |

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

---

### Motor/Segeln-Zustand (Antrieb)

Drei mögliche Antriebszustände:

```
"motor"       → Motor läuft, Segel nicht gesetzt
"segeln"      → Segel gesetzt, Motor aus
"motorsegeln" → Motor läuft UND Segel gesetzt (zur Sicherheit)
null          → kein Antrieb aktiv
```

**Event-Typen die den Zustand setzen:**

```
MOTOR_TYPEN = { "Motor an" }
SEGEL_TYPEN = { "Segeln" }

"Motorsegeln" → zustand: "motorsegeln"
"Motor aus"   → zustand: null (Motor explizit aus)
```

**`zustandErmitteln()` – Events rückwärts scannen:**

1. `"Motorsegeln"` → `{ zustand: "motorsegeln" }`
2. `"Motor aus"` → `null` (Motor explizit off, Scan stoppt)
3. `MOTOR_TYPEN.has(typ)` → `{ zustand: "motor" }`
4. `SEGEL_TYPEN.has(typ)` → `{ zustand: "segeln" }`

**`zustandSetzen(zustand)` – vollständige Übergangslogik:**

| Aktuell      | Drückt | Ergebnis     | Event-Type   | Notiz                           |
| ------------ | ------ | ------------ | ------------ | ------------------------------- |
| motor        | Motor  | null         | "Motor aus"  | "Motor gestoppt"                |
| segeln       | Motor  | motorsegeln  | "Motorsegeln"| "Motor gestartet, Segel aktiv"  |
| motorsegeln  | Motor  | segeln       | "Segeln"     | "Motor gestoppt, Segel aktiv"   |
| null         | Motor  | motor        | "Motor an"   | "Motor an"                      |
| segeln       | Segeln | —            | (kein Event) |                                 |
| motor        | Segeln | motorsegeln  | "Motorsegeln"| "Segel gesetzt, Motor läuft"    |
| motorsegeln  | Segeln | motor        | "Motor an"   | "Segel geborgen, Motor läuft"   |
| null         | Segeln | segeln       | "Segeln"     | "Segeln gesetzt"                |

**`zustandAktualisieren()` – UI-Aktualisierung:**

- Motor-Button aktiv bei: "motor" ODER "motorsegeln"
- Segeln-Button aktiv bei: "segeln" ODER "motorsegeln"
- Wende/Halse/Reffen aktiviert bei: "segeln" ODER "motorsegeln"
- Anlegen aktiviert bei: "motor" ODER "motorsegeln"

**Auto-Events bei Stopp-Manövern:**

Beim Speichern von `schnellEintragSpeichern()`:
- Anlegen/Ankern/An Boje bei **Motor aktiv** → automatisch "Motor aus"-Event mit gleicher Zeit
- Anlegen/Ankern/An Boje bei **Segeln aktiv** → Note "Segel geborgen" auf Anlegen-Event
- Ablegen/Von Boje/Anker lichten bei **Segeln aktiv** → Note "Segeln aktiv"

**`antriebFuerTyp(typ)` – Fallback-Kette:**

```
1. typ === "Motorsegeln"     → "motorsegeln"
2. MOTOR_TYPEN.has(typ)     → "motor"
3. SEGEL_TYPEN.has(typ)     → "segeln"
4. typ === "Ablegen"|"Abfahrt":
     zustandErmitteln()?.zustand || antriebAusUI() || "motor"
5. alle anderen:
     zustandErmitteln()?.zustand || ""
```

---

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
"Reffen 1":      ["fahrt"]
"Reffen 2":      ["fahrt"]
Motor an, Segeln, Motorsegeln, Motor aus, Ruderwechsel: kein Eintrag → immer erlaubt
```

**ANTRIEB_PFLICHT_TYPEN** – Antrieb muss aktiv sein:

```
{ "Ablegen", "Abfahrt", "Anker lichten", "Von Boje" }
```

**antriebKonsistenzPruefen(typ, antrieb):**

Wende/Halse/Reffen/Reffen 1/Reffen 2 nur bei `antrieb === "segeln"` ODER `antrieb === "motorsegeln"`.

### UI-Sperren bei STOPP

| Element                                  | Bei STOPP                         |
| ---------------------------------------- | --------------------------------- |
| Fahrt-Stopp-Bar (Anlegen/Ankern/An Boje) | ausgeblendet → Start-Bar sichtbar |
| Manöver-Grid (Wende/Halse/Reffen)        | ausgeblendet                      |
| Rudergänger-Button                       | immer sichtbar                    |
| Motor/Segeln-Buttons                     | immer sichtbar                    |

---

## NOTIZ-POPUP

Das Notiz-Popup öffnet sich über „💬 Manöver" (letztes Event bearbeiten) oder „📝 Notiz" (neuen Notiz-Event anlegen).

**notizUndSpeichern(typ, autoNotiz?):**

- `autoNotiz` (optional): wird als Notiz gesetzt wenn `_pendingNote` leer
- Wird von `zustandSetzen()` und `schnellEintragSpeichern()` für Auto-Notizen genutzt

**Globale Variablen (modals.js):**

```js
let _pendingNote = ""; // Inhalt für nächsten Event-Save
let _notizResolve = null;
let _notizSpeechRunning = false;
let _notizSpeechRecog = null;
```

---

## MOB-LOGIK (ab v2.5.x)

### mobSpeichern() – bypass Validierung

Erstellt MOB-Event **ohne** Prüfung auf aktiven Törn oder Rudergänger.
Ruft GPS asynchron ab (8s Timeout). Ruft `mobOverlayPositionAktualisieren()` wenn GPS verfügbar.

### mobGeborgenSpeichern(notiz, dauerSek, mobTyp)

Speichert Recovery-Event mit typ-abhängigem Label:

| mobTyp  | Event-Type        | Notiz-Vorlage                      |
| ------- | ----------------- | ---------------------------------- |
| mob     | "MOB geborgen"    | "Mann über Bord geborgen nach Xmin Ys" |
| boje    | "Boje geborgen"   | "Boje geborgen nach Xmin Ys"       |
| uebung  | "MOB Übung beendet" | "MOB Übung beendet nach Xmin Ys" |

### MOB-Overlay

- Typ-Auswahl: 🆘 MOB / 🔵 Boje / 🎓 Übung
- Vergangen-Timer (MM:SS, läuft bis "GEBORGEN")
- GPS-Position (aktualisiert sich wenn verfügbar)
- Zweisprachiger Mayday-Text (DE + EN) mit Schiffsname

---

## LOGBUCH-SCROLL (ab v2.5.x)

### logbuchScrollHoeheAnpassen()

Misst zur Laufzeit den unteren Rand von `#logbuch-sticky` und setzt
`#logbuch-daten-scroll` Höhe dynamisch:

```js
hoehe = Math.max(150, window.innerHeight - stickyBottom - bottomH - 16)
```

Wird aufgerufen bei:
- `hauptTabWechseln()` → Tab-Wechsel
- `tabInhaltToggeln()` → Törn-Auswahl
- `window resize`

---

## TRACK LOGIK

Track-Aufzeichnung ist in **`track.js`** ausgelagert (ab v2.5.0).
`app.js` ruft nur `trackStarten()`, `trackStoppen()` und `trackManöverPunkt()` auf.

### Manöverpunkte: trackManöverPunkt()

Bei jedem Event-Save ruft `schnellEintragSpeichern()` `trackManöverPunkt()` auf
(wenn GPS verfügbar). Manöverpunkte werden **immer** gespeichert – kein Distanz-Check.

Auch `gpsAbfragen()` ruft `trackManöverPunkt()` auf wenn GPS verfügbar.

### Start-Boost

60 Sekunden nach `trackStarten()`: Intervall = 10 s, Mindestdistanz = 0 m.
Danach zurück auf Nutzereinstellungen.

---

## DATENMODELL (Event)

```js
{
  id:           string,   // generateId()
  type:         string,   // "Wende", "Motor an", "Motorsegeln", "Motor aus", …
  kategorie:    string,   // kategorieFuerTyp(type)
  antrieb:      string,   // "segeln" | "motor" | "motorsegeln" | ""
  zeit:         string,   // "2026-03-21T14:35:00" (ISO, 19 Zeichen)
  ort:          string,
  rudergaenger: { name: string } | null,
  note:         string,
  weather:      { windForce, windKnots, windDirection, description } | null,
  pos:          { lat, lon, sog } | null
}
```

---

## LIVE-POSITION

`livePositionAktualisieren(lat, lon, sogKn)` wird von `_trackWatchCallback()` aufgerufen.

- Ruft zuerst `logbuchKarteLiveAktualisieren(lat, lon)` auf (unabhängig von Haupt-Karte)
- Erstellt `_liveMarker` + `_liveCircle` auf `_hauptKarte` wenn Karte-Tab aktiv
- `liveMarkerEntfernen()` entfernt Marker bei Törn-Wechsel und Track-Stopp

---

## LOCALSTORAGE KEYS

| Key                              | Inhalt                                           |
| -------------------------------- | ------------------------------------------------ |
| `segel_logbuch_trips`            | Array aller Törns                                |
| `segel_logbuch_stopp`            | aktueller Fahrt-Zustand ("hafen"/"fahrt"/…)      |
| `segel_logbuch_aktiver_toern`    | tripId des aktiven Törns                         |
| `last_values`                    | letzter Rudergänger + Wind                       |
| `segel_logbuch_autobackup`       | automatisches Backup                             |
| `segel_logbuch_backup_permanent` | permanentes Backup                               |
| `segel_track_distanz`            | Track-Auflösung in nm (0.05/0.1/0.2/0.3/0.4/0.5) |
| `segel_sog_schwelle`             | SOG-Schwelle für GPS-Jitter-Filter (kn)          |
| `segel_track_intervall`          | Fallback-Intervall in Sekunden (30–180)          |
| `segel_track_accuracy`           | Max. GPS-Ungenauigkeit in Metern (25/50/100/200) |
