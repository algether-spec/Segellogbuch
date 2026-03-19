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

const logZeit         = document.getElementById("log_zeit");
const logTyp          = document.getElementById("log_typ");
const logWind         = document.getElementById("log_wind");
const logWindDir      = document.getElementById("log_wind_dir");
const logRudergaenger = document.getElementById("rudergaenger");
const logText         = document.getElementById("log_text");
const logListe        = document.getElementById("log-liste");
const btnNeuerLog     = document.getElementById("btn-neuer-log");
const btnLogSpeichern = document.getElementById("btn-log-speichern");


/* --- Hilfsfunktionen -------------------------------------------- */

/**
 * ISO-String "2026-03-18T14:35" → "18.03. 14:35" (lokale Formatierung)
 * Leerer String bei fehlendem Wert.
 */
function formatDatumZeit(iso) {
    if (!iso) return "";
    const d = iso.slice(0, 10);
    const t = iso.slice(11, 16);
    const datum = d && d !== "0000-00-00" ? d.slice(8) + "." + d.slice(5, 7) + "." : "";
    return t ? (datum ? datum + " " + t : t) : datum;
}

/**
 * Liefert den ISO-Zeitstring eines Events.
 * Neue Events haben ev.zeit, alte ev.date + ev.time.
 */
function evZeitIso(ev) {
    return ev.zeit || ((ev.date || "") + "T" + (ev.time || "00:00"));
}

/* ISO-Datum "2026-03-19" → "19.03.2026" */
function isoZuDatum(iso) {
    if (!iso || iso.length < 10) return iso || "";
    return iso.slice(8, 10) + "." + iso.slice(5, 7) + "." + iso.slice(0, 4);
}

/* ev.weather → "7.3 kn" oder Fallback "3 Bft" oder "" */
function windText(w) {
    if (!w) return "";
    if (w.windKnots != null)                              return w.windKnots + " kn";
    if (w.windForce !== null && w.windForce !== undefined) return w.windForce + " Bft";
    return "";
}

/* ev.pos → "52.1234, 9.5678" oder "" */
function posText(ev) {
    if (!ev.pos || ev.pos.lat == null || ev.pos.lon == null) return "";
    return ev.pos.lat.toFixed(4) + ", " + ev.pos.lon.toFixed(4);
}

/* Beaufort → Knoten (Untergrenze jeder Bft-Stufe in m/s × 1.94384) */
const BFT_MS = [0, 0.3, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7];
function bftZuKnoten(bft) {
    const ms = BFT_MS[Math.max(0, Math.min(12, bft))] ?? 0;
    return Math.round(ms * 1.94384 * 10) / 10;
}

/* m/s → Beaufort */
function msToBft(ms) {
    if (ms <  0.3) return 0;
    if (ms <  1.6) return 1;
    if (ms <  3.4) return 2;
    if (ms <  5.5) return 3;
    if (ms <  8.0) return 4;
    if (ms < 10.8) return 5;
    if (ms < 13.9) return 6;
    if (ms < 17.2) return 7;
    if (ms < 20.8) return 8;
    if (ms < 24.5) return 9;
    if (ms < 28.5) return 10;
    if (ms < 32.7) return 11;
    return 12;
}

