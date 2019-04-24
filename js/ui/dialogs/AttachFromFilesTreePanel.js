Ext.namespace('Zarafa.plugins.files.ui.dialogs');

/**
 * @class Zarafa.plugins.files.ui.dialogs.AttachFromFilesTreePanel
 * @extends Ext.tree.TreePanel
 * @xtype filesplugin.attachfromfilestreepanel
 *
 * This dialog panel will provide the filechooser tree.
 */
Zarafa.plugins.files.ui.dialogs.AttachFromFilesTreePanel = Ext.extend(Ext.tree.TreePanel, {

	/**
	 * @var {Zarafa.core.data.IPMRecord} emailRecord
	 */
	emailRecord: undefined,

	/**
	 * @cfg {Object} treeSorter a {@link Ext.Ext.tree.TreeSorter} config or {@link Boolean}
	 * to sort the {@link Zarafa.plugins.files.ui.dialogs.AttachFromFilesTreePanel Tree}
	 * Defaults to <code>true</code>.
	 */
	treeSorter : true,

	/**
	 * @constructor
	 * @param config
	 */
	constructor: function (config) {
		config = config || {};

		if (Ext.isDefined(config.emailrecord)) {
			this.emailRecord = config.emailrecord;
		}

		Ext.applyIf(config, {
			root        : {
				nodeType: 'async',
				text    : 'Files',
				id      : '#R#',
				expanded: true,
				cc      : false
			},
			rootVisible : false,
			autoScroll  : true,
			viewConfig  : {
				style: {overflow: 'auto', overflowX: 'hidden'}
			},
			listeners   : {
				expandnode: this.onExpandNode
			},
			maskDisabled: true,
			loader      : new Zarafa.plugins.files.data.NavigatorTreeLoader({loadfiles: true}),
			buttons     : [
				this.createActionButtons()
			]
		});
		Zarafa.plugins.files.ui.dialogs.AttachFromFilesTreePanel.superclass.constructor.call(this, config);

		if (this.treeSorter && !(this.treeSorter instanceof Ext.tree.TreeSorter)) {
			this.treeSorter = new Zarafa.plugins.files.ui.TreeSorter(this, Ext.apply({}, this.treeSorter));
		}
	},

	/**
	 * The {@link Ext.tree.TreePanel#expandnode} event handler. It will silently load the children of the node.
	 * This is used to check if a node can be expanded or not.
	 *
	 * @param {Ext.tree.AsyncTreeNode} node
	 */
	onExpandNode: function (node) {
		node.attributes["cc"] = true;
		node.eachChild(function (child) {
			if (child.attributes["cc"] !== true) { // only check if it was not checked before
				child.attributes["cc"] = true;
				child.quietLoad();
			}
		});
	},

	/**
	 * Genereate the toolbar buttons.
	 *
	 * @returns {Object}
	 */
	createActionButtons: function () {
		return [{
			xtype  : 'button',
			text   : dgettext('plugin_files', 'Add attachment'),
			handler: this.downloadSelectedFilesFromFilesToTmp,
			scope  : this
		},{
			xtype  : 'button',
			text   : dgettext('plugin_files', 'Cancel'),
			handler: this.onCancel,
			scope  : this
		}];
	},

	/**
	 * Event handler which is triggered when the user presses the cancel
	 * {@link Ext.Button button}. This will close this dialog.
	 * @private
	 */
	onCancel : function()
	{
		this.dialog.close();
	},

	/**
	 * Start to download the files to a temporary folder on the backend.
	 */
	downloadSelectedFilesFromFilesToTmp: function () {
		var selectedNodes = this.getChecked();
		var idsList = [];
		var emailRecord = this.dialog.record;

		if (Ext.isDefined(this.emailRecord)) {
			emailRecord = this.emailRecord;
		}

		var attachmentStore = emailRecord.getAttachmentStore();
		var server = container.getServerConfig();
		var max_attachment_size = server.getMaxAttachmentSize();
		var size_exceeded = false;

		Ext.each(selectedNodes, function (node, index) {
			if (node.attributes.filesize > max_attachment_size) {
				Zarafa.common.dialogs.MessageBox.show({
					title  : dgettext('plugin_files', 'Warning'),
					msg    : String.format(dgettext('plugin_files', 'The file {0} is too large!'), node.attributes.filename) + ' (' + dgettext('plugin_files', 'max') + ': ' + Ext.util.Format.fileSize(max_attachment_size) + ')',
					icon   : Zarafa.common.dialogs.MessageBox.WARNING,
					buttons: Zarafa.common.dialogs.MessageBox.OK
				});
				size_exceeded = true;
				return false;
			}
			idsList.push(node.id);
		});

		if (!size_exceeded) {
			if (idsList.length < 1) {
				Ext.MessageBox.show({
					title  : dgettext('plugin_files', 'Warning'),
					msg    : dgettext('plugin_files', 'You have to choose at least one file!'),
					icon   : Zarafa.common.dialogs.MessageBox.WARNING,
					buttons: Zarafa.common.dialogs.MessageBox.OK
				});
			} else {
				try {
					this.disable();
					container.getRequest().singleRequest(
						'filesbrowsermodule',
						'downloadtotmp',
						{
							ids               : idsList,
							dialog_attachments: attachmentStore.getId()
						},
						new Zarafa.core.data.AbstractResponseHandler({
							doDownloadtotmp: this.addDownloadedFilesAsAttachmentToEmail.createDelegate(this)
						})
					);
				} catch (e) {
					Zarafa.common.dialogs.MessageBox.show({
						title  : dgettext('plugin_files', 'Warning'),
						msg    : e.getMessage(),
						icon   : Zarafa.common.dialogs.MessageBox.WARNING,
						buttons: Zarafa.common.dialogs.MessageBox.OK
					});
				}
			}
		}
	},

	/**
	 * Convert the serverresponse to {@link Ext.data.Record}.
	 *
	 * @param {Object} downloadedFileInfo
	 * @returns {Ext.data.Record}
	 */
	convertDownloadedFileInfoToAttachmentRecord: function (downloadedFileInfo) {
		var attachmentRecord = Zarafa.core.data.RecordFactory.createRecordObjectByObjectType(Zarafa.core.mapi.ObjectType.MAPI_ATTACH);

		attachmentRecord.set('tmpname', downloadedFileInfo.tmpname);
		attachmentRecord.set('name', downloadedFileInfo.name);
		attachmentRecord.set('size', downloadedFileInfo.size);
		attachmentRecord.set('attach_id', downloadedFileInfo.attach_id);
		return attachmentRecord;
	},

	/**
	 * Add the attachment records to the email.
	 *
	 * @param downloadedFilesInfoArray
	 */
	addDownloadedFilesAsAttachmentToEmail: function (downloadedFilesInfo) {
		var downloadedFilesInfoArray = downloadedFilesInfo.items;
		var emailRecord = this.dialog.record;
		if (Ext.isDefined(this.emailRecord)) {
			emailRecord = this.emailRecord;
		}
		var attachmentStore = emailRecord.getAttachmentStore();

		Ext.each(downloadedFilesInfoArray, function (downloadedFileInfo) {
			var attachmentRecord = this.convertDownloadedFileInfoToAttachmentRecord(downloadedFileInfo);
			attachmentStore.add(attachmentRecord);
		}, this);
		this.dialog.close();
	}
});

Ext.reg('filesplugin.attachfromfilestreepanel', Zarafa.plugins.files.ui.dialogs.AttachFromFilesTreePanel);
