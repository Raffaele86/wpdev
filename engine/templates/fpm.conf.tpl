; wpdev php-fpm per sito: {{slug}} (generato — non editare a mano)
[global]
pid = {{pidFile}}
error_log = {{fpmLog}}
daemonize = no

[{{slug}}]
listen = {{socket}}
listen.mode = 0660
pm = ondemand
pm.max_children = 5
pm.process_idle_timeout = 60s
pm.max_requests = 500
catch_workers_output = yes
php_admin_value[sendmail_path] = {{mailpitBin}} sendmail -S {{mailpitSmtp}}
php_admin_value[error_log] = {{phpErrorLog}}
php_admin_flag[log_errors] = on
php_admin_flag[display_errors] = off
php_admin_value[memory_limit] = 256M
php_admin_value[upload_max_filesize] = 64M
php_admin_value[post_max_size] = 64M
php_admin_value[max_execution_time] = 120
php_admin_value[xdebug.mode] = {{xdebugMode}}
php_admin_value[xdebug.start_with_request] = trigger
