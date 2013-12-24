var express = require('express');
var app = express();

app.configure(function () {
    app.use(express.static(__dirname));
    console.log(__dirname);
});

app.listen(8080, '127.0.0.1');