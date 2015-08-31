/**
 * Displays edit window for pm states.
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, d3, require, $, brackets, window, Backbone, Handlebars, self */
define(function (require, exports, module) {
	"use strict";
	var d3 = require("d3/d3"),
		formTemplate         = require("text!../templates/pim/displayEditPIMState.handlebars"),
		FormUtils            = require("plugins/emulink/forms/FormUtils"),
		displayEditPIMWidget = require("plugins/emulink/forms/pim/displayEditPIMWidget"),
		PIMs                 = require("plugins/emulink/pim/PIMs");

	var EditPIMStateView = Backbone.View.extend({
		initialize: function (data) {
			d3.select(this.el).attr("class", "overlay").style("top", self.scrollY + "px").style("z-index", 998);
			this.render(data);
			this._data = data;
			// Used for cloning the widgets to edit.
			this.pims = new PIMs();
		},
		render: function (data) {
			var template = Handlebars.compile(formTemplate);
			this.$el.html(template(data));
			$("body").append(this.el);
			d3.select(this.el).select("#newStateName").node().focus();
			return this;
		},
		events: {
			"click #btnRight": "right",
			"click #btnLeft": "left",
			"click #newStateWidgets": "editWidgets",
			// listen only on the states form (not the widgets).
			"keyup #pimStateModal": "keyup"
		},
		right: function (event) {
			var form = this.el;
			if (FormUtils.validateForm(form)) {
				var selectors = [ "newStateName", /*"newStateComponents",*/ "newStatePMR" ];
				var formdata = FormUtils.serializeForm(form, selectors);
				// Set the widget values obtained from the editWidgits view.
				formdata.labels.set("newStateWidgets", this._data.value.widgets);
				this.trigger(this._data.buttons[1].toLowerCase().replace(new RegExp(" ", "g"), "_"),
					{data: formdata, el: this.el}, this);
			}
		},
		left: function (event) {
			this.trigger(this._data.buttons[0].toLowerCase(), {el: this.el}, this);
		},
		editWidgets: function (event) {
			var _this = this;
			var data = _this._data.value;
			displayEditPIMWidget.create({
				header: "Edit state " + data.newStateName + " widgets...",
				textLabel: {
					newWidgetName: "Name",
					newWidgetCategory: "Category",
					newWidgetBehaviours: "Behaviours"
				},
				placeholder: {
					newWidgetName: "Name",
					newWidgetCategory: "Category",
					newWidgetBehaviours: "Behaviours (Multiple with ,)"
				},
				value: {
					widgets: _this.pims.getWidgets(data.widgets)
				},
				buttons: ["Cancel", "Save Widgets"]
			}).on("save_widgets", function (e, view) {
				// Save the cloned widgets as the original.
				data.widgets = e.data;
				view.remove();
				d3.select(_this.el).select("#newStateName").node().focus();
			}).on("cancel", function (e, view) {
				// Discard the cloned widgets, revert to the original.
				view.remove();
				d3.select(_this.el).select("#newStateName").node().focus();
			});
		},
		keyup: function (event) {
			switch(event.keyCode) {
				case 13: //enter pressed
					this.right(event);
					break;
				case 27: //esc pressed
					this.left(event);
					break;
				default: break;
			}
		}
	});

	module.exports = {
		/**
		 * @param {
         *    {header} form header
         *    {buttons} names for cancel and ok buttons
         * }
		 */
		create: function (data) {
			return new EditPIMStateView(data);
		}
	};
});
