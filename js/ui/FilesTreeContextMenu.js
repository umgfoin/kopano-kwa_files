Ext.namespace('Zarafa.plugins.files.ui');

Zarafa.plugins.files.ui.FilesTreeContextMenu = Ext.extend(Zarafa.core.ui.menu.ConditionalMenu, {

	context: undefined,

	model: undefined,

	records: undefined,

	constructor: function (config) {
		config = config || {};

		if (!Ext.isDefined(config.model) && Ext.isDefined(config.context)) {
			config.model = config.context.getModel();
		}

		if (Ext.isDefined(config.records)) {
			this.records = config.records;
		}

		Ext.applyIf(config, {
			items: [
				this.createContextActionItems(),
				{xtype: 'menuseparator'},
				container.populateInsertionPoint('plugin.files.treecontextmenu.actions', this),
				{xtype: 'menuseparator'},
				container.populateInsertionPoint('plugin.files.treecontextmenu.options', this)
			]
		});

		Zarafa.plugins.files.ui.FilesTreeContextMenu.superclass.constructor.call(this, config);
	},

	createContextActionItems: function () {
		return [{
			xtype     : 'zarafa.conditionalitem',
			text      : dgettext('plugin_files', 'Rename'),
			iconCls   : 'files_icon_action files_icon_action_edit',
			handler   : this.onContextItemRename,
			beforeShow: function (item, records) {
				var rec = records[0];
				var path = Zarafa.plugins.files.data.Utils.File.stripAccountId(rec.get('id'));
				item.setVisible(path != "/");
			},
			scope     : this
		}, {
			xtype     : 'zarafa.conditionalitem',
			text      : dgettext('plugin_files', 'Delete'),
			iconCls   : 'files_icon_action files_icon_action_delete',
			handler   : this.onContextItemDelete,
			beforeShow: function (item, records) {
				var rec = records[0];
				var path = Zarafa.plugins.files.data.Utils.File.stripAccountId(rec.get('id'));
				item.setVisible(path != "/");
			},
			scope     : this
		}, {
			xtype     : 'zarafa.conditionalitem',
			text      : dgettext('plugin_files', 'Create folder'),
			iconCls   : 'files_icon_action files_icon_action_new_folder',
			handler   : this.onContextItemNewFolder,
			scope     : this
		}];
	},

	onContextItemDelete: function (menuitem, event) {
		Zarafa.plugins.files.data.Actions.deleteRecords(this.records);
	},

	onContextItemNewFolder: function (menuitem, event) {
		var clickedRecord = this.records[0];

		Zarafa.plugins.files.data.Actions.createFolder(this.model, null, clickedRecord.get('id'));
	},

	onContextItemRename: function (menuitem, event) {
		Zarafa.plugins.files.data.Actions.openRenameDialog(this.model, this.records[0]);
	}
});

Ext.reg('filesplugin.filestreecontextmenu', Zarafa.plugins.files.ui.FilesTreeContextMenu);