/* Grad → Himmelsrichtung */
function gradZuRichtung(deg) {
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

/* WMO Wettercode → Kurztext */
function wettercodeZuText(code) {
    if (code === 0)                return "Klar";
    if (code <= 3)                 return "Bewölkt";
    if (code <= 48)                return "Nebel";
    if (code <= 55)                return "Nieselregen";
    if (code <= 65)                return "Regen";
    if (code <= 77)                return "Schnee";
    if (code <= 82)                return "Schauer";
    if (code <= 86)                return "Schneeschauer";
    if (code <= 99)                return "Gewitter";
    return "";
}

/* Open-Meteo API → { windForce, windDirection, description } oder null */
async function wetterVonApi(lat, lon) {
    try {
        const url = "https://api.open-meteo.com/v1/forecast"
            + "?latitude=" + lat + "&longitude=" + lon
            + "&current=windspeed_10m,winddirection_10m,weathercode"
            + "&windspeed_unit=kn";
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return null;
        const data = await res.json();
        const c = data.current;
        if (!c) return null;
        const kn = c.windspeed_10m ?? 0;
        return {
            windForce:     msToBft(kn / 1.94384),
            windKnots:     Math.round(kn * 10) / 10,
            windDirection: gradZuRichtung(c.winddirection_10m ?? 0),
            description:   c.weathercode != null ? wettercodeZuText(c.weathercode) : ""
        };
    } catch { return null; }
}

const MODUS_MAP = {
    "Ankern":   "⚓ Vor Anker",
    "Anlegen":  "🏁 Im Hafen",
    "Ankunft":  "🏁 Im Hafen",
    "MOB":      "🆘 MOB aktiv"
};

/* Ereignistypen die den Fahrt-Zustand definieren */
const MOTOR_TYPEN = new Set(["Motor an", "Ablegen"]);
const SEGEL_TYPEN = new Set(["Segeln", "Abfahrt"]);

function zustandErmitteln() {
    if (!aktuellerToern || !(aktuellerToern.events || []).length) return null;
    const sorted = aktuellerToern.events.slice().sort((a, b) =>
        evZeitIso(a) < evZeitIso(b) ? -1 : 1
    );
    for (let i = sorted.length - 1; i >= 0; i--) {
        const typ = sorted[i].type;
        if (MOTOR_TYPEN.has(typ)) return { zustand: "motor", event: sorted[i] };
        if (SEGEL_TYPEN.has(typ)) return { zustand: "segeln", event: sorted[i] };
    }
    return null;
}

function zustandAktualisieren() {
    const result = zustandErmitteln();
    const btnS = document.getElementById("btn-zustand-segeln");
    const btnM = document.getElementById("btn-zustand-motor");
    if (!btnS || !btnM) return;
    btnS.classList.toggle("btn-zustand-aktiv", result?.zustand === "segeln");
    btnM.classList.toggle("btn-zustand-aktiv", result?.zustand === "motor");

    /* Wende/Halse nur bei Segel-Zustand aktiv */
    const istSegeln = result?.zustand === "segeln";
    const btnWende = document.getElementById("btn-wende");
    const btnHalse = document.getElementById("btn-halse");
    if (btnWende) btnWende.disabled = !istSegeln;
    if (btnHalse) btnHalse.disabled = !istSegeln;

    /* Anlegen nur bei Motor-Zustand aktiv */
    const istMotor = result?.zustand === "motor";
    const btnAnlegen = document.getElementById("btn-anlegen");
    if (btnAnlegen) btnAnlegen.disabled = !istMotor;
}

function zustandSetzen(zustand) {
    schnellEintragSpeichern(zustand === "motor" ? "Motor an" : "Segeln");
}

/* --- Stopp-Zustand (hafen / anker / boje / fahrt) --------------- */

const STOPP_TEXTE = { hafen: "🏁 Im Hafen", anker: "⚓ Vor Anker", boje: "🔵 An Boje" };
const STOPP_EREIGNISSE = { "Anlegen": "hafen", "Ankern": "anker", "An Boje": "boje" };
const START_EREIGNISSE = new Set(["Ablegen", "Anker lichten", "Von Boje"]);

function stoppZustandLaden() {
    /* Rückwärtskompatibel: altes im_hafen-Flag migrieren */
    if (localStorage.getItem("segel_logbuch_im_hafen") === "true") {
        localStorage.setItem("segel_logbuch_stopp", "hafen");
        localStorage.removeItem("segel_logbuch_im_hafen");
    }
    return localStorage.getItem("segel_logbuch_stopp") || "fahrt";
}

function stoppZustandSpeichern(val) {
    localStorage.setItem("segel_logbuch_stopp", val);
    if (aktuellerToern) aktuellerToern.stoppZustand = val;
}

function hafenSperrungAktualisieren(stopp) {
    const istStopp = stopp !== "fahrt";

    /* Start-Bar (Ablegen/Anker lichten/Von Boje) ↔ Stopp-Bar */
    const startBar  = document.getElementById("fahrt-start-bar");
    const stoppBar  = document.getElementById("fahrt-stopp-bar");
    if (startBar) startBar.hidden = !istStopp;
    if (stoppBar) stoppBar.hidden = istStopp;

    /* Zustand- und Manöver-Bereiche: nur bei FAHRT sichtbar */
    const zustandBar  = document.getElementById("zustand-bar");
    const manoeverGrid = document.getElementById("manoever-grid");
    const weiterePanel = document.getElementById("schnell-weitere");
    if (zustandBar)   zustandBar.hidden   = istStopp;
    if (manoeverGrid) manoeverGrid.hidden = istStopp;
    if (weiterePanel && istStopp) weiterePanel.hidden = true;

    /* btn-schnell-sm in Weitere-Panel + Formular-Speichern-Button */
    document.querySelectorAll(".btn-schnell-sm").forEach(btn => {
        btn.disabled = istStopp;
    });
    /* btnLogSpeichern bleibt immer aktiv – Modal ermöglicht Nachträge auch bei STOPP */

    /* Bei FAHRT: Wende/Halse korrekt per Segeln/Motor-Zustand setzen */
    if (!istStopp) zustandAktualisieren();

    /* Statusleiste: Modus-Text überschreiben wenn gestoppt */
    const modus = document.getElementById("ls-modus");
    if (istStopp && modus) modus.textContent = STOPP_TEXTE[stopp] || "—";

    /* Status-Badge oben rechts */
    const badge     = document.getElementById("btn-fahrt-status");
    const badgeText = document.getElementById("btn-fahrt-status-text");
    if (badge && badgeText) {
        badgeText.textContent = istStopp ? "🔴 STOPP" : "🟢 FAHRT";
        badge.classList.toggle("btn-fahrt-stopp", istStopp);
        badge.classList.toggle("btn-fahrt-fahrt", !istStopp);
    }
}

function logbuchStatusAktualisieren() {
    const el = document.getElementById("logbuch-status");
    if (!el) return;
    if (!aktuellerToern || !(aktuellerToern.events || []).length) {
        el.hidden = true;
        zustandAktualisieren();
        hafenSperrungAktualisieren(stoppZustandLaden());
        return;
    }
    const events = aktuellerToern.events.slice().sort((a, b) =>
        evZeitIso(a) < evZeitIso(b) ? -1 : 1
    );

    /* Modus + "seit" aus letztem Zustandsereignis */
    const zustandResult = zustandErmitteln();
    let modusText, seitIso;
    if (zustandResult) {
        modusText = zustandResult.zustand === "motor" ? "🔧 Motor" : "⛵ Segeln";
        seitIso   = evZeitIso(zustandResult.event);
    } else {
        const letztes = events[events.length - 1];
        modusText = MODUS_MAP[letztes.type] || letztes.type;
        seitIso   = evZeitIso(letztes);
    }
    document.getElementById("ls-modus").textContent = modusText;
    document.getElementById("ls-seit").textContent  = "seit " + (seitIso.slice(11, 16) || "—");

    /* Letztes Manöver (letztes Nicht-Zustandsereignis) */
    const ZUSTAND_TYPEN = new Set([...MOTOR_TYPEN, ...SEGEL_TYPEN]);
    const letztesManoever = [...events].reverse().find(e => !ZUSTAND_TYPEN.has(e.type));
    const manoeverWrap = document.getElementById("ls-manoever-wrap");
    if (manoeverWrap) {
        if (letztesManoever) {
            document.getElementById("ls-manoever").textContent = letztesManoever.type;
            manoeverWrap.hidden = false;
        } else {
            manoeverWrap.hidden = true;
        }
    }

    /* Rudergänger aus letztem Eintrag mit Rudergänger */
    const mitRuder = [...events].reverse().find(e => e.rudergaenger?.name);
    const ruderSelect = document.getElementById("ls-ruder-select");
    const aktRuder = mitRuder ? mitRuder.rudergaenger.name : "";
    const crew     = (aktuellerToern.crew || []).map(p => p.name);
    if (aktRuder && !crew.includes(aktRuder)) crew.unshift(aktRuder);
    ruderSelect.innerHTML = "";
    if (!aktRuder) {
        const ph = document.createElement("option");
        ph.value = ""; ph.textContent = "👤 —";
        ruderSelect.appendChild(ph);
    }
    crew.forEach(name => {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = "👤 " + name;
        if (name === aktRuder) opt.selected = true;
        ruderSelect.appendChild(opt);
    });

    /* Wind aus letztem Eintrag mit Winddaten – Fallback auf last_values */
    const mitWind   = [...events].reverse().find(e =>
        e.weather?.windKnots != null || (e.weather?.windForce !== undefined && e.weather?.windForce !== null)
    );
    const lv        = ladeLetzteWerte() || {};
    const windWert  = mitWind
        ? (mitWind.weather.windKnots != null
            ? String(mitWind.weather.windKnots)
            : String(bftZuKnoten(mitWind.weather.windForce)))
        : (lv.wind || "");
    const windSelect = document.getElementById("ls-wind-select");
    const windWrap  = document.getElementById("ls-wind-wrap");
    if (windSelect) {
        windSelect.innerHTML = "";
        const emptyOpt = document.createElement("option");
        emptyOpt.value = ""; emptyOpt.textContent = "💨 —";
        windSelect.appendChild(emptyOpt);
        for (let i = 0; i <= 12; i++) {
            const kn = bftZuKnoten(i);
            const opt = document.createElement("option");
            opt.value = String(kn);
            opt.textContent = "💨 " + kn + " kn";
            if (String(kn) === windWert) opt.selected = true;
            windSelect.appendChild(opt);
        }
        if (windWrap) windWrap.hidden = false;
        /* last_values mit aktuellem Wind (kn) synchronisieren */
        if (windWert !== "") {
            speichereLetzteWerte(windWert, lv.rudergaenger || "");
        }
    }

    /* SOG aus letztem Eintrag mit Position und Geschwindigkeit */
    const mitSog   = [...events].reverse().find(e => e.pos != null);
    const sogWrap  = document.getElementById("ls-sog-wrap");
    const sogEl    = document.getElementById("ls-sog");
    if (sogWrap && sogEl) {
        if (mitSog) {
            sogEl.textContent = "🚀 " + (mitSog.pos.sog ?? 0) + " kn SOG";
            sogWrap.hidden = false;
        } else {
            sogWrap.hidden = true;
        }
    }

    el.hidden = false;
    zustandAktualisieren();
    hafenSperrungAktualisieren(stoppZustandLaden());
}

function statusSetzen(text, typ = "ok", ms = 3000) {
    statusMsg.textContent = text;
    statusMsg.className = "status-msg status-" + typ;
    statusMsg.hidden = !text;
    if (text) setTimeout(() => { statusMsg.hidden = true; }, ms);
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
    rudergaengerSelectFuellen();
    zeigeLogs();
    toernStatistikRendern(toernStatistikBerechnen(toern));
    toernAbschlussRendern(toernAbschlussBerechnen(toern));
    tabInhaltToggeln();
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
            toernSpeichern(aktuellerToern);
            autoBackupSpeichern();
            backupStatusAktualisieren();
            crewListeRendern(aktuellerToern.crew);
            rudergaengerSelectFuellen();
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
    toernSpeichern(aktuellerToern);
    autoBackupSpeichern();
    backupStatusAktualisieren();
    crewListeRendern(aktuellerToern.crew);
    rudergaengerSelectFuellen();
    crewInput.value = "";
    crewRole.value  = "Crew";
    crewInput.focus();
}


/* --- Ereignisse ------------------------------------------------- */

function formWetterVorbelegen() {
    if (!navigator.geolocation || !aktuellerToern) return;
    if (stoppZustandLaden() !== "fahrt") return;
    const ladeEl = document.getElementById("wind-loading");
    /* ⏳ Loading-State */
    if (ladeEl) ladeEl.hidden = false;
    logWind.value = "";
    if (logWindDir) logWindDir.value = "";
    logWind.disabled    = true;
    if (logWindDir) logWindDir.disabled = true;

    navigator.geolocation.getCurrentPosition(
        async pos => {
            /* GPS → API → Felder */
            const w = await wetterVonApi(pos.coords.latitude, pos.coords.longitude);
            if (w) {
                logWind.value = String(w.windKnots);
                if (logWindDir) logWindDir.value = w.windDirection;
            }
            logWind.disabled    = false;
            if (logWindDir) logWindDir.disabled = false;
            if (ladeEl) ladeEl.hidden = true;
        },
        () => {
            /* GPS verweigert – Felder freigeben */
            logWind.disabled    = false;
            if (logWindDir) logWindDir.disabled = false;
            if (ladeEl) ladeEl.hidden = true;
        },
        { maximumAge: 30000, timeout: 8000, enableHighAccuracy: false }
    );
}

function logZeitVorbefuellen() {
    const now = new Date();
    const pad = n => String(n).padStart(2, "0");
    logZeit.value = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate())
        + "T" + pad(now.getHours()) + ":" + pad(now.getMinutes());
}

