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

    addList: function() {
      this.workListView.addList();
    }

  })

  var workListView = headerView.extend({
    el: $('#container'),

    events: {
      "click #work-add"   :   'addWork',
      'keyup #work-input'  :   'enterWork'
    },

    initialize: function() {
      
      this.work_list = new WorkCollection();
      this.work_list.on('add', this.render, this);
      
      this.work = new WorkModel();
      this.work.set({'title':'To do List', 'first' : true});
      this.work_list.add(this.work);
      this.work = new WorkModel();
      this.work.set({'title':'Finished', 'first' : false});
      this.work_list.add(this.work);
    },

    render: function(){
      var self = this;
      self.size = this.work_list.size();
      
      this.$el.empty();

      this.work_list.each(function(work) {
        var template = Handlebars.compile(WorkListTemplate);
        // work.set("size", (12 / self.size));

        work.set("size", 6);
        var html = template(work.attributes); 
        self.$el.append(html);
      });
      this.workItemView = new workItemView();
      return this;      
    },

    addList: function() {
      console.log("add list");
      // this.work_list.add(new WorkModel().set('title', 'finished'));
      // this.render();
    },

    addWork: function() {
      $('.work-div').append('<input id="work-input" type="text">');
      $('#work-input').focus();
    },

    enterWork:function(e) {
      if (e.which == 13) {
        var itemName = $('#work-input').val();
        $('#work-input').remove();
        var itemModel = new WorkItemModel({
          name : itemName
        });
        itemModel.urlRoot ='/test';
        itemModel.save(null, {
          success: function(res, xhr) {
            console.log("success");
          },
          error: function(model, xhr, options) {
            console.log("error");
          }
        });

        this.workItemView.addWorkItem(itemModel);  
      }
    }

  });  

  var workItemView = workListView.extend({

    el: $('#work-item-list'),

    initialize: function() {
      var self = this;
      self.work_item_list = new WorkItemCollection();
      self.work_item_list.url = '/get_work';
      self.work_item_list.fetch({
        success: function() {
          console.log("collection fetch succeeded");
          self.render();
        },
        error: function() {
          console.log("collection fetch error");
        }
      });
    },

    render: function() {
      console.log('render');

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