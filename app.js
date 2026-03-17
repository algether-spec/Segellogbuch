/* ======================
   APP.JS
   Logik und UI-Steuerung
====================== */

let aktuellerToern = null;

/* --- DOM-Elemente ----------------------------------------------- */

const toernSelect       = document.getElementById("toern-select");
const btnNeuerToern     = document.getElementById("btn-neuer-toern");
const btnToernLoeschen  = document.getElementById("btn-toern-loeschen");
const btnSpeichern      = document.getElementById("btn-speichern");

const fldTripName   = document.getElementById("fld-tripname");
const fldStartDate  = document.getElementById("fld-start-date");
const fldStartTime  = document.getElementById("fld-start-time");
const fldEndDate    = document.getElementById("fld-end-date");
const fldEndTime    = document.getElementById("fld-end-time");
const fldSkipper    = document.getElementById("fld-skipper");

const fldShipName   = document.getElementById("fld-ship-name");
const fldShipType   = document.getElementById("fld-ship-type");
const fldShipReg    = document.getElementById("fld-ship-reg");
const fldShipEngine = document.getElementById("fld-ship-engine");

const fldNotes      = document.getElementById("fld-notes");

const crewList      = document.getElementById("crew-list");
const crewInput     = document.getElementById("crew-input");
const crewRole      = document.getElementById("crew-role");
const btnCrewAdd    = document.getElementById("btn-crew-add");

const statusMsg       = document.getElementById("status-msg");
const formSection     = document.getElementById("form-section");
const toernUebersicht      = document.getElementById("toern-uebersicht");
const toernStatistik       = document.getElementById("toern-statistik");
const toernAbschlussDiv    = document.getElementById("toern-abschluss");
const abschlussDruckBereich = document.getElementById("abschluss-druck-bereich");

const eventType     = document.getElementById("event-type");
const eventDate     = document.getElementById("event-date");
const eventTime     = document.getElementById("event-time");
const eventOrt          = document.getElementById("event-ort");
const eventRuder        = document.getElementById("event-ruder");
const eventNote         = document.getElementById("event-note");
const btnEventAdd       = document.getElementById("btn-event-add");
const eventList         = document.getElementById("event-list");
const btnWetterToggle   = document.getElementById("btn-wetter-toggle");
const eventWetterFelder = document.getElementById("event-wetter-felder");
const eventWindForce    = document.getElementById("event-wind-force");
const eventWindDir      = document.getElementById("event-wind-dir");
const eventWetterDesc   = document.getElementById("event-wetter-desc");


/* --- Hilfsfunktionen -------------------------------------------- */

function statusSetzen(text, typ = "ok") {
    statusMsg.textContent = text;
    statusMsg.className = "status-msg status-" + typ;
    statusMsg.hidden = !text;
    if (text) setTimeout(() => { statusMsg.hidden = true; }, 3000);
}

function validieren() {
    if (!fldTripName.value.trim()) {
        statusSetzen("Törnname darf nicht leer sein.", "error");
        fldTripName.focus();
        return false;
    }
    if (!fldSkipper.value.trim()) {
        statusSetzen("Schiffsführer darf nicht leer sein.", "error");
        fldSkipper.focus();
        return false;
    }
    return true;
}


/* --- Törnauswahl ------------------------------------------------ */

function toernSelectAktualisieren() {
    const alle = alleToernsLaden();
    toernSelect.innerHTML = '<option value="">— Törn auswählen —</option>';
    alle.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.tripId;
        opt.textContent = t.tripName || "(ohne Name)";
        if (t.startDate) opt.textContent += "  · " + t.startDate;
        toernSelect.appendChild(opt);
    });
    if (aktuellerToern) toernSelect.value = aktuellerToern.tripId;
    toernUebersichtRendern();
}


/* --- Formular füllen / lesen ------------------------------------ */

