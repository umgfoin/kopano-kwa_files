Ext.namespace('Zarafa.plugins.files.ui.dialogs');

/**
 * @class Zarafa.plugins.files.ui.dialogs.FilesUploadContentPanel
 * @extends Zarafa.core.ui.ContentPanel
 * @xtype filesplugin.filesuploadcontentpanel
 *
 * This class displays the main upload dialog if a users click on the + sign in the tabbar. It will
 * show a simple folder selector tree and a file upload field.
 */
Zarafa.plugins.files.ui.dialogs.FilesUploadContentPanel = Ext.extend(Zarafa.core.ui.ContentPanel, {

	/**
	 * @var string The selected destination path
	 */
	targetFolder: undefined,

	/**
	 * @constructor
	 * @param config
	 */
	constructor: function (config) {
		config = config || {};

		Ext.applyIf(config, {

			xtype: 'filesplugin.filesuploadcontentpanel',

			layout: 'fit',
			title : dgettext('plugin_files', 'Upload file'),
			items : [{
				xtype     : 'form',
				ref       : 'mainuploadform',
				layout    : {
					type : 'vbox',
					align: 'stretch',
					pack : 'start'
				},
				fileUpload: true,
				padding   : 5,
				items     : [
					this.createFolderSelector(),
					this.createUploadField()
				],
				buttons   : this.createActionButtons()
			}]
		});

		Zarafa.plugins.files.ui.dialogs.FilesUploadContentPanel.superclass.constructor.call(this, config);
	},

	/**
	 * Generates and returns the upload field UI.
	 *
	 * @returns {Object}
	 * @private
	 */
	createUploadField: function () {
		return {
			xtype : 'panel',
			title : dgettext('plugin_files', 'Select a file') + ' (' + dgettext('plugin_files', 'Maximum upload size') + ': ' + Zarafa.plugins.files.data.Utils.Format.fileSize(Zarafa.plugins.files.data.Utils.Core.getMaxUploadFilesize()) + '):',
			layout: 'fit',
			padding: 10,
			items : [{
				xtype     : 'filesplugin.multiplefileuploadfield',
				buttonText: _('Browse') + '...',
				name      : 'attachments[]',
				disabled  : true,
				listeners : {
					'fileselected': this.onUploadFieldChanged,
					'scope'       : this
				},
				ref       : '../../mainuploadfield'
			}]
		};
	},

	/**
	 * Generates and returns the folder selector treepanel UI.
	 *
	 * @returns {Object}
	 * @private
	 */
	createFolderSelector: function () {
		return {
			xtype       : 'treepanel',
			anchor      : '0, 0',
			flex        : 1,
			title       : dgettext('plugin_files', 'Select upload folder') + ':',
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
			maskDisabled: true,
			listeners   : {
				click     : this.onFolderSelected,
				expandnode: this.onExpandNode,
				scope     : this
			},
			loader      : new Zarafa.plugins.files.data.NavigatorTreeLoader({loadfiles: false})
		};
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
	 * Generates and returns the buttons for the dialog.
	 *
	 * @returns {*[]}
	 */
	createActionButtons: function () {
		return [{
			xtype   : 'button',
			ref     : '../../mainuploadbutton',
			disabled: true,
			text    : '&nbsp;&nbsp;' + dgettext('plugin_files', 'Upload'),
			tooltip : {
				title: dgettext('plugin_files', 'Store selected file'),
				text : dgettext('plugin_files', 'Upload file to the selected folder')
			},
			iconCls : 'icon_files',
			handler : this.doUpload,
			scope   : this
		},
			{
				xtype  : 'button',
				text   : dgettext('plugin_files', 'Cancel'),
				tooltip: {
					title: dgettext('plugin_files', 'Cancel'),
					text : dgettext('plugin_files', 'Close this window')
				},
				handler: this.onClose,
				scope  : this
			}];
	},

	/**
	 * Eventhandler for the onClick event of the treepanel.
	 * The selected folderpath will be stored to this.targetFolder.
	 *
	 * @param folder
	 */
	onFolderSelected: function (folder) {
		this.targetFolder = folder.attributes.id;
		folder.ownerTree.dialog.mainuploadfield.enable();
	},

	/**
	 * Eventhandler for the fileselected event of the filefield.
	 * This function will check the filesize if the browser supports the file API.
	 *
	 * @param field
	 * @param newValue
	 * @param oldValue
	 */
	onUploadFieldChanged: function (field, newValue, oldValue) {
		if (!Ext.isEmpty(newValue)) {
			var form = field.ownerCt.ownerCt.getForm();

			var files;
			files = this.mainuploadfield.fileInput.dom.files;

			var filesTooLarge = false;
			Ext.each(files, function (file) {
				if (file.size > Zarafa.plugins.files.data.Utils.Core.getMaxUploadFilesize()) {

					this.mainuploadfield.reset();

					Zarafa.common.dialogs.MessageBox.show({
						title  : dgettext('plugin_files', 'Error'),
						msg    : String.format(dgettext('plugin_files', 'File "{0}" is too large! Maximum allowed filesize: {1}.'), file.name, Zarafa.plugins.files.data.Utils.Format.fileSize(Zarafa.plugins.files.data.Utils.Core.getMaxUploadFilesize())),
						icon   : Zarafa.common.dialogs.MessageBox.ERROR,
						buttons: Zarafa.common.dialogs.MessageBox.OK
					});

					this.mainuploadbutton.setDisabled(true);
					filesTooLarge = true;
					return false;
				} else {
					if (!filesTooLarge) {
						this.mainuploadbutton.setDisabled(false);
					}
				}
			}, this);

		} else {
			this.mainuploadbutton.setDisabled(true);
		}
	},

	/**
	 * Eventhandler that will start the upload process.
	 */
	doUpload: function () {
		var form = this.mainuploadfield.ownerCt.ownerCt.getForm();
		var files = this.mainuploadfield.fileInput.dom.files;

		Zarafa.plugins.files.data.Actions.uploadAsyncItems(files, this.targetFolder);
		this.onClose();
	},

	/**
	 * This function will close the dialog.
	 */
	onClose: function () {
		this.close();
	}
});

Ext.reg('filesplugin.filesuploadcontentpanel', Zarafa.plugins.files.ui.dialogs.FilesUploadContentPanel);
