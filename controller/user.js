var users = [
  { name: 'TJ', email: 'tj@vision-media.ca' },
  { name: 'Tobi', email: 'tobi@vision-media.ca' }
];

exports.list = function(req, res){
  console.log(req.params.id);

  // res.render('users', { title: 'Users', users: users });
}