define([
  'jquery',
  'handlebars',
  'backbone',
  // Using the Require.js text! plugin, we are loaded raw text
  // which will be used as our views primary template
  'collections/workList/workCollection',
  'models/workList/workModel',
  'text!/template/workList/listWrap.html'
], function($, Handlebars, Backbone, WorkListCollection, WorkListModel, WorkListTemplate){
  var workListView = Backbone.View.extend({
    el: $('#container'),

    events: {
      "click #add-list"     :     "addList"
    },

    initialize: function() {
      this.collection = new WorkListCollection();
      this.model = new WorkListModel();
      this.model.set('title', 'To do List');
      this.collection.add(this.model);

      // this.collection.bind("reset", this.render, this);
    },

    render: function(){
      var template = Handlebars.compile(WorkListTemplate);
      var html = template(this.model.attributes);
            console.log(this.model.attributes);
      console.log(this.model);

      this.$el.html(html);
      console.log("rendered");
    },

    addList: function() {
      console.log("add list");
      // this.model.set('title', 'Finished');
      // this.collection.add(this.model);
      // this.collection.each(function(model) {
      //   // this.render();
      // });
    }
  });

  return workListView;
  // Our module now returns our view
  // return ProjectListView;
});