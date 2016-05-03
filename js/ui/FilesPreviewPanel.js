Ext.namespace('Zarafa.plugins.files.ui');

/**
 * @class Zarafa.plugins.files.ui.FilesPreviewPanel
 * @extends Ext.Panel
 * @xtype filesplugin.filespreviewpanel
 *
 * The preview panel container for the files preview.
 */
Zarafa.plugins.files.ui.FilesPreviewPanel = Ext.extend(Ext.Panel, {

	/**
	 * @constructor
	 * @param config
	 */
	constructor: function (config) {
		config = config || {};

		if (!Ext.isDefined(config.model) && Ext.isDefined(config.context)) {
			config.model = config.context.getModel();
		}

		var toolbar = Ext.applyIf(config.tbar || {}, {
			cls   : 'zarafa-previewpanel-toolbar',
			xtype : 'zarafa.toolbar',
			height: 33,
			hidden: false,
			items : []
		});

		Ext.applyIf(config, {
			xtype   : 'filesplugin.filespreviewpanel',
			layout  : 'fit',
			stateful: true,
			cls     : 'zarafa-previewpanel zarafa-context-mainpanel',
			width   : 300,
			height  : 300,
			tbar    : toolbar
		});

		Zarafa.plugins.files.ui.FilesPreviewPanel.superclass.constructor.call(this, config);
	}
});

Ext.reg('filesplugin.filespreviewpanel', Zarafa.plugins.files.ui.FilesPreviewPanel);