function rudergaengerSelectFuellen() {
    /* Globale Crew + aktuelle Törn-Crew kombinieren */
    const global     = ladeCrew();
    const toernNamen = aktuellerToern ? (aktuellerToern.crew || []).map(p => p.name) : [];
    const alle       = [...new Set([...global, ...toernNamen])].filter(Boolean);

    logRudergaenger.innerHTML = '<option value="">— Rudergänger —</option>';
    if (alle.length === 0) {
        logRudergaenger.disabled = true;
        logRudergaenger.title    = "Bitte zuerst Crew hinzufügen";
        return;
    }
    logRudergaenger.disabled = false;
    logRudergaenger.title    = "";
    alle.forEach(name => {
        const opt = document.createElement("option");
        opt.value       = name;
        opt.textContent = name;
        logRudergaenger.appendChild(opt);
    });
    /* Punkt 3: Bei genau 1 Crew-Mitglied automatisch vorauswählen */
    if (alle.length === 1) logRudergaenger.value = alle[0];
}

function zeigeLogs() {
    if (!aktuellerToern) { logListe.innerHTML = ""; return; }
    const events = (aktuellerToern.events || []).slice().sort((a, b) =>
        evZeitIso(a) < evZeitIso(b) ? -1 : evZeitIso(a) > evZeitIso(b) ? 1 : 0
    );
    if (events.length === 0) {
        logListe.innerHTML = '<div class="card"><p class="event-empty">Noch keine Einträge.</p></div>';
    } else {
        const zeilen = events.map(ev => {
            const w     = ev.weather;
            const wind  = windText(w);
            const sog   = ev.pos != null ? (ev.pos.sog ?? 0) + " kn SOG" : "";
            const ruder = ev.rudergaenger ? ev.rudergaenger.name : "";
            const zeit  = formatDatumZeit(evZeitIso(ev)) || "—";
            const info  = [zeit, ev.type, wind, sog, ruder].filter(Boolean).join("  ·  ");

            let posHtml = "";
            if (ev.pos && ev.pos.lat != null && ev.pos.lon != null) {
                const mapsUrl  = "https://maps.google.com/?q=" + ev.pos.lat + "," + ev.pos.lon;
                const latDisp  = ev.pos.lat.toFixed(4);
                const lonDisp  = ev.pos.lon.toFixed(4);
                const sog      = ev.pos.sog != null && ev.pos.sog > 0 ? "  ·  " + ev.pos.sog + " kn" : "";
                posHtml = `<a class="event-pos" href="${mapsUrl}" target="_blank" rel="noopener">📍 ${latDisp}, ${lonDisp}${sog}</a>`;
            }

            return `<li class="event-item">
                <span class="event-info">
                    <span class="event-time-label">${info}</span>
                    ${ev.note ? '<span class="event-note-text">' + ev.note + '</span>' : ''}
                    ${posHtml}
                </span>
                <button type="button" class="btn-crew-del" data-id="${ev.id}">✕</button>
            </li>`;
        }).join("");
        logListe.innerHTML = `<ul class="log-liste-ul" style="list-style:none;display:flex;flex-direction:column;gap:6px;margin-bottom:14px">${zeilen}</ul>`;
        logListe.querySelectorAll("[data-id]").forEach(btn => {
            btn.onclick = () => {
                aktuellerToern.events = aktuellerToern.events.filter(e => e.id !== btn.dataset.id);
                toernSpeichern(aktuellerToern);
                autoBackupSpeichern();
                backupStatusAktualisieren();
                zeigeLogs();
            };
        });
    }
    toernStatistikRendern(toernStatistikBerechnen(aktuellerToern));
    toernAbschlussRendern(toernAbschlussBerechnen(aktuellerToern));
    logbuchStatusAktualisieren();
}

