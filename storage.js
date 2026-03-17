/* ======================
   STORAGE.JS
   localStorage-Verwaltung für Törns
====================== */

const STORAGE_KEY = "segel_logbuch_trips";

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function alleToernsLaden() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function toernSpeichern(toern) {
    const alle = alleToernsLaden();
    const idx = alle.findIndex(t => t.tripId === toern.tripId);
    if (idx >= 0) {
        alle[idx] = toern;
    } else {
        alle.push(toern);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alle));
}

function toernLoeschen(tripId) {
    const alle = alleToernsLaden().filter(t => t.tripId !== tripId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alle));
}

function neuerToern() {
    return {
        tripId: generateId(),
        tripName: "",
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
        skipper: "",
        crew: [],
        shipData: {
            name: "",
            type: "",
            registration: "",
            engine: ""
        },
        generalWeather: {
            windForce: "",
            windDirection: "",
            seaState: "",
            visibility: "",
            clouds: ""
        },
        notes: "",
        events: [],
        track: {
            enabled: false,
            intervalSeconds: 60,
            startedAt: "",
            stoppedAt: "",
            source: "device_gps",
            points: []
        }
    };
}
