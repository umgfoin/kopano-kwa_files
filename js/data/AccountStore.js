Ext.namespace('Zarafa.plugins.files.data');

/**
 * @class Zarafa.plugins.files.data.AccountStore
 * @extends Zarafa.core.data.ListModuleStore
 * @xtype filesplugin.accountstore
 *
 * This store will hold all Files accounts that a user owns.
 */
Zarafa.plugins.files.data.AccountStore = Ext.extend(Zarafa.core.data.ListModuleStore, {

	/**
	 * @constructor
	 */
	constructor: function () {
		Zarafa.plugins.files.data.AccountStore.superclass.constructor.call(this, {
			preferredMessageClass: 'IPM.FilesAccount',
			autoSave             : true,
			actionType           : Zarafa.core.Actions['list'],
			defaultSortInfo      : {
				field    : 'account_sequence',
				direction: 'asc'
			}
		});

		// add custom event
		this.addEvents('reorder'); // reorder has two arguments: panel a and panel b, those got swapped
	}
});

Ext.reg('filesplugin.accountstore', Zarafa.plugins.files.data.AccountStore);