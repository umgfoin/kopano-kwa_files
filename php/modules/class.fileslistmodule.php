<?php
require_once __DIR__ . "/../Files/Core/class.accountstore.php";
require_once __DIR__ . "/../Files/Backend/class.backendstore.php";

require_once __DIR__ . "/../Files/Core/class.exception.php";
require_once __DIR__ . "/../Files/Backend/class.exception.php";

require_once __DIR__ . "/../Files/Core/Util/class.logger.php";
require_once __DIR__ . "/../Files/Core/Util/class.stringutil.php";

require_once __DIR__ . "/../lib/phpfastcache/src/autoload.php";

use \Files\Core\Util\Logger;
use \Files\Core\Util\StringUtil;
use phpFastCache\CacheManager;

use \Files\Core\Exception as AccountException;
use \Files\Backend\Exception as BackendException;

/**
 * This module handles all list and change requests for the files browser.
 *
 * @class FilesListModule
 * @extends ListModule
 */
class FilesListModule extends ListModule
{
	const LOG_CONTEXT = "FilesListModule"; // Context for the Logger

	/**
	 * @var \phpFastCache cache handler.
	 */
	public $cache;

	/**
	 * @var String User id of the currently logged in user. Used to generate unique cache id's.
	 */
	public $uid;

	/**
	 * @var {Object} The account store holding all available accounts
	 */
	public $accountStore;

	/**
	 * @var {Object} The backend store holding all available backends
	 */
	public $backendStore;

	/**
	 * @constructor
	 *
	 * @param $id
	 * @param $data
	 */
	public function __construct($id, $data)
	{
		parent::__construct($id, $data);

		// Initialize the account and backendstore
		$this->accountStore = new \Files\Core\AccountStore();
		$this->backendStore = \Files\Backend\BackendStore::getInstance();

		// Setup the cache
		$cacheSysPath = ( defined(PLUGIN_FILES_CACHE_DIR) ? PLUGIN_FILES_CACHE_DIR : '/var/lib/kopano-webapp/plugin_files' );
		if (!is_writable($cacheSysPath)) {
			Logger::error(self::LOG_CONTEXT, "Cache files directory failing back to /tmp, because " . $cacheSysPath . " is not writeable by the php process. Please adjust permissions. See KFP-161." );
			$cacheSysPath = sys_get_temp_dir();
		}

		CacheManager::setup(array(
			"storage" => "memcached",
			"memcache" => array(
				array('127.0.0.1', 11211, 1),
			),
			"path" => $cacheSysPath,
			"fallback" => "files", // fallback when memcached does not work
		));

		$this->cache = CacheManager::getInstance();

		if ($this->cache->fallback) {
			Logger::debug(self::LOG_CONTEXT, "[cache] memcached storage could not be loaded. Using files storage.");
			CacheManager::setup("storage", "files");
			$this->cache = CacheManager::getInstance();
		}

		// For backward compatibility we will check if the Encryption store exists. If not,
		// we will fall back to the old way of retrieving the password from the session.
		if ( class_exists('EncryptionStore') ) {
			// Get the username from the Encryption store
			$encryptionStore = \EncryptionStore::getInstance();
			$this->uid = $encryptionStore->get('username');
		} else {
			$this->uid = $_SESSION["username"];
		}

		Logger::debug(self::LOG_CONTEXT, "[constructor]: executing the module as uid: " . $this->uid);
	}

