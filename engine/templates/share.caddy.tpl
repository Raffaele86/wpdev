# wpdev share: {{slug}} (Live Link — generato, non editare a mano)
# host-agnostico: cloudflared inoltra con l'Host trycloudflare originale
http://:{{sharePort}} {
	bind 127.0.0.1
	basic_auth {
		{{authUser}} {{authHash}}
	}
	root * {{webroot}}
	encode gzip
	php_fastcgi unix/{{socket}}
	file_server
}
