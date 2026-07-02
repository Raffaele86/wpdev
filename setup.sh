#!/usr/bin/env bash
# setup.sh — installazione una-tantum di wpdev (idempotente, rieseguibile).
# I passi sudo vengono MOSTRATI e chiedono conferma esplicita.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="$HOME/.local/bin"
STATE="$HOME/.wpdev"
mkdir -p "$BIN"

say()  { printf '\n\033[1m== %s ==\033[0m\n' "$*"; }
note() { printf '   %s\n' "$*"; }

confirm() {
  printf '\nEseguo questi comandi con sudo? [y/N] '
  read -r ans
  [[ "$ans" =~ ^[yY](es)?$ ]]
}

# ---------------------------------------------------------------- no-sudo ---
say "Componenti senza sudo"

if [[ ! -x "$BIN/wp" ]]; then
  note "scarico wp-cli…"
  curl -fsSL -o "$BIN/wp" https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
  chmod +x "$BIN/wp"
fi
note "wp-cli: $("$BIN/wp" --version 2>/dev/null | head -1 || echo 'ERRORE')"

if [[ ! -x "$BIN/mailpit" ]]; then
  note "scarico mailpit…"
  tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/mailpit.tar.gz" \
    https://github.com/axllent/mailpit/releases/latest/download/mailpit-linux-amd64.tar.gz
  tar xzf "$tmp/mailpit.tar.gz" -C "$tmp" mailpit
  mv "$tmp/mailpit" "$BIN/mailpit"; rm -rf "$tmp"
fi
note "mailpit: $("$BIN/mailpit" version 2>/dev/null | head -1 || echo 'ERRORE')"

mkdir -p "$STATE/adminer"
if [[ ! -f "$STATE/adminer/adminer.php" ]]; then
  note "scarico Adminer…"
  curl -fsSL -o "$STATE/adminer/adminer.php" https://www.adminer.org/latest.php
fi
note "adminer.php: $(du -h "$STATE/adminer/adminer.php" | cut -f1)"

chmod +x "$REPO/engine/cli.ts" "$REPO/engine/daemon.ts" "$REPO/bin/wpdev-selftest" 2>/dev/null || true
ln -sf "$REPO/engine/cli.ts" "$BIN/wpdev"
note "CLI: $BIN/wpdev → engine/cli.ts"

# ------------------------------------------------------------------- sudo ---
say "Passi con sudo (pacchetti, MariaDB, capability Caddy, helper hosts)"
DB_ADMIN_PASS=""
if [[ -f "$STATE/config.json" ]]; then
  DB_ADMIN_PASS=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$STATE/config.json','utf8')).dbAdminPass)")
else
  DB_ADMIN_PASS=$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 24)
fi