	/**
	 * Function get the folder data from backend.
	 *
	 * @return array return folders array.
	 */
	function getHierarchyList($isReload = false)
	{
		$data = array();
		$data["item"] = array();
		$accounts = $this->accountStore->getAllAccounts();
		foreach ($accounts as $account) {
			// we have to load all accounts and their folders
			// skip accounts that are not valid
			if ($account->getStatus() !== \Files\Core\Account::STATUS_OK) {
				continue;
			}

			// build the real node id for this folder
			$realNodeId = "#R#" . $account->getId() . "/";
			$accountName = $account->getName();
			$rootId = $this->createId($realNodeId);
			$nodes = array(
				"store_entryid" => $rootId,
				"props" => array(
					'entryid' => $rootId,
					'subtree_id' => $rootId,
					'display_name' => $accountName,
					"object_type" => FILES_STORE,
					"status" => $account->getStatus(),
					"status_description" => $account->getStatusDescription(),
					"backend" => $account->getBackend(),
					"backend_config" => $account->getBackendConfig(),
					'backend_features' => $account->getFeatures(),
					'filename' => $accountName,
					'account_sequence' => $account->getSequence(),
					'cannot_change' => $account->getCannotChangeFlag()
				)
			);

			$initializedBackend = $this->initializeBackend($account, true);
			$subFolders = $this->getSubFolders($realNodeId, $initializedBackend, $isReload);

			array_push($subFolders, array(
				'id' => $realNodeId,
				'folder_id' => $realNodeId,
				'entryid' => $rootId,
				'parent_entryid' => $rootId,
				'store_entryid' => $rootId,
				'props' => array(
					'path' => $realNodeId,
					'icon_index' => ICON_FOLDER,
					// Fixme : remove text property. we have to use display_name property.
					'text' => $accountName,
					'has_subfolder'=> empty($subFolders) === false,
					'object_type' => FILES_FOLDER,
					'filename' => $accountName,
					'display_name' => $accountName,
				)
			));

			// TODO: dummy folder which used client side to show the account view when user
			//  switch to home folder using navigation bar.
			array_push($subFolders, array(
				'id' => "#R#",
				'folder_id' => "#R#",
				'entryid' => "#R#",
				'parent_entryid' => $rootId,
				'store_entryid' => $rootId,
				'props' => array(
					'path' => $realNodeId,
					'icon_index' => ICON_HOME_FOLDER,
					'text' => "Files",
					'has_subfolder'=> false,
					'object_type' => FILES_FOLDER,
					'filename' => "Files",
					'display_name' => "Files",
				)
			));
			$nodes["folders"] = array( "item" => $subFolders);
			array_push($data["item"], $nodes);
		}

		return $data;
	}

	/**
	 * Function used to get the sub folders of the given folder id.
	 *
	 * @param String $nodeId
	 * @param Object $backend
	 * @param Boolean $isReload
	 * @param array $nodes
	 * @return array
	 */
	function getSubFolders($nodeId, $backend, $isReload = false, $nodes = array())
	{
		// relative node ID. We need to trim off the #R# and account ID
		$relNodeId = substr($nodeId, strpos($nodeId, '/'));
		$nodeIdPrefix = substr($nodeId, 0, strpos($nodeId, '/'));

		$accountID = $backend->getAccountID();

		// remove the trailing slash for the cache key
		$cachePath = rtrim($relNodeId, '/');
		if ($cachePath === "") {
			$cachePath = "/";
		}

		$dir = null;
		if ($isReload !== true) {
			$dir = $this->getCache($accountID, $cachePath);
		}
		if (is_null($dir)) {
			$dir = $backend->ls($relNodeId);
			$this->setCache($accountID, $cachePath, $dir);
		}

		if ($dir) {
			$updateCache = false;
			foreach ($dir as $id => $node) {
				$objectType = strcmp($node['resourcetype'], "collection") !== 0 ? FILES_FILE : FILES_FOLDER;

				// Only get the Folder item.
				if ($objectType !== FILES_FOLDER) {
					continue;
				}

				// Check if foldernames have a trailing slash, if not, add one!
				if (!StringUtil::endsWith($id, "/")) {
					$id .= "/";
				}

				$size = $node['getcontentlength'] === null ? -1 : intval($node['getcontentlength']);
				// folder's dont have a size
				$size = $objectType == FILES_FILE ? $size : -1;

				$realID = $nodeIdPrefix . $id;
				$filename = stringToUTF8Encode(basename($id));

				if (!isset($node['entryid']) || !isset($node['parent_entryid']) || !isset($node['store_entryid'])) {
					$entryid = $this->createId($realID);
					$parentEntryid = $this->createId($nodeId);
					$storeEntryid = $this->createId($nodeIdPrefix .'/');

					$dir[$id]['entryid'] = $entryid;
					$dir[$id]['parent_entryid'] = $parentEntryid;
					$dir[$id]['store_entryid'] = $storeEntryid;

					$updateCache = true;
				} else {
					$entryid = $node['entryid'];
					$parentEntryid = $node['parent_entryid'];
					$storeEntryid = $node['store_entryid'];
				}

				array_push($nodes, array(
					'id' => $realID,
					'folder_id' => $realID,
					'entryid' => $entryid,
					'parent_entryid' => $parentEntryid,
					'store_entryid' => $storeEntryid,
					'props' => array(
						'path' => $nodeId,
						'message_size' => $size,
						'text' => $filename,
						'object_type' => $objectType,
						'icon_index' => ICON_FOLDER,
						'filename' => $filename,
						'display_name' => $filename,
						'lastmodified' => strtotime($node['getlastmodified']) * 1000,
						'has_subfolder' => $this->hasSubFolder($id, $accountID, $backend)
					)
				));
				if ($objectType === FILES_FOLDER) {
					$nodes = $this->getSubFolders($realID, $backend, $isReload, $nodes);
				}
			}
			if ($updateCache) {
				$this->setCache($accountID, $cachePath, $dir);
			}
		}
		return $nodes;
	}

