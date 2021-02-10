<?php
/**
 * This enables/disables the WHOLE plugin.
 */
define('PLUGIN_FILES_USER_DEFAULT_ENABLE', false);

/**
 * Display a confirmation popup to the user before a file gets deleted.
 */
define('PLUGIN_FILES_ASK_BEFORE_DELETE', true);

/**
 * The directory where to save cache files for phpfastcache, if memcached is not installed
 */
define('PLUGIN_FILES_CACHE_DIR', "/var/lib/kopano-webapp/plugin_files");

/**
 * Set the verbosity of the plugin.
 *
 * Possible values: DEBUG, NORMAL, ERROR, NONE
 *
 * This setting is not editable within webapp!!
 */
define('PLUGIN_FILESBROWSER_LOGLEVEL', "ERROR");

/**
 * The secret key for encryption the acocunt passwords when "Use Kopano Credentials" is not used.
 * A random secret can be generated with: openssl rand -hex 32
 */
define('FILES_ACCOUNTSTORE_V1_SECRET_KEY', '');
