# wpdev: Adminer (gestione DB) — generato dal setup
https://adminer.localhost:{{httpsPort}} {
	tls internal
	root * {{adminerDir}}
	php_fastcgi unix/{{adminerSocket}} {
		index adminer.php
	}
	file_server
}
