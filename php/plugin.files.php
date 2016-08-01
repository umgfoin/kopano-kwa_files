<?php

require_once __DIR__ . "/Files/Core/class.downloadhandler.php";
require_once __DIR__ . "/Files/Core/class.uploadhandler.php";

use \Files\Core\DownloadHandler;
use \Files\Core\UploadHandler;

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
				if ($data['name'] == 'download_file') {
					DownloadHandler::doDownload();
				} else {
					if ($data['name'] == 'upload_file') {
						UploadHandler::doUpload();
					}
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
