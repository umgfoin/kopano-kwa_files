<?php

require_once __DIR__ . "/../config.php";
require_once __DIR__ . "/Files/Backend/class.backendstore.php";

$backend = "";

if (isset($_GET["backend"]) && !empty($_GET["backend"])) {
	$backend = $_GET["backend"];
} else {
	die("No backend specified!");
}

use Files\Backend\BackendStore;

$backendstore = BackendStore::getInstance();

if ($backendstore->backendExists($backend)) {
	$backendInstance = $backendstore->getInstanceOfBackend($backend);
	$formdata = $backendInstance->getFormConfig();
	die($formdata);
} else {
	die("Specified backend does not exist!");
}