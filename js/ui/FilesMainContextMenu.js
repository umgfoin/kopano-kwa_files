Ext.namespace('Zarafa.plugins.files.ui');

Zarafa.plugins.files.ui.FilesMainContextMenu = Ext.extend(Zarafa.core.ui.menu.ConditionalMenu, {

	context: undefined,

	model: undefined,

	grid: undefined,

	constructor: function (config) {
		config = config || {};

		if (!Ext.isDefined(config.model) && Ext.isDefined(config.context)) {
			config.model = config.context.getModel();
		}

		Ext.applyIf(config, {
			items: [
				this.createContextActionItems(),
				{xtype: 'menuseparator'},
				container.populateInsertionPoint('plugin.files.contextmenu.actions', this),
				{xtype: 'menuseparator'},
				container.populateInsertionPoint('plugin.files.contextmenu.options', this)
			]
		});

		Zarafa.plugins.files.ui.FilesMainContextMenu.superclass.constructor.call(this, config);
	},

	createContextActionItems: function () {
		return [{
			xtype     : 'zarafa.conditionalitem',
			text      : dgettext('plugin_files', 'Download'),
			iconCls   : 'files_icon_action files_icon_action_download',
			handler   : this.onContextItemOpen,
			beforeShow: function (item, records) {
				var visible = Zarafa.plugins.files.data.Utils.Validator.actionSelectionVisibilityFilter(records, false, true, false);

				item.setVisible(visible);
			},
			scope     : this
		}, {
			xtype     : 'zarafa.conditionalitem',
			text      : dgettext('plugin_files', 'Share'),
			iconCls   : 'files_icon_action files_icon_action_share',
			handler   : this.onContextItemShare,
			beforeShow: function (item, records) {
				var visible = false;
				var isShared = false;
				if (records.length > 0) {
					var account = records[0].getAccount();
					isShared = records[0].get("isshared");
					visible = account.supportsFeature(Zarafa.plugins.files.data.AccountRecordFeature.SHARING);
				}

				visible = visible && Zarafa.plugins.files.data.Utils.Validator.actionSelectionVisibilityFilter(records, true, false, true);

				item.setVisible(visible);

				if (isShared == true) {
					item.setText(dgettext('plugin_files', 'Edit share'));
				}
			},
			scope     : this
		}, {
			xtype     : 'zarafa.conditionalitem',
			text      : dgettext('plugin_files', 'Attach to mail'),
			iconCls   : 'files_icon_action files_icon_action_attach_to_mail',
			handler   : this.onContextItemAttach,
			beforeShow: function (item, records) {
				var visible = Zarafa.plugins.files.data.Utils.Validator.actionSelectionVisibilityFilter(records, false, true, true);
				var max_attachment_size = container.getServerConfig().getMaxAttachmentSize();

				for (var i = 0; i < records.length; i++) {
					var record = records[i];
					if (record.get('message_size') > max_attachment_size) {
						visible = false;
						break;
					}
				}

				item.setVisible(visible);
			},
			scope     : this
		}, {
			xtype     : 'zarafa.conditionalitem',
			text      : dgettext('plugin_files', 'Rename'),
			iconCls   : 'files_icon_action files_icon_action_edit',
			handler   : this.onContextItemRename,
			beforeShow: function (item, records) {
				item.setVisible(Zarafa.plugins.files.data.Utils.Validator.actionSelectionVisibilityFilter(records, true, false, true));
			},
			scope     : this
		}, {
			xtype     : 'zarafa.conditionalitem',
			text      : dgettext('plugin_files', 'Delete'),
			iconCls   : 'files_icon_action files_icon_action_delete',
			handler   : this.onContextItemDelete,
			beforeShow: function (item, records) {
				item.setVisible(Zarafa.plugins.files.data.Utils.Validator.actionSelectionVisibilityFilter(records, false, false, true));
			},
			scope     : this
		}, {
			xtype     : 'zarafa.conditionalitem',
			text      : dgettext('plugin_files', 'Info'),
			iconCls   : 'icon_info',
			disabled  : Zarafa.plugins.files.data.ComponentBox.getContext().getCurrentViewMode() != Zarafa.plugins.files.data.ViewModes.NO_PREVIEW,
			handler   : this.onContextItemInfo,
			beforeShow: function (item, records) {
				item.setVisible(Zarafa.plugins.files.data.Utils.Validator.actionSelectionVisibilityFilter(records, true, false, true));
			},
			scope     : this
		}];
	},

	onContextItemOpen: function () {
		Zarafa.plugins.files.data.Actions.openFilesContent(this.records);
	},

	onContextItemDelete: function () {
		Zarafa.plugins.files.data.Actions.deleteRecords(this.records);
	},

	onContextItemShare: function () {
		Zarafa.plugins.files.data.Actions.createShareDialog(this.records);
	},

	onContextItemInfo: function () {
		var count = this.records.length;
		var record = undefined;

		if (count == 1) {
			record = this.records[0];
		}

		var config = Ext.applyIf({}, {
			modal : true,
			record: record
		});

		var componentType = Zarafa.core.data.SharedComponentType['zarafa.plugins.files.fileinfopanel'];
		Zarafa.core.data.UIFactory.openLayerComponent(componentType, undefined, config);
	},

	onContextItemRename: function () {
		Zarafa.plugins.files.data.Actions.openRenameDialog(this.model, this.records[0]);
	},

	onContextItemAttach: function () {
		var emailRecord = container.getContextByName("mail").getModel().createRecord();
		var idsList = [];
		var attachmentStore = emailRecord.getAttachmentStore();

		Ext.each(this.records, function (record) {
			idsList.push(record.get('id'));
		}, this);

		container.getNotifier().notify('info.files', dgettext('plugin_files', 'Attaching'), dgettext('plugin_files', 'Creating email... Please wait!'));

		try {
			container.getRequest().singleRequest(
				'filesbrowsermodule',
				'downloadtotmp',
				{
					ids               : idsList,
					maxAttachmentSize : container.getServerConfig().getMaxAttachmentSize(),
					dialog_attachments: attachmentStore.getId()
				},
				new Zarafa.core.data.AbstractResponseHandler({
					doDownloadtotmp: this.attachToMail.createDelegate(this, [emailRecord], true)
				})
			);
		} catch (e) {
			Zarafa.plugins.files.data.Actions.msgWarning(e.message);
		}
	},

	attachToMail: function (response, emailRecord) {
		Zarafa.plugins.files.data.Actions.openCreateMailContent(emailRecord, response.items);
	}
});

Ext.reg('filesplugin.filesmaincontextmenu', Zarafa.plugins.files.ui.FilesMainContextMenu);
