var express = require('express');
const { Pool } = require('pg');
const dotenv = require('dotenv').config();
var router = express.Router();

/* GET Manager page. */
router.get('/', function(req, res, next) {
  res.render('Manager',{ title: 'Manager' });
  
});

module.exports = router;
