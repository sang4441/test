var express = require('express');
var app = express();
var user = require('./controller/user');
var mysql      = require('mysql');

var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'password',
  database : 'manage'
});

connection.connect(function(err) {
	if (err) {
		console.log(err);
	}
	console.log("mysql connection success");
});


app.configure(function () {
    app.use(express.static(__dirname));
});

app.use(express.bodyParser());


app.post('/test', function(req, res) {
	
	connection.query('INSERT INTO work VALUES (null, ?, null, 1, 1, null, null);', 
		req.body.name, function(err, rows) {
			if (err) throw err;
			res.send(req.body);
	})
});

app.get('/get_work', function(req, res) {
	connection.query('SELECT name FROM work where user_id = 1;', function(err, rows) {
		res.send(rows);
	})
})

app.listen(8080, '127.0.0.1');