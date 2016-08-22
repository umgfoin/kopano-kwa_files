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
	 * @constructor
	 * @param {Object} config Configuration object
	 */
	constructor: function (config) {
		config = config || {};

		if (!Ext.isDefined(config.model) && Ext.isDefined(config.context)) {
			config.model = config.context.getModel();
		}

		Ext.applyIf(config, {
			xtype       : 'filesplugin.navigationbar',
			maskDisabled: false,
			hideBorders : true,
			border      : false,
			cls: 'navbar_container',
			height: 25,
			defaults: {
				height: 25
			},
			layout      : 'column',
			items       : []
		});

		Zarafa.plugins.files.ui.snippets.FilesNavigationBar.superclass.constructor.call(this, config);
	},

	/**
	 * initializes the events.
	 * @private
	 */
	initEvents: function () {
		var filesStore = Zarafa.plugins.files.data.ComponentBox.getStore();

		this.mon(filesStore, {
			'beforeload': this.onStoreLoad,
			scope       : this
		});

		// do the inital check after rendering
		this.currentPath = filesStore.getPath();
		this.on('afterrender', this.generateNavigationButtons.createDelegate(
			this,
			[
				Zarafa.plugins.files.data.Utils.File.stripAccountId(this.currentPath),
				Zarafa.plugins.files.data.Utils.File.getAccountId(this.currentPath)
			]
		), this, {single: true});
	},

	/**
	 * Event handler which will be called when the {@link #store} fires the
	 * {@link Zarafa.plugins.files.data.FilesRecordStore#beforeload} event.
	 *
	 * @param {Zarafa.plugins.files.data.FilesRecordStore} store the files store.
	 * @param {Array} records
	 * @param {Object} options
	 * @private
	 */
	onStoreLoad: function (store, records, options) {
		var currentPath = store.getPath();
		var accID = Zarafa.plugins.files.data.Utils.File.getAccountId(currentPath);
		var backendPath = Zarafa.plugins.files.data.Utils.File.stripAccountId(currentPath);
		if(this.currentPath != currentPath) {
			this.currentPath = currentPath;
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
	 * Create buttons for the given folder path.
	 *
	 * @param path
	 * @param accountID
	 */
	generateNavigationButtons: function (path, accountID) {

		// recalculate the width
		this.recalculateMaxPath();

		// first remove old buttons
		this.removeAll(true);

		var accStore = Zarafa.plugins.files.data.singleton.AccountStore.getStore();

		// look up the account
		var account = null;

		if (!Ext.isEmpty(accountID)) {
			account = accStore.getById(accountID);
		}

		var homeButton = new Ext.Button({
			cls: "files_navbar_button files_navbar_button_first",
			path: "#R#", // root folder
			listeners: {
				click: this.doNavButtonClick
			},
			iconCls: "files_navbar files_navbar_home"
		});
		this.add(homeButton);

		if (!Ext.isEmpty(accountID) && Ext.isDefined(account)) {
			var lastCls = (path.indexOf("/") === -1 || path === "/") ? " files_navbar_button_last" : "";
			var accountName = Zarafa.plugins.files.data.Utils.Format.truncate(account.get("name"), this.maxStringBeforeTruncate);
			var accButton = new Ext.Button({
				cls: "files_navbar_button" + lastCls,
				path: "#R#" + accountID + "/", // backend root folder
				listeners: {
					click: this.doNavButtonClick
				},
				text   : accountName
			});

			// If account name is not set by user then show account backend icon
			if (accountName === '') {
				accButton.setIconClass("files_navbar icon_16_" + account.get("backend"));
			}
			this.add(accButton);
		}

		if (path.indexOf("/") !== -1 && path !== "/") {
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
						path: "#R#" + accountID + currPath
					});
				}, this);

				var overflowButton = new Ext.Button({
					cls: "files_navbar_button",
					menu: menu,
					text   : this.pathTruncateText
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
						click: this.doNavButtonClick
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
	doNavButtonClick: function(button, event) {
		// read the path property
		var path = button.path;

		// reload main store
		Zarafa.plugins.files.data.ComponentBox.getStore().loadPath(path);

		// reselect navigator tree
		var accountID = Zarafa.plugins.files.data.Utils.File.getAccountId(path);
		var nav = Zarafa.plugins.files.data.ComponentBox.getNavigatorTreePanel(accountID);

		if(nav) {
			var n = nav.getNodeById(path);
			if (Ext.isDefined(n)) {
				n.select();
			}
		}
	}
});

Ext.reg('filesplugin.navigationbar', Zarafa.plugins.files.ui.snippets.FilesNavigationBar);