	/**
	 * Function create the unique id.
	 *
	 * @param {string} $id The folder id
	 * @return return generated a hash value
	 */
	function createId($id)
	{
		return hash("tiger192,3", $id);
	}

	/**
	 * Function will check that given folder has sub folder or not.
	 *
	 * @param {String} $id The $id is id of selected folder.
	 * @param $accountID
	 * @param $backend
	 * @return bool
	 */
	function hasSubFolder($id, $accountID, $backend)
	{
		$cachePath = rtrim($id, '/');
		if ($cachePath === "") {
			$cachePath = "/";
		}

		$dir = $this->getCache($accountID, $cachePath);
		if (is_null($dir)) {
			$dir = $backend->ls($id);
			$this->setCache($accountID, $cachePath, $dir);
		}

		if ($dir) {
			foreach ($dir as $id => $node) {
				if (strcmp($node['resourcetype'], "collection") === 0) {
					// we have a folder
					return true;
				}
			}
			return false;
		}
		return false;
	}

	/**
	 * @param $actionType
	 * @param $actionData
	 * @throws \Files\Backend\Exception
	 */
	function save($actionData)
	{
		$response = array();
		$props = $actionData["props"];
		$messageProps = array();
		if (isset($actionData["entryid"]) && empty($actionData["entryid"])) {
			$path = isset($props['path']) && !empty($props['path']) ? $props['path'] : "/";

			$relDirname = substr($path, strpos($path, '/'));
			$relDirname = $relDirname . $props["display_name"] .'/';
			$account = $this->accountFromNode($path);

			// initialize the backend
			$initializedBackend = $this->initializeBackend($account, true);
			$relDirname = stringToUTF8Encode($relDirname);
			$result = $initializedBackend->mkcol($relDirname); // create it !

			$filesPath = substr($path, strpos($path, '/'));
			$dir = $initializedBackend->ls($filesPath);

			$id = $path . $props["display_name"] . '/';

			$actionId = $account->getId();

			$entryid = $this->createId($id);
			$parentEntryid = $actionData["parent_entryid"];
			$storeEntryid = $this->createId('#R#' . $actionId . '/');

			$cachePath = rtrim($relDirname, '/');
			if ($cachePath === "") {
				$cachePath = "/";
			}

			if (isset($dir[$relDirname]) && !empty($dir[$relDirname])) {
				$newDir = $dir[$relDirname];
				$newDir['entryid'] = $entryid;
				$newDir['parent_entryid'] = $parentEntryid;
				$newDir['store_entryid'] = $storeEntryid;

				// Get old cached data.
				$cachedDir = $this->getCache($actionId, dirname($cachePath, 1));

				// Insert newly created folder infor with entryid, parentEntryid and storeEntryid
				// in already cached data.
				$cachedDir[$relDirname] = $newDir;
				$dir = $cachedDir;
			}

			// Delete old cache.
			$this->deleteCache($actionId, dirname($relDirname));

			// Set data in cache.
			$this->setCache($actionId, dirname($relDirname), $dir);

			if ($result) {
				$folder = array(
					'props' =>
						array(
							'path' => $path,
							'filename' => $props["display_name"],
							'display_name' => $props["display_name"],
							'text' => $props["display_name"],
							'object_type' => $props['object_type'],
							'has_subfolder' => false,
						),
					'id' => rawurldecode($id),
					'folder_id' => rawurldecode($id),
					'entryid' => $entryid,
					'parent_entryid' => $parentEntryid,
					'store_entryid' => $storeEntryid
				);
				$response = $folder;
			}
		} else {
			// Rename/update the folder/file name
			$folderId = $actionData['message_action']["source_folder_id"];
			// rename/update the folder or files name.
			$parentEntryid = $actionData["parent_entryid"];

			$isfolder = "";
			if (substr($folderId, -1) == '/') {
				$isfolder = "/"; // we have a folder...
			}

			$src = rtrim($folderId, '/');
			$dstdir = dirname($src) == "/" ? "" : dirname($src);
			$dst = $dstdir . "/" . rtrim($props['filename'], '/');

			$relDst = substr($dst, strpos($dst, '/'));
			$relSrc = substr($src, strpos($src, '/'));

			$account = $this->accountFromNode($src);

			// initialize the backend
			$initializedBackend = $this->initializeBackend($account);

			$result = $initializedBackend->move($relSrc, $relDst, false);

			// get the cache data of parent directory.
			$dir = $this->getCache($account->getId(), dirname($relSrc));
			if (isset($dir[$relSrc . "/"]) && !empty($dir[$relSrc . "/"])) {
				$srcDir = $dir[$relSrc . "/"];
				unset($dir[$relSrc . "/"]);
				$dir[$relDst . "/"] = $srcDir;

				// Update only rename folder info in php cache.
				$this->setCache($account->getId(), dirname($relSrc), $dir);

				$this->updateCacheAfterRename($relSrc, $relDst, $account->getId());
			} else {
				// clear the cache
				$this->deleteCache($account->getId(), dirname($relSrc));
			}

			if ($result) {
				/* create the response object */
				$folder = array();

				// some requests might not contain a new filename... so dont update the store
				if (isset($props['filename'])) {
					$folder = array(
						'props' =>
							array(
								'folder_id' => rawurldecode($dst . $isfolder),
								'path' => rawurldecode($dstdir),
								'filename' =>$props['filename'],
								'display_name' =>$props['filename']
							),
						'entryid' => $actionData["entryid"],
						'parent_entryid' => $parentEntryid,
						'store_entryid' => $actionData["store_entryid"]
					);
				}
				$response['item'] = $folder;
				$messageProps = $folder;
			}
		}

		$this->addActionData("update", $response);
		$GLOBALS["bus"]->addData($this->getResponseData());
		return $messageProps;
	}

