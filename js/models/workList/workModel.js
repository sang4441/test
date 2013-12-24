// Filename: models/project
define([
  'handlebars',
  'backbone'
], function(Handlebars, Backbone){
  var workListModel = Backbone.Model.extend({
    defaults: {
      title: "To do List"
    }
  });
  // Return the model for the module
  return workListModel;
});