Ext.namespace('Zarafa.plugins.files.backend.FTP');

Zarafa.plugins.files.backend.FTP.FormConfig = {
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
	}
};
