<?php

require_once __DIR__ . "/Files/Core/class.downloadhandler.php";
require_once __DIR__ . "/Files/Core/class.uploadhandler.php";
require_once __DIR__ . "/Files/Core/class.recipienthandler.php";
require_once __DIR__ . "/Files/Backend/class.backendstore.php";

use \Files\Core\DownloadHandler;
use \Files\Core\UploadHandler;
use \Files\Core\RecipientHandler;

/**
 * Files Plugin
 *
 * Integrates Files into the Kopano environment.
 */
class Pluginfiles extends Plugin
{

	/**
	 * Function initializes the Plugin and registers all hooks
	 *
	 * @return void
	 */
	function init()
	{
		$this->registerHook('server.core.settings.init.before');
		$this->registerHook('server.index.load.custom');
	}

	/**
	 * Function is executed when a hook is triggered by the PluginManager
	 *
	 * @param string $eventID the id of the triggered hook
	 * @param mixed $data object(s) related to the hook
	 *
	 * @return void
	 */
	function execute($eventID, &$data)
	{
		switch ($eventID) {
			case 'server.core.settings.init.before' :
				$this->injectPluginSettings($data);
				break;
			case 'server.index.load.custom':
				switch($data['name']) {
				case 'files_get_recipients':
					RecipientHandler::doGetRecipients();
				case 'download_file':
					DownloadHandler::doDownload();
					break;
				case 'upload_file':
					UploadHandler::doUpload();
					break;
				case 'form':
					if (isset($_GET['backend'])) {
						$backend = urldecode($_GET["backend"]);
					} else {
						$backend = '';
					}
					$backendstore = Files\Backend\BackendStore::getInstance();

					if ($backendstore->backendExists($backend)) {
						$backendInstance = $backendstore->getInstanceOfBackend($backend);
						$formdata = $backendInstance->getFormConfig();
						die($formdata);
					} else {
						die("Specified backend does not exist!");
					}
					break;
			}
			break;
		}
	}

	/**
	 * Called when the core Settings class is initialized and ready to accept sysadmin default
	 * settings. Registers the sysadmin defaults for the FILES plugin.
	 *
	 * @param array $data Reference to the data of the triggered hook
	 *
	 * @return void
	 */
	function injectPluginSettings(&$data)
	{
		$data['settingsObj']->addSysAdminDefaults(Array(
			'zarafa' => Array(
				'v1' => Array(
					'main' => Array(
						'notifier' => Array(
							'info' => Array(
								'files' => Array(
									'value' => "dropdown"        // static notifier
								)
							)
						)
					),
					'contexts' => Array(
						'files' => Array(
							'ask_before_delete' => PLUGIN_FILES_ASK_BEFORE_DELETE,
							'preload_folder' => PLUGIN_FILES_PRELOAD_FOLDER,
							'webapp_tmp' => TMP_PATH
						)
					),
					'plugins' => Array(
						'files' => Array(
							'enable' => PLUGIN_FILES_USER_DEFAULT_ENABLE
						)
					)
				)
			)
		));
	}
}
