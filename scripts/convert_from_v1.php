#!/usr/bin/php
<?php
/**
 * convert_from_v1.php
 *
 * This script will convert the files account from plugin version 1 to plugin version 2.
 * The old account entry will be deleted after conversion.
 *
 */
if (php_sapi_name() !== 'cli') {
	die("Script must be run from commandline!");
}



/**
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * !!! ENCRYPTION CONFIGURATION START !!!
 *
 * Standard password key for account data encryption. This values must match the values
 * of the new filesplugin config.php!
 */
define('FILES_PASSWORD_KEY', 'c745626b0d5a31b9');
define('FILES_PASSWORD_IV', '12345678'); // this must not be 12345678!
/**
 * !!! ENCRYPTION CONFIGURATION END !!!
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 */



/**
 * Make sure that the Kopano mapi extension is enabled in cli mode:
 * Add: /etc/php5/cli/conf.d/50-mapi.ini
 * Content: extension=mapi.so
 */
if (!function_exists("mapi_logon_zarafa")) {
	echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n";
	echo "Make sure that the Kopano mapi extension is enabled in cli mode:\n";
	echo "ln -s /etc/php5/apache2/conf.d/mapi.ini /etc/php5/cli/conf.d/mapi.ini\n";
	die ("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n");
}

/**
 * Parse arguments
 */
if ($argc > 1) {
	if (in_array("help", $argv) || in_array("--help", $argv) || in_array("-h", $argv)) {
		echo "Usage: $argv[0] oldconfig [username]\n\n";
		echo "       oldconfig: Path the old (v1) config.php of the files plugin.\n";
		echo "       username: Optional username attribute. If set, the script will only migrate one user.\n";
		echo "";
		echo "Also make sure to edit FILES_PASSWORD_KEY and FILES_PASSWORD_IV in this script! It must match your new configuration!";
		die ("\n");
	}
} else {
	echo "Usage: $argv[0] oldconfig [username]\n\n";
	echo "       oldconfig: Path the old (v1) config.php of the files plugin.\n";
	echo "       username: Optional username attribute. If set, the script will only migrate one user.\n";
	echo "";
	echo "Also make sure to edit FILES_PASSWORD_KEY and FILES_PASSWORD_IV in this script! It must match your new configuration!";
	die ("\n");
}

// include the old config.php
// webapp does only store changed values in settings
// thats why we need the old configuration
include($argv[1]);

// MAPI includes
include('/usr/share/php/mapi/mapi.util.php');
include('/usr/share/php/mapi/mapidefs.php');
include('/usr/share/php/mapi/mapicode.php');
include('/usr/share/php/mapi/mapitags.php');
include('/usr/share/php/mapi/mapiguid.php');


/**
 * Functions used to update the webapp settings.
 */

/* Encrypt the given string. */
function encryptBackendConfigProperty($value) {
	// if user has openssl module installed encrypt
	if (function_exists("openssl_encrypt") && !is_bool($value)) {
		$value = openssl_encrypt($value, "des-ede3-cbc", FILES_PASSWORD_KEY, 0, FILES_PASSWORD_IV);
	}

	return $value;
}

/* gets the old files account */
function get_user_files_account($userStore) {
	// get settings
	// first check if property exist and we can open that using mapi_openproperty
	$storeProps = mapi_getprops($userStore, array(PR_EC_WEBACCESS_SETTINGS_JSON));

	// Check if property exists, if it doesn not exist then we can continue with empty set of settings
	if (isset($storeProps[PR_EC_WEBACCESS_SETTINGS_JSON]) || propIsError(PR_EC_WEBACCESS_SETTINGS_JSON, $storeProps) == MAPI_E_NOT_ENOUGH_MEMORY) {
		// read the settings property
		$stream = mapi_openproperty($userStore, PR_EC_WEBACCESS_SETTINGS_JSON, IID_IStream, 0, 0);
		if ($stream == false) {
			echo "Error opening settings property\n";
		}

		$settings_string = "";
		$stat = mapi_stream_stat($stream);
		mapi_stream_seek($stream, 0, STREAM_SEEK_SET);
		for ($i = 0; $i < $stat['cb']; $i += 1024) {
			$settings_string .= mapi_stream_read($stream, 1024);
		}

		if (empty($settings_string)) {
			// property exists but without any content so ignore it and continue with
			// empty set of settings
			echo "Found empty settings... ignoring.\n";
			return NULL;
		}

		$settings = json_decode($settings_string, true);
		if (empty($settings) || empty($settings['settings'])) {
			echo "Error retrieving existing settings\n";
		}

		$filescontext = $settings["settings"]["zarafa"]["v1"]["contexts"]["files"];

		if ($filescontext) {
			$ssl = isset($filescontext["use_ssl"]) ? $filescontext["use_ssl"] : PLUGIN_FILESATTCHMENT_USE_SSL;
			$port = isset($filescontext["port"]) ? $filescontext["port"] : PLUGIN_FILESATTCHMENT_PORT;
			$port_ssl = isset($filescontext["port_ssl"]) ? $filescontext["port_ssl"] : PLUGIN_FILESATTCHMENT_PORT;

			$account = array(
				"server" => isset($filescontext["server"]) ? $filescontext["server"] : PLUGIN_FILESATTCHMENT_SERVER,
				"base" => isset($filescontext["files_path"]) ? $filescontext["files_path"] : PLUGIN_FILESATTCHMENT_PATH,
				"use_ssl" => $ssl,
				"username" => isset($filescontext["username"]) ? $filescontext["username"] : PLUGIN_FILESATTCHMENT_USER,
				"port" => $ssl ? $port_ssl : $port,
				"backend" => isset($filescontext["backend"]) ? $filescontext["backend"] : PLUGIN_FILESATTCHMENT_BACKEND,
				"session_auth" => isset($filescontext["session_auth"]) ? $filescontext["session_auth"] : PLUGIN_FILESATTCHMENT_USE_SESSION_AUTH,
				"password" => isset($filescontext["password"]) ? $filescontext["password"] : PLUGIN_FILESATTCHMENT_PASS,
			);

			return $account;
		}
	}

	return NULL;
}

