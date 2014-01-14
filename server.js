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
    app.use(express.bodyParser());
});

app.post('/save_work', function(req, res) {
	
	connection.query('INSERT INTO work VALUES (null, ?, null, 1, 11, 1, null, null);', 
		req.body.name, function(err, rows) {
			if (err) throw err;
			res.send(req.body);
	})
});

app.get('/get_division', function(req, res) {
	var list = [];

	connection.query('SELECT id, name FROM division where user_id = 1;', function (err, divisions) {
		// var divisions_with_work_list = [];
		// divisions.forEach(function(division){ 
		// 	connection.query('SELECT name FROM work where division_id = ?', division.id, function (err, work_list) {
				

		// 		// app.locals.name = work_list.name;
		// 		var tmp = {};
		// 		tmp.one = work_list;
		// 		app.set('tmp', tmp.one);
		// 		console.log(app.get('tmp'));
		// 		// division.work_list = work_list;
		// 	// console.log(division);
		// 		// var save = save_work_list(division);
		// 	});	
		// 	console.log(app.get('tmp'));
		// 	divisions_with_work_list.push(app.get('tmp'));
		// });
		// console.log(app.get('tmp'));
		res.send(divisions);		
	});
})

app.get('/get_work/:id', function(req, res) {
	connection.query('SELECT division_id, name FROM work where user_id = 1 and division_id = ?;', req.params.id, function(err, rows) {
		res.send(rows);
	})
});


app.listen(8080, '127.0.0.1');







