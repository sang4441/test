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
      var self = this;
      this.work_list = new WorkCollection();
      // this.work_list.on('add', this.render, this);
     
      this.work_list.url = '/get_division'; 
      this.work_list.fetch({
        success: function() {
          console.log("collection fetch succeeded");
          self.render();
        },
        error: function() {
          console.log("collection fetch error");
        }
      });
      // this.work = new WorkModel();
      // this.work.set({'title':'To do List', 'first' : true});
      // this.work_list.add(this.work);
      // this.work = new WorkModel();
      // this.work.set({'title':'Finished', 'first' : false});
      // this.work_list.add(this.work);
    },

    render: function(){
      var self = this;
      self.size = this.work_list.size();
      
      this.$el.empty();
      console.log(this.work_list);
      this.work_list.each(function(work) {

        var template = Handlebars.compile(WorkListTemplate);
        // work.set("size", (12 / self.size));

        work.set("size", 6);
        work.set("first", true);
        self.work_item_list = new WorkItemCollection();
        self.work_item_list.url = '/get_work/' + work.get('id');
        self.work_item_list.fetch({
          success: function(data) {
            console.log("collection fetch succeeded");
            work.set('work_list', data);
            var html = template(work.attributes); 
            self.$el.append(html);
            new workItemView().add_work_list(data);

          },
          error: function() {
            console.log("collection fetch error");
          }
        });
        
      });
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
      var self = this;
      if (e.which == 13) {
        var itemName = $('#work-input').val();
        $('#work-input').remove();
        var itemModel = new WorkItemModel({
          name : itemName,
          division_id : 11
        });
        itemModel.urlRoot ='/save_work';
        itemModel.save(null, {
          success: function(res, xhr) {
            console.log("success");
            self.render();
          },
          error: function(model, xhr, options) {
            console.log("error");
          }
        });
        // console.log(this.work_item_list);
        // this.work_item_list.add(itemModel);
        // new workItemView().addWorkItem(this.work_item_list);  
      }
    }

  });  

  var workItemView = workListView.extend({

    el: $('#work-item-list'),

    initialize: function() {
      console.log();
      var self = this;
      // this.render();
    },

    render: function() {
      console.log("render work_list");

      var self = this;
      self.$el.empty();
      this.work_item_list.each(function(work_item) {
        var division_id = work_item.get('division_id')
        // console.log(work_item);
        self.setElement($('#work-item-list-' + division_id));
        
        var template = Handlebars.compile(WorkItemTemplate);
        var html = template(work_item.attributes); 
        self.$el.append(html);
      });
      return this;
    },

    add_work_list: function(data) {
      this.work_item_list = data;
      this.render();
    },

    addWorkItem: function(model) {
      console.log(model);
      this.work_item_list = model;
      this.render();
    }
  })

  return headerView;
});