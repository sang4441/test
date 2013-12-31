define([
  'jquery',
  'underscore',
  'backbone',
  'views/workList/workView',
], function($, _, Backbone, WorkListView){
  var AppRouter = Backbone.Router.extend({
    routes: {
      // Define some URL routes
      '': 'index',
      'app': 'app'
    },

    index: function() {
      var workListView = new WorkListView();
      workListView.render();    }
  });

  var initialize = function(){
    var app_router = new AppRouter;
    Backbone.history.start();
  };
  return {
    initialize: initialize
  };
});