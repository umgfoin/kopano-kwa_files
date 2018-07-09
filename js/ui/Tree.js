Ext.namespace('Zarafa.plugins.files.ui');

/**
 * @class Zarafa.plugins.files.ui.Tree
 * @extends Ext.tree.TreePanel
 * @xtype filesplugin.tree
 *
 * The hierarchy tree panel implementation for files.
 */
Zarafa.plugins.files.ui.Tree = Ext.extend(Ext.tree.TreePanel, {

	/**
	 * @cfg {array|String} array of account ids or a single account id that should be loaded.
	 */
	accountFilter: null,

	/**
	 * @cfg {Object} treeSorter a {@link Ext.Ext.tree.TreeSorter} config or {@link Boolean}
	 * to sort the {@linkZarafa.plugins.files.ui.Tree Tree}
	 * Defaults to <code>true</code>.
	 */
	treeSorter : true,

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
			xtype : 'filesplugin.tree',
			enableDD : true,
			ddGroup : 'dd.filesrecord',
			ddAppendOnly : true,
			pathSeparator: '&',
			root : {
				nodeType: 'async',
				text : 'Files',
				id : '#R#',
				expanded: true,
				cc : false
			},
			rootVisible : false,
			autoScroll : true,
			maskDisabled : true,
			loader : new Zarafa.plugins.files.data.NavigatorTreeLoader({
				loadfiles : false,
				accountFilter: this.accountFilter
			})
		});
		Zarafa.plugins.files.ui.Tree.superclass.constructor.call(this, config);

		if(this.treeSorter && !(this.treeSorter instanceof Ext.tree.TreeSorter)) {
			this.treeSorter = new Ext.tree.TreeSorter(this);
		}
	},

	/**
	 * Function which is create the {@link Zarafa.plugins.files.data.FilesRecord record} from
	 * give tree node.
	 *
	 * @param {Ext.tree.AsyncTreeNode} node asynchronous tree node.
	 * @return {Zarafa.plugins.files.data.FilesRecord} returns folder record.
	 */
	convertNodeToRecord : function (node)
	{
		var fileRecord = Zarafa.core.data.RecordFactory.createRecordObjectByObjectType(Zarafa.core.data.RecordCustomObjectType.ZARAFA_FILES, {
			'id' : node.attributes.id,
			'filename' : node.attributes.filename,
			'path' : node.attributes.path,
			'type' : node.attributes.isFolder ? Zarafa.plugins.files.data.FileTypes.FOLDER : Zarafa.plugins.files.data.FileTypes.FILE,
			'entryid' : node.attributes.id,
			'message_class' : 'IPM.Files'
		},node.attributes.id);
		fileRecord.store = this.filesStore;
		return fileRecord;
	},

	/**
	 * Recursive function to select a node. The whole path to the node will be expanded.
	 *
	 * @param {Ext.tree.AsyncTreeNode} node asynchronous tree node.
	 * @param {Ext.tree.AsyncTreeNode} childnode asynchronous tree child node.
	 */
	selectNode: function (node, childnode) {
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
	}
});

Ext.reg('filesplugin.tree', Zarafa.plugins.files.ui.Tree);
