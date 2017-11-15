Ext.namespace('Zarafa.plugins.files.data');

/**
 * @class Zarafa.plugins.files.data.ComponentBox
 * @singleton
 *
 * The global component box which holds all aliases to important components.
 */
Zarafa.plugins.files.data.ComponentBox = Ext.extend(Object, {

	/**
	 * Get the files context.
	 *
	 * @return {Zarafa.plugins.files.FilesContext}
	 */
	getContext: function () {
		return container.getContextByName("filescontext");
	},

	/**
	 * Get the files context model.
	 *
	 * @return {Zarafa.plugins.files.FilesContextModel}
	 */
	getContextModel: function () {
		return this.getContext().getModel();
	},

	/**
	 * Get the files record store.
	 *
	 * @return {Zarafa.plugins.files.data.FilesRecordStore}
	 */
	getStore: function () {
		// get the default store
		return Zarafa.plugins.files.data.singleton.FilesRecordStoreManager.getStore();
	},

	/**
	 * Get the navigatorpanel.
	 *
	 * @return {Zarafa.core.ui.NavigationPanel}
	 */
	getNavigatorPanel: function () {
		return container.getNavigationBar();
	},

	/**
	 * Get the navigator treepanel
	 * @return {Zarafa.plugins.files.ui.NavigatorTreePanel}
	 */
	getNavigatorTreePanel: function (accountID) {
		var navPanel = this.getNavigatorPanel();
		return navPanel['filesNavigatorTreePanel_' + accountID];
	},

	/**
	 * Get the main panel.
	 *
	 * @return {Zarafa.core.ui.MainViewport}
	 */
	getMainPanel: function () {
		try {
			return container.getContentPanel();
		} catch (e) {
			return container.getTabPanel().get(0).getActiveItem();
		}
	},

	/**
	 * Get the preview panel.
	 *
	 * @return {Zarafa.plugins.files.ui.FilesPreviewPanel}
	 */
	getPreviewPanel: function () {
		return this.getMainPanel().filesPreview;
	},

	/**
	 * Get the tabpanel.
	 *
	 * @return {Zarafa.core.ui.ContextContainer}
	 */
	getTabPanel: function () {
		return container.getTabPanel();
	},

	/**
	 * Get the files viewpanel.
	 *
	 * @return {Zarafa.core.ui.SwitchViewContentContainer}
	 */
	getViewPanel: function () {
		return this.getMainPanel().viewPanel;
	},

	/**
	 * Get the files gridpanel or iconviewpanel.
	 *
	 * @return {Zarafa.plugins.files.ui.FilesRecordGridView} or {Zarafa.plugins.files.ui.FilesRecordIconView}
	 */
	getItemsView: function () {
		return this.getViewPanel().getActiveItem();
	},

	/**
	 * Get the files grid toolbar.
	 *
	 * @return {Zarafa.plugins.files.ui.FilesTopToolbar | undefined }
	 */
	getViewPanelToolbar: function () {
		var viewPanel = this.getMainPanel().filesViewPanel;
		return viewPanel ? viewPanel.getTopToolbar() : undefined;
	}
});

Zarafa.plugins.files.data.ComponentBox = new Zarafa.plugins.files.data.ComponentBox();