function formularFuellen(toern) {
    fldTripName.value   = toern.tripName   || "";
    fldStartDate.value  = toern.startDate  || "";
    fldStartTime.value  = toern.startTime  || "";
    fldEndDate.value    = toern.endDate    || "";
    fldEndTime.value    = toern.endTime    || "";
    fldSkipper.value    = toern.skipper    || "";
    fldShipName.value   = toern.shipData?.name         || "";
    fldShipType.value   = toern.shipData?.type         || "";
    fldShipReg.value    = toern.shipData?.registration || "";
    fldShipEngine.value = toern.shipData?.engine       || "";
    fldNotes.value      = toern.notes || "";
    crewListeRendern(toern.crew || []);
    ereignisListeRendern(toern.events || []);
    rudergaengerSelectFuellen();
    ereignisZeitVorbefuellen();
    toernStatistikRendern(toernStatistikBerechnen(toern));
    toernAbschlussRendern(toernAbschlussBerechnen(toern));
}

function formularLesen() {
    aktuellerToern.tripName  = fldTripName.value.trim();
    aktuellerToern.startDate = fldStartDate.value;
    aktuellerToern.startTime = fldStartTime.value;
    aktuellerToern.endDate   = fldEndDate.value;
    aktuellerToern.endTime   = fldEndTime.value;
    aktuellerToern.skipper   = fldSkipper.value.trim();
    aktuellerToern.shipData  = {
        name:         fldShipName.value.trim(),
        type:         fldShipType.value.trim(),
        registration: fldShipReg.value.trim(),
        engine:       fldShipEngine.value.trim()
    };
    aktuellerToern.notes = fldNotes.value.trim();
}


/* --- Crew ------------------------------------------------------- */

function crewListeRendern(crew) {
    crewList.innerHTML = "";
    if (crew.length === 0) {
        crewList.innerHTML = '<li class="crew-empty">Noch keine Crew eingetragen.</li>';
        return;
    }
    crew.forEach(person => {
        const li = document.createElement("li");
        li.className = "crew-item";

        const info = document.createElement("span");
        info.className = "crew-info";
        info.textContent = person.name + (person.role ? " · " + person.role : "");

        const del = document.createElement("button");
        del.type = "button";
        del.className = "btn-crew-del";
        del.textContent = "✕";
        del.onclick = () => {
            aktuellerToern.crew = aktuellerToern.crew.filter(c => c.id !== person.id);
            crewListeRendern(aktuellerToern.crew);
        };

        li.appendChild(info);
        li.appendChild(del);
        crewList.appendChild(li);
    });
}

function crewHinzufuegen() {
    const name = crewInput.value.trim();
    if (!name) {
        statusSetzen("Crew-Name darf nicht leer sein.", "error");
        crewInput.focus();
        return;
    }
    const person = {
        id:   generateId(),
        name,
        role: crewRole.value.trim() || "Crew"
    };
    aktuellerToern.crew.push(person);
    crewListeRendern(aktuellerToern.crew);
    crewInput.value = "";
    crewRole.value  = "Crew";
    crewInput.focus();
}


/* --- Ereignisse ------------------------------------------------- */

function ereignisZeitVorbefuellen() {
    const now = new Date();
    const pad = n => String(n).padStart(2, "0");
    eventDate.value = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
    eventTime.value = pad(now.getHours()) + ":" + pad(now.getMinutes());
}

function rudergaengerSelectFuellen() {
    /* Globale Crew + aktuelle Törn-Crew kombinieren */
    const global     = ladeCrew();
    const toernNamen = aktuellerToern ? (aktuellerToern.crew || []).map(p => p.name) : [];
    const alle       = [...new Set([...global, ...toernNamen])].filter(Boolean);

    eventRuder.innerHTML = '<option value="">— Rudergänger —</option>';
    if (alle.length === 0) {
        eventRuder.disabled = true;
        eventRuder.title    = "Bitte zuerst Crew hinzufügen";
        return;
    }
    eventRuder.disabled = false;
    eventRuder.title    = "";
    alle.forEach(name => {
        const opt = document.createElement("option");
        opt.value       = name;
        opt.textContent = name;
        eventRuder.appendChild(opt);
    });
}

