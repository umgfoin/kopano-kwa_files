<?php

namespace Files\Backend\FTP;

require_once __DIR__ . "/../class.abstract_backend.php";
require_once __DIR__ . "/../class.exception.php";

use Files\Backend\AbstractBackend;
use Files\Backend\Exception as BackendException;
use Files\Backend\iFeatureStreaming;
use \Sabre\DAV\Exception as Exception;

/**
 * This is a file backend for ftp servers.
 *
 * @class   Backend
 * @extends AbstractBackend
 */
class Backend extends AbstractBackend implements iFeatureStreaming
{

	/**
	 * Supported features
	 */

	/**
	 * Error codes
	 * see @parseErrorCodeToMessage for description
	 */
	const FTP_ERR_UNAUTHORIZED = 401;
	const FTP_ERR_FORBIDDEN = 403;
	const FTP_ERR_NOTFOUND = 404;
	const FTP_ERR_TIMEOUT = 408;
	const FTP_ERR_LOCKED = 423;
	const FTP_ERR_FAILED_DEPENDENCY = 423;
	const FTP_ERR_INTERNAL = 500;
	const FTP_ERR_UNREACHABLE = 800;
	const FTP_ERR_TMP = 801;
	const FTP_ERR_FEATURES = 802;
	const FTP_ERR_UNIMPLEMENTED = 803;

	/**
	 * Configuration data for the extjs metaform.
	 */
	private $formConfig;
	private $formFields;
	private $metaConfig;

	/**
	 * @var boolean debuggin flag, if true, debugging is enabled
	 */
	var $debug = false;

	/**
	 * @var int ftp server port
	 */
	var $port = 21;

	/**
	 * @var string hostname or ip
	 */
	var $server = "localhost";

	/**
	 * @var string global path prefix for all requests
	 */
	var $path = "/";

	/**
	 * @var boolean if true, ssl is used
	 */
	var $ssl = false;

	/**
	 * @var boolean allow self signed certificates
	 */
	var $allowselfsigned = true;

	/**
	 * @var number Timout of the ftp connection in seconds.
	 */
	var $timeout = 3;

	/**
	 * @var string the username
	 */
	var $user = "";

	/**
	 * @var string the password
	 */
	var $pass = "";

	/**
	 * @var boolean use passive mode.
	 */
	var $pasv = false;

	/**
	 * @var resource our ftp client object.
	 */
	var $ftp_client;

	/**
	 * @constructor
	 */
	function __construct()
	{
		// initialization
		$this->debug = PLUGIN_FILESBROWSER_LOGLEVEL === "DEBUG" ? true : false;

		$this->init_form();

		// set backend description
		$this->backendDescription = dgettext('plugin_files', "With this backend, you can connect to any ftp server.");

		// set backend display name
		$this->backendDisplayName = "FTP";

		// set backend version
		// TODO: this should be changed on every release
		$this->backendVersion = "1.0";
	}

	/**
	 * @destructor
	 */
	function __destruct() {
		// clean ftp connection
		if($this->ftp_client) {
			ftp_close($this->ftp_client);
		}
	}

	/**
	 * Initialize backend from $backend_config array
	 * @param $backend_config
	 */
	public function init_backend($backend_config)
	{
		$this->set_server($backend_config["server_address"]);
		$this->set_port($backend_config["server_port"]);
		$this->set_base($backend_config["server_path"]);
		$this->set_ssl($backend_config["server_ssl"]);
		$this->set_pasv($backend_config["server_pasv"]);

		$this->log($backend_config["use_zarafa_credentials"] === FALSE ? "false" : "true");
		// set user and password
		if ($backend_config["use_zarafa_credentials"] === FALSE) {
			$this->set_user($backend_config["user"]);
			$this->set_pass($backend_config["password"]);
		} else {
			// For backward compatibility we will check if the Encryption store exists. If not,
			// we will fall back to the old way of retrieving the password from the session.
			if ( class_exists('EncryptionStore') ) {
				// Get the username and password from the Encryption store
				$encryptionStore = \EncryptionStore::getInstance();
				$this->set_user($encryptionStore->get('username'));
				$this->set_pass($encryptionStore->get('password'));
			} else {
				$this->set_user($GLOBALS['mapisession']->getUserName());
				$password = $_SESSION['password']; 
				if(function_exists('openssl_decrypt')) {
					// In PHP 5.3.3 the iv parameter was added
					if(version_compare(phpversion(), "5.3.3", "<")) {
						$this->set_pass(openssl_decrypt($password, "des-ede3-cbc", PASSWORD_KEY, 0));
					} else {
						$this->set_pass(openssl_decrypt($password, "des-ede3-cbc", PASSWORD_KEY, 0, PASSWORD_IV));
					}
				}
			}
		}
	}

