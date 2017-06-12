Ext.namespace('Zarafa.plugins.files.ui');

/**
 * @class Zarafa.plugins.files.ui.FilesContextNavigatorBuilder
 * @singleton
 *
 * This class provides static helper functions for the hierarchy tree panels.
 */
Zarafa.plugins.files.ui.FilesContextNavigatorBuilder =  {
	/**
	 * Returns the main navigation panel for the files context.
	 *
	 * @param context
	 * @returns {Object}
	 */
	getNavigatorTreePanelContainer: function(context) {
		var accStore = Zarafa.plugins.files.data.singleton.AccountStore.getStore();

		// load is called when the store was initialized
		accStore.on('load', this.addInitialPanels, this, {single: true});

		return {
			xtype  : 'zarafa.contextnavigation',
			context: context,
			bodyCssClass : "files_navbar_panel",
			items  : [],
			listeners: {
				'afterrender': function() {
					Zarafa.plugins.files.data.singleton.AccountStore.getStore().load();
				}
			}
		};
	},

	/**
	 * This function is called after the account store has loaded its data.
	 * It will add a new hierarchy tree panel for each active account.
	 *
	 * @param store
	 * @param records
	 * @param options
	 * @private
	 */
	addInitialPanels: function(store, records, options) {
		var navPanel = Zarafa.plugins.files.data.ComponentBox.getNavigatorPanel().centerPanel;
		var context = Zarafa.plugins.files.data.ComponentBox.getContext();

		var filesNavPanel = navPanel.find('plugin', context);
		if(filesNavPanel[0].rendered) {
			store.each(function (account, index) {
				if (account.get('status') === Zarafa.plugins.files.data.AccountRecordStatus.OK) {
					filesNavPanel[0].add({
						xtype : 'panel',
						autoHeight : true,
						cls : 'zarafa-files-hierarchypanel-subpanel',
						iconCls: 'icon_16_logo_' + account.get('backend'),
						title  : dgettext('plugin_files', account.get('backend')),
						accId  : account.get('id'),
						items  : [{
							xtype        : 'filesplugin.navigatortreepanel',
							accountFilter: account.get('id'),
							ref          : '../../../filesNavigatorTreePanel_' + account.get('id')
						}]
					});
				}
			});

			filesNavPanel[0].doLayout();
		} else {
			// wait for the navpanel to render
			filesNavPanel[0].on('afterrender', this.addInitialPanels.createDelegate(this,[store, records, options]), null, {single: true})
		}
	},

	/**
	 * Removes the selection from all visible panels.
	 */
	unselectAllNavPanels: function() {
		var accStore = Zarafa.plugins.files.data.singleton.AccountStore.getStore();

		accStore.each(function(account,index){
			if(account.get('status') === Zarafa.plugins.files.data.AccountRecordStatus.OK) {
				var navPanel = Zarafa.plugins.files.data.ComponentBox.getNavigatorTreePanel(account.get('id'));
				if(navPanel) {
					navPanel.getSelectionModel().clearSelections();
				}
			}
		});
	},

	/**
	 * This function must be called! It sets up the eventlisteners for the account store to
	 * process update and remove events.
	 */
	setUpListeners: function() {
		var accStore = Zarafa.plugins.files.data.singleton.AccountStore.getStore();

		// we need to listen to the add event to create a new panel
		accStore.on('update', this.addNavigatorPanel);

		// remove deleted accounts from the panel
		accStore.on('remove', this.removeNavigatorPanel);

		// reorder account panels
		accStore.on('reorder', this.swapPanels, this);
	},

	/**
	 * Swap two account panels.
	 *
	 * @param {Zarafa.plugins.files.data.AccountRecord} a The first account
	 * @param {Zarafa.plugins.files.data.AccountRecord} b The second account
	 * TODO: maybe improve this - do not rebuild the whole navigation tree.
	 */
	swapPanels: function(a, b) {
		var context = Zarafa.plugins.files.data.ComponentBox.getContext();
		var navPanel = Zarafa.plugins.files.data.ComponentBox.getNavigatorPanel().centerPanel;
		var mainContainer = navPanel.find('plugin', context);

		if(mainContainer[0].rendered) {
			mainContainer[0].removeAll(); // remove all, they will be readded afterwards
			this.addInitialPanels(Zarafa.plugins.files.data.singleton.AccountStore.getStore());
		}
	},

	/**
	 * Called if the account store triggers the 'update' event.
	 * A new panel will be added if it does not exist already.
	 * It also checks the panel status to remove invalid account panels.
	 *
	 * @param store
	 * @param record
	 * @param index
	 * @returns {boolean}
	 * @private
	 */
	addNavigatorPanel: function(store, record, index) {
		// first check if this panel does already exist
		// this event will also be called on account updates
		var existingAccount = Zarafa.plugins.files.data.ComponentBox.getNavigatorTreePanel(record.get('id'));
		if(Ext.isDefined(existingAccount)) {
			// check if the account has errors - if so remove it from the panel!
			if(record.get('status') === Zarafa.plugins.files.data.AccountRecordStatus.ERROR) {
				existingAccount.ownerCt.destroy();
			} else {
				// update navtree UI

				// update account root node:
				var accRoot = existingAccount.getRootNode().item(0);
				if(Ext.isDefined(accRoot)) {
					accRoot.setText(record.get('name'));
					accRoot.setIconCls("icon_16_" + record.get('backend'));
				}
				// update the surrounding container
				existingAccount.ownerCt.setTitle(record.get('backend'));
				existingAccount.ownerCt.setIconClass("icon_16_logo_" + record.get('backend'));
			}
			return true;
		}

		if(record.get('status') === Zarafa.plugins.files.data.AccountRecordStatus.OK) {
			var navPanel = Zarafa.plugins.files.data.ComponentBox.getNavigatorPanel().centerPanel;
			var context = Zarafa.plugins.files.data.ComponentBox.getContext();

			var filesNavPanel = navPanel.find('plugin', context);

			if(filesNavPanel[0].rendered) {
				filesNavPanel[0].add({
					xtype  : 'panel',
					cls    : 'zarafa-context-navigation-block',
					iconCls: 'icon_16_logo_' + record.get('backend'),
					title  : dgettext('plugin_files', record.get('backend')),
					items  : [{
						xtype        : 'filesplugin.navigatortreepanel',
						accountFilter: record.get('id'),
						cls : 'files-context-navigation-node',
						ref          : '../../../filesNavigatorTreePanel_' + record.get('id')
					}]
				});
			}
		}
	},

	/**
	 * Called if the account store triggers the 'remove' event.
	 * The account tree panel will be removed from the main navigator panel.
	 *
	 * @param store
	 * @param record
	 * @param index
	 * @private
	 */
	removeNavigatorPanel: function(store, record, index) {
		var navPanel = Zarafa.plugins.files.data.ComponentBox.getNavigatorTreePanel(record.get('id'));
		if(navPanel) {
			navPanel.ownerCt.destroy();
		}
	}
};
