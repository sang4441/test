define([
  'handlebars',
  'backbone',
  // Pull in the Model module from above
  'models/workList/workModel'
], function(Handlebars, Backbone, WorkModel){
  var workCollection = Backbone.Collection.extend({
    model: WorkModel
  });

  var workItemCollection = workCollection.extend({

  });
  // You don't usually return a collection instantiated
  return workCollection;
});