	/**
	 * Initialise form fields
	 */
	private function init_form()
	{
		$this->formConfig = array(
			"labelAlign" => "left",
			"columnCount" => 2,
			"labelWidth" => 80,
			"defaults" => array(
				"width" => 120
			)
		);

		$this->formFields = array(
			array(
				"name" => "server_address",
				"fieldLabel" => dgettext('plugin_files', 'Server address'),
				"editor" => array(
					"allowBlank" => false
				)
			),
			array(
				"name" => "server_port",
				"fieldLabel" => dgettext('plugin_files', 'Server port'),
				"editor" => array(
					"allowBlank" => false
				)
			),
			array(
				"name" => "user",
				"fieldLabel" => dgettext('plugin_files', 'FTP user'),
				"editor" => array(
					"ref" => "../../usernameField"
				)
			),
			array(
				"name" => "password",
				"fieldLabel" => dgettext('plugin_files', 'FTP password'),
				"editor" => array(
					"ref" => "../../passwordField",
					"inputType" => "password"
				)
			),
			array(
				"name" => "server_path",
				"fieldLabel" => dgettext('plugin_files', 'Base path'),
				"editor" => array(
					"allowBlank" => false
				)
			),
			array(
				"name" => "server_ssl",
				"fieldLabel" => dgettext('plugin_files', 'Use SSL'),
				"editor" => array(
					"xtype" => "checkbox"
				)
			),
			array(
				"name" => "server_pasv",
				"fieldLabel" => dgettext('plugin_files', 'Use passive mode'),
				"editor" => array(
					"xtype" => "checkbox"
				)
			),
			array(
				"name" => "use_zarafa_credentials",
				"fieldLabel" => dgettext('plugin_files', 'Use Kopano credentials'),
				"editor" => array(
					"xtype" => "checkbox",
					"listeners" => array(
						"check" => "Zarafa.plugins.files.data.Actions.onCheckCredentials" // this javascript function will be called!
					)
				)
			)
		);

		$this->metaConfig = array(
			"success" => true,
			"metaData" => array(
				"fields" => $this->formFields,
				"formConfig" => $this->formConfig
			),
			"data" => array( // here we can specify the default values.
				"server_address" => "127.0.0.1",
				"server_port" => "21",
				"server_path" => "/"
			)
		);
	}

	/**
	 * Set ftp server. FQN or IP address.
	 *
	 * @param string $server hostname or ip of the ftp server
	 *
	 * @return void
	 */
	public function set_server($server)
	{
		$this->server = $server;
	}

	/**
	 * Set base path
	 *
	 * @param string $pp the global path prefix
	 *
	 * @return void
	 */
	public function set_base($pp)
	{
		$this->path = $pp;
		$this->log('Base path set to ' . $this->path);
	}

	/**
	 * Set ssl
	 *
	 * @param int /bool $ssl (1 = true, 0 = false)
	 *
	 * @return void
	 */
	public function set_ssl($ssl)
	{
		$this->ssl = $ssl ? true : false;
		$this->log('SSL extention was set to ' . $this->ssl);
	}

	/**
	 * Set passive mode
	 *
	 * @param bool $pasv
	 *
	 * @return void
	 */
	public function set_pasv($pasv)
	{
		$this->pasv = $pasv ? true : false;
		$this->log('Passive mode: ' . $this->pasv);
	}

	/**
	 * Allow self signed certificates - unimplemented
	 *
	 * @param bool $allowselfsigned Allow self signed certificates. Not yet implemented.
	 *
	 * @return void
	 */
	public function set_selfsigned($allowselfsigned)
	{
		$this->allowselfsigned = $allowselfsigned;
	}

	/**
	 * Set tcp port of ftp server. Default is 21.
	 *
	 * @param int $port the port of the ftp server
	 *
	 * @return void
	 */
	public function set_port($port)
	{
		$this->port = $port;
	}

