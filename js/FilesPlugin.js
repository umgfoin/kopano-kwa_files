Ext.namespace('Zarafa.plugins.files');

/**
 * @class Zarafa.plugins.files.FilesPlugin
 * @extends Zarafa.core.Plugin
 *
 * This class integrates the Files plugin to the core WebApp.
 * It allows users to set up and manage their Files accounts.
 */
Zarafa.plugins.files.FilesPlugin = Ext.extend(Zarafa.core.Plugin, {

	/**
	 * @constructor
	 * @param {Object} config
	 */
	constructor: function (config) {
		config = config || {};

		this.registerModules();

		Zarafa.plugins.files.FilesPlugin.superclass.constructor.call(this, config);
	},

	/**
	 * This method is called by the parent and will initialize all insertion points
	 * and shared components.
	 */
	initPlugin: function () {
		Zarafa.plugins.files.FilesPlugin.superclass.initPlugin.apply(this, arguments);

		this.registerInsertionPoint('main.attachment.method', this.createAttachmentDownloadInsertionPoint, this);
		this.registerInsertionPoint('common.contextmenu.attachment.actions', this.createAttachmentUploadInsertionPoint, this);
		this.registerInsertionPoint('context.mail.contextmenu.actions', this.createEmailUploadInsertionPoint, this);

		Zarafa.core.mapi.IconIndex.addProperty("files");

		Zarafa.core.data.SharedComponentType.addProperty('filesplugin.accountedit');
		Zarafa.core.data.SharedComponentType.addProperty('filesplugin.featurequotainfo');
		Zarafa.core.data.SharedComponentType.addProperty('filesplugin.featureversioninfo');
		Zarafa.core.data.SharedComponentType.addProperty('common.dialog.attachments.files');
		Zarafa.core.data.SharedComponentType.addProperty('common.dialog.attachments.savetofiles');
	},

	/**
	 * This method hooks to the attachments chooser button and allows users to add files from
	 * the Files plugin to their emails.
	 *
	 * @param include
	 * @param btn
	 * @returns {Object}
	 */
	createAttachmentDownloadInsertionPoint: function (include, btn)
	{
		return {
			text: dgettext('plugin_files', 'Add from Files'),
			handler: this.showFilesDownloadAttachmentDialog,
			scope: btn,
			iconCls: 'icon_files_category',
			disabled: !this.isAccountsConfigured()
		};
	},

	/**
	 * This method will open the {@link Zarafa.plugins.files.ui.dialogs.AttachFromFilesContentPanel file chooser panel}.
	 *
	 * @param btn
	 */
	showFilesDownloadAttachmentDialog: function (btn)
	{
		var component = Zarafa.core.data.SharedComponentType['common.dialog.attachments.files'];
		Zarafa.core.data.UIFactory.openLayerComponent(component, this.record, {
			title  : dgettext('plugin_files', 'Add attachment from Files'),
			modal  : true
		});
	},

	/**
	 * This method hooks to the attachment context menu and allows users to store files from
	 * their emails to the  Files plugin.
	 *
	 * @param include
	 * @param btn
	 * @returns {Object}
	 */
	createAttachmentUploadInsertionPoint: function (include, btn)
	{
		return {
			text   : dgettext('plugin_files', 'Add to Files'),
			handler: this.showFilesUploadAttachmentDialog,
			scope  : btn,
			iconCls: 'icon_files_category',
			beforeShow : this.onAttachmentUploadBeforeShow.createDelegate(this)
		};
	},

	/**
	 * Function will be called before {@link Zarafa.common.attachment.ui.AttachmentContextMenu AttachmentContextMenu} is shown
	 * so we can decide which item should be disabled.
	 * @param {Zarafa.core.ui.menu.ConditionalItem} item context menu item
	 * @param {Zarafa.core.data.IPMAttachmentRecord} record attachment record on which context menu is shown
	 */
	onAttachmentUploadBeforeShow : function(item, record) {
		// embedded messages can not be downloaded to files
		item.setDisabled(record.isEmbeddedMessage());
		// unsaved attachments can not be added to files without depending on Webapp internals (AttachmentState)
		item.setDisabled(record.isTmpFile());
		// If accounts not configured then disable it.
		item.setDisabled(!this.isAccountsConfigured());
	},

	/**
	 * This method will open the {@link Zarafa.plugins.files.ui.dialogs.SaveToFilesContentPanel folder chooser panel}.
	 */
	showFilesUploadAttachmentDialog: function()
	{
		var attachmentRecord = this.records;
		var attachmentStore = attachmentRecord.store;

		var store = attachmentStore.getParentRecord().get('store_entryid');
		var entryid = attachmentStore.getAttachmentParentRecordEntryId();
		var attachNum = [];
		if (attachmentRecord.isUploaded()) {
			attachNum[0] = attachmentRecord.get('attach_num');
		} else {
			attachNum[0] = attachmentRecord.get('tmpname');
		}
		var dialog_attachments = attachmentStore.getId();
		var filename = attachmentRecord.get('name');

		var jsonRecords = [{
			entryid           : entryid,
			store             : store,
			attachNum         : attachNum,
			dialog_attachments: dialog_attachments,
			filename          : filename
		}];

		var configRecord = {
			items: jsonRecords,
			type : "attachment",
			count: jsonRecords.length
		};

		var component = Zarafa.core.data.SharedComponentType['common.dialog.attachments.savetofiles'];
		Zarafa.core.data.UIFactory.openLayerComponent(component, configRecord, {
			modal : true
		});
	},

	/**
	 * This method hooks to the email context menu and allows users to store emails from
	 * to the  Files plugin.
	 *
	 * @param include
	 * @param btn
	 * @returns {Object}
	 */
	createEmailUploadInsertionPoint: function (include, btn)
	{
		return {
			text : dgettext('plugin_files', 'Add to Files'),
			handler: this.showFilesUploadEmailDialog,
			scope : btn,
			iconCls: 'icon_files_category',
			disabled: !this.isAccountsConfigured()
		};
	},

	/**
	 * This method will open the {@link Zarafa.plugins.files.ui.dialogs.SaveToFilesContentPanel folder chooser panel}.
	 */
	showFilesUploadEmailDialog: function ()
	{
		var records = this.records;
		if (!Array.isArray(records)) {
			records = [records];
		}

		var jsonRecords = [];
		for (var i = 0, len = records.length; i < len; i++) {
			jsonRecords[i] = {
				store   : records[i].get('store_entryid'),
				entryid : records[i].get('entryid'),
				filename: Ext.isEmpty(records[i].get('subject') ? dgettext('plugin_files', 'Untitled') : records[i].get('subject')) + ".eml"
			};
		}

		var configRecord = {
			items: jsonRecords,
			type : "mail",
			count: jsonRecords.length
		};

		var component = Zarafa.core.data.SharedComponentType['common.dialog.attachments.savetofiles'];
		Zarafa.core.data.UIFactory.openLayerComponent(component, configRecord, {
			modal  : true
		});
	},

	/**
	 * This method registers the Files module names to the main WebApp.
	 */
	registerModules: function () {
		Zarafa.core.ModuleNames['IPM.FILESACCOUNT'] = {
			list: 'filesaccountmodule',
			item: 'filesaccountmodule'
		}
	},

	/**
	 * Bid for the type of shared component and the given record.
	 *
	 * @param {Zarafa.core.data.SharedComponentType} type Type of component a context can bid for.
	 * @param {Ext.data.Record} record Optionally passed record.
	 * @returns {Number}
	 */
	bidSharedComponent: function (type, record) {
		var bid = -1;
		switch (type) {
			case Zarafa.core.data.SharedComponentType['filesplugin.accountedit']:
			case Zarafa.core.data.SharedComponentType['filesplugin.featurequotainfo']:
			case Zarafa.core.data.SharedComponentType['filesplugin.featureversioninfo']:
			case Zarafa.core.data.SharedComponentType['common.dialog.attachments.savetofiles']:
				bid = 1;
				break;
			case Zarafa.core.data.SharedComponentType['common.dialog.attachments.files']:
				if (record instanceof Zarafa.core.data.IPMRecord) {
					if (record.supportsAttachments()) {
						bid = 1;
					}
				}
				break;
		}
		return bid;
	},

	/**
	 * Will return the reference to the shared component.
	 * Based on the type of component requested a component is returned.
	 *
	 * @param {Zarafa.core.data.SharedComponentType} type Type of component a context can bid for.
	 * @param {Ext.data.Record} record Optionally passed record.
	 * @return {Ext.Component} Component
	 */
	getSharedComponent: function (type, record) {
		var component;
		switch (type) {
			case Zarafa.core.data.SharedComponentType['filesplugin.accountedit']:
				component = Zarafa.plugins.files.settings.ui.AccountEditContentPanel;
				break;
			case Zarafa.core.data.SharedComponentType['filesplugin.featurequotainfo']:
				component = Zarafa.plugins.files.settings.ui.FeatureQuotaInfoContentPanel;
				break;
			case Zarafa.core.data.SharedComponentType['filesplugin.featureversioninfo']:
				component = Zarafa.plugins.files.settings.ui.FeatureVersionInfoContentPanel;
				break;
			case Zarafa.core.data.SharedComponentType['common.dialog.attachments.files']:
				component = Zarafa.plugins.files.ui.dialogs.AttachFromFilesContentPanel;
				break;
			case Zarafa.core.data.SharedComponentType['common.dialog.attachments.savetofiles']:
				component = Zarafa.plugins.files.ui.dialogs.SaveToFilesContentPanel;
				break;
		}

		return component;
	},

	/**
	 * Helper function which will return false if no account is configured, True otherwise.
	 * @returns {boolean} True if accounts configured, false otherwise.
	 */
	isAccountsConfigured: function ()
	{
		var fileContext = container.getContextByName('filescontext');
		var accountStore = fileContext.getAccountsStore();
		var foundActiveStore =  accountStore.findBy(function (item) {
			if (item.get("status") === Zarafa.plugins.files.data.AccountRecordStatus.OK) {
				return true;
			}
		});
		return foundActiveStore !== -1;
	}
});

/**
 * This code gets executed after the WebApp has loaded.
 * It hooks the plugin to the WebApp.
 */
Zarafa.onReady(function () {
	container.registerPlugin(new Zarafa.core.PluginMetaData({
		name             : 'files',
		displayName      : dgettext('plugin_files', 'Files Plugin'),
		about            : Zarafa.plugins.files.ABOUT,
		allowUserDisable : true,
		pluginConstructor: Zarafa.plugins.files.FilesPlugin
	}));
});