function logModalOeffnen() {
    logZeitVorbefuellen();
    rudergaengerSelectFuellen();
    const letzte = ladeLetzteWerte() || {};
    if (letzte.rudergaenger) logRudergaenger.value = letzte.rudergaenger;
    if (stoppZustandLaden() === "fahrt") formWetterVorbelegen();
    const overlay = document.getElementById("log-modal-overlay");
    if (overlay) overlay.style.display = "flex";
}

function logModalSchliessen() {
    const overlay = document.getElementById("log-modal-overlay");
    if (overlay) overlay.style.display = "none";
}

function logEintragSpeichern() {
    if (!aktuellerToern) {
        statusSetzen("Bitte zuerst einen Törn auswählen.", "error");
        return;
    }
    if (!logZeit.value) {
        statusSetzen("Zeit ist ein Pflichtfeld.", "error");
        logZeit.focus();
        return;
    }
    const windKn     = logWind.value !== "" ? parseFloat(logWind.value) : NaN;
    const windDirVal = logWindDir ? logWindDir.value : "";
    const ev = {
        id:           generateId(),
        type:         logTyp.value,
        zeit:         logZeit.value,   /* "2026-03-18T14:35" aus datetime-local */
        ort:          "",
        rudergaenger: logRudergaenger.value ? { name: logRudergaenger.value } : null,
        note:         logText.value.trim(),
        weather:      !isNaN(windKn) ? { windForce: msToBft(windKn / 1.94384), windKnots: windKn, windDirection: windDirVal, description: "" } : null
    };
    if (!aktuellerToern.events) aktuellerToern.events = [];
    aktuellerToern.events.push(ev);
    gpsAbfragen(ev);
    speichereLetzteWerte(!isNaN(windKn) ? String(windKn) : "", logRudergaenger.value);
    toernSpeichern(aktuellerToern);
    autoBackupSpeichern();
    backupStatusAktualisieren();
    zeigeLogs();
    logText.value         = "";
    logRudergaenger.value = "";
    logWind.value         = "";
    if (logWindDir) logWindDir.value = "";
    logModalSchliessen();
    statusSetzen("Eintrag gespeichert.", "ok");
}


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
    stoppZustandSpeichern(toern.stoppZustand || "hafen");
    hafenSperrungAktualisieren(toern.stoppZustand || "hafen");
}

