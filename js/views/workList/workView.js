define([
  'jquery',
  'underscore',
  'backbone',
  // Using the Require.js text! plugin, we are loaded raw text
  // which will be used as our views primary template
  'models/workList/workModel',
  'text!/template/workList/main.html'
], function($, _, Backbone, workListModel, workListTemplate){
  var workListView = Backbone.View.extend({
    el: $('#container'),
    initialize: function() {
      this.model = new workListModel();
    },

    render: function(){
      console.log("rendered");
    }
  });

  return workListView;
  // Our module now returns our view
  // return ProjectListView;
});