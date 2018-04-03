Ext.namespace('Zarafa.plugins.files.settings.ui');

/**
 * @class Zarafa.plugins.files.settings.ui.AccountPanel
 * @extends Ext.grid.GridPanel
 * @xtype filesplugin.accountpanel
 * The main gridpanel for our data
 */
Zarafa.plugins.files.settings.ui.AccountPanel = Ext.extend(Ext.Panel, {

	/**
	 * @constructor
	 * @param {Object} config Configuration object
	 */
	constructor: function (config) {
		config = config || {};

		Ext.applyIf(config, {
			border: false,
			layout: 'fit',
			items : this.createPanelItems(config)
		});

		Zarafa.plugins.files.settings.ui.AccountPanel.superclass.constructor.call(this, config);
	},

	/**
	 * Function will create panel items for {@link Zarafa.plugins.files.settings.ui.AccountPanel AccountPanel}.
	 *
	 * @param {Array} config config passed to the constructor
	 * @return {Array} array of items that should be added to panel.
	 * @private
	 */
	createPanelItems: function (config) {
		return [{
			xtype : 'container',
			layout: {
				type : 'vbox',
				align: 'stretch',
				pack : 'start'
			},
			items : [{
				xtype: "filesplugin.accountgrid",
				backendStore : config.model.backendStore,
				flex : 1
			}]
		}];
	}
});
Ext.reg('filesplugin.accountpanel', Zarafa.plugins.files.settings.ui.AccountPanel);