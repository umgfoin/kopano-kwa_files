Ext.namespace('Zarafa.plugins.files.ui');

Zarafa.plugins.files.ui.FilesRecordGridView = Ext.extend(Zarafa.common.ui.grid.GridPanel, {

	context: undefined,

	model: undefined,

	dropTarget: undefined,

	constructor: function (config) {
		config = config || {};

		if (!Ext.isDefined(config.model) && Ext.isDefined(config.context)) {
			config.model = config.context.getModel();
		}

		if (!Ext.isDefined(config.store) && Ext.isDefined(config.model)) {
			config.store = config.model.getStore();
		}

		config.store = Ext.StoreMgr.lookup(config.store);

		Ext.applyIf(config, {
			xtype                     : 'filesplugin.filesrecordgridview',
			ddGroup                   : 'dd.filesrecord',
			id                        : 'files-gridview',
			enableDragDrop            : true,
			border                    : false,
			stateful                  : true,
			statefulRelativeDimensions: false,
			loadMask                  : this.initLoadMask(),
			viewConfig                : this.initViewConfig(),
			sm                        : this.initSelectionModel(),
			cm                        : this.initColumnModel(),
			keys                      : {
				key    : Ext.EventObject.DELETE,
				handler: this.onKeyDelete,
				scope  : this
			}
		});
		Zarafa.plugins.files.ui.FilesRecordGridView.superclass.constructor.call(this, config);

	},

	initEvents: function () {
		Zarafa.plugins.files.ui.FilesRecordGridView.superclass.initEvents.call(this);

		this.mon(this, 'cellcontextmenu', this.onCellContextMenu, this);
		this.mon(this, 'rowbodycontextmenu', this.onRowBodyContextMenu, this);
		this.mon(this, 'rowdblclick', this.onRowDblClick, this);
		this.mon(this, 'afterrender', this.initDropTarget, this);

		this.mon(this.getSelectionModel(), 'beforerowselect', this.onBeforeRowSelect, this, {buffer: 1});
		this.mon(this.getSelectionModel(), 'rowselect', this.onRowSelect, this, {buffer: 1});
		this.mon(this.getSelectionModel(), 'selectionchange', this.onSelectionChange, this, {buffer: 1});

		this.mon(this.context, 'viewmodechange', this.onContextViewModeChange, this);
		this.onContextViewModeChange(this.context, this.context.getCurrentViewMode());
	},

	initLoadMask: function () {
		return {
			msg: dgettext('plugin_files', 'Loading files') + '...'
		};
	},

	initViewConfig: function () {
		return {

			enableRowBody: false,

			rowSelectorDepth: 15
		};
	},

	initSelectionModel: function () {
		return new Ext.grid.RowSelectionModel();
	},

	initColumnModel: function () {
		return new Zarafa.plugins.files.ui.FilesRecordGridColumnModel();
	},

	initDropTarget: function () {
		var gridDropTargetEl = this.getView().el.dom.childNodes[0].childNodes[1];

		gridDropTargetEl.addEventListener("dragstart", function (e) {
			e.dataTransfer.effectAllowed = "copy";
			e.preventDefault();
			e.stopPropagation();
		}, false);

		gridDropTargetEl.addEventListener("dragenter", function (e) {
			e.preventDefault();
			e.stopPropagation();
		}, false);

		gridDropTargetEl.addEventListener("dragover", function (e) {
			e.dataTransfer.dropEffect = "copy";
			e.preventDefault();
			e.stopPropagation();
		}, false);

		gridDropTargetEl.addEventListener("dragleave", function (e) {
			e.preventDefault();
			e.stopPropagation();
		}, false);

		gridDropTargetEl.addEventListener("drop", function (e) {
			e.preventDefault();
			e.stopPropagation();

			var dt = e.dataTransfer;
			var files = dt.files;

			Zarafa.plugins.files.data.Actions.uploadAsyncItems(files, Zarafa.plugins.files.data.ComponentBox.getStore());

			return false;
		}, false);

		this.dropTarget = new Ext.dd.DropTarget(gridDropTargetEl, {
			ddGroup   : 'dd.filesrecord',
			copy      : false,
			gridStore : this.getStore(),
			gridSM    : this.getSelectionModel(),
			notifyDrop: function (ddSource, e, data) {

				if (this.notifyOver(ddSource, e, data) !== this.dropAllowed) {
					return false;
				}

				var cellindex = ddSource.getDragData(e).rowIndex;
				var dropTarget = this.gridStore.getAt(cellindex);
				if (Ext.isDefined(cellindex) && dropTarget.get('type') === Zarafa.plugins.files.data.FileTypes.FOLDER) {

					Ext.each(data.selections, function (record) {
						record.setDisabled(true);
					});

					return Zarafa.plugins.files.data.Actions.moveRecords(data.selections, dropTarget);
				} else {
					return false;
				}
			},
			notifyOver: function (ddSource, e, data) {
				var cellindex = ddSource.getDragData(e).rowIndex;
				var ret = this.dropNotAllowed;

				if (Ext.isDefined(cellindex)) {
					var dropTarget = this.gridStore.getAt(cellindex);

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

				return ret;
			},

			notifyEnter: function (ddSource, e, data) {
				return this.notifyOver(ddSource, e, data);
			}
		});

		this.getView().dragZone.onBeforeDrag = function (data, e) {
			var ret = true;
			var selectedRowInSelection = false;
			var selectedItem = data.grid.getStore().getAt(data.rowIndex);

			Ext.each(data.selections, function (record) {
				if (selectedItem.get("id") === record.get("id")) {
					selectedRowInSelection = true;
				}
				if (record.get("filename") === ".." || record.getDisabled()) {
					ret = false;
					return false;
				}
			});

			if (selectedRowInSelection) {
				return ret;
			} else {

				if (selectedItem.get("filename") === ".." || selectedItem.getDisabled()) {
					return false;
				} else {
					return true;
				}
			}
		}
	},

	onContextViewModeChange: function (context, newViewMode, oldViewMode) {
		var compact = newViewMode === Zarafa.plugins.files.data.ViewModes.RIGHT_PREVIEW;

		this.getColumnModel().setCompactView(compact);
	},

	onCellContextMenu: function (grid, rowIndex, cellIndex, event) {
		var sm = this.getSelectionModel();
		var cm = this.getColumnModel();

		if (sm.hasSelection()) {

			if (!sm.isSelected(rowIndex)) {

				sm.clearSelections();
				sm.selectRow(rowIndex);
			}
		} else {

			sm.selectRow(rowIndex);
		}

		var column = {};

		if (cellIndex >= 0) {
			column = cm.getColumnById(cm.getColumnId(cellIndex));
		}

		var records = sm.getSelections();

		var show = true;
		Ext.each(records, function (record) {
			if (record.getDisabled() === true) {
				show = false;
				return;
			}
		});

		if (show) {
			Zarafa.core.data.UIFactory.openDefaultContextMenu(records, {
				position: event.getXY(),
				context : this.context,
				grid    : this
			});
		}
	},

	onRowBodyContextMenu: function (grid, rowIndex, event) {
		this.onCellContextMenu(grid, rowIndex, -1, event);
	},

	onRowDblClick: function (grid, rowIndex, e) {
		var record = grid.store.getAt(rowIndex);
		Zarafa.plugins.files.data.Actions.openFilesContent([record]);
	},

	onKeyDelete: function (key, event) {
		var selections = this.getSelectionModel().getSelections();

		Zarafa.plugins.files.data.Actions.deleteRecords(selections);
	},

	onBeforeRowSelect: function (sm, rowIndex, keepExisting, record) {
		return !record.getDisabled();
	},

	onRowSelect: function (selectionModel, rowNumber, record) {
		var viewMode = this.context.getCurrentViewMode();

		var count = selectionModel.getCount();

		if (viewMode != Zarafa.plugins.files.data.ViewModes.NO_PREVIEW) {
			if (count == 0) {
				this.model.setPreviewRecord(undefined);
			} else if (count == 1 && selectionModel.getSelected() === record) {
				if (record.get('id') !== (container.getSettingsModel().get('zarafa/v1/contexts/files/files_path') + "/") && record.get('filename') !== "..") {
					this.model.setPreviewRecord(record);
				} else {
					this.model.setPreviewRecord(undefined);
				}
			}
		}
	},

	onSelectionChange: function (selectionModel) {
		var selections = selectionModel.getSelections();
		var viewMode = this.context.getCurrentViewMode();

		this.model.setSelectedRecords(selections);
		if (viewMode !== Zarafa.plugins.files.data.ViewModes.NO_PREVIEW) {
			if (Ext.isEmpty(selections)) {
				this.model.setPreviewRecord(undefined);
			}
		}
	}
});

Ext.reg('filesplugin.filesrecordgridview', Zarafa.plugins.files.ui.FilesRecordGridView);