function neuerToernAnlegen() {
    aktuellerToern = neuerToern();
    formularFuellen(aktuellerToern);
    formSection.hidden = false;
    btnToernLoeschen.hidden = true;
    toernSelect.value = "";
    stoppZustandSpeichern("hafen");
    hafenSperrungAktualisieren("hafen");
    fldTripName.focus();
    statusSetzen("Neuer Törn angelegt.", "ok");
}

function toernSpeichernAktion() {
    if (!aktuellerToern) return;
    if (!validieren()) return;
    formularLesen();
    toernSpeichern(aktuellerToern);
    autoBackupSpeichern();
    backupStatusAktualisieren();
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
    tabInhaltToggeln();
    toernSelectAktualisieren();
    statusSetzen("Törn gelöscht.", "ok");
}


/* --- Druck / PDF ------------------------------------------------ */

function druckenVorbereiten() {
    if (!aktuellerToern) return;
    const t = aktuellerToern;

    const zeitraum = [t.startDate, t.endDate].filter(Boolean).join(" – ") || "—";

    const events = (t.events || []).slice().sort((a, b) =>
        evZeitIso(a) < evZeitIso(b) ? -1 : evZeitIso(a) > evZeitIso(b) ? 1 : 0
    );

    const zeilen = events.map(ev => {
        const w   = ev.weather;
        const iso = evZeitIso(ev);
        const pos = posText(ev);
        return `<tr>
            <td>${ev.type || ""}</td>
            <td>${isoZuDatum(iso.slice(0, 10))}</td>
            <td>${iso.slice(11, 16)}</td>
            <td>${ev.ort || ""}</td>
            <td>${ev.rudergaenger ? ev.rudergaenger.name : ""}</td>
            <td>${windText(w)}</td>
            <td>${w ? w.windDirection || "" : ""}</td>
            <td>${w ? w.description || "" : ""}</td>
            <td>${ev.note || ""}</td>
            <td>${pos}</td>
        </tr>`;
    }).join("");

    const leer = events.length === 0
        ? '<tr><td colspan="11" class="dp-leer">Keine Ereignisse vorhanden.</td></tr>'
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
                    <th>Wind kn</th>
                    <th>Windrichtung</th>
                    <th>Wetter</th>
                    <th>Notiz</th>
                    <th>GPS</th>
                    <th>SOG kn</th>
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
    const kopfzeile = "Toernname;Datum;Zeit;Typ;Ort;Rudergänger;Wind kn;Wind Bft;Wind Richtung;Wetter;Notiz;GPS;SOG kn";
    const zeilen = (t.events || [])
        .slice()
        .sort((a, b) =>
            evZeitIso(a) < evZeitIso(b) ? -1 : evZeitIso(a) > evZeitIso(b) ? 1 : 0
        )
        .map(ev => {
            const iso = evZeitIso(ev);
            return [
                t.tripName,
                isoZuDatum(iso.slice(0, 10)),
                iso.slice(11, 16),
                ev.type,
                ev.ort,
                ev.rudergaenger ? ev.rudergaenger.name : "",
                ev.weather ? (ev.weather.windKnots != null ? ev.weather.windKnots : "") : "",
                ev.weather ? (ev.weather.windForce !== null && ev.weather.windForce !== undefined ? ev.weather.windForce : "") : "",
                ev.weather ? ev.weather.windDirection : "",
                ev.weather ? ev.weather.description : "",
                ev.note,
                posText(ev),
                ev.pos != null ? (ev.pos.sog ?? 0) : ""
            ].map(csvFeldEscapen).join(";");
        });

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


/* --- Schnellbuttons --------------------------------------------- */

function schnellWeitereToggeln() {
    const panel = document.getElementById("schnell-weitere");
    if (panel) panel.hidden = !panel.hidden;
}

function schnellEintragSpeichern(typ) {
    if (!aktuellerToern) {
        statusSetzen("Bitte zuerst einen Törn auswählen.", "error");
        return;
    }
    const letzte    = ladeLetzteWerte() || {};
    const windSel   = document.getElementById("ls-wind-select");
    const wind      = (windSel && windSel.value !== "") ? windSel.value : (letzte.wind || "");
    const ruderSel  = document.getElementById("ls-ruder-select");
    const ruder     = (ruderSel && ruderSel.value) ? ruderSel.value : (letzte.rudergaenger || "");
    /* Lokale Zeit als ISO-String "2026-03-18T14:35" */
    const zeitIso = new Date().toLocaleString("sv").slice(0, 16).replace(" ", "T");
    const ev = {
        id:           generateId(),
        type:         typ,
        zeit:         zeitIso,
        ort:          "",
        rudergaenger: ruder ? { name: ruder } : null,
        note:         "",
        weather:      wind !== "" ? { windForce: msToBft(parseFloat(wind) / 1.94384), windKnots: parseFloat(wind), windDirection: "", description: "" } : null
    };
    if (!aktuellerToern.events) aktuellerToern.events = [];
    aktuellerToern.events.push(ev);
    /* Stopp-Zustand VOR zeigeLogs speichern – sonst liest UI alten Zustand */
    if (STOPP_EREIGNISSE[typ]) {
        stoppZustandSpeichern(STOPP_EREIGNISSE[typ]);
    } else if (START_EREIGNISSE.has(typ)) {
        stoppZustandSpeichern("fahrt");
    }
    gpsAbfragen(ev);
    speichereLetzteWerte(wind, ruder);
    toernSpeichern(aktuellerToern);
    autoBackupSpeichern();
    backupStatusAktualisieren();
    zeigeLogs();

    if (typ === "MOB") {
        statusSetzen("🆘 MOB – Mann über Bord! Zeit: " + ev.zeit.slice(11, 16), "error", 10000);
    } else {
        statusSetzen("✅ " + typ + " gespeichert.", "ok", 2000);
    }
}


/* --- Tab-Navigation --------------------------------------------- */

function tabWechseln(tabId) {
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.add("tab-hidden"));
    document.getElementById(tabId).classList.remove("tab-hidden");
    document.querySelectorAll(".tab-btn").forEach(b =>
        b.classList.toggle("tab-aktiv", b.dataset.tab === tabId)
    );
    /* Beim Wechsel zum Logbuch: Zeit und letzte Werte vorausfüllen */
    if (tabId === "tab-logbuch" && aktuellerToern) {
        logZeitVorbefuellen();
        rudergaengerSelectFuellen();
        const letzte = ladeLetzteWerte() || {};
        if (letzte.rudergaenger) logRudergaenger.value = letzte.rudergaenger || "";
        logbuchStatusAktualisieren();
        formWetterVorbelegen();
    }
    /* Beim Wechsel zum Log-Tab: Liste aktualisieren */
    if (tabId === "tab-log" && aktuellerToern) {
        zeigeLogs();
    }
}

