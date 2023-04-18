var express = require('express');
var router = express.Router();
const { Pool } = require('pg');
const dotenv = require('dotenv').config();

/* GET Server page. */
router.get('/server', (req, res) => {
  let coffee_arr = [];
  let espresso_arr = [];
  let tea_arr = [];
  let refresher_arr = [];
  let coffeefrap_arr = [];
  let cremefrap_arr = [];
  let breakfast_arr = [];
  let bakery_arr = [];
  pool.query("select * from menu where subcategory='Coffee'")
      .then(query_res => {
          for (let i = 0; i < query_res.rowCount; i++) {
              coffee_arr.push(query_res.rows[i]);
          }
          return pool.query("select * from menu where subcategory='Espresso'");
      })
      .then(query_res => {
          for (let i = 0; i < query_res.rowCount; i++) {
              espresso_arr.push(query_res.rows[i]);
          }
          return pool.query("select * from menu where subcategory='Tea'");
      })
      .then(query_res => {
          for (let i = 0; i < query_res.rowCount; i++) {
              tea_arr.push(query_res.rows[i]);
          }
          return pool.query("select * from menu where subcategory='Refresher'");
      })
      .then(query_res => {
          for (let i = 0; i < query_res.rowCount; i++) {
              refresher_arr.push(query_res.rows[i]);
          }
          return pool.query("select * from menu where subcategory='Coffee Frappuccino'");
      })
      .then(query_res => {
          for (let i = 0; i < query_res.rowCount; i++) {
              coffeefrap_arr.push(query_res.rows[i]);
          }
          return pool.query("select * from menu where subcategory='Creme Frappuccino'");
      })
      .then(query_res => {
          for (let i = 0; i < query_res.rowCount; i++) {
              cremefrap_arr.push(query_res.rows[i]);
          }
          return pool.query("select * from menu where subcategory='Breakfast'");
      })
      .then(query_res => {
          for (let i = 0; i < query_res.rowCount; i++) {
              breakfast_arr.push(query_res.rows[i]);
          }
          return pool.query("select * from menu where subcategory='Bakery'");
      })
      .then(query_res => {
          for (let i = 0; i < query_res.rowCount; i++) {
              bakery_arr.push(query_res.rows[i]);
          }
          const data = {
              coffee_arr: coffee_arr,
              espresso_arr: espresso_arr,
              tea_arr: tea_arr,
              refresher_arr: refresher_arr,
              coffeefrap_arr: coffeefrap_arr,
              cremefrap_arr: cremefrap_arr,
              breakfast_arr: breakfast_arr,
              bakery_arr: bakery_arr
          };
          console.log(data);
          res.render('server', data);
      })
      .catch(err => {
          console.error(err);
          res.status(500).send('Internal Server Error');
      });
});

module.exports = router;
