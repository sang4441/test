define([
  'handlebars',
  'backbone',
  // Pull in the Model module from above
  'models/workList/workItemModel'
], function(Handlebars, Backbone, WorkItemModel){
  var workCollection = Backbone.Collection.extend({
    model: WorkItemModel
  });
  // You don't usually return a collection instantiated
  return workCollection;
});