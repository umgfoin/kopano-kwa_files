<?php
/**
 * This class offers functions to handle file backend accounts.
 *
 * @class AccountStore
 */

namespace Files\Core;

require_once __DIR__ . "/class.account.php";
require_once __DIR__ . "/class.exception.php";
require_once __DIR__ . "/../Backend/class.backendstore.php";
require_once __DIR__ . "/../Backend/class.exception.php";

use \Files\Backend\BackendStore;
use \Files\Backend\Exception as BackendException;
use Files\Core\Util\Logger;

class AccountStore
{
	const LOG_CONTEXT = "AccountStore"; // Context for the Logger
	const ACCOUNT_STORAGE_PATH = "zarafa/v1/plugins/files/accounts";

	/**
	 * @var Account[] Account array
	 */
	private $accounts = [];

	/**
	 *
	 */
	function __construct()
	{
		$this->initialiseAccounts();
	}

	/**
	 * @param $name
	 * @param $backend
	 * @param Array $backendConfig Backend specific account settings 
	 *     like username, password, serveraddress, ...
	 *
	 * @return Account
	 */
	public function createAccount($name, $backend, $backendConfig)
	{
		$newID = $this->createNewId($backendConfig); // create id out of the configuration

		// create instance of backend to get features
		$backendStore = BackendStore::getInstance();
		$backendInstance = $backendStore->getInstanceOfBackend($backend);
		$features = $backendInstance->getAvailableFeatures();

		// check backend_config for validity
		$status = $this->checkBackendConfig($backendInstance, $backendConfig);

		// get sequence number
		$sequence = $this->getNewSequenceNumber();

		$newAccount = new Account($newID, strip_tags($name), $status[0], $status[1], strip_tags($backend), $backendConfig, $features, $sequence, false);

		// now store all the values to the user settings
		$GLOBALS["settings"]->set(self::ACCOUNT_STORAGE_PATH . "/" . $newID . "/id", $newAccount->getId());
		$GLOBALS["settings"]->set(self::ACCOUNT_STORAGE_PATH . "/" . $newID . "/name", $newAccount->getName());
		$GLOBALS["settings"]->set(self::ACCOUNT_STORAGE_PATH . "/" . $newID . "/status", $newAccount->getStatus());
		$GLOBALS["settings"]->set(self::ACCOUNT_STORAGE_PATH . "/" . $newID . "/status_description", $newAccount->getStatusDescription());
		$GLOBALS["settings"]->set(self::ACCOUNT_STORAGE_PATH . "/" . $newID . "/backend", $newAccount->getBackend());
		$GLOBALS["settings"]->set(self::ACCOUNT_STORAGE_PATH . "/" . $newID . "/account_sequence", $newAccount->getSequence());
		// User defined accounts are never administrative. So set cannot_change to false.
		$GLOBALS["settings"]->set(self::ACCOUNT_STORAGE_PATH . "/" . $newID . "/cannot_change", false);

		// store all backend configurations
		foreach ($newAccount->getBackendConfig() as $key => $value) {
			$GLOBALS["settings"]->set(self::ACCOUNT_STORAGE_PATH . "/" . $newID . "/backend_config/" . $key, $this->encryptBackendConfigProperty($value));
		}

		// store all features
		foreach ($newAccount->getFeatures() as $feature) {
			$GLOBALS["settings"]->set(self::ACCOUNT_STORAGE_PATH . "/" . $newID . "/backend_features/" . $feature, true);
		}

		$GLOBALS["settings"]->saveSettings(); // save to MAPI storage

		// add account to our local store after it was saved to the zarafa-settings
		$this->accounts[$newID] = $newAccount;

		return $newAccount;
	}

