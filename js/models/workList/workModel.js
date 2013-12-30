// Filename: models/project
define([
  'handlebars',
  'backbone'
], function(Handlebars, Backbone){
  var workModel = Backbone.RelationalModel.extend({
  	// constructor: function(attributes, options) {
  	// 	workListModel.apply(this, arguments);
  	// }

  });
  return workModel;
});


// // Filename: models/project
// define([
//   'handlebars',
//   'backbone'
// ], function(Handlebars, Backbone){
//   var workModel = Backbone.RelationalModel.extend({
//   	// constructor: function(attributes, options) {
//   	// 	workListModel.apply(this, arguments);
//   	// },
//   	relations: [{
// 		type: Backbone.HasMany,
// 		key: 'workItems',
// 		relatedModel: WorkItem,
// 		collectionType: WorkItemCollection,
// 		reverseRelation: {
// 			key: 'livesIn',
// 			includeInJSON: 'id'
// 			// 'relatedModel' is automatically set to 'Zoo'; the 'relationType' to 'HasOne'.
// 		}
// 	}]
//   });

//   var WorkItem = Backbone.RelationalModel.extend({

//   });

//   var WorkItemCollection = Backbone.Collection.extend({
// 	model: WorkItem
//   });
//   // Return the model for the module
//   return workModel;
// });