	/**
	 * set user name for authentication
	 *
	 * @param string $user username
	 *
	 * @return void
	 */
	public function set_user($user)
	{
		$this->user = $user;
	}

	/**
	 * Set password for authentication
	 *
	 * @param string $pass password
	 *
	 * @return void
	 */
	public function set_pass($pass)
	{
		$this->pass = $pass;
	}

	/**
	 * set debug on (1) or off (0).
	 * produces a lot of debug messages in webservers error log if set to on (1).
	 *
	 * @param boolean $debug enable or disable debugging
	 *
	 * @return void
	 */
	public function set_debug($debug)
	{
		$this->debug = $debug;
	}

	/**
	 * Opens the connection to the ftp server.
	 *
	 * @throws BackendException if connection is not successful
	 * @return boolean true if action succeeded
	 */
	public function open()
	{
		if ($this->ssl) {
			$this->ftp_client = @ftp_ssl_connect($this->server, $this->port, $this->timeout);
		} else {
			$this->ftp_client = @ftp_connect($this->server, $this->port, $this->timeout);
		}

		if ($this->ftp_client !== FALSE) {
			$login_result = @ftp_login($this->ftp_client, $this->user, $this->pass);
			if ($login_result !== FALSE) {
				$pas_res = @ftp_pasv($this->ftp_client, $this->pasv);
				return $pas_res;
			} else {
				$err = error_get_last();
				$this->log('[OPEN] auth failed: ' . $this->user . ' (err: ' . $err["message"] . ')');
				throw new BackendException($this->parseErrorCodeToMessage(self::FTP_ERR_UNAUTHORIZED), self::FTP_ERR_UNAUTHORIZED);
			}
		} else {
			$err = error_get_last();
			$this->log('[OPEN] could not connect to server: ' . $this->server . ' (err: ' . $err["message"] . ')');
			throw new BackendException($this->parseErrorCodeToMessage(self::FTP_ERR_UNREACHABLE), self::FTP_ERR_UNREACHABLE);
		}
	}

	/**
	 * show content of a diretory
	 *
	 * @param string $dir directory path
	 * @param boolean $hidefirst Optional parameter to hide the root entry. Default true
	 *
	 * @throws BackendException if request is not successful
	 *
	 * @return mixed array with directory content
	 */
	public function ls($dir, $hidefirst = true)
	{
		$time_start = microtime(true);

		$dir = $this->appendBasePath($dir);
		$files = array();
		$contents = @ftp_rawlist($this->ftp_client, $dir);
		if ($contents && count($contents)) {
			foreach ($contents as $line) {
				$this->log("[LS] $dir: " . $line);
				$result = preg_match("#([drwxt\-]+)([\s]+)([0-9]+)([\s]+)([a-zA-Z0-9\-\.]+)([\s]+)([a-zA-Z0-9\-\.]+)([\s]+)([0-9]+)([\s]+)([a-zA-Z]+)([\s]+)([0-9]+)([\s]+)(?:([0-9]+):([0-9]+)|([0-9]+))([\s]+)(.*)#si", $line, $out);

				if ($result === FALSE || $result === 0) {
					throw new BackendException(dgettext('plugin_files', 'Unparsable server response.'), 500);
				}

				if ($hidefirst && ($out[1]{0} === 'd' && ($out[18] == "." || $out[18] == ".."))) {
					// do nothing
				} else {
					$tmpend = $out[1]{0} === 'd' ? "/" : "";
					$fpath = rtrim($dir, '/') . "/" . $out[19] . $tmpend;
					$fpath = '/' . trim($fpath, '/');

					// remove base path:
					$fpath = $this->removeBasePath($fpath);

					$files[$fpath]['resourcetype'] = $out[1]{0} === 'd' ? "collection" : "file";
					$files[$fpath]['getcontentlength'] = $out[9];
					if ($out[15] === "" || $out[16] === "") {
						$files[$fpath]['getlastmodified'] = $out[11] . " " . $out[13] . " " . $out[17];
					} else {
						$files[$fpath]['getlastmodified'] = $out[11] . " " . $out[13] . " " . $out[15] . ":" . $out[16];
					}
					$files[$fpath]["getcontenttype"] = null;
					$files[$fpath]["quota-used-bytes"] = null;
					$files[$fpath]["quota-available-bytes"] = null;
				}
			}
		} else {
			$err = error_get_last();
			$this->log('[LS] failed: ' . $err["message"]);
		}
		$time_end = microtime(true);
		$time = $time_end - $time_start;
		$this->log("[LS] done in $time seconds");
		return $files;
	}

