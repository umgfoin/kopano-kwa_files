Ext.namespace('Zarafa.plugins.files.backend.Webdav');

Zarafa.plugins.files.backend.Webdav.FormConfig = {
	/**
	 * Event handler called when the "use Kopano credentials" checkbox has been modified
	 *
	 * @param {Ext.form.CheckBox} checkbox Checkbox element from which the event originated
	 * @param {Boolean} checked State of the checkbox
	 * @private
	 */
	onCheckCredentials: function (checkbox, checked) {
		if (checked) {
			this.usernameField.hide();
			this.usernameField.label.hide();
			this.passwordField.hide();
			this.passwordField.label.hide();
		} else {
			this.usernameField.show();
			this.usernameField.label.show();
			this.passwordField.show();
			this.passwordField.label.show();
		}
	},

	/**
	 * Event handler called when the "use ssl connection" checkbox has been modified
	 *
	 * @param {Ext.form.CheckBox} checkbox Checkbox element from which the event originated
	 * @param {Boolean} checked State of the checkbox
	 * @private
	 */
	onCheckSSL: function (checkbox, checked) {
		if (checked) {
			this.portField.setValue("443");
		} else {
			this.portField.setValue("80");
		}
	}
};