function ereignisListeRendern(events) {
    eventList.innerHTML = "";
    if (!events || events.length === 0) {
        eventList.innerHTML = '<li class="event-empty">Noch keine Ereignisse eingetragen.</li>';
        return;
    }
    const sortiert = [...events].sort((a, b) => {
        const da = (a.date || "") + "T" + (a.time || "00:00");
        const db = (b.date || "") + "T" + (b.time || "00:00");
        return da < db ? -1 : da > db ? 1 : 0;
    });
    sortiert.forEach(ev => {
        const li = document.createElement("li");
        li.className = "event-item";

        const info = document.createElement("span");
        info.className = "event-info";
        const zeitstempel = [ev.date, ev.time].filter(Boolean).join(" ");
        const meta = [zeitstempel, ev.ort, ev.rudergaenger ? "Rudergänger: " + ev.rudergaenger.name : ""].filter(Boolean).join("  ·  ");
        const w = ev.weather;
        const wetterText = w
            ? [w.windForce !== null && w.windForce !== undefined ? "Wind: " + w.windForce + " Bft" : "", w.windDirection, w.description].filter(Boolean).join(", ")
            : "";
        info.innerHTML = '<span class="event-type">' + ev.type + '</span>'
            + (meta ? '<span class="event-time-label">' + meta + '</span>' : '')
            + (ev.note ? '<span class="event-note-text">' + ev.note + '</span>' : '')
            + (wetterText ? '<span class="event-wetter-text">🌬 ' + wetterText + '</span>' : '');

        const del = document.createElement("button");
        del.type = "button";
        del.className = "btn-crew-del";
        del.textContent = "✕";
        del.onclick = () => {
            aktuellerToern.events = aktuellerToern.events.filter(e => e.id !== ev.id);
            ereignisListeRendern(aktuellerToern.events);
        };

        li.appendChild(info);
        li.appendChild(del);
        eventList.appendChild(li);
    });
    if (aktuellerToern) {
        toernStatistikRendern(toernStatistikBerechnen(aktuellerToern));
        toernAbschlussRendern(toernAbschlussBerechnen(aktuellerToern));
    }
}

function ereignisHinzufuegen() {
    if (!aktuellerToern) return;
    if (!eventType.value) {
        statusSetzen("Bitte einen Ereignistyp auswählen.", "error");
        eventType.focus();
        return;
    }
    if (!eventDate.value) {
        statusSetzen("Datum ist ein Pflichtfeld.", "error");
        eventDate.focus();
        return;
    }
    if (!eventTime.value) {
        statusSetzen("Uhrzeit ist ein Pflichtfeld.", "error");
        eventTime.focus();
        return;
    }
    const ruderName = eventRuder.value;
    const wetterOffen = !eventWetterFelder.hidden;
    const windForceVal = eventWindForce.value.trim();
    const ev = {
        id:           generateId(),
        type:         eventType.value,
        date:         eventDate.value,
        time:         eventTime.value,
        ort:          eventOrt.value.trim(),
        rudergaenger: ruderName ? { name: ruderName } : null,
        note:         eventNote.value.trim(),
        weather:      wetterOffen ? {
            windForce:     windForceVal !== "" ? Number(windForceVal) : null,
            windDirection: eventWindDir.value.trim(),
            description:   eventWetterDesc.value.trim()
        } : null
    };
    if (!aktuellerToern.events) aktuellerToern.events = [];
    aktuellerToern.events.push(ev);
    ereignisListeRendern(aktuellerToern.events);
    eventType.value      = "";
    eventOrt.value       = "";
    eventRuder.value     = "";
    eventNote.value      = "";
    eventWindForce.value = "";
    eventWindDir.value   = "";
    eventWetterDesc.value = "";
    eventWetterFelder.hidden = true;
    btnWetterToggle.textContent = "🌬 Wetter +";
    ereignisZeitVorbefuellen();
    eventType.focus();
}


/* --- Törnstatistik ---------------------------------------------- */

function evTimestamp(ev) {
    if (!ev.date || !ev.time) return null;
    return new Date(ev.date + "T" + ev.time).getTime();
}

