<?php
require_once __DIR__ . "/Files/Core/class.exception.php";
require_once __DIR__ . "/Files/Backend/class.exception.php";

require_once __DIR__ . "/Files/Core/class.accountstore.php";
require_once __DIR__ . "/Files/Backend/class.backendstore.php";

require_once __DIR__ . "/Files/Core/Util/class.arrayutil.php";
require_once __DIR__ . "/Files/Core/Util/class.logger.php";
require_once __DIR__ . "/Files/Core/Util/class.stringutil.php";
require_once __DIR__ . "/Files/Core/Util/class.pathutil.php";

require_once __DIR__ . "/lib/phpfastcache/src/autoload.php";

use \Files\Core\Util\ArrayUtil;
use \Files\Core\Util\Logger;
use \Files\Core\Util\StringUtil;
use \Files\Core\Util\PathUtil;

use \Files\Core\Exception as AccountException;
use \Files\Backend\Exception as BackendException;

use phpFastCache\CacheManager;

/**
 * This module handles all list and change requests for the files browser.
 *
 * @class FilesBrowserModule
 * @extends ListModule
 */
class FilesBrowserModule extends ListModule
{
	const LOG_CONTEXT = "FilesBrowserModule"; // Context for the Logger

	/**
	 * @var \phpFastCache cache handler.
	 */
	private $cache;

	/**
	 * @var String User id of the currently logged in user. Used to generate unique cache id's.
	 */
	private $uid;

