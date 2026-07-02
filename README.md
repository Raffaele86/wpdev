# wpdev — WordPress locale scriptabile (clone LocalWP nativo WSL)

Replica il modello di Local by WP Engine — registry siti, stack isolato per sito,
Live Link, blueprint — come **engine headless** (daemon + CLI) con **GUI Electron** sopra.
Gira in WSL, pilotabile sia a mano sia da agenti Claude.

**Stack:** Caddy (istanza dedicata, CA interna, admin `127.0.0.1:2020`) ·
un pool **php-fpm per sito** (socket unix) · **MariaDB** condiviso con db+utente per sito ·
**wp-cli** per ogni operazione WP · **Mailpit** (SMTP `:1025`, UI `:8025`) ·
**cloudflared** quick tunnel per il Live Link · **Adminer** su `https://adminer.localhost:8443`.

## Installazione

```bash
bash ~/wpdev/setup.sh      # idempotente; i passi sudo vengono mostrati e chiedono conferma
wpdev selftest             # suite di accettazione end-to-end (crea/verifica/elimina un sito)
```

## Comandi

| Comando | Cosa fa |
|---|---|
| `wpdev new <slug> [--blueprint <n>] [--php 8.3] [--title ..] [--locale it_IT]` | crea un sito WP completo su `https://<slug>.localhost:8443` |
| `wpdev list` | elenca i siti con stato e Live Link |
| `wpdev start\|stop\|restart <slug>\|--all` | gestisce fpm + vhost del sito |
| `wpdev delete <slug> [--yes]` | elimina TUTTO senza residui (webroot, db, vhost, hosts, registry) |
| `wpdev cli <slug> -- <args>` | wp-cli sul sito (es. `wpdev cli demo -- plugin list`) |
| `wpdev shell <slug>` | shell nel webroot |
| `wpdev open <slug>` | stampa l'URL |
| `wpdev admin <slug>` | URL di login automatico (magic link one-time) |
| `wpdev db <slug>` | URL Adminer + credenziali |
| `wpdev share <slug> [--auth u:p]` / `--stop` | Live Link pubblico (trycloudflare + basic auth) |
| `wpdev clone <src> <dst>` | clona sito + db con search-replace |
| `wpdev export <slug>` | zip webroot + dump .sql in `~/wpdev-exports/` |
| `wpdev import <zip> <slug> [--sql f] [--source-url u]` | importa da zip (formato export) |
| `wpdev import --from-remote u@host:/path <slug>` | importa da server via ssh (webroot + `wp db export` remoto) |
| `wpdev blueprint list` / `blueprint save <slug> <nome>` | gestione blueprint |
| `wpdev php <slug> <ver>` / `wpdev xdebug <slug> on\|off` | versione PHP / xdebug per sito |
| `wpdev logs <slug> [--tail N]` | log php/caddy/wp/cloudflared del sito |
| `wpdev mailpit` | URL della UI Mailpit |
| `wpdev gui` | apre la GUI desktop (WSLg) |
| `wpdev daemon start\|stop\|status` | gestione del daemon |

API HTTP/JSON: `http://127.0.0.1:9700/api/…` (la CLI e la GUI usano solo questa).
Operazioni lunghe → risposta NDJSON in streaming (`{"event":"log"|"done"|"error"}`).

## Layout

```
~/wpdev/                 questo repo (engine TS su node 24, gui Electron, setup, selftest)
~/.wpdev/                stato: sites.json, config.json, caddy/, php/, run/, logs/, blueprints/
~/wpdev-sites/<slug>/app/public    webroot (layout speculare a Local)
~/wpdev-exports/         export zip+sql (mai dentro un webroot)
```

## Gotcha noti (macchina di Raffaele)

- **Porta 8443, non 443**: il router httpd di **LocalWP su Windows** occupa 80/443 (rete WSL
  mirrored). Idem MySQL di Local su 3306 → **MariaDB sta su 3307** (`99-wpdev.cnf`; WP usa il
  socket unix). Quando LocalWP sparirà: `httpsPort: 443` in `~/.wpdev/config.json`, rimuovere
  il `.cnf`, riavviare i servizi (il `setcap` su caddy è già fatto).
- **`*.localhost` non risolve dentro WSL** (i browser Windows sì): ci pensa l'helper
  privilegiato `/usr/local/sbin/wpdev-hosts` (sudoers NOPASSWD, blocco marcato in `/etc/hosts`).
- **Quick tunnel + `~/.cloudflared/config.yml` legacy = 404**: il config file dirotta l'ingress
  del quick tunnel. L'engine passa sempre `--config ~/.wpdev/cloudflared-empty.yml`.
- **HTTPS del Live Link**: il quick tunnel manda `Cf-Visitor`, non `X-Forwarded-Proto` —
  gestito nel template wp-config (URL dinamici da `HTTP_HOST`, quindi lo stesso sito risponde
  sia su `.localhost` sia sull'URL trycloudflare senza search-replace).
- **Avviso certificato nel browser**: CA interna Caddy. Per eliminarlo, da Windows:
  `certutil -addstore -user Root "\\wsl.localhost\Ubuntu\home\raffa\.wpdev\caddy\storage\pki\authorities\local\root.crt"`
- **`setcap` si perde** se sostituisci il binario `~/.local/bin/caddy` → rilancia setup.sh.
- **Multi-PHP**: predisposto (`phpVersion` per sito). Su Ubuntu 24.04 c'è solo 8.3; per altre:
  `sudo add-apt-repository ppa:ondrej/php && sudo apt install php8.4-fpm php8.4-{mysql,gd,mbstring,xml,zip,intl,imagick}`
- **Live Link stabile**: i quick tunnel cambiano URL a ogni avvio e non sopravvivono al
  riavvio del daemon. Per URL fissi la strada è un named tunnel (cert.pem già presente) — non
  implementato finché non serve.

## Servizi

`systemctl --user …` su `wpdevd` (engine), `wpdev-caddy`, `wpdev-mailpit`. MariaDB è di sistema.
I php-fpm per sito e i cloudflared dei Live Link sono figli di `wpdevd` (rilanciati/azzerati
alla partenza dal reconcile).

## Deploy verso Hostinger

`wpdev export <slug>` produce zip+sql pronti per il flusso abituale: `scp` sul server,
import db, poi `wp litespeed-purge all` (vedi memoria `raffaelenocera-deploy-litespeed-purge`).
