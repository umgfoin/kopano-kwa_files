Ext.namespace('Zarafa.plugins.files.settings.ui');

/**
 * @class Zarafa.plugins.files.settings.ui.FeatureVersionInfoPanel
 * @extends Ext.Panel
 * @xtype filesplugin.featureversioninfopanel
 *
 * Will generate UI for {@link Zarafa.plugins.files.settings.ui.FeatureVersionInfoContentPanel FeatureVersionInfoContentPanel}.
 */
Zarafa.plugins.files.settings.ui.FeatureVersionInfoPanel = Ext.extend(Ext.Panel, {

	/**
	 * @cfg {Object} The current loaded account record.
	 */
	account: undefined,

	/**
	 * @constructor
	 * @param config Configuration structure.
	 */
	constructor: function (config) {
		config = config || {};

		if (config.item) {
			this.account = config.item;
		}

		Ext.applyIf(config, {

			xtype      : 'filesplugin.featureversioninfopanel',
			autoHeight : true,
			layout     : 'fit',
			defaultType: 'textfield',
			items      : this.createPanelItems(config),
			buttons    : [{
				text   : dgettext('plugin_files', 'Close'),
				handler: this.doClose,
				scope  : this
			}]
		});

		Zarafa.plugins.files.settings.ui.FeatureVersionInfoPanel.superclass.constructor.call(this, config);

		this.doReload();
	},

	/**
	 * Close the dialog.
	 */
	doClose: function () {
		this.dialog.close();
	},

	/**
	 * Reload the version store.
	 */
	doReload: function () {
		var responseHandler = new Zarafa.plugins.files.data.ResponseHandler({
			successCallback: this.gotVersionValues.createDelegate(this)
		});

		container.getRequest().singleRequest(
			'filesaccountmodule',
			'getversion',
			{
				accountId: this.account.get("id")
			},
			responseHandler
		);
	},

	/**
	 * Function is called after we received the response object from the server.
	 * It will update the textfield values.
	 *
	 * @param response
	 */
	gotVersionValues: function (response) {

		this.backendVersionField.setValue(response.version.backend);
		this.serverVersionField.setValue(response.version.server);
	},

	/**
	 * Function will create panel items for {@link Zarafa.plugins.files.settings.ui.FeatureVersionInfoPanel FeatureVersionInfoPanel}.
	 *
	 * @param {Object} config
	 * @return {Array} array of items that should be added to panel.
	 * @private
	 */
	createPanelItems: function (config) {
		return [{
			xtype     : 'form',
			autoHeight: true,
			labelWidth: 200,
			title     : dgettext('plugin_files', 'This account uses the following Backend:'),
			items     : [{
				xtype     : 'displayfield',
				ref       : '../backendVersionField',
				fieldLabel: dgettext('plugin_files', 'Backend version'),
				value     : dgettext('plugin_files', 'Loading') + '&hellip;'
			}, {
				xtype     : 'displayfield',
				ref       : '../serverVersionField',
				fieldLabel: dgettext('plugin_files', 'Storage server version'),
				value     : dgettext('plugin_files', 'Loading') + '&hellip;'
			}]
		}];
	}
});

Ext.reg('filesplugin.featureversioninfopanel', Zarafa.plugins.files.settings.ui.FeatureVersionInfoPanel);