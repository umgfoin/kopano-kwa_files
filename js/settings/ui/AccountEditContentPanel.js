Ext.namespace('Zarafa.plugins.files.settings.ui');

/**
 * @class Zarafa.plugins.files.settings.ui.AccountEditContentPanel
 * @extends Zarafa.core.ui.ContentPanel
 * @xtype filesplugin.accounteditcontentpanel
 */
Zarafa.plugins.files.settings.ui.AccountEditContentPanel = Ext.extend(Zarafa.core.ui.ContentPanel, {

	/**
	 * @constructor
	 * @param config Configuration structure
	 */
	constructor: function (config) {
		config = config || {};

		Ext.applyIf(config, {

			xtype: 'filesplugin.accounteditcontentpanel',

			layout    : 'fit',
			model     : true,
			autoSave  : false,
			width     : 400,
			autoHeight: true,
			title     : dgettext('plugin_files', 'Edit Account'),
			items     : [{
				xtype: 'filesplugin.accounteditpanel',
				item : config.item
			}]
		});

		Zarafa.plugins.files.settings.ui.AccountEditContentPanel.superclass.constructor.call(this, config);
	}
});

Ext.reg('filesplugin.accounteditcontentpanel', Zarafa.plugins.files.settings.ui.AccountEditContentPanel);