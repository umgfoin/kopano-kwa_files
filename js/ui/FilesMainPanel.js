Ext.namespace('Zarafa.plugins.files.ui');

Zarafa.plugins.files.ui.FilesMainPanel = Ext.extend(Zarafa.common.ui.ContextMainPanel, {

	viewPanel: undefined,

	constructor: function (config) {
		config = config || {};

		Ext.applyIf(config, {
			xtype : 'filesplugin.filesmainpanel',
			layout: 'zarafa.switchborder',

			items: [
				this.initMainItems(config),
				this.initPreviewPanel(config.context)
			],
			tbar       : {
				xtype: 'filesplugin.filestoptoolbar',
				height      : 28,
				context     : config.context
			}
		});

		Zarafa.plugins.files.ui.FilesMainPanel.superclass.constructor.call(this, config);
	},

	initMainItems: function (config) {
		return {
			xtype      : 'panel',
			ref        : 'filesViewPanel',
			layout     : 'zarafa.collapsible',
			cls        : 'zarafa-context-mainpanel',
			minWidth   : 200,
			minHeight  : 200,
			region     : 'center',
			collapsible: false,
			split      : true,
			items      : [{
				xtype    : 'zarafa.switchviewcontentcontainer',
				ref      : '../viewPanel',
				layout   : 'card',
				lazyItems: this.initViews(config.context)
			}],
			tbar       : {
				xtype       : 'filesplugin.fileslisttoolbar',
				defaultTitle: dgettext('plugin_files', 'Files'),
				height      : 33,
				context     : config.context
			}
		};
	},

	initViews: function (context) {

		var allViews = [{
			xtype  : 'filesplugin.filesrecordaccountview',
			flex   : 1,
			id     : 'files-accountview',
			anchor : '100%',
			context: context
		}, {
			xtype  : 'filesplugin.filesrecordgridview',
			flex   : 1,
			id     : 'files-gridview',
			anchor : '100%',
			context: context
		}, {
			xtype  : 'filesplugin.filesrecordiconview',
			flex   : 1,
			id     : 'files-iconview',
			anchor : '100%',
			context: context
		}];

		var additionalViewItems = container.populateInsertionPoint('plugin.files.views', this, context);
		allViews = allViews.concat(additionalViewItems);

		return allViews;
	},

	initPreviewPanel: function (context) {
		return {
			xtype  : 'filesplugin.filespreviewpanel',
			ref    : 'filesPreview',
			region : 'south',
			split  : true,
			context: context
		};
	},

	/**
	 * Called during rendering of the panel, this will initialize all events.
	 * @private
	 */
	initEvents: function () {
		if (Ext.isDefined(this.context)) {
			this.mon(this.context, 'viewchange', this.onViewChange, this);
			this.mon(this.context, 'viewmodechange', this.onViewModeChange, this);

			this.onViewChange(this.context, this.context.getCurrentView());
			this.onViewModeChange(this.context, this.context.getCurrentViewMode());
		}

		Zarafa.plugins.files.ui.FilesMainPanel.superclass.initEvents.apply(this, arguments);
	},

	onViewChange: function (context, newView, oldView) {
		switch (newView) {
			case Zarafa.plugins.files.data.Views.LIST:
				this.viewPanel.switchView('files-gridview');
				break;
			case Zarafa.plugins.files.data.Views.ICON:
				this.viewPanel.switchView('files-iconview');
				break;
		}
	},

	onViewModeChange: function (context, newViewMode, oldViewMode) {
		var orientation;

		switch (newViewMode) {
			case Zarafa.plugins.files.data.ViewModes.NO_PREVIEW:
				orientation = Zarafa.common.ui.layout.SwitchBorderLayout.Orientation.OFF;
				break;
			case Zarafa.plugins.files.data.ViewModes.RIGHT_PREVIEW:
				orientation = Zarafa.common.ui.layout.SwitchBorderLayout.Orientation.HORIZONTAL;
				break;
			case Zarafa.plugins.files.data.ViewModes.BOTTOM_PREVIEW:
				orientation = Zarafa.common.ui.layout.SwitchBorderLayout.Orientation.VERTICAL;
				break;
			case Zarafa.plugins.files.data.ViewModes.SEARCH:
				return;
		}

		var layout = this.getLayout();
		if (!Ext.isFunction(layout.setOrientation)) {
			if (Ext.isString(layout)) {
				this.layoutConfig = Ext.apply(this.layoutConfig || {}, {orientation: orientation});
			} else {
				this.layout.orientation = orientation;
			}
		} else {
			layout.setOrientation(orientation);
		}
	}
});

Ext.reg('filesplugin.filesmainpanel', Zarafa.plugins.files.ui.FilesMainPanel);
