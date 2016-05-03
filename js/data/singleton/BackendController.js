Ext.namespace('Zarafa.plugins.files.data.singleton');

/**
 * @class Zarafa.plugins.files.data.singleton.BackendController
 * @extends Object
 * @singleton
 *
 * This class offers basic access to backend values (name, type, ...).
 */
Zarafa.plugins.files.data.singleton.BackendController = Ext.extend(Object, {

	/**
	 * @property
	 * @type Object
	 * @private
	 */
	backendData: undefined,

	/**
	 * This method initializes the {@link Zarafa.plugins.files.data.singleton.BackendController backend controller}.
	 * It will load all data from the server.
	 */
	init: function () {
		var responseHandler = new Zarafa.plugins.files.data.ResponseHandler({
			successCallback: this.gotBackendValues.createDelegate(this)
		});

		container.getRequest().singleRequest(
			'filesaccountmodule',
			'getbackends',
			{
				plugin: "files"
			},
			responseHandler
		);
	},

	/**
	 * This method gets called if the initialization was successful.
	 *
	 * @param {Object} response
	 */
	gotBackendValues: function (response) {
		this.backendData = response;
	},

	/**
	 * This method will return a {@link Ext.data.ArrayStore store} that contains all available backend names.
	 *
	 * @return {Ext.data.ArrayStore} Store with all backend names.
	 */
	getBackendNameStore: function () {
		var dataFields = [];

		if (Ext.isDefined(this.backendData) && Ext.isDefined(this.backendData.backends)) {
			Ext.each(this.backendData.backends, function (backend) {
				var entry = [
					backend.name,
					backend.displayName,
					backend.description
				];

				dataFields.push(entry);
			});
		}

		var store = new Ext.data.ArrayStore({
			fields: ['backend', 'displayName', 'displayText'],
			data  : dataFields
		});

		return store;
	}
});

// Make it a singleton.
Zarafa.plugins.files.data.singleton.BackendController = new Zarafa.plugins.files.data.singleton.BackendController();
