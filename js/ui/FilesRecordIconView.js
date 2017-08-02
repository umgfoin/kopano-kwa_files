Ext.namespace('Zarafa.plugins.files.ui');

Zarafa.plugins.files.ui.FilesRecordIconView = Ext.extend(Zarafa.common.ui.DraggableDataView, {

	context: undefined,

	model: undefined,

	dropTarget: undefined,

	keyMap: undefined,

	constructor: function (config) {
		config = config || {};

		if (!Ext.isDefined(config.model) && Ext.isDefined(config.context)) {
			config.model = config.context.getModel();
		}
		if (!Ext.isDefined(config.store) && Ext.isDefined(config.model)) {
			config.store = config.model.getStore();
		}

		config.store = Ext.StoreMgr.lookup(config.store);

		config.plugins = Ext.value(config.plugins, []);
		config.plugins.push('zarafa.icondragselectorplugin');

		Ext.applyIf(config, {
			xtype: 'filesplugin.filesrecordiconview',

			cls           : 'zarafa-files-iconview',
			loadingText   : dgettext('plugin_files', 'Loading files') + '...',
			deferEmptyText: false,
			autoScroll    : true,
			emptyText     : '<div class="emptytext">' + dgettext('plugin_files', 'There are no items to show in this view') + '</div>',
			overClass     : 'zarafa-files-iconview-over',
			tpl           : this.initTemplate(),
			multiSelect   : true,
			selectedClass : 'zarafa-files-iconview-selected',
			itemSelector  : 'div.zarafa-files-iconview-thumb',
			enableDragDrop: true,
			ddGroup       : 'dd.filesrecord'
		});

		Zarafa.plugins.files.ui.FilesRecordIconView.superclass.constructor.call(this, config);

		this.initEvents();
	},

	initTemplate: function () {
		return new Ext.XTemplate(
			'<div style="height: 100%; width: 100%; overflow: auto;">',
			'<tpl for=".">',
			'<div class="zarafa-files-iconview-container {.:this.getHidden}">',
			'<div class="zarafa-files-iconview-thumb {.:this.getTheme} {.:this.getHidden}">',
			'</div>',
			'<span class="zarafa-files-iconview-subject">{filename:htmlEncode}</span>',
			'</div>',
			'</tpl>',
			'</div>',
			{

				getHidden: function (record) {
					if (record.filename === "..") {
						return "files_type_hidden";
					}

					return "";
				},

				getTheme: function (record) {

					switch (record.type) {
						case Zarafa.plugins.files.data.FileTypes.FOLDER:
							return Zarafa.plugins.files.data.Utils.File.getIconClass("folder");
							break;
						case Zarafa.plugins.files.data.FileTypes.FILE:
							return Zarafa.plugins.files.data.Utils.File.getIconClass(record.filename);
							break;
						default:
							return 'files48icon_blank';
							break;
					}
				}
			}
		);
	},

	getMainPanel: function () {
		return this.ownerCt;
	},

	initEvents: function () {
		this.on({
			'contextmenu'    : this.onFilesIconContextMenu,
			'dblclick'       : this.onIconDblClick,
			'selectionchange': this.onSelectionChange,
			'afterrender'    : this.onAfterRender,
			scope            : this
		});
	},

	onAfterRender: function () {

		this.keyMap = new Ext.KeyMap(this.getEl(), {
			key: Ext.EventObject.DELETE,
			fn : this.onKeyDelete.createDelegate(this)
		});

		this.initDropTarget();
	},

	onKeyDelete: function (key, event) {
		var selections = this.getSelectedRecords();
		Zarafa.plugins.files.data.Actions.deleteRecords(selections);
	},

	initDropTarget: function () {
		var iconViewDropTargetEl = this.getEl();

		iconViewDropTargetEl.dom.addEventListener("dragstart", function (e) {
			e.dataTransfer.effectAllowed = "copy";
			e.preventDefault();
			e.stopPropagation();
		}, false);

		iconViewDropTargetEl.dom.addEventListener("dragenter", function (e) {
			e.preventDefault();
			e.stopPropagation();
		}, false);

		iconViewDropTargetEl.dom.addEventListener("dragover", function (e) {
			e.dataTransfer.dropEffect = "copy";
			e.preventDefault();
			e.stopPropagation();
		}, false);

		iconViewDropTargetEl.dom.addEventListener("dragleave", function (e) {
			e.preventDefault();
			e.stopPropagation();
		}, false);

		iconViewDropTargetEl.dom.addEventListener("drop", function (e) {
			e.preventDefault();
			e.stopPropagation();

			var dt = e.dataTransfer;
			var files = dt.files;

			Zarafa.plugins.files.data.Actions.uploadAsyncItems(files, Zarafa.plugins.files.data.ComponentBox.getStore());

			return false;
		}, false);

		this.dropTarget = new Ext.dd.DropTarget(iconViewDropTargetEl, {
			ddGroup    : 'dd.filesrecord',
			copy       : false,
			fileStore  : this.getStore(),
			notifyDrop : function (ddSource, e, data) {

				if (this.notifyOver(ddSource, e, data) !== this.dropAllowed) {
					return false;
				}

				var dragData = ddSource.getDragData(e);

				if (Ext.isDefined(dragData)) {
					var cellindex = dragData.index;
					var dropTarget = this.fileStore.getAt(cellindex);
					if (Ext.isDefined(cellindex) && dropTarget.get('type') === Zarafa.plugins.files.data.FileTypes.FOLDER) {

						Ext.each(data.selections, function (record) {
							record.setDisabled(true);
						});

						return Zarafa.plugins.files.data.Actions.moveRecords(data.selections, dropTarget);
					}
				}

				return false;
			},
			notifyOver : function (ddSource, e, data) {
				var dragData = ddSource.getDragData(e);
				var ret = this.dropNotAllowed;

				if (Ext.isDefined(dragData)) {
					var cellindex = dragData.index;

					if (Ext.isDefined(cellindex)) {
						var dropTarget = this.fileStore.getAt(cellindex);

						if (dropTarget.get('type') === Zarafa.plugins.files.data.FileTypes.FOLDER) {
							ret = this.dropAllowed;
						}

						Ext.each(data.selections, function (record) {
							var srcId = record.get("id");
							var trgId = dropTarget.get("id");
							if (srcId === trgId || record.get("filename") === ".." || trgId.slice(0, srcId.length) === srcId) {
								ret = this.dropNotAllowed;
								return false;
							}
						}, this);
					}
				}
				return ret;
			},
			notifyEnter: function (ddSource, e, data) {
				return this.notifyOver(ddSource, e, data);
			}
		});

		this.dragZone.onBeforeDrag = function (data, e) {
			var ret = true;
			var selectedRowInSelection = false;
			var selectedItem = this.view.getStore().getAt(data.index);

			Ext.each(data.selections, function (record) {
				if (selectedItem.get("id") === record.get("id")) {
					selectedRowInSelection = true;
				}
				if (record.getDisabled()) {
					ret = false;
					return false;
				}
			});

			if (selectedRowInSelection) {
				return ret;
			} else {

				if (selectedItem.getDisabled()) {
					return false;
				} else {
					return true;
				}
			}
		}
	},

	onFilesIconContextMenu: function (dataview, index, node, eventObj) {

		if (!dataview.isSelected(node)) {
			dataview.select(node);
		}

		var records = dataview.getSelectedRecords();

		var show = true;
		Ext.each(records, function (record) {
			if (record.getDisabled() === true) {
				show = false;
				return;
			}
		});

		if (show) {
			Zarafa.core.data.UIFactory.openDefaultContextMenu(records, {
				position: eventObj.getXY(),
				context : this.context
			});
		}
	},

	onIconDblClick: function (dataview, index, node, event) {
		var record = this.getStore().getAt(index);
		Zarafa.plugins.files.data.Actions.openFilesContent([record]);
	},

	onSelectionChange: function (dataView, selections) {
		this.model.setSelectedRecords(dataView.getSelectedRecords());

		var viewMode = this.context.getCurrentViewMode();

		var records = dataView.getSelectedRecords();
		var count = records.length;

		if (viewMode != Zarafa.plugins.files.data.ViewModes.NO_PREVIEW) {
			if (count != 1) {
				this.model.setPreviewRecord(undefined);
			} else if (count == 1) {
				if (records[0].get('id') !== (container.getSettingsModel().get('zarafa/v1/contexts/files/files_path') + "/") && records[0].get('filename') !== "..") {
					this.model.setPreviewRecord(records[0]);
				} else {
					this.model.setPreviewRecord(undefined);
				}
			}
		}
	}
});

Ext.reg('filesplugin.filesrecordiconview', Zarafa.plugins.files.ui.FilesRecordIconView);
