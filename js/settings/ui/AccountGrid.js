Ext.namespace('Zarafa.plugins.files.settings.ui');

/**
 * @class Zarafa.plugins.files.settings.ui.AccountGrid
 * @extends Ext.grid.GridPanel
 * @xtype filesplugin.accountgrid
 *
 * The main gridpanel for our account list.
 */
Zarafa.plugins.files.settings.ui.AccountGrid = Ext.extend(Zarafa.common.ui.grid.GridPanel, {

	/**
	 * @cfg {Object} The account store.
	 */
	store: null,

	/**
	 * @constructor
	 * @param {Object} config
	 */
	constructor: function (config) {
		config = config || {};

		this.store = Zarafa.plugins.files.data.singleton.AccountStore.getStore();

		Ext.applyIf(config, {
			xtype       : 'filesplugin.accountgrid',
			ref         : 'accountgrid',
			store       : this.store,
			border      : false,
			baseCls     : 'accountGrid',
			enableHdMenu: false,
			loadMask    : this.initLoadMask(),
			viewConfig  : this.initViewConfig(),
			sm          : this.initSelectionModel(),
			cm          : this.initColumnModel(),
			listeners   : {
				rowdblclick: this.onRowDblClick,
				scope      : this
			},
			tbar        : [{
				iconCls: 'filesplugin_icon_add',
				text   : dgettext('plugin_files', 'Add Account'),
				ref    : '../addAccountBtn',
				handler: this.onAccountAdd
			}, {
				iconCls : 'filesplugin_icon_delete',
				text    : dgettext('plugin_files', 'Remove Account'),
				ref     : '../removeAccountBtn',
				disabled: true,
				scope   : this,
				handler : this.onAccountRemove
			}, {
				xtype : 'spacer',
				width : 10
			}, {
				xtype : 'button',
				iconCls : 'zarafa-rules-sequence-up',
				disabled : true,
				ref : '../upButton',
				handler : this.onAccountSequenceUp,
				scope : this,
				width : 20
			}, {
				xtype : 'spacer',
				width : 10
			}, {
				xtype : 'button',
				iconCls : 'zarafa-rules-sequence-down',
				disabled : true,
				ref : '../downButton',
				handler : this.onAccountSequenceDown,
				scope : this,
				width : 20
			}]
		});

		Zarafa.plugins.files.settings.ui.AccountGrid.superclass.constructor.call(this, config);
	},

	/**
	 * Initialize the {@link Ext.grid.GridPanel.loadMask} field.
	 *
	 * @return {Ext.LoadMask} The configuration object for {@link Ext.LoadMask}
	 * @private
	 */
	initLoadMask: function () {
		return {
			msg: dgettext('plugin_files', 'Loading accounts') + '...'
		};
	},

	/**
	 * Initialize the {@link Ext.grid.GridPanel#viewConfig} field.
	 *
	 * @return {Ext.grid.GridView} The configuration object for {@link Ext.grid.GridView}
	 * @private
	 */
	initViewConfig: function () {
		/*
		 * enableRowBody is used for enabling the rendering of
		 * the second row in the compact view model. The actual
		 * rendering is done in the function getRowClass.
		 *
		 * NOTE: Even though we default to the extended view,
		 * enableRowBody must be enabled here. We disable it
		 * later in onContextViewModeChange(). If we set false
		 * here, and enable it later then the row body will never
		 * be rendered. So disabling after initializing the data
		 * with the rowBody works, but the opposite will not.
		 */

		return {
			enableRowBody: false,
			forceFit     : true,
			emptyText    : '<div class=\'emptytext\'>' + dgettext('plugin_files', 'No account created!') + '</div>'
		};
	},

	/**
	 * Initialize the {@link Ext.grid.GridPanel.sm SelectionModel} field.
	 *
	 * @return {Ext.grid.RowSelectionModel} The subclass of {@link Ext.grid.AbstractSelectionModel}
	 * @private
	 */
	initSelectionModel: function () {
		return new Ext.grid.RowSelectionModel({
			singleSelect: true,
			listeners   : {
				selectionchange: this.onRowSelected
			}
		});
	},

	/**
	 * Initialize the {@link Ext.grid.GridPanel.cm ColumnModel} field.
	 *
	 * @return {Ext.grid.ColumnModel} The {@link Ext.grid.ColumnModel} for this grid
	 * @private
	 */
	initColumnModel: function () {
		return new Zarafa.plugins.files.settings.ui.AccountGridColumnModel();
	},

	/**
	 * Function is called if a row in the grid gets selected.
	 *
	 * @param selectionModel
	 */
	onRowSelected: function (selectionModel) {
		var remButton = this.grid.removeAccountBtn;
		remButton.setDisabled(selectionModel.getCount() < 1);

		this.grid.upButton.setDisabled(!selectionModel.hasPrevious());
		this.grid.downButton.setDisabled(!selectionModel.hasNext());
	},

	/**
	 * Function is called if a row in the grid gets double clicked.
	 *
	 * @param grid
	 * @param rowIndex
	 */
	onRowDblClick: function (grid, rowIndex) {
		Zarafa.core.data.UIFactory.openLayerComponent(Zarafa.core.data.SharedComponentType['filesplugin.accountedit'], undefined, {
			store  : grid.getStore(),
			item   : grid.getStore().getAt(rowIndex),
			manager: Ext.WindowMgr
		});
	},

	/**
	 * Clickhandler for the "add account" button.
	 *
	 * @param button
	 * @param event
	 */
	onAccountAdd: function (button, event) {
		var grid = button.refOwner;

		Zarafa.core.data.UIFactory.openLayerComponent(Zarafa.core.data.SharedComponentType['filesplugin.accountedit'], undefined, {
			store  : grid.getStore(),
			manager: Ext.WindowMgr
		});
	},

	/**
	 * Clickhandler for the "remove account" button.
	 */
	onAccountRemove: function () {
		var selections = this.getSelectionModel().getSelections();

		// Warn user before deleting the account!
		if (Ext.isDefined(selections[0])) { // as we have single select, remove the first item
			Ext.MessageBox.confirm(
				dgettext('plugin_files', 'Confirm deletion'),
				String.format(dgettext('plugin_files', 'Do you really want to delete the account "{0}"?'), selections[0].get("name")),
				this.doRemove.createDelegate(this, [selections[0]], true),
				this
			);
		}
	},

	/**
	 * Actually removes the given account from the backend.
	 *
	 * @param {String} button
	 * @param {String} value Unused
	 * @param {Object} options Unused
	 * @param {AccountRecord} account
	 */
	doRemove: function (button, value, options, account) {
		if (button === "yes") {
			this.getStore().remove(account);
		}
	},

	/**
	 * Handler function will be called when user clicks on 'Up' button
	 * This will determine which accounts to swap and call {@link #swapAccounts}.
	 * @private
	 */
	onAccountSequenceUp : function()
	{
		var store = this.getStore();
		var sm = this.getSelectionModel();
		var account = sm.getSelected();

		/*
		 * Start looking for the first sequence number which is lower then
		 * the current sequence number. Note that we want the account_sequence
		 * which is closest to the current account_sequence, hence the account:
		 *    account.get('account_sequence') > record.get('account_sequence') > swapAccount.get('account_sequence')
		 */
		var swapAccount;
		store.each(function(record) {
			if (account.get('account_sequence') > record.get('account_sequence')) {
				if (!swapAccount || record.get('account_sequence') > swapAccount.get('account_sequence')) {
					swapAccount = record;
				}
			}
		}, this);

		this.swapAccounts(account, swapAccount);
	},

	/**
	 * Handler function will be called when user clicks on 'Down' button
	 * This will determine which accounts to swap and call {@link #swapAccounts}.
	 * @private
	 */
	onAccountSequenceDown : function()
	{
		var store = this.getStore();
		var sm = this.getSelectionModel();
		var account = sm.getSelected();

		/*
		 * Start looking for the first sequence number which is higher then
		 * the current sequence number. Note that we want the account_sequence
		 * which is closest to the current account_sequence, hence the account:
		 *    account.get('account_sequence') < record.get('account_sequence') < swapAccount.get('account_sequence')
		 */
		var swapAccount;
		store.each(function(record) {
			if (account.get('account_sequence') < record.get('account_sequence')) {
				if (!swapAccount || record.get('account_sequence') < swapAccount.get('account_sequence')) {
					swapAccount = record;
				}
			}
		}, this);

		this.swapAccounts(account, swapAccount);
	},

	/**
	 * Swap two accounts by changing the 'account_sequence' property
	 * for both accounts, and {@link Ext.data.Store#sort sort}
	 * the {@link #store}.
	 * @param {Zarafa.plugins.files.data.AccountRecord} a The first account
	 * @param {Zarafa.plugins.files.data.AccountRecord} b The second account
	 * @private
	 */
	swapAccounts : function(a, b)
	{
		var aSeq = parseInt(a.get('account_sequence'));
		var bSeq = parseInt(b.get('account_sequence'));

		// Disable UI buttons to prevent race conditions
		this.upButton.setDisabled(true);
		this.downButton.setDisabled(true);

		// Swap the 2 accounts
		this.store.suspendEvents(); // do not use the autoSave feature of the store
		a.set('account_sequence', bSeq);
		b.set('account_sequence', aSeq);
		this.store.resumeEvents();
		a.markDirty();
		b.markDirty();

		// store both accounts in one request
		this.store.save(this.store.getModifiedRecords());

		// Reapply the sorting, this will update the UI
		this.store.on('update', this.onAfterSequenceChanged.createDelegate(this, [a,b], true), null, {single: true});
	},

	/**
	 * Eventhandler, called after the store has been updated.
	 * This will reload the store to update the ordering.
	 *
	 * @param store
	 * @param record
	 * @param operation
	 * @param {Zarafa.plugins.files.data.AccountRecord} a The first account
	 * @param {Zarafa.plugins.files.data.AccountRecord} b The second account
	 */
	onAfterSequenceChanged : function(store, record, operation, a, b) {
		store.reload();

		// Update the UI when the store has been reloaded
		store.on('load', this.onAfterSequenceReload.createDelegate(this, [a,b], true), null, {single: true});
	},

	/**
	 * This updates the UI after the store has been reloaded.
	 *
	 * @param store
	 * @param record
	 * @param operation
	 * @param {Zarafa.plugins.files.data.AccountRecord} a The first account
	 * @param {Zarafa.plugins.files.data.AccountRecord} b The second account
	 */
	onAfterSequenceReload: function(store, record, operation, a, b) {
		var grid = this;

		 // Update the 'up'/'down' button
		var sm = grid.getSelectionModel();
		grid.upButton.setDisabled(!sm.hasPrevious());
		grid.downButton.setDisabled(!sm.hasNext());

		// fire the reorder event
		store.fireEvent('reorder', a, b);
	}
});

Ext.reg('filesplugin.accountgrid', Zarafa.plugins.files.settings.ui.AccountGrid);