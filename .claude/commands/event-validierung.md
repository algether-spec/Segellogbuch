⚠️ KEINE RÜCKFRAGEN. Alle Informationen sind vollständig angegeben. Sofort mit Schritt 1 beginnen.

Baue eine Event-Validierung in die App ein. Genau diese Schritte ausführen:

**Schritt 1 – LOGIK.md lesen**
Lies LOGIK.md vollständig.

**Schritt 2 – Konstanten in app.js einfügen**
Nach den bestehenden Konstanten, vor den Funktionen:

const ERLAUBTE_ZUSTAENDE = {
  "Ablegen":       ["hafen"],
  "Anker lichten": ["anker"],
  "Von Boje":      ["boje"],
  "Anlegen":       ["fahrt"],
  "Ankern":        ["fahrt"],
  "An Boje":       ["fahrt"],
  "Wende":         ["fahrt"],
  "Halse":         ["fahrt"],
  "Reffen":        ["fahrt"],
  "Motor an":      ["fahrt"],
  "Segeln":        ["fahrt"],
  "Ruderwechsel":  ["fahrt"],
};

const SOG_GRENZWERTE = {
  "Ankern":  0.5,
  "An Boje": 0.5,
  "Anlegen": 1.0,
};

**Schritt 3 – Hilfsfunktionen vor schnellEintragSpeichern einfügen**

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

**Schritt 4 – schnellEintragSpeichern(typ) ergänzen**
Als ALLERERSTES in der Funktion, vor allen anderen Zeilen:

const _zustand = stoppZustandLaden();
const _sog = aktuellerToern?.track?.points?.slice(-1)[0]?.sog ?? null;
const _antrieb = zustandErmitteln()?.zustand ?? "";

if (!eventErlaubt(typ, _zustand)) {
  validierungsWarnung(`„${typ}" ist im Zustand „${_zustand}" nicht möglich`);
  return;
}
const _sogHinweis = sogWarnungPruefen(typ, _sog);
if (_sogHinweis) validierungsWarnung(_sogHinweis);

const _antriebHinweis = antriebKonsistenzPruefen(typ, _antrieb);
if (_antriebHinweis) validierungsWarnung(_antriebHinweis);

**Schritt 5 – CSS ans Ende von style.css einfügen**

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
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  animation: fadeInOut 3s ease forwards;
}

@keyframes fadeInOut {
  0%   { opacity: 0; transform: translateX(-50%) translateY(10px); }
  15%  { opacity: 1; transform: translateX(-50%) translateY(0); }
  75%  { opacity: 1; }
  100% { opacity: 0; }
}

**Schritt 6 – Logik-Check**
Prüfe ob Aufrufkette in schnellEintragSpeichern intakt ist.

**Schritt 7 – Commit**
feat(validierung): Event-Zustand-, SOG- und Antrieb-Prüfung eingebaut
