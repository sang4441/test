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
	console.log("success");
  // connected! (unless `err` is set)
});