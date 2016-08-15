Ext.namespace('Zarafa.plugins.files.ui');

/**
 * @class Zarafa.plugins.files.ui.FilesListToolbar
 * @extends Ext.Toolbar
 * @xtype filesplugin.fileslisttoolbar
 *
 * The top toolbar for the files explorer.
 */
Zarafa.plugins.files.ui.FilesListToolbar = Ext.extend(Ext.Toolbar, {
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
	 * @constructor
	 * @param config
	 */
	constructor: function (config) {
		config = config || {};

		if (!Ext.isDefined(config.model) && Ext.isDefined(config.context)) {
			config.model = config.context.getModel();
		}

		Ext.applyIf(config, {
			enableOverflow: true,
			items         : [{
				xtype       : 'zarafa.toolbarbutton',
				cls         : 'files_icon_actionbutton',
				text        : dgettext('plugin_files', 'Upload'),
				tooltip     : {
					title: dgettext('plugin_files', 'Upload file'),
					text : dgettext('plugin_files', 'Upload one or more files')
				},
				overflowText: dgettext('plugin_files', 'Upload files'),
				iconCls     : 'files_icon_action files_icon_action_upload',
				handler     : this.onFileUpload.createDelegate(this),
				model       : config.model
			}, {
				xtype       : 'zarafa.toolbarbutton',
				cls         : 'files_icon_actionbutton',
				text        : dgettext('plugin_files', 'Create folder'),
				tooltip     : {
					title: dgettext('plugin_files', 'Create folder'),
					text : dgettext('plugin_files', 'Create a new folder')
				},
				overflowText: dgettext('plugin_files', 'Create new folder'),
				iconCls     : 'files_icon_action files_icon_action_new_folder',
				handler     : this.onCreateFolder,
				model       : config.model
			}, {
				xtype                  : 'zarafa.toolbarbutton',
				cls                    : 'files_icon_actionbutton',
				text                   : dgettext('plugin_files', 'Download'),
				onRecordSelectionChange: function (model, records) {
					this.setDisabled(!Zarafa.plugins.files.data.Utils.Validator.actionSelectionVisibilityFilter(records, false, true, true));
				},
				tooltip                : {
					title: dgettext('plugin_files', 'Download files'),
					text : dgettext('plugin_files', 'Download the selected files')
				},
				overflowText           : dgettext('plugin_files', 'Download files'),
				iconCls                : 'files_icon_action files_icon_action_download',
				handler                : this.onFileDownload,
				model                  : config.model
			}, {
				xtype                  : 'zarafa.toolbarbutton',
				cls                    : 'files_icon_actionbutton',
				text                   : dgettext('plugin_files', 'Share'),
				onRecordSelectionChange: function (model, records) {
					this.setDisabled(!Zarafa.plugins.files.data.Utils.Validator.actionSelectionVisibilityFilter(records, true, false, true));

					var visible = false;
					if (Ext.isDefined(records) && records.length > 0) {
						var account = records[0].getAccount();
						visible = account.supportsFeature(Zarafa.plugins.files.data.AccountRecordFeature.SHARING);
					}

					this.setVisible(visible);
				},
				tooltip                : {
					title: dgettext('plugin_files', 'Share files'),
					text : dgettext('plugin_files', 'Share the selected files')
				},
				overflowText           : dgettext('plugin_files', 'Share files'),
				iconCls                : 'files_icon_action files_icon_action_share',
				handler                : this.onFileShare,
				model                  : config.model
			}, {
				xtype                  : 'zarafa.toolbarbutton',
				cls                    : 'files_icon_actionbutton',
				text                   : dgettext('plugin_files', 'Attach to mail'),
				onRecordSelectionChange: function (model, records) {
					this.setDisabled(!Zarafa.plugins.files.data.Utils.Validator.actionSelectionVisibilityFilter(records, false, true, true));
				},
				tooltip                : {
					title: dgettext('plugin_files', 'Attach to mail'),
					text : dgettext('plugin_files', 'Attach the selected files to mail')
				},
				overflowText           : dgettext('plugin_files', 'Attach to mail'),
				iconCls                : 'files_icon_action files_icon_action_attach_to_mail',
				handler                : this.onFileAddToMail.createDelegate(this),
				model                  : config.model
			}, {
				xtype: 'tbfill'
			}, {
				xtype                  : 'zarafa.toolbarbutton',
				tooltip                : dgettext('plugin_files', 'Rename'),
				overflowText           : dgettext('plugin_files', 'Rename'),
				iconCls                : 'files_icon_action files_icon_action_edit',
				onRecordSelectionChange: function (model, records) {
					this.setDisabled(!Zarafa.plugins.files.data.Utils.Validator.actionSelectionVisibilityFilter(records, true, false, true));
				},
				nonEmptySelectOnly     : true,
				handler                : this.onRename,
				model                  : config.model
			}, {
				xtype             : 'zarafa.toolbarbutton',
				tooltip           : dgettext('plugin_files', 'Delete'),
				overflowText      : dgettext('plugin_files', 'Delete'),
				iconCls           : 'files_icon_action files_icon_action_delete',
				nonEmptySelectOnly: true,
				handler           : this.onDelete,
				model             : config.model
			}]
		});
		Zarafa.plugins.files.ui.FilesListToolbar.superclass.constructor.call(this, config);
	},

	/**
	 * Event handler for opening the "create new folder" dialog.
	 *
	 * @param button
	 * @param event
	 */
	onCreateFolder: function (button, event) {
		Zarafa.plugins.files.data.Actions.createFolder(this.model);
	},

	/**
	 * Event handler for opening the Browser's file selection dialog.
	 *
	 * See {@link #onFileInputChange} for the handling of the selected files.
	 * @param {Ext.Button} button the button on which click event is performed.
	 * @param {Ext.EventObject} event The event object
	 * @private
	 */
	onFileUpload: function (button, event) {
		var uploadComponent = new Zarafa.plugins.files.ui.UploadComponent({
			callback: this.uploadCallback,
			multiple: true,
			scope   : this
		});

		uploadComponent.openUploadDialog();
	},

	/**
	 * Event handler for downloading the selected files.
	 *
	 * See {@link #onFileInputChange} for the handling of the selected files.
	 * @param {Ext.Button} button the button on which click event is performed.
	 * @param {Ext.EventObject} event The event object
	 * @private
	 */
	onFileDownload: function (button, event) {
		var records = this.model.getSelectedRecords();
		Zarafa.plugins.files.data.Actions.openFilesContent(records);
	},

	/**
	 * Event handler for sharing the selected files.
	 *
	 * See {@link #onFileInputChange} for the handling of the selected files.
	 * @param {Ext.Button} button the button on which click event is performed.
	 * @param {Ext.EventObject} event The event object
	 * @private
	 */
	onFileShare: function (button, event) {
		var records = this.model.getSelectedRecords();
		Zarafa.plugins.files.data.Actions.createShareDialog(records);
	},

	/**
	 * Event handler for attaching the selected files to a new mail record.
	 *
	 * See {@link #onFileInputChange} for the handling of the selected files.
	 * @param {Ext.Button} button the button on which click event is performed.
	 * @param {Ext.EventObject} event The event object
	 * @private
	 */
	onFileAddToMail: function (button, event) {
		var records = button.model.getSelectedRecords();

		var emailRecord = container.getContextByName("mail").getModel().createRecord();
		var idsList = [];
		var attachmentStore = emailRecord.getAttachmentStore();

		Ext.each(records, function (record) {
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
				new Zarafa.plugins.files.data.ResponseHandler({
					successCallback: this.attachToMail.createDelegate(this, [emailRecord], true)
				})
			);
		} catch (e) {
			Zarafa.plugins.files.data.Actions.msgWarning(e.message);
		}
	},

	/**
	 * The callback function of {@link Zarafa.plugins.files.ui.UploadComponent}
	 * which used to upload the attachment file on server.
	 *
	 * @param {Object/Array} files The files contains file information.
	 * @param {Object} form the form is contains {@link Ext.form.BasicForm bacisform} info.
	 */
	uploadCallback: function (files, form) {
		Zarafa.plugins.files.data.Actions.uploadAsyncItems(files, Zarafa.plugins.files.data.ComponentBox.getStore());
	},

	/**
	 * This method will add the downloaded files to a new mail record.
	 *
	 * @param responseItems
	 * @param response
	 * @param emailRecord
	 */
	attachToMail: function (responseItems, response, emailRecord) {
		Zarafa.plugins.files.data.Actions.openCreateMailContent(emailRecord, responseItems);
	},

	/**
	 * Event handler for renaming a selected file.
	 *
	 * See {@link #onFileInputChange} for the handling of the selected files.
	 * @param {Ext.Button} button the button on which click event is performed.
	 * @param {Ext.EventObject} event The event object
	 * @private
	 */
	onRename: function (button, event) {
		var records = this.model.getSelectedRecords();

		Zarafa.plugins.files.data.Actions.openRenameDialog(this.model, records[0]);
	},

	/**
	 * Event handler for deleting files and folders.
	 *
	 * See {@link #onFileInputChange} for the handling of the selected files.
	 * @param {Ext.Button} button the button on which click event is performed.
	 * @param {Ext.EventObject} event The event object
	 * @private
	 */
	onDelete: function (button, event) {
		var records = this.model.getSelectedRecords();

		Zarafa.plugins.files.data.Actions.deleteRecords(records);
	}
});

Ext.reg('filesplugin.fileslisttoolbar', Zarafa.plugins.files.ui.FilesListToolbar);
