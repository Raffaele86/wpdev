{
	admin {{caddyAdmin}}
	storage file_system {{caddyStorage}}
	local_certs
	skip_install_trust
}

import sites/*.caddy
