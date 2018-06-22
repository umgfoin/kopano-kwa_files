Ext.namespace('Zarafa.plugins.files.ui.snippets');

/**
 * @class Zarafa.plugins.files.ui.snippets.FilesNavigationBar
 * @extends Ext.Panel
 * @xtype filesplugin.navigationbar
 *
 * This panel will display a windows explorer like navigation bar.
 */
Zarafa.plugins.files.ui.snippets.FilesNavigationBar = Ext.extend(Ext.Panel, {

	/**
	 * @cfg {Zarafa.core.Context} context The context to which this toolbar belongs
	 */
	context: undefined,

	/**
	 * The {@link Zarafa.core.ContextModel} which is obtained from the {@link #context}.
	 * @property
	 * @type Zarafa.mail.MailContextModel
	 */
	model: undefined,

	/**
	 * Maximum path parts to show. If the folder path is deeper,
	 * a back arrow will be shown.
	 * @property
	 * @type {Number}
	 */
	maxPathBeforeTruncate: 5,

	/**
	 * @cfg {Number} maxStringBeforeTruncate Maximum stringlength of a folder before it will get truncated.
	 */
	maxStringBeforeTruncate: 20,

	/**
	 * @cfg {String} pathTruncateText String that will be displayed in the back button.
	 */
	pathTruncateText: "&hellip;",

	/**
	 * Overflow flag. If this flag is true, the overflow button will be shown.
	 * @property
	 * @type boolean
	 */
	hasOverflow: false,

	/**
	 * The current path.
	 *
	 * @property
	 * @type {String}
	 */
	currentPath: '#R#',

	/**
	 * filesStore which contains the {@link Zarafa.plugins.files.data.FilesRecord FilesRecord}.
	 *
	 * @property
	 * @type {Zarafa.plugins.files.data.FilesRecordStore}
	 */
	filesStore : undefined,

	/**
	 * @constructor
	 * @param {Object} config Configuration object
	 */
	constructor: function (config) {
		config = config || {};

		if (Ext.isDefined(config.model) && !Ext.isDefined(config.filesStore)) {
			config.filesStore = config.model.getStore();
			this.currentPath = config.filesStore.getPath();
		}

		Ext.applyIf(config, {
			xtype : 'filesplugin.navigationbar',
			maskDisabled: false,
			hideBorders : true,
			border : false,
			cls: 'navbar_container',
			height: 25,
			defaults: {
				height: 25
			},
			layout : 'column',
		});

		Zarafa.plugins.files.ui.snippets.FilesNavigationBar.superclass.constructor.call(this, config);
	},

	/**
	 * initializes the events.
	 * @private
	 */
	initEvents: function () {
		this.mon(this.filesStore, {
			'beforeload': this.onStoreLoad,
			scope       : this
		});

		this.on('afterrender', this.generateNavigationButtons.createDelegate(
			this,
			[
				Zarafa.plugins.files.data.Utils.File.stripAccountId(this.currentPath),
				Zarafa.plugins.files.data.Utils.File.getAccountId(this.currentPath)
			]
		), this);
	},

	/**
	 * Event handler which will be called when the {@link #store} fires the
	 * {@link Zarafa.plugins.files.data.FilesRecordStore#beforeload} event.
	 *
	 * @param {Zarafa.plugins.files.data.FilesRecordStore} store the files store.
	 * @private
	 */
	onStoreLoad: function (store)
	{
		var currentPath = store.getPath();
		if(this.currentPath !== currentPath) {
			this.currentPath = currentPath;
			var accID = Zarafa.plugins.files.data.Utils.File.getAccountId(currentPath);
			var backendPath = Zarafa.plugins.files.data.Utils.File.stripAccountId(currentPath);
			this.generateNavigationButtons(backendPath, accID);
		}
	},

	/**
	 * Calculate the maximum number of folders we can display.
	 * @private
	 */
	recalculateMaxPath: function() {
		var maxItemWidth = this.maxStringBeforeTruncate * 8; // one char is 8 pixels long
		var totalWidth = this.getWidth();
		var children = this.items ? this.items.items : [];
		var removeStatic = this.hasOverflow ? 3 : 2; // -2 because home and account folder does not count

		Ext.each(children, function (child) {
			totalWidth -= child.getWidth();
		});

		if(totalWidth < maxItemWidth) {
			// we need more space - remove first children
			// so we need at least maxItemWidth - totalWidth;

			var spaceNeeded = maxItemWidth - totalWidth;
			var childrenToRemove = 0;

			Ext.each(children, function (child) {
				spaceNeeded -= child.getWidth();
				childrenToRemove++;

				if(spaceNeeded <= 0) {
					return false;
				}
			});

			this.maxPathBeforeTruncate = children.length - childrenToRemove;
		} else {
			this.maxPathBeforeTruncate = Math.floor(children.length + (totalWidth / maxItemWidth));
		}
		this.maxPathBeforeTruncate = this.maxPathBeforeTruncate - removeStatic;
	},

	/**
	 * Create home button in navigation bar.
	 */
	createHomeButton : function()
	{
		// Added Home button in files navigation bar.
		this.add({
			xtype : 'button',
			cls: "files_navbar_button files_navbar_button_first",
			tooltip: dgettext('plugin_files', 'Home'),
			path: "#R#", // root folder
			listeners: {
				click: this.doNavButtonClick,
				scope : this
			},
			iconCls: "files_navbar files_navbar_home"
		});
	},

	/**
	 * Create backend root button in navigation bar.
	 * @param {String} path The path of selected node/button in files navigation bar.
	 * @param {String} accountID The accountID of selected configured account.
	 * @param {Boolean} isLastButton true if selected node/button is last button in
	 * navigation bar
	 */
	createBackEndRootButton : function (path, accountID, isLastButton)
	{
		if (Ext.isEmpty(accountID)) {
			return;
		}

		var account = this.accountsStore.getById(accountID);
		if (Ext.isEmpty(account)) {
			return;
		}

		var lastCls = isLastButton ? " files_navbar_button_last" : "";
		var accountName = Zarafa.plugins.files.data.Utils.Format.truncate(account.get("name"), this.maxStringBeforeTruncate);
		var accButton = {
			xtype : 'button',
			cls : "files_navbar_button" + lastCls,
			path : "#R#" + accountID + "/",
			listeners : {
				click : this.doNavButtonClick,
				scope : this
			},
			text : accountName
		};

		// If account name is not set by user then show account backend icon
		if (Ext.isEmpty(accountName)) {
			accButton.iconCls = "files_navbar icon_16_" + account.get("backend");
		}
		this.add(accButton);
	},

	/**
	 * Create buttons for the given folder path.
	 *
	 * @param path
	 * @param accountID
	 */
	generateNavigationButtons: function (path, accountID)
	{
		// recalculate the width
		this.recalculateMaxPath();

		// first remove old buttons
		this.removeAll(true);

		// Create home button.
		this.createHomeButton();
		var isLastButton = path.indexOf("/") === -1 || path === "/";
		// Create Backend root button.
		this.createBackEndRootButton(path, accountID, isLastButton);

		if (!isLastButton) {
			var currPath = "/";
			var pathParts = path.replace(/^\/|\/$/g, '').split("/"); // trim leading and trailing slash and split afterwards

			if(pathParts.length > this.maxPathBeforeTruncate) {
				this.hasOverflow = true;

				var overflowParts = pathParts.splice(0, (pathParts.length - this.maxPathBeforeTruncate));

				var menu = [];
				Ext.each(overflowParts, function (pathPart) {
					currPath += pathPart + "/";
					menu.push({
						text: Zarafa.plugins.files.data.Utils.Format.truncate(pathPart, this.maxStringBeforeTruncate),
						handler: this.doNavButtonClick,
						iconCls: 'icon_folder_note',
						path: "#R#" + accountID + currPath,
						scope : this
					});
				}, this);

				var overflowButton = new Ext.Button({
					cls: "files_navbar_button",
					menu: menu,
					text : this.pathTruncateText
				});
				this.add(overflowButton);
			} else {
				this.hasOverflow = false;
			}

			Ext.each(pathParts, function (pathPart, index) {
				currPath += pathPart + "/";
				var lastCls = index == (pathParts.length-1) ? " files_navbar_button_last" : "";
				var navBtn = new Ext.Button({
					text: Zarafa.plugins.files.data.Utils.Format.truncate(pathPart, this.maxStringBeforeTruncate),
					cls: "files_navbar_button" + lastCls,
					path: "#R#" + accountID + currPath,
					listeners: {
						click: this.doNavButtonClick,
						scope : this
					}
				});
				this.add(navBtn);
			}, this);
		}

		this.doLayout();
	},

	/**
	 * Eventhandler that handles a navigation button click.
	 *
	 * @param button
	 * @param event
	 */
	doNavButtonClick: function(button, event)
	{
		if(button.path === '#R#') {
			this.model.setPreviewRecord(undefined);
		}
		this.filesStore.loadPath(button.path);
	}
});

Ext.reg('filesplugin.navigationbar', Zarafa.plugins.files.ui.snippets.FilesNavigationBar);
