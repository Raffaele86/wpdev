# wpdev site: {{slug}} (generato — non editare a mano)
https://{{domain}}:{{httpsPort}} {
	tls internal
	root * {{webroot}}
	encode gzip
	php_fastcgi unix/{{socket}}
	file_server
	log {
		output file {{accessLog}} {
			roll_size 10MiB
			roll_keep 3
		}
	}
}
