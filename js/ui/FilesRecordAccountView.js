Ext.namespace('Zarafa.plugins.files.ui');

Zarafa.plugins.files.ui.FilesRecordAccountView = Ext.extend(Zarafa.common.ui.DraggableDataView, {

	context: undefined,

	model: undefined,

	keyMap: undefined,

	constructor: function (config) {
		config = config || {};

		if (!Ext.isDefined(config.model) && Ext.isDefined(config.context)) {
			config.model = config.context.getModel();
		}
		if (!Ext.isDefined(config.store) && Ext.isDefined(config.model)) {
			config.store = config.model.getStore();
		}

		config.store = Ext.StoreMgr.lookup(config.store);

		config.plugins = Ext.value(config.plugins, []);
		config.plugins.push('zarafa.icondragselectorplugin');

		Ext.applyIf(config, {
			xtype: 'filesplugin.filesrecordaccountview',

			cls           : 'zarafa-files-accountview',
			loadingText   : dgettext('plugin_files', 'Loading accounts') + '...',
			deferEmptyText: false,
			autoScroll    : true,
			emptyText     : '<div class="emptytext">' + dgettext('plugin_files', 'There are no accounts added. Go to settings and add an account!') + '</div>',
			overClass     : 'zarafa-files-accountview-over',
			tpl           : this.initTemplate(),
			multiSelect   : true,
			selectedClass : 'zarafa-files-accountview-selected',
			itemSelector  : 'div.zarafa-files-accountview-container'
		});

		Zarafa.plugins.files.ui.FilesRecordAccountView.superclass.constructor.call(this, config);

		this.initEvents();
	},

	initTemplate: function () {
		// Load the account store


		return new Ext.XTemplate(
			'<div style="height: 100%; width: 100%; overflow: auto;">',
			'<tpl for=".">',
			'<div class="zarafa-files-accountview-container">',
			'<div class="zarafa-files-account-background {.:this.getAccountType}"> </div>',
			'<div class="zarafa-files-account-info">',
			'<span class="zarafa-files-accountview-subject">{filename:htmlEncode}</span>',
			'<span class="zarafa-files-accountview-account">{.:this.getAccountIdentifier}</span>',
			'</div>',
			'</div>',
			'</tpl>',
			'</div>',
			{
				getAccountType: function (record) {
					// get an instance of the account store.
					var store = Zarafa.plugins.files.data.singleton.AccountStore.getStore();

					// get the account id from the path string
					var accId = Zarafa.plugins.files.data.Utils.File.getAccountId(record.id);

					// look up the account
					var account = store.getById(accId);

					var backend = "Webdav"; // Default is webdav...
					if (Ext.isDefined(account)) {
						backend = account.get("backend");
					}

					return "icon_256_" + backend;
				},

				getAccountIdentifier: function (record) {
					// get an instance of the account store.
					var store = Zarafa.plugins.files.data.singleton.AccountStore.getStore();

					// get the account id from the path string
					var accId = Zarafa.plugins.files.data.Utils.File.getAccountId(record.id);

					// look up the account
					var account = store.getById(accId);

					var identifier = ""; // Default is empty...
					// TODO: this is not dynamic because the backend_config variable names might change in other backends
					if (Ext.isDefined(account)) {
						var bconfig = account.get("backend_config");
						if(bconfig && Ext.isDefined(bconfig.user) && Ext.isDefined(bconfig.server_address)) {
							identifier = bconfig.user + "@" + bconfig.server_address;
						}
					}

					return Zarafa.plugins.files.data.Utils.Format.truncate(identifier, 27); // 27 = length of the account field
				}
			}
		);
	},

	getMainPanel: function () {
		return this.ownerCt;
	},

	initEvents: function () {
		this.on({
			'dblclick'       : this.onIconDblClick,
			'selectionchange': this.onSelectionChange,
			'afterrender'    : this.onAfterRender,
			scope            : this
		});
	},

	onAfterRender: function () {
		this.keyMap = new Ext.KeyMap(this.getEl(), {
			key: Ext.EventObject.DELETE,
			fn : this.onKeyDelete.createDelegate(this)
		});
	},

	onKeyDelete: function (key, event) {
		Zarafa.common.dialogs.MessageBox.show({
			title  : dgettext('plugin_files', 'Error'),
			msg    : dgettext('plugin_files', 'To delete an account you have to go to settings.'),
			icon   : Zarafa.common.dialogs.MessageBox.ERROR,
			buttons: Zarafa.common.dialogs.MessageBox.OK
		});
	},

	onIconDblClick: function (dataview, index, node, event) {
		var record = this.getStore().getAt(index);
		Zarafa.plugins.files.data.Actions.openFilesContent([record]);
	},

	onSelectionChange: function (dataView, selections) {
		if (this.context.getCurrentViewMode() != Zarafa.plugins.files.data.ViewModes.NO_PREVIEW) {
			this.model.setPreviewRecord(undefined);
		}
	}
});

Ext.reg('filesplugin.filesrecordaccountview', Zarafa.plugins.files.ui.FilesRecordAccountView);