	/**
	 * create a new diretory
	 *
	 * @param string $dir directory path
	 *
	 * @throws BackendException if request is not successful
	 *
	 * @return boolean true if action succeeded
	 */
	public function mkcol($dir)
	{
		$time_start = microtime(true);
		$dir = $this->appendBasePath($dir);
		$this->log("[MKCOL] start for dir: $dir");

		$result = @ftp_mkdir($this->ftp_client, rawurldecode($dir));
		$time_end = microtime(true);
		$time = $time_end - $time_start;

		if ($result) {
			$this->log("[MKCOL] done in $time seconds");
			return true;
		} else {
			$err = error_get_last();
			$this->log('[MKCOL] failed: ' . $err["message"]);
			throw new BackendException($err["message"], self::FTP_ERR_INTERNAL);
		}
	}

	/**
	 * delete a file or directory
	 *
	 * @param string $path file/directory path
	 *
	 * @throws BackendException if request is not successful
	 *
	 * @return boolean true if action succeeded
	 */
	public function delete($path)
	{
		$time_start = microtime(true);
		$dir = $this->appendBasePath($path);
		$this->log("[DELETE] start for dir: $path");

		if ($this->is_file($path)) {
			$this->log("deleting file: ");
			$result = @ftp_delete($this->ftp_client, rawurldecode($dir));
		} else {
			$this->log("deleting dir");
			$result = $this->ftp_rmdirr(rawurldecode($dir));
		}

		$time_end = microtime(true);
		$time = $time_end - $time_start;

		if ($result) {
			$this->log("[DELETE] done in $time seconds: " . $result);
			return true;
		} else {
			$err = error_get_last();
			$this->log('[DELETE] failed: ' . $err["message"]);
			throw new BackendException($err["message"], self::FTP_ERR_INTERNAL);
		}
	}

	/**
	 * recursive function to delete a directory with sub-folders/files
	 *
	 * @access private
	 * @param string $path directory path
	 *
	 * @return boolean true on success, false otherwise
	 */
	private function ftp_rmdirr($path)
	{
		if (!@ftp_delete($this->ftp_client, $path)) {
			$list = @ftp_nlist($this->ftp_client, $path);
			if (!empty($list)) {
				foreach ($list as $value) {
					$this->ftp_rmdirr($value);
				}
			}
		}

		if (@ftp_rmdir($this->ftp_client, $path)) {
			return true;
		} else {
			return false;
		}
	}

	/**
	 * Move a file or collection on ftp server (serverside)
	 * If you set param overwrite as true, the target will be overwritten.
	 *
	 * @param string $src_path Source path
	 * @param string $dst_path Destination path
	 * @param boolean $overwrite Overwrite file if exists in $dest_path
	 *
	 * @throws BackendException if request is not successful
	 *
	 * @return boolean true if action succeeded
	 */
	public function move($src_path, $dst_path, $overwrite = false)
	{
		$time_start = microtime(true);
		$src_dir = $this->appendBasePath($src_path);
		$dst_dir = $this->appendBasePath($dst_path);
		$this->log("[MOVE] start for dir: $src_path -> $dst_path");
		if ($overwrite) {
			try {
				$this->delete($dst_path);
			} catch (BackendException $ex) {
				// ignore - the file does not exist
			}
		}

		$result = @ftp_rename($this->ftp_client, rawurldecode($src_dir), rawurldecode($dst_dir));

		$time_end = microtime(true);
		$time = $time_end - $time_start;

		if ($result) {
			$this->log("[MOVE] done in $time seconds: $src_dir -> $dst_dir");
			return true;
		} else {
			$err = error_get_last();
			$this->log('[MOVE] failed: ' . $err["message"]);
			throw new BackendException($err["message"], self::FTP_ERR_INTERNAL);
		}
	}

	/**
	 * Puts a file into a collection.
	 *
	 * @param string $path Destination path
	 * @param mixed $data Any kind of data
	 *
	 * @throws BackendException if request is not successful
	 *
	 * @return boolean true if action succeeded
	 */
	public function put($path, $data)
	{
		$temp_file = tempnam(TMP_PATH, "$path");
		$fresult = file_put_contents($temp_file, $data);
		$result = $this->put_file($path, $temp_file);

		if ($fresult !== FALSE) {
			return $result;
		} else {
			throw new BackendException($this->parseErrorCodeToMessage(self::FTP_ERR_TMP), self::FTP_ERR_TMP);
		}
	}

