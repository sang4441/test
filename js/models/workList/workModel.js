// Filename: models/project
define([
  'underscore',
  'backbone'
], function(_, Backbone){
  var workListModel = Backbone.Model.extend({
    defaults: {
      name: "Harry Potter"
    }
  });
  // Return the model for the module
  return workListModel;
});