Ext.namespace('Zarafa.plugins.files.ui');

/**
 * @class Zarafa.plugins.files.ui.NavigatorTreePanel
 * @extends Ext.tree.TreePanel
 * @xtype filesplugin.navigatortreepanel
 *
 * The hierarchy tree panel implementation for files.
 */
Zarafa.plugins.files.ui.NavigatorTreePanel = Ext.extend(Ext.tree.TreePanel, {

	/**
	 * @property {String} nodeToSelect is the path of the node that should be selected.
	 */
	nodeToSelect: null,

	/**
	 * @cfg {array|String} array of account ids or a single account id that should be loaded.
	 */
	accountFilter: null,

	/**
	 * @constructor
	 * @param config
	 */
	constructor: function (config) {
		config = config || {};

		if (Ext.isDefined(config.accountFilter)) {
			this.accountFilter = config.accountFilter;
		}

		Ext.applyIf(config, {
			xtype        : 'filesplugin.navigatortreepanel',
			enableDD     : true,
			ddGroup      : 'dd.filesrecord',
			ddAppendOnly : true,
			pathSeparator: '&',
			root         : {
				nodeType: 'async',
				text    : 'Files',
				id      : '#R#',
				expanded: true,
				cc      : false
			},
			rootVisible  : false,
			listeners    : {
				click         : this.onNodeClick,
				load          : this.treeNodeLoaded,
				beforenodedrop: this.onBeforeNodeDrop,
				expandnode    : this.onExpandNode,
				nodedragover  : this.onNodeDragOver,
				afterrender   : this.onAfterRender,
				contextmenu   : this.onContextMenu,
				scope         : this
			},
			autoScroll   : true,
			bodyCssClass : 'files-context-navigation-node',
			viewConfig   : {
				style: {overflow: 'auto', overflowX: 'hidden'}
			},
			maskDisabled : true,
			loader       : new Zarafa.plugins.files.data.NavigatorTreeLoader({
				loadfiles    : false,
				accountFilter: this.accountFilter
			})
		});
		Zarafa.plugins.files.ui.NavigatorTreePanel.superclass.constructor.call(this, config);
	},

	/**
	 * The {@link Ext.tree.TreePanel#expandnode} event handler. It will silently load the children of the node.
	 * This is used to check if a node can be expanded or not.
	 *
	 * @param {Ext.tree.AsyncTreeNode} node
	 * @returns {*}
	 */
	onExpandNode: function (node) {
		node.attributes["cc"] = true;
		// check if a folder should be preloaded
		if(container.getSettingsModel().get('zarafa/v1/contexts/files/preload_folder')) {
			node.eachChild(function (child) {
				if (child.attributes["cc"] !== true) { // only check if it was not checked before
					child.attributes["cc"] = true;
					child.quietLoad();
				}
			});
		}
	},

	/**
	 * The {@link Ext.tree.TreePanel#beforenodedrop} event handler. It will move dropped nodes to the new
	 * location.
	 *
	 * @param event
	 * @returns {*}
	 */
	onBeforeNodeDrop: function (event) {

		if (Ext.isArray(event.data.selections)) {

			event.cancel = false;

			Ext.each(event.data.selections, function (record) {
				record.setDisabled(true);
			});

			return Zarafa.plugins.files.data.Actions.moveRecords(event.data.selections, event.target);
		}

	},

	/**
	 * The {@link Ext.tree.TreePanel#nodedragover} event handler. This function will check if dropping a node on
	 * this hovered node is allowed. (For example: same account check)
	 *
	 * @param event
	 * @returns {boolean}
	 */
	onNodeDragOver: function (event) {
		var ret = true;

		Ext.each(event.data.selections, function (record) {
			var srcId = record.get("id");
			var srcParentId = srcId.replace(/\\/g, '/').replace(/\/[^\/]*\/?$/, '') + "/";
			var trgId = event.target.id;

			// check if user wants to drop file to different account (not implemented yet)
			var srcAcc = Zarafa.plugins.files.data.Utils.File.getAccountId(srcId);
			var dstAcc = Zarafa.plugins.files.data.Utils.File.getAccountId(trgId);
			if (srcAcc != dstAcc) {
				ret = false;
				return false;
			}

			// check if we have a valid target
			if (srcId === trgId || trgId.slice(0, srcId.length) === srcId || srcParentId === trgId) {
				ret = false;
				return false;
			}
		}, this);

		return ret;
	},

	/**
	 * The {@link Ext.tree.TreePanel#click} event handler. This function will expand the node after it was clicked.
	 *
	 * @param node
	 */
	onNodeClick: function (node) {
		this.nodeToSelect = node.attributes.id;
		Zarafa.plugins.files.data.ComponentBox.getStore().loadPath(this.nodeToSelect);
		Zarafa.plugins.files.ui.FilesContextNavigatorBuilder.unselectAllNavPanels();

		var n = this.getNodeById(this.nodeToSelect);
		if (Ext.isDefined(n)) {
			n.expand();
		}
	},

	/**
	 * The {@link Ext.tree.TreePanel#afterrender} event handler. The DropZone needs to set up after the panel
	 * has been rendered.
	 *
	 * @param treepanel
	 */
	onAfterRender: function (treepanel) {
		this.dragZone.lock();
		this.dropZone = new Ext.tree.TreeDropZone(this, {
			ddGroup: this.ddGroup, appendOnly: this.ddAppendOnly === true
		});
	},

	/**
	 * The {@link Ext.tree.TreePanel#load} event handler. After a node was loaded - select it.
	 *
	 * @param node
	 */
	treeNodeLoaded: function (node) {
		this.getLoader().setReload(false);
		node.setLeaf(false); // we do always have folders!

		var nToSelect = null;
		if (!Ext.isEmpty(this.nodeToSelect)) {
			nToSelect = this.getNodeById(this.nodeToSelect);
		} else {
			nToSelect = this.getNodeById("#R#");
		}

		this.selectNode(nToSelect);
	},

	/**
	 * Recursive function to select a node. The whole path to the node will be expanded.
	 *
	 * @param node
	 * @param childnode
	 */
	selectNode: function (node, childnode) {
		Zarafa.plugins.files.ui.FilesContextNavigatorBuilder.unselectAllNavPanels();

		if (!Ext.isDefined(childnode)) {
			this.nodeToSelect = node.id;
		}

		if (Ext.isDefined(childnode) && childnode.rendered) {
			childnode.select();
			childnode.expand();
		} else if (Ext.isDefined(node) && node.rendered) {
			node.select();
			node.expand();
		} else {

			var parentNode = node.id.replace(/\\/g, '/').replace(/\/[^\/]*\/?$/, '') + "/";
			var nToSelectParent = this.getNodeById(parentNode);
			if (Ext.isDefined(nToSelectParent)) {
				nToSelectParent.on("expand", this.selectNode.createDelegate(this, [node], true), this, {single: true});
			}
		}
	},

	/**
	 * This method will reload the given node.
	 *
	 * @param nodeId
	 * @param child
	 */
	refreshNode: function (nodeId, child) {
		var node = this.getNodeById(nodeId);
		if (!Ext.isDefined(child)) {
			this.nodeToSelect = nodeId;
		}

		if (!Ext.isEmpty(node)) {
			this.getLoader().setReload(true);
			node.reload();

			if (node.hasChildNodes()) {
				node.expand();
			}
		}
	},

	convertNodeToRecord: function (node) {
		var fileRecord = Zarafa.core.data.RecordFactory.createRecordObjectByObjectType(Zarafa.core.data.RecordCustomObjectType.ZARAFA_FILES);

		// apply data
		fileRecord.set('id', node.attributes.id);
		fileRecord.set('filename', node.attributes.filename);
		fileRecord.set('path', node.attributes.path);
		fileRecord.set('type', node.attributes.isFolder ? Zarafa.plugins.files.data.FileTypes.FOLDER : Zarafa.plugins.files.data.FileTypes.FILE);
		fileRecord.entryid = node.attributes.id;
		fileRecord.id = node.attributes.id;
		fileRecord.store = Zarafa.plugins.files.data.ComponentBox.getStore();

		return fileRecord;
	},

	/**
	 * Eventhandler for the context menu event. This will show the default content menu.
	 *
	 * @param node
	 * @param event
	 */
	onContextMenu: function (node, event) {
		Zarafa.core.data.UIFactory.openContextMenu(Zarafa.core.data.SharedComponentType['zarafa.plugins.files.treecontextmenu'], [this.convertNodeToRecord(node)], {
			position: event.getXY(),
			context : Zarafa.plugins.files.data.ComponentBox.getContext()
		});
	}
});

Ext.reg('filesplugin.navigatortreepanel', Zarafa.plugins.files.ui.NavigatorTreePanel);