	/**
	 * Upload a local file
	 *
	 * @param string $path Destination path on the server
	 * @param string $filename Local filename for the file that should be uploaded
	 *
	 * @throws BackendException if request is not successful
	 *
	 * @return boolean true if action succeeded
	 */
	public function put_file($path, $filename)
	{
		$dir = $this->appendBasePath($path);
		$time_start = microtime(true);
		$this->log("[PUTFILE] start for dir: $dir");

		if (@ftp_chdir($this->ftp_client, dirname($dir) . "/")) {
			$result = @ftp_put($this->ftp_client, rawurldecode(basename($dir)), $filename, FTP_BINARY);
		} else {
			$result = false;
		}
		$time_end = microtime(true);
		$time = $time_end - $time_start;

		if ($result) {
			$this->log("[PUTFILE] done in $time seconds: $filename -> $path");
			return true;
		} else {
			$err = error_get_last();
			$this->log('[PUTFILE] failed: ' . $err["message"]);
			throw new BackendException($err["message"], self::FTP_ERR_INTERNAL);
		}
	}

	/**
	 * Gets a file from a ftp collection.
	 *
	 * @param string $path The source path on the server
	 * @param mixed $buffer Buffer for the received data
	 *
	 * @throws BackendException if request is not successful
	 *
	 * @return boolean true if action succeeded
	 */
	public function get($path, &$buffer)
	{
		$temp_file = tempnam(TMP_PATH, stripslashes(base64_encode($path)));
		$result = $this->get_file($path, $temp_file);
		$buffer = file_get_contents($temp_file);
		unlink($temp_file);

		if ($result) {
			if ($buffer !== FALSE) {
				return $result;
			} else {
				throw new BackendException($this->parseErrorCodeToMessage(self::FTP_ERR_TMP), self::FTP_ERR_TMP);
			}
		} else {
			return $result;
		}
	}

	/**
	 * Gets a file from a collection into local filesystem.
	 *
	 * @param string $srcpath Source path on server
	 * @param string $localpath Destination path on local filesystem
	 *
	 * @throws BackendException if request is not successful
	 *
	 * @return boolean true if action succeeded
	 */
	public function get_file($srcpath, $localpath)
	{
		$dir = $this->appendBasePath($srcpath);
		$time_start = microtime(true);
		$this->log("[GETFILE] start for dir: $dir");

		$result = @ftp_get($this->ftp_client, $localpath, $dir, FTP_BINARY);
		$time_end = microtime(true);
		$time = $time_end - $time_start;

		if ($result) {
			$this->log("[GETFILE] done in $time seconds: $srcpath -> $localpath");
			return true;
		} else {
			$err = error_get_last();
			$this->log('[GETFILE] failed: ' . $err["message"]);
			throw new BackendException($err["message"], self::FTP_ERR_INTERNAL);
		}
	}

	/**
	 * Public method copy_file
	 *
	 * Copy a file on ftp server
	 * Duplicates a file on the ftp server (serverside).
	 * All work is done on the ftp server. If you set param overwrite as true,
	 * the target will be overwritten.
	 *
	 * @param string $src_path Source path
	 * @param string $dst_path Destination path
	 * @param bool $overwrite Overwrite if file exists in $dst_path
	 *
	 * @throws BackendException if request is not successful
	 *
	 * @return boolean true if action succeeded
	 */
	public function copy_file($src_path, $dst_path, $overwrite = false)
	{
		throw new BackendException($this->parseErrorCodeToMessage(self::FTP_ERR_UNIMPLEMENTED), self::FTP_ERR_UNIMPLEMENTED);
	}

	/**
	 * Public method copy_coll
	 *
	 * Copy a collection on ftp server
	 * Duplicates a collection on the ftp server (serverside).
	 * All work is done on the ftp server. If you set param overwrite as true,
	 * the target will be overwritten.
	 *
	 * @param string $src_path Source path
	 * @param string $dst_path Destination path
	 * @param bool $overwrite Overwrite if collection exists in $dst_path
	 *
	 * @throws BackendException if request is not successful
	 *
	 * @return boolean true if action succeeded
	 */
	public function copy_coll($src_path, $dst_path, $overwrite = false)
	{
		throw new BackendException($this->parseErrorCodeToMessage(self::FTP_ERR_UNIMPLEMENTED), self::FTP_ERR_UNIMPLEMENTED);
	}

