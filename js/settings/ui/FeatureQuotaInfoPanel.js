Ext.namespace('Zarafa.plugins.files.settings.ui');

/**
 * @class Zarafa.plugins.files.settings.ui.FeatureQuotaInfoPanel
 * @extends Ext.Panel
 * @xtype filesplugin.featurequotainfopanel
 *
 * Will generate UI for {@link Zarafa.plugins.files.settings.ui.FeatureQuotaInfoContentPanel FeatureQuotaInfoContentPanel}.
 */
Zarafa.plugins.files.settings.ui.FeatureQuotaInfoPanel = Ext.extend(Ext.Panel, {

	/**
	 * @cfg {Object} The current loaded account record.
	 */
	account: undefined,

	/**
	 * @cfg {Object} JsonStore which holds quota data.
	 */
	quotaStore: undefined,

	/**
	 * @constructor
	 * @param config Configuration structure.
	 */
	constructor: function (config) {
		config = config || {};

		if (config.item) {
			this.account = config.item;
		}

		// Init store
		this.quotaStore = new Ext.data.JsonStore({
			fields  : ['state', 'amount'],
			autoLoad: false,
			data    : [{
				state : "Free",
				amount: 0
			}, {
				state : "Used",
				amount: 0
			}, {
				state : "Unknown",
				amount: 100
			}]
		});

		Ext.applyIf(config, {

			// Override from Ext.Component
			xtype      : 'filesplugin.featurequotainfopanel',
			autoHeight : true,
			layout     : 'fit',
			defaultType: 'textfield',
			items      : this.createPanelItems(config),
			buttons    : [{
				text   : dgettext('plugin_files', 'Reload'),
				ref    : "../reloadBtn",
				handler: this.doReload.createDelegate(this),
				scope  : this
			}, {
				text   : dgettext('plugin_files', 'Close'),
				handler: this.doClose,
				scope  : this
			}]
		});

		Zarafa.plugins.files.settings.ui.FeatureQuotaInfoPanel.superclass.constructor.call(this, config);

		this.doReload();
	},

	/**
	 * Close the dialog.
	 */
	doClose: function () {
		this.dialog.close();
	},

	/**
	 * Reload the quota store.
	 */
	doReload: function () {
		var responseHandler = new Zarafa.plugins.files.data.ResponseHandler({
			successCallback: this.gotQuotaValues.createDelegate(this)
		});

		container.getRequest().singleRequest(
			'filesaccountmodule',
			'getquota',
			{
				accountId: this.account.get("id"),
				folder   : "/"
			},
			responseHandler
		);
	},

	/**
	 * Function is called after we received the response object from the server.
	 * It will update the quotaStore and the textfield values.
	 *
	 * @param response
	 */
	gotQuotaValues: function (response) {
		this.quotaStore.loadData(response["quota"]);

		// Update text values
		this.usedField.setValue(Ext.util.Format.fileSize(parseInt(response["quota"][0].amount)));
		this.availableField.setValue(Ext.util.Format.fileSize(parseInt(response["quota"][1].amount)));
		this.totalField.setValue(Ext.util.Format.fileSize(parseInt(response["quota"][1].amount) + parseInt(response["quota"][0].amount)));
	},

	/**
	 * Function will create panel items for {@link Zarafa.plugins.files.settings.ui.FeatureQuotaInfoPanel FeatureQuotaInfoPanel}.
	 *
	 * @param {Object} config
	 * @return {Array} array of items that should be added to panel.
	 * @private
	 */
	createPanelItems: function (config) {
		return [
			{
				store        : this.quotaStore,
				xtype        : 'piechart',
				dataField    : 'amount',
				categoryField: 'state',
				tipRenderer  : this.toolTipRenderer,

				//extra styles get applied to the chart defaults
				seriesStyles : {
					colors: ['#FF4444', '#99CC00', '#33B5E5']
				},
				extraStyle   : {
					legend: {
						display: 'bottom',
						padding: 5,
						font   : {
							family: 'Tahoma',
							size  : 13
						}
					}
				}
			}, {
				xtype     : 'form',
				labelWidth: 200,
				title     : dgettext('plugin_files', 'Your current storage usage'),
				items     : [{
					xtype     : 'displayfield',
					ref       : '../usedField',
					fieldLabel: dgettext('plugin_files', 'Used storage'),
					value     : dgettext('plugin_files', 'Loading') + '&hellip;'
				}, {
					xtype     : 'displayfield',
					ref       : '../availableField',
					fieldLabel: dgettext('plugin_files', 'Free storage'),
					value     : dgettext('plugin_files', 'Loading') + '&hellip;'
				}, {
					xtype     : 'displayfield',
					ref       : '../totalField',
					fieldLabel: dgettext('plugin_files', 'Total storage size'),
					value     : dgettext('plugin_files', 'Loading') + '&hellip;'
				}]
			}
		];
	},

	/**
	 * Custom renderer for our chart tooltips.
	 *
	 * @param chart
	 * @param record
	 * @param index
	 * @param series
	 * @returns {string}
	 */
	toolTipRenderer: function (chart, record, index, series) {
		return Ext.util.Format.fileSize(parseInt(record.get("amount"))) + ' ' + record.get("state");
	}
});

Ext.reg('filesplugin.featurequotainfopanel', Zarafa.plugins.files.settings.ui.FeatureQuotaInfoPanel);