	/**
	 * Update the cache of renamed folder and it's sub folders.
	 *
	 * @param {String} $oldPath The $oldPath is path of folder before rename.
	 * @param {String} $newPath The $newPath is path of folder after rename.
	 * @param {String} $accountId The id of an account in which renamed folder is belongs.
	 */
	function updateCacheAfterRename($oldPath, $newPath, $accountId)
	{
		// remove the trailing slash for the cache key
		$cachePath = rtrim($oldPath, '/');
		if ($cachePath === "") {
			$cachePath = "/";
		}

		$dir = $this->getCache($accountId, $cachePath);
		if ($dir) {
			foreach ($dir as $id => $node) {
				$newId = str_replace(dirname($id), $newPath, $id);
				unset($dir[$id]);
				$dir[$newId] = $node;

				$type = FILES_FILE;

				if (strcmp($node['resourcetype'], "collection") == 0) { // we have a folder
					$type = FILES_FOLDER;
				}

				if ($type === FILES_FOLDER) {
					$this->updateCacheAfterRename($id,  rtrim($newId, '/'), $accountId);
				}
			}
			$this->deleteCache($accountId, $cachePath);
			$this->setCache($accountId, $newPath, $dir);
		}
	}

	/**
	 * Function used to notify the sub folder of selected/modified folder.
	 *
	 * @param {String} $folderID The $folderID of a folder which is modified.
	 */
	function notifySubFolders($folderID)
	{
		$account = $this->accountFromNode($folderID);
		$initializedBackend = $this->initializeBackend($account, true);
		$folderData = $this->getSubFolders($folderID, $initializedBackend);
		if (!empty($folderData)) {
			$GLOBALS["bus"]->notify(REQUEST_ENTRYID, OBJECT_SAVE, $folderData);
		}
	}

