// Require.js allows us to configure shortcut alias
// There usage will become more apparent further along in the tutorial.
require.config({
  paths: {
    jquery: 'libs/jquery/jquery',
    underscore: 'libs/underscore/underscore',
    handlebars: 'libs/handlebar/handlebar',
    backbone: 'libs/backbone/backbone'
  },
  shim: {
        backbone: {
            deps: ['handlebars', 'jquery'],
            exports: 'Backbone'
        },
        handlebars: {
            deps: ['jquery'],
            exports: 'Handlebars'
        }
    }
});

require([

  // Load our app module and pass it to our definition function
  'app',
], function(App){
  // The "app" dependency is passed in as "App"
  App.initialize();
});