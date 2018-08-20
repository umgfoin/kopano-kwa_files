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
	 * @cfg {Zarafa.plugins.files.FilesContext} context The context to which this toolbar belongs
	 */
	context: undefined,

	/**
	 * The {@link Zarafa.plugins.files.FilesContextModel} which is obtained from the {@link #context}.
	 * @property
	 * @type Zarafa.plugins.files.FilesContextModel
	 */
	model: undefined,

	/**
	 * @constructor
	 * @param config
	 */
	constructor: function (config) {
		config = config || {};

		if (!Ext.isDefined(config.model) && Ext.isDefined(config.context)) {
			this.model = config.context.getModel();
		}

		Ext.applyIf(config, {
			enableOverflow: true,
			items         :  this.createToolbarItems()
		});
		Zarafa.plugins.files.ui.FilesListToolbar.superclass.constructor.call(this, config);

		this.initEvent()
	},

	/**
	 * Called after constructing files list toolbar.
	 */
	initEvent : function () {
		this.mon(this.model.getStore(), 'load', this.onLoad, this);
		this.mon(this.model, 'recordselectionchange', this.onRecordSelectionChange, this);
	},

	/**
	 * Create configuration object array which used to
	 * create toolbar items.
	 *
	 * @return {Array} configuration object array for toolbar.
	 */
	createToolbarItems : function()
	{
		return [{
			cls         : 'files_icon_actionbutton',
			text        : dgettext('plugin_files', 'Upload'),
			ref         : 'uploadButton',
			overflowText: dgettext('plugin_files', 'Upload files'),
			iconCls     : 'files_icon_action files_icon_action_upload',
			handler     : this.onFileUpload,
			model       : this.model,
			scope       : this
		}, {
			cls         : 'files_icon_actionbutton',
			text        : dgettext('plugin_files', 'New Folder'),
			ref         : 'createFolderButton',
			overflowText: dgettext('plugin_files', 'New Folder'),
			iconCls     : 'files_icon_action files_icon_action_new_folder',
			handler     : this.onCreateFolder,
			model       : this.model
		}, {
			ref                    : 'downloadBtn',
			cls                    : 'files_icon_actionbutton',
			text                   : dgettext('plugin_files', 'Download'),
			overflowText           : dgettext('plugin_files', 'Download files'),
			iconCls                : 'files_icon_action files_icon_action_download',
			handler                : this.onFileDownload,
			model                  : this.model
		}, {
			cls                    : 'files_icon_actionbutton',
			ref                    : 'shareBtn',
			text                   : dgettext('plugin_files', 'Share'),
			overflowText           : dgettext('plugin_files', 'Share files'),
			iconCls                : 'files_icon_action files_icon_action_share',
			handler                : this.onFileShare,
			model                  : this.model
		}, {
			cls                    : 'files_icon_actionbutton',
			ref                    : 'attachToMailBtn',
			text                   : dgettext('plugin_files', 'Attach to mail'),
			overflowText           : dgettext('plugin_files', 'Attach to mail'),
			iconCls                : 'files_icon_action files_icon_action_attach_to_mail',
			handler                : this.onFileAddToMail,
			model                  : this.model,
			scope                  : this
		}, {
			xtype: 'tbfill'
		}, {
			tooltip                : dgettext('plugin_files', 'Rename'),
			overflowText           : dgettext('plugin_files', 'Rename'),
			ref                    : "renameBtn",
			iconCls                : 'files_icon_action files_icon_action_edit',
			handler                : this.onRename,
			model                  : this.model
		}, {
			xtype             : 'zarafa.toolbarbutton',
			tooltip           : dgettext('plugin_files', 'Delete'),
			overflowText      : dgettext('plugin_files', 'Delete'),
			iconCls           : 'files_icon_action files_icon_action_delete',
			nonEmptySelectOnly: true,
			handler           : this.onDelete,
			model             : this.model
		}];
	},

	/**
	 * Event handler triggered when selection was changed in
	 * grid. it will disable/enable download, attach to mail,
	 * share and rename buttons in toolbar.
	 *
	 * @param {Zarafa.core.ContextModel} model this model.
	 * @param {Zarafa.plugins.files.data.FilesRecord[]} records The selected records
	 */
	onRecordSelectionChange : function(model, records)
	{
		var validator = Zarafa.plugins.files.data.Utils.Validator;
		var isVisible = validator.actionSelectionVisibilityFilter(records, false, true, false, true);
		this.downloadBtn.setDisabled(!isVisible);
		this.attachToMailBtn.setDisabled(!isVisible);

		isVisible = validator.actionSelectionVisibilityFilter(records, true, false, false, true);
		if (isVisible) {
			this.shareBtn.setDisabled(!isVisible);
			var account = records[0].getAccount();
			this.shareBtn.setVisible(account.supportsFeature(Zarafa.plugins.files.data.AccountRecordFeature.SHARING));
		} else {
			this.shareBtn.setVisible(false);
		}
		this.renameBtn.setDisabled(!isVisible);
	},

	/**
	 * Event handler which is triggered when store get's load.
	 * it will disable or enable the toolbar items.
	 *
	 * @param {Zarafa.plugins.files.data.FilesRecordStore} store
	 * @param {Zarafa.plugins.files.data.FilesRecord} records
	 * @param {Object} options
	 */
	onLoad : function (store, records, options) {
		var path = options.params.id;
		if (Ext.isEmpty(path) || path === "#R#" ) {
			this.setDisabled(true);
			this.shareBtn.setVisible(false);
		} else {
			this.createFolderButton.setDisabled(false);
			this.uploadButton.setDisabled(false);
		}
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
	 * See {@link #onFileInputChange} for the handling of the selected files.
	 * @private
	 */
	onFileDownload: function ()
	{
		var records = this.model.getSelectedRecords();
		Zarafa.plugins.files.data.Actions.downloadItem(records);
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
				new Zarafa.core.data.AbstractResponseHandler({
					doDownloadtotmp: this.attachToMail.createDelegate(this, [emailRecord], true)
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
		Zarafa.plugins.files.data.Actions.uploadAsyncItems(files, this.model.getStore());
	},

	/**
	 * This method will add the downloaded files to a new mail record.
	 *
	 * @param responseItems
	 * @param response
	 * @param emailRecord
	 */
	attachToMail: function (response, emailRecord) {
		Zarafa.plugins.files.data.Actions.openCreateMailContent(emailRecord, response.items);
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
		Zarafa.plugins.files.data.Actions.openRenameDialog(records[0]);
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
