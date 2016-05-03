<?php
namespace Files\Backend\FTP;

require_once __DIR__ . "/../class.abstract_js_loader.php";

use Files\Backend\AbstractJSLoader;

class BackendJSLoader extends AbstractJSLoader
{

	function __construct()
	{
		$this->JS_PATH = __DIR__ . "/js/";
	}

	/**
	 * Returns a combined Javascript String
	 *
	 * @param bool $debug
	 * @return string
	 */
	public function get_combined_js($debug = false)
	{


		// Populate the list of directories to check against
		if (($directoryHandle = opendir($this->JS_PATH)) !== FALSE) {
			while (($file = readdir($directoryHandle)) !== false) {
				// Make sure we're not dealing with a folder or a link to the parent directory
				if (is_dir($this->JS_PATH . $file) || ($file == '.' || $file == '..') === true) {
					continue;
				}

				// Add file content to our buffer
				$this->jsBuffer .= file_get_contents($this->JS_PATH . $file);
			}
		}

		return $this->jsBuffer;
	}
}