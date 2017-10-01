Ext.namespace('Zarafa.plugins.files.ui.dialogs');

/**
 * @class Zarafa.plugins.files.ui.dialogs.CreateFolderPanel
 * @extends Ext.Panel
 * @xtype filesplugin.createfolderpanel
 *
 * Panel for users to create folder record in differnt supported backends.
 */
Zarafa.plugins.files.ui.dialogs.CreateFolderPanel = Ext.extend(Ext.Panel, {

	/**
	 * selectedFolderId was contains the id of selected folder in
	 * {@link Zarafa.plugins.files.ui.Tree FolderTree}
	 * @property
	 */
	selectedFolderId : undefined,

	/**
	 * @constructor
	 * @param {Object} config Configuration structure
	 */
	constructor : function(config)
	{
		config = config || {};

		Ext.applyIf(config, {
			xtype : 'filesplugin.createfolderpanel',
			layout: {
				type: 'fit',
				align: 'stretch'
			},
			border: false,
			header: false,
			items: this.createPanel(config.accountFilter),
			buttonAlign: 'right',
			buttons: [{
				text: dgettext('plugin_files', 'Ok'),
				disabled: true,
				ref: '../okButton',
				cls: 'zarafa-action',
				handler : this.onOk,
				scope: this
			},{
				text: dgettext('plugin_files', 'Cancel'),
				disabled: true,
				ref: '../cancelButton',
				handler : this.onCancel,
				scope: this
			}]
		});

		Zarafa.plugins.files.ui.dialogs.CreateFolderPanel.superclass.constructor.call(this, config);
	},

	/**
	 * Creates body for {@link Zarafa.plugins.files.ui.dialogs.CreateFolderContentPanel CreateFolderContentPanel}
	 * @param {String} accountFilter which is used to load the selected account's {@link Zarafa.plugins.files.ui.Tree FolderTree}
	 * @return {Array} Array which contains configuration object for the tree panel.
	 * @private
	 */
	createPanel : function(accountFilter)
	{
		return [{
			xtype : 'panel',
			layout : 'form',
			border : false,
			defaults : {
				anchor :'100%'
			},
			labelAlign : 'top',
			items : [{
				xtype : 'textfield',
				fieldLabel : dgettext('plugin_files', 'Name'),
				cls: 'form-field-name',
				ref : '../newNameField'
			},{
				xtype : 'filesplugin.tree',
				bodyCssClass : 'files-create-folder-tree-panel',
				fieldLabel : dgettext('plugin_files', 'Select where to place the folder'),
				anchor : '100% 80%',
				forceLayout : true,
				ref : '../hierarchyTree',
				accountFilter : accountFilter
			}]
		}];
	},

	/**
	 * Function called by Extjs when the panel has been {@link #render rendered}.
	 * At this time all events can be registered.
	 * @private
	 */
	initEvents : function ()
	{
		Zarafa.plugins.files.ui.dialogs.CreateFolderPanel.superclass.initEvents.apply(this, arguments);
		this.mon(this.hierarchyTree, 'load', this.onTreeNodeLoad, this);
		this.mon(this.hierarchyTree.getSelectionModel(), 'selectionchange', this.onSelectionChange, this);
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
	 * Event handler which is triggered when the user presses the ok
	 * {@link Ext.Button button}. function is responsible to create folder
	 * under the respective folder as well as check for dublicate folder.
	 *
	 * @param {Ext.Button} button which triggeres this event.
	 * @param {Ext.EventObject} event The event object
	 */
	onOk : function (button, event)
	{
		this.okButton.disable();
		var folderName = this.newNameField.getValue();
		if (Ext.isEmpty(folderName.trim())) {
			Ext.MessageBox.show({
				title: dgettext('plugin_files', 'Kopano WebApp'),
				msg: dgettext('plugin_files', 'You must specify a name.'),
				buttons: Ext.MessageBox.OK,
				icon: Ext.MessageBox.INFO,
				fn : function (button) {
					this.okButton.enable();
				},
				scope : this
			});
			return;
		}
		this.doCheckFolderDuplicate(folderName);
	},

	/**
	 * Function is responsible for checking that folders dublicated in folder tree.
	 *
	 * @param {String} folderName name of folder which user trying
	 * to create in folder tree.
 	 */
	doCheckFolderDuplicate : function(folderName)
	{
		//FIXME : 1. Why we send the seaprate request to check folder is already exist in backend.
		// rather to do so we can also check folder exist or not while creating folder on server side by this way
		// we can reduce one request to server.
		// 2. there are many unnecessary action types are used e.g checkifexists, createdir etc which we can remove by
		// effective use of request params.
		container.getRequest().singleRequest(
			'filesbrowsermodule',
			'checkifexists',
			{
				records : [{
					id : this.selectedFolderId + folderName + '/',
					isFolder: true
				}],
				destination: this.selectedFolderId
			},
			new Zarafa.plugins.files.data.ResponseHandler({
				successCallback: this.checkForDuplicateDone.createDelegate(this, [folderName, this.selectedFolderId], true)
			})
		);
	},

	/**
	 * Callback function which show warning message if folder is already exists or
	 * folder name is incorrect else it will call {#doCreateFolder} function.
	 *
	 * @param {Object} response response object which received from server.
	 * @param {String} folderName Folder name which user trying
	 * to create in folder tree.
	 * @param {String} parentFolderId parent folder id under which user trying to create folder.
	 */
	checkForDuplicateDone : function(response, folderName, parentFolderId)
	{
		if (response.duplicate === true) {
			this.okButton.enable();
			Zarafa.plugins.files.data.Actions.msgWarning(dgettext('plugin_files', 'Folder already exists'));
		} else if (!Zarafa.plugins.files.data.Utils.File.isValidFilename(folderName)) {
			this.okButton.enable();
			Zarafa.plugins.files.data.Actions.msgWarning(dgettext('plugin_files', 'Incorrect foldername'));
		} else {
			this.doCreateFolder(folderName, parentFolderId);
		}
	},

	/**
	 * Function which responsible to create folder in selected folder tree.
	 *
	 * @param {String} folderName Folder name which user trying
	 * to create in folder tree.
	 * @param {String} parentFolderId parent folder id under
	 * which user trying to create folder.
	 */
	doCreateFolder : function(folderName, parentFolderId)
	{
		var d = new Date();
		var data = {
			"filename"    : folderName,
			"path"        : Zarafa.plugins.files.data.Utils.File.stripAccountId(parentFolderId).replace(/\/+$/, ''),
			"id"          : parentFolderId + folderName + "/",
			"message_size": -1,
			"lastmodified": d.toUTC().getTime(),
			"type"        : Zarafa.plugins.files.data.FileTypes.FOLDER
		};

		container.getRequest().singleRequest(
			'filesbrowsermodule',
			'createdir',
			{
				props: data
			},
			new Zarafa.plugins.files.data.ResponseHandler({
				successCallback:this.createFolderDone.createDelegate(this, [folderName, parentFolderId], true)
			})
		);
	},

	/**
	 * Callback function which called after the creating folder in respective folder tree.
	 * It will append the node in hierarchy tree and update the grid with newly added folder record.
	 *
	 * @param {Object} response response object which received from server.
	 * @param {String} folderName Folder name which user trying
	 * to create in folder tree.
	 * @param {String} parentFolderId parent folder id under which user trying to create folder.
	 */
	createFolderDone: function (response, folderName, parentFolderId)
	{
		if (!Ext.isDefined(response.item[0])) {
			Zarafa.plugins.files.data.Actions.msgWarning(dgettext('plugin_files', 'Folder could not be created!'));
			return false;
		}

		var props = response.item[0].props;

		var newFolder = {
			id          : props.id,
			text        : props.filename,
			filename    : props.filename,
			has_children: false,
			expanded    : true,
			iconCls     : 'icon_folder_note',
			loaded      : true,
			isFolder    : true
		};

		var d = new Date();
		var data = {
			"filename"     : folderName,
			"path"         : Zarafa.plugins.files.data.Utils.File.stripAccountId(parentFolderId).replace(/\/+$/, ''),
			"id"           : parentFolderId + folderName + "/",
			"virtualRecord": true, // this is important - otherwhise the backend will create another folder
			"message_size" : -1,
			"lastmodified" : d.toUTC().getTime(),
			"type"         : Zarafa.plugins.files.data.FileTypes.FOLDER
		};

		var accountID = Zarafa.plugins.files.data.Utils.File.getAccountId(props.id);
		var navpanel = Zarafa.plugins.files.data.ComponentBox.getNavigatorTreePanel(accountID);
		var currentNode = navpanel.getNodeById(parentFolderId);

		// create the folder in the navbar
		if (Ext.isDefined(currentNode) && currentNode.rendered) {
			currentNode.appendChild(newFolder);
		}

		// add the file to the grid
		if (Zarafa.plugins.files.data.ComponentBox.getStore().getPath() === parentFolderId) {
			var record = Zarafa.core.data.RecordFactory.createRecordObjectByCustomType(Zarafa.core.data.RecordCustomObjectType.ZARAFA_FILES, data);
			var store = Zarafa.plugins.files.data.ComponentBox.getStore();
			store.add(record);
			store.on("update", Zarafa.plugins.files.data.Actions.doRefreshIconView, Zarafa.plugins.files.data.Actions, {single: true});
			record.commit(true);
		}

		this.dialog.close();
	},

	/**
	 * Event handler which triggered when selection get change in hiererachy tree.
	 *
	 * @param {selectionModel} selectionModel The selectionModel for the treepanel
	 * @param {TreeNode} node The selected tree node
	 * @private
	 */
	onSelectionChange : function(selectionModel, node)
	{
		if (!Ext.isDefined(node)) {
			this.okButton.disable();
			this.cancelButton.disable();
		} else {
			this.okButton.enable();
			this.cancelButton.enable();
			this.selectedFolderId = node.id;
		}
	},

	/**
	 * Event handler triggered when hierarchy tree is loading. function will
	 * selecte the folder from {@link Zarafa.plugins.files.ui.Tree hierarchyTree}
	 * which was selected in {@link Zarafa.plugins.files.data.NavigatorTreeLoader NavigatorTreeLoader}.
	 * @param {TreeNode} node The selected tree node.
	 */
	onTreeNodeLoad : function(node)
	{
		node = this.getNodeFromPath(this.selectedFolderId);
		if (node.id === this.selectedFolderId) {
			this.hierarchyTree.selectNode(node);
			node.expand(false, true , function(){
				this.newNameField.focus(false, 50);
			}, this);
			this.mun(this.hierarchyTree, 'load', this.onTreeNodeLoad, this);
		} else {
			node.expand();
		}
	},


	/**
	 * Helper function which is used to get the rendered node from the hierarchy.
	 *
	 * @param {String} path indecate the selected folder in hierarchy.
	 * @return {TreeNode} node The selected tree node.
	 */
	getNodeFromPath : function (path)
	{
		var node = this.hierarchyTree.getNodeById(path);
		if (!Ext.isDefined(node)) {
			var splitedPathData = path.split('/');
			var slicedPathData = splitedPathData.slice(0,-2);
			var updatedPath = slicedPathData.join('/');
			node = this.getNodeFromPath(updatedPath+"/");
		}
		return node;
	}
});

Ext.reg('filesplugin.createfolderpanel', Zarafa.plugins.files.ui.dialogs.CreateFolderPanel);