function tabInhaltToggeln() {
    const aktiv = !!aktuellerToern;
    ["crew", "logbuch", "log", "statistik"].forEach(t => {
        const leer   = document.getElementById("tab-" + t + "-leer");
        const inhalt = document.getElementById("tab-" + t + "-inhalt");
        if (leer)   leer.hidden   = aktiv;
        if (inhalt) inhalt.hidden = !aktiv;
    });
    const bar = document.getElementById("aktiver-toern-bar");
    bar.hidden = !aktiv;
    if (aktiv) {
        document.getElementById("aktiver-toern-label").textContent =
            (aktuellerToern.tripName || "(ohne Name)") + "  ·  " +
            (aktuellerToern.startDate || "kein Datum");
    }
}


/* --- Event Listener --------------------------------------------- */

btnNeuerToern.onclick    = neuerToernAnlegen;
btnSpeichern.onclick     = toernSpeichernAktion;
btnToernLoeschen.onclick = toernLoeschenAktion;
btnCrewAdd.onclick        = crewHinzufuegen;
btnLogSpeichern.onclick   = logEintragSpeichern;
const _btnAbs = document.getElementById("btn-abschliessen");
if (_btnAbs) _btnAbs.onclick = toernAbschliessenAktion;
document.getElementById("btn-csv-export").onclick      = csvExportieren;
document.getElementById("btn-json-export").onclick     = exportJSON;
document.getElementById("btn-drucken").onclick         = druckenVorbereiten;
document.getElementById("btn-abschluss-druck").onclick = abschlussdrucken;

btnNeuerLog.onclick = () => {
    logZeitVorbefuellen();
    rudergaengerSelectFuellen();
    const letzte = ladeLetzteWerte() || {};
    if (letzte.rudergaenger) logRudergaenger.value = letzte.rudergaenger || "";
    formWetterVorbelegen();
    logZeit.focus();
};