	/**
	 * @constructor
	 *
	 * @param $id
	 * @param $data
	 */
	public function __construct($id, $data)
	{
		parent::__construct($id, $data);

		// Setup the cache
		$cacheSysPath = ( defined(PLUGIN_FILES_CACHE_DIR) ? PLUGIN_FILES_CACHE_DIR : '/var/lib/kopano-webapp/plugin_files' );
		if (!is_writable($cacheSysPath)) {
			Logger::error(self::LOG_CONTEXT, "Cache files directory failing back to /tmp, because " . $cacheSysPath . " is not writeable by the php process. Please adjust permissions. See KFP-161." );
			$cacheSysPath = sys_get_temp_dir();
		}
		$config = array(
			"storage" => "memcached",
			"memcache" => array(
				array('127.0.0.1', 11211, 1),
			),
			"path" => $cacheSysPath,
			"fallback" => "files", // fallback when memcached does not work
		);
		CacheManager::setup($config);
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
	 * Executes all the actions in the $data variable.
	 * Exception part is used for authentication errors also
	 * @return boolean true on success or false on failure.
	 */
	public function execute()
	{
		$result = false;

		foreach ($this->data as $actionType => $actionData) {
			if (isset($actionType)) {
				try {
					switch ($actionType) {
						case "getfilestree":
							$result = $this->loadFilesTree($actionType, $actionData);
							break;
						case "checkifexists":
							$result = $this->checkIfExists($actionType, $actionData);
							break;
						case "downloadtotmp":
							$result = $this->downloadSelectedFilesToTmp($actionType, $actionData);
							break;
						case "createdir":
							$result = $this->createDirectory($actionType, $actionData);
							break;
						case "rename":
							$result = $this->rename($actionType, $actionData);
							break;
						case "uploadtobackend":
							$result = $this->uploadToBackend($actionType, $actionData);
							break;
						case "save":
							if ((isset($actionData["props"]["sharedid"]) || isset($actionData["props"]["isshared"])) && (!isset($actionData["props"]["deleted"]) || !isset($actionData["props"]["message_size"]))) {
								// JUST IGNORE THIS REQUEST - we don't need to interact with the backend if a share was changed
								$response['status'] = true;
								$folder = array();
								$folder[$actionData['entryid']] = array(
									'props' => $actionData["props"],
									'entryid' => $actionData['entryid'],
									'store_entryid' => 'files',
									'parent_entryid' => $actionData['parent_entryid']
								);

								$response['item'] = array_values($folder);
								$this->addActionData("update", $response);
								$GLOBALS["bus"]->addData($this->getResponseData());

								continue;
							}

							/*
							 * The "message_action" object has been set, check the action_type field for
							 * the exact action which must be taken.
							 * Supported actions:
							 *   - move: move record to new folder
							 */
							if (isset($actionData["message_action"]) && isset($actionData["message_action"]["action_type"])) {
								switch ($actionData["message_action"]["action_type"]) {
									case "move" :
										$result = $this->move($actionType, $actionData);
										break;
									default:
										// check if we should create something new or edit an existing file/folder
										if (isset($actionData["entryid"])) {
											$result = $this->rename($actionType, $actionData);
										} else {
											$result = $this->createDirectory($actionType, $actionData);
										}
										break;
								}
							} else {
								// check if we should create something new or edit an existing file/folder
								if (isset($actionData["entryid"])) {
									$result = $this->rename($actionType, $actionData);
								} else {
									$result = $this->createDirectory($actionType, $actionData);
								}
							}
							break;
						case "delete":
							$result = $this->delete($actionType, $actionData);
							break;
						case "list":
							$result = $this->loadFiles($actionType, $actionData);
							break;
						case "loadsharingdetails":
							$result = $this->getSharingInformation($actionType, $actionData);
							break;
						case "createnewshare":
							$result = $this->createNewShare($actionType, $actionData);
							break;
						case "updateexistingshare":
							$result = $this->updateExistingShare($actionType, $actionData);
							break;
						case "deleteexistingshare":
							$result = $this->deleteExistingShare($actionType, $actionData);
							break;
						default:
							$this->handleUnknownActionType($actionType);
					}

				} catch (MAPIException $e) {
					$this->sendFeedback(false, $this->errorDetailsFromException($e));
				} catch (AccountException $e) {
					$this->sendFeedback(false, array(
						'type' => ERROR_GENERAL,
						'info' => array(
							'original_message' => $e->getMessage(),
							'display_message' => $e->getMessage()
						)
					));
				} catch (BackendException $e) {
					$this->sendFeedback(false, array(
						'type' => ERROR_GENERAL,
						'info' => array(
							'original_message' => $e->getMessage(),
							'display_message' => $e->getMessage(),
							'code' => $e->getCode()
						)
					));
				}
			}
		}

		return $result;
	}

	/**
	 * loads content of current folder - list of folders and files from Files
	 *
	 * @param string $actionType name of the current action
	 * @param array $actionData all parameters contained in this request
	 * @throws BackendException if the backend request fails
	 *
	 * @return bool
	 */
	public function loadFiles($actionType, $actionData)
	{
		$nodeId = $actionData['id'];
		$reload = $actionData['reload'];
		$response = array();
		$nodes = array();

		$accountID = substr($nodeId, 3, (strpos($nodeId, '/') - 3)); // parse account id from node id

		// Initialize the account and backendstore
		$accountStore = new \Files\Core\AccountStore();
		$backendStore = \Files\Backend\BackendStore::getInstance();

		// check if we are in the ROOT (#R#). If so, display some kind of device/account view.
		if (empty($accountID) || !$accountStore->getAccount($accountID)) {
			$accounts = $accountStore->getAllAccounts();
			foreach ($accounts as $account) { // we have to load all accounts and their folders
				// skip accounts that are not valid
				if ($account->getStatus() != \Files\Core\Account::STATUS_OK) {
					continue;
				}

				$realNodeId = $nodeId . $account->getId() . "/"; // build the real node id for this folder

				$nodes[$realNodeId] = array('props' =>
					array(
						'id' => rawurldecode($realNodeId),
						'path' => "/",
						'filename' => $account->getName(),
						'message_size' => -1,
						'lastmodified' => -1,
						'message_class' => "IPM.Files",
						'type' => 0
					),
					'entryid' => rawurldecode($realNodeId),
					'store_entryid' => 'files',
					'parent_entryid' => dirname($realNodeId) . "/"
				);
			}
		} else {
			$account = $accountStore->getAccount($accountID);

			// initialize the backend
			$initializedBackend = $backendStore->getInstanceOfBackend($account->getBackend());
			$initializedBackend->init_backend($account->getBackendConfig());
			$initializedBackend->setAccountID($account->getId());

			$starttime = microtime(true);
			$nodes = $this->getFolderContent($nodeId, $initializedBackend, true, false, $reload);
			Logger::debug(self::LOG_CONTEXT, "[loadfiles]: getFolderContent took: " . (microtime(true) - $starttime) . " seconds");

			$nodes = $this->sortFolderContent($nodes, $actionData, false);
		}

		$response["item"] = array_values($nodes);


		$response['page'] = array("start" => 0, "rowcount" => 50, "totalrowcount" => count($response["item"]));
		$response['folder'] = array("content_count" => count($response["item"]), "content_unread" => 0);

		$this->addActionData($actionType, $response);
		$GLOBALS["bus"]->addData($this->getResponseData());

		return true;
	}

	/**
	 * Loads all folders and files needed to display the filetree.
	 *
	 * Tree will have a structure like this:
	 *
	 *                 #R#
	 *                  |
	 *          ---------------------
	 *         /        |            \
	 *       HASH1     HASH2         HASH3          HASH = Account ID
	 *         |        |              |
	 *      Files      Files         Files          and folders
	 *
	 * @param {String} $actionType
	 * @param {Array} $actionData
	 */
	public function loadFilesTree($actionType, $actionData)
	{
		$response = array();
		$nodeId = $actionData['id'];
		$reload = isset($actionData['reload']) ? $actionData['reload'] : false;
		$loadFiles = isset($actionData['loadfiles']) ? $actionData['loadfiles'] : false;
		$accountFilter = $actionData['accountFilter'];

		// Initialize the account and backendstore
		$accountStore = new \Files\Core\AccountStore();
		$backendStore = \Files\Backend\BackendStore::getInstance();

		$nodes = array();
		if (!isset($nodeId) || $nodeId === "#R#") { // we have to load the root node
			$accounts = $accountStore->getAllAccounts();

			foreach ($accounts as $account) { // we have to load all accounts and their folders
				// skip accounts that are not valid
				if ($account->getStatus() != \Files\Core\Account::STATUS_OK) {
					continue;
				}

				// skip accounts that are not listed in the filter
				if (!empty($accountFilter)) {
					if (!is_array($accountFilter) && $account->getId() != $accountFilter) {
						continue;
					} else {
						if (is_array($accountFilter)) {
							if (!in_array($account->getId(), $accountFilter)) {
								continue;
							}
						}
					}
				}

				$realNodeId = $nodeId . $account->getId() . "/"; // build the real node id for this folder

				$nodes[$realNodeId] = array(
					'id' => $realNodeId,
					'path' => "/",
					'text' => $account->getName(),
					'expanded' => false, // TODO: should we autoload the account root?
					'isFolder' => true, // needed to set class correctly
					'iconCls' => "icon_16_" . $account->getBackend(),
					'filename' => $account->getName(),
					'account_sequence' => $account->getSequence()
				);

				// sort by account_sequence
				$filter = array(
					"sort" => array(
						array(
							"field" => "account_sequence",
							"direction" => "ASC"
						)
					)
				);
				$nodes = $this->sortFolderContent($nodes, $filter, true);
			}
		} else { // load subfolder of store
			$accountID = substr($nodeId, 3, (strpos($nodeId, '/') - 3)); // parse account id from node id
			$account = $accountStore->getAccount($accountID);

			// initialize the backend
			$initializedBackend = $backendStore->getInstanceOfBackend($account->getBackend());
			$initializedBackend->init_backend($account->getBackendConfig());
			$initializedBackend->setAccountID($account->getId());

			Logger::debug(self::LOG_CONTEXT, "Loading nodes for acc: " . $account->getId() . " (" . $account->getName() . ")");

			$starttime = microtime(true);
			$nodes = $this->getFolderContent($nodeId, $initializedBackend, $loadFiles, true, $reload);
			Logger::debug(self::LOG_CONTEXT, "[loadFilesTree]: getFolderContent took: " . (microtime(true) - $starttime) . " seconds");
		}

		$response["items"] = array_values($nodes);
		$response['status'] = true;

		$this->addActionData($actionType, $response);
		$GLOBALS["bus"]->addData($this->getResponseData());

		return true;
	}

	/**
	 * Forms the structure needed for frontend
	 * for the list of folders and files
	 *
	 * @param string $nodeId the name of the current root directory
	 * @param Files\Backend\AbstractBackend $backendInstance
	 * @param boolean $loadFiles if true, files will be loaded also
	 * @param boolean $navtree parse for navtree or browser
	 * @param boolean $reload if this is true, the cache will be reloaded
	 *
	 * @throws BackendException if the backend request fails
	 * @return array of nodes for current path folder
	 */
	public function getFolderContent($nodeId, $backendInstance, $loadFiles = false, $navtree = false, $reload = false)
	{
		$nodes = array();

		// relative node ID. We need to trim off the #R# and account ID
		$relNodeId = substr($nodeId, strpos($nodeId, '/'));
		$nodeIdPrefix = substr($nodeId, 0, strpos($nodeId, '/'));

		$backendInstance->open();
		$accountID = $backendInstance->getAccountID();

		// remove the trailing slash for the cache key
		$cachePath = rtrim($relNodeId, '/');
		if ($cachePath === "") {
			$cachePath = "/";
		}

		$key = $this->uid . md5($accountID . $cachePath);
		$dir = $this->cache->get($key);

		if (is_null($dir) || $reload) {
			Logger::debug(self::LOG_CONTEXT, "Uncached query! Loading: " . $accountID . $cachePath . " -- " . ($reload ? "y": "n"));
			$dir = $backendInstance->ls($relNodeId);
			$this->cache->set($key, $dir);
		} else {
			Logger::debug(self::LOG_CONTEXT, "Cached query! Loading: " . $accountID . $cachePath . " ## " . $key );
		}

		// check if backend supports sharing and load the information
		if ($backendInstance->supports(\Files\Backend\BackendStore::FEATURE_SHARING) && !$navtree) {
			Logger::debug(self::LOG_CONTEXT, "Checking for shared folders! ($relNodeId)");

			$time_start = microtime(true);
			/** @var \Files\Backend\iFeatureSharing $backendInstance */
			$sharingInfo = $backendInstance->getShares($relNodeId);
			$time_end = microtime(true);
			$time = $time_end - $time_start;

			Logger::debug(self::LOG_CONTEXT, "Checking for shared took $time s!");
		}

		if ($dir) {
			foreach ($dir as $id => $node) {
				$type = 1;

				if (strcmp($node['resourcetype'], "collection") == 0) { // we have a folder
					$type = 0;
				}

				// Check if foldernames have a trailing slash, if not, add one!
				if ($type == 0 && !StringUtil::endsWith($id, "/")) {
					$id .= "/";
				}

				$realID = $nodeIdPrefix . $id;

				Logger::debug(self::LOG_CONTEXT, "parsing: " . $id . " in base: " . $nodeId);

				$filename = stringToUTF8Encode(basename($id));
				if ($navtree) {
					if ($type == 0) { // we have a folder
						$nodes[$realID] = array(
							'id' => $realID,
							'path' => stringToUTF8Encode(dirname($id)),
							'text' => $filename,
							'expanded' => false,
							'isFolder' => true, // needed to set class correctly
							'iconCls' => 'icon_folder_note',
							'filename' => $filename,
							'allowChildren' => true,
							'leaf' => false
						);
					} else {
						if ($loadFiles) { // skip files if $loadFiles == false
							$nodes[$realID] = array(
								'id' => $realID,
								'path' => stringToUTF8Encode(dirname($id)),
								'text' => $filename . '(' . StringUtil::human_filesize(intval($node['getcontentlength'])) . ')',
								'filesize' => intval($node['getcontentlength']),
								'isFolder' => false,
								'filename' => $filename,
								'expanded' => true,
								'loaded' => true, // prevent treepanel from making another request
								'has_children' => false,
								'checked' => false
							);
						}
					}
				} else {
					$size = $node['getcontentlength'] === null ? -1 : intval($node['getcontentlength']);
					$size = $type == 0 ? -1 : $size; // folder's dont have a size

					$shared = false;
					$sharedid = array();
					if (isset($sharingInfo) && count($sharingInfo[$relNodeId]) > 0) {
						foreach ($sharingInfo[$relNodeId] as $sid => $sdetails) {
							if ($sdetails["path"] == rtrim($id, "/")) {
								$shared = true;
								$sharedid[] = $sid;
							}
						}
					}
					$nodeId = stringToUTF8Encode($id);

					$nodes[$nodeId] = array('props' =>
						array(
							'id' => stringToUTF8Encode($realID),
							'path' => dirname(stringToUTF8Encode($id)),
							'filename' => $filename,
							'message_size' => $size,
							'lastmodified' => strtotime($node['getlastmodified']) * 1000,
							'message_class' => "IPM.Files",
							'isshared' => $shared,
							'sharedid' => $sharedid,
							'type' => $type
						),
						'entryid' => stringToUTF8Encode($realID),
						'store_entryid' => 'files',
						'parent_entryid' => dirname(stringToUTF8Encode($realID)) . "/"
					);
				}
			}
		} else {
			Logger::debug(self::LOG_CONTEXT, "dir was empty");
		}

		return $nodes;
	}

	/**
	 * This functions sorts an array of nodes.
	 *
	 * @param array $nodes array of nodes to sort
	 * @param array $data all parameters contained in the request
	 * @param boolean $navtree parse for navtree or browser
	 *
	 * @return array of sorted nodes
	 */
	public function sortFolderContent($nodes, $data, $navtree = false)
	{
		$sortednodes = array();

		$sortkey = "filename";
		$sortdir = "ASC";

		if (isset($data['sort'])) {
			$sortkey = $data['sort'][0]['field'];
			$sortdir = $data['sort'][0]['direction'];
		}

		Logger::debug(self::LOG_CONTEXT, "sorting by " . $sortkey . " in direction: " . $sortdir);

		if ($navtree) {
			$sortednodes = ArrayUtil::sort_by_key($nodes, $sortkey, $sortdir);
		} else {
			$sortednodes = ArrayUtil::sort_props_by_key($nodes, $sortkey, $sortdir);
		}

		return $sortednodes;
	}

	/**
	 * Deletes the selected files on the backend server
	 *
	 * @access private
	 * @param string $actionType name of the current action
	 * @param array $actionData all parameters contained in this request
	 * @return bool
	 * @throws BackendException if the backend request fails
	 */
	private function delete($actionType, $actionData)
	{
		// Initialize the account and backendstore
		$accountStore = new \Files\Core\AccountStore();
		$backendStore = \Files\Backend\BackendStore::getInstance();

		if (isset($actionData['records']) && is_array($actionData['records'])) {
			foreach ($actionData['records'] as $record) {
				$nodeId = $record['id'];
				$relNodeId = substr($nodeId, strpos($nodeId, '/'));

				$accountID = substr($nodeId, 3, (strpos($nodeId, '/') - 3)); // parse account id from node id
				$account = $accountStore->getAccount($accountID);

				// initialize the backend
				$initializedBackend = $backendStore->getInstanceOfBackend($account->getBackend());
				$initializedBackend->init_backend($account->getBackendConfig());

				$initializedBackend->open();
				$result = $initializedBackend->delete($relNodeId);
				Logger::debug(self::LOG_CONTEXT, "deleted: " . $nodeId . ", worked: " . $result);

				// clear the cache
				$this->cache->delete(md5($this->uid . $accountID . dirname($relNodeId)));
				Logger::debug(self::LOG_CONTEXT, "cache cleared for : " . $accountID . dirname($relNodeId) . " ## " . md5($accountID . dirname($relNodeId)));
			}

			$response['status'] = true;
			$this->addActionData($actionType, $response);
			$GLOBALS["bus"]->addData($this->getResponseData());

		} else {
			$nodeId = $actionData['entryid'];
			$relNodeId = substr($nodeId, strpos($nodeId, '/'));
			$response = array();

			$accountID = substr($nodeId, 3, (strpos($nodeId, '/') - 3)); // parse account id from node id
			$account = $accountStore->getAccount($accountID);

			// initialize the backend
			$initializedBackend = $backendStore->getInstanceOfBackend($account->getBackend());
			$initializedBackend->init_backend($account->getBackendConfig());

			$initializedBackend->open();
			try {
				$result = $initializedBackend->delete($relNodeId);
			} catch (\Files\Backend\Exception $e) {
				// TODO: this might fails because the file was already deleted.
				// fire error message if any other error occured.
				Logger::debug(self::LOG_CONTEXT, "deleted a directory that was no longer available");
			}
			Logger::debug(self::LOG_CONTEXT, "deleted: " . $nodeId . ", worked: " . $result);

			// clear the cache
			$this->cache->delete(md5($this->uid . $accountID . dirname($relNodeId)));
			Logger::debug(self::LOG_CONTEXT, "cache cleared for : " . $accountID . dirname($relNodeId) . " ## " . md5($accountID . dirname($relNodeId)));


			$response['status'] = $result ? true : false;
			$this->addActionData($actionType, $response);
			$GLOBALS["bus"]->addData($this->getResponseData());
		}

		return true;
	}

	/**
	 * Moves the selected files on the backend server
	 *
	 * @access private
	 * @param string $actionType name of the current action
	 * @param array $actionData all parameters contained in this request
	 * @return bool if the backend request failed
	 *
	 */
	private function move($actionType, $actionData)
	{
		$dst = rtrim($actionData['message_action']["destination_parent_entryid"], '/');
		$overwrite = true;

		$overall_status = true;
		$message = "";
		$errorids = array();
		$isfolder = "";

		if (substr($actionData['entryid'], -1) == '/') {
			$isfolder = "/"; // we have a folder...
		}

		$source = rtrim($actionData['entryid'], '/');
		$destination = $dst . '/' . basename($source);

		// get dst and source account ids
		// currently only moving within one account is supported
		$srcAccountID = substr($actionData['entryid'], 3, (strpos($actionData['entryid'], '/') - 3)); // parse account id from node id
		$dstAccountID = substr($actionData['message_action']["destination_parent_entryid"], 3, (strpos($actionData['message_action']["destination_parent_entryid"], '/') - 3)); // parse account id from node id

		if ($srcAccountID != $dstAccountID) {
			$this->sendFeedback(false, array(
				'type' => ERROR_GENERAL,
				'info' => array(
					'original_message' => "Moving between accounts is not implemented",
					'display_message' => "Moving between accounts is not implemented"
				)
			));

			return false;
		} else {
			$relDst = substr($destination, strpos($destination, '/'));
			$relSrc = substr($source, strpos($source, '/'));

			// Initialize the account and backendstore
			$accountStore = new \Files\Core\AccountStore();
			$backendStore = \Files\Backend\BackendStore::getInstance();

			$accountID = substr($source, 3, (strpos($source, '/') - 3)); // parse account id from node id
			$account = $accountStore->getAccount($accountID);

			// initialize the backend
			$initializedBackend = $backendStore->getInstanceOfBackend($account->getBackend());
			$initializedBackend->init_backend($account->getBackendConfig());

			$initializedBackend->open();
			$result = $initializedBackend->move($relSrc, $relDst, $overwrite);

			// clear the cache
			$this->cache->delete(md5($this->uid . $accountID . dirname($relDst)));
			Logger::debug(self::LOG_CONTEXT, "cache cleared for : " . $accountID . dirname($relDst) . " ## " . md5($accountID . dirname($relDst)));
			$this->cache->delete(md5($this->uid . $accountID . dirname($relSrc)));
			Logger::debug(self::LOG_CONTEXT, "cache cleared for : " . $accountID . dirname($relSrc) . " ## " . md5($accountID . dirname($relSrc)));

			if (!$result) {
				$message = "Moving item " . $actionData['entryid'] . " to " . $destination . " failed! (" . $result . ")";
			}

			$response['status'] = !$result ? false : true;

			/* create the response object */
			$folder = array();
			$folder[$actionData['entryid']] = array(
				'props' =>
					array(
						'id' => ($destination . $isfolder),
						'path' => $actionData['message_action']["destination_parent_entryid"],
						'deleted' => !$result ? false : true
					),
				'entryid' => $actionData['entryid'],
				'store_entryid' => 'files',
				'parent_entryid' => $actionData['parent_entryid']
			);

			$response['item'] = array_values($folder);
			$this->addActionData("update", $response);
			$GLOBALS["bus"]->addData($this->getResponseData());
		}

		return true;
	}

	/**
	 * Renames the selected file on the backend server
	 *
	 * @access private
	 * @param string $actionType name of the current action
	 * @param array $actionData all parameters contained in this request
	 * @return bool
	 * @throws BackendException if the backend request fails
	 */
	private function rename($actionType, $actionData)
	{
		$isfolder = "";
		if (substr($actionData['entryid'], -1) == '/') {
			$isfolder = "/"; // we have a folder...
		}

		$src = rtrim($actionData['entryid'], '/');
		$dstdir = dirname($src) == "/" ? "" : dirname($src);
		$dst = $dstdir . "/" . rtrim($actionData['props']['filename'], '/');

		$relDst = substr($dst, strpos($dst, '/'));
		$relSrc = substr($src, strpos($src, '/'));

		$virtualRecord = isset($actionData['props']["virtualRecord"]) ? $actionData['props']["virtualRecord"] : false;

		// only add the folder if the virtualRecord flag is false!
		if (!$virtualRecord) {
			// Initialize the account and backendstore
			$accountStore = new \Files\Core\AccountStore();
			$backendStore = \Files\Backend\BackendStore::getInstance();

			$accountID = substr($src, 3, (strpos($src, '/') - 3)); // parse account id from node id
			$account = $accountStore->getAccount($accountID);

			// initialize the backend
			$initializedBackend = $backendStore->getInstanceOfBackend($account->getBackend());
			$initializedBackend->init_backend($account->getBackendConfig());

			$initializedBackend->open();
			$result = $initializedBackend->move($relSrc, $relDst, false);

			// clear the cache
			$this->cache->delete(md5($this->uid . $accountID . dirname($relSrc)));
			Logger::debug(self::LOG_CONTEXT, "cache cleared for : " . $accountID . dirname($relSrc) . " ## " . md5($accountID . dirname($relSrc)));
		} else {
			$result = true;
		}
		if ($result) {
			/* create the response object */
			$folder = array();

			// some requests might not contain a new filename... so dont update the store
			if (isset($actionData['props']['filename'])) {
				$folder[dirname($src)] = array(
					'props' =>
						array(
							'id' => rawurldecode($dst . $isfolder),
							'path' => dirname(rawurldecode($relSrc)),
							'filename' => $actionData['props']['filename']
						),
					'entryid' => rawurldecode($dst . $isfolder),
					'store_entryid' => 'files',
					'virtual' => $virtualRecord, // just for debugging
					'parent_entryid' => dirname(dirname($src))
				);
			}
			$response['item'] = array_values($folder);

			$this->addActionData($actionType == "save" ? "update" : $actionType, $response);
			$GLOBALS["bus"]->addData($this->getResponseData());

			return true;
		}

		return false;
	}

	/**
	 * Creates a new directory.
	 *
	 * @access private
	 * @param string $actionType name of the current action
	 * @param array $actionData all parameters contained in this request
	 * @throws BackendException if the backend request fails
	 *
	 */
	private function createDirectory($actionType, $actionData)
	{
		$actionData = $actionData["props"];
		$dirname = $actionData["id"];
		$virtualRecord = isset($actionData["virtualRecord"]) ? $actionData["virtualRecord"] : false;

		// only add the folder if the virtualRecord flag is false!
		$relDirname = substr($dirname, strpos($dirname, '/'));
		if (!$virtualRecord) {
			// Initialize the account and backendstore
			$accountStore = new \Files\Core\AccountStore();
			$backendStore = \Files\Backend\BackendStore::getInstance();

			$accountID = substr($dirname, 3, (strpos($dirname, '/') - 3)); // parse account id from node id
			$account = $accountStore->getAccount($accountID);

			// initialize the backend
			$initializedBackend = $backendStore->getInstanceOfBackend($account->getBackend());
			$initializedBackend->init_backend($account->getBackendConfig());

			$initializedBackend->open();
			$relDirname = stringToUTF8Encode($relDirname);
			$result = $initializedBackend->mkcol($relDirname); // create it !

			// clear the cache
			$this->cache->delete(md5($this->uid . $accountID . dirname($relDirname)));
			Logger::debug(self::LOG_CONTEXT, "cache cleared for : " . $accountID . dirname($relDirname) . " ## " . md5($accountID . dirname($relDirname)));
		} else {
			$result = true;
		}

		$parentdir = dirname($dirname);  // get parent dir
		if ($parentdir != "/") {
			$parentdir = $parentdir . "/";
		}

		$response = array();

		if ($result) {
			/* create the response folder object */
			$folder = array();

			$folder[$dirname] = array(
				'props' =>
					array(
						'id' => rawurldecode($dirname),
						'path' => dirname(rawurldecode($relDirname)),
						'filename' => $actionData["filename"],
						'message_size' => -1,
						'lastmodified' => $actionData['lastmodified'],
						'message_class' => "IPM.Files",
						'type' => $actionData['type']
					),
				'entryid' => rawurldecode($dirname),
				'virtual' => $virtualRecord, // just for debugging
				'store_entryid' => 'files',
				'parent_entryid' => $parentdir
			);
			$response['item'] = array_values($folder);

			$this->addActionData($actionType == "save" ? "update" : $actionType, $response);
			$GLOBALS["bus"]->addData($this->getResponseData());

			return true;
		}

		return false;
	}

	/**
	 * Check if given filename or folder already exists on server
	 *
	 * @access private
	 * @param string $actionType name of the current action
	 * @param array $actionData all parameters contained in this request
	 * @throws BackendException if the backend request fails
	 *
	 * @return void
	 */
	private function checkIfExists($actionType, $actionData)
	{
		$records = $actionData["records"];
		$destination = isset($actionData["destination"]) ? $actionData["destination"] : false;
		$duplicate = false;

		if (isset($records) && is_array($records)) {
			if (!isset($destination) || $destination == false) {
				$destination = reset($records);
				$destination = $destination["id"]; // we can only check files in the same folder, so one request will be enough
				Logger::debug(self::LOG_CONTEXT, "Resetting destination to check.");
			}
			Logger::debug(self::LOG_CONTEXT, "Checking: " . $destination);

			// Initialize the account and backendstore
			$accountStore = new \Files\Core\AccountStore();
			$backendStore = \Files\Backend\BackendStore::getInstance();

			$accountID = substr($destination, 3, (strpos($destination, '/') - 3)); // parse account id from node id
			$account = $accountStore->getAccount($accountID);

			// initialize the backend
			$initializedBackend = $backendStore->getInstanceOfBackend($account->getBackend());
			$initializedBackend->init_backend($account->getBackendConfig());

			$initializedBackend->open();

			$relDirname = substr($destination, strpos($destination, '/'));
			Logger::debug(self::LOG_CONTEXT, "Getting content for: " . $relDirname);
			try {
				$lsdata = $initializedBackend->ls($relDirname); // we can only check files in the same folder, so one request will be enough
			} catch (Exception $e) {
				// ignore - if file not found -> does not exist :)
			}
			if (isset($lsdata) && is_array($lsdata)) {
				foreach ($records as $record) {
					$relRecId = substr($record["id"], strpos($record["id"], '/'));
					Logger::debug(self::LOG_CONTEXT, "Checking rec: " . $relRecId, "Core");
					foreach ($lsdata as $argsid => $args) {
						if (strcmp($args['resourcetype'], "collection") == 0 && $record["isFolder"] && strcmp(basename($argsid), basename($relRecId)) == 0) { // we have a folder
							Logger::debug(self::LOG_CONTEXT, "Duplicate folder found: " . $argsid, "Core");
							$duplicate = true;
							break;
						} else {
							if (strcmp($args['resourcetype'], "collection") != 0 && !$record["isFolder"] && strcmp(basename($argsid), basename($relRecId)) == 0) {
								Logger::debug(self::LOG_CONTEXT, "Duplicate file found: " . $argsid, "Core");
								$duplicate = true;
								break;
							} else {
								$duplicate = false;
							}
						}
					}

					if ($duplicate) {
						Logger::debug(self::LOG_CONTEXT, "Duplicate entry: " . $relRecId, "Core");
						break;
					}
				}
			}
		}

		$response = array();
		$response['status'] = true;
		$response['duplicate'] = $duplicate;
		$this->addActionData($actionType, $response);
		$GLOBALS["bus"]->addData($this->getResponseData());
	}

	/**
	 * Downloads file from the Files service and saves it in tmp
	 * folder with unique name
	 *
	 * @access private
	 * @param array $actionData
	 * @throws BackendException if the backend request fails
	 *
	 * @return void
	 */
	private function downloadSelectedFilesToTmp($actionType, $actionData)
	{
		$ids = $actionData['ids'];
		$dialogAttachmentId = $actionData['dialog_attachments'];
		$response = array();

		$attachment_state = new AttachmentState();
		$attachment_state->open();

		// Initialize the account and backendstore
		$accountStore = new \Files\Core\AccountStore();
		$backendStore = \Files\Backend\BackendStore::getInstance();

		$accountID = substr($ids[0], 3, (strpos($ids[0], '/') - 3)); // parse account id from node id, one is enough
		$account = $accountStore->getAccount($accountID);

		// initialize the backend
		$initializedBackend = $backendStore->getInstanceOfBackend($account->getBackend());
		$initializedBackend->init_backend($account->getBackendConfig());

		$initializedBackend->open();

		foreach ($ids as $file) {
			$filename = basename($file);

			$tmpname = $attachment_state->getAttachmentTmpPath($filename);

			$path = dirname($file);

			Logger::debug(self::LOG_CONTEXT, "Downloading: " . $filename . " to: " . $tmpname);

			// download file from the backend
			$relRecId = substr($file, strpos($file, '/'));
			$http_status = $initializedBackend->get_file($relRecId, $tmpname);

			$filesize = filesize($tmpname);

			// switch between large files or normal attachment
			if (!!ENABLE_LARGEFILES && $filesize > getMaxUploadSize()) {
				$lf_backend = new LargeFile();

				// Move the uploaded file into the large files backend
				$attachid = $lf_backend->addUploadedAttachmentFile($dialogAttachmentId, $filename, $tmpname, array(
					'name' => $filename,
					'size' => $filesize,
					'type' => 'application/octet-stream',
					'sourcetype' => 'default'
				));

				$response['items'][] = array(
					'tmpname' => $attachid,
					'name' => $filename,
					'size' => $filesize
				);
			} else {
				$response['items'][] = array(
					'name' => $filename,
					'size' => $filesize,
					'tmpname' => PathUtil::getFilenameFromPath($tmpname)
				);

				// mimetype is not required...
				$attachment_state->addAttachmentFile($dialogAttachmentId, PathUtil::getFilenameFromPath($tmpname), Array(
					"name" => $filename,
					"size" => $filesize,
					"sourcetype" => 'default'
				));
			}
			Logger::debug(self::LOG_CONTEXT, "filesize: " . $filesize);
		}

		$attachment_state->close();
		$response['status'] = true;
		$this->addActionData($actionType, $response);
		$GLOBALS["bus"]->addData($this->getResponseData());
	}

	/**
	 * upload the tempfile to files
	 *
	 * @access private
	 * @param array $actionData
	 * @throws BackendException if the backend request fails
	 *
	 * @return void
	 */
	private function uploadToBackend($actionType, $actionData)
	{
		Logger::debug(self::LOG_CONTEXT, "preparing attachment");

		// Initialize the account and backendstore
		$accountStore = new \Files\Core\AccountStore();
		$backendStore = \Files\Backend\BackendStore::getInstance();

		$accountID = substr($actionData["destdir"], 3, (strpos($actionData["destdir"], '/') - 3)); // parse account id from node id, one is enough
		$account = $accountStore->getAccount($accountID);

		// initialize the backend
		$initializedBackend = $backendStore->getInstanceOfBackend($account->getBackend());
		$initializedBackend->init_backend($account->getBackendConfig());
		$initializedBackend->open();

		$result = true;

		if ($actionData["type"] === "attachment") {
			foreach ($actionData["items"] as $item) {
				list($tmpname, $filename) = $this->prepareAttachmentForUpload($item);

				$dst = substr($actionData["destdir"], strpos($actionData["destdir"], '/')) . $filename;

				Logger::debug(self::LOG_CONTEXT, "Uploading to: " . $dst . " tmpfile: " . $tmpname);

				$result = $result && $initializedBackend->put_file($dst, $tmpname);
				unlink($tmpname);
			}
		} elseif ($actionData["type"] === "mail") {
			foreach ($actionData["items"] as $item) {
				list($tmpname, $filename) = $this->prepareEmailForUpload($item);

				$dst = substr($actionData["destdir"], strpos($actionData["destdir"], '/')) . $filename;

				Logger::debug(self::LOG_CONTEXT, "Uploading to: " . $dst . " tmpfile: " . $tmpname);

				$result = $result && $initializedBackend->put_file($dst, $tmpname);
				unlink($tmpname);
			}
		} else {
			$this->sendFeedback(false, array(
				'type' => ERROR_GENERAL,
				'info' => array(
					'original_message' => dgettext('plugin_files', "Unknown type - cannot save this file to the Files backend!"),
					'display_message' => dgettext('plugin_files', "Unknown type - cannot save this file to the Files backend!")
				)
			));
		}

		$response = array();
		$response['status'] = $result;
		$this->addActionData($actionType, $response);
		$GLOBALS["bus"]->addData($this->getResponseData());
	}

	/**
	 * This function will prepare an attachment for the upload to the backend.
	 * It will store the attachment to the TMP folder and return its temporary
	 * path and filename as array.
	 *
	 * @param $items
	 * @return array (tmpname, filename) or false on error
	 * @access private
	 */
	private function prepareAttachmentForUpload($item)
	{
		// Check which type isset
		$openType = "attachment";

		// Get store id
		$storeid = false;
		if (isset($item["store"])) {
			$storeid = $item["store"];
		}

		// Get message entryid
		$entryid = false;
		if (isset($item["entryid"])) {
			$entryid = $item["entryid"];
		}

		// Get number of attachment which should be opened.
		$attachNum = false;
		if (isset($item["attachNum"])) {
			$attachNum = $item["attachNum"];
		}

		$tmpname = "";
		$filename = "";

		// Check if storeid and entryid isset
		if ($storeid && $entryid) {
			// Open the store
			$store = $GLOBALS["mapisession"]->openMessageStore(hex2bin($storeid));

			if ($store) {
				// Open the message
				$message = mapi_msgstore_openentry($store, hex2bin($entryid));

				if ($message) {
					$attachment = false;

					// Check if attachNum isset
					if ($attachNum) {
						// Loop through the attachNums, message in message in message ...
						for ($i = 0; $i < (count($attachNum) - 1); $i++) {
							// Open the attachment
							$tempattach = mapi_message_openattach($message, (int)$attachNum[$i]);
							if ($tempattach) {
								// Open the object in the attachment
								$message = mapi_attach_openobj($tempattach);
							}
						}

						// Open the attachment
						$attachment = mapi_message_openattach($message, (int)$attachNum[(count($attachNum) - 1)]);
					}

					// Check if the attachment is opened
					if ($attachment) {

						// Get the props of the attachment
						$props = mapi_attach_getprops($attachment, array(PR_ATTACH_LONG_FILENAME, PR_ATTACH_MIME_TAG, PR_DISPLAY_NAME, PR_ATTACH_METHOD));
						// Content Type
						$contentType = "application/octet-stream";
						// Filename
						$filename = "ERROR";

						// Set filename
						if (isset($props[PR_ATTACH_LONG_FILENAME])) {
							$filename = PathUtil::sanitizeFilename($props[PR_ATTACH_LONG_FILENAME]);
						} else {
							if (isset($props[PR_ATTACH_FILENAME])) {
								$filename = PathUtil::sanitizeFilename($props[PR_ATTACH_FILENAME]);
							} else {
								if (isset($props[PR_DISPLAY_NAME])) {
									$filename = PathUtil::sanitizeFilename($props[PR_DISPLAY_NAME]);
								}
							}
						}

						// Set content type
						if (isset($props[PR_ATTACH_MIME_TAG])) {
							$contentType = $props[PR_ATTACH_MIME_TAG];
						} else {
							// Parse the extension of the filename to get the content type
							if (strrpos($filename, ".") !== false) {
								$extension = strtolower(substr($filename, strrpos($filename, ".")));
								$contentType = "application/octet-stream";
								if (is_readable("mimetypes.dat")) {
									$fh = fopen("mimetypes.dat", "r");
									$ext_found = false;
									while (!feof($fh) && !$ext_found) {
										$line = fgets($fh);
										preg_match("/(\.[a-z0-9]+)[ \t]+([^ \t\n\r]*)/i", $line, $result);
										if ($extension == $result[1]) {
											$ext_found = true;
											$contentType = $result[2];
										}
									}
									fclose($fh);
								}
							}
						}


						$tmpname = tempnam(TMP_PATH, stripslashes($filename));

						// Open a stream to get the attachment data
						$stream = mapi_openproperty($attachment, PR_ATTACH_DATA_BIN, IID_IStream, 0, 0);
						$stat = mapi_stream_stat($stream);
						// File length =  $stat["cb"]

						Logger::debug(self::LOG_CONTEXT, "filesize: " . $stat["cb"]);

						$fhandle = fopen($tmpname, 'w');
						$buffer = null;
						for ($i = 0; $i < $stat["cb"]; $i += BLOCK_SIZE) {
							// Write stream
							$buffer = mapi_stream_read($stream, BLOCK_SIZE);
							fwrite($fhandle, $buffer, strlen($buffer));
						}
						fclose($fhandle);

						Logger::debug(self::LOG_CONTEXT, "temp attachment written to " . $tmpname);

						return array($tmpname, $filename);
					}
				}
			} else {
				Logger::error(self::LOG_CONTEXT, "store could not be opened");
			}
		} else {
			Logger::error(self::LOG_CONTEXT, "wrong call, store and entryid have to be set");
		}

		return false;
	}

	/**
	 * Store the email as eml to a temporary directory and return its temporary filename.
	 *
	 * @param {string} $actionType
	 * @param {array} $actionData
	 * @return array (tmpname, filename) or false on error
	 * @access private
	 */
	private function prepareEmailForUpload($item)
	{
		// Get store id
		$storeid = false;
		if (isset($item["store"])) {
			$storeid = $item["store"];
		}

		// Get message entryid
		$entryid = false;
		if (isset($item["entryid"])) {
			$entryid = $item["entryid"];
		}

		$tmpname = "";
		$filename = "";

		$store = $GLOBALS['mapisession']->openMessageStore(hex2bin($storeid));
		$message = mapi_msgstore_openentry($store, hex2bin($entryid));

		// Decode smime signed messages on this message
		parse_smime($store, $message);

		if ($message && $store) {
			// get message properties.
			$messageProps = mapi_getprops($message, array(PR_SUBJECT, PR_EC_IMAP_EMAIL, PR_MESSAGE_CLASS));

			$isSupportedMessage = (
				(stripos($messageProps[PR_MESSAGE_CLASS], 'IPM.Note') === 0)
				|| (stripos($messageProps[PR_MESSAGE_CLASS], 'Report.IPM.Note') === 0)
				|| (stripos($messageProps[PR_MESSAGE_CLASS], 'IPM.Schedule') === 0)
			);

			if ($isSupportedMessage) {
				// If RFC822-formatted stream is already available in PR_EC_IMAP_EMAIL property
				// than directly use it, generate otherwise.
				if (isset($messageProps[PR_EC_IMAP_EMAIL]) || propIsError(PR_EC_IMAP_EMAIL, $messageProps) == MAPI_E_NOT_ENOUGH_MEMORY) {
					// Stream the message to properly get the PR_EC_IMAP_EMAIL property
					$stream = mapi_openproperty($message, PR_EC_IMAP_EMAIL, IID_IStream, 0, 0);
				} else {
					// Get addressbook for current session
					$addrBook = $GLOBALS['mapisession']->getAddressbook();

					// Read the message as RFC822-formatted e-mail stream.
					$stream = mapi_inetmapi_imtoinet($GLOBALS['mapisession']->getSession(), $addrBook, $message, array());
				}

				if (!empty($messageProps[PR_SUBJECT])) {
					$filename = PathUtil::sanitizeFilename($messageProps[PR_SUBJECT]) . '.eml';
				} else {
					$filename = dgettext('plugin_files', 'Untitled') . '.eml';
				}

				$tmpname = tempnam(TMP_PATH, "email2filez");

				// Set the file length
				$stat = mapi_stream_stat($stream);

				$fhandle = fopen($tmpname, 'w');
				$buffer = null;
				for ($i = 0; $i < $stat["cb"]; $i += BLOCK_SIZE) {
					// Write stream
					$buffer = mapi_stream_read($stream, BLOCK_SIZE);
					fwrite($fhandle, $buffer, strlen($buffer));
				}
				fclose($fhandle);

				return array($tmpname, $filename);
			}
		}

		return false;
	}

	/**
	 * Get sharing information from the backend.
	 *
	 * @param $actionType
	 * @param $actionData
	 * @return bool
	 */
	private function getSharingInformation($actionType, $actionData)
	{
		$response = array();
		$records = $actionData["records"];

		if (count($records) < 1) {
			$this->sendFeedback(false, array(
				'type' => ERROR_GENERAL,
				'info' => array(
					'original_message' => dgettext('plugin_files', "No record given!"),
					'display_message' => dgettext('plugin_files', "No record given!")
				)
			));
		}

		// Initialize the account and backendstore
		$accountStore = new \Files\Core\AccountStore();
		$backendStore = \Files\Backend\BackendStore::getInstance();

		$accountID = substr($records[0], 3, (strpos($records[0], '/') - 3)); // parse account id from node id, one is enough
		$account = $accountStore->getAccount($accountID);

		// initialize the backend
		$initializedBackend = $backendStore->getInstanceOfBackend($account->getBackend());
		$initializedBackend->init_backend($account->getBackendConfig());
		$initializedBackend->open();

		$relRecords = array();
		foreach ($records as $record) {
			$relRecords[] = substr($record, strpos($record, '/')); // remove account id
		}

		try {
			$sInfo = $initializedBackend->sharingDetails($relRecords);
		} catch (Exception $e) {
			$response['status'] = false;
			$response['header'] = dgettext('plugin_files', 'Fetching sharing information failed');
			$response['message'] = $e->getMessage();
			$this->addActionData("error", $response);
			$GLOBALS["bus"]->addData($this->getResponseData());

			return false;
		}

		$sharingInfo = array();
		foreach ($sInfo as $path => $details) {
			$realPath = "#R#" . $accountID . $path;
			$sharingInfo[$realPath] = $details; // add account id again
		}

		$response['status'] = true;
		$response['shares'] = $sharingInfo;
		$this->addActionData($actionType, $response);
		$GLOBALS["bus"]->addData($this->getResponseData());

		return true;
	}

	/**
	 * Create a new share.
	 *
	 * @param $actionType
	 * @param $actionData
	 * @return bool
	 */
	private function createNewShare($actionType, $actionData)
	{
		$records = $actionData["records"];
		$shareOptions = $actionData["options"];

		if (count($records) < 1) {
			$this->sendFeedback(false, array(
				'type' => ERROR_GENERAL,
				'info' => array(
					'original_message' => dgettext('plugin_files', "No record given!"),
					'display_message' => dgettext('plugin_files', "No record given!")
				)
			));
		}

		// Initialize the account and backendstore
		$accountStore = new \Files\Core\AccountStore();
		$backendStore = \Files\Backend\BackendStore::getInstance();

		$accountID = substr($records[0], 3, (strpos($records[0], '/') - 3)); // parse account id from node id, one is enough
		$account = $accountStore->getAccount($accountID);

		// initialize the backend
		$initializedBackend = $backendStore->getInstanceOfBackend($account->getBackend());
		$initializedBackend->init_backend($account->getBackendConfig());
		$initializedBackend->open();

		$sharingRecords = array();
		foreach ($records as $record) {
			$path = substr($record, strpos($record, '/')); // remove account id
			$sharingRecords[$path] = $shareOptions; // add options
		}

		try {
			$sInfo = $initializedBackend->share($sharingRecords);
		} catch (Exception $e) {
			$response['status'] = false;
			$response['header'] = dgettext('plugin_files', 'Sharing failed');
			$response['message'] = $e->getMessage();
			$this->addActionData("error", $response);
			$GLOBALS["bus"]->addData($this->getResponseData());

			return false;
		}

		$sharingInfo = array();
		foreach ($sInfo as $path => $details) {
			$realPath = "#R#" . $accountID . $path;
			$sharingInfo[$realPath] = $details; // add account id again
		}

		$response = array();
		$response['status'] = true;
		$response['shares'] = $sharingInfo;
		$this->addActionData($actionType, $response);
		$GLOBALS["bus"]->addData($this->getResponseData());

		return true;
	}

	/**
	 * Update a existing share.
	 * @param $actionType
	 * @param $actionData
	 * @return bool
	 */
	private function updateExistingShare($actionType, $actionData)
	{
		$records = $actionData["records"];
		$accountID = $actionData["accountid"];
		$shareOptions = $actionData["options"];

		if (count($records) < 1) {
			$this->sendFeedback(false, array(
				'type' => ERROR_GENERAL,
				'info' => array(
					'original_message' => dgettext('plugin_files', "No record given!"),
					'display_message' => dgettext('plugin_files', "No record given!")
				)
			));
		}

		// Initialize the account and backendstore
		$accountStore = new \Files\Core\AccountStore();
		$backendStore = \Files\Backend\BackendStore::getInstance();

		$account = $accountStore->getAccount($accountID);

		// initialize the backend
		$initializedBackend = $backendStore->getInstanceOfBackend($account->getBackend());
		$initializedBackend->init_backend($account->getBackendConfig());
		$initializedBackend->open();

		$sharingRecords = array();
		foreach ($records as $record) {
			$sharingRecords[$record] = $shareOptions; // add options
		}

		try {
			$sInfo = $initializedBackend->share($sharingRecords, true);
		} catch (Exception $e) {
			$response['status'] = false;
			$response['header'] = dgettext('plugin_files', 'Updating share failed');
			$response['message'] = $e->getMessage();
			$this->addActionData("error", $response);
			$GLOBALS["bus"]->addData($this->getResponseData());

			return false;
		}

		$response = array();
		$response['status'] = true;
		$response['shares'] = $sInfo;
		$this->addActionData($actionType, $response);
		$GLOBALS["bus"]->addData($this->getResponseData());

		return true;
	}

	/**
	 * Delete one or more shares.
	 * @param $actionType
	 * @param $actionData
	 * @return bool
	 */
	private function deleteExistingShare($actionType, $actionData)
	{
		$records = $actionData["records"];
		$accountID = $actionData["accountid"];

		if (count($records) < 1) {
			$this->sendFeedback(false, array(
				'type' => ERROR_GENERAL,
				'info' => array(
					'original_message' => dgettext('plugin_files', "No record given!"),
					'display_message' => dgettext('plugin_files', "No record given!")
				)
			));
		}

		// Initialize the account and backendstore
		$accountStore = new \Files\Core\AccountStore();
		$backendStore = \Files\Backend\BackendStore::getInstance();

		$account = $accountStore->getAccount($accountID);

		// initialize the backend
		$initializedBackend = $backendStore->getInstanceOfBackend($account->getBackend());
		$initializedBackend->init_backend($account->getBackendConfig());
		$initializedBackend->open();

		try {
			$sInfo = $initializedBackend->unshare($records);
		} catch (Exception $e) {
			$response['status'] = false;
			$response['header'] = dgettext('plugin_files', 'Deleting share failed');
			$response['message'] = $e->getMessage();
			$this->addActionData("error", $response);
			$GLOBALS["bus"]->addData($this->getResponseData());

			return false;
		}

		$response = array();
		$response['status'] = true;
		$this->addActionData($actionType, $response);
		$GLOBALS["bus"]->addData($this->getResponseData());

		return true;
	}
}
