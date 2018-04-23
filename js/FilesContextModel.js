Ext.namespace('Zarafa.plugins.files.context');

/**
 * @class Zarafa.plugins.files.FilesContextModel
 * @extends Zarafa.core.ContextModel
 *
 * This class will instantiate a new {@link Zarafa.plugins.files.data.FilesRecordStore files store} object.
 */
Zarafa.plugins.files.FilesContextModel = Ext.extend(Zarafa.core.ContextModel, {

	/**
	 * @cfg {Zarafa.plugins.files.data.BackendStore} backendStore which
	 * contains {@link Zarafa.plugins.files.data.FilesBackendRecord backend} records.
	 */
	backendStore : undefined,

	/**
	 * @constructor
	 * @param {Object} config Configuration object.
	 */
	constructor: function (config) {
		config = config || {};

		if (!Ext.isDefined(config.store)) {
			config.store = new Zarafa.plugins.files.data.FilesRecordStore();
		}

		if(!Ext.isDefined(config.backendStore)) {
			config.backendStore = new Zarafa.plugins.files.data.BackendStore();
		}
		
		Zarafa.plugins.files.FilesContextModel.superclass.constructor.call(this, config);
	},

	/**
	 * Create a new {@link Zarafa.plugins.files.data.FilesRecord FilesRecord}.
	 *
	 * @param {String} parentid id of the parent folder
	 * @return {Zarafa.plugins.files.data.FilesRecord} The new {@link Zarafa.plugins.files.data.FilesRecord FilesRecord}.
	 */
	createRecord: function (parentid) {
		parentid = parentid || "/";

		var record = Zarafa.core.data.RecordFactory.createRecordObjectByMessageClass('IPM.Files', {
			store_entryid : "files",
			parent_entryid: parentid
		});
		record.store = this.getStore();
		return record;
	},

	/**
	 * Update the current preview {@link Zarafa.core.data.IPMRecord}
	 * This will fire the event {@link #previewrecordchange}.
	 *
	 * @param {mixed} record The record which is set as preview or false to refresh the old record
	 * @param {Boolean} refresh (optinal) true to just refresh the old record
	 */
	setPreviewRecord: function (record, refresh) {
		if (container.getCurrentContext().getName() === "filescontext") {
			var previewPanel = Zarafa.plugins.files.data.ComponentBox.getPreviewPanel();
			var panelConstructor;

			if (refresh && this.previewRecord) {

				panelConstructor = container.getSharedComponent(Zarafa.core.data.SharedComponentType['common.preview'], this.previewRecord);

				previewPanel.removeAll();
				if (Ext.isDefined(panelConstructor)) {
					previewPanel.add(new panelConstructor());
					previewPanel.doLayout();
					previewPanel.fileinfo.update(this.previewRecord);
				}

			} else if (this.previewRecord !== record) {
				this.previewRecord = record;

				if (Ext.isDefined(record)) {
					panelConstructor = container.getSharedComponent(Zarafa.core.data.SharedComponentType['common.preview'], record);

					if (Ext.isDefined(panelConstructor) && previewPanel.fileinfo instanceof panelConstructor) {
						previewPanel.fileinfo.update(record);
					} else {

						previewPanel.removeAll();
						if (panelConstructor) {
							previewPanel.add(new panelConstructor());
							previewPanel.doLayout();
							previewPanel.fileinfo.update(record);
						}
					}
				} else {
					previewPanel.removeAll();
				}
			}
		}
	},

	/**
	 * Returns a list of currently selected folders.
	 * @return {Zarafa.hierarchy.data.MAPIFolderRecord[]} selected folders as an array of
	 * {@link Zarafa.hierarchy.data.MAPIFolderRecord MAPIFolder} objects.
	 */
	getFolders: function () {
		Zarafa.plugins.files.data.FilesMAPIFolderRecord = Ext.extend(Zarafa.hierarchy.data.MAPIFolderRecord, {
			getFullyQualifiedDisplayName: function () {
				return this.getDisplayName();
			},
			getParentFolder             : function () {
				return false;
			},
			set                         : function (name, data) {
				if (Ext.isDefined(this.data.name)) {
					this.data.name = data;
				}
			}
		});
		var pseudoFolder = new Zarafa.plugins.files.data.FilesMAPIFolderRecord({
			icon_index     : Zarafa.core.mapi.IconIndex.getValue('files'),
			display_name   : dgettext('plugin_files', 'Files'),
			entryid        : this.store.getPath(),
			parent_entryid : this.store.getPath(),
			store_entryid  : "files",
			folder_pathname: Zarafa.plugins.files.data.Utils.File.stripAccountId(this.store.getPath()),
			content_unread : 0,
			content_count  : 0
		}, this.store.getPath());

		return [pseudoFolder];
	},

	/**
	 * Event handler for the {@link Zarafa.hierarcy.data.HierarchyStore#load load} event.
	 * This will set {@link #onContextSwitch onContextSwitch listener} on
	 * {@link Zarafa.core.Container container} contextswitch event.
	 * @param {Zarafa.core.hierarchyStore} store that holds hierarchy data.
	 */
	onHierarchyLoad : function (hierarchyStore)
	{
		// only continue when hierarchyStore has data
		if(hierarchyStore.getCount() === 0) {
			return;
		}
		container.on('contextswitch', this.onContextSwitch, this);
		this.onContextSwitch(null, null, container.getCurrentContext()); // do a initial check after render
	},

	/**
	 * Fires on context switch from container. Updates folder tree visibility
	 * @param {Object} parameters contains folder details
	 * @param {Context} oldContext previously selected context
	 * @param {Context} newContext selected context
	 *
	 * @private
	 */
	onContextSwitch : function (parameters, oldContext, newContext)
	{
		var navPanel = container.getNavigationBar();

		if(newContext instanceof Zarafa.plugins.files.FilesContext) {
			this.oldShowFolderList = navPanel.showFolderList; // store old value
			navPanel.setShowFolderList(false); // disable "view all folders"
		} else if(Ext.isDefined(this.oldShowFolderList)) {
			navPanel.setShowFolderList(this.oldShowFolderList); // reset old value
		}
	}

});
