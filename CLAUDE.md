# Entwicklungsregeln – Segellogbuch

## ⛔ Pflicht vor jeder Änderung

1. **LOGIK.md lesen** bevor UI oder Logik angefasst wird
2. **Geschützte Funktionen** aus LOGIK.md **NIE verändern** (zustandAktualisieren, hafenSperrungAktualisieren, stoppZustandSpeichern, schnellEintragSpeichern, gpsAbfragen, stoppZustandLaden)
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
- `track.js` – GPS-Track-Aufzeichnung (watchPosition, haversineKm, trackDistanz*)

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

## Validierung
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
