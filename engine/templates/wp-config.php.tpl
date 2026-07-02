<?php
/** wpdev wp-config — generato, non editare a mano (rigenerato da wpdev) */

// Dietro il Live Link (cloudflared) il TLS termina all'edge: rispetta X-Forwarded-Proto.
if ( ! empty( $_SERVER['HTTP_X_FORWARDED_PROTO'] ) && 'https' === $_SERVER['HTTP_X_FORWARDED_PROTO'] ) {
	$_SERVER['HTTPS'] = 'on';
}

// URL dinamici dall'Host: lo stesso sito risponde su <slug>.localhost E sull'URL del Live Link.
if ( ! empty( $_SERVER['HTTP_HOST'] ) ) {
	$wpdev_scheme = ( ! empty( $_SERVER['HTTPS'] ) && 'off' !== $_SERVER['HTTPS'] ) ? 'https' : 'http';
	define( 'WP_HOME', $wpdev_scheme . '://' . $_SERVER['HTTP_HOST'] );
	define( 'WP_SITEURL', WP_HOME );
}

define( 'DB_NAME', '{{dbName}}' );
define( 'DB_USER', '{{dbUser}}' );
define( 'DB_PASSWORD', '{{dbPass}}' );
define( 'DB_HOST', 'localhost' );
define( 'DB_CHARSET', 'utf8mb4' );
define( 'DB_COLLATE', '' );

define( 'AUTH_KEY',         '{{salt1}}' );
define( 'SECURE_AUTH_KEY',  '{{salt2}}' );
define( 'LOGGED_IN_KEY',    '{{salt3}}' );
define( 'NONCE_KEY',        '{{salt4}}' );
define( 'AUTH_SALT',        '{{salt5}}' );
define( 'SECURE_AUTH_SALT', '{{salt6}}' );
define( 'LOGGED_IN_SALT',   '{{salt7}}' );
define( 'NONCE_SALT',       '{{salt8}}' );

$table_prefix = 'wp_';

define( 'WP_ENVIRONMENT_TYPE', 'local' );
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', '{{wpDebugLog}}' );
define( 'WP_DEBUG_DISPLAY', false );
define( 'DISALLOW_FILE_EDIT', true );
define( 'FS_METHOD', 'direct' );

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}
require_once ABSPATH . 'wp-settings.php';
