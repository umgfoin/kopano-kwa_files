Ext.namespace('Zarafa.plugins.files.ui');
/**
 * @class Zarafa.plugins.files.ui.FilesContextNavigationPanel
 * @extends Zarafa.core.ui.ContextNavigationPanel
 * @xtype filesplugin.filescontextnavigationpanel
 *
 * ContextNavigationPanel provides custom navigation options to context through {@link Zarafa.hierarchy.ui.HierarchyTreePanel}.
 */
Zarafa.plugins.files.ui.FilesContextNavigationPanel = Ext.extend(Zarafa.core.ui.ContextNavigationPanel, {
	/**
	 * For this Context this panel will be visible in the
	 * {@link Zarafa.core.ui.NavigationPanel NavigationPanel}.
	 * @cfg {Zarafa.core.Context} Related Context
	 */
	context: undefined,

	/**
	 * The {@link Zarafa.plugins.files.FilesContextModel} which is obtained from the {@link #context}.
	 * @property
	 * @type Zarafa.plugins.files.FilesContextModel
	 */
	model : undefined,

	/**
	 * @cfg {Zarafa.plugins.files.data.AccountStore} store contains all configured
	 * {@link Zarafa.plugins.files.data.AccountRecord AccountRecord}.
	 */
	store : undefined,

	/**
	 * @constructor
	 * @param {Object} config configuration object
	 */
	constructor : function (config)
	{
		config = config || {};

		Ext.applyIf(config,{
			xtype : 'filesplugin.filescontextnavigationpanel'
		});

		Zarafa.plugins.files.ui.FilesContextNavigationPanel.superclass.constructor.call(this, config);

		this.mon(this.store,'load', this.createAccountNavigationPanels, this,{single :true});
		this.mon(this.store, {
			write: this.manageAccountNavigationPanel,
			reorder : this.swapPanels,
			scope : this
		});
	},

	/**
	 * Create's {@link Zarafa.plugins.files.ui.NavigatorTreePanel NavigatorTreePanel} for
	 * each configured backends/accounts.
	 *
	 * @param {Zarafa.plugins.files.data.AccountStore} store The {@link Zarafa.plugins.files.data.AccountStore store} which
	 * fire this event.
	 * @param {Zarafa.plugins.files.data.AccountRecord} records The {@link Zarafa.plugins.files.data.AccountRecord record(s)} being loaded.
	 */
	createAccountNavigationPanels : function (store, records)
	{
		var items = [];
		var filesStore = this.context.getModel().getStore();
		records.forEach(function(account){
			if(account.get('status') === Zarafa.plugins.files.data.AccountRecordStatus.OK) {
				items.push({
					xtype : 'panel',
					autoHeight : true,
					cls : 'zarafa-files-hierarchypanel-subpanel',
					iconCls : 'icon_16_logo_' + account.get('backend'),
					title : dgettext('plugin_files', account.get('backend')),
					accId : account.get('id'),
					items : [{
						xtype : 'filesplugin.navigatortreepanel',
						accountFilter: account.get('id'),
						ref : '../filesNavigatorTreePanel_' + account.get('id'),
						filesStore : filesStore,
						listeners : {
							beforeclick : this.onBeforeClickNode,
							scope : this
						}
					}]
				});
			}
		}, this);

		if(Ext.isEmpty(items)) {
			return;
		}

		this.add(items);
		this.doLayout(false, true);
	},

	/**
	 * Initialize the event handlers
	 * @protected
	 */
	initEvents : function ()
	{
		Zarafa.plugins.files.ui.FilesContextNavigationPanel.superclass.initEvents.apply(this, arguments);
		this.model = this.context.getModel();
		this.mon(this.model.getStore(),{
			'load' : this.onLoadFilesStore,
			'write' : this.onWriteFilesStore,
			'remove' : this.onRemoveFilesStore,
			'update' : this.onUpdateFilesStore,
			'createfolder': this.onCreateFolder,
			scope : this
		});
	},

	/**
	 * Event handler triggered when account/backend was added in {@link Zarafa.plugins.files.data.AccountStore store}
	 * It will call {@link #createAccountNavigationPanels} if new account is configured successfully and if
	 * account is discarded/removed then it will remove that particular account
	 * related panel from context navigation panel.
	 *
	 * @param {Zarafa.plugins.files.data.AccountStore} store The store which is updated.
	 * @param {String} action [Ext.data.Api.actions.create|update|destroy]
	 * @param {Object} result The 'data' picked-out out of the response for convenience.
	 * @param {Ext.Direct.Transaction} res
	 * @param {Zarafa.core.data.IPMRecord[]} records Store's records, the subject(s) of the write-action
	 * @private
	 */
	manageAccountNavigationPanel : function (store, action, data, params, record)
	{
		if(action === 'create') {
			if (record.get('status') === Zarafa.plugins.files.data.AccountRecordStatus.OK) {
				this.createAccountNavigationPanels(record.getStore(), [record]);
			}
			return true;
		}

		var accountTreePanel = this.getTreePanelByAccountId(record.id);
		if (Ext.isDefined(accountTreePanel)) {
			var accountPanel = this.find('accId', record.id)[0];
			if(action === 'destroy' || record.get('status') === Zarafa.plugins.files.data.AccountRecordStatus.ERROR) {
				accountPanel.destroy();
				return true;
			}
			// update account root node:
			var accRoot = accountTreePanel.getRootNode().item(0);
			if(Ext.isDefined(accRoot)) {
				accRoot.setText(record.get('name'));
				accRoot.setIconCls("icon_16_" + record.get('backend'));
			}
			// update the surrounding container
			accountPanel.setTitle(record.get('backend'));
			accountPanel.setIconClass("icon_16_logo_" + record.get('backend'));
		} else if (action === 'update' && record.get('status') === Zarafa.plugins.files.data.AccountRecordStatus.OK) {
			// Recreate removed account tree panel
			this.createAccountNavigationPanels(record.getStore(), [record]);
		}
	},

	/**
	 * Swap two account panels.
	 *
	 * @param {Zarafa.plugins.files.data.AccountRecord} a The first account
	 * @param {Zarafa.plugins.files.data.AccountRecord} b The second account
	 */
	swapPanels: function(a, b)
	{
		//TODO: Very ugly code need to improve this.
		this.removeAll();
		this.createAccountNavigationPanels(this.store, this.store.getRange());
		this.doLayout();
	},

	/**
	 * Event handler triggered before the click event triggered on node which belongs to
	 * {@link Zarafa.plugins.files.ui.NavigatorTreePanel NavigatorTreePanel}.
	 *
	 * @param {Ext.tree.AsyncTreeNode} node The node which is click.
	 */
	onBeforeClickNode : function (node)
	{
		var selectedAccountId = node.getOwnerTree().accountFilter;
		var accounts = this.store.getRange().filter(function(account) {
			return account.get('entryid') !== selectedAccountId;
		});
		this.clearSelections(accounts);
	},

	/**
	 * Event handler clear the all selections from {@link Zarafa.plugins.files.ui.NavigatorTreePanel NavigatorTreePanel}.
	 *
	 * @param {Zarafa.plugins.files.data.AccountRecord} accounts The all configured accounts record.
	 */
	clearSelections : function(accounts)
	{
		if (Ext.isEmpty(accounts)) {
			return;
		}
		accounts.forEach(function(account){
			var treePanel = this.getTreePanelByAccountId(account.get('id'));
			if(treePanel) {
				treePanel.getSelectionModel().clearSelections();
			}
		}, this);
	},

	/**
	 * Event handler triggered when {@link Zarafa.plugins.files.data.FilesRecordStore FilesRecordStore} is load
	 * also it will select the specific node if user has selected. It will call {@link #clearSelections} to clear the
	 * selection when user has selected home button in {@link Zarafa.plugins.files.ui.snippets.FilesNavigationBar FilesNavigationBar}.
	 *
	 * @param {Zarafa.plugins.files.data.FilesRecordStore} store The {@link Zarafa.plugins.files.data.FilesRecordStore store} which loaded.
	 * @param {Zarafa.plugins.files.data.FilesRecord} records The records which loaded in store.
	 * @param {Object}  options options that are passed through {@link #load} event
	 */
	onLoadFilesStore : function (store, records, options)
	{
		var path = options.params.id;
		if (Ext.isEmpty(path) || path === "#R#" ) {
			this.clearSelections(this.store.getRange());
		} else {
			var accountId = Zarafa.plugins.files.data.Utils.File.getAccountId(path);
			var treePanel = this.getTreePanelByAccountId(accountId);
			var nodeToSelect = treePanel.getNodeById(path);
			if (Ext.isDefined(nodeToSelect)) {
				treePanel.selectNode(nodeToSelect);
			}
		}
	},

	/**
	 * Event handler triggers when folder is record is created.
	 *
	 * @param {Zarafa.plugins.files.data.FilesRecordStore} store The store which fires this event.
	 * @param {String} parentFolderId The parentFolderId under which folder was created.
	 * @param {Object} data The data contains the information about newly created folder.
	 */
	onCreateFolder : function(store, parentFolderId, data)
	{
		var accountId = Zarafa.plugins.files.data.Utils.File.getAccountId(store.getPath());
		var treePanel = this.getTreePanelByAccountId(accountId);
		var parentNode = treePanel.getNodeById(parentFolderId);
		if (Ext.isDefined(parentNode) && parentNode.rendered) {
			var newFolder = {
				id: data.id,
				text: data.filename,
				filename: data.filename,
				has_children: false,
				expanded: true,
				iconCls: 'icon_folder_note',
				loaded: true,
				isFolder: true
			};
			parentNode.appendChild(newFolder);
		}
	},

	/**
	 * Event handler triggered when {@link Zarafa.plugins.files.data.FilesRecordStore FilesRecordStore} gets updated.
	 * it will create the node in {@link Zarafa.plugins.files.ui.NavigatorTreePanel NavigatorTreePanel} if folder is created.
	 *
	 * @param {Zarafa.plugins.files.data.FilesRecordStore} store The {@link Zarafa.plugins.files.data.FilesRecordStore store} which loaded.
	 * @param {String} action [Ext.data.Api.actions.create|update|destroy]
	 * @param {Object} result The 'data' picked-out out of the response for convenience.
	 * @param {Ext.Direct.Transaction|Object} params The params contains either {@link Ext.Direct.Transaction} or params object.
	 * @param {Zarafa.plugins.files.data.FilesRecord} record Store's records, the subject(s) of the write-action
	 * @private
	 */
	onWriteFilesStore : function (store, action, data, params, record)
	{
		// FIXME: Register new event something like 'WriteRecord' and fire this event from here
		// so we can listen this event from other part of files plugin.
		// For rename node we manually fire this 'write' event, that will refactor
		// once we refactor singleRequest related stuff from files plugin.
		switch (action) {
			case 'rename':
				var treePanel = this.getTreePanelByAccountId(record.getAccount().id);
				var node = treePanel.getNodeById(params.oldId);
				if (Ext.isDefined(node)) {
					node.setId(params.id);
					node.setText(params.text);
					node.attributes.filename = params.text;
					treePanel.refreshNode(params.id);
				}
				break;
		}
	},

	/**
	 * Event handler triggered when record was removed from
	 * {@link Zarafa.plugins.files.data.FilesRecordStore FilesRecordStore}. It was
	 * also remove that deleted folder node from {@link Zarafa.plugins.files.ui.NavigatorTreePanel NavigatorTreePanel}.
	 *
	 * @param {Zarafa.plugins.files.data.FilesRecordStore} store
	 * @param {Zarafa.plugins.files.data.FilesRecord} record The record which was deleted.
	 */
	onRemoveFilesStore : function (store, record)
	{
		var treePanel = this.getTreePanelByAccountId(record.getAccount().id);
		var node = treePanel.getNodeById(record.get('id'));
		if (Ext.isDefined(node)) {
			node.remove(true);
		}
	},

	/**
	 * Function which is used to get {@link Zarafa.plugins.files.ui.NavigatorTreePanel NavigatorTreePanel}
	 *
	 * @param {String} accountId The accountId which used to get the
	 * respective {@link Zarafa.plugins.files.ui.NavigatorTreePanel NavigatorTreePanel}
	 * @return {Object} return {@link Zarafa.plugins.files.ui.NavigatorTreePanel NavigatorTreePanel} object
	 */
	getTreePanelByAccountId : function (accountId)
	{
		return this['filesNavigatorTreePanel_'+accountId];
	},

	/**
	 * Event handler which triggered when {@link Zarafa.plugins.files.data.FilesRecordStore FilesRecordStore}
	 * was updated. It also update the {@link Zarafa.plugins.files.ui.NavigatorTreePanel NavigatorTreePanel}
	 * when folder moving from one destination to another.
	 *
	 * @param {Zarafa.plugins.files.data.FilesRecordStore} store The store which fire the update event.
	 * @param {Zarafa.plugins.files.data.FilesRecord} record The record which was moved.
	 * @param {string} action The action which performed by the store.
	 */
	onUpdateFilesStore : function (store, record, action)
	{
		// Fixme : As of now code is at wrong place in future
		// we can move this code to somewhere in tree navigation panel.
		if(action !== Ext.data.Record.COMMIT || !record.isFolder() || !record.hasMessageAction('action_type')) {
			return;
		}

		var msgActions = record.getMessageActions();
		if(msgActions['action_type'] !== 'move') {
			return;
		}

		var treePanel = this.getTreePanelByAccountId(record.getAccount().id);
		var node = treePanel.getNodeById(record.id);
		if(!Ext.isDefined(node)) {
			return;
		}
		node.remove();
		var destinationNode = treePanel.getNodeById(msgActions['destination_parent_entryid']);

		if (Ext.isDefined(destinationNode)) {
			var has_children = node.childNodes.length > 0;
			destinationNode.appendChild({
				id : destinationNode.attributes.id + node.text + '/',
				text : node.text,
				isFolder : true,
				has_children: has_children,
				expanded : !has_children,
				loaded : false,
				iconCls : 'icon_folder_note',
				filename : node.text,
				leaf : false
			});
		}
	}
});

Ext.reg('filesplugin.filescontextnavigationpanel', Zarafa.plugins.files.ui.FilesContextNavigationPanel);

