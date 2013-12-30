define([
  'jquery',
  'handlebars',
  'backbone',
  // Using the Require.js text! plugin, we are loaded raw text
  // which will be used as our views primary template
  'collections/workList/workCollection',
  'collections/workList/workItemCollection',
  'models/workList/workModel',
  'models/workList/workItemModel',
  'text!/template/workList/listWrap.html',
  'text!/template/workList/workItem.html'
], function($, Handlebars, Backbone, WorkCollection, WorkItemCollection, WorkModel, WorkItemModel, WorkListTemplate, WorkItemTemplate){

  var headerView = Backbone.View.extend({
    el: 'body',

    events: {
      "click #add-list"     :     "addList" 
    },

    initialize: function() {
      this.workListView = new workListView;
    },

    render: function() {
      this.workListView.render();
    },

    addList: function() {
      // $('#add-work-list').dialog({
      //   modal:true,
        
      // });

      this.workListView.addList();
    }

  })

  var workListView = headerView.extend({
    el: $('#container'),

    events: {
      "click #work-add"   :   "addWork",
      'keyup #work-input'  :   'enterWork'
    },

    initialize: function() {
      console.log("init");
      
      this.work_list = new WorkCollection();
      this.work_list.on('add', this.render, this);
      this.work = new WorkModel();
      this.work.set('title', 'To do List');
      this.work_list.add(this.work);
      console.log(this.work);

      // this.work_item = new 
      // this.render();
      // this.collection.bind("add", this.render, this);
    },

    render: function(){
      var self = this;
      self.size = this.work_list.size();
      this.$el.empty();
      this.work_list.each(function(work) {
        var template = Handlebars.compile(WorkListTemplate);
        work.set("size", (12 / self.size));
        var html = template(work.attributes); 
        console.log(work);         
        self.$el.append(html);
      });
      this.workItemView = new workItemView();
      return this;
      
    },

    addList: function() {
      console.log("add list");
      this.work_list.add(new WorkModel().set('title', 'finished'));
      this.render();
    },

    addWork: function() {
      $('#work-div').append('<input id="work-input" type="text">');
      $('#work-input').focus();
    },

    enterWork:function(e) {
      if (e.which == 13) {
        var itemName = $('#work-input').val();
        $('#work-input').remove();
        var itemModel = new WorkItemModel();
        itemModel.set('name', itemName);
        this.workItemView.addWorkItem(itemModel);  
      }
    }

  });  

  var workItemView = workListView.extend({

    el: $('#work-item-list'),

    initialize: function() {
      this.work_item_list = new WorkItemCollection();
    },

    render: function() {
      var self = this;
      self.setElement($('#work-item-list'));
      self.$el.empty();
      this.work_item_list.each(function(work_item) {
        var template = Handlebars.compile(WorkItemTemplate);
        var html = template(work_item.attributes); 
        self.$el.append(html);
      });
      return this;
    },

    addWorkItem: function(model) {
      this.work_item_list.add(model);
      this.render();
    }
  })

  return headerView;
});