/* --- Floating Buttons ------------------------------------------- */
const _btnMob = document.getElementById("btn-mob");
if (_btnMob) _btnMob.addEventListener("click", () => schnellEintragSpeichern("MOB"));

/* --- Modal Event-Listener --------------------------------------- */
const _modalOverlay = document.getElementById("log-modal-overlay");
const _btnModalAbbrechen = document.getElementById("btn-modal-abbrechen");

if (_btnModalAbbrechen) _btnModalAbbrechen.addEventListener("click", logModalSchliessen);

/* Backdrop-Klick (außerhalb modal-box) schließt Modal */
if (_modalOverlay) {
    _modalOverlay.addEventListener("click", e => {
        if (e.target === _modalOverlay) logModalSchliessen();
    });
}

logRudergaenger.addEventListener("mousedown", () => {
    rudergaengerSelectFuellen();
});

crewInput.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); crewHinzufuegen(); }
});

toernSelect.onchange = () => {
    const val = toernSelect.value;
    if (val) toernLaden(val);
    else { formSection.hidden = true; aktuellerToern = null; tabInhaltToggeln(); }
};

const _ruderSelectEl = document.getElementById("ls-ruder-select");
if (_ruderSelectEl) _ruderSelectEl.addEventListener("change", function () {
    const name = this.value;
    if (!name || !aktuellerToern) return;
    const zeitIso = new Date().toLocaleString("sv").slice(0, 16).replace(" ", "T");
    const letzte  = ladeLetzteWerte() || {};
    const ev = {
        id:           generateId(),
        type:         "Ruderwechsel",
        zeit:         zeitIso,
        ort:          "",
        rudergaenger: { name },
        note:         "",
        weather:      letzte.wind !== "" && letzte.wind !== undefined
                        ? { windForce: msToBft(parseFloat(letzte.wind) / 1.94384), windKnots: parseFloat(letzte.wind), windDirection: "", description: "" }
                        : null
    };
    aktuellerToern.events.push(ev);
    gpsAbfragen(ev);
    speichereLetzteWerte(letzte.wind || "", name);
    toernSpeichern(aktuellerToern);
    autoBackupSpeichern();
    backupStatusAktualisieren();
    zeigeLogs();
    statusSetzen("👤 " + name + " am Ruder.", "ok", 2000);
}); // end ls-ruder-select listener

const _windSelectEl = document.getElementById("ls-wind-select");
if (_windSelectEl) _windSelectEl.addEventListener("change", function () {
    const wind = this.value;
    if (!aktuellerToern) return;
    const zeitIso = new Date().toLocaleString("sv").slice(0, 16).replace(" ", "T");
    const letzte  = ladeLetzteWerte() || {};
    const ev = {
        id:           generateId(),
        type:         "Wetterwechsel",
        zeit:         zeitIso,
        ort:          "",
        rudergaenger: null,
        note:         "",
        weather:      wind !== "" ? { windForce: msToBft(parseFloat(wind) / 1.94384), windKnots: parseFloat(wind), windDirection: "", description: "" } : null
    };
    aktuellerToern.events.push(ev);
    gpsAbfragen(ev);
    speichereLetzteWerte(wind, letzte.rudergaenger || "");
    toernSpeichern(aktuellerToern);
    autoBackupSpeichern();
    backupStatusAktualisieren();
    zeigeLogs();
    if (wind !== "") statusSetzen("💨 Wind: " + wind + " kn.", "ok", 2000);
}); // end ls-wind-select listener


/* --- GPS -------------------------------------------------------- */

function gpsAbfragen(ev) {
    if (!navigator.geolocation || !aktuellerToern) return;
    if (stoppZustandLaden() !== "fahrt") return;
    navigator.geolocation.getCurrentPosition(
        async pos => {
            const speedMs = pos.coords.speed;
            ev.pos = {
                lat: parseFloat(pos.coords.latitude.toFixed(5)),
                lon: parseFloat(pos.coords.longitude.toFixed(5)),
                sog: speedMs != null ? parseFloat((speedMs * 1.94384).toFixed(1)) : null
            };
            /* Wetter automatisch laden / ergänzen */
            const w = await wetterVonApi(ev.pos.lat, ev.pos.lon);
            if (w) {
                if (!ev.weather) {
                    ev.weather = w;
                } else {
                    /* Windrichtung + Beschreibung nachfüllen wenn leer */
                    if (!ev.weather.windDirection) ev.weather.windDirection = w.windDirection;
                    if (!ev.weather.description)   ev.weather.description   = w.description;
                }
            }
            toernSpeichern(aktuellerToern);
            zeigeLogs();
        },
        () => { /* kein GPS verfügbar oder verweigert – ignorieren */ },
        { maximumAge: 30000, timeout: 8000, enableHighAccuracy: false }
    );
}


/* --- Törn abschließen ------------------------------------------- */

