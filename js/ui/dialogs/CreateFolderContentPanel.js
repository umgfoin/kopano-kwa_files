Ext.namespace('Zarafa.plugins.files.ui.dialogs');

/**
 * @class Zarafa.plugins.files.ui.dialogs.CreateFolderContentPanel
 * @extends Zarafa.core.ui.ContentPanel
 * @xtype filesplugin.createfoldercontentpanel
 *
 * This content panel contains the files tree panel for create new folder in that.
 */
Zarafa.plugins.files.ui.dialogs.CreateFolderContentPanel = Ext.extend(Zarafa.core.ui.ContentPanel, {

	/**
	 * @constructor
	 * @param config Configuration structure
	 */
	constructor : function(config)
	{
		config = config || {};

		Ext.applyIf(config, {
			xtype : 'zarafa.createfoldercontentpanel',
			layout: 'fit',
			title : dgettext('plugin_files', 'Create New Folder'),
			width: 300,
			height: 350,
			items: [{
				xtype: 'filesplugin.createfolderpanel',
				accountFilter : config.accountFilter,
				selectedFolderId : config.selectedFolderId
			}]
		});

		Zarafa.plugins.files.ui.dialogs.CreateFolderContentPanel.superclass.constructor.call(this, config);
	}
});

Ext.reg('filesplugin.createfoldercontentpanel', Zarafa.plugins.files.ui.dialogs.CreateFolderContentPanel);
