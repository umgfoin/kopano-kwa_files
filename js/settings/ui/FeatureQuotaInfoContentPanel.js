Ext.namespace('Zarafa.plugins.files.settings.ui');

/**
 * @class Zarafa.plugins.files.settings.ui.FeatureQuotaInfoContentPanel
 * @extends Zarafa.core.ui.ContentPanel
 * @xtype filesplugin.featurequotainfocontentpanel
 */
Zarafa.plugins.files.settings.ui.FeatureQuotaInfoContentPanel = Ext.extend(Zarafa.core.ui.ContentPanel, {

	/**
	 * @constructor
	 * @param config
	 */
	constructor: function (config) {
		config = config || {};

		Ext.applyIf(config, {

			xtype: 'filesplugin.featurequotainfocontentpanel',

			layout    : 'fit',
			model     : true,
			autoSave  : false,
			width     : 400,
			autoHeight: true,
			title     : dgettext('plugin_files', 'Quota Information'),
			items     : [{
				xtype: 'filesplugin.featurequotainfopanel',
				item : config.item
			}]
		});

		Zarafa.plugins.files.settings.ui.FeatureQuotaInfoContentPanel.superclass.constructor.call(this, config);
	}
});

Ext.reg('filesplugin.featurequotainfocontentpanel', Zarafa.plugins.files.settings.ui.FeatureQuotaInfoContentPanel);