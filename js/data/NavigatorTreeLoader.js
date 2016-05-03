Ext.namespace('Zarafa.plugins.files.data');

/**
 * @class Zarafa.plugins.files.data.NavigatorTreeLoader
 * @extends Ext.tree.TreeLoader
 *
 * Files directory loader. Extends Ext treeloader to use Kopano
 * specific requests.
 */
Zarafa.plugins.files.data.NavigatorTreeLoader = Ext.extend(Ext.tree.TreeLoader, {

	/**
	 * @cfg {Boolean} If this flag is true, file records will also be loaded
	 * and visible.
	 */
	loadFiles: false,

	/**
	 * @cfg {Boolean} True to reload the cache.
	 */
	reload: false,


	/**
	 * @cfg {array|String} array of account ids or a single account id that should be loaded.
	 */
	accountFilter: null,

	/**
	 * @constructor
	 * @param {Object} config Configuration object
	 */
	constructor: function (config) {
		config = config || {};

		if (Ext.isDefined(config.reload)) {
			this.reload = config.reload;
		}

		if (Ext.isDefined(config.loadfiles)) {
			this.loadFiles = config.loadfiles;
		}

		if (Ext.isDefined(config.accountFilter)) {
			this.accountFilter = config.accountFilter;
		}

		Ext.applyIf(config, {
			preloadChildren: true,
			directFn       : this.loadFolder.createDelegate(this),
			listeners      : {
				loadexception: this.loadException
			}
		});

		Zarafa.plugins.files.data.NavigatorTreeLoader.superclass.constructor.call(this, config);
	},

	/**
	 * Will do single request to files module with provided nodeId and
	 * in case of success will load the content of this node.
	 *
	 * @param {Number} nodeId The id of node which content need to be loaded
	 * @param {Function} callback The function which need to be called after response received
	 */
	loadFolder: function (nodeId, callback) {
		var responseHandler = new Zarafa.plugins.files.data.ResponseHandler({
			successCallback: this.loadSuccess.createDelegate(this, [callback], true),
			failureCallback: this.loadFailure.createDelegate(this, [callback], true),
			nodeId         : nodeId
		});

		container.getRequest().singleRequest(
			'filesbrowsermodule',
			'getfilestree',
			{
				id           : nodeId,
				loadfiles    : this.loadFiles,
				reload       : this.reload,
				accountFilter: this.accountFilter
			},
			responseHandler
		);
	},

	/**
	 * This method gets called after a successful response from the server.
	 * It will then call the callback method.
	 *
	 * @param items
	 * @param response
	 * @param callback
	 */
	loadSuccess: function (items, response, callback) {
		callback(items, response);
	},

	/**
	 * This method gets called after a failed response from the server.
	 * It will display a messagebox and then call the callback method.
	 *
	 * @param items
	 * @param response
	 * @param callback
	 */
	loadFailure: function (items, response, callback) {
		Zarafa.common.dialogs.MessageBox.show({
			title  : dgettext('plugin_files', 'Error'),
			msg    : response.error,
			icon   : Zarafa.common.dialogs.MessageBox.ERROR,
			buttons: Zarafa.common.dialogs.MessageBox.OK
		});

		callback(undefined, {status: true, items: undefined});
	},

	/**
	 * This method gets called if a loading exception occurs.
	 * It will diplay a warning message to the user.
	 *
	 * @param tl
	 * @param node
	 * @param response
	 */
	loadException: function (tl, node, response) {
		Zarafa.common.dialogs.MessageBox.show({
			title  : dgettext('plugin_files', 'Loading failed'),
			msg    : response.error,
			icon   : Zarafa.common.dialogs.MessageBox.ERROR,
			buttons: Zarafa.common.dialogs.MessageBox.OK
		});
	},

	/**
	 * Update the reload flag.
	 *
	 * @param reload
	 */
	setReload: function (reload) {
		this.reload = reload;
	}
});