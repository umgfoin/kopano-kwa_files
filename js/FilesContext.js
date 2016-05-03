Ext.namespace('Zarafa.plugins.files');

/**
 * @class Zarafa.plugins.files.FilesContext
 * @extends Zarafa.core.Context
 *
 * This class will add a new context to the webapp. The new context
 * offers a filebrowser for the Files backend.
 */
Zarafa.plugins.files.FilesContext = Ext.extend(Zarafa.core.Context, {

	/**
	 * When searching, this property marks the {@link Zarafa.core.Context#getCurrentView view}
	 * which was used before {@link #onSearchStart searching started}.
	 *
	 * @property
	 * @type Mixed
	 * @private
	 */
	oldView: undefined,

	/**
	 * When searching, this property marks the {@link Zarafa.core.Context#getCurrentViewMode viewmode}
	 * which was used before {@link #onSearchStart searching started}.
	 *
	 * @property
	 * @type Mixed
	 * @private
	 */
	oldViewMode: undefined,

	/**
	 * @constructor
	 * @param {Object} config
	 */
	constructor: function (config) {
		config = config || {};

		Ext.applyIf(config, {
			current_view     : Zarafa.plugins.files.data.Views.LIST,
			current_view_mode: Zarafa.plugins.files.data.ViewModes.RIGHT_PREVIEW
		});

		this.registerModules();

		this.registerInsertionPoint('main.maintabbar.left', this.createMainTab, this);

		this.registerInsertionPoint('main.maintoolbar.new.item', this.createNewFilesButton, this);

		this.registerInsertionPoint('main.toolbar.actions.last', this.createMainToolbarButtons, this);

		this.registerInsertionPoint('navigation.center', this.createNavigatorTreePanel, this);

		this.registerInsertionPoint('context.addressbook.contextmenu.actions', this.createSendEmailContextItem, this);
		this.registerInsertionPoint('context.contact.contextmenu.actions', this.createSendEmailContextItem, this);
		this.registerInsertionPoint('context.contact.contactcontentpanel.toolbar.actions', this.createSendEmailButton, this);
		this.registerInsertionPoint('context.contact.distlistcontentpanel.toolbar.actions', this.createSendEmailButton, this);

		Zarafa.plugins.files.FilesContext.superclass.constructor.call(this, config);

		Zarafa.core.data.SharedComponentType.addProperty('zarafa.plugins.files.attachdialog');
		Zarafa.core.data.SharedComponentType.addProperty('zarafa.plugins.files.fileinfopanel');
		Zarafa.core.data.SharedComponentType.addProperty('zarafa.plugins.files.sharedialog');
		Zarafa.core.data.SharedComponentType.addProperty('zarafa.plugins.files.uploadstatusdialog');
		Zarafa.core.data.SharedComponentType.addProperty('zarafa.plugins.files.treecontextmenu');
	},

	/**
	 * Adds a new tab item to the top tab bar of the WebApp.
	 *
	 * @returns {Object} The button for the top tab bar.
	 */
	createMainTab: function () {
		return {
			text         : this.getDisplayName(),
			tabOrderIndex: 7,
			context      : this.getName()
		};
	},

	/**
	 * This method returns the context model for the files context.
	 * If the model was not yet initialized, it will create a new model.
	 *
	 * @return {Zarafa.plugins.files.FilesContextModel} The files context model.
	 */
	getModel: function () {
		if (!Ext.isDefined(this.model)) {
			this.model = new Zarafa.plugins.files.FilesContextModel();
		}
		return this.model;
	},

	/**
	 * Bid for the given {@link Zarafa.hierarchy.data.MAPIFolderRecord folder}
	 * This will bid on any folder of container class 'IPF.Files'.
	 *
	 * @param {Zarafa.hierarchy.data.MAPIFolderRecord} folder The folder for which the context is bidding.
	 * @return {Number} 1 when the contexts supports the folder, -1 otherwise.
	 */
	bid: function (folder) {

		if (folder.isContainerClass('IPF.Files', true)) {
			return 1;
		}

		return -1;
	},

	/**
	 * Bid for the type of shared component and the given record.
	 *
	 * @param {Zarafa.core.data.SharedComponentType} type Type of component a context can bid for.
	 * @param {Ext.data.Record} record Optionally passed record.
	 * @returns {Number}
	 */
	bidSharedComponent: function (type, record) {
		var bid = -1;

		if (Ext.isArray(record)) {
			record = record[0];
		}

		switch (type) {
			case Zarafa.core.data.SharedComponentType['zarafa.plugins.files.attachdialog']:
			case Zarafa.core.data.SharedComponentType['zarafa.plugins.files.fileinfopanel']:
			case Zarafa.core.data.SharedComponentType['zarafa.plugins.files.sharedialog']:
			case Zarafa.core.data.SharedComponentType['zarafa.plugins.files.uploadstatusdialog']:
			case Zarafa.core.data.SharedComponentType['zarafa.plugins.files.treecontextmenu']:
				bid = 1;
				break;
			case Zarafa.core.data.SharedComponentType['common.create']:
			case Zarafa.core.data.SharedComponentType['common.view']:
			case Zarafa.core.data.SharedComponentType['common.preview']:
				if (record instanceof Zarafa.core.data.IPMRecord && record.isMessageClass('IPM.Files', true)) {
					bid = 1;
				}
				break;
			case Zarafa.core.data.SharedComponentType['common.contextmenu']:
				if (record instanceof Zarafa.core.data.IPMRecord && record.isMessageClass('IPM.Files', true)) {
					bid = 1;
				}
				break;
			default :
				break;
		}
		return bid;
	},

	/**
	 * Will return the reference to the shared component.
	 * Based on the type of component requested a component is returned.
	 *
	 * @param {Zarafa.core.data.SharedComponentType} type Type of component a context can bid for.
	 * @param {Ext.data.Record} record Optionally passed record.
	 * @return {Ext.Component} Component
	 */
	getSharedComponent: function (type, record) {
		var component;
		switch (type) {
			case Zarafa.core.data.SharedComponentType['zarafa.plugins.files.fileinfopanel']:
				component = Zarafa.plugins.files.ui.dialogs.FilesRecordContentPanel;
				break;
			case Zarafa.core.data.SharedComponentType['common.create']:
				component = Zarafa.plugins.files.ui.dialogs.FilesUploadContentPanel;
				break;
			case Zarafa.core.data.SharedComponentType['zarafa.plugins.files.sharedialog']:
				component = Zarafa.plugins.files.ui.dialogs.ShareContentPanel;
				break;
			case Zarafa.core.data.SharedComponentType['zarafa.plugins.files.uploadstatusdialog']:
				component = Zarafa.plugins.files.ui.dialogs.UploadStatusContentPanel;
				break;
			case Zarafa.core.data.SharedComponentType['common.view']:
			case Zarafa.core.data.SharedComponentType['common.preview']:
				component = Zarafa.plugins.files.ui.FilesRecordViewPanel;
				break;
			case Zarafa.core.data.SharedComponentType['common.contextmenu']:
				component = Zarafa.plugins.files.ui.FilesMainContextMenu;
				break;
			case Zarafa.core.data.SharedComponentType['zarafa.plugins.files.treecontextmenu']:
				component = Zarafa.plugins.files.ui.FilesTreeContextMenu;
				break;
			default :
				break;
		}
		return component;
	},

	/**
	 * Creates the files tree that is shown when the user selects the files context from the
	 * button panel. It shows a tree of available accoutns and folders.
	 *
	 * @return {Object}
	 */
	createNavigatorTreePanel: function () {
		return Zarafa.plugins.files.ui.FilesContextNavigatorBuilder.getNavigatorTreePanelContainer(this);
	},

	/**
	 * This method creates the {@link Zarafa.plugins.files.ui.FilesMainPanel main content panel}
	 * which will contain the file browser.
	 *
	 * @returns {Object}
	 */
	createContentPanel: function () {
		return {
			xtype  : 'filesplugin.filesmainpanel',
			context: this
		};
	},

	/**
	 * Create "New File" {@link Ext.menu.MenuItem item} for the "New item"
	 * {@link Ext.menu.Menu menu} in the {@link Zarafa.core.ui.MainToolbar toolbar}.
	 * This button should be shown in all {@link Zarafa.core.Context contexts} and
	 * is used to upload a new file.
	 *
	 * @returns {Object}
	 */
	createNewFilesButton: function () {
		return {
			xtype       : 'menuitem',
			text        : dgettext('plugin_files', 'Upload file'),
			tooltip     : dgettext('plugin_files', 'Upload one or more files'),
			plugins     : 'zarafa.menuitemtooltipplugin',
			iconCls     : 'icon_files_category',
			newMenuIndex: 6,
			context     : this.getName(),
			handler     : function () {
				Zarafa.plugins.files.data.Actions.openCreateFilesContent(this.getModel());
			},
			scope       : this
		};
	},

	/**
	 * Handler for the insertion points for extending the contacts and address book context menus
	 * with buttons to send a mail to the given contact and address book.
	 *
	 * @return {Object}
	 */
	createSendEmailContextItem: function () {
		return {
			text      : dgettext('plugin_files', 'Send file'),
			iconCls   : 'icon_attachment',
			scope     : this,
			handler   : function (item) {
				Zarafa.plugins.files.data.Actions.openCreateMailContentForContacts(this.getModel(), item.parentMenu.records);
			},
			beforeShow: function (item, records) {
				var visible = false;

				for (var i = 0, len = records.length; i < len; i++) {
					var record = records[i];
					if (this.isSendEmailButtonVisible(record)) {
						visible = true;
						break;
					}
				}

				item.setVisible(visible);
			}
		};
	},

	/**
	 * Handler for the insertion points for extending the contacts and distribution dialogs
	 * with buttons to send a mail to the given contact or distribution list.
	 *
	 * @return {Object}
	 */
	createSendEmailButton: function () {
		return {
			xtype       : 'button',
			plugins     : ['zarafa.recordcomponentupdaterplugin'],
			iconCls     : 'icon_attachment',
			overflowText: dgettext('plugin_files', 'Send file'),
			tooltip     : {
				title: dgettext('plugin_files', 'Send file'),
				text : dgettext('plugin_files', 'Create a new email message with some files attached.')
			},
			handler     : function (btn) {
				Zarafa.plugins.files.data.Actions.openCreateMailContentForContacts(this.getModel(), btn.record);
			},
			scope       : this,
			update      : function (record, resetContent) {
				this.record = record;
				if (resetContent) {

					if (!this.scope.isSendEmailButtonVisible(record)) {
						this.hide();
					}
				}
			}
		}
	},

	/**
	 * Check if the given record (which represents a contact or distribution list)
	 * can be mailed (this requires the record not to be a {@link Ext.data.Record#phantom}
	 * and the contact should {@link Zarafa.contact.ContactRecord#hasEmailAddress have an email address}.
	 *
	 * @param record
	 * @return {Boolean}
	 */
	isSendEmailButtonVisible: function (record) {
		if (record.phantom) {
			return false;
		} else if (record.isMessageClass('IPM.Contact')) {
			if (!record.hasEmailAddress()) {
				return false;
			}
		}

		return true;
	},

	/**
	 * Returns the buttons for the dropdown list of the VIEW-button in the main toolbar. It will use the
	 * main.maintoolbar.view.files insertion point to allow other plugins to add their items at the end.
	 *
	 * @return {Array} An array of components.
	 */
	getMainToolbarViewButtons: function () {
		var items = container.populateInsertionPoint('main.maintoolbar.view.files', this) || [];

		var defaultItems = [{
			overflowText : dgettext('plugin_files', 'No preview'),
			iconCls      : 'icon_previewpanel_off',
			text         : dgettext('plugin_files', 'No preview'),
			valueViewMode: Zarafa.plugins.files.data.ViewModes.NO_PREVIEW,
			valueDataMode: Zarafa.plugins.files.data.DataModes.ALL,
			handler      : this.onContextSelectView,
			scope        : this
		}, {
			overflowText : dgettext('plugin_files', 'Right preview'),
			iconCls      : 'icon_previewpanel_right',
			text         : dgettext('plugin_files', 'Right preview'),
			valueViewMode: Zarafa.plugins.files.data.ViewModes.RIGHT_PREVIEW,
			valueDataMode: Zarafa.plugins.files.data.DataModes.ALL,
			handler      : this.onContextSelectView,
			scope        : this
		}, {
			overflowText : dgettext('plugin_files', 'Bottom preview'),
			iconCls      : 'icon_previewpanel_bottom',
			text         : dgettext('plugin_files', 'Bottom preview'),
			valueViewMode: Zarafa.plugins.files.data.ViewModes.BOTTOM_PREVIEW,
			valueDataMode: Zarafa.plugins.files.data.DataModes.ALL,
			handler      : this.onContextSelectView,
			scope        : this
		}];

		defaultItems.push();

		return defaultItems.concat(items);
	},

	/**
	 * Adds buttons to the main toolbar like the view switcher button.
	 *
	 * @return {Array}
	 */
	createMainToolbarButtons: function () {
		return [{
			xtype    : 'splitbutton',
			ref      : '../../../filesSwitchViewButton',
			tooltip  : dgettext('plugin_files', 'Switch view'),
			scale    : 'large',
			iconCls  : 'icon_viewswitch',
			handler  : function () {
				this.showMenu();
			},
			listeners: {
				afterrender: this.onAfterRenderMainToolbarButtons,
				scope      : this
			},
			menu     : new Ext.menu.Menu({
				items: [{
					text        : dgettext('plugin_files', 'List'),
					overflowText: dgettext('plugin_files', 'List'),
					tooltip     : dgettext('plugin_files', 'List'),
					iconCls     : 'icon_contact_list',
					valueView   : Zarafa.plugins.files.data.Views.LIST,
					handler     : this.onSwitchView,
					scope       : this
				}, {
					text        : dgettext('plugin_files', 'Icons'),
					overflowText: dgettext('plugin_files', 'Icons'),
					tooltip     : dgettext('plugin_files', 'Icons'),
					iconCls     : 'icon_note_icon_view',
					valueView   : Zarafa.plugins.files.data.Views.ICON,
					handler     : this.onSwitchView,
					scope       : this
				}]
			})
		}]
	},

	/**
	 * Registers to the {@link Zarafa.core.Container#contextswitch contextswitch} event on the
	 * {@link Zarafa.core.Container container} so the visiblity of the button can be toggled
	 * whenever the context is switched. We do this after the button is rendered.
	 *
	 * @param {Ext.Button} btn The button
	 */
	onAfterRenderMainToolbarButtons: function (btn) {
		btn.mon(container, 'contextswitch', function (parameters, oldContext, newContext) {
			this.setVisiblityMainToolbarButton(btn, newContext);
		}, this);

		btn.mon(this, 'viewchange', function (context, newView, oldView) {
			this.setVisiblityMainToolbarButton(btn, context);
		}, this);

		this.setVisiblityMainToolbarButton(btn);
	},

	/**
	 * Determines whether the passed button has to be shown or not based on what
	 * {@link Zarafa.core.Context Context} is active. If no Context is supplied as an argument it
	 * will get that from the {@link Zarafa.core.Container container}.
	 *
	 * @param {Ext.Button} btn The button.
	 * @param {Zarafa.core.Context} activeContext (Optionial} The active Context.
	 */
	setVisiblityMainToolbarButton: function (btn, activeContext) {
		activeContext = activeContext || container.getCurrentContext();
		if (activeContext === this) {
			btn.show();
		} else {
			btn.hide();
		}
	},

	/**
	 * Event handler which is fired when one of the view buttons has been pressed.
	 *
	 * @param {Ext.Button} button The button which was pressed
	 */
	onSwitchView: function (button) {
		var viewMode = this.getCurrentViewMode();
		this.switchView(button.valueView, viewMode);
	},

	/**
	 * Event handler which is fired when one of the View buttons
	 * has been pressed. This will call {@link #setView setView}
	 * to update the view.
	 *
	 * @param {Ext.Button} button The button which was pressed
	 */
	onContextSelectView: function (button) {
		this.getModel().setDataMode(button.valueDataMode);

		var view = button.valueView;
		var viewMode = button.valueViewMode;

		if (!Ext.isDefined(button.valueView)) {
			view = this.getCurrentView();
		}
		if (!Ext.isDefined(button.valueViewMode)) {
			viewMode = this.getCurrentViewMode();
		}

		this.switchView(view, viewMode);

		this.getModel().setPreviewRecord(undefined, true);
	},

	/**
	 * This method registers the Files module names to the main WebApp.
	 */
	registerModules: function () {
		Zarafa.core.ModuleNames['IPM.FILES'] = {
			list: 'filesbrowsermodule',
			item: 'filesbrowsermodule'
		}
	}
});

/**
 * This code gets executed after the WebApp has loaded.
 * It hooks the context to the WebApp.
 */
Zarafa.onReady(function () {

	if (container.getSettingsModel().get('zarafa/v1/plugins/files/enable') === true) {
		container.registerContext(new Zarafa.core.ContextMetaData({
			name             : 'filescontext',
			displayName      : dgettext('plugin_files', 'Files'),
			allowUserVisible : false,
			pluginConstructor: Zarafa.plugins.files.FilesContext
		}));
	}
});