	/**
	 * Get the account id from a node id.
	 * @param {String} $nodeID Id of the file or folder to operate on
	 * @return {String} The account id extracted from $nodeId
	 */
	function accountIDFromNode($nodeID)
	{
		return substr($nodeID, 3, (strpos($nodeID, '/') - 3)); // parse account id from node id
	}

	/**
	 * Get the account from a node id.
	 * @param {String} $nodeId ID of the file or folder to operate on
	 * @return {String} The account for $nodeId
	 */
	function accountFromNode($nodeID)
	{
		return $this->accountStore->getAccount($this->accountIDFromNode($nodeID));
	}

	/**
	 * Create a key used to store data in the cache.
	 * @param {String} $accountID Id of the account of the data to cache
	 * @param {String} $path Path of the file or folder to create the cache element for
	 * @return {String} The created key
	 */
	function makeCacheKey($accountID, $path)
	{
		return $this->uid . md5($accountID . $path);
	}

	/**
	 * Initialize the backend for the given account.
	 * @param {Object} $account The account object the backend should be initilized for
	 * @param {Bool} $setID Should the accountID be set in the backend object, or not. Defaults to false.
	 * @return {Object} The initialized backend
	 */
	function initializeBackend($account, $setID = false)
	{
		$backend = $this->backendStore->getInstanceOfBackend($account->getBackend());
		$backend->init_backend($account->getBackendConfig());
		if($setID) {
			$backend->setAccountID($account->getId());
		}
		$backend->open();
		return $backend;
	}

	/**
	 * Save directory data in the cache.
	 * @param {String} $accountID Id of the account of the data to cache
	 * @param {String} $path Path of the file or folder to create the cache element for
	 * @param {String} $data Data to be cached
	 */
	function setCache($accountID, $path, $data)
	{
		$key = $this->makeCacheKey($accountID, $path);
		Logger::debug(self::LOG_CONTEXT, "Setting cache for node: " . $accountID . $path . " ## " . $key);
		$this->cache->set($key, $data);
	}

	/**
	 * Get directotry data form the cache.
	 * @param {String} $accountID Id of the account of the data to get
	 * @param {String} $path Path of the file or folder to retrieve the cache element for
	 * @return {String} The diretory data or null if nothing was found
	 */
	function getCache($accountID, $path)
	{
		$key = $this->makeCacheKey($accountID, $path);
		Logger::debug(self::LOG_CONTEXT, "Getting cache for node: " . $accountID . $path . " ## " . $key);
		return $this->cache->get($key);
	}

	/**
	 * Remove data from the cache.
	 * @param {String} $accountID Id of the account to delete the cache for
	 * @param {String} $path Path of the file or folder to delete the cache element
	 */
	function deleteCache($accountID, $path)
	{
		$key = $this->makeCacheKey($accountID, $path);
		Logger::debug(self::LOG_CONTEXT, "Removing cache for node: " . $accountID .  $path . " ## " . $key);
		$this->cache->delete($key);
	}

	/**
	 * Function which returns MAPI Message Store Object. It
	 * searches in the variable $action for a storeid.
	 * @param array $action the XML data retrieved from the client
	 * @return object MAPI Message Store Object, false if storeid is not found in the $action variable
	 */
	function getActionStore($action)
	{
		$store = false;

		if(isset($action["store_entryid"]) && !empty($action["store_entryid"])) {
			if(is_array($action["store_entryid"])) {
				$store = array();
				foreach($action["store_entryid"] as $store_id) {
					array_push($store, $store_id);
				}
			} else {
				$store = $action["store_entryid"];
			}
		}

		return $store;
	}
}