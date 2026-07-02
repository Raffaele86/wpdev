{
	admin {{caddyAdmin}}
	storage file_system {{caddyStorage}}
	local_certs
	skip_install_trust
	# la :80 è del router LocalWP (Windows, rete mirrored): niente redirect HTTP
	auto_https disable_redirects
}

import sites/*.caddy
