var express = require('express');
var app = express();
var user = require('./controller/user');



app.configure(function () {
    app.use(express.static(__dirname));
    console.log(__dirname);
});


app.get('/users/:id', user.list);

app.listen(8080, '127.0.0.1');