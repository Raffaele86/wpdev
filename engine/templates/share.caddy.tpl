# wpdev share: {{slug}} (Live Link — generato, non editare a mano)
http://127.0.0.1:{{sharePort}} {
	basic_auth {
		{{authUser}} {{authHash}}
	}
	root * {{webroot}}
	encode gzip
	php_fastcgi unix/{{socket}}
	file_server
}