function minutenAusPaaren(events, startTyp, endTyp) {
    const relevant = events
        .filter(e => e.type === startTyp || e.type === endTyp)
        .filter(e => evTimestamp(e) !== null)
        .sort((a, b) => evTimestamp(a) - evTimestamp(b));
    let minuten = 0, startTs = null;
    for (const ev of relevant) {
        if (ev.type === startTyp && startTs === null) {
            startTs = evTimestamp(ev);
        } else if (ev.type === endTyp && startTs !== null) {
            const ts = evTimestamp(ev);
            if (ts > startTs) minuten += (ts - startTs) / 60000;
            startTs = null;
        }
    }
    return Math.round(minuten);
}

function toernStatistikBerechnen(toern) {
    const events = toern.events || [];

    const proTyp = {};
    for (const ev of events) {
        proTyp[ev.type] = (proTyp[ev.type] || 0) + 1;
    }

    return {
        gesamt:     events.length,
        proTyp,
        unterSegel: minutenAusPaaren(events, "Abfahrt",    "Ankunft"),
        mitMotor:   minutenAusPaaren(events, "Motorbetrieb", "Motorbetrieb"),
        anker:      minutenAusPaaren(events, "Ankersetzen", "Anker auf"),
        hafen:      minutenAusPaaren(events, "Ankunft",    "Abfahrt")
    };
}

function zeitFormatieren(minuten) {
    if (!minuten) return "—";
    const h = Math.floor(minuten / 60);
    const m = minuten % 60;
    if (h === 0) return m + "min";
    if (m === 0) return h + "h";
    return h + "h " + m + "min";
}

function toernStatistikRendern(stat) {
    if (!stat) { toernStatistik.innerHTML = ""; return; }

    const typZeilen = Object.entries(stat.proTyp)
        .sort((a, b) => b[1] - a[1])
        .map(([typ, anz]) =>
            `<li><span class="stat-typ">${typ}</span><span class="stat-anz">${anz}×</span></li>`)
        .join("");

    const zeiten = [
        { label: "Unter Segel",  wert: stat.unterSegel },
        { label: "Mit Motor",    wert: stat.mitMotor    },
        { label: "Vor Anker",    wert: stat.anker       },
        { label: "Im Hafen",     wert: stat.hafen       }
    ].filter(z => z.wert > 0);

    const zeitZeilen = zeiten.length
        ? zeiten.map(z =>
            `<li><span class="stat-typ">${z.label}</span><span class="stat-anz">${zeitFormatieren(z.wert)}</span></li>`
          ).join("")
        : "";

    toernStatistik.innerHTML = `
        <div class="card stat-card">
            <h2>📊 Statistik</h2>
            <div class="stat-grid">
                <div class="stat-block">
                    <div class="stat-block-title">Ereignisse gesamt</div>
                    <div class="stat-gesamt">${stat.gesamt}</div>
                    ${stat.gesamt > 0 ? `<ul class="stat-liste">${typZeilen}</ul>` : ""}
                </div>
                ${zeitZeilen ? `
                <div class="stat-block">
                    <div class="stat-block-title">Zeiten</div>
                    <ul class="stat-liste">${zeitZeilen}</ul>
                </div>` : ""}
            </div>
        </div>`;
}


/* --- Törnabschluss ---------------------------------------------- */

function toernAbschlussBerechnen(toern) {
    const stat = toernStatistikBerechnen(toern);
    return {
        tripName:  toern.tripName  || "(ohne Name)",
        zeitraum:  [toern.startDate, toern.endDate].filter(Boolean).join(" – ") || "—",
        skipper:   toern.skipper   || "—",
        shipData:  toern.shipData  || {},
        crew:      toern.crew      || [],
        events:    (toern.events   || []).slice().sort((a, b) => {
            const da = (a.date || "") + "T" + (a.time || "00:00");
            const db = (b.date || "") + "T" + (b.time || "00:00");
            return da < db ? -1 : da > db ? 1 : 0;
        }),
        stat
    };
}

