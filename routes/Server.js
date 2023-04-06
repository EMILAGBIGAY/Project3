var express = require('express');
var router = express.Router();

/* GET Server page. */
router.get('/', function(req, res, next) {
  res.render('Server',{ title: 'Server' });
  
});

module.exports = router;
