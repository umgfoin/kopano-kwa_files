Ext.namespace('Zarafa.plugins.files.data.singleton');

/**
 * @class Zarafa.plugins.files.data.singleton.AccountStore
 * @extends Object
 * @singleton
 *
 * This singleton will hold a reference to the {@link Zarafa.plugins.files.data.AccountStore Accountstore}.
 */
Zarafa.plugins.files.data.singleton.AccountStore = Ext.extend(Object, {

	/**
	 * @property
	 * @type Zarafa.plugins.files.data.AccountStore
	 * @private
	 */
	store: undefined,

	/**
	 * Triggers a call to the backend to load version information.
	 */
	init: function () {
		this.store = new Zarafa.plugins.files.data.AccountStore();
		this.store.load();
	},

	/**
	 * Get instance of the {@link Zarafa.plugins.files.data.AccountStore Accountstore}
	 * @return {Zarafa.plugins.files.data.AccountStore}
	 */
	getStore: function () {
		return this.store;
	}
});

// Make it a Singleton
Zarafa.plugins.files.data.singleton.AccountStore = new Zarafa.plugins.files.data.singleton.AccountStore();