function toernAbschlussRendern(ab) {
    if (!ab) { toernAbschlussDiv.innerHTML = ""; return; }

    const sd = ab.shipData;
    const schiffZeilen = [
        sd.name         ? `<li><span>Schiff</span><span>${sd.name}</span></li>`         : "",
        sd.type         ? `<li><span>Bootstyp</span><span>${sd.type}</span></li>`        : "",
        sd.registration ? `<li><span>Kennzeichen</span><span>${sd.registration}</span></li>` : "",
        sd.engine       ? `<li><span>Motor</span><span>${sd.engine}</span></li>`         : ""
    ].join("");

    const crewZeilen = ab.crew.length
        ? ab.crew.map(p => `<li>${p.name}${p.role ? " · " + p.role : ""}</li>`).join("")
        : "<li>—</li>";

    const eventZeilen = ab.events.length
        ? ab.events.map(ev => {
            const w = ev.weather;
            return `<tr>
                <td>${ev.type || ""}</td>
                <td>${ev.date || ""}</td>
                <td>${ev.time || ""}</td>
                <td>${ev.ort  || ""}</td>
                <td>${ev.rudergaenger ? ev.rudergaenger.name : ""}</td>
                <td>${w && ev.weather.windForce !== null && ev.weather.windForce !== undefined ? ev.weather.windForce : ""}</td>
                <td>${w ? ev.weather.windDirection || "" : ""}</td>
                <td>${w ? ev.weather.description  || "" : ""}</td>
                <td>${ev.note || ""}</td>
            </tr>`;
        }).join("")
        : `<tr><td colspan="9" class="ab-leer">Keine Ereignisse</td></tr>`;

    const zeiten = [
        ["Unter Segel", ab.stat.unterSegel],
        ["Mit Motor",   ab.stat.mitMotor],
        ["Im Hafen",    ab.stat.hafen],
        ["Vor Anker",   ab.stat.anker]
    ].filter(([, m]) => m > 0)
     .map(([l, m]) => `<li><span>${l}</span><span>${zeitFormatieren(m)}</span></li>`)
     .join("");

    toernAbschlussDiv.innerHTML = `
        <div class="card">
            <h2>📋 Törnabschluss</h2>

            <div class="ab-grid">
                <div class="ab-block">
                    <div class="ab-block-title">Törn</div>
                    <ul class="ab-liste">
                        <li><span>Name</span><span>${ab.tripName}</span></li>
                        <li><span>Zeitraum</span><span>${ab.zeitraum}</span></li>
                        <li><span>Schiffsführer</span><span>${ab.skipper}</span></li>
                        ${schiffZeilen}
                    </ul>
                </div>
                <div class="ab-block">
                    <div class="ab-block-title">Crew (${ab.crew.length})</div>
                    <ul class="ab-liste">${crewZeilen}</ul>
                </div>
                ${zeiten ? `<div class="ab-block">
                    <div class="ab-block-title">Zeiten</div>
                    <ul class="ab-liste">${zeiten}</ul>
                </div>` : ""}
            </div>

            <div class="ab-block-title" style="margin-top:14px;margin-bottom:8px;">Ereignisse (${ab.events.length})</div>
            <div class="ab-tabelle-wrap">
                <table class="ab-tabelle">
                    <thead><tr>
                        <th>Typ</th><th>Datum</th><th>Zeit</th><th>Ort</th>
                        <th>Rudergänger</th><th>Bft</th><th>Richtung</th><th>Wetter</th><th>Notiz</th>
                    </tr></thead>
                    <tbody>${eventZeilen}</tbody>
                </table>
            </div>
        </div>`;
}

