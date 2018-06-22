Ext.namespace('Zarafa.plugins.files.ui.dialogs');

/**
 * @class Zarafa.plugins.files.ui.dialogs.SaveToFilesTreePanel
 * @extends Ext.tree.TreePanel
 * @xtype filesplugin.savetofilestreepanel
 *
 * This dialog panel will provide the filechooser tree for the destination folder selection.
 */
Zarafa.plugins.files.ui.dialogs.SaveToFilesTreePanel = Ext.extend(Ext.tree.TreePanel, {

	/**
	 * @var {String} selectedFolder The folderID of the selected folder
	 */
	selectedFolder: null,

	/**
	 * @var {Object} response holds the response data from the attachment preparation event
	 */
	response: null,

	/**
	 * @constructor
	 * @param config
	 */
	constructor: function (config) {
		config = config || {};
		this.response = config.response;

		Ext.applyIf(config, {
			pathSeparator : '&',
			root        : {
				nodeType: 'async',
				text    : 'Files',
				id      : '#R#',
				expanded: true,
				cc      : false,
				listeners   : {
					load: this.onAfterRootLoad,
					scope: this
				}
			},
			rootVisible : false,
			autoScroll  : true,
			viewConfig  : {
				style: {overflow: 'auto', overflowX: 'hidden'}
			},
			maskDisabled: true,
			listeners   : {
				click     : this.onTreeNodeClick,
				expandnode: this.onExpandNode,
				scope     : this
			},
			loader      : new Zarafa.plugins.files.data.NavigatorTreeLoader({loadfiles: false}),
			buttons     : [
				this.createActionButtons()
			]
		});
		Zarafa.plugins.files.ui.dialogs.SaveToFilesTreePanel.superclass.constructor.call(this, config);
	},

	/**
	 * Eventhandler for the load event of the root node.
	 * This will be used to expand the path to the previous openend folder.
	 */
	onAfterRootLoad: function() {
		if(Ext.isDefined(Zarafa.plugins.files.current_tree_path)) {
			this.selectedFolder = Zarafa.plugins.files.current_tree_path;
			this.expandPathById(Zarafa.plugins.files.current_tree_path);
		}
	},

	/**
	 * This functions expands the tree until the given id has been reached.
	 * It will automatically load all subnodes if they where not loaded yet.
	 *
	 * @param id
	 * @returns {boolean}
	 */
	expandPathById : function(id) {
		// Take the node id passed in, make a path from the data in the store, then expand that path
		// See if the node is already rendered. If so, just expand it
		var node = this.getNodeById(id);
		var path = '';
		var me = this;

		if (node) {
			path = node.getPath();
			this.expandPath(path, 'id', function(bSuccess, oLastNode) {
				if (bSuccess && me.getNodeById(id)) {
					me.getNodeById(id).ensureVisible(); // scroll to node
					me.getNodeById(id).select(); // select node
				}
			});
			return true;
		} else {
			// The node with that id isnt rendered yet. We need to parse our path:
			// The path will look like this: &part1&part2&part3&part4.....
			// & is the pathSeparator of the treepanel.
			// So a example path will look like this:
			// &#R#&#R#accountid/&#R#accountid/test
			path = '';
			var pathParts = id.replace(/\/+$/,'').split('/'); // split the nodeid

			Ext.each(pathParts, function(pathPart, index) {
				var newpath = this.pathSeparator;
				for(var i=0; i <= index; i++) {
					newpath += pathParts[i] + '/';
				}

				path += newpath;
			}, this);

			path = this.pathSeparator + "#R#" + path; // add root path

			if (path != '') {
				// Expand that path
				this.expandPath(path, 'id', function(bSuccess, oLastNode) {
					if (bSuccess && me.getNodeById(id)) {
						me.getNodeById(id).ensureVisible(); // scroll to node
						me.getNodeById(id).select(); // select node
					}
				});
				return true;
			} else {
				// Couldnt make a path so return false
				return false;
			}
		}
	},

	/**
	 * The {@link Ext.tree.TreePanel#expandnode} event handler. It will silently load the children of the node.
	 * This is used to check if a node can be expanded or not.
	 *
	 * @param {Ext.tree.AsyncTreeNode} node
	 * @returns {*}
	 */
	onExpandNode: function (node) {
		if(node.attributes["cc"] !== true) {
			node.attributes["cc"] = true;
			node.eachChild(function (child) {
				if (child.attributes["cc"] !== true) { // only check if it was not checked before
					child.attributes["cc"] = true;
					child.quietLoad();
				}
			});
		}
	},

	/**
	 * The {@link Ext.tree.TreePanel#click} event handler. This will set the selectedFolder attribute.
	 *
	 * @param record
	 */
	onTreeNodeClick: function (record) {
		this.selectedFolder = record.attributes.id;

		// save the current path to a global place.
		Zarafa.plugins.files.current_tree_path = this.selectedFolder;
	},

	/**
	 * Generate the toolbar action buttons.
	 *
	 * @returns {Array}
	 */
	createActionButtons: function () {
		return [{
			xtype: 'button',
			text: dgettext('plugin_files', 'New folder'),
			tooltip: {
				title: dgettext('plugin_files', 'New folder'),
				text: dgettext('plugin_files', 'Create a new folder')
			},
			cls: 'zarafa-normal',
			handler: this.newFolder,
			scope: this
		}, {
			xtype: 'button',
			text: dgettext('plugin_files', 'Save'),
			tooltip: {
				title: dgettext('plugin_files', 'Store attachment'),
				text: dgettext('plugin_files', 'Store attachment to the selected Files folder.')
			},
			cls: 'zarafa-action',
			iconCls: 'icon_files_category_white',
			handler: this.uploadFile,
			scope: this
		}];
	},

	/**
	 * This will check if the file already exists on the backend.
	 *
	 * @returns {boolean}
	 */
	uploadFile: function () {
		if (!Ext.isDefined(this.selectedFolder) || Ext.isEmpty(this.selectedFolder)) {
			Zarafa.plugins.files.data.Actions.msgWarning(dgettext('plugin_files', 'You have to choose a folder!'));
		} else {
			// create array to check for dups
			var checkMe = new Array();
			for (var i = 0, len = this.response.count; i < len; i++) {
				checkMe[i] = {
					id      : (this.selectedFolder + this.response.items[i].filename),
					isFolder: false
				};
			}

			try {
				container.getRequest().singleRequest(
					'filesbrowsermodule',
					'checkifexists',
					{
						records: checkMe,
						destination: this.selectedFolder
					},
					new Zarafa.core.data.AbstractResponseHandler({
						doCheckifexists: this.checkForDuplicateFileDone.createDelegate(this)
					})
				);
			} catch (e) {
				Zarafa.plugins.files.data.Actions.msgWarning(e.message);

				return false;
			}
		}
	},

	/**
	 * This function will prompt the user for a new folder name.
	 */
	newFolder: function () {
		if (!Ext.isDefined(this.selectedFolder) || Ext.isEmpty(this.selectedFolder)) {
			Zarafa.plugins.files.data.Actions.msgWarning(dgettext('plugin_files', 'You have to choose a folder!'));
		} else {
			Zarafa.common.dialogs.MessageBox.prompt(dgettext('plugin_files', 'Folder Name'), dgettext('plugin_files', 'Please enter a foldername'), this.checkForDuplicateFolder, this);
		}
	},

	/**
	 * This function will check if the folder already exists.
	 *
	 * @param button
	 * @param text
	 * @returns {boolean}
	 */
	checkForDuplicateFolder: function (button, text) {
		if (button === "ok") {

			if (!Zarafa.plugins.files.data.Utils.File.isValidFilename(text)) {
				Zarafa.plugins.files.data.Actions.msgWarning(dgettext('plugin_files', 'Incorrect foldername'));
			} else {
				try {
					container.getRequest().singleRequest(
						'filesbrowsermodule',
						'checkifexists',
						{
							records: [{id: (this.selectedFolder + text), isFolder: true}]
						},
						new Zarafa.core.data.AbstractResponseHandler({
							doCheckifexists: this.checkForDuplicateFolderDone.createDelegate(this, [text], true)
						})
					);
				} catch (e) {
					Zarafa.plugins.files.data.Actions.msgWarning(e.message);

					return false;
				}
			}
		}
	},

	/**
	 * This is the callback for the checkduplicate event. If the folder does not exist, it will be created.
	 * Otherwise a warning is shown to the user.
	 *
	 * @param response
	 * @param foldername
	 */
	checkForDuplicateFolderDone: function (response, foldername) {
		if (response.duplicate === false) {
			this.createRemoteFolder(foldername);
		} else {
			Zarafa.plugins.files.data.Actions.msgWarning(dgettext('plugin_files', 'Folder already exists'));
		}
	},

	/**
	 * Callback for the checkduplicate event. If the file does not yet exist it will be uploaded to the server.
	 * Otherwise a warning will be shown.
	 *
	 * @param response
	 */
	checkForDuplicateFileDone: function (response) {
		if (response.duplicate === false) {
			this.doUpload();
		} else {
			Ext.MessageBox.confirm(
				dgettext('plugin_files', 'Confirm overwrite'),
				dgettext('plugin_files', 'File already exists. Do you want to overwrite it?'),
				this.doUpload,
				this
			);
		}
	},

	/**
	 * This function uploads the file to the server.
	 *
	 * @param button
	 */
	doUpload: function (button) {
		if (!Ext.isDefined(button) || button === "yes") {
			try {
				this.disable();
				container.getRequest().singleRequest(
					'filesbrowsermodule',
					'uploadtobackend',
					{
						items  : this.response.items,
						count  : this.response.count,
						type   : this.response.type,
						destdir: this.selectedFolder
					},
					new Zarafa.core.data.AbstractResponseHandler({
						doUploadtobackend: this.uploadDone.createDelegate(this)
					})
				);
			} catch (e) {
				Zarafa.plugins.files.data.Actions.msgWarning(e.message);
			}
		}
	},

	/**
	 * Called after the upload has completed.
	 * It will notify the user and close the upload dialog.
	 *
	 * @param response
	 */
	uploadDone: function (response) {
		if (response.status === true) {
			container.getNotifier().notify('info.files', dgettext('plugin_files', 'Uploaded'), dgettext('plugin_files', 'Attachment successfully stored in Files'));
		} else {
			container.getNotifier().notify('error', dgettext('plugin_files', 'Upload Failed'), dgettext('plugin_files', 'Attachment could not be stored in Files! Error: ' + response.status));
		}

		this.dialog.close();
	},

	/**
	 * This function will create a new folder on the server.
	 *
	 * @param foldername
	 */
	createRemoteFolder: function (foldername) {
		try {
			container.getRequest().singleRequest(
				'filesbrowsermodule',
				'createdir',
				{
					props   : {
						id: this.selectedFolder + foldername
					},
					entryid : this.selectedFolder + foldername,
					parentID: this.selectedFolder
				},
				new Zarafa.core.data.AbstractResponseHandler({
					doCreatedir: this.createDirDone.createDelegate(this)
				})
			);
		} catch (e) {
			Zarafa.plugins.files.data.Actions.msgWarning(e.message);
		}
	},

	/**
	 * Called after the folder has been created. It will reload the filetree.
	 *
	 * @param response
	 */
	createDirDone: function (response) {
		container.getNotifier().notify('info.files', dgettext('plugin_files', 'Created'), dgettext('plugin_files', 'Directory created!'));

		var parent = response.item[0].parent_entryid;
		var node = this.getNodeById(parent);

		if (Ext.isDefined(node)) {
			if (!node.isLeaf()) {
				node.reload();
			} else {
				var currentfolder = (parent.substr(-1) == '/') ? parent.substr(0, parent.length - 1) : parent;
				var parentnode = this.getNodeById(currentfolder.match(/.*\//));
				if (Ext.isDefined(parentnode)) {
					parentnode.on("expand", this.reloadParentDone.createDelegate(this, [parent]), this, {single: true});
					parentnode.reload();
				}
			}
		}
	},

	/**
	 * Callback for the expand event. It will expand the subnode.
	 *
	 * @param subnode
	 */
	reloadParentDone: function (subnode) {
		var node = this.getNodeById(subnode);

		if (Ext.isDefined(node)) {
			node.expand();
		}
	}
});

Ext.reg('filesplugin.savetofilestreepanel', Zarafa.plugins.files.ui.dialogs.SaveToFilesTreePanel);