	/**
	 * Get's path information from ftp server for one element
	 *
	 * @param string $path Path to file or folder
	 *
	 * @throws BackendException if request is not successful
	 *
	 * @return array directory info
	 */
	public function gpi($path)
	{
		$list = $this->ls($path, false);

		// be sure it is an array
		if (is_array($list)) {
			return $list[0];
		}

		$this->log('gpi: wrong response from ls');
		throw new BackendException($this->parseErrorCodeToMessage(self::FTP_ERR_INTERNAL), self::FTP_ERR_INTERNAL);
	}

	/**
	 * Get's server information
	 *
	 * @throws BackendException if request is not successful
	 * @return array with all header fields returned from ftp server.
	 */
	public function options()
	{
		throw new BackendException($this->parseErrorCodeToMessage(self::FTP_ERR_UNIMPLEMENTED), self::FTP_ERR_UNIMPLEMENTED);
	}

	/**
	 * Gather whether a path points to a file or not
	 *
	 * @param string $path Path to file or folder
	 *
	 * @return boolean true if path points to a file, false otherwise
	 */
	public function is_file($path)
	{
		$path = $this->appendBasePath($path);
		if (@ftp_size($this->ftp_client, rawurldecode($path)) == '-1') {
			return false; // Is directory
		} else {
			return true; // Is file
		}
	}

	/**
	 * Gather whether a path points to a directory
	 *
	 * @param string $path Path to file or folder
	 *
	 * @return boolean true if path points to a directory, false otherwise
	 */
	public function is_dir($path)
	{
		return !$this->is_file($path);
	}

	/**
	 * check if file/directory exists
	 *
	 * @param string $path Path to file or folder
	 *
	 * @return boolean true if path exists, false otherwise
	 */
	public function exists($path)
	{
		$path = $this->appendBasePath($path);
		$result = @ftp_nlist($this->ftp_client, $path); //Returns an array of filenames from the specified directory on success or FALSE on error.

		// Test if file is in the ftp_nlist array
		if ($result !== FALSE && in_array(basename($path), $result)) {
			return true;
		} else {
			return false;
		}
	}

	/**
	 * Copy a collection on ftp server
	 * Duplicates a collection on the ftp server (serverside).
	 * All work is done on the ftp server. If you set param overwrite as true,
	 * the target will be overwritten.
	 *
	 * @access private
	 *
	 * @param string $src_path Source path
	 * @param string $dst_path Destination path
	 * @param bool $overwrite Overwrite if collection exists in $dst_path
	 * @param bool $coll True if it is a collection
	 *
	 * @throws BackendException if request is not successful
	 *
	 * @return boolean true if action succeeded
	 */
	private function copy($src_path, $dst_path, $overwrite, $coll)
	{
		throw new BackendException($this->parseErrorCodeToMessage(self::FTP_ERR_UNIMPLEMENTED), self::FTP_ERR_UNIMPLEMENTED);
	}

	/**
	 * This function will return a user friendly error string.
	 *
	 * @param number $error_code A error code
	 *
	 * @return string userfriendly error message
	 */
	private function parseErrorCodeToMessage($error_code)
	{
		$error = intval($error_code);

		$msg = dgettext('plugin_files', 'Unknown error');

		switch ($error) {
			case self::FTP_ERR_UNAUTHORIZED:
				$msg = dgettext('plugin_files', 'Unauthorized. Wrong username or password.');
				break;
			case self::FTP_ERR_UNREACHABLE:
				$msg = dgettext('plugin_files', 'File-server is not reachable. Wrong IP entered?');
				break;
			case self::FTP_ERR_FORBIDDEN:
				$msg = dgettext('plugin_files', 'You don\'t have enough permissions for this operation.');
				break;
			case self::FTP_ERR_NOTFOUND:
				$msg = dgettext('plugin_files', 'File is not available any more.');
				break;
			case self::FTP_ERR_TIMEOUT:
				$msg = dgettext('plugin_files', 'Connection to server timed out. Retry later.');
				break;
			case self::FTP_ERR_LOCKED:
				$msg = dgettext('plugin_files', 'This file is locked by another user.');
				break;
			case self::FTP_ERR_FAILED_DEPENDENCY:
				$msg = dgettext('plugin_files', 'The request failed due to failure of a previous request.');
				break;
			case self::FTP_ERR_INTERNAL:
				$msg = dgettext('plugin_files', 'File-server encountered a problem. Wrong IP entered?');
				break; // this comes most likely from a wrong ip
			case self::FTP_ERR_TMP:
				$msg = dgettext('plugin_files', 'Could not write to temporary directory. Contact the server administrator.');
				break;
			case self::FTP_ERR_FEATURES:
				$msg = dgettext('plugin_files', 'Could not retrieve list of server features. Contact the server administrator.');
				break;
			case self::FTP_ERR_UNIMPLEMENTED:
				$msg = dgettext('plugin_files', 'Function is not implemented in this backend.');
				break;
		}

		return $msg;
	}