function abschlussdrucken() {
    if (!aktuellerToern) return;
    const ab = toernAbschlussBerechnen(aktuellerToern);
    const sd = ab.shipData;

    const schiffMeta = [sd.name, sd.type, sd.registration].filter(Boolean).join(" · ");
    const crewText   = ab.crew.map(p => p.name + (p.role ? " (" + p.role + ")" : "")).join(", ") || "—";

    const zeiten = [
        ["Unter Segel", ab.stat.unterSegel],
        ["Mit Motor",   ab.stat.mitMotor],
        ["Im Hafen",    ab.stat.hafen],
        ["Vor Anker",   ab.stat.anker]
    ].filter(([, m]) => m > 0)
     .map(([l, m]) => `<span>${l}: <strong>${zeitFormatieren(m)}</strong></span>`)
     .join("&nbsp;&nbsp;·&nbsp;&nbsp;");

    const eventZeilen = ab.events.map(ev => {
        const w = ev.weather;
        return `<tr>
            <td>${ev.type || ""}</td>
            <td>${ev.date || ""}</td>
            <td>${ev.time || ""}</td>
            <td>${ev.ort  || ""}</td>
            <td>${ev.rudergaenger ? ev.rudergaenger.name : ""}</td>
            <td>${w && ev.weather.windForce !== null && ev.weather.windForce !== undefined ? ev.weather.windForce : ""}</td>
            <td>${w ? ev.weather.windDirection || "" : ""}</td>
            <td>${w ? ev.weather.description  || "" : ""}</td>
            <td>${ev.note || ""}</td>
        </tr>`;
    }).join("") || `<tr><td colspan="9" style="text-align:center;color:#666;font-style:italic;padding:6mm">Keine Ereignisse</td></tr>`;

    abschlussDruckBereich.innerHTML = `
        <div class="adp-header">
            <h1>${ab.tripName}</h1>
            <div class="adp-meta-row">
                <span>Zeitraum: <strong>${ab.zeitraum}</strong></span>
                <span>Schiffsführer: <strong>${ab.skipper}</strong></span>
                ${schiffMeta ? `<span>Schiff: <strong>${schiffMeta}</strong></span>` : ""}
            </div>
            <div class="adp-meta-row">Crew: ${crewText}</div>
            ${zeiten ? `<div class="adp-zeiten">${zeiten}</div>` : ""}
        </div>
        <table class="adp-tabelle">
            <thead><tr>
                <th>Typ</th><th>Datum</th><th>Zeit</th><th>Ort</th>
                <th>Rudergänger</th><th>Bft</th><th>Richtung</th><th>Wetter</th><th>Notiz</th>
            </tr></thead>
            <tbody>${eventZeilen}</tbody>
        </table>
        <div class="adp-fusszeile">
            Segellogbuch · Törnabschluss · Erstellt am ${new Date().toLocaleDateString("de-DE")}
        </div>`;

    window.print();
}


/* --- Törnübersicht ---------------------------------------------- */

function toernUebersichtRendern() {
    const alle = alleToernsLaden();
    if (alle.length === 0) {
        toernUebersicht.innerHTML = '<div class="card"><h2>🗂 Alle Törns</h2><p class="tu-leer">Noch keine Törns vorhanden.</p></div>';
        return;
    }
    const items = alle.map(t => {
        const zeitraum = [t.startDate, t.endDate].filter(Boolean).join(" – ") || "—";
        const anzahl   = (t.events || []).length;

        const li = document.createElement("li");
        li.className = "tu-item" + (aktuellerToern && aktuellerToern.tripId === t.tripId ? " tu-aktiv" : "");

        const main = document.createElement("button");
        main.type = "button";
        main.className = "tu-main";
        main.innerHTML =
            '<span class="tu-name">' + (t.tripName || "(ohne Name)") + '</span>' +
            '<span class="tu-meta">' + zeitraum + '</span>' +
            '<span class="tu-meta">' + (t.skipper ? '👤 ' + t.skipper : '') + '</span>' +
            '<span class="tu-badge">' + anzahl + ' Ereignis' + (anzahl !== 1 ? 'se' : '') + '</span>';
        main.onclick = () => toernLaden(t.tripId);

        const del = document.createElement("button");
        del.type = "button";
        del.className = "tu-del";
        del.textContent = "✕";
        del.title = "Törn löschen";
        del.onclick = (e) => {
            e.stopPropagation();
            if (!confirm(`Törn "${t.tripName || "(ohne Name)"}" wirklich löschen?`)) return;
            toernLoeschen(t.tripId);
            if (aktuellerToern && aktuellerToern.tripId === t.tripId) {
                aktuellerToern = null;
                formSection.hidden = true;
                btnToernLoeschen.hidden = true;
                toernSelect.value = "";
            }
            toernSelectAktualisieren();
            statusSetzen("Törn gelöscht.", "ok");
        };

        li.appendChild(main);
        li.appendChild(del);
        return li;
    });

    const ul = document.createElement("ul");
    ul.className = "tu-liste";
    items.forEach(li => ul.appendChild(li));

    toernUebersicht.innerHTML = '<div class="card"><h2>🗂 Alle Törns</h2></div>';
    toernUebersicht.querySelector(".card").appendChild(ul);
}


