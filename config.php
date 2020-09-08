<?php
/** 
 * This enables/disables the WHOLE plugin.
 */
define('PLUGIN_FILES_USER_DEFAULT_ENABLE', true);

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
 * Standard password key for account data encryption. We recommend to change the default value for security reasons
 * and a length of 16 characters. Data is only encrypted when the openssl module is installed
 * IV vector should be 8 bits long
 */
define('FILES_PASSWORD_KEY', 'c745626b0d5a31b9');
define('FILES_PASSWORD_IV', '5621abb6');