/* updates the webapp settings */
function update_files_account($userStore, $newaccount) {
	// get settings
	// first check if property exist and we can open that using mapi_openproperty
	$storeProps = mapi_getprops($userStore, array(PR_EC_WEBACCESS_SETTINGS_JSON));

	// Check if property exists, if it doesn not exist then we can continue with empty set of settings
	if (isset($storeProps[PR_EC_WEBACCESS_SETTINGS_JSON]) || propIsError(PR_EC_WEBACCESS_SETTINGS_JSON, $storeProps) == MAPI_E_NOT_ENOUGH_MEMORY) {
		// read the settings property
		$stream = mapi_openpropertytostream($userStore, PR_EC_WEBACCESS_SETTINGS_JSON, MAPI_MODIFY);
		if ($stream == false) {
			echo "Error opening settings property\n";
		}

		$settings_string = "";
		$stat = mapi_stream_stat($stream);
		mapi_stream_seek($stream, 0, STREAM_SEEK_SET);
		for ($i = 0; $i < $stat['cb']; $i += 1024) {
			$settings_string .= mapi_stream_read($stream, 1024);
		}

		if (empty($settings_string)) {
			// property exists but without any content so ignore it and continue with
			// empty set of settings
			return false;
		}

		$settings = json_decode($settings_string, true);
		if (empty($settings) || empty($settings['settings'])) {
			echo "Error retrieving existing settings\n";
		}

		// delete old account settings
		unset($settings["settings"]["zarafa"]["v1"]["contexts"]["files"]["username"]);
		unset($settings["settings"]["zarafa"]["v1"]["contexts"]["files"]["password"]);
		unset($settings["settings"]["zarafa"]["v1"]["contexts"]["files"]["server"]);
		unset($settings["settings"]["zarafa"]["v1"]["contexts"]["files"]["use_ssl"]);
		unset($settings["settings"]["zarafa"]["v1"]["contexts"]["files"]["port"]);
		unset($settings["settings"]["zarafa"]["v1"]["contexts"]["files"]["port_ssl"]);
		unset($settings["settings"]["zarafa"]["v1"]["contexts"]["files"]["backend"]);
		unset($settings["settings"]["zarafa"]["v1"]["contexts"]["files"]["session_auth"]);
		unset($settings["settings"]["zarafa"]["v1"]["contexts"]["files"]["files_path"]);

		// create a new account
		$accountID = md5(json_encode($newaccount)); // json_encode is faster than serialize;

		if($newaccount["backend"] === "webdav") { // webdav backend
			$account = array(
				"name" => "Files Account",
				"id" => $accountID,
				"status" => "ok",
				"status_description" => "Account is ready to use",
				"backend" => "Webdav",
				"backend_config" => array(
					"current_account_id" => encryptBackendConfigProperty($accountID),
					"password" => encryptBackendConfigProperty($newaccount["password"]),
					"user" => encryptBackendConfigProperty($newaccount["username"]),
					"use_zarafa_credentials" => $newaccount["session_auth"],
					"server_ssl" => $newaccount["use_ssl"],
					"server_port" => encryptBackendConfigProperty($newaccount["port"]),
					"server_path" => encryptBackendConfigProperty($newaccount["base"]),
					"server_address" => encryptBackendConfigProperty($newaccount["server"]),
				),
				"backend_features" => array(
					"Quota" => true,
					"VersionInfo" => true,
				),
			);
		} else { // ftp backend
			$account = array(
				"name" => "Files Account",
				"id" => $accountID,
				"status" => "ok",
				"status_description" => "Account is ready to use",
				"backend" => "FTP",
				"backend_config" => array(
					"current_account_id" => encryptBackendConfigProperty($accountID),
					"password" => encryptBackendConfigProperty($newaccount["password"]),
					"user" => encryptBackendConfigProperty($newaccount["username"]),
					"use_zarafa_credentials" => $newaccount["session_auth"],
					"server_ssl" => $newaccount["use_ssl"],
					"server_pasv" => false,
					"server_port" => encryptBackendConfigProperty($newaccount["port"]),
					"server_path" => encryptBackendConfigProperty($newaccount["base"]),
					"server_address" => encryptBackendConfigProperty($newaccount["server"]),
				),
				"backend_features" => array(
					"Streaming" => true,
				),
			);
		}

		if(isset($settings["settings"]["zarafa"]["v1"]["plugins"]["files"]["accounts"][$accountID]) || isset($settings["settings"]["zarafa"]["v1"]["contexts"]["files"]["migrated_v1"])) {
			echo "Account already migrated... skipping. (Account ID: $accountID)\n";
		} else {
			$settings["settings"]["zarafa"]["v1"]["plugins"]["files"]["accounts"][$accountID] = $account;
			$settings["settings"]["zarafa"]["v1"]["contexts"]["files"]["migrated_v1"] = $accountID;
		}

		$newsettings = json_encode($settings);
		mapi_stream_setsize($stream, strlen($newsettings));
		mapi_stream_seek($stream, 0, STREAM_SEEK_SET);
		mapi_stream_write($stream, $newsettings);
		$res = mapi_stream_commit($stream);
		return $res;
	}

	return false;
}

