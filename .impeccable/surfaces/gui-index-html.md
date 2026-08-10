---
version: 1
slug: "gui-index-html"
primary_target: "gui/index.html"
related_targets: ["gui/renderer.js"]
---

Scope: la GUI Electron di wpdev (`gui/index.html`, `gui/renderer.js`). Modalità visitatore: Operate.

## Pubblico e compito

Operatore unico (Raffaele) sulla propria macchina Windows + WSL. Apre la GUI **per lavorare su un
sito alla volta**: trovarlo in fretta fra sedici, poi averne dati e azioni sotto mano. Il lavoro
batch e scriptato resta a CLI e agenti.

## Vincoli confermati dall'operatore (round del 2026-08-10)

1. **Mondo visivo sostituito**, non raffinato: l'identità ambra/rack precedente è stata messa
   esplicitamente fuori gioco.
2. **Lavoro primario: trovare e aprire il sito giusto** fra sedici che a colpo d'occhio sono
   identici (tutti operativi, tutti PHP 8.3, tutti su :8443).
3. **Stato locale ammesso** in localStorage, limitato alle preferenze di visualizzazione: le
   classi che l'operatore assegna a mano ai siti (prospect / proprio / test).
4. **Lo schermo lo vedono i clienti** durante screen share e demo → i segreti (password admin e
   database, credenziali del live link) stanno contenuti per default e si scoprono a richiesta.
5. Nessuna funzione dell'engine può andare persa dietro il redesign.

## Direzione scelta

Tiro `concept-seed`, seed `1ebc0e07`, modalità operate, indice assegnato **6** (registro di bottega
con rubrica a unghiatura). L'operatore ha scelto sulla decision page il challenger
**`tdr-info-noise-sleeve`** (sleeve The Designers Republic), che batte quindi l'assegnazione: una
scelta dell'utente prevale sempre sul tiro.

Momento memorabile: il nome vero del sito — quello che l'API restituiva da sempre e che la vecchia
interfaccia non mostrava mai — composto enorme in condensato, con lo stato ridotto a eccezione.

## Decisioni non risolte

- Le classi sono un vocabolario fisso a tre voci; se servirà crearne di proprie, va deciso se
  restano locali o diventano un campo dell'API.
- L'icona `wpdev.ico` appuntata in barra delle applicazioni appartiene ancora al mondo ambra e va
  rifatta.