cat <<CMDS

  sudo apt-get install -y php8.3-fpm php8.3-mysql php8.3-gd php8.3-mbstring php8.3-xml \\
       php8.3-zip php8.3-intl php8.3-imagick php8.3-xdebug mariadb-server zip unzip
  sudo systemctl disable --now php8.3-fpm        # i pool per-sito li gestisce wpdev
  # la 3306 è del mysqld di LocalWP lato Windows (rete mirrored): MariaDB su 3307 (WP usa il socket unix)
  sudo tee /etc/mysql/mariadb.conf.d/99-wpdev.cnf   # [mysqld] port = 3307
  sudo systemctl enable --now mariadb
  sudo mariadb <<'SQL'                            # utente admin dedicato (solo db wp_%)
    CREATE USER IF NOT EXISTS 'wpdev'@'localhost' IDENTIFIED BY '<generata>';
    ALTER USER 'wpdev'@'localhost' IDENTIFIED BY '<generata>';
    GRANT ALL PRIVILEGES ON \`wp\_%\`.* TO 'wpdev'@'localhost' WITH GRANT OPTION;
    GRANT CREATE USER ON *.* TO 'wpdev'@'localhost';
  SQL
  sudo setcap 'cap_net_bind_service=+ep' $HOME/.local/bin/caddy   # porte 80/443
  sudo install -o root -g root -m 755 $REPO/engine/wpdev-hosts /usr/local/sbin/wpdev-hosts
  echo '$USER ALL=(root) NOPASSWD: /usr/local/sbin/wpdev-hosts' | sudo tee /etc/sudoers.d/wpdev

CMDS

if confirm; then
  sudo apt-get install -y php8.3-fpm php8.3-mysql php8.3-gd php8.3-mbstring php8.3-xml \
    php8.3-zip php8.3-intl php8.3-imagick php8.3-xdebug mariadb-server zip unzip
  sudo systemctl disable --now php8.3-fpm
  printf '# wpdev: 3306 occupata dal mysqld di Windows/LocalWP (rete mirrored) — WP usa il socket unix\n[mysqld]\nport = 3307\n' | sudo tee /etc/mysql/mariadb.conf.d/99-wpdev.cnf >/dev/null
  sudo systemctl enable --now mariadb
  sudo mariadb <<SQL
CREATE USER IF NOT EXISTS 'wpdev'@'localhost' IDENTIFIED BY '${DB_ADMIN_PASS}';
ALTER USER 'wpdev'@'localhost' IDENTIFIED BY '${DB_ADMIN_PASS}';
GRANT ALL PRIVILEGES ON \`wp\_%\`.* TO 'wpdev'@'localhost' WITH GRANT OPTION;
GRANT CREATE USER ON *.* TO 'wpdev'@'localhost';
SQL
  sudo setcap 'cap_net_bind_service=+ep' "$HOME/.local/bin/caddy"
  sudo install -o root -g root -m 755 "$REPO/engine/wpdev-hosts" /usr/local/sbin/wpdev-hosts
  echo "$USER ALL=(root) NOPASSWD: /usr/local/sbin/wpdev-hosts" | sudo tee /etc/sudoers.d/wpdev >/dev/null
  sudo visudo -cf /etc/sudoers.d/wpdev
  note "passi sudo completati"
else
  note "passi sudo SALTATI: wpdev non funzionerà finché non li esegui (rilancia setup.sh)"
fi

if [[ ! -f "$STATE/config.json" ]]; then
  umask 077
  printf '{\n  "dbAdminUser": "wpdev",\n  "dbAdminPass": "%s",\n  "httpsPort": 8443\n}\n' "$DB_ADMIN_PASS" > "$STATE/config.json"
  note "config.json scritto (credenziali admin MariaDB)"
fi

# ------------------------------------------------------------------ stato ---
say "Stato ~/.wpdev + blueprint bottega"
node --no-warnings "$REPO/engine/tools/setup-state.ts"

say "Package wp-cli per il magic login"
if ! "$BIN/wp" package list --fields=name 2>/dev/null | grep -q wp-cli-login-command; then
  "$BIN/wp" package install aaemnnosttv/wp-cli-login-command || \
    note "AVVISO: package login non installato — 'wpdev admin' userà il fallback user/pass"
else
  note "già installato"
fi

# --------------------------------------------------------------- servizi ---
say "Servizi systemd (user)"
mkdir -p "$HOME/.config/systemd/user"
cp "$REPO/systemd/"wpdev*.service "$HOME/.config/systemd/user/"
systemctl --user daemon-reload
systemctl --user enable --now wpdev-caddy.service wpdev-mailpit.service wpdevd.service
sleep 1
for svc in wpdev-caddy wpdev-mailpit wpdevd; do
  state=$(systemctl --user is-active "$svc.service" || true)
  note "$svc: $state"
done

say "Fatto"
note "prova:  wpdev new demo --blueprint bottega"
note "GUI:    cd $REPO/gui && npm install && wpdev gui"
note "CA per il browser Windows (opzionale, elimina l'avviso certificato):"
note "  certutil -addstore -user Root '\\\\wsl.localhost\\Ubuntu\\home\\$USER\\.wpdev\\caddy\\storage\\pki\\authorities\\local\\root.crt' (da Windows)"