	/**
	 * @param Account $account
	 *
	 * @return Account
	 */
	public function updateAccount($account)
	{

		$accId = $account->getId();
		$isAdministrativeAccount = $account->getCannotChangeFlag();

		// create instance of backend to get features
		$backendStore = BackendStore::getInstance();
		$backendInstance = $backendStore->getInstanceOfBackend($account->getBackend());
		$features = $backendInstance->getAvailableFeatures();
		$account->setFeatures($features);

		// check backend_config for validity
		$status = $this->checkBackendConfig($backendInstance, $account->getBackendConfig());
		$account->setStatus($status[0]); // update status
		$account->setStatusDescription($status[1]); // update status description

		// add account to local store
		$this->accounts[$accId] = $account;

		// save values to MAPI settings
		// now store all the values to the user settings
		// but if we have an administrative account only save the account sequence
		if (!$isAdministrativeAccount) {
			$GLOBALS["settings"]->set(self::ACCOUNT_STORAGE_PATH . "/" . $accId . "/name", $account->getName());
			$GLOBALS["settings"]->set(self::ACCOUNT_STORAGE_PATH . "/" . $accId . "/status", $account->getStatus());
			$GLOBALS["settings"]->set(self::ACCOUNT_STORAGE_PATH . "/" . $accId . "/status_description", $account->getStatusDescription());
			$GLOBALS["settings"]->set(self::ACCOUNT_STORAGE_PATH . "/" . $accId . "/backend", $account->getBackend());

			// store all backend configurations
			foreach ($account->getBackendConfig() as $key => $value) {
				$GLOBALS["settings"]->set(self::ACCOUNT_STORAGE_PATH . "/" . $accId . "/backend_config/" . $key, $this->encryptBackendConfigProperty($value));
			}

			// store all features
			foreach ($account->getFeatures() as $feature) {
				$GLOBALS["settings"]->set(self::ACCOUNT_STORAGE_PATH . "/" . $accId . "/backend_features/" . $feature, true);
			}
		}
		// when getSequence returns 0, there is no account_sequence setting yet. So create one.
		$account_sequence = ($account->getSequence() === 0 ? $this->getNewSequenceNumber() : $account->getSequence());
		$GLOBALS["settings"]->set(self::ACCOUNT_STORAGE_PATH . "/" . $accId . "/account_sequence", $account_sequence);

		$GLOBALS["settings"]->saveSettings(); // save to MAPI storage

		return $account;
	}

	/**
	 * Delete account from local store and from the MAPI settings
	 *
	 * @param $accountId
	 *
	 * @return bool
	 */
	public function deleteAccount($accountId)
	{
		$account = $this->getAccount($accountId);
		// Do not allow deleting administrative accounts, but fail silently.
		if (!$account->getCannotChangeFlag()) {
			$GLOBALS["settings"]->delete(self::ACCOUNT_STORAGE_PATH . "/" . $accountId);
			$GLOBALS["settings"]->saveSettings(); // save to MAPI storage
		}

		return true;
	}

	/**
	 * Return the instance of the local account
	 *
	 * @param $accountId
	 *
	 * @return Account
	 */
	public function getAccount($accountId)
	{
		return $this->accounts[$accountId];
	}

	/**
	 * @return Account[] alls Accounts
	 */
	public function getAllAccounts()
	{
		return $this->accounts;
	}

	/**
	 * Initialize the accountstore. Reads all accountinformation from the MAPI settings.
	 */
	private function initialiseAccounts()
	{
		// Parse accounts from the Settings
		$tmpAccs = $GLOBALS["settings"]->get(self::ACCOUNT_STORAGE_PATH);

		if (is_array($tmpAccs)) {
			$this->accounts = array();

			foreach ($tmpAccs as $acc) {
				// set backend_features if it is not set to prevent warning
				if (!isset($acc["backend_features"])) {
					$acc["backend_features"] = array();
				}
				// account_sequence was introduced later. So set and save it if missing.
				if (!isset($acc["account_sequence"])) {
					$acc["account_sequence"] = $this->getNewSequenceNumber();
					Logger::debug(self::LOG_CONTEXT, "Account sequence missing. New seq: " . $acc["account_sequence"]);
					$GLOBALS["settings"]->set(self::ACCOUNT_STORAGE_PATH . "/" . $acc["id"] . "/account_sequence", $acc["account_sequence"]);
					$GLOBALS["settings"]->saveSettings();
				}
				// cannot_change flag was introduced later. So set it to false and save it if missing.
				if (!isset($acc["cannot_change"])) {
					$acc["cannot_change"] = false;
					Logger::debug(self::LOG_CONTEXT, "Cannot change flag missing. Setting to false.");
					$GLOBALS["settings"]->set(self::ACCOUNT_STORAGE_PATH . "/" . $acc["id"] . "/cannot_change", false);
					$GLOBALS["settings"]->saveSettings();
				}
				$this->accounts[$acc["id"]] = new Account($acc["id"],
					$acc["name"],
					$acc["status"],
					$acc["status_description"],
					$acc["backend"],
					$this->decryptBackendConfig($acc["backend_config"]),
					array_keys($acc["backend_features"]),
					$acc["account_sequence"],
					$acc["cannot_change"]
				);
			}
		}

		Logger::debug(self::LOG_CONTEXT, "Found " . count($this->accounts) . " accounts.");
	}