/* --- Aktionen --------------------------------------------------- */

function toernLaden(tripId) {
    const alle = alleToernsLaden();
    const toern = alle.find(t => t.tripId === tripId);
    if (!toern) return;
    aktuellerToern = toern;
    formSection.hidden = false;
    btnToernLoeschen.hidden = false;
    formularFuellen(aktuellerToern);
    toernSelectAktualisieren();
}

function neuerToernAnlegen() {
    aktuellerToern = neuerToern();
    formularFuellen(aktuellerToern);
    formSection.hidden = false;
    btnToernLoeschen.hidden = true;
    toernSelect.value = "";
    fldTripName.focus();
    statusSetzen("Neuer Törn angelegt.", "ok");
}

function toernSpeichernAktion() {
    if (!aktuellerToern) return;
    if (!validieren()) return;
    formularLesen();
    toernSpeichern(aktuellerToern);
    toernSelectAktualisieren();
    btnToernLoeschen.hidden = false;
    statusSetzen("Törn gespeichert.", "ok");
}

function toernLoeschenAktion() {
    if (!aktuellerToern) return;
    if (!confirm(`Törn "${aktuellerToern.tripName || "(ohne Name)"}" wirklich löschen?`)) return;
    toernLoeschen(aktuellerToern.tripId);
    aktuellerToern = null;
    formSection.hidden = true;
    btnToernLoeschen.hidden = true;
    toernSelect.value = "";
    toernSelectAktualisieren();
    statusSetzen("Törn gelöscht.", "ok");
}


/* --- Druck / PDF ------------------------------------------------ */

function druckenVorbereiten() {
    if (!aktuellerToern) return;
    const t = aktuellerToern;

    const zeitraum = [t.startDate, t.endDate].filter(Boolean).join(" – ") || "—";

    const events = (t.events || [])
        .slice()
        .sort((a, b) => {
            const da = (a.date || "") + "T" + (a.time || "00:00");
            const db = (b.date || "") + "T" + (b.time || "00:00");
            return da < db ? -1 : da > db ? 1 : 0;
        });

    const zeilen = events.map(ev => {
        const w = ev.weather;
        return `<tr>
            <td>${ev.type || ""}</td>
            <td>${ev.date || ""}</td>
            <td>${ev.time || ""}</td>
            <td>${ev.ort || ""}</td>
            <td>${ev.rudergaenger ? ev.rudergaenger.name : ""}</td>
            <td>${w && ev.weather.windForce !== null && ev.weather.windForce !== undefined ? ev.weather.windForce : ""}</td>
            <td>${w ? ev.weather.windDirection || "" : ""}</td>
            <td>${w ? ev.weather.description || "" : ""}</td>
            <td>${ev.note || ""}</td>
        </tr>`;
    }).join("");

    const leer = events.length === 0
        ? '<tr><td colspan="9" class="dp-leer">Keine Ereignisse vorhanden.</td></tr>'
        : zeilen;

    document.getElementById("druck-bereich").innerHTML = `
        <div class="dp-header">
            <h1>${t.tripName || "(ohne Name)"}</h1>
            <div class="dp-meta">
                <span>Zeitraum: ${zeitraum}</span>
                <span>Schiffsführer: ${t.skipper || "—"}</span>
                ${t.shipData && t.shipData.name ? '<span>Schiff: ' + t.shipData.name + '</span>' : ''}
            </div>
        </div>
        <table class="dp-tabelle">
            <thead>
                <tr>
                    <th>Typ</th>
                    <th>Datum</th>
                    <th>Zeit</th>
                    <th>Ort</th>
                    <th>Rudergänger</th>
                    <th>Wind Bft</th>
                    <th>Windrichtung</th>
                    <th>Wetter</th>
                    <th>Notiz</th>
                </tr>
            </thead>
            <tbody>${leer}</tbody>
        </table>
        <div class="dp-fusszeile">Segellogbuch · Erstellt am ${new Date().toLocaleDateString("de-DE")}</div>
    `;

    window.print();
}


/* --- CSV-Export ------------------------------------------------- */

function csvFeldEscapen(wert) {
    const s = wert === null || wert === undefined ? "" : String(wert);
    return s.includes(";") || s.includes('"') || s.includes("\n")
        ? '"' + s.replace(/"/g, '""') + '"'
        : s;
}

function csvExportieren() {
    if (!aktuellerToern) return;
    const t = aktuellerToern;
    const kopfzeile = "Toernname;Datum;Zeit;Typ;Ort;Rudergänger;Wind Bft;Wind Richtung;Wetter;Notiz";
    const zeilen = (t.events || [])
        .slice()
        .sort((a, b) => {
            const da = (a.date || "") + "T" + (a.time || "00:00");
            const db = (b.date || "") + "T" + (b.time || "00:00");
            return da < db ? -1 : da > db ? 1 : 0;
        })
        .map(ev => [
            t.tripName,
            ev.date,
            ev.time,
            ev.type,
            ev.ort,
            ev.rudergaenger ? ev.rudergaenger.name : "",
            ev.weather ? (ev.weather.windForce !== null && ev.weather.windForce !== undefined ? ev.weather.windForce : "") : "",
            ev.weather ? ev.weather.windDirection : "",
            ev.weather ? ev.weather.description : "",
            ev.note
        ].map(csvFeldEscapen).join(";"));

    const inhalt = "\uFEFF" + [kopfzeile, ...zeilen].join("\r\n");
    const blob = new Blob([inhalt], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    const datum = new Date().toISOString().slice(0, 10);
    const name  = (t.tripName || "Toern").replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, "_");
    a.href     = url;
    a.download = "Toern_" + name + "_" + datum + ".csv";
    a.click();
    URL.revokeObjectURL(url);
}


/* --- Event Listener --------------------------------------------- */

btnNeuerToern.onclick    = neuerToernAnlegen;
btnSpeichern.onclick     = toernSpeichernAktion;
btnToernLoeschen.onclick = toernLoeschenAktion;
btnCrewAdd.onclick       = crewHinzufuegen;
btnEventAdd.onclick      = ereignisHinzufuegen;
document.getElementById("btn-csv-export").onclick  = csvExportieren;
document.getElementById("btn-json-export").onclick = exportJSON;
document.getElementById("btn-drucken").onclick        = druckenVorbereiten;
document.getElementById("btn-abschluss-druck").onclick = abschlussdrucken;

eventRuder.addEventListener("mousedown", () => {
    rudergaengerSelectFuellen();
});

btnWetterToggle.onclick = () => {
    const offen = eventWetterFelder.hidden;
    eventWetterFelder.hidden = !offen;
    btnWetterToggle.textContent = offen ? "🌬 Wetter −" : "🌬 Wetter +";
};

crewInput.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); crewHinzufuegen(); }
});

toernSelect.onchange = () => {
    const val = toernSelect.value;
    if (val) toernLaden(val);
    else { formSection.hidden = true; aktuellerToern = null; }
};


/* --- Start ------------------------------------------------------ */

toernSelectAktualisieren();
formSection.hidden = true;
btnToernLoeschen.hidden = true;
statusMsg.hidden = true;
