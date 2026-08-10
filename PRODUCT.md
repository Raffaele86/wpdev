# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Raffaele Nocera, operatore unico**, sulla propria macchina Windows 11 + WSL Ubuntu. Non esiste
multiutenza: `~/.wpdev/` è stato locale di una sola persona.

**Agenti Claude** come secondo consumatore di primo livello: il README dichiara l'engine
"pilotabile sia a mano sia da agenti Claude", e CLI e agenti passano dalla stessa API della GUI.

**Clienti e prospect** come pubblico indiretto: la finestra della GUI finisce sotto i loro occhi
durante screen share e demo. Non usano il prodotto, ma ne vedono lo schermo.

## Product Purpose

Replicare il modello di Local by WP Engine — registry siti, stack isolato per sito, Live Link,
blueprint — come ambiente WordPress locale nativo WSL, scriptabile. Serve a costruire, mostrare ed
esportare siti WordPress per il lavoro commerciale: demo per prospect, siti propri, ambienti di
prova, con deploy finale verso Hostinger.

Successo = arrivare al sito giusto e operarci sopra senza attrito, e poterlo mostrare a qualcuno
senza preparativi.

## Positioning

**Engine headless con client sottili.** Tutta la logica sta nel daemon `wpdevd` dietro un'API
HTTP/JSON su `127.0.0.1:9700`; CLI e GUI sono client puri che non duplicano nulla, e le operazioni
lunghe rispondono in NDJSON streaming. È questo che rende l'ambiente pilotabile da un agente
esattamente come da una persona — la cosa che un LocalWP con sola interfaccia grafica non consente.

## Operating Context

- WSL Ubuntu su Windows 11; la GUI è Electron servita da WSLg, lanciata da un collegamento
  appuntato in barra delle applicazioni.
- Siti su `https://<slug>.localhost:8443`, webroot in `~/wpdev-sites/<slug>/app/public`.
- Stack: Caddy dedicato con CA interna · un pool php-fpm per sito su socket unix · MariaDB
  condivisa con db e utente per sito · wp-cli · Mailpit (`:8025`) · Adminer · cloudflared quick
  tunnel per il Live Link.
- Export in `D:\NAS\WPDev\exports`, backup giornaliero; deploy finale verso Hostinger.
- **La flotta reale conta 16 siti e sta quasi sempre tutta accesa.** Mescola demo per prospect,
  proprietà proprie e ambienti di test, senza che nulla nei dati distingua le tre cose.
- La GUI si usa per lavorare **su un sito alla volta**: trovarlo, poi averne dati e azioni sotto
  mano. Il lavoro batch e scriptato resta a CLI e agenti.

## Capabilities and Constraints

Azioni offerte dall'engine, tutte esposte via API: `new`, `list`, `start`, `stop`, `restart`,
`delete`, `cli` (wp-cli), `shell`, `open`, `admin` (magic link one-time), `db` (Adminer),
`share`/`share --stop` (Live Link), `clone`, `export`, `import`, `blueprint list|save`, `php`,
`xdebug on|off`, `logs`, `mailpit`.

Vincoli durevoli:

- **La GUI non acquisisce logica di business.** Resta client dell'API; può tenere solo preferenze
  di visualizzazione locali.
- Porta **8443**, non 443: il router di LocalWP su Windows occupa 80/443. Per lo stesso motivo
  MariaDB sta su 3307.
- `*.localhost` non risolve dentro WSL (i browser Windows sì); ci pensa un helper privilegiato.
- **Il Live Link cambia URL a ogni avvio** e non sopravvive al riavvio del daemon: è un quick
  tunnel, non un URL stabile.
- Engine e siti non possono stare su `D:` (drvfs/9p: niente socket unix, locking fragile).
- Multi-PHP predisposto per sito, ma su Ubuntu 24.04 è installato solo PHP 8.3: oggi ogni sito
  riporta la stessa versione.
- L'API restituisce per ogni sito `id`, `name`, `domain`, `createdAt`, `path`, `blueprint` — campi
  che la superficie GUI attuale non mostra, `name` compreso.
- Gli hook `WPDEV_SELECT`, `WPDEV_OPEN` e `WPDEV_SHOT` in `gui/main.js` sono usati solo dalla GUI
  stessa: nessun altro pezzo del repo dipende dal suo DOM.

Deciso e da rispettare: le etichette che distinguono i siti per scopo (demo per prospect, siti
propri, test) sono **assegnate a mano dall'operatore**, non dedotte, e vivono lato GUI.

## Brand Commitments

Nome del prodotto: **wpdev**. Terminologia esistente da preservare: blueprint **`rn-engine`** (tema
parent brandizzato più child generato con lo slug del sito) e mu-plugins **`fucina-*`**.

Nessun vincolo visivo vincolante: l'identità precedente è stata esplicitamente messa in
sostituzione dall'operatore.

## Evidence on Hand

- Flotta reale di 16 siti interrogabile dall'API in locale; nomi e slug veri.
- README del repo con stack, comandi e gotcha specifici della macchina.
- Stato visivo precedente catturato via l'hook `WPDEV_SHOT`, conservato come anti-riferimento.

Non esistono dati di utilizzo, analytics, telemetria o feedback d'uso di questo strumento: non vanno
inventati.