	/**
	 * @param AbstractBackend $backendInstance
	 * @param Array $backendConfig Backend specific account settings 
	 *     like username, password, serveraddress, ...
	 *
	 * @return Array
	 */
	private function checkBackendConfig($backendInstance, $backendConfig)
	{
		$status = Account::STATUS_NEW;
		$description = dgettext('plugin_files', 'Account is ready to use.');
		try {
			$backendInstance->init_backend($backendConfig);
			$backendInstance->open();
			$backendInstance->ls("/");
			$status = Account::STATUS_OK;
		} catch (BackendException $e) {
			$status = Account::STATUS_ERROR;
			$description = $e->getMessage();

			Logger::error(self::LOG_CONTEXT, "Account check failed: " . $description);
		}

		return array($status, $description);
	}

	/**
	 * @param Array $backendConfig Backend specific account settings 
	 *     like username, password, serveraddress, ...
	 *
	 * @return  an unique id
	 */
	private function createNewId($backendConfig)
	{
		// lets create a hash
		return md5(json_encode($backendConfig) . time()); // json_encode is faster than serialize
	}

	/**
	 * Generate a new sequence number. It will always be the highest used sequence number +1.
	 *
	 * @return int
	 */
	private function getNewSequenceNumber() {
		$seq = 0;
		foreach($this->accounts as $acc) {
			if($acc->getSequence() > $seq) {
				$seq = $acc->getSequence();
			}
		}

		return $seq + 1;
	}

	/**
	 * Encrypt the backend configuration using the standard webapp key.
	 *
	 * @param Array $backendConfig Backend specific account settings 
	 *     like username, password, serveraddress, ...
	 * @return array
	 */
	private function encryptBackendConfig($backendConfig) {
		$encBackendConfig = array();

		foreach($backendConfig as $key => $value) {
			$encBackendConfig[$key] = $this->encryptBackendConfigProperty($value);
		}

		return $encBackendConfig;
	}

	/**
	 * Decrypt the backend configuration using the standard webapp key.
	 *
	 * @param Array $backendConfig Backend specific account settings 
	 *     like username, password, serveraddress, ...
	 * @return array
	 */
	private function decryptBackendConfig($backendConfig) {
		$decBackendConfig = array();

		foreach($backendConfig as $key => $value) {
			$decBackendConfig[$key] = $this->decryptBackendConfigProperty($value);
		}

		return $decBackendConfig;
	}

	/**
	 * Encrypt the given string.
	 *
	 * @param $value
	 * @return string
	 */
	private function encryptBackendConfigProperty($value) {
		// if user has openssl module installed encrypt
		if (function_exists("openssl_encrypt") && !is_bool($value)) {
			if (version_compare(phpversion(), "5.3.3", "<")) {
				$value = openssl_encrypt($value, "des-ede3-cbc", FILES_PASSWORD_KEY, 0);
			} else {
				$value = openssl_encrypt($value, "des-ede3-cbc", FILES_PASSWORD_KEY, 0, FILES_PASSWORD_IV);
			}
		}

		return $value;
	}

	/**
	 * Decrypt the given string.
	 *
	 * @param $value
	 * @return string
	 */
	private function decryptBackendConfigProperty($value) {
		// if user has openssl module installed decrypt
		if (function_exists("openssl_decrypt") && !is_bool($value)) {
			if (version_compare(phpversion(), "5.3.3", "<")) {
				$value = openssl_decrypt($value, "des-ede3-cbc", FILES_PASSWORD_KEY, 0);
			} else {
				$value = openssl_decrypt($value, "des-ede3-cbc", FILES_PASSWORD_KEY, 0, FILES_PASSWORD_IV);
			}
		}

		return $value;
	}
}
