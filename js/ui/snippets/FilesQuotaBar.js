Ext.namespace('Zarafa.plugins.files.ui.snippets');

Zarafa.plugins.files.ui.snippets.FilesQuotaBar = Ext.extend(Ext.Panel, {

	/**
	 * @cfg {Zarafa.core.Context} context The context to which this toolbar belongs
	 */
	context: undefined,

	/**
	 * The {@link Zarafa.core.ContextModel} which is obtained from the {@link #context}.
	 * @property
	 * @type Zarafa.mail.MailContextModel
	 */
	model: undefined,

	/**
	 * @cfg String
	 */
	quotaText: dgettext('plugin_files', '{0} of {1} in use'), // String.format(this.pageInfoText, pageData, total)

	/**
	 * @cfg Boolean
	 */
	loadOnlyOnce: true,

	/**
	 * @cfg String
	 */
	defaultDirectory: "/",

	/**
	 * @constructor
	 * @param {Object} config Configuration object
	 */
	constructor: function (config) {
		config = config || {};

		if (!Ext.isDefined(config.model) && Ext.isDefined(config.context)) {
			config.model = config.context.getModel();
		}

		Ext.applyIf(config, {
			xtype       : 'filesplugin.quotabar',
			cls         : 'files_quota_bar_snippet',
			maskDisabled: false,
			hideBorders : true,
			border      : false,
			items       : [{
				xtype       : 'panel',
				ref         : 'quotaPanel',
				layout      : 'table',
				layoutConfig: {columns: 2},
				cls         : 'files_quota_bar_container',
				maskDisabled: false,
				hideBorders : true,
				hidden      : true,
				border      : false,
				defaults    : {
					frame: false
				},
				items       : [{
					xtype: 'label',
					ref  : '../usageInfo',
					autoWidth: true
				}, {
					xtype: 'progress',
					width: '150',
					ref  : '../progressBar',
					height: '8',
					cls  : 'files_quota_bar',
					style: 'margin: 0 0 0 20px'
				}]
			}, {
				xtype: 'label',
				border      : false,
				hideBorders : true,
				maskDisabled: false,
				ref  : 'loadingIcon',
				html : '<div class="img"></div>'
			}]
		});

		Zarafa.plugins.files.ui.snippets.FilesQuotaBar.superclass.constructor.call(this, config);
		this.initEvents();
	},

	/**
	 * initializes the events.
	 * @private
	 */
	initEvents: function () {
		var filesStore = Zarafa.plugins.files.data.ComponentBox.getStore();

		// do the initial check
		this.onStoreLoad(filesStore);

		this.mon(filesStore, {
			'beforeload': this.onStoreLoad,
			scope : this
		});
	},

	/**
	 * Event handler which will be called when the {@link #model} fires the
	 * {@link Zarafa.core.ContextModel#folderchange} event. This will determine
	 * if the selected folders support 'search folders' and update the UI accordingly.
	 * @param {Zarafa.core.ContextModel} model this context model.
	 * @param {Array} folders selected folders as an array of {Zarafa.hierarchy.data.MAPIFolderRecord Folder} objects.
	 * @private
	 */
	onStoreLoad: function (store, records, options) {
		var nodeID = store.getPath();
		var accID = Zarafa.plugins.files.data.Utils.File.getAccountId(nodeID);

		var accStore = Zarafa.plugins.files.data.singleton.AccountStore.getStore();

		// look up the account
		var account = accStore.getById(accID);

		if (Ext.isDefined(account) && account.supportsFeature(Zarafa.plugins.files.data.AccountRecordFeature.QUOTA)) {

			// load the information only once or if a new account was loaded.
			if ((!Ext.isDefined(this.loaded) || this.loaded != accID) || !this.loadOnlyOnce) {

				// ui updates
				this.show();
				this.quotaPanel.hide();
				this.loadingIcon.show();

				this.loadQuotaInformation(accID, this.defaultDirectory);
			}

			// set the loaded flag to true
			this.loaded = accID;
		} else {
			this.hide(); // hide the complete component
		}
	},

	/**
	 * Request quota values from the server.
	 */
	loadQuotaInformation: function (accountID, directory) {
		var responseHandler = new Zarafa.plugins.files.data.ResponseHandler({
			successCallback: this.gotQuotaValues.createDelegate(this)
		});

		container.getRequest().singleRequest(
			'filesaccountmodule',
			'getquota',
			{
				accountId: accountID,
				folder   : directory
			},
			responseHandler
		);
	},

	/**
	 * Function is called after we received the response object from the server.
	 * It will update the textfield values.
	 *
	 * @param response
	 */
	gotQuotaValues: function (response) {

		var used = parseInt(response["quota"][0].amount);
		var free = parseInt(response["quota"][1].amount);
		var total = used + free;

		var usedPercentage = parseInt((100 * used) / total); // dont show fractional digits

		// show/hide components
		this.loadingIcon.hide();
		this.quotaPanel.show();

		// Update text values
		this.usageInfo.setText(String.format(this.quotaText, Ext.util.Format.fileSize(used), Ext.util.Format.fileSize(total)));

		// Update progressbar
		this.progressBar.updateProgress(used / total);


	}
});

Ext.reg('filesplugin.quotabar', Zarafa.plugins.files.ui.snippets.FilesQuotaBar);
