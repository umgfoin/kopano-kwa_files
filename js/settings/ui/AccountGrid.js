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
				handler : this.onAccountRemove.createDelegate(this)
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
		// enableRowBody is used for enabling the rendering of
		// the second row in the compact view model. The actual
		// rendering is done in the function getRowClass.
		//
		// NOTE: Even though we default to the extended view,
		// enableRowBody must be enabled here. We disable it
		// later in onContextViewModeChange(). If we set false
		// here, and enable it later then the row body will never
		// be rendered. So disabling after initializing the data
		// with the rowBody works, but the opposite will not.

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
	 *
	 * @param button
	 * @param event
	 */
	onAccountRemove: function (button, event) {
		var grid = button.refOwner;
		var selections = grid.getSelectionModel().getSelections();

		// Warn user before deleting the account!
		if (Ext.isDefined(selections[0])) { // as we have single select, remove the first item
			Ext.MessageBox.confirm(
				dgettext('plugin_files', 'Confirm deletion'),
				String.format(dgettext('plugin_files', 'Do you really want to delete the account "{0}"?'), selections[0].get("name")),
				this.doRemove.createDelegate(this, [grid, selections[0]], true),
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
	 * @param {AccountGrid} grid
	 * @param {AccountRecord} account
	 */
	doRemove: function (button, value, options, grid, account) {
		if (button === "yes") {
			grid.getStore().remove(account);
		}
	}
});

Ext.reg('filesplugin.accountgrid', Zarafa.plugins.files.settings.ui.AccountGrid);