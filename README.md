[![build status](https://scan.coverity.com/projects/11714/badge.svg)](https://scan.coverity.com/projects/kopano-files)

# Kopano Files Plugin

This plugin will integrate external storage providers in Kopano Webapp.

# Dependencies

This plugin requires the following dependencies:

* PHP Curl
* Memcached (optional)
* php-sodium

# Configuration

The plugin configuration can be found in the **'config.php'** file.

```define('PLUGIN_FILES_USER_DEFAULT_ENABLE', false);```

This configuration flag will enable/disable the plugin by default for all users. If this is set to false, each user has to enable
the plugin by itself in the Webapp settings. (Settings -> Plugins -> Check the files plugin)

```define('PLUGIN_FILES_ASK_BEFORE_DELETE', true);```

If this flag is true, a confirmation dialog will be shown before a file gets deleted. Otherwise the file is deleted instantly (dangerous!).

```define('PLUGIN_FILESBROWSER_LOGLEVEL', "ERROR");```

If you experience any problems with the plugin, set this flag to **'DEBUG'** and send your apache/php error log to the Kopano developers.

```define('FILES_ACCOUNTSTORE_V1_SECRET_KEY', '');```

Your secret key to encrypt files

# Upgrading from files v3 to v4

Files version 4 has with better security and the following changes have been introduced:

**Changes**
- Files plugin requires [sodium](https://www.php.net/manual/en/book.sodium.php) and distributions that ship php <7.2 out of the box are no longer build.
- A new config option `FILES_ACCOUNTSTORE_V1_SECRET_KEY` is introduced. Default: empty.
- The Files plugin will not work when this option is empty.

Old configs: `FILES_PASSWORD_KEY` and  `FILES_PASSWORD_IV` will still work for older accounts if configured, but note if the old options are removed, we cannot decrypt older accounts. Therefor make sure you've made a backup of those keys.


# Documentation
In-depth documentation, such as administration and user manuals about our
products can be found on our [Documentation Portal](
https://documentation.kopano.io/). Additionally, a [Knowledge Base](
https://kb.kopano.io/) is available for quick start guides, handy code
snippets, and troubleshooting help.

# Contributing
The main development of Kopano Files takes place in a [Bitbucket
instance](https://stash.kopano.io/projects/KWA/repos/files/browse) with
development tickets organised in [Jira](https://jira.kopano.io/projects/KFP/).
Please see [CONTRIBUTING.md](CONTRIBUTING.md) for steps on how to contribute
patches.

# Downloading compiled packages
Nightly builds of the ```master``` branch can be downloaded from
https://download.kopano.io/. In addition to this, QAed builds of the
```release``` and ```stable``` branches are available to subscription holders
from the [Kopano Portal](https://portal.kopano.com/) and a [package
repository](
https://kb.kopano.io/display/WIKI/Install+and+upgrade+Kopano+products+using+repositories).

# Support
Community Support is available through the [Kopano
Forum](https://forum.kopano.io/) and through the ```#kopano``` channel on the
Freenode IRC network. [Additional support options](https://kopano.com/support/)
are available for subscription holders.
