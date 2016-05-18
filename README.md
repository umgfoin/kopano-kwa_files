# Kopano Files Plugin

This plugin will integrate external storage providers in Kopano Webapp.

### Dependencies

This plugin requires the following dependencies:

* [CURL] - PHP5 Curl
* [Memcached] - Memcached (optional)

### Installation
This steps are show for debian bases systems. It should be simillar to all other systems.

First install all dependencies:

```sh
$ sudo apt-get update
$ sudo apt-get install php5-curl
$ sudo apt-get install memcached php5-memcached
```
After the successful installation of all dependencies you can install the plugin to Zartafa Webapp.
Therefore copy the whole folder **'files'** to the Webapp plugin directory:
```sh
$ sudo cp -r files /usr/share/kopano-webapp/plugins/
```

Now you have the plugin installed. Restart the webserver and continue configuring the files plugin.

```sh
$ sudo service apache2 restart
```
### Configuration
The plugin configuration can be found in the **'config.php'** file.
> define('PLUGIN_FILES_USER_DEFAULT_ENABLE', true);

This configuration flag will enable the plugin by default for all users. If this is set to false, each user has to enable 
the plugin by itself in the Webapp settings. (Settings -> Plugins -> Check the files plugin)

> define('PLUGIN_FILES_ASK_BEFORE_DELETE', true);

If this flag is set to true, the files plugin will preload folders. This might decrease perfomance! If the flag is set to false,
a user will not be able to see if a folder has content or is empty.

> define('PLUGIN_FILES_PRELOAD_FOLDER', false);

If this flag is true, a confirmation dialog will be shown before a file gets deleted. Otherwise the file is deleted instantly (dangerous!).

> define('PLUGIN_FILESBROWSER_LOGLEVEL', "NONE");

If you experience any problems with the plugin, set this flag to **'DEBUG'** and send your apache/php error log to the Kopano developers.

### License

AGPL


[CURL]:http://php.net/manual/de/book.curl.php
[Memcached]:http://php.net/manual/de/book.memcached.php
