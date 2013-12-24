// var express = require('express');

// var app = express();

// app.configure(function() {
// 	app.use('/index.html', express.static(__dirname))
// })

// app.get('/', function(req, res){
//   res.render("/index.html");
// });
// // app.listen(3000);


// // spin up server
// app.listen(8080, '127.0.0.1')

var express = require('express');
var app = express();

app.configure(function () {
    app.use(express.static(__dirname + '/public'));
    console.log(__dirname);
});

app.listen(8080, '127.0.0.1');