function toernAbschliessenAktion() {
    if (!aktuellerToern) return;
    if (!confirm(`Törn "${aktuellerToern.tripName || "(ohne Name)"}" jetzt abschließen?\nEnddatum und Endzeit werden auf jetzt gesetzt.`)) return;
    const now = new Date();
    const pad = n => String(n).padStart(2, "0");
    aktuellerToern.endDate = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
    aktuellerToern.endTime = pad(now.getHours()) + ":" + pad(now.getMinutes());
    fldEndDate.value = aktuellerToern.endDate;
    fldEndTime.value = aktuellerToern.endTime;
    toernSpeichern(aktuellerToern);
    autoBackupSpeichern();
    backupStatusAktualisieren();
    toernSelectAktualisieren();
    statusSetzen("🏁 Törn abgeschlossen: " + aktuellerToern.endDate + " " + aktuellerToern.endTime, "ok", 5000);
}


/* --- Auto-Backup ------------------------------------------------ */

function backupStatusAktualisieren() {
    const el = document.getElementById("backup-status");
    if (!el) return;
    const backup = backupLaden();
    if (!backup || !backup.timestamp) { el.textContent = ""; return; }
    const d = new Date(backup.timestamp);
    const pad = n => String(n).padStart(2, "0");
    const zeit = pad(d.getHours()) + ":" + pad(d.getMinutes());
    el.textContent = "💾 Zuletzt gesichert: " + zeit;
}

function backupBannerPruefen() {
    const backup = backupLaden();
    /* Nur anzeigen wenn Backup existiert aber aktuelle Daten fehlen */
    if (!backup || !backup.toerns || backup.toerns.length === 0) return;
    if (ladeToerns().length > 0) return;

    const d = new Date(backup.timestamp);
    const pad = n => String(n).padStart(2, "0");
    const datum = pad(d.getDate()) + "." + pad(d.getMonth() + 1) + ". "
        + pad(d.getHours()) + ":" + pad(d.getMinutes());

    const banner = document.createElement("div");
    banner.className = "backup-banner";
    banner.innerHTML =
        '<span>Backup vom ' + datum + ' wiederherstellen?</span>'
        + '<div class="backup-banner-btns">'
        + '<button type="button" id="btn-backup-ja" class="btn-backup-restore">Wiederherstellen</button>'
        + '<button type="button" id="btn-backup-nein" class="btn-backup-ignore">✕</button>'
        + '</div>';

    document.querySelector(".app").insertBefore(banner, statusMsg);

    document.getElementById("btn-backup-ja").onclick = () => {
        backupWiederherstellen(backup);
        banner.remove();
        toernSelectAktualisieren();
        statusSetzen("Backup wiederhergestellt.", "ok");
    };
    document.getElementById("btn-backup-nein").onclick = () => banner.remove();
}


/* --- PWA-Migrations-Modal --------------------------------------- */

function pwaMigrationModalZeigen() {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
        <div class="modal-box">
            <h2>📦 Keine Daten gefunden</h2>
            <p>Hast du die App vorher im Browser verwendet?<br>
               Dann importiere deine Daten mit dem Backup.</p>
            <input type="file" id="pwa-file" accept=".json,application/json" style="display:none">
            <div class="modal-btns">
                <button type="button" class="btn-primary modal-btn" id="pwa-btn-import">📂 Backup importieren</button>
                <button type="button" class="btn-secondary modal-btn" id="pwa-btn-skip">Neu starten</button>
            </div>
            <div id="pwa-result"></div>
        </div>`;
    document.body.appendChild(overlay);

    document.getElementById("pwa-btn-import").onclick = () =>
        document.getElementById("pwa-file").click();

    document.getElementById("pwa-file").addEventListener("change", function () {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data   = JSON.parse(e.target.result);
                const anzahl = importJSON(data);
                localStorage.setItem("pwa_migration_done", "1");
                document.getElementById("pwa-result").innerHTML =
                    '<p class="migration-ok">✅ ' + anzahl + " Törn" +
                    (anzahl !== 1 ? "s" : "") + " importiert.</p>";
                setTimeout(() => {
                    overlay.remove();
                    toernSelectAktualisieren();
                    statusSetzen("Daten importiert.", "ok");
                }, 1500);
            } catch {
                document.getElementById("pwa-result").innerHTML =
                    '<p class="migration-err">❌ Ungültige Datei.</p>';
            }
        };
        reader.readAsText(file, "UTF-8");
    });

    document.getElementById("pwa-btn-skip").onclick = () => {
        localStorage.setItem("pwa_migration_done", "1");
        overlay.remove();
    };
}

function pwaMigrationPruefen() {
    const istPWA = window.matchMedia("(display-mode: standalone)").matches;
    if (!istPWA) return;
    if (localStorage.getItem("pwa_migration_done")) return;
    if (ladeToerns().length > 0) {
        localStorage.setItem("pwa_migration_done", "1");
        return;
    }
    pwaMigrationModalZeigen();
}


/* --- Start ------------------------------------------------------ */

/* Permanentes Backup prüfen – automatisch wiederherstellen wenn Daten fehlen */
const _datenWiederhergestellt = permanentBackupPruefen();

toernSelectAktualisieren();
formSection.hidden = true;
btnToernLoeschen.hidden = true;
statusMsg.hidden = true;
tabInhaltToggeln();
hafenSperrungAktualisieren(stoppZustandLaden());
backupBannerPruefen();
backupStatusAktualisieren();
pwaMigrationPruefen();

if (_datenWiederhergestellt) {
    toernSelectAktualisieren();
    statusSetzen("✅ Daten automatisch wiederhergestellt.", "ok", 6000);
}
