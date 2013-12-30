//     Backbone.js 1.1.0

//     (c) 2010-2011 Jeremy Ashkenas, DocumentCloud Inc.
//     (c) 2011-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Backbone may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://backbonejs.org

(function(){

  // Initial Setup
  // -------------

  // Save a reference to the global object (`window` in the browser, `exports`
  // on the server).
  var root = this;

  // Save the previous value of the `Backbone` variable, so that it can be
  // restored later on, if `noConflict` is used.
  var previousBackbone = root.Backbone;

  // Create local references to array methods we'll want to use later.
  var array = [];
  var push = array.push;
  var slice = array.slice;
  var splice = array.splice;

  // The top-level namespace. All public Backbone classes and modules will
  // be attached to this. Exported for both the browser and the server.
  var Backbone;
  if (typeof exports !== 'undefined') {
    Backbone = exports;
  } else {
    Backbone = root.Backbone = {};
  }

  // Current version of the library. Keep in sync with `package.json`.
  Backbone.VERSION = '1.1.0';

  // Require Underscore, if we're on the server, and it's not already present.
  var _ = root._;
  if (!_ && (typeof require !== 'undefined')) _ = require('underscore');

  // For Backbone's purposes, jQuery, Zepto, Ender, or My Library (kidding) owns
  // the `$` variable.
  Backbone.$ = root.jQuery || root.Zepto || root.ender || root.$;

  // Runs Backbone.js in *noConflict* mode, returning the `Backbone` variable
  // to its previous owner. Returns a reference to this Backbone object.
  Backbone.noConflict = function() {
    root.Backbone = previousBackbone;
    return this;
  };

  // Turn on `emulateHTTP` to support legacy HTTP servers. Setting this option
  // will fake `"PATCH"`, `"PUT"` and `"DELETE"` requests via the `_method` parameter and
  // set a `X-Http-Method-Override` header.
  Backbone.emulateHTTP = false;

  // Turn on `emulateJSON` to support legacy servers that can't deal with direct
  // `application/json` requests ... will encode the body as
  // `application/x-www-form-urlencoded` instead and will send the model in a
  // form param named `model`.
  Backbone.emulateJSON = false;

  // Backbone.Events
  // ---------------

  // A module that can be mixed in to *any object* in order to provide it with
  // custom events. You may bind with `on` or remove with `off` callback
  // functions to an event; `trigger`-ing an event fires all callbacks in
  // succession.
  //
  //     var object = {};
  //     _.extend(object, Backbone.Events);
  //     object.on('expand', function(){ alert('expanded'); });
  //     object.trigger('expand');
  //
  var Events = Backbone.Events = {

    // Bind an event to a `callback` function. Passing `"all"` will bind
    // the callback to all events fired.
    on: function(name, callback, context) {
      if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
      this._events || (this._events = {});
      var events = this._events[name] || (this._events[name] = []);
      events.push({callback: callback, context: context, ctx: context || this});
      return this;
    },

    // Bind an event to only be triggered a single time. After the first time
    // the callback is invoked, it will be removed.
    once: function(name, callback, context) {
      if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
      var self = this;
      var once = _.once(function() {
        self.off(name, once);
        callback.apply(this, arguments);
      });
      once._callback = callback;
      return this.on(name, once, context);
    },

    // Remove one or many callbacks. If `context` is null, removes all
    // callbacks with that function. If `callback` is null, removes all
    // callbacks for the event. If `name` is null, removes all bound
    // callbacks for all events.
    off: function(name, callback, context) {
      var retain, ev, events, names, i, l, j, k;
      if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
      if (!name && !callback && !context) {
        this._events = {};
        return this;
      }
      names = name ? [name] : _.keys(this._events);
      for (i = 0, l = names.length; i < l; i++) {
        name = names[i];
        if (events = this._events[name]) {
          this._events[name] = retain = [];
          if (callback || context) {
            for (j = 0, k = events.length; j < k; j++) {
              ev = events[j];
              if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
                  (context && context !== ev.context)) {
                retain.push(ev);
              }
            }
          }
          if (!retain.length) delete this._events[name];
        }
      }

      return this;
    },

    // Trigger one or many events, firing all bound callbacks. Callbacks are
    // passed the same arguments as `trigger` is, apart from the event name
    // (unless you're listening on `"all"`, which will cause your callback to
    // receive the true name of the event as the first argument).
    trigger: function(name) {
      if (!this._events) return this;
      var args = slice.call(arguments, 1);
      if (!eventsApi(this, 'trigger', name, args)) return this;
      var events = this._events[name];
      var allEvents = this._events.all;
      if (events) triggerEvents(events, args);
      if (allEvents) triggerEvents(allEvents, arguments);
      return this;
    },

    // Tell this object to stop listening to either specific events ... or
    // to every object it's currently listening to.
    stopListening: function(obj, name, callback) {
      var listeningTo = this._listeningTo;
      if (!listeningTo) return this;
      var remove = !name && !callback;
      if (!callback && typeof name === 'object') callback = this;
      if (obj) (listeningTo = {})[obj._listenId] = obj;
      for (var id in listeningTo) {
        obj = listeningTo[id];
        obj.off(name, callback, this);
        if (remove || _.isEmpty(obj._events)) delete this._listeningTo[id];
      }
      return this;
    }

  };

  // Regular expression used to split event strings.
  var eventSplitter = /\s+/;

  // Implement fancy features of the Events API such as multiple event
  // names `"change blur"` and jQuery-style event maps `{change: action}`
  // in terms of the existing API.
  var eventsApi = function(obj, action, name, rest) {
    if (!name) return true;

    // Handle event maps.
    if (typeof name === 'object') {
      for (var key in name) {
        obj[action].apply(obj, [key, name[key]].concat(rest));
      }
      return false;
    }

    // Handle space separated event names.
    if (eventSplitter.test(name)) {
      var names = name.split(eventSplitter);
      for (var i = 0, l = names.length; i < l; i++) {
        obj[action].apply(obj, [names[i]].concat(rest));
      }
      return false;
    }

    return true;
  };

  // A difficult-to-believe, but optimized internal dispatch function for
  // triggering events. Tries to keep the usual cases speedy (most internal
  // Backbone events have 3 arguments).
  var triggerEvents = function(events, args) {
    var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
    switch (args.length) {
      case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
      case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
      case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
      case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
      default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args);
    }
  };

  var listenMethods = {listenTo: 'on', listenToOnce: 'once'};

  // Inversion-of-control versions of `on` and `once`. Tell *this* object to
  // listen to an event in another object ... keeping track of what it's
  // listening to.
  _.each(listenMethods, function(implementation, method) {
    Events[method] = function(obj, name, callback) {
      var listeningTo = this._listeningTo || (this._listeningTo = {});
      var id = obj._listenId || (obj._listenId = _.uniqueId('l'));
      listeningTo[id] = obj;
      if (!callback && typeof name === 'object') callback = this;
      obj[implementation](name, callback, this);
      return this;
    };
  });

  // Aliases for backwards compatibility.
  Events.bind   = Events.on;
  Events.unbind = Events.off;

  // Allow the `Backbone` object to serve as a global event bus, for folks who
  // want global "pubsub" in a convenient place.
  _.extend(Backbone, Events);

  // Backbone.Model
  // --------------

  // Backbone **Models** are the basic data object in the framework --
  // frequently representing a row in a table in a database on your server.
  // A discrete chunk of data and a bunch of useful, related methods for
  // performing computations and transformations on that data.

  // Create a new model with the specified attributes. A client id (`cid`)
  // is automatically generated and assigned for you.
  var Model = Backbone.Model = function(attributes, options) {
    var attrs = attributes || {};
    options || (options = {});
    this.cid = _.uniqueId('c');
    this.attributes = {};
    if (options.collection) this.collection = options.collection;
    if (options.parse) attrs = this.parse(attrs, options) || {};
    attrs = _.defaults({}, attrs, _.result(this, 'defaults'));
    this.set(attrs, options);
    this.changed = {};
    this.initialize.apply(this, arguments);
  };

  // Attach all inheritable methods to the Model prototype.
  _.extend(Model.prototype, Events, {

    // A hash of attributes whose current and previous value differ.
    changed: null,

    // The value returned during the last failed validation.
    validationError: null,

    // The default name for the JSON `id` attribute is `"id"`. MongoDB and
    // CouchDB users may want to set this to `"_id"`.
    idAttribute: 'id',

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // Return a copy of the model's `attributes` object.
    toJSON: function(options) {
      return _.clone(this.attributes);
    },

    // Proxy `Backbone.sync` by default -- but override this if you need
    // custom syncing semantics for *this* particular model.
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // Get the value of an attribute.
    get: function(attr) {
      return this.attributes[attr];
    },

    // Get the HTML-escaped value of an attribute.
    escape: function(attr) {
      return _.escape(this.get(attr));
    },

    // Returns `true` if the attribute contains a value that is not null
    // or undefined.
    has: function(attr) {
      return this.get(attr) != null;
    },

    // Set a hash of model attributes on the object, firing `"change"`. This is
    // the core primitive operation of a model, updating the data and notifying
    // anyone who needs to know about the change in state. The heart of the beast.
    set: function(key, val, options) {
      var attr, attrs, unset, changes, silent, changing, prev, current;
      if (key == null) return this;

      // Handle both `"key", value` and `{key: value}` -style arguments.
      if (typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options || (options = {});

      // Run validation.
      if (!this._validate(attrs, options)) return false;

      // Extract attributes and options.
      unset           = options.unset;
      silent          = options.silent;
      changes         = [];
      changing        = this._changing;
      this._changing  = true;

      if (!changing) {
        this._previousAttributes = _.clone(this.attributes);
        this.changed = {};
      }
      current = this.attributes, prev = this._previousAttributes;

      // Check for changes of `id`.
      if (this.idAttribute in attrs) this.id = attrs[this.idAttribute];

      // For each `set` attribute, update or delete the current value.
      for (attr in attrs) {
        val = attrs[attr];
        if (!_.isEqual(current[attr], val)) changes.push(attr);
        if (!_.isEqual(prev[attr], val)) {
          this.changed[attr] = val;
        } else {
          delete this.changed[attr];
        }
        unset ? delete current[attr] : current[attr] = val;
      }

      // Trigger all relevant attribute changes.
      if (!silent) {
        if (changes.length) this._pending = true;
        for (var i = 0, l = changes.length; i < l; i++) {
          this.trigger('change:' + changes[i], this, current[changes[i]], options);
        }
      }

      // You might be wondering why there's a `while` loop here. Changes can
      // be recursively nested within `"change"` events.
      if (changing) return this;
      if (!silent) {
        while (this._pending) {
          this._pending = false;
          this.trigger('change', this, options);
        }
      }
      this._pending = false;
      this._changing = false;
      return this;
    },

    // Remove an attribute from the model, firing `"change"`. `unset` is a noop
    // if the attribute doesn't exist.
    unset: function(attr, options) {
      return this.set(attr, void 0, _.extend({}, options, {unset: true}));
    },

    // Clear all attributes on the model, firing `"change"`.
    clear: function(options) {
      var attrs = {};
      for (var key in this.attributes) attrs[key] = void 0;
      return this.set(attrs, _.extend({}, options, {unset: true}));
    },

    // Determine if the model has changed since the last `"change"` event.
    // If you specify an attribute name, determine if that attribute has changed.
    hasChanged: function(attr) {
      if (attr == null) return !_.isEmpty(this.changed);
      return _.has(this.changed, attr);
    },

    // Return an object containing all the attributes that have changed, or
    // false if there are no changed attributes. Useful for determining what
    // parts of a view need to be updated and/or what attributes need to be
    // persisted to the server. Unset attributes will be set to undefined.
    // You can also pass an attributes object to diff against the model,
    // determining if there *would be* a change.
    changedAttributes: function(diff) {
      if (!diff) return this.hasChanged() ? _.clone(this.changed) : false;
      var val, changed = false;
      var old = this._changing ? this._previousAttributes : this.attributes;
      for (var attr in diff) {
        if (_.isEqual(old[attr], (val = diff[attr]))) continue;
        (changed || (changed = {}))[attr] = val;
      }
      return changed;
    },

    // Get the previous value of an attribute, recorded at the time the last
    // `"change"` event was fired.
    previous: function(attr) {
      if (attr == null || !this._previousAttributes) return null;
      return this._previousAttributes[attr];
    },

    // Get all of the attributes of the model at the time of the previous
    // `"change"` event.
    previousAttributes: function() {
      return _.clone(this._previousAttributes);
    },

    // Fetch the model from the server. If the server's representation of the
    // model differs from its current attributes, they will be overridden,
    // triggering a `"change"` event.
    fetch: function(options) {
      options = options ? _.clone(options) : {};
      if (options.parse === void 0) options.parse = true;
      var model = this;
      var success = options.success;
      options.success = function(resp) {
        if (!model.set(model.parse(resp, options), options)) return false;
        if (success) success(model, resp, options);
        model.trigger('sync', model, resp, options);
      };
      wrapError(this, options);
      return this.sync('read', this, options);
    },

    // Set a hash of model attributes, and sync the model to the server.
    // If the server returns an attributes hash that differs, the model's
    // state will be `set` again.
    save: function(key, val, options) {
      var attrs, method, xhr, attributes = this.attributes;

      // Handle both `"key", value` and `{key: value}` -style arguments.
      if (key == null || typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options = _.extend({validate: true}, options);

      // If we're not waiting and attributes exist, save acts as
      // `set(attr).save(null, opts)` with validation. Otherwise, check if
      // the model will be valid when the attributes, if any, are set.
      if (attrs && !options.wait) {
        if (!this.set(attrs, options)) return false;
      } else {
        if (!this._validate(attrs, options)) return false;
      }

      // Set temporary attributes if `{wait: true}`.
      if (attrs && options.wait) {
        this.attributes = _.extend({}, attributes, attrs);
      }

      // After a successful server-side save, the client is (optionally)
      // updated with the server-side state.
      if (options.parse === void 0) options.parse = true;
      var model = this;
      var success = options.success;
      options.success = function(resp) {
        // Ensure attributes are restored during synchronous saves.
        model.attributes = attributes;
        var serverAttrs = model.parse(resp, options);
        if (options.wait) serverAttrs = _.extend(attrs || {}, serverAttrs);
        if (_.isObject(serverAttrs) && !model.set(serverAttrs, options)) {
          return false;
        }
        if (success) success(model, resp, options);
        model.trigger('sync', model, resp, options);
      };
      wrapError(this, options);

      method = this.isNew() ? 'create' : (options.patch ? 'patch' : 'update');
      if (method === 'patch') options.attrs = attrs;
      xhr = this.sync(method, this, options);

      // Restore attributes.
      if (attrs && options.wait) this.attributes = attributes;

      return xhr;
    },

    // Destroy this model on the server if it was already persisted.
    // Optimistically removes the model from its collection, if it has one.
    // If `wait: true` is passed, waits for the server to respond before removal.
    destroy: function(options) {
      options = options ? _.clone(options) : {};
      var model = this;
      var success = options.success;

      var destroy = function() {
        model.trigger('destroy', model, model.collection, options);
      };

      options.success = function(resp) {
        if (options.wait || model.isNew()) destroy();
        if (success) success(model, resp, options);
        if (!model.isNew()) model.trigger('sync', model, resp, options);
      };

      if (this.isNew()) {
        options.success();
        return false;
      }
      wrapError(this, options);

      var xhr = this.sync('delete', this, options);
      if (!options.wait) destroy();
      return xhr;
    },

    // Default URL for the model's representation on the server -- if you're
    // using Backbone's restful methods, override this to change the endpoint
    // that will be called.
    url: function() {
      var base = _.result(this, 'urlRoot') || _.result(this.collection, 'url') || urlError();
      if (this.isNew()) return base;
      return base + (base.charAt(base.length - 1) === '/' ? '' : '/') + encodeURIComponent(this.id);
    },

    // **parse** converts a response into the hash of attributes to be `set` on
    // the model. The default implementation is just to pass the response along.
    parse: function(resp, options) {
      return resp;
    },

    // Create a new model with identical attributes to this one.
    clone: function() {
      return new this.constructor(this.attributes);
    },

    // A model is new if it has never been saved to the server, and lacks an id.
    isNew: function() {
      return this.id == null;
    },

    // Check if the model is currently in a valid state.
    isValid: function(options) {
      return this._validate({}, _.extend(options || {}, { validate: true }));
    },

    // Run validation against the next complete set of model attributes,
    // returning `true` if all is well. Otherwise, fire an `"invalid"` event.
    _validate: function(attrs, options) {
      if (!options.validate || !this.validate) return true;
      attrs = _.extend({}, this.attributes, attrs);
      var error = this.validationError = this.validate(attrs, options) || null;
      if (!error) return true;
      this.trigger('invalid', this, error, _.extend(options, {validationError: error}));
      return false;
    }

  });

  // Underscore methods that we want to implement on the Model.
  var modelMethods = ['keys', 'values', 'pairs', 'invert', 'pick', 'omit'];

  // Mix in each Underscore method as a proxy to `Model#attributes`.
  _.each(modelMethods, function(method) {
    Model.prototype[method] = function() {
      var args = slice.call(arguments);
      args.unshift(this.attributes);
      return _[method].apply(_, args);
    };
  });

  // Backbone.Collection
  // -------------------

  // If models tend to represent a single row of data, a Backbone Collection is
  // more analagous to a table full of data ... or a small slice or page of that
  // table, or a collection of rows that belong together for a particular reason
  // -- all of the messages in this particular folder, all of the documents
  // belonging to this particular author, and so on. Collections maintain
  // indexes of their models, both in order, and for lookup by `id`.

  // Create a new **Collection**, perhaps to contain a specific type of `model`.
  // If a `comparator` is specified, the Collection will maintain
  // its models in sort order, as they're added and removed.
  var Collection = Backbone.Collection = function(models, options) {
    options || (options = {});
    if (options.model) this.model = options.model;
    if (options.comparator !== void 0) this.comparator = options.comparator;
    this._reset();
    this.initialize.apply(this, arguments);
    if (models) this.reset(models, _.extend({silent: true}, options));
  };

  // Default options for `Collection#set`.
  var setOptions = {add: true, remove: true, merge: true};
  var addOptions = {add: true, remove: false};

  // Define the Collection's inheritable methods.
  _.extend(Collection.prototype, Events, {

    // The default model for a collection is just a **Backbone.Model**.
    // This should be overridden in most cases.
    model: Model,

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // The JSON representation of a Collection is an array of the
    // models' attributes.
    toJSON: function(options) {
      return this.map(function(model){ return model.toJSON(options); });
    },

    // Proxy `Backbone.sync` by default.
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // Add a model, or list of models to the set.
    add: function(models, options) {
      return this.set(models, _.extend({merge: false}, options, addOptions));
    },

    // Remove a model, or a list of models from the set.
    remove: function(models, options) {
      var singular = !_.isArray(models);
      models = singular ? [models] : _.clone(models);
      options || (options = {});
      var i, l, index, model;
      for (i = 0, l = models.length; i < l; i++) {
        model = models[i] = this.get(models[i]);
        if (!model) continue;
        delete this._byId[model.id];
        delete this._byId[model.cid];
        index = this.indexOf(model);
        this.models.splice(index, 1);
        this.length--;
        if (!options.silent) {
          options.index = index;
          model.trigger('remove', model, this, options);
        }
        this._removeReference(model);
      }
      return singular ? models[0] : models;
    },

    // Update a collection by `set`-ing a new list of models, adding new ones,
    // removing models that are no longer present, and merging models that
    // already exist in the collection, as necessary. Similar to **Model#set**,
    // the core operation for updating the data contained by the collection.
    set: function(models, options) {
      options = _.defaults({}, options, setOptions);
      if (options.parse) models = this.parse(models, options);
      var singular = !_.isArray(models);
      models = singular ? (models ? [models] : []) : _.clone(models);
      var i, l, id, model, attrs, existing, sort;
      var at = options.at;
      var targetModel = this.model;
      var sortable = this.comparator && (at == null) && options.sort !== false;
      var sortAttr = _.isString(this.comparator) ? this.comparator : null;
      var toAdd = [], toRemove = [], modelMap = {};
      var add = options.add, merge = options.merge, remove = options.remove;
      var order = !sortable && add && remove ? [] : false;

      // Turn bare objects into model references, and prevent invalid models
      // from being added.
      for (i = 0, l = models.length; i < l; i++) {
        attrs = models[i];
        if (attrs instanceof Model) {
          id = model = attrs;
        } else {
          id = attrs[targetModel.prototype.idAttribute];
        }

        // If a duplicate is found, prevent it from being added and
        // optionally merge it into the existing model.
        if (existing = this.get(id)) {
          if (remove) modelMap[existing.cid] = true;
          if (merge) {
            attrs = attrs === model ? model.attributes : attrs;
            if (options.parse) attrs = existing.parse(attrs, options);
            existing.set(attrs, options);
            if (sortable && !sort && existing.hasChanged(sortAttr)) sort = true;
          }
          models[i] = existing;

        // If this is a new, valid model, push it to the `toAdd` list.
        } else if (add) {
          model = models[i] = this._prepareModel(attrs, options);
          if (!model) continue;
          toAdd.push(model);

          // Listen to added models' events, and index models for lookup by
          // `id` and by `cid`.
          model.on('all', this._onModelEvent, this);
          this._byId[model.cid] = model;
          if (model.id != null) this._byId[model.id] = model;
        }
        if (order) order.push(existing || model);
      }

      // Remove nonexistent models if appropriate.
      if (remove) {
        for (i = 0, l = this.length; i < l; ++i) {
          if (!modelMap[(model = this.models[i]).cid]) toRemove.push(model);
        }
        if (toRemove.length) this.remove(toRemove, options);
      }

      // See if sorting is needed, update `length` and splice in new models.
      if (toAdd.length || (order && order.length)) {
        if (sortable) sort = true;
        this.length += toAdd.length;
        if (at != null) {
          for (i = 0, l = toAdd.length; i < l; i++) {
            this.models.splice(at + i, 0, toAdd[i]);
          }
        } else {
          if (order) this.models.length = 0;
          var orderedModels = order || toAdd;
          for (i = 0, l = orderedModels.length; i < l; i++) {
            this.models.push(orderedModels[i]);
          }
        }
      }

      // Silently sort the collection if appropriate.
      if (sort) this.sort({silent: true});

      // Unless silenced, it's time to fire all appropriate add/sort events.
      if (!options.silent) {
        for (i = 0, l = toAdd.length; i < l; i++) {
          (model = toAdd[i]).trigger('add', model, this, options);
        }
        if (sort || (order && order.length)) this.trigger('sort', this, options);
      }
      
      // Return the added (or merged) model (or models).
      return singular ? models[0] : models;
    },

    // When you have more items than you want to add or remove individually,
    // you can reset the entire set with a new list of models, without firing
    // any granular `add` or `remove` events. Fires `reset` when finished.
    // Useful for bulk operations and optimizations.
    reset: function(models, options) {
      options || (options = {});
      for (var i = 0, l = this.models.length; i < l; i++) {
        this._removeReference(this.models[i]);
      }
      options.previousModels = this.models;
      this._reset();
      models = this.add(models, _.extend({silent: true}, options));
      if (!options.silent) this.trigger('reset', this, options);
      return models;
    },

    // Add a model to the end of the collection.
    push: function(model, options) {
      return this.add(model, _.extend({at: this.length}, options));
    },

    // Remove a model from the end of the collection.
    pop: function(options) {
      var model = this.at(this.length - 1);
      this.remove(model, options);
      return model;
    },

    // Add a model to the beginning of the collection.
    unshift: function(model, options) {
      return this.add(model, _.extend({at: 0}, options));
    },

    // Remove a model from the beginning of the collection.
    shift: function(options) {
      var model = this.at(0);
      this.remove(model, options);
      return model;
    },

    // Slice out a sub-array of models from the collection.
    slice: function() {
      return slice.apply(this.models, arguments);
    },

    // Get a model from the set by id.
    get: function(obj) {
      if (obj == null) return void 0;
      return this._byId[obj.id] || this._byId[obj.cid] || this._byId[obj];
    },

    // Get the model at the given index.
    at: function(index) {
      return this.models[index];
    },

    // Return models with matching attributes. Useful for simple cases of
    // `filter`.
    where: function(attrs, first) {
      if (_.isEmpty(attrs)) return first ? void 0 : [];
      return this[first ? 'find' : 'filter'](function(model) {
        for (var key in attrs) {
          if (attrs[key] !== model.get(key)) return false;
        }
        return true;
      });
    },

    // Return the first model with matching attributes. Useful for simple cases
    // of `find`.
    findWhere: function(attrs) {
      return this.where(attrs, true);
    },

    // Force the collection to re-sort itself. You don't need to call this under
    // normal circumstances, as the set will maintain sort order as each item
    // is added.
    sort: function(options) {
      if (!this.comparator) throw new Error('Cannot sort a set without a comparator');
      options || (options = {});

      // Run sort based on type of `comparator`.
      if (_.isString(this.comparator) || this.comparator.length === 1) {
        this.models = this.sortBy(this.comparator, this);
      } else {
        this.models.sort(_.bind(this.comparator, this));
      }

      if (!options.silent) this.trigger('sort', this, options);
      return this;
    },

    // Pluck an attribute from each model in the collection.
    pluck: function(attr) {
      return _.invoke(this.models, 'get', attr);
    },

    // Fetch the default set of models for this collection, resetting the
    // collection when they arrive. If `reset: true` is passed, the response
    // data will be passed through the `reset` method instead of `set`.
    fetch: function(options) {
      options = options ? _.clone(options) : {};
      if (options.parse === void 0) options.parse = true;
      var success = options.success;
      var collection = this;
      options.success = function(resp) {
        var method = options.reset ? 'reset' : 'set';
        collection[method](resp, options);
        if (success) success(collection, resp, options);
        collection.trigger('sync', collection, resp, options);
      };
      wrapError(this, options);
      return this.sync('read', this, options);
    },

    // Create a new instance of a model in this collection. Add the model to the
    // collection immediately, unless `wait: true` is passed, in which case we
    // wait for the server to agree.
    create: function(model, options) {
      options = options ? _.clone(options) : {};
      if (!(model = this._prepareModel(model, options))) return false;
      if (!options.wait) this.add(model, options);
      var collection = this;
      var success = options.success;
      options.success = function(model, resp, options) {
        if (options.wait) collection.add(model, options);
        if (success) success(model, resp, options);
      };
      model.save(null, options);
      return model;
    },

    // **parse** converts a response into a list of models to be added to the
    // collection. The default implementation is just to pass it through.
    parse: function(resp, options) {
      return resp;
    },

    // Create a new collection with an identical list of models as this one.
    clone: function() {
      return new this.constructor(this.models);
    },

    // Private method to reset all internal state. Called when the collection
    // is first initialized or reset.
    _reset: function() {
      this.length = 0;
      this.models = [];
      this._byId  = {};
    },

    // Prepare a hash of attributes (or other model) to be added to this
    // collection.
    _prepareModel: function(attrs, options) {
      if (attrs instanceof Model) {
        if (!attrs.collection) attrs.collection = this;
        return attrs;
      }
      options = options ? _.clone(options) : {};
      options.collection = this;
      var model = new this.model(attrs, options);
      if (!model.validationError) return model;
      this.trigger('invalid', this, model.validationError, options);
      return false;
    },

    // Internal method to sever a model's ties to a collection.
    _removeReference: function(model) {
      if (this === model.collection) delete model.collection;
      model.off('all', this._onModelEvent, this);
    },

    // Internal method called every time a model in the set fires an event.
    // Sets need to update their indexes when models change ids. All other
    // events simply proxy through. "add" and "remove" events that originate
    // in other collections are ignored.
    _onModelEvent: function(event, model, collection, options) {
      if ((event === 'add' || event === 'remove') && collection !== this) return;
      if (event === 'destroy') this.remove(model, options);
      if (model && event === 'change:' + model.idAttribute) {
        delete this._byId[model.previous(model.idAttribute)];
        if (model.id != null) this._byId[model.id] = model;
      }
      this.trigger.apply(this, arguments);
    }

  });

  // Underscore methods that we want to implement on the Collection.
  // 90% of the core usefulness of Backbone Collections is actually implemented
  // right here:
  var methods = ['forEach', 'each', 'map', 'collect', 'reduce', 'foldl',
    'inject', 'reduceRight', 'foldr', 'find', 'detect', 'filter', 'select',
    'reject', 'every', 'all', 'some', 'any', 'include', 'contains', 'invoke',
    'max', 'min', 'toArray', 'size', 'first', 'head', 'take', 'initial', 'rest',
    'tail', 'drop', 'last', 'without', 'difference', 'indexOf', 'shuffle',
    'lastIndexOf', 'isEmpty', 'chain'];

  // Mix in each Underscore method as a proxy to `Collection#models`.
  _.each(methods, function(method) {
    Collection.prototype[method] = function() {
      var args = slice.call(arguments);
      args.unshift(this.models);
      return _[method].apply(_, args);
    };
  });

  // Underscore methods that take a property name as an argument.
  var attributeMethods = ['groupBy', 'countBy', 'sortBy'];

  // Use attributes instead of properties.
  _.each(attributeMethods, function(method) {
    Collection.prototype[method] = function(value, context) {
      var iterator = _.isFunction(value) ? value : function(model) {
        return model.get(value);
      };
      return _[method](this.models, iterator, context);
    };
  });

  // Backbone.View
  // -------------

  // Backbone Views are almost more convention than they are actual code. A View
  // is simply a JavaScript object that represents a logical chunk of UI in the
  // DOM. This might be a single item, an entire list, a sidebar or panel, or
  // even the surrounding frame which wraps your whole app. Defining a chunk of
  // UI as a **View** allows you to define your DOM events declaratively, without
  // having to worry about render order ... and makes it easy for the view to
  // react to specific changes in the state of your models.

  // Creating a Backbone.View creates its initial element outside of the DOM,
  // if an existing element is not provided...
  var View = Backbone.View = function(options) {
    this.cid = _.uniqueId('view');
    options || (options = {});
    _.extend(this, _.pick(options, viewOptions));
    this._ensureElement();
    this.initialize.apply(this, arguments);
    this.delegateEvents();
  };

  // Cached regex to split keys for `delegate`.
  var delegateEventSplitter = /^(\S+)\s*(.*)$/;

  // List of view options to be merged as properties.
  var viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];

  // Set up all inheritable **Backbone.View** properties and methods.
  _.extend(View.prototype, Events, {

    // The default `tagName` of a View's element is `"div"`.
    tagName: 'div',

    // jQuery delegate for element lookup, scoped to DOM elements within the
    // current view. This should be preferred to global lookups where possible.
    $: function(selector) {
      return this.$el.find(selector);
    },

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // **render** is the core function that your view should override, in order
    // to populate its element (`this.el`), with the appropriate HTML. The
    // convention is for **render** to always return `this`.
    render: function() {
      return this;
    },

    // Remove this view by taking the element out of the DOM, and removing any
    // applicable Backbone.Events listeners.
    remove: function() {
      this.$el.remove();
      this.stopListening();
      return this;
    },

    // Change the view's element (`this.el` property), including event
    // re-delegation.
    setElement: function(element, delegate) {
      if (this.$el) this.undelegateEvents();
      this.$el = element instanceof Backbone.$ ? element : Backbone.$(element);
      this.el = this.$el[0];
      if (delegate !== false) this.delegateEvents();
      return this;
    },

    // Set callbacks, where `this.events` is a hash of
    //
    // *{"event selector": "callback"}*
    //
    //     {
    //       'mousedown .title':  'edit',
    //       'click .button':     'save',
    //       'click .open':       function(e) { ... }
    //     }
    //
    // pairs. Callbacks will be bound to the view, with `this` set properly.
    // Uses event delegation for efficiency.
    // Omitting the selector binds the event to `this.el`.
    // This only works for delegate-able events: not `focus`, `blur`, and
    // not `change`, `submit`, and `reset` in Internet Explorer.
    delegateEvents: function(events) {
      if (!(events || (events = _.result(this, 'events')))) return this;
      this.undelegateEvents();
      for (var key in events) {
        var method = events[key];
        if (!_.isFunction(method)) method = this[events[key]];
        if (!method) continue;

        var match = key.match(delegateEventSplitter);
        var eventName = match[1], selector = match[2];
        method = _.bind(method, this);
        eventName += '.delegateEvents' + this.cid;
        if (selector === '') {
          this.$el.on(eventName, method);
        } else {
          this.$el.on(eventName, selector, method);
        }
      }
      return this;
    },

    // Clears all callbacks previously bound to the view with `delegateEvents`.
    // You usually don't need to use this, but may wish to if you have multiple
    // Backbone views attached to the same DOM element.
    undelegateEvents: function() {
      this.$el.off('.delegateEvents' + this.cid);
      return this;
    },

    // Ensure that the View has a DOM element to render into.
    // If `this.el` is a string, pass it through `$()`, take the first
    // matching element, and re-assign it to `el`. Otherwise, create
    // an element from the `id`, `className` and `tagName` properties.
    _ensureElement: function() {
      if (!this.el) {
        var attrs = _.extend({}, _.result(this, 'attributes'));
        if (this.id) attrs.id = _.result(this, 'id');
        if (this.className) attrs['class'] = _.result(this, 'className');
        var $el = Backbone.$('<' + _.result(this, 'tagName') + '>').attr(attrs);
        this.setElement($el, false);
      } else {
        this.setElement(_.result(this, 'el'), false);
      }
    }

  });

  // Backbone.sync
  // -------------

  // Override this function to change the manner in which Backbone persists
  // models to the server. You will be passed the type of request, and the
  // model in question. By default, makes a RESTful Ajax request
  // to the model's `url()`. Some possible customizations could be:
  //
  // * Use `setTimeout` to batch rapid-fire updates into a single request.
  // * Send up the models as XML instead of JSON.
  // * Persist models via WebSockets instead of Ajax.
  //
  // Turn on `Backbone.emulateHTTP` in order to send `PUT` and `DELETE` requests
  // as `POST`, with a `_method` parameter containing the true HTTP method,
  // as well as all requests with the body as `application/x-www-form-urlencoded`
  // instead of `application/json` with the model in a param named `model`.
  // Useful when interfacing with server-side languages like **PHP** that make
  // it difficult to read the body of `PUT` requests.
  Backbone.sync = function(method, model, options) {
    var type = methodMap[method];

    // Default options, unless specified.
    _.defaults(options || (options = {}), {
      emulateHTTP: Backbone.emulateHTTP,
      emulateJSON: Backbone.emulateJSON
    });

    // Default JSON-request options.
    var params = {type: type, dataType: 'json'};

    // Ensure that we have a URL.
    if (!options.url) {
      params.url = _.result(model, 'url') || urlError();
    }

    // Ensure that we have the appropriate request data.
    if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
      params.contentType = 'application/json';
      params.data = JSON.stringify(options.attrs || model.toJSON(options));
    }

    // For older servers, emulate JSON by encoding the request into an HTML-form.
    if (options.emulateJSON) {
      params.contentType = 'application/x-www-form-urlencoded';
      params.data = params.data ? {model: params.data} : {};
    }

    // For older servers, emulate HTTP by mimicking the HTTP method with `_method`
    // And an `X-HTTP-Method-Override` header.
    if (options.emulateHTTP && (type === 'PUT' || type === 'DELETE' || type === 'PATCH')) {
      params.type = 'POST';
      if (options.emulateJSON) params.data._method = type;
      var beforeSend = options.beforeSend;
      options.beforeSend = function(xhr) {
        xhr.setRequestHeader('X-HTTP-Method-Override', type);
        if (beforeSend) return beforeSend.apply(this, arguments);
      };
    }

    // Don't process data on a non-GET request.
    if (params.type !== 'GET' && !options.emulateJSON) {
      params.processData = false;
    }

    // If we're sending a `PATCH` request, and we're in an old Internet Explorer
    // that still has ActiveX enabled by default, override jQuery to use that
    // for XHR instead. Remove this line when jQuery supports `PATCH` on IE8.
    if (params.type === 'PATCH' && noXhrPatch) {
      params.xhr = function() {
        return new ActiveXObject("Microsoft.XMLHTTP");
      };
    }

    // Make the request, allowing the user to override any Ajax options.
    var xhr = options.xhr = Backbone.ajax(_.extend(params, options));
    model.trigger('request', model, xhr, options);
    return xhr;
  };

  var noXhrPatch = typeof window !== 'undefined' && !!window.ActiveXObject && !(window.XMLHttpRequest && (new XMLHttpRequest).dispatchEvent);

  // Map from CRUD to HTTP for our default `Backbone.sync` implementation.
  var methodMap = {
    'create': 'POST',
    'update': 'PUT',
    'patch':  'PATCH',
    'delete': 'DELETE',
    'read':   'GET'
  };

  // Set the default implementation of `Backbone.ajax` to proxy through to `$`.
  // Override this if you'd like to use a different library.
  Backbone.ajax = function() {
    return Backbone.$.ajax.apply(Backbone.$, arguments);
  };

  // Backbone.Router
  // ---------------

  // Routers map faux-URLs to actions, and fire events when routes are
  // matched. Creating a new one sets its `routes` hash, if not set statically.
  var Router = Backbone.Router = function(options) {
    options || (options = {});
    if (options.routes) this.routes = options.routes;
    this._bindRoutes();
    this.initialize.apply(this, arguments);
  };

  // Cached regular expressions for matching named param parts and splatted
  // parts of route strings.
  var optionalParam = /\((.*?)\)/g;
  var namedParam    = /(\(\?)?:\w+/g;
  var splatParam    = /\*\w+/g;
  var escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g;

  // Set up all inheritable **Backbone.Router** properties and methods.
  _.extend(Router.prototype, Events, {

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // Manually bind a single named route to a callback. For example:
    //
    //     this.route('search/:query/p:num', 'search', function(query, num) {
    //       ...
    //     });
    //
    route: function(route, name, callback) {
      if (!_.isRegExp(route)) route = this._routeToRegExp(route);
      if (_.isFunction(name)) {
        callback = name;
        name = '';
      }
      if (!callback) callback = this[name];
      var router = this;
      Backbone.history.route(route, function(fragment) {
        var args = router._extractParameters(route, fragment);
        callback && callback.apply(router, args);
        router.trigger.apply(router, ['route:' + name].concat(args));
        router.trigger('route', name, args);
        Backbone.history.trigger('route', router, name, args);
      });
      return this;
    },

    // Simple proxy to `Backbone.history` to save a fragment into the history.
    navigate: function(fragment, options) {
      Backbone.history.navigate(fragment, options);
      return this;
    },

    // Bind all defined routes to `Backbone.history`. We have to reverse the
    // order of the routes here to support behavior where the most general
    // routes can be defined at the bottom of the route map.
    _bindRoutes: function() {
      if (!this.routes) return;
      this.routes = _.result(this, 'routes');
      var route, routes = _.keys(this.routes);
      while ((route = routes.pop()) != null) {
        this.route(route, this.routes[route]);
      }
    },

    // Convert a route string into a regular expression, suitable for matching
    // against the current location hash.
    _routeToRegExp: function(route) {
      route = route.replace(escapeRegExp, '\\$&')
                   .replace(optionalParam, '(?:$1)?')
                   .replace(namedParam, function(match, optional) {
                     return optional ? match : '([^\/]+)';
                   })
                   .replace(splatParam, '(.*?)');
      return new RegExp('^' + route + '$');
    },

    // Given a route, and a URL fragment that it matches, return the array of
    // extracted decoded parameters. Empty or unmatched parameters will be
    // treated as `null` to normalize cross-browser behavior.
    _extractParameters: function(route, fragment) {
      var params = route.exec(fragment).slice(1);
      return _.map(params, function(param) {
        return param ? decodeURIComponent(param) : null;
      });
    }

  });

  // Backbone.History
  // ----------------

  // Handles cross-browser history management, based on either
  // [pushState](http://diveintohtml5.info/history.html) and real URLs, or
  // [onhashchange](https://developer.mozilla.org/en-US/docs/DOM/window.onhashchange)
  // and URL fragments. If the browser supports neither (old IE, natch),
  // falls back to polling.
  var History = Backbone.History = function() {
    this.handlers = [];
    _.bindAll(this, 'checkUrl');

    // Ensure that `History` can be used outside of the browser.
    if (typeof window !== 'undefined') {
      this.location = window.location;
      this.history = window.history;
    }
  };

  // Cached regex for stripping a leading hash/slash and trailing space.
  var routeStripper = /^[#\/]|\s+$/g;

  // Cached regex for stripping leading and trailing slashes.
  var rootStripper = /^\/+|\/+$/g;

  // Cached regex for detecting MSIE.
  var isExplorer = /msie [\w.]+/;

  // Cached regex for removing a trailing slash.
  var trailingSlash = /\/$/;

  // Cached regex for stripping urls of hash and query.
  var pathStripper = /[?#].*$/;

  // Has the history handling already been started?
  History.started = false;

  // Set up all inheritable **Backbone.History** properties and methods.
  _.extend(History.prototype, Events, {

    // The default interval to poll for hash changes, if necessary, is
    // twenty times a second.
    interval: 50,

    // Gets the true hash value. Cannot use location.hash directly due to bug
    // in Firefox where location.hash will always be decoded.
    getHash: function(window) {
      var match = (window || this).location.href.match(/#(.*)$/);
      return match ? match[1] : '';
    },

    // Get the cross-browser normalized URL fragment, either from the URL,
    // the hash, or the override.
    getFragment: function(fragment, forcePushState) {
      if (fragment == null) {
        if (this._hasPushState || !this._wantsHashChange || forcePushState) {
          fragment = this.location.pathname;
          var root = this.root.replace(trailingSlash, '');
          if (!fragment.indexOf(root)) fragment = fragment.slice(root.length);
        } else {
          fragment = this.getHash();
        }
      }
      return fragment.replace(routeStripper, '');
    },

    // Start the hash change handling, returning `true` if the current URL matches
    // an existing route, and `false` otherwise.
    start: function(options) {
      if (History.started) throw new Error("Backbone.history has already been started");
      History.started = true;

      // Figure out the initial configuration. Do we need an iframe?
      // Is pushState desired ... is it available?
      this.options          = _.extend({root: '/'}, this.options, options);
      this.root             = this.options.root;
      this._wantsHashChange = this.options.hashChange !== false;
      this._wantsPushState  = !!this.options.pushState;
      this._hasPushState    = !!(this.options.pushState && this.history && this.history.pushState);
      var fragment          = this.getFragment();
      var docMode           = document.documentMode;
      var oldIE             = (isExplorer.exec(navigator.userAgent.toLowerCase()) && (!docMode || docMode <= 7));

      // Normalize root to always include a leading and trailing slash.
      this.root = ('/' + this.root + '/').replace(rootStripper, '/');

      if (oldIE && this._wantsHashChange) {
        this.iframe = Backbone.$('<iframe src="javascript:0" tabindex="-1" />').hide().appendTo('body')[0].contentWindow;
        this.navigate(fragment);
      }

      // Depending on whether we're using pushState or hashes, and whether
      // 'onhashchange' is supported, determine how we check the URL state.
      if (this._hasPushState) {
        Backbone.$(window).on('popstate', this.checkUrl);
      } else if (this._wantsHashChange && ('onhashchange' in window) && !oldIE) {
        Backbone.$(window).on('hashchange', this.checkUrl);
      } else if (this._wantsHashChange) {
        this._checkUrlInterval = setInterval(this.checkUrl, this.interval);
      }

      // Determine if we need to change the base url, for a pushState link
      // opened by a non-pushState browser.
      this.fragment = fragment;
      var loc = this.location;
      var atRoot = loc.pathname.replace(/[^\/]$/, '$&/') === this.root;

      // Transition from hashChange to pushState or vice versa if both are
      // requested.
      if (this._wantsHashChange && this._wantsPushState) {

        // If we've started off with a route from a `pushState`-enabled
        // browser, but we're currently in a browser that doesn't support it...
        if (!this._hasPushState && !atRoot) {
          this.fragment = this.getFragment(null, true);
          this.location.replace(this.root + this.location.search + '#' + this.fragment);
          // Return immediately as browser will do redirect to new url
          return true;

        // Or if we've started out with a hash-based route, but we're currently
        // in a browser where it could be `pushState`-based instead...
        } else if (this._hasPushState && atRoot && loc.hash) {
          this.fragment = this.getHash().replace(routeStripper, '');
          this.history.replaceState({}, document.title, this.root + this.fragment + loc.search);
        }

      }

      if (!this.options.silent) return this.loadUrl();
    },

    // Disable Backbone.history, perhaps temporarily. Not useful in a real app,
    // but possibly useful for unit testing Routers.
    stop: function() {
      Backbone.$(window).off('popstate', this.checkUrl).off('hashchange', this.checkUrl);
      clearInterval(this._checkUrlInterval);
      History.started = false;
    },

    // Add a route to be tested when the fragment changes. Routes added later
    // may override previous routes.
    route: function(route, callback) {
      this.handlers.unshift({route: route, callback: callback});
    },

    // Checks the current URL to see if it has changed, and if it has,
    // calls `loadUrl`, normalizing across the hidden iframe.
    checkUrl: function(e) {
      var current = this.getFragment();
      if (current === this.fragment && this.iframe) {
        current = this.getFragment(this.getHash(this.iframe));
      }
      if (current === this.fragment) return false;
      if (this.iframe) this.navigate(current);
      this.loadUrl();
    },

    // Attempt to load the current URL fragment. If a route succeeds with a
    // match, returns `true`. If no defined routes matches the fragment,
    // returns `false`.
    loadUrl: function(fragment) {
      fragment = this.fragment = this.getFragment(fragment);
      return _.any(this.handlers, function(handler) {
        if (handler.route.test(fragment)) {
          handler.callback(fragment);
          return true;
        }
      });
    },

    // Save a fragment into the hash history, or replace the URL state if the
    // 'replace' option is passed. You are responsible for properly URL-encoding
    // the fragment in advance.
    //
    // The options object can contain `trigger: true` if you wish to have the
    // route callback be fired (not usually desirable), or `replace: true`, if
    // you wish to modify the current URL without adding an entry to the history.
    navigate: function(fragment, options) {
      if (!History.started) return false;
      if (!options || options === true) options = {trigger: !!options};

      var url = this.root + (fragment = this.getFragment(fragment || ''));

      // Strip the fragment of the query and hash for matching.
      fragment = fragment.replace(pathStripper, '');

      if (this.fragment === fragment) return;
      this.fragment = fragment;

      // Don't include a trailing slash on the root.
      if (fragment === '' && url !== '/') url = url.slice(0, -1);

      // If pushState is available, we use it to set the fragment as a real URL.
      if (this._hasPushState) {
        this.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);

      // If hash changes haven't been explicitly disabled, update the hash
      // fragment to store history.
      } else if (this._wantsHashChange) {
        this._updateHash(this.location, fragment, options.replace);
        if (this.iframe && (fragment !== this.getFragment(this.getHash(this.iframe)))) {
          // Opening and closing the iframe tricks IE7 and earlier to push a
          // history entry on hash-tag change.  When replace is true, we don't
          // want this.
          if(!options.replace) this.iframe.document.open().close();
          this._updateHash(this.iframe.location, fragment, options.replace);
        }

      // If you've told us that you explicitly don't want fallback hashchange-
      // based history, then `navigate` becomes a page refresh.
      } else {
        return this.location.assign(url);
      }
      if (options.trigger) return this.loadUrl(fragment);
    },

    // Update the hash location, either replacing the current entry, or adding
    // a new one to the browser history.
    _updateHash: function(location, fragment, replace) {
      if (replace) {
        var href = location.href.replace(/(javascript:|#).*$/, '');
        location.replace(href + '#' + fragment);
      } else {
        // Some browsers require that `hash` contains a leading #.
        location.hash = '#' + fragment;
      }
    }

  });

  // Create the default Backbone.history.
  Backbone.history = new History;

  // Helpers
  // -------

  // Helper function to correctly set up the prototype chain, for subclasses.
  // Similar to `goog.inherits`, but uses a hash of prototype properties and
  // class properties to be extended.
  var extend = function(protoProps, staticProps) {
    var parent = this;
    var child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call the parent's constructor.
    if (protoProps && _.has(protoProps, 'constructor')) {
      child = protoProps.constructor;
    } else {
      child = function(){ return parent.apply(this, arguments); };
    }

    // Add static properties to the constructor function, if supplied.
    _.extend(child, parent, staticProps);

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent`'s constructor function.
    var Surrogate = function(){ this.constructor = child; };
    Surrogate.prototype = parent.prototype;
    child.prototype = new Surrogate;

    // Add prototype properties (instance properties) to the subclass,
    // if supplied.
    if (protoProps) _.extend(child.prototype, protoProps);

    // Set a convenience property in case the parent's prototype is needed
    // later.
    child.__super__ = parent.prototype;

    return child;
  };

  // Set up inheritance for the model, collection, router, view and history.
  Model.extend = Collection.extend = Router.extend = View.extend = History.extend = extend;

  // Throw an error when a URL is needed, and none is supplied.
  var urlError = function() {
    throw new Error('A "url" property or function must be specified');
  };

  // Wrap an optional error callback with a fallback error event.
  var wrapError = function(model, options) {
    var error = options.error;
    options.error = function(resp) {
      if (error) error(model, resp, options);
      model.trigger('error', model, resp, options);
    };
  };

}).call(this);


/* vim: set tabstop=4 softtabstop=4 shiftwidth=4 noexpandtab: */
/**
 * Backbone-relational.js 0.8.6
 * (c) 2011-2013 Paul Uithol and contributors (https://github.com/PaulUithol/Backbone-relational/graphs/contributors)
 * 
 * Backbone-relational may be freely distributed under the MIT license; see the accompanying LICENSE.txt.
 * For details and documentation: https://github.com/PaulUithol/Backbone-relational.
 * Depends on Backbone (and thus on Underscore as well): https://github.com/documentcloud/backbone.
 */
( function( undefined ) {
  "use strict";

  /**
   * CommonJS shim
   **/
  var _, Backbone, exports;
  if ( typeof window === 'undefined' ) {
    _ = require( 'underscore' );
    Backbone = require( 'backbone' );
    exports = Backbone;
    typeof module === 'undefined' || ( module.exports = exports );
  }
  else {
    _ = window._;
    Backbone = window.Backbone;
    exports = window;
  }

  Backbone.Relational = {
    showWarnings: true
  };

  /**
   * Semaphore mixin; can be used as both binary and counting.
   **/
  Backbone.Semaphore = {
    _permitsAvailable: null,
    _permitsUsed: 0,

    acquire: function() {
      if ( this._permitsAvailable && this._permitsUsed >= this._permitsAvailable ) {
        throw new Error( 'Max permits acquired' );
      }
      else {
        this._permitsUsed++;
      }
    },

    release: function() {
      if ( this._permitsUsed === 0 ) {
        throw new Error( 'All permits released' );
      }
      else {
        this._permitsUsed--;
      }
    },

    isLocked: function() {
      return this._permitsUsed > 0;
    },

    setAvailablePermits: function( amount ) {
      if ( this._permitsUsed > amount ) {
        throw new Error( 'Available permits cannot be less than used permits' );
      }
      this._permitsAvailable = amount;
    }
  };

  /**
   * A BlockingQueue that accumulates items while blocked (via 'block'),
   * and processes them when unblocked (via 'unblock').
   * Process can also be called manually (via 'process').
   */
  Backbone.BlockingQueue = function() {
    this._queue = [];
  };
  _.extend( Backbone.BlockingQueue.prototype, Backbone.Semaphore, {
    _queue: null,

    add: function( func ) {
      if ( this.isBlocked() ) {
        this._queue.push( func );
      }
      else {
        func();
      }
    },

    // Some of the queued events may trigger other blocking events. By
    // copying the queue here it allows queued events to process closer to
    // the natural order.
    //
    // queue events [ 'A', 'B', 'C' ]
    // A handler of 'B' triggers 'D' and 'E'
    // By copying `this._queue` this executes:
    // [ 'A', 'B', 'D', 'E', 'C' ]
    // The same order the would have executed if they didn't have to be
    // delayed and queued.
    process: function() {
      var queue = this._queue;
      this._queue = [];
      while ( queue && queue.length ) {
        queue.shift()();
      }
    },

    block: function() {
      this.acquire();
    },

    unblock: function() {
      this.release();
      if ( !this.isBlocked() ) {
        this.process();
      }
    },

    isBlocked: function() {
      return this.isLocked();
    }
  });
  /**
   * Global event queue. Accumulates external events ('add:<key>', 'remove:<key>' and 'change:<key>')
   * until the top-level object is fully initialized (see 'Backbone.RelationalModel').
   */
  Backbone.Relational.eventQueue = new Backbone.BlockingQueue();

  /**
   * Backbone.Store keeps track of all created (and destruction of) Backbone.RelationalModel.
   * Handles lookup for relations.
   */
  Backbone.Store = function() {
    this._collections = [];
    this._reverseRelations = [];
    this._orphanRelations = [];
    this._subModels = [];
    this._modelScopes = [ exports ];
  };
  _.extend( Backbone.Store.prototype, Backbone.Events, {
    /**
     * Create a new `Relation`.
     * @param {Backbone.RelationalModel} [model]
     * @param {Object} relation
     * @param {Object} [options]
     */
    initializeRelation: function( model, relation, options ) {
      var type = !_.isString( relation.type ) ? relation.type : Backbone[ relation.type ] || this.getObjectByName( relation.type );
      if ( type && type.prototype instanceof Backbone.Relation ) {
        new type( model, relation, options ); // Also pushes the new Relation into `model._relations`
      }
      else {
        Backbone.Relational.showWarnings && typeof console !== 'undefined' && console.warn( 'Relation=%o; missing or invalid relation type!', relation );
      }
    },

    /**
     * Add a scope for `getObjectByName` to look for model types by name.
     * @param {Object} scope
     */
    addModelScope: function( scope ) {
      this._modelScopes.push( scope );
    },

    /**
     * Remove a scope.
     * @param {Object} scope
     */
    removeModelScope: function( scope ) {
      this._modelScopes = _.without( this._modelScopes, scope );
    },

    /**
     * Add a set of subModelTypes to the store, that can be used to resolve the '_superModel'
     * for a model later in 'setupSuperModel'.
     *
     * @param {Backbone.RelationalModel} subModelTypes
     * @param {Backbone.RelationalModel} superModelType
     */
    addSubModels: function( subModelTypes, superModelType ) {
      this._subModels.push({
        'superModelType': superModelType,
        'subModels': subModelTypes
      });
    },

    /**
     * Check if the given modelType is registered as another model's subModel. If so, add it to the super model's
     * '_subModels', and set the modelType's '_superModel', '_subModelTypeName', and '_subModelTypeAttribute'.
     *
     * @param {Backbone.RelationalModel} modelType
     */
    setupSuperModel: function( modelType ) {
      _.find( this._subModels, function( subModelDef ) {
        return _.find( subModelDef.subModels || [], function( subModelTypeName, typeValue ) {
          var subModelType = this.getObjectByName( subModelTypeName );

          if ( modelType === subModelType ) {
            // Set 'modelType' as a child of the found superModel
            subModelDef.superModelType._subModels[ typeValue ] = modelType;

            // Set '_superModel', '_subModelTypeValue', and '_subModelTypeAttribute' on 'modelType'.
            modelType._superModel = subModelDef.superModelType;
            modelType._subModelTypeValue = typeValue;
            modelType._subModelTypeAttribute = subModelDef.superModelType.prototype.subModelTypeAttribute;
            return true;
          }
        }, this );
      }, this );
    },

    /**
     * Add a reverse relation. Is added to the 'relations' property on model's prototype, and to
     * existing instances of 'model' in the store as well.
     * @param {Object} relation
     * @param {Backbone.RelationalModel} relation.model
     * @param {String} relation.type
     * @param {String} relation.key
     * @param {String|Object} relation.relatedModel
     */
    addReverseRelation: function( relation ) {
      var exists = _.any( this._reverseRelations, function( rel ) {
        return _.all( relation || [], function( val, key ) {
          return val === rel[ key ];
        });
      });
      
      if ( !exists && relation.model && relation.type ) {
        this._reverseRelations.push( relation );
        this._addRelation( relation.model, relation );
        this.retroFitRelation( relation );
      }
    },

    /**
     * Deposit a `relation` for which the `relatedModel` can't be resolved at the moment.
     *
     * @param {Object} relation
     */
    addOrphanRelation: function( relation ) {
      var exists = _.any( this._orphanRelations, function( rel ) {
        return _.all( relation || [], function( val, key ) {
          return val === rel[ key ];
        });
      });

      if ( !exists && relation.model && relation.type ) {
        this._orphanRelations.push( relation );
      }
    },

    /**
     * Try to initialize any `_orphanRelation`s
     */
    processOrphanRelations: function() {
      // Make sure to operate on a copy since we're removing while iterating
      _.each( this._orphanRelations.slice( 0 ), function( rel ) {
        var relatedModel = Backbone.Relational.store.getObjectByName( rel.relatedModel );
        if ( relatedModel ) {
          this.initializeRelation( null, rel );
          this._orphanRelations = _.without( this._orphanRelations, rel );
        }
      }, this );
    },

    /**
     *
     * @param {Backbone.RelationalModel.constructor} type
     * @param {Object} relation
     * @private
     */
    _addRelation: function( type, relation ) {
      if ( !type.prototype.relations ) {
        type.prototype.relations = [];
      }
      type.prototype.relations.push( relation );

      _.each( type._subModels || [], function( subModel ) {
        this._addRelation( subModel, relation );
      }, this );
    },

    /**
     * Add a 'relation' to all existing instances of 'relation.model' in the store
     * @param {Object} relation
     */
    retroFitRelation: function( relation ) {
      var coll = this.getCollection( relation.model, false );
      coll && coll.each( function( model ) {
        if ( !( model instanceof relation.model ) ) {
          return;
        }

        new relation.type( model, relation );
      }, this );
    },

    /**
     * Find the Store's collection for a certain type of model.
     * @param {Backbone.RelationalModel} type
     * @param {Boolean} [create=true] Should a collection be created if none is found?
     * @return {Backbone.Collection} A collection if found (or applicable for 'model'), or null
     */
    getCollection: function( type, create ) {
      if ( type instanceof Backbone.RelationalModel ) {
        type = type.constructor;
      }
      
      var rootModel = type;
      while ( rootModel._superModel ) {
        rootModel = rootModel._superModel;
      }
      
      var coll = _.find( this._collections, function(item) {
        return item.model === rootModel;  
      });
      
      if ( !coll && create !== false ) {
        coll = this._createCollection( rootModel );
      }
      
      return coll;
    },

    /**
     * Find a model type on one of the modelScopes by name. Names are split on dots.
     * @param {String} name
     * @return {Object}
     */
    getObjectByName: function( name ) {
      var parts = name.split( '.' ),
        type = null;

      _.find( this._modelScopes, function( scope ) {
        type = _.reduce( parts || [], function( memo, val ) {
          return memo ? memo[ val ] : undefined;
        }, scope );

        if ( type && type !== scope ) {
          return true;
        }
      }, this );

      return type;
    },

    _createCollection: function( type ) {
      var coll;
      
      // If 'type' is an instance, take its constructor
      if ( type instanceof Backbone.RelationalModel ) {
        type = type.constructor;
      }
      
      // Type should inherit from Backbone.RelationalModel.
      if ( type.prototype instanceof Backbone.RelationalModel ) {
        coll = new Backbone.Collection();
        coll.model = type;
        
        this._collections.push( coll );
      }
      
      return coll;
    },

    /**
     * Find the attribute that is to be used as the `id` on a given object
     * @param type
     * @param {String|Number|Object|Backbone.RelationalModel} item
     * @return {String|Number}
     */
    resolveIdForItem: function( type, item ) {
      var id = _.isString( item ) || _.isNumber( item ) ? item : null;

      if ( id === null ) {
        if ( item instanceof Backbone.RelationalModel ) {
          id = item.id;
        }
        else if ( _.isObject( item ) ) {
          id = item[ type.prototype.idAttribute ];
        }
      }

      // Make all falsy values `null` (except for 0, which could be an id.. see '/issues/179')
      if ( !id && id !== 0 ) {
        id = null;
      }

      return id;
    },

    /**
     * Find a specific model of a certain `type` in the store
     * @param type
     * @param {String|Number|Object|Backbone.RelationalModel} item
     */
    find: function( type, item ) {
      var id = this.resolveIdForItem( type, item );
      var coll = this.getCollection( type );
      
      // Because the found object could be of any of the type's superModel
      // types, only return it if it's actually of the type asked for.
      if ( coll ) {
        var obj = coll.get( id );

        if ( obj instanceof type ) {
          return obj;
        }
      }

      return null;
    },

    /**
     * Add a 'model' to its appropriate collection. Retain the original contents of 'model.collection'.
     * @param {Backbone.RelationalModel} model
     */
    register: function( model ) {
      var coll = this.getCollection( model );

      if ( coll ) {
        var modelColl = model.collection;
        coll.add( model );
        this.listenTo( model, 'destroy', this.unregister, this );
        this.listenTo( model, 'relational:unregister', this.unregister, this );
        model.collection = modelColl;
      }
    },

    /**
     * Check if the given model may use the given `id`
     * @param model
     * @param [id]
     */
    checkId: function( model, id ) {
      var coll = this.getCollection( model ),
        duplicate = coll && coll.get( id );

      if ( duplicate && model !== duplicate ) {
        if ( Backbone.Relational.showWarnings && typeof console !== 'undefined' ) {
          console.warn( 'Duplicate id! Old RelationalModel=%o, new RelationalModel=%o', duplicate, model );
        }

        throw new Error( "Cannot instantiate more than one Backbone.RelationalModel with the same id per type!" );
      }
    },

    /**
     * Explicitly update a model's id in its store collection
     * @param {Backbone.RelationalModel} model
     */
    update: function( model ) {
      var coll = this.getCollection( model );
      // This triggers updating the lookup indices kept in a collection
      coll._onModelEvent( 'change:' + model.idAttribute, model, coll );

      // Trigger an event on model so related models (having the model's new id in their keyContents) can add it.
      model.trigger( 'relational:change:id', model, coll );
    },

    /**
     * Remove a 'model' from the store.
     * @param {Backbone.RelationalModel} model
     */
    unregister: function( model, collection, options ) {
      this.stopListening( model );
      var coll = this.getCollection( model );
      coll && coll.remove( model, options );
    },

    /**
     * Reset the `store` to it's original state. The `reverseRelations` are kept though, since attempting to
     * re-initialize these on models would lead to a large amount of warnings.
     */
    reset: function() {
      this.stopListening();
      this._collections = [];
      this._subModels = [];
      this._modelScopes = [ exports ];
    }
  });
  Backbone.Relational.store = new Backbone.Store();

  /**
   * The main Relation class, from which 'HasOne' and 'HasMany' inherit. Internally, 'relational:<key>' events
   * are used to regulate addition and removal of models from relations.
   *
   * @param {Backbone.RelationalModel} [instance] Model that this relation is created for. If no model is supplied,
   *      Relation just tries to instantiate it's `reverseRelation` if specified, and bails out after that.
   * @param {Object} options
   * @param {string} options.key
   * @param {Backbone.RelationalModel.constructor} options.relatedModel
   * @param {Boolean|String} [options.includeInJSON=true] Serialize the given attribute for related model(s)' in toJSON, or just their ids.
   * @param {Boolean} [options.createModels=true] Create objects from the contents of keys if the object is not found in Backbone.store.
   * @param {Object} [options.reverseRelation] Specify a bi-directional relation. If provided, Relation will reciprocate
   *    the relation to the 'relatedModel'. Required and optional properties match 'options', except that it also needs
   *    {Backbone.Relation|String} type ('HasOne' or 'HasMany').
   * @param {Object} opts
   */
  Backbone.Relation = function( instance, options, opts ) {
    this.instance = instance;
    // Make sure 'options' is sane, and fill with defaults from subclasses and this object's prototype
    options = _.isObject( options ) ? options : {};
    this.reverseRelation = _.defaults( options.reverseRelation || {}, this.options.reverseRelation );
    this.options = _.defaults( options, this.options, Backbone.Relation.prototype.options );

    this.reverseRelation.type = !_.isString( this.reverseRelation.type ) ? this.reverseRelation.type :
      Backbone[ this.reverseRelation.type ] || Backbone.Relational.store.getObjectByName( this.reverseRelation.type );

    this.key = this.options.key;
    this.keySource = this.options.keySource || this.key;
    this.keyDestination = this.options.keyDestination || this.keySource || this.key;

    this.model = this.options.model || this.instance.constructor;

    this.relatedModel = this.options.relatedModel;

    if ( _.isFunction( this.relatedModel ) && !( this.relatedModel.prototype instanceof Backbone.RelationalModel ) ) {
      this.relatedModel = _.result( this, 'relatedModel' );
    }
    if ( _.isString( this.relatedModel ) ) {
      this.relatedModel = Backbone.Relational.store.getObjectByName( this.relatedModel );
    }

    if ( !this.checkPreconditions() ) {
      return;
    }

    // Add the reverse relation on 'relatedModel' to the store's reverseRelations
    if ( !this.options.isAutoRelation && this.reverseRelation.type && this.reverseRelation.key ) {
      Backbone.Relational.store.addReverseRelation( _.defaults( {
          isAutoRelation: true,
          model: this.relatedModel,
          relatedModel: this.model,
          reverseRelation: this.options // current relation is the 'reverseRelation' for its own reverseRelation
        },
        this.reverseRelation // Take further properties from this.reverseRelation (type, key, etc.)
      ) );
    }

    if ( instance ) {
      var contentKey = this.keySource;
      if ( contentKey !== this.key && typeof this.instance.get( this.key ) === 'object' ) {
        contentKey = this.key;
      }

      this.setKeyContents( this.instance.get( contentKey ) );
      this.relatedCollection = Backbone.Relational.store.getCollection( this.relatedModel );

      // Explicitly clear 'keySource', to prevent a leaky abstraction if 'keySource' differs from 'key'.
      if ( this.keySource !== this.key ) {
        delete this.instance.attributes[ this.keySource ];
      }

      // Add this Relation to instance._relations
      this.instance._relations[ this.key ] = this;

      this.initialize( opts );

      if ( this.options.autoFetch ) {
        this.instance.fetchRelated( this.key, _.isObject( this.options.autoFetch ) ? this.options.autoFetch : {} );
      }

      // When 'relatedModel' are created or destroyed, check if it affects this relation.
      this.listenTo( this.instance, 'destroy', this.destroy )
        .listenTo( this.relatedCollection, 'relational:add relational:change:id', this.tryAddRelated )
        .listenTo( this.relatedCollection, 'relational:remove', this.removeRelated )
    }
  };
  // Fix inheritance :\
  Backbone.Relation.extend = Backbone.Model.extend;
  // Set up all inheritable **Backbone.Relation** properties and methods.
  _.extend( Backbone.Relation.prototype, Backbone.Events, Backbone.Semaphore, {
    options: {
      createModels: true,
      includeInJSON: true,
      isAutoRelation: false,
      autoFetch: false,
      parse: false
    },

    instance: null,
    key: null,
    keyContents: null,
    relatedModel: null,
    relatedCollection: null,
    reverseRelation: null,
    related: null,

    /**
     * Check several pre-conditions.
     * @return {Boolean} True if pre-conditions are satisfied, false if they're not.
     */
    checkPreconditions: function() {
      var i = this.instance,
        k = this.key,
        m = this.model,
        rm = this.relatedModel,
        warn = Backbone.Relational.showWarnings && typeof console !== 'undefined';

      if ( !m || !k || !rm ) {
        warn && console.warn( 'Relation=%o: missing model, key or relatedModel (%o, %o, %o).', this, m, k, rm );
        return false;
      }
      // Check if the type in 'model' inherits from Backbone.RelationalModel
      if ( !( m.prototype instanceof Backbone.RelationalModel ) ) {
        warn && console.warn( 'Relation=%o: model does not inherit from Backbone.RelationalModel (%o).', this, i );
        return false;
      }
      // Check if the type in 'relatedModel' inherits from Backbone.RelationalModel
      if ( !( rm.prototype instanceof Backbone.RelationalModel ) ) {
        warn && console.warn( 'Relation=%o: relatedModel does not inherit from Backbone.RelationalModel (%o).', this, rm );
        return false;
      }
      // Check if this is not a HasMany, and the reverse relation is HasMany as well
      if ( this instanceof Backbone.HasMany && this.reverseRelation.type === Backbone.HasMany ) {
        warn && console.warn( 'Relation=%o: relation is a HasMany, and the reverseRelation is HasMany as well.', this );
        return false;
      }
      // Check if we're not attempting to create a relationship on a `key` that's already used.
      if ( i && _.keys( i._relations ).length ) {
        var existing = _.find( i._relations, function( rel ) {
          return rel.key === k;
        }, this );

        if ( existing ) {
          warn && console.warn( 'Cannot create relation=%o on %o for model=%o: already taken by relation=%o.',
            this, k, i, existing );
          return false;
        }
      }

      return true;
    },

    /**
     * Set the related model(s) for this relation
     * @param {Backbone.Model|Backbone.Collection} related
     */
    setRelated: function( related ) {
      this.related = related;

      this.instance.acquire();
      this.instance.attributes[ this.key ] = related;
      this.instance.release();
    },

    /**
     * Determine if a relation (on a different RelationalModel) is the reverse
     * relation of the current one.
     * @param {Backbone.Relation} relation
     * @return {Boolean}
     */
    _isReverseRelation: function( relation ) {
      return relation.instance instanceof this.relatedModel && this.reverseRelation.key === relation.key &&
        this.key === relation.reverseRelation.key;
    },

    /**
     * Get the reverse relations (pointing back to 'this.key' on 'this.instance') for the currently related model(s).
     * @param {Backbone.RelationalModel} [model] Get the reverse relations for a specific model.
     *    If not specified, 'this.related' is used.
     * @return {Backbone.Relation[]}
     */
    getReverseRelations: function( model ) {
      var reverseRelations = [];
      // Iterate over 'model', 'this.related.models' (if this.related is a Backbone.Collection), or wrap 'this.related' in an array.
      var models = !_.isUndefined( model ) ? [ model ] : this.related && ( this.related.models || [ this.related ] );
      _.each( models || [], function( related ) {
        _.each( related.getRelations() || [], function( relation ) {
            if ( this._isReverseRelation( relation ) ) {
              reverseRelations.push( relation );
            }
          }, this );
      }, this );
      
      return reverseRelations;
    },

    /**
     * When `this.instance` is destroyed, cleanup our relations.
     * Get reverse relation, call removeRelated on each.
     */
    destroy: function() {
      this.stopListening();

      if ( this instanceof Backbone.HasOne ) {
        this.setRelated( null );
      }
      else if ( this instanceof Backbone.HasMany ) {
        this.setRelated( this._prepareCollection() );
      }
      
      _.each( this.getReverseRelations(), function( relation ) {
        relation.removeRelated( this.instance );
      }, this );
    }
  });

  Backbone.HasOne = Backbone.Relation.extend({
    options: {
      reverseRelation: { type: 'HasMany' }
    },

    initialize: function( opts ) {
      this.listenTo( this.instance, 'relational:change:' + this.key, this.onChange );

      var related = this.findRelated( opts );
      this.setRelated( related );

      // Notify new 'related' object of the new relation.
      _.each( this.getReverseRelations(), function( relation ) {
        relation.addRelated( this.instance, opts );
      }, this );
    },

    /**
     * Find related Models.
     * @param {Object} [options]
     * @return {Backbone.Model}
     */
    findRelated: function( options ) {
      var related = null;

      options = _.defaults( { parse: this.options.parse }, options );

      if ( this.keyContents instanceof this.relatedModel ) {
        related = this.keyContents;
      }
      else if ( this.keyContents || this.keyContents === 0 ) { // since 0 can be a valid `id` as well
        var opts = _.defaults( { create: this.options.createModels }, options );
        related = this.relatedModel.findOrCreate( this.keyContents, opts );
      }

      // Nullify `keyId` if we have a related model; in case it was already part of the relation
      if ( this.related ) {
        this.keyId = null;
      }

      return related;
    },

    /**
     * Normalize and reduce `keyContents` to an `id`, for easier comparison
     * @param {String|Number|Backbone.Model} keyContents
     */
    setKeyContents: function( keyContents ) {
      this.keyContents = keyContents;
      this.keyId = Backbone.Relational.store.resolveIdForItem( this.relatedModel, this.keyContents );
    },

    /**
     * Event handler for `change:<key>`.
     * If the key is changed, notify old & new reverse relations and initialize the new relation.
     */
    onChange: function( model, attr, options ) {
      // Don't accept recursive calls to onChange (like onChange->findRelated->findOrCreate->initializeRelations->addRelated->onChange)
      if ( this.isLocked() ) {
        return;
      }
      this.acquire();
      options = options ? _.clone( options ) : {};
      
      // 'options.__related' is set by 'addRelated'/'removeRelated'. If it is set, the change
      // is the result of a call from a relation. If it's not, the change is the result of 
      // a 'set' call on this.instance.
      var changed = _.isUndefined( options.__related ),
        oldRelated = changed ? this.related : options.__related;
      
      if ( changed ) {
        this.setKeyContents( attr );
        var related = this.findRelated( options );
        this.setRelated( related );
      }
      
      // Notify old 'related' object of the terminated relation
      if ( oldRelated && this.related !== oldRelated ) {
        _.each( this.getReverseRelations( oldRelated ), function( relation ) {
          relation.removeRelated( this.instance, null, options );
        }, this );
      }

      // Notify new 'related' object of the new relation. Note we do re-apply even if this.related is oldRelated;
      // that can be necessary for bi-directional relations if 'this.instance' was created after 'this.related'.
      // In that case, 'this.instance' will already know 'this.related', but the reverse might not exist yet.
      _.each( this.getReverseRelations(), function( relation ) {
        relation.addRelated( this.instance, options );
      }, this );
      
      // Fire the 'change:<key>' event if 'related' was updated
      if ( !options.silent && this.related !== oldRelated ) {
        var dit = this;
        this.changed = true;
        Backbone.Relational.eventQueue.add( function() {
          dit.instance.trigger( 'change:' + dit.key, dit.instance, dit.related, options, true );
          dit.changed = false;
        });
      }
      this.release();
    },

    /**
     * If a new 'this.relatedModel' appears in the 'store', try to match it to the last set 'keyContents'
     */
    tryAddRelated: function( model, coll, options ) {
      if ( ( this.keyId || this.keyId === 0 ) && model.id === this.keyId ) { // since 0 can be a valid `id` as well
        this.addRelated( model, options );
        this.keyId = null;
      }
    },

    addRelated: function( model, options ) {
      // Allow 'model' to set up its relations before proceeding.
      // (which can result in a call to 'addRelated' from a relation of 'model')
      var dit = this;
      model.queue( function() {
        if ( model !== dit.related ) {
          var oldRelated = dit.related || null;
          dit.setRelated( model );
          dit.onChange( dit.instance, model, _.defaults( { __related: oldRelated }, options ) );
        }
      });
    },

    removeRelated: function( model, coll, options ) {
      if ( !this.related ) {
        return;
      }
      
      if ( model === this.related ) {
        var oldRelated = this.related || null;
        this.setRelated( null );
        this.onChange( this.instance, model, _.defaults( { __related: oldRelated }, options ) );
      }
    }
  });

  Backbone.HasMany = Backbone.Relation.extend({
    collectionType: null,

    options: {
      reverseRelation: { type: 'HasOne' },
      collectionType: Backbone.Collection,
      collectionKey: true,
      collectionOptions: {}
    },

    initialize: function( opts ) {
      this.listenTo( this.instance, 'relational:change:' + this.key, this.onChange );
      
      // Handle a custom 'collectionType'
      this.collectionType = this.options.collectionType;
      if ( _.isFunction( this.collectionType ) && this.collectionType !== Backbone.Collection && !( this.collectionType.prototype instanceof Backbone.Collection ) ) {
        this.collectionType = _.result( this, 'collectionType' );
      }
      if ( _.isString( this.collectionType ) ) {
        this.collectionType = Backbone.Relational.store.getObjectByName( this.collectionType );
      }
      if ( this.collectionType !== Backbone.Collection && !( this.collectionType.prototype instanceof Backbone.Collection ) ) {
        throw new Error( '`collectionType` must inherit from Backbone.Collection' );
      }

      var related = this.findRelated( opts );
      this.setRelated( related );
    },

    /**
     * Bind events and setup collectionKeys for a collection that is to be used as the backing store for a HasMany.
     * If no 'collection' is supplied, a new collection will be created of the specified 'collectionType' option.
     * @param {Backbone.Collection} [collection]
     * @return {Backbone.Collection}
     */
    _prepareCollection: function( collection ) {
      if ( this.related ) {
        this.stopListening( this.related );
      }

      if ( !collection || !( collection instanceof Backbone.Collection ) ) {
        var options = _.isFunction( this.options.collectionOptions ) ?
          this.options.collectionOptions( this.instance ) : this.options.collectionOptions;

        collection = new this.collectionType( null, options );
      }

      collection.model = this.relatedModel;
      
      if ( this.options.collectionKey ) {
        var key = this.options.collectionKey === true ? this.options.reverseRelation.key : this.options.collectionKey;
        
        if ( collection[ key ] && collection[ key ] !== this.instance ) {
          if ( Backbone.Relational.showWarnings && typeof console !== 'undefined' ) {
            console.warn( 'Relation=%o; collectionKey=%s already exists on collection=%o', this, key, this.options.collectionKey );
          }
        }
        else if ( key ) {
          collection[ key ] = this.instance;
        }
      }

      this.listenTo( collection, 'relational:add', this.handleAddition )
        .listenTo( collection, 'relational:remove', this.handleRemoval )
        .listenTo( collection, 'relational:reset', this.handleReset );
      
      return collection;
    },

    /**
     * Find related Models.
     * @param {Object} [options]
     * @return {Backbone.Collection}
     */
    findRelated: function( options ) {
      var related = null;

      options = _.defaults( { parse: this.options.parse }, options );

      // Replace 'this.related' by 'this.keyContents' if it is a Backbone.Collection
      if ( this.keyContents instanceof Backbone.Collection ) {
        this._prepareCollection( this.keyContents );
        related = this.keyContents;
      }
      // Otherwise, 'this.keyContents' should be an array of related object ids.
      // Re-use the current 'this.related' if it is a Backbone.Collection; otherwise, create a new collection.
      else {
        var toAdd = [];

        _.each( this.keyContents, function( attributes ) {
          if ( attributes instanceof this.relatedModel ) {
            var model = attributes;
          }
          else {
            // If `merge` is true, update models here, instead of during update.
            model = this.relatedModel.findOrCreate( attributes,
              _.extend( { merge: true }, options, { create: this.options.createModels } )
            );
          }

          model && toAdd.push( model );
        }, this );

        if ( this.related instanceof Backbone.Collection ) {
          related = this.related;
        }
        else {
          related = this._prepareCollection();
        }

        // By now, both `merge` and `parse` will already have been executed for models if they were specified.
        // Disable them to prevent additional calls.
        related.set( toAdd, _.defaults( { merge: false, parse: false }, options ) );
      }

      // Remove entries from `keyIds` that were already part of the relation (and are thus 'unchanged')
      this.keyIds = _.difference( this.keyIds, _.pluck( related.models, 'id' ) );

      return related;
    },

    /**
     * Normalize and reduce `keyContents` to a list of `ids`, for easier comparison
     * @param {String|Number|String[]|Number[]|Backbone.Collection} keyContents
     */
    setKeyContents: function( keyContents ) {
      this.keyContents = keyContents instanceof Backbone.Collection ? keyContents : null;
      this.keyIds = [];

      if ( !this.keyContents && ( keyContents || keyContents === 0 ) ) { // since 0 can be a valid `id` as well
        // Handle cases the an API/user supplies just an Object/id instead of an Array
        this.keyContents = _.isArray( keyContents ) ? keyContents : [ keyContents ];

        _.each( this.keyContents, function( item ) {
          var itemId = Backbone.Relational.store.resolveIdForItem( this.relatedModel, item );
          if ( itemId || itemId === 0 ) {
            this.keyIds.push( itemId );
          }
        }, this );
      }
    },

    /**
     * Event handler for `change:<key>`.
     * If the contents of the key are changed, notify old & new reverse relations and initialize the new relation.
     */
    onChange: function( model, attr, options ) {
      options = options ? _.clone( options ) : {};
      this.setKeyContents( attr );
      this.changed = false;

      var related = this.findRelated( options );
      this.setRelated( related );

      if ( !options.silent ) {
        var dit = this;
        Backbone.Relational.eventQueue.add( function() {
          // The `changed` flag can be set in `handleAddition` or `handleRemoval`
          if ( dit.changed ) {
            dit.instance.trigger( 'change:' + dit.key, dit.instance, dit.related, options, true );
            dit.changed = false;
          }
        });
      }
    },

    /**
     * When a model is added to a 'HasMany', trigger 'add' on 'this.instance' and notify reverse relations.
     * (should be 'HasOne', must set 'this.instance' as their related).
    */
    handleAddition: function( model, coll, options ) {
      //console.debug('handleAddition called; args=%o', arguments);
      options = options ? _.clone( options ) : {};
      this.changed = true;
      
      _.each( this.getReverseRelations( model ), function( relation ) {
        relation.addRelated( this.instance, options );
      }, this );

      // Only trigger 'add' once the newly added model is initialized (so, has its relations set up)
      var dit = this;
      !options.silent && Backbone.Relational.eventQueue.add( function() {
        dit.instance.trigger( 'add:' + dit.key, model, dit.related, options );
      });
    },

    /**
     * When a model is removed from a 'HasMany', trigger 'remove' on 'this.instance' and notify reverse relations.
     * (should be 'HasOne', which should be nullified)
     */
    handleRemoval: function( model, coll, options ) {
      //console.debug('handleRemoval called; args=%o', arguments);
      options = options ? _.clone( options ) : {};
      this.changed = true;
      
      _.each( this.getReverseRelations( model ), function( relation ) {
        relation.removeRelated( this.instance, null, options );
      }, this );
      
      var dit = this;
      !options.silent && Backbone.Relational.eventQueue.add( function() {
         dit.instance.trigger( 'remove:' + dit.key, model, dit.related, options );
      });
    },

    handleReset: function( coll, options ) {
      var dit = this;
      options = options ? _.clone( options ) : {};
      !options.silent && Backbone.Relational.eventQueue.add( function() {
        dit.instance.trigger( 'reset:' + dit.key, dit.related, options );
      });
    },

    tryAddRelated: function( model, coll, options ) {
      var item = _.contains( this.keyIds, model.id );

      if ( item ) {
        this.addRelated( model, options );
        this.keyIds = _.without( this.keyIds, model.id );
      }
    },

    addRelated: function( model, options ) {
      // Allow 'model' to set up its relations before proceeding.
      // (which can result in a call to 'addRelated' from a relation of 'model')
      var dit = this;
      model.queue( function() {
        if ( dit.related && !dit.related.get( model ) ) {
          dit.related.add( model, _.defaults( { parse: false }, options ) );
        }
      });
    },

    removeRelated: function( model, coll, options ) {
      if ( this.related.get( model ) ) {
        this.related.remove( model, options );
      }
    }
  });

  /**
   * A type of Backbone.Model that also maintains relations to other models and collections.
   * New events when compared to the original:
   *  - 'add:<key>' (model, related collection, options)
   *  - 'remove:<key>' (model, related collection, options)
   *  - 'change:<key>' (model, related model or collection, options)
   */
  Backbone.RelationalModel = Backbone.Model.extend({
    relations: null, // Relation descriptions on the prototype
    _relations: null, // Relation instances
    _isInitialized: false,
    _deferProcessing: false,
    _queue: null,
    _attributeChangeFired: false, // Keeps track of `change` event firing under some conditions (like nested `set`s)

    subModelTypeAttribute: 'type',
    subModelTypes: null,

    constructor: function( attributes, options ) {
      // Nasty hack, for cases like 'model.get( <HasMany key> ).add( item )'.
      // Defer 'processQueue', so that when 'Relation.createModels' is used we trigger 'HasMany'
      // collection events only after the model is really fully set up.
      // Example: event for "p.on( 'add:jobs' )" -> "p.get('jobs').add( { company: c.id, person: p.id } )".
      if ( options && options.collection ) {
        var dit = this,
          collection = this.collection =  options.collection;

        // Prevent `collection` from cascading down to nested models; they shouldn't go into this `if` clause.
        delete options.collection;

        this._deferProcessing = true;

        var processQueue = function( model ) {
          if ( model === dit ) {
            dit._deferProcessing = false;
            dit.processQueue();
            collection.off( 'relational:add', processQueue );
          }
        };
        collection.on( 'relational:add', processQueue );

        // So we do process the queue eventually, regardless of whether this model actually gets added to 'options.collection'.
        _.defer( function() {
          processQueue( dit );
        });
      }

      Backbone.Relational.store.processOrphanRelations();
      
      this._queue = new Backbone.BlockingQueue();
      this._queue.block();
      Backbone.Relational.eventQueue.block();

      try {
        Backbone.Model.apply( this, arguments );
      }
      finally {
        // Try to run the global queue holding external events
        Backbone.Relational.eventQueue.unblock();
      }
    },

    /**
     * Override 'trigger' to queue 'change' and 'change:*' events
     */
    trigger: function( eventName ) {
      if ( eventName.length > 5 && eventName.indexOf( 'change' ) === 0 ) {
        var dit = this,
          args = arguments;

        Backbone.Relational.eventQueue.add( function() {
          if ( !dit._isInitialized ) {
            return;
          }

          // Determine if the `change` event is still valid, now that all relations are populated
          var changed = true;
          if ( eventName === 'change' ) {
            // `hasChanged` may have gotten reset by nested calls to `set`.
            changed = dit.hasChanged() || dit._attributeChangeFired;
            dit._attributeChangeFired = false;
          }
          else {
            var attr = eventName.slice( 7 ),
              rel = dit.getRelation( attr );

            if ( rel ) {
              // If `attr` is a relation, `change:attr` get triggered from `Relation.onChange`.
              // These take precedence over `change:attr` events triggered by `Model.set`.
              // The relation sets a fourth attribute to `true`. If this attribute is present,
              // continue triggering this event; otherwise, it's from `Model.set` and should be stopped.
              changed = ( args[ 4 ] === true );

              // If this event was triggered by a relation, set the right value in `this.changed`
              // (a Collection or Model instead of raw data).
              if ( changed ) {
                dit.changed[ attr ] = args[ 2 ];
              }
              // Otherwise, this event is from `Model.set`. If the relation doesn't report a change,
              // remove attr from `dit.changed` so `hasChanged` doesn't take it into account.
              else if ( !rel.changed ) {
                delete dit.changed[ attr ];
              }
            }
            else if ( changed ) {
              dit._attributeChangeFired = true;
            }
          }

          changed && Backbone.Model.prototype.trigger.apply( dit, args );
        });
      }
      else {
        Backbone.Model.prototype.trigger.apply( this, arguments );
      }

      return this;
    },

    /**
     * Initialize Relations present in this.relations; determine the type (HasOne/HasMany), then creates a new instance.
     * Invoked in the first call so 'set' (which is made from the Backbone.Model constructor).
     */
    initializeRelations: function( options ) {
      this.acquire(); // Setting up relations often also involve calls to 'set', and we only want to enter this function once
      this._relations = {};

      _.each( _.result( this, 'relations' ) || [], function( rel ) {
        Backbone.Relational.store.initializeRelation( this, rel, options );
      }, this );

      this._isInitialized = true;
      this.release();
      this.processQueue();
    },

    /**
     * When new values are set, notify this model's relations (also if options.silent is set).
     * (Relation.setRelated locks this model before calling 'set' on it to prevent loops)
     */
    updateRelations: function( options ) {
      if ( this._isInitialized && !this.isLocked() ) {
        _.each( this._relations, function( rel ) {
          // Update from data in `rel.keySource` if data got set in there, or `rel.key` otherwise
          var val = this.attributes[ rel.keySource ] || this.attributes[ rel.key ];
          if ( rel.related !== val ) {
            this.trigger( 'relational:change:' + rel.key, this, val, options || {} );
          }

          // Explicitly clear 'keySource', to prevent a leaky abstraction if 'keySource' differs from 'key'.
          if ( rel.keySource !== rel.key ) {
            delete rel.instance.attributes[ rel.keySource ];
          }
        }, this );
      }
    },

    /**
     * Either add to the queue (if we're not initialized yet), or execute right away.
     */
    queue: function( func ) {
      this._queue.add( func );
    },

    /**
     * Process _queue
     */
    processQueue: function() {
      if ( this._isInitialized && !this._deferProcessing && this._queue.isBlocked() ) {
        this._queue.unblock();
      }
    },

    /**
     * Get a specific relation.
     * @param key {string} The relation key to look for.
     * @return {Backbone.Relation} An instance of 'Backbone.Relation', if a relation was found for 'key', or null.
     */
    getRelation: function( key ) {
      return this._relations[ key ];
    },

    /**
     * Get all of the created relations.
     * @return {Backbone.Relation[]}
     */
    getRelations: function() {
      return _.values( this._relations );
    },

    /**
     * Retrieve related objects.
     * @param key {string} The relation key to fetch models for.
     * @param [options] {Object} Options for 'Backbone.Model.fetch' and 'Backbone.sync'.
     * @param [refresh=false] {boolean} Fetch existing models from the server as well (in order to update them).
     * @return {jQuery.when[]} An array of request objects
     */
    fetchRelated: function( key, options, refresh ) {
      // Set default `options` for fetch
      options = _.extend( { update: true, remove: false }, options );

      var setUrl,
        requests = [],
        rel = this.getRelation( key ),
        idsToFetch = rel && ( ( rel.keyIds && rel.keyIds.slice( 0 ) ) || ( ( rel.keyId || rel.keyId === 0 ) ? [ rel.keyId ] : [] ) );

      // On `refresh`, add the ids for current models in the relation to `idsToFetch`
      if ( refresh ) {
        var models = rel.related instanceof Backbone.Collection ? rel.related.models : [ rel.related ];
        _.each( models, function( model ) {
          if ( model.id || model.id === 0 ) {
            idsToFetch.push( model.id );
          }
        });
      }

      if ( idsToFetch && idsToFetch.length ) {
        // Find (or create) a model for each one that is to be fetched
        var created = [],
          models = _.map( idsToFetch, function( id ) {
            var model = Backbone.Relational.store.find( rel.relatedModel, id );
            
            if ( !model ) {
              var attrs = {};
              attrs[ rel.relatedModel.prototype.idAttribute ] = id;
              model = rel.relatedModel.findOrCreate( attrs, options );
              created.push( model );
            }

            return model;
          }, this );
        
        // Try if the 'collection' can provide a url to fetch a set of models in one request.
        if ( rel.related instanceof Backbone.Collection && _.isFunction( rel.related.url ) ) {
          setUrl = rel.related.url( models );
        }

        // An assumption is that when 'Backbone.Collection.url' is a function, it can handle building of set urls.
        // To make sure it can, test if the url we got by supplying a list of models to fetch is different from
        // the one supplied for the default fetch action (without args to 'url').
        if ( setUrl && setUrl !== rel.related.url() ) {
          var opts = _.defaults(
            {
              error: function() {
                var args = arguments;
                _.each( created, function( model ) {
                  model.trigger( 'destroy', model, model.collection, options );
                  options.error && options.error.apply( model, args );
                });
              },
              url: setUrl
            },
            options
          );

          requests = [ rel.related.fetch( opts ) ];
        }
        else {
          requests = _.map( models, function( model ) {
            var opts = _.defaults(
              {
                error: function() {
                  if ( _.contains( created, model ) ) {
                    model.trigger( 'destroy', model, model.collection, options );
                    options.error && options.error.apply( model, arguments );
                  }
                }
              },
              options
            );
            return model.fetch( opts );
          }, this );
        }
      }
      
      return requests;
    },

    get: function( attr ) {
      var originalResult = Backbone.Model.prototype.get.call( this, attr );

      // Use `originalResult` get if dotNotation not enabled or not required because no dot is in `attr`
      if ( !this.dotNotation || attr.indexOf( '.' ) === -1 ) {
        return originalResult;
      }

      // Go through all splits and return the final result
      var splits = attr.split( '.' );
      var result = _.reduce(splits, function( model, split ) {
        if ( _.isNull(model) || _.isUndefined( model ) ) {
          // Return undefined if the path cannot be expanded
          return undefined;
        }
        else if ( model instanceof Backbone.Model ) {
          return Backbone.Model.prototype.get.call( model, split );
        }
        else if ( model instanceof Backbone.Collection ) {
          return Backbone.Collection.prototype.at.call( model, split )
        }
        else {
          throw new Error( 'Attribute must be an instanceof Backbone.Model or Backbone.Collection. Is: ' + model + ', currentSplit: ' + split );
        }
      }, this );

      if ( originalResult !== undefined && result !== undefined ) {
        throw new Error( "Ambiguous result for '" + attr + "'. direct result: " + originalResult + ", dotNotation: " + result );
      }

      return originalResult || result;
    },

    set: function( key, value, options ) {
      Backbone.Relational.eventQueue.block();

      // Duplicate backbone's behavior to allow separate key/value parameters, instead of a single 'attributes' object
      var attributes;
      if ( _.isObject( key ) || key == null ) {
        attributes = key;
        options = value;
      }
      else {
        attributes = {};
        attributes[ key ] = value;
      }

      try {
        var id = this.id,
          newId = attributes && this.idAttribute in attributes && attributes[ this.idAttribute ];

        // Check if we're not setting a duplicate id before actually calling `set`.
        Backbone.Relational.store.checkId( this, newId );

        var result = Backbone.Model.prototype.set.apply( this, arguments );

        // Ideal place to set up relations, if this is the first time we're here for this model
        if ( !this._isInitialized && !this.isLocked() ) {
          this.constructor.initializeModelHierarchy();
          Backbone.Relational.store.register( this );
          this.initializeRelations( options );
        }
        // The store should know about an `id` update asap
        else if ( newId && newId !== id ) {
          Backbone.Relational.store.update( this );
        }

        if ( attributes ) {
          this.updateRelations( options );
        }
      }
      finally {
        // Try to run the global queue holding external events
        Backbone.Relational.eventQueue.unblock();
      }
      
      return result;
    },

    clone: function() {
      var attributes = _.clone( this.attributes );
      if ( !_.isUndefined( attributes[ this.idAttribute ] ) ) {
        attributes[ this.idAttribute ] = null;
      }

      _.each( this.getRelations(), function( rel ) {
        delete attributes[ rel.key ];
      });

      return new this.constructor( attributes );
    },

    /**
     * Convert relations to JSON, omits them when required
     */
    toJSON: function( options ) {
      // If this Model has already been fully serialized in this branch once, return to avoid loops
      if ( this.isLocked() ) {
        return this.id;
      }

      this.acquire();
      var json = Backbone.Model.prototype.toJSON.call( this, options );

      if ( this.constructor._superModel && !( this.constructor._subModelTypeAttribute in json ) ) {
        json[ this.constructor._subModelTypeAttribute ] = this.constructor._subModelTypeValue;
      }

      _.each( this._relations, function( rel ) {
        var related = json[ rel.key ],
          includeInJSON = rel.options.includeInJSON,
          value = null;

        if ( includeInJSON === true ) {
          if ( related && _.isFunction( related.toJSON ) ) {
            value = related.toJSON( options );
          }
        }
        else if ( _.isString( includeInJSON ) ) {
          if ( related instanceof Backbone.Collection ) {
            value = related.pluck( includeInJSON );
          }
          else if ( related instanceof Backbone.Model ) {
            value = related.get( includeInJSON );
          }

          // Add ids for 'unfound' models if includeInJSON is equal to (only) the relatedModel's `idAttribute`
          if ( includeInJSON === rel.relatedModel.prototype.idAttribute ) {
            if ( rel instanceof Backbone.HasMany ) {
              value = value.concat( rel.keyIds );
            }
            else if  ( rel instanceof Backbone.HasOne ) {
              value = value || rel.keyId;
            }
          }
        }
        else if ( _.isArray( includeInJSON ) ) {
          if ( related instanceof Backbone.Collection ) {
            value = [];
            related.each( function( model ) {
              var curJson = {};
              _.each( includeInJSON, function( key ) {
                curJson[ key ] = model.get( key );
              });
              value.push( curJson );
            });
          }
          else if ( related instanceof Backbone.Model ) {
            value = {};
            _.each( includeInJSON, function( key ) {
              value[ key ] = related.get( key );
            });
          }
        }
        else {
          delete json[ rel.key ];
        }

        if ( includeInJSON ) {
          json[ rel.keyDestination ] = value;
        }

        if ( rel.keyDestination !== rel.key ) {
          delete json[ rel.key ];
        }
      });
      
      this.release();
      return json;
    }
  },
  {
    /**
     *
     * @param superModel
     * @returns {Backbone.RelationalModel.constructor}
     */
    setup: function( superModel ) {
      // We don't want to share a relations array with a parent, as this will cause problems with
      // reverse relations.
      this.prototype.relations = ( this.prototype.relations || [] ).slice( 0 );

      this._subModels = {};
      this._superModel = null;

      // If this model has 'subModelTypes' itself, remember them in the store
      if ( this.prototype.hasOwnProperty( 'subModelTypes' ) ) {
        Backbone.Relational.store.addSubModels( this.prototype.subModelTypes, this );
      }
      // The 'subModelTypes' property should not be inherited, so reset it.
      else {
        this.prototype.subModelTypes = null;
      }

      // Initialize all reverseRelations that belong to this new model.
      _.each( this.prototype.relations || [], function( rel ) {
        if ( !rel.model ) {
          rel.model = this;
        }
        
        if ( rel.reverseRelation && rel.model === this ) {
          var preInitialize = true;
          if ( _.isString( rel.relatedModel ) ) {
            /**
             * The related model might not be defined for two reasons
             *  1. it is related to itself
             *  2. it never gets defined, e.g. a typo
             *  3. the model hasn't been defined yet, but will be later
             * In neither of these cases do we need to pre-initialize reverse relations.
             * However, for 3. (which is, to us, indistinguishable from 2.), we do need to attempt
             * setting up this relation again later, in case the related model is defined later.
             */
            var relatedModel = Backbone.Relational.store.getObjectByName( rel.relatedModel );
            preInitialize = relatedModel && ( relatedModel.prototype instanceof Backbone.RelationalModel );
          }

          if ( preInitialize ) {
            Backbone.Relational.store.initializeRelation( null, rel );
          }
          else if ( _.isString( rel.relatedModel ) ) {
            Backbone.Relational.store.addOrphanRelation( rel );
          }
        }
      }, this );
      
      return this;
    },

    /**
     * Create a 'Backbone.Model' instance based on 'attributes'.
     * @param {Object} attributes
     * @param {Object} [options]
     * @return {Backbone.Model}
     */
    build: function( attributes, options ) {
      // 'build' is a possible entrypoint; it's possible no model hierarchy has been determined yet.
      this.initializeModelHierarchy();

      // Determine what type of (sub)model should be built if applicable.
      var model = this._findSubModelType(this, attributes) || this;
      
      return new model( attributes, options );
    },

    /**
     * Determines what type of (sub)model should be built if applicable.
     * Looks up the proper subModelType in 'this._subModels', recursing into
     * types until a match is found.  Returns the applicable 'Backbone.Model'
     * or null if no match is found.
     * @param {Backbone.Model} type
     * @param {Object} attributes
     * @return {Backbone.Model}
     */
    _findSubModelType: function (type, attributes) {
      if ( type._subModels && type.prototype.subModelTypeAttribute in attributes ) {
        var subModelTypeAttribute = attributes[type.prototype.subModelTypeAttribute];
        var subModelType = type._subModels[subModelTypeAttribute];
        if ( subModelType ) {
          return subModelType;
        } else {
          // Recurse into subModelTypes to find a match
          for ( subModelTypeAttribute in type._subModels ) {
            subModelType = this._findSubModelType(type._subModels[subModelTypeAttribute], attributes);
            if ( subModelType ) {
              return subModelType;
            }
          }
        }
      }
      return null;
    },

    /**
     *
     */
    initializeModelHierarchy: function() {
      // Inherit any relations that have been defined in the parent model.
      this.inheritRelations();
  
      // If we came here through 'build' for a model that has 'subModelTypes' then try to initialize the ones that
      // haven't been resolved yet.
      if ( this.prototype.subModelTypes ) {
        var resolvedSubModels = _.keys(this._subModels);
        var unresolvedSubModels = _.omit(this.prototype.subModelTypes, resolvedSubModels);
        _.each( unresolvedSubModels, function( subModelTypeName ) {
          var subModelType = Backbone.Relational.store.getObjectByName( subModelTypeName );
          subModelType && subModelType.initializeModelHierarchy();
        });
      }
    },
    
    inheritRelations: function() {
      // Bail out if we've been here before.
      if (!_.isUndefined( this._superModel ) && !_.isNull( this._superModel )) { 
        return; 
      }
      // Try to initialize the _superModel.
      Backbone.Relational.store.setupSuperModel( this );
  
      // If a superModel has been found, copy relations from the _superModel if they haven't been inherited automatically 
      // (due to a redefinition of 'relations').
      if ( this._superModel ) {
        // The _superModel needs a chance to initialize its own inherited relations before we attempt to inherit relations 
        // from the _superModel. You don't want to call 'initializeModelHierarchy' because that could cause sub-models of
        // this class to inherit their relations before this class has had chance to inherit it's relations.
        this._superModel.inheritRelations();
        if ( this._superModel.prototype.relations ) {
          // Find relations that exist on the '_superModel', but not yet on this model.
          var inheritedRelations = _.select( this._superModel.prototype.relations || [], function( superRel ) {
            return !_.any( this.prototype.relations || [], function( rel ) {
              return superRel.relatedModel === rel.relatedModel && superRel.key === rel.key;
            }, this );
          }, this );
  
          this.prototype.relations = inheritedRelations.concat( this.prototype.relations );
        }
      }
      // Otherwise, make sure we don't get here again for this type by making '_superModel' false so we fail the 
      // isUndefined/isNull check next time.
      else {
        this._superModel = false;
      }
    },

    /**
     * Find an instance of `this` type in 'Backbone.Relational.store'.
     * - If `attributes` is a string or a number, `findOrCreate` will just query the `store` and return a model if found.
     * - If `attributes` is an object and is found in the store, the model will be updated with `attributes` unless `options.update` is `false`.
     *   Otherwise, a new model is created with `attributes` (unless `options.create` is explicitly set to `false`).
     * @param {Object|String|Number} attributes Either a model's id, or the attributes used to create or update a model.
     * @param {Object} [options]
     * @param {Boolean} [options.create=true]
     * @param {Boolean} [options.merge=true]
     * @param {Boolean} [options.parse=false]
     * @return {Backbone.RelationalModel}
     */
    findOrCreate: function( attributes, options ) {
      options || ( options = {} );
      var parsedAttributes = ( _.isObject( attributes ) && options.parse && this.prototype.parse ) ?
        this.prototype.parse( _.clone( attributes ) ) : attributes;

      // Try to find an instance of 'this' model type in the store
      var model = Backbone.Relational.store.find( this, parsedAttributes );

      // If we found an instance, update it with the data in 'item' (unless 'options.merge' is false).
      // If not, create an instance (unless 'options.create' is false).
      if ( _.isObject( attributes ) ) {
        if ( model && options.merge !== false ) {
          // Make sure `options.collection` and `options.url` doesn't cascade to nested models
          delete options.collection;
          delete options.url;

          model.set( parsedAttributes, options );
        }
        else if ( !model && options.create !== false ) {
          model = this.build( attributes, options );
        }
      }

      return model;
    },

    /**
     * Find an instance of `this` type in 'Backbone.Relational.store'.
     * - If `attributes` is a string or a number, `find` will just query the `store` and return a model if found.
     * - If `attributes` is an object and is found in the store, the model will be updated with `attributes` unless `options.update` is `false`.
     * @param {Object|String|Number} attributes Either a model's id, or the attributes used to create or update a model.
     * @param {Object} [options]
     * @param {Boolean} [options.merge=true]
     * @param {Boolean} [options.parse=false]
     * @return {Backbone.RelationalModel}
     */
    find: function( attributes, options ) {
      options || ( options = {} );
      options.create = false;
      return this.findOrCreate( attributes, options );
    }
  });
  _.extend( Backbone.RelationalModel.prototype, Backbone.Semaphore );

  /**
   * Override Backbone.Collection._prepareModel, so objects will be built using the correct type
   * if the collection.model has subModels.
   * Attempts to find a model for `attrs` in Backbone.store through `findOrCreate`
   * (which sets the new properties on it if found), or instantiates a new model.
   */
  Backbone.Collection.prototype.__prepareModel = Backbone.Collection.prototype._prepareModel;
  Backbone.Collection.prototype._prepareModel = function ( attrs, options ) {
    var model;
    
    if ( attrs instanceof Backbone.Model ) {
      if ( !attrs.collection ) {
        attrs.collection = this;
      }
      model = attrs;
    }
    else {
      options || ( options = {} );
      options.collection = this;
      
      if ( typeof this.model.findOrCreate !== 'undefined' ) {
        model = this.model.findOrCreate( attrs, options );
      }
      else {
        model = new this.model( attrs, options );
      }
      
      if ( model && model.isNew() && !model._validate( attrs, options ) ) {
        this.trigger( 'invalid', this, attrs, options );
        model = false;
      }
    }
    
    return model;
  };


  /**
   * Override Backbone.Collection.set, so we'll create objects from attributes where required,
   * and update the existing models. Also, trigger 'relational:add'.
   */
  var set = Backbone.Collection.prototype.__set = Backbone.Collection.prototype.set;
  Backbone.Collection.prototype.set = function( models, options ) {
    // Short-circuit if this Collection doesn't hold RelationalModels
    if ( !( this.model.prototype instanceof Backbone.RelationalModel ) ) {
      return set.apply( this, arguments );
    }

    if ( options && options.parse ) {
      models = this.parse( models, options );
    }

    if ( !_.isArray( models ) ) {
      models = models ? [ models ] : [];
    }

    var newModels = [],
      toAdd = [];

    //console.debug( 'calling add on coll=%o; model=%o, options=%o', this, models, options );
    _.each( models, function( model ) {
      if ( !( model instanceof Backbone.Model ) ) {
        model = Backbone.Collection.prototype._prepareModel.call( this, model, options );
      }

      if ( model ) {
        toAdd.push( model );

        if ( !( this.get( model ) || this.get( model.cid ) ) ) {
          newModels.push( model );
        }
        // If we arrive in `add` while performing a `set` (after a create, so the model gains an `id`),
        // we may get here before `_onModelEvent` has had the chance to update `_byId`.
        else if ( model.id != null ) {
          this._byId[ model.id ] = model;
        }
      }
    }, this );

    // Add 'models' in a single batch, so the original add will only be called once (and thus 'sort', etc).
    // If `parse` was specified, the collection and contained models have been parsed now.
    set.call( this, toAdd, _.defaults( { parse: false }, options ) );

    _.each( newModels, function( model ) {
      // Fire a `relational:add` event for any model in `newModels` that has actually been added to the collection.
      if ( this.get( model ) || this.get( model.cid ) ) {
        this.trigger( 'relational:add', model, this, options );
      }
    }, this );
    
    return this;
  };

  /**
   * Override 'Backbone.Collection.remove' to trigger 'relational:remove'.
   */
  var remove = Backbone.Collection.prototype.__remove = Backbone.Collection.prototype.remove;
  Backbone.Collection.prototype.remove = function( models, options ) {
    // Short-circuit if this Collection doesn't hold RelationalModels
    if ( !( this.model.prototype instanceof Backbone.RelationalModel ) ) {
      return remove.apply( this, arguments );
    }

    models = _.isArray( models ) ? models.slice( 0 ) : [ models ];
    options || ( options = {} );

    var toRemove = [];

    //console.debug('calling remove on coll=%o; models=%o, options=%o', this, models, options );
    _.each( models, function( model ) {
      model = this.get( model ) || ( model && this.get( model.cid ) );
      model && toRemove.push( model );
    }, this );

    if ( toRemove.length ) {
      remove.call( this, toRemove, options );

      _.each( toRemove, function( model ) {
        this.trigger('relational:remove', model, this, options);
      }, this );
    }
    
    return this;
  };

  /**
   * Override 'Backbone.Collection.reset' to trigger 'relational:reset'.
   */
  var reset = Backbone.Collection.prototype.__reset = Backbone.Collection.prototype.reset;
  Backbone.Collection.prototype.reset = function( models, options ) {
    options = _.extend( { merge: true }, options );
    reset.call( this, models, options );

    if ( this.model.prototype instanceof Backbone.RelationalModel ) {
      this.trigger( 'relational:reset', this, options );
    }

    return this;
  };

  /**
   * Override 'Backbone.Collection.sort' to trigger 'relational:reset'.
   */
  var sort = Backbone.Collection.prototype.__sort = Backbone.Collection.prototype.sort;
  Backbone.Collection.prototype.sort = function( options ) {
    sort.call( this, options );

    if ( this.model.prototype instanceof Backbone.RelationalModel ) {
      this.trigger( 'relational:reset', this, options );
    }

    return this;
  };

  /**
   * Override 'Backbone.Collection.trigger' so 'add', 'remove' and 'reset' events are queued until relations
   * are ready.
   */
  var trigger = Backbone.Collection.prototype.__trigger = Backbone.Collection.prototype.trigger;
  Backbone.Collection.prototype.trigger = function( eventName ) {
    // Short-circuit if this Collection doesn't hold RelationalModels
    if ( !( this.model.prototype instanceof Backbone.RelationalModel ) ) {
      return trigger.apply( this, arguments );
    }

    if ( eventName === 'add' || eventName === 'remove' || eventName === 'reset' || eventName === 'sort' ) {
      var dit = this,
        args = arguments;
      
      if ( _.isObject( args[ 3 ] ) ) {
        args = _.toArray( args );
        // the fourth argument is the option object.
        // we need to clone it, as it could be modified while we wait on the eventQueue to be unblocked
        args[ 3 ] = _.clone( args[ 3 ] );
      }
      
      Backbone.Relational.eventQueue.add( function() {
        trigger.apply( dit, args );
      });
    }
    else {
      trigger.apply( this, arguments );
    }
    
    return this;
  };

  // Override .extend() to automatically call .setup()
  Backbone.RelationalModel.extend = function( protoProps, classProps ) {
    var child = Backbone.Model.extend.apply( this, arguments );
    
    child.setup( this );

    return child;
  };
})();