	public function getFormConfig()
	{
		$json = json_encode($this->metaConfig);

		if ($json === FALSE) {
			error_log(json_last_error());
		}

		return $json;
	}

	public function getFormConfigWithData()
	{
		return json_encode($this->metaConfig);
	}

	/**
	 * Removes the leading slash from the folder path
	 *
	 * @access private
	 *
	 * @param string $dir directory path
	 *
	 * @return string trimmed directory path
	 */
	private function removeSlash($dir)
	{
		if (strpos($dir, '/') === 0) {
			$dir = substr($dir, 1);
		}

		// remove all html entities and urlencode the path...
		$nohtml = html_entity_decode($dir);
		$dir = implode("/", array_map("rawurlencode", explode("/", $nohtml)));

		return $dir;
	}

	/**
	 * This function creates the real relative path.
	 *
	 * @param $path
	 * @return mixed
	 */
	private function appendBasePath($path) {
		$path = $this->removeSlash($path);

		// make sure that base path has leading and trailing slashes
		$bp = trim($this->path, "/");
		$bp = rtrim($bp, "/");
		$bp = "/" . $bp . "/";

		if($bp == "//") {
			$bp = "/";
		}

		return $bp . $path;
	}

	/**
	 * This function removes the base path from the path string.
	 *
	 * @param $path
	 * @return mixed
	 */
	private function removeBasePath($path) {
		// make sure that base path has leading and trailing slashes
		$bp = trim($this->path, "/");
		$bp = rtrim($bp, "/");
		$bp = "/" . $bp . "/";

		if($bp == "//") {
			$bp = "/";
		}

		return substr($path, strlen($bp) -1); // remove base path, except the trailing /
	}

	/**
	 * a simple php error_log wrapper.
	 *
	 * @access private
	 *
	 * @param string $err_string error message
	 *
	 * @return void
	 */
	private function log($err_string)
	{
		if ($this->debug) {
			error_log("[BACKEND_FTP]: " . $err_string);
		}
	}

	/**
	 * ============================ FEATURE FUNCTIONS ========================
	 */
	/**
	 * Open a readable stream to a remote file
	 *
	 * @param string $path
	 * @return resource a read only stream with the contents of the remote file or false on failure
	 */
	public function getStreamreader($path)
	{
		if ($this->ssl) {
			$ftpurl = "ftps://";
		} else {
			$ftpurl = "ftp://";
		}
		$ftpurl .= $this->user . ":" . $this->pass . "@" . $this->server . ":" . $this->port;

		// add path
		$ftpurl .= $this->appendBasePath($path);

		try {
			return fopen(rawurldecode($ftpurl) , 'r');
		} catch (\Exception $e) {
			$this->log("STREAMREADER failed: " . print_r($e, true));
			return false;
		}
	}

	/**
	 * Open a writable stream to a remote file
	 *
	 * @param string $path
	 * @return resource a write only stream to upload a remote file or false on failure
	 */
	public function getStreamwriter($path)
	{
		if ($this->ssl) {
			$ftpurl = "ftps://";
		} else {
			$ftpurl = "ftp://";
		}
		$ftpurl .= $this->user . ":" . $this->pass . "@" . $this->server . ":" . $this->port;

		// add path
		$ftpurl .= $this->appendBasePath($path);

		try {
			return fopen(rawurldecode($ftpurl) , 'w');
		} catch (\Exception $e) {
			$this->log("STREAMWRITER failed: " . print_r($e, true));
			return false;
		}
	}
}
