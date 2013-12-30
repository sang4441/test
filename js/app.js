define([
  'jquery',
  'underscore',
  'backbone',
  'views/workList/workView',
], function($, _, Backbone, WorkListView){


  var initialize = function(){
    var workListView = new WorkListView();
    workListView.render();
  }

  Backbone.history.start();
  return {
    initialize: initialize
  };
});