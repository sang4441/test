define([
  'jquery',
  'underscore',
  'backbone',
  'views/workList/workView',
], function($, _, Backbone, WorkListView){


  var initialize = function(){
    console.log(Backbone);
    var workListView = new WorkListView();
    workListView.render();
  }

  Backbone.history.start();
  return {
    initialize: initialize
  };
});