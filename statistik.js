/* ======================
   STATISTIK.JS – Törnstatistik, Trackliste, Törnabschluss, Törnübersicht
====================== */

/* --- Törnstatistik ---------------------------------------------- */

function evTimestamp(ev) {
    const iso = ev.zeit || (ev.date ? ev.date + "T" + (ev.time || "00:00") : null);
    if (!iso) return null;
    return new Date(iso).getTime();
}

function motorUndSegelMinuten(events) {
    const zustandEvents = events
        .filter(e => MOTOR_TYPEN.has(e.type) || SEGEL_TYPEN.has(e.type))
        .filter(e => evTimestamp(e) !== null)
        .sort((a, b) => evTimestamp(a) - evTimestamp(b));
    let motorMin = 0, segelMin = 0;
    for (let i = 0; i < zustandEvents.length - 1; i++) {
        const cur  = zustandEvents[i];
        const next = zustandEvents[i + 1];
        const dt   = (evTimestamp(next) - evTimestamp(cur)) / 60000;
        if (MOTOR_TYPEN.has(cur.type)) motorMin += dt;
        else if (SEGEL_TYPEN.has(cur.type)) segelMin += dt;
    }
    return { motorMin: Math.round(motorMin), segelMin: Math.round(segelMin) };
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

function nmProRudergaenger(toern) {
    const pts = (toern.track?.points || []).slice().sort((a, b) => a.zeit < b.zeit ? -1 : 1);
    const events = (toern.events || [])
        .filter(e => e.rudergaenger?.name && evZeitIso(e))
        .sort((a, b) => evZeitIso(a) < evZeitIso(b) ? -1 : 1);
    if (!pts.length || !events.length) return {};
    const kmMap = {};
    for (let i = 1; i < pts.length; i++) {
        const p = pts[i - 1];
        let aktRuder = null;
        for (const ev of events) {
            if (evZeitIso(ev) <= p.zeit) aktRuder = ev.rudergaenger.name;
            else break;
        }
        if (!aktRuder) continue;
        kmMap[aktRuder] = (kmMap[aktRuder] || 0) + haversineKm(p.lat, p.lon, pts[i].lat, pts[i].lon);
    }
    const nmMap = {};
    for (const [name, km] of Object.entries(kmMap)) {
        nmMap[name] = parseFloat((km * 0.539957).toFixed(1));
    }
    return nmMap;
}

function toernStatistikBerechnen(toern) {
    const events = toern.events || [];

    const proTyp = {};
    for (const ev of events) {
        proTyp[ev.type] = (proTyp[ev.type] || 0) + 1;
    }

    const { motorMin, segelMin } = motorUndSegelMinuten(events);

    return {
        gesamt:     events.length,
        proTyp,
        unterSegel: segelMin,
        mitMotor:   motorMin,
        anker:      minutenAusPaaren(events, "Ankersetzen", "Anker auf"),
        hafen:      minutenAusPaaren(events, "Ankunft",    "Abfahrt"),
        nmRuder:    nmProRudergaenger(toern)
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

    const nmRuderEintraege = Object.entries(stat.nmRuder || {})
        .sort((a, b) => b[1] - a[1]);
    const nmRuderZeilen = nmRuderEintraege
        .map(([name, nm]) =>
            `<li><span class="stat-typ">${name}</span><span class="stat-anz">${nm} nm</span></li>`)
        .join("");

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
                ${nmRuderZeilen ? `
                <div class="stat-block">
                    <div class="stat-block-title">Seemeilen pro Rudergänger</div>
                    <ul class="stat-liste">${nmRuderZeilen}</ul>
                </div>` : ""}
            </div>
        </div>`;
}


/* --- Trackliste ------------------------------------------------- */

function tracklisteRendern(toern) {
    const leer   = document.getElementById("trackliste-leer");
    const inhalt = document.getElementById("trackliste-inhalt");
    const body   = document.getElementById("trackliste-body");
    const info   = document.getElementById("trackliste-info");

    if (!toern) {
        leer.hidden = false; inhalt.hidden = true; return;
    }
    leer.hidden = true; inhalt.hidden = false;

    const pts = (toern.track?.points || []).slice().sort((a, b) => a.zeit < b.zeit ? -1 : 1);
    const nmGesamt = trackDistanzNm(pts);

    info.textContent = pts.length + " Punkte · " + nmGesamt + " nm gesamt";

    if (!pts.length) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;padding:1rem">Keine Track-Punkte vorhanden</td></tr>';
        return;
    }

    body.innerHTML = pts.map((p, i) =>
        `<tr>
            <td>${i + 1}</td>
            <td>${p.zeit ? p.zeit.slice(11, 16) : "—"}</td>
            <td>${p.lat != null ? p.lat.toFixed(4) : "—"}</td>
            <td>${p.lon != null ? p.lon.toFixed(4) : "—"}</td>
            <td>${p.sog != null ? p.sog : "—"}</td>
        </tr>`
    ).join("");
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
        notes:     toern.notes     || "",
        events:    (toern.events || []).slice().sort((a, b) =>
            evZeitIso(a) < evZeitIso(b) ? -1 : evZeitIso(a) > evZeitIso(b) ? 1 : 0
        ),
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
            const w   = ev.weather;
            const iso = evZeitIso(ev);
            const pos = posText(ev);
            return `<tr>
                <td>${ev.type || ""}</td>
                <td>${isoZuDatum(iso.slice(0, 10))}</td>
                <td>${iso.slice(11, 16)}</td>
                <td>${ev.ort  || ""}</td>
                <td>${ev.rudergaenger ? ev.rudergaenger.name : ""}</td>
                <td>${windText(w)}</td>
                <td>${w ? w.windDirection || "" : ""}</td>
                <td>${w ? w.description  || "" : ""}</td>
                <td>${ev.note || ""}</td>
                <td>${pos}</td>
                <td>${ev.pos != null ? (ev.pos.sog ?? 0) : ""}</td>
            </tr>`;
        }).join("")
        : `<tr><td colspan="11" class="ab-leer">Keine Ereignisse</td></tr>`;

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
                        <th>Rudergänger</th><th>Wind kn</th><th>Richtung</th><th>Wetter</th><th>Notiz</th><th>GPS</th><th>SOG kn</th>
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

    const schiffMeta = [sd.name, sd.type, sd.registration, sd.engine ? "Motor: " + sd.engine : ""].filter(Boolean).join(" · ");
    const crewText   = ab.crew.map(p => p.name + (p.role ? " (" + p.role + ")" : "")).join(", ") || "—";

    const zeiten = [
        ["Unter Segel", ab.stat.unterSegel],
        ["Mit Motor",   ab.stat.mitMotor],
        ["Im Hafen",    ab.stat.hafen],
        ["Vor Anker",   ab.stat.anker]
    ].filter(([, m]) => m > 0)
     .map(([l, m]) => `<span>${l}: <strong>${zeitFormatieren(m)}</strong></span>`)
     .join("&nbsp;&nbsp;·&nbsp;&nbsp;");

    const nmRuderText = Object.entries(ab.stat.nmRuder || {})
        .sort((a, b) => b[1] - a[1])
        .map(([name, nm]) => `<span>${name}: <strong>${nm} nm</strong></span>`)
        .join("&nbsp;&nbsp;·&nbsp;&nbsp;");

    const eventZeilen = ab.events.map(ev => {
        const w   = ev.weather;
        const iso = evZeitIso(ev);
        const pos = posText(ev);
        return `<tr>
            <td>${ev.type || ""}</td>
            <td>${isoZuDatum(iso.slice(0, 10))}</td>
            <td>${iso.slice(11, 16)}</td>
            <td>${ev.ort  || ""}</td>
            <td>${ev.rudergaenger ? ev.rudergaenger.name : ""}</td>
            <td>${windText(w)}</td>
            <td>${w ? w.windDirection || "" : ""}</td>
            <td>${w ? w.description  || "" : ""}</td>
            <td>${ev.note || ""}</td>
            <td>${pos}</td>
            <td>${ev.pos != null ? (ev.pos.sog ?? "") : ""}</td>
        </tr>`;
    }).join("") || `<tr><td colspan="11" style="text-align:center;color:#666;font-style:italic;padding:6mm">Keine Ereignisse</td></tr>`;

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
            ${nmRuderText ? `<div class="adp-zeiten">Seemeilen pro Rudergänger: ${nmRuderText}</div>` : ""}
            ${ab.notes ? `<div class="adp-notizen"><strong>Notizen:</strong> ${ab.notes}</div>` : ""}
        </div>
        <table class="adp-tabelle">
            <thead><tr>
                <th>Typ</th><th>Datum</th><th>Zeit</th><th>Ort</th>
                <th>Rudergänger</th><th>Wind kn</th><th>Richtung</th><th>Wetter</th><th>Notiz</th><th>GPS</th><th>SOG kn</th>
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
        const zeitraum = [t.startDate, t.endDate].filter(Boolean).map(formatDatum).join(" – ") || "—";
        const anzahl   = (t.events || []).length;

        const li = document.createElement("li");
        li.className = "tu-item" + (aktuellerToern && aktuellerToern.tripId === t.tripId ? " tu-aktiv" : "");

        const main = document.createElement("button");
        main.type = "button";
        main.className = "tu-main";
        main.innerHTML =
            '<span class="tu-name">' + (t.tripName || "(ohne Name)") + '</span>' +
            '<span class="tu-meta" style="font-size:10px;opacity:0.45;font-family:monospace">ID: ' + t.tripId + '</span>' +
            '<span class="tu-meta">' + zeitraum + '</span>' +
            '<span class="tu-meta">' + (t.skipper ? '👤 ' + t.skipper : '') + '</span>' +
            '<span class="tu-badge">' + anzahl + ' Ereignis' + (anzahl !== 1 ? 'se' : '') + '</span>';
        main.onclick = () => { toernLaden(t.tripId); if (typeof seitenWechseln === "function") seitenWechseln(null); };

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
                tabInhaltToggeln();
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