/* start the migration */
function migrate($argc, $argv) {
	// first check if the encryption settings have been changed
	if(FILES_PASSWORD_IV == "12345678") {
		exit("FATAL: You have to change the encryption settings in this script first!");
	}

	// log in to Kopano
	$session = mapi_logon_zarafa("SYSTEM", "", "file:///var/run/kopano/server.sock");
	if ($session === FALSE) {
		exit("FATAL: Logon to Kopano failed with error " . mapi_last_hresult() . ". Are you root?\n");
	}

	// load all stores for the admin user
	$storeTable = mapi_getmsgstorestable($session);
	if ($storeTable === FALSE) {
		exit("FATAL: Storetable could not be opened. Error " . mapi_last_hresult() . "\n");
	}
	$storesList = mapi_table_queryallrows($storeTable, array(PR_ENTRYID, PR_DEFAULT_STORE));

	// get admin users default store
	foreach ($storesList as $row) {
		if ($row[PR_DEFAULT_STORE]) {
			$storeEntryid = $row[PR_ENTRYID];
		}
	}
	if (!$storeEntryid) {
		exit("FATAL: Can't find default store\n");
	}

	// open default store
	$store = mapi_openmsgstore($session, $storeEntryid);
	if (!$store) {
		exit("FATAL: Unable to open system store\n");
	}

	// get a userlist
	$userList = array();
	// for multi company setup
	$companyList = mapi_zarafa_getcompanylist($store);
	if (mapi_last_hresult() == NOERROR && is_array($companyList)) {
		// multi company setup, get all users from all companies
		foreach ($companyList as $companyName => $companyData) {
			$userList = array_merge($userList, mapi_zarafa_getuserlist($store, $companyData["companyid"]));
		}
	} else {
		// single company setup, get list of all Kopano users
		$userList = mapi_zarafa_getuserlist($store);
	}
	if (count($userList) <= 0) {
		exit("FATAL: Unable to get user list\n");
	}

	// loop over all users
	foreach ($userList as $userName => $userData) {
		// check for valid users
		if ($userName == "SYSTEM") {
			continue;
		}

		// check if we should only migrate on user
		if($argc == 3 && !empty($argv[2])) {
			if ($userName !== $argv[2]) {
				continue;
			}
		}

		echo "### Getting old account settings for user: " . $userName . "\n";

		$userEntryId = mapi_msgstore_createentryid($store, $userName);
		$userStore = mapi_openmsgstore($session, $userEntryId);
		if (!$userStore) {
			echo "Can't open user store\n";
			continue;
		}

		$accountItem = get_user_files_account($userStore);

		if ($accountItem != NULL) {
			echo "Found old Files account: " . $accountItem["username"] . "@" . $accountItem["server"] . " [" . $accountItem["backend"] . "]\n";
			update_files_account($userStore, $accountItem);
		}

		echo "### Done migration for user: " . $userName . "\n\n";
	}

	echo "###############################################\n";
	echo "##  Migration to Files Plugin v2 completed!  ##\n";
	echo "###############################################\n";
}

migrate($argc, $argv);
?>
