define([
  'jquery',
  'underscore',
  'backbone',
  'router',
  'views/workList/workView',
], function($, _, Backbone, Router, WorkListView){


  var initialize = function(){
    Router.initialize();
  }

  return {
    initialize: initialize
  };
});