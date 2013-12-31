define([
  'jquery',
  'underscore',
  'backbone',
  'router',
  'views/workList/workView',
], function($, _, Backbone, Router, WorkListView){


  var initialize = function(){
    console.log("here");
    Router.initialize();
    // var workListView = new WorkListView();
    // workListView.render();
  }

  // Backbone.history.start();
  return {
    initialize: initialize
  };
});