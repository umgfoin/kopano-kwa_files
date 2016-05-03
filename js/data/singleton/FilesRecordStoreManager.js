Ext.namespace('Zarafa.plugins.files.data.singleton');

/**
 * @class Zarafa.plugins.files.data.singleton.FilesRecordStoreManager
 * @extends Object
 * @singleton
 *
 * This singleton will hold a reference to {@link Zarafa.plugins.files.data.FilesRecordStore FilesRecordStore}.
 */
Zarafa.plugins.files.data.singleton.FilesRecordStoreManager = Ext.extend(Object, {

	/**
	 * @property
	 * @type Zarafa.plugins.files.data.FilesRecordStore[]
	 * @private
	 */
	stores: undefined,

	/**
	 * Get instance of the {@link Zarafa.plugins.files.data.FilesRecordStore FilesRecordStore}
	 *
	 * @param {Number} storeid the storeid to identify the store.
	 * 		If it is empty the default store (id = 0) will be returned.
	 *
	 * @return {Zarafa.plugins.files.data.FilesRecordStore}
	 */
	getStore: function (storeid) {
		if(Ext.isEmpty(storeid)) {
			storeid = 0;
		}

		if(!Ext.isDefined(this.stores)) {
			// Generate the store
			this.stores = [];

			this.stores[storeid] = new Zarafa.plugins.files.data.FilesRecordStore();

			return this.stores[storeid];
		} else if (Ext.isDefined(this.stores[storeid])) {
			return this.stores[storeid];
		} else {
			// Generate a new store for the given id
			this.stores[storeid] = new Zarafa.plugins.files.data.FilesRecordStore();

			return this.stores[storeid];
		}
	}
});

// Make it a Singleton
Zarafa.plugins.files.data.singleton.FilesRecordStoreManager = new Zarafa.plugins.files.data.singleton.FilesRecordStoreManager();
