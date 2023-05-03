
//Variable types
//these are in the format of how they are used in the sql table. AKA the params are the col names of the SQL table.

/**
 * Order item as it is displayed in the Sales SQL table
 * @typedef {Object} OrderItem
 * @property {number} OrderID - groups multiple items into one order
 * @property {string} Date - date and time of the order
 * @property {string} Item - name of the item
 * @property {number} Price - price of the item
 * @property {boolean} Shot - add espresso shot
 * @property {boolean} iced - add ice
 * @property {boolean} syrup - add pump of syrup
 * @property {boolean} nondairy - nondairy requirement
 */

/**
 * Order item as it is displayed in the Menu SQL table
 * @typedef {Object} MenuItem
 * @property {string} Item - name of the item
 * @property {string} category - Drink or food
 * @property {string} subcategory - Coffee, Tea, Breakfast, Bakery or Seasonal
 * @property {Number} Tall -price of a tall drink
 * @property {Number} Grande -price of a grande drink
 * @property {Number} Venti -price of a grande drink
 */

/**
 * Inventory Item as displayed in the inventory SQL table
 * @typedef {Object} InventoryItem
 * @property {string} itemName - name of the inventory item
 * @property {string} Quantity - quantity of the item
 */



//initializing all the libraries
const express = require('express')
const { Pool } = require('pg');
const dotenv = require('dotenv').config();
const fetch = require('isomorphic-fetch');
var bodyParser = require('body-parser');
const moment = require('moment');
const { auth, requiresAuth } = require('express-openid-connect');


//using the API documentation for help
// Create Express App
const app = express();
const router = express.Router();
const port = 3000;


/**
 * HTTP request to currency API, and renders the home page.
 * @module HomeGetFunction
 * @function
 * @returns {void} - renders the home page with currency data.
 */
router.get('/', (req, res) => {
    const host = 'api.frankfurter.app';
    fetch(`https://${host}/latest?amount=10&from=GBP&to=USD`)
        .then(resp => resp.json())
        .then((data) => {
            const price = `10 GBP = ${data.rates.USD} USD`;
            res.render('index', { price: price }); // pass price to the view
        })
        .catch((err) => {
            console.error(err);
            res.status(500).send('Internal Server Error');
        });

});


//config set up with the .env file data
const config = {
    authRequired: false,
    auth0Logout: true,
    secret: process.env.AUTH0_SECRET,
    baseURL: process.env.BASE_URL,
    clientID: process.env.AUTH0_CLIENT_ID,
    issuerBaseURL: process.env.ISSUER_BASE_URL,
};


// auth router attaches /login, /logout, and /callback routes to the baseURL
router.use(auth(config));


//Create Postgres Pool
const pool = new Pool({
    user: process.env.PSQL_USER,
    host: process.env.PSQL_HOST,
    database: process.env.PSQL_DATABASE,
    password: process.env.PSQL_PASSWORD,
    port: process.env.PSQL_PORT,
    ssl: { rejectUnauthorized: false }
});

process.on('SIGINT', function () {
    pool.end();
    console.log('Application successfully terminated');
    process.exit(0);
});


//sets the view engine to EJS and allows body parsing of client form submission data.
app.set('view engine', "ejs");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// Item images loaded statically
app.use(express.static('img'));

router.get('/login', (req, res) => {
    res.send(req.oidc.isAuthenticated() ? 'Logged in' : 'Logged out');
});

router.get('/profile', requiresAuth(), (req, res) => {
    const name = req.oidc.user.name;
    const img = req.oidc.user.picture;
    console.log(req.oidc.user);
    res.render('profile', { name: name, img: img });
});

router.get('/user', (req, res) => {
    arr = [];
    pool
        .query('SELECT * FROM inventory')
        .then(query_res => {
            for (let i = 0; i < query_res.rowCount; i++) {
                arr.push(query_res.rows[i]);
            }
            const data = { arr: arr };
            console.log(arr);
            res.render('user', data);
        });
});


/**
 * Loads menu and current order SQL tables, then renders the server page.
 * @module ServerGetFunction
 * @function
 * @param {string} Menu - Menu Name passed as a URL parameter
 * @returns {void} - renders the server page with current order table and items from the Menu Type.
 */
router.get('/Server/:id', requiresAuth(), requireServer, (req, res) => {

    const id = req.params.id;
    let serverMenu = [];
    let currentOrder = [];
    let revenue = 0.0;

    var menuType = "Coffee";
    if (id == "TeaMenu") {
        menuType = "Tea";
    } else if (id == "BreakfastMenu") {
        menuType = "Breakfast";
    } else if (id == "BakeryMenu") {
        menuType = "Bakery";
    } else if (id == "CoffeeMenu") {
        menuType = "Coffee";
    } else if (id == "SeasonalMenu") {
        menuType = "seasonal";
    }

    pool.query("select * from menu where subcategory = $1", [menuType])
        .then(query_res => {
            for (let i = 0; i < query_res.rowCount; i++) {
                serverMenu.push(query_res.rows[i]);
            }

            pool.query("select * from current_order")
                .then(query_res => {
                    for (let i = 0; i < query_res.rowCount; i++) {
                        currentOrder.push(query_res.rows[i]);

                    }
                    pool.query("select SUM(price) from current_order")
                        .then(query_res => {
                            for (let i = 0; i < query_res.rowCount; i++) {
                                revenue = query_res.rows[i];
                            }
                            console.log(revenue);
                            if (revenue.sum == null) {
                                revenue.sum = 0.00;
                            }
                            const tax = revenue.sum * .0825;
                            const grandTotal = revenue.sum + tax;

                            const data = {
                                serverMenu: serverMenu,
                                currentOrder: currentOrder,
                                id: id,
                                revenue: revenue.sum,
                                tax: tax,
                                grandTotal: grandTotal
                            };
                            console.log(data);
                            res.render('Server', data);
                        })
                        .catch(err => {
                            console.error(err);
                            res.status(500).send('Internal Server Error');
                        });


                })
                .catch(err => {
                    console.error(err);
                    res.status(500).send('Internal Server Error');
                });


        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Internal Server Error');
        });
});

/**
 * Loads menu and current order data from SQL tables, then renders the customer page. Color blind filters are applied by changing the CSS colors used and filters over the images.
 * @module CustomerGetFunction
 * @function
 * @param {Text} Menu - Menu Name passed as a URL parameter
 * @param {Text} Color - color blind filter passed as a URL parameter
 * @returns {void} - renders the customer page with current order table and items/images of the menu type. Sets the css style for colorblind filters.
 */
router.get('/Customer/:id/:color', (req, res) => {
    var filter = req.params.color;
    if (filter == null) {
        filter = "none";
    }
    const id = req.params.id;
    let serverMenu = [];
    let currentOrder = [];

    var menuType = "Coffee";
    if (id == "TeaMenu") {
        menuType = "Tea";
    } else if (id == "BreakfastMenu") {
        menuType = "Breakfast";
    } else if (id == "BakeryMenu") {
        menuType = "Bakery";
    } else if (id == "CoffeeMenu") {
        menuType = "Coffee";
    } else if (id == "SeasonalMenu") {
        menuType = "seasonal";
    }

    pool.query("select * from menu where subcategory = $1", [menuType])
        .then(query_res => {
            for (let i = 0; i < query_res.rowCount; i++) {
                serverMenu.push(query_res.rows[i]);
            }

            pool.query("select * from current_order")
                .then(query_res => {
                    for (let i = 0; i < query_res.rowCount; i++) {
                        currentOrder.push(query_res.rows[i]);

                    }

                    pool.query("select SUM(price) from current_order")
                        .then(query_res => {
                            for (let i = 0; i < query_res.rowCount; i++) {
                                revenue = query_res.rows[i];
                            }
                            console.log(revenue);
                            if (revenue.sum == null) {
                                revenue.sum = 0.00;
                            }
                            const tax = revenue.sum * .0825;
                            const grandTotal = revenue.sum + tax;

                            const data = {
                                serverMenu: serverMenu,
                                currentOrder: currentOrder,
                                id: id,
                                revenue: revenue.sum,
                                tax: tax,
                                grandTotal: grandTotal,
                                color: filter
                            };
                            console.log(data);
                            res.render('Customer', data);
                        })
                        .catch(err => {
                            console.error(err);
                            res.status(500).send('Internal Server Error');
                        });

                })
                .catch(err => {
                    console.error(err);
                    res.status(500).send('Internal Server Error');
                });


        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Internal Server Error');
        });
});


/**
* Checks if the user email is a Manager, and allows them to proceed to the server page if so.
 * @module RequireManagerFunction
 * @function
 * @param {Text} Emails - list of manager emails
 * @returns {void} - redirects to server page if successful.
 */
function requireManager(req, res, next) {
    const allowedEmails = ['ashwin.kundeti@gmail.com', 'emilagbigay@tamu.edu', 'benwilley@tamu.edu'];
    const user = req.oidc.user;

    if (user && allowedEmails.includes(user.email)) {
        return next();
    }
    return res.status(403).send('Forbidden');
}

/**
 * Checks if the user email is a server, and allows them to proceed to the server page if so.
 * @module RequireServerFunction
 * @function
 * @param {Text} Emails - list of server emails
 * @returns {void} - redirects to server page if successful.
 */
function requireServer(req, res, next) {
    const allowedEmails = ['ashwin.kundeti@gmail.com', 'emilagbigay@tamu.edu', 'benwilley@tamu.edu'];
    const user = req.oidc.user;

    if (user && allowedEmails.includes(user.email)) {
        return next();
    }
    return res.status(403).send('Forbidden');
}

/**
 * Loads inventory data from SQL table, then renders the manager page. Manager page contains controls to make reports and add seasonal items as well.
 * @module ManagerGetFunction
 * @function
 * @returns {void} - renders the Manger page with current inventory table.
 */
router.get('/Manager', requiresAuth(), requireManager, (req, res, next) => {
    console.log(req.oidc.user.email);
    let inventory_arr = [];
    pool.query("select * from inventory order by id")
        .then(query_res => {
            for (let i = 0; i < query_res.rowCount; i++) {
                inventory_arr.push(query_res.rows[i]);
            }
            const data = { inventory_arr: inventory_arr };

            res.render('Manager', data);
        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Internal Server Error');
        });
});

/**
 * Post request that adds 1000 to the item quantity in the inventory SQL table.
 * @module UpdateInventoryFunction
 * @function
 * @param {Number} ItemID - ID of the item needing to be updated
 * @returns {void} - redirects back to the manager page
 */
router.post('/update-inventory/:id', (req, res) => {
    const id = parseInt(req.params.id);
    pool.query("update inventory set quantity = quantity + 10000 where id = $1", [id])
        .then(() => {
            console.log("Item quantity updated");
            res.redirect("../Manager");
        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Internal Server Error');

        });

});



/**
 * Post request that adds an order item to the current order SQL table and Xreport SQL table. Depending on the item ordered, it decrements the inventory accordingly.
 * @module OrderItemFunction
 * @function
 * @param {String} Page - Keeps track of whether the request came from the server or cusomer page.
 * @param {String} Color - Color blind filter to be applied if routing back to customer page.
 * @param {OrderItem} Order - The item to be added to current order.
 * @returns {void} - redirects to the correct page using the Page and Color URL parameters.
 */
router.post('/orderItem', (req, res) => {
    const order = req.body.drinkOrder;
    const itemArray = order.split(':');
    //
    const name = itemArray[0];
    const category = itemArray[1];
    const subcategory = itemArray[2];
    //prices
    const tall = itemArray[3];
    const grande = itemArray[4];
    const venti = itemArray[5];
    const page = itemArray[6];
    const color = itemArray[7];

    var price = Number(0.00);
    const size = req.body.drinkSize;

    price = Number(tall);
    if (category == 'Drink') {
        if (size == 'grande') {
            price = Number(grande);
            pool.query("update inventory set quantity = quantity - 1 where id = 2")
                .then(() => {
                    console.log("Grande cup removed from inventory");
                });
        } else if (size == 'venti') {
            price = Number(venti);
            pool.query("update inventory set quantity = quantity - 1 where id = 3")
                .then(() => {
                    console.log("Venti cup removed from inventory");
                });
        }
    }

    if (category == 'Drink') {
        pool.query("update inventory set quantity = quantity - 1 where id = 1")
            .then(() => {
                console.log("Tall cup removed from inventory");
            });
    }


    var menuType = "CoffeeMenu";
    if (subcategory == "Tea") {
        pool.query("update inventory set quantity = quantity - 1 where id = 7")
            .then(() => {
                console.log("Tea bag removed from inventory");
            });
        menuType = "TeaMenu";
    } else if (subcategory == 'Breakfast') {
        pool.query("update inventory set quantity = quantity - 1 where item = $1", [name])
            .then(() => {
                console.log("Breakfast item removed from inventory");
            });
        menuType = "BreakfastMenu";
    } else if (subcategory == "Bakery") {
        pool.query("update inventory set quantity = quantity - 1 where item = $1", [name])
            .then(() => {
                console.log("Bakery item removed from inventory");
            });
        menuType = "BakeryMenu";
    } else if (subcategory == "Coffee") {
        if (req.body.nondairy == 'off') {
            if (size == 'tall') {
                pool.query("update inventory set quantity = quantity - 6 where id = 6")
                    .then(() => {
                        console.log("Coffee beans removed from inventory for tall");
                    });
                pool.query("update inventory set quantity = quantity - 6 where id = 8")
                    .then(() => {
                        console.log("Milk removed from inventory for tall");
                    });
                pool.query("update inventory set quantity = quantity - 1 where id = 21")
                    .then(() => {
                        console.log("Creamer removed from inventory for tall");
                    });
            } else if (size == 'grande') {
                pool.query("update inventory set quantity = quantity - 9 where id = 6")
                    .then(() => {
                        console.log("Coffee beans removed from inventory for grande");
                    });
                pool.query("update inventory set quantity = quantity - 9 where id = 8")
                    .then(() => {
                        console.log("Milk removed from inventory for grande");
                    });
                pool.query("update inventory set quantity = quantity - 2 where id = 21")
                    .then(() => {
                        console.log("Creamer removed from inventory for grande");
                    });
            } else if (size == 'venti') {
                pool.query("update inventory set quantity = quantity - 12 where id = 6")
                    .then(() => {
                        console.log("Coffee beans removed from inventory for venti");
                    });
                pool.query("update inventory set quantity = quantity - 12 where id = 8")
                    .then(() => {
                        console.log("Milk removed from inventory for venti");
                    });
                pool.query("update inventory set quantity = quantity - 3 where id = 21")
                    .then(() => {
                        console.log("Creamer removed from inventory for venti");
                    });
            }
        }
        menuType = "CoffeeMenu";
    } else if (subcategory == "seasonal") {
        menuType = "SeasonalMenu";
    }

    var shot = false;
    if (req.body.shot == 'on') {
        shot = true;
        pool.query("update inventory set quantity = quantity - 1 where id = 42")
            .then(() => {
                console.log("Espresso shot removed from inventory");
            });
        price = Number(price) + 0.50;
    }
    var iced = false;
    if (req.body.iced == 'on') {
        iced = true;
    }
    var syrup = false;
    if (req.body.syrup == 'on') {
        syrup = true;
        pool.query("update inventory set quantity = quantity - 1 where id = 10")
            .then(() => {
                console.log("Caramel Syrup pump removed from inventory");
            });
        price = Number(price) + 0.50;
    }
    var nondairy = false;
    if (req.body.nondairy == 'on') {
        nondairy = true;
        pool.query("update inventory set quantity = quantity - 6 where id = 9")
            .then(() => {
                console.log("Soy milk for drink removed from inventory");
            });
    }

    //get current time and new order id
    const currentTimeStamp = moment().format('YYYY-MM-DD HH:mm:ss');
    var lastOrderId = 0;
    var newOrderId = 0;
    console.log("THIS IS WHAT IT COSTS");
    console.log(price);
    pool.query("select orderid from sales order by orderid desc limit 1")
        .then(query_res => {
            lastOrderId = query_res.rows[0].orderid;
            newOrderId = lastOrderId + 1;
            console.log(newOrderId);
            //add to current order table
            pool.query("insert into current_order (date, subcategory, price, name, shot, iced, syrup, nondairy, orderid) values ( $1, $2, $3, $4, $5, $6, $7, $8, $9)", [currentTimeStamp, subcategory, price, name, shot, iced, syrup, nondairy, newOrderId])
                .then(() => {
                    console.log("added to current order");
                    console.log("($1, $2, $3, $4, $5, $6, $7, $8, $9)", [currentTimeStamp, subcategory, price, name, shot, iced, syrup, nondairy, newOrderId]);

                    console.log(req.body);
                    pool.query("insert into xreport (item, price) values ($1,$2)", [name, price])
                        .then(() => {
                            console.log("order added to x report");
                            console.log(itemArray);
                            var serverPath = "../" + page + "/" + menuType + "/" + color;
                            if (page == 'Server') {
                                serverPath = "../" + page + "/" + menuType;
                            }
                            res.redirect(serverPath);

                        })
                        .catch(err => {
                            console.error(err);
                            res.status(500).send('Internal Server Error');
                        });

                })
                .catch(err => {
                    console.error(err);
                    res.status(500).send('Internal Server Error');
                });
        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Internal Server Error');
        });

});



/**
 * Post request that appends current order SQL table to the sales table. Then, it clears the current Order table to allow another customers order to be processed.
 * @module ProcessOrderFunction
 * @function
 * @param {String} Page - Keeps track of whether the request came from the server or cusomer page.
 * @param {String} Color - Color blind filter to be applied if routing back to customer page.
 * @returns {void} - redirects to the correct page using the Page and Color URL parameters.
 */
router.post('/clear-current', (req, res) => {
    //add current order to sales    COLORBLIND SUFFICIENT

    const bodyData = req.body.payment;
    const itemArray = bodyData.split(':');
    const id = itemArray[0];
    const page = itemArray[1];
    const color = itemArray[2];


    var menuType = "CoffeeMenu";
    if (id == "Tea") {
        menuType = "TeaMenu";
    } else if (id == "Breakfast") {
        menuType = "BreakfastMenu";
    } else if (id == "Bakery") {
        menuType = "BakeryMenu";
    } else if (id == "Coffee") {
        menuType = "CoffeeMenu";
    } else if (id == "seasonal") {
        menuType = "SeasonalMenu";
    }
    var serverPath = '../' + page + '/' + menuType;
    if (page == 'Customer') {
        serverPath = '../' + page + '/' + menuType + '/' + color;
    }

    console.log(serverPath);

    pool.query("insert into sales select * from current_order")
        .then(() => {
            console.log("current order added to sales");
        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Internal Server Error');
        });

    //clear current order
    pool.query("truncate current_order")
        .then(() => {
            console.log("current order cleared");
        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Internal Server Error');
        });

    res.redirect(serverPath);
});




/**
 * Post request that deletes an item from the current order SQL table AKA the cart.
 * @module DeleteFromCartFunction
 * @function
 * @param {Number} Index- Index of the order item in current order that will be deleted.
 * @param {String} Page - Keeps track of whether the request came from the server or cusomer page.
 * @param {String} Color - Color blind filter to be applied if routing back to customer page.
 * @returns {void} - redirects back to the page specified, and if page is customer the color filter will be applied.
 */
router.post('/deleteCartItem', (req, res) => {
    //add current order to sales  COLOR BLIND SUFFICIENT
    const bodyData = req.body.deleteWhat;
    const itemArray = bodyData.split(':');

    console.log(itemArray);
    const id = itemArray[0];
    const page = itemArray[1];
    var item = 0;
    item = itemArray[2];
    const color = itemArray[3];


    var menuType = "CoffeeMenu";
    if (id == "Tea") {
        menuType = "TeaMenu";
    } else if (id == "Breakfast") {
        menuType = "BreakfastMenu";
    } else if (id == "Bakery") {
        menuType = "BakeryMenu";
    } else if (id == "Coffee") {
        menuType = "CoffeeMenu";
    } else if (id == "seasonal") {
        menuType = "SeasonalMenu";
    }

    var serverPath = '../' + page + '/' + menuType;
    if (page == 'Customer') {
        serverPath = '../' + page + '/' + menuType + '/' + color;
    }
    console.log(serverPath);

    pool.query("DELETE FROM current_order WHERE date IN (SELECT date FROM current_order ORDER BY date OFFSET $1 LIMIT 1)", [item])
        .then(() => {
            console.log("item deleted from current order");
            res.redirect(serverPath);
        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Internal Server Error');
        });
});


/**
 * WORK IN PROGRESS Sales report requirement from project 2 phase four, finds the sales between the provided dates in the sales SQL table.
 * @module SalesReportGetFunction
 * @function
 * @param {string} Dates - two dates to find the sales from the sales SQL table between.
 * @returns {void} - renders the sales report in reports.ejs
 */
router.post('/sales-report', (req, res) => {
    let start = req.body.start;
    let end = req.body.end;
    pool.query(`select name, count(*) from sales where sales.date >= to_timestamp($1,'YYYY-MM-DD') and sales.date <= to_timestamp($2, 'YYYY-MM-DD') group by name`, [start, end])
        .then(query_res => {
            res.render('pages/reports', {
                my_title: "Sales Report",
                data: query_res.rows,
                start: start,
                end: end
            })
        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Internal Server Error');
        });
});

/**
 * Excess report requirement from project 2 phase four. Looks at inventory changes since a date and displays a list of the inventory that sold less than ten percent.
 * @module ExcesssReportFunction
 * @function
 * @param {string} Date - reference date to find the inventory data from.
 * @returns {void} - renders the excess report in reports.ejs
 */
router.get('/excess-report', (req, res) => {
    let start = '2022-03-03';
    let current = moment().format('YYYY-MM-DD');
    let sub_arr = [];
    let tallcoffee = 0;
    let grandecoffee = 0;
    let venticoffee = 0;
    let talltea = 0;
    let grandetea = 0;
    let ventitea = 0;
    excess_arr = [];
    let tallcups = 0;
    let grandecups = 0;
    let venticups = 0;
    let tallcups_inventory = 0;
    let grandecups_inventory = 0;
    let venticups_inventory = 0;
    let coffee_grounds = 0;
    let tea_bags = 0;
    let creamer = 0;
    let milk = 0;
    let coffee_grounds_inventory = 0;
    let tea_bags_inventory = 0;
    let creamer_inventory = 0;
    let milk_inventory = 0;


    Promise.all([
        pool.query(`select quantity from inventory where item = 'TallCups'`),
        pool.query(`select quantity from inventory where item = 'GrandeCups'`),
        pool.query(`select quantity from inventory where item = 'VentiCups'`),
        pool.query(`select quantity from inventory where item = 'CoffeeGrounds(oz.)'`),
        pool.query(`select quantity from inventory where item = 'Teabags'`),
        pool.query(`select quantity from inventory where item = 'Half-n-HalfCups'`),
        pool.query(`select quantity from inventory where item = 'WholeMilk(oz.)'`),
        pool.query(`SELECT subcategory, count(*) FROM sales WHERE sales.date >= to_timestamp($1,'YYYY-MM-DD') AND sales.date <= to_timestamp($2, 'YYYY-MM-DD') GROUP BY subcategory`, [start, current]),
        pool.query(`SELECT s.name, s.subcategory, s.count AS sales_count, i.quantity AS inventory_quantity FROM ( SELECT name, subcategory, count(*) AS count FROM sales WHERE date >= to_timestamp($1, 'YYYY-MM-DD') AND date <= to_timestamp($2, 'YYYY-MM-DD') AND subcategory IN ('Breakfast', 'Bakery') GROUP BY name, subcategory ) s JOIN inventory i ON s.name = i.item WHERE s.count < i.quantity * 0.1`, [start, current])
    ])
        .then(query_res => {
            const [tallcupsRes, grandecupsRes, venticupsRes, coffee_groundsRes, tea_bagsRes, creamerRes, milkRes, salesRes, foodRes] = query_res;

            tallcups_inventory = parseInt(tallcupsRes.rows[0].quantity);
            grandecups_inventory = parseInt(grandecupsRes.rows[0].quantity);
            venticups_inventory = parseInt(venticupsRes.rows[0].quantity);
            coffee_grounds_inventory = parseInt(coffee_groundsRes.rows[0].quantity);
            tea_bags_inventory = parseInt(tea_bagsRes.rows[0].quantity);
            creamer_inventory = parseInt(creamerRes.rows[0].quantity);
            milk_inventory = parseInt(milkRes.rows[0].quantity);

            for (let i = 0; i < salesRes.rowCount; i++) {
                sub_arr.push(salesRes.rows[i]);
            }

            for (let i = 0; i < sub_arr.length; i++) {
                if (sub_arr[i].subcategory == 'Coffee') {
                    tallcoffee = Math.floor(parseInt(sub_arr[i].count) / 3);
                    grandecoffee = tallcoffee;
                    venticoffee = tallcoffee;
                }
                else if (sub_arr[i].subcategory == 'Tea') {
                    talltea = Math.floor(parseInt(sub_arr[i].count) / 3);
                    grandetea = talltea;
                    ventitea = talltea;
                }
            }
            tallcups = tallcoffee + talltea;
            grandecups = grandecoffee + grandetea;
            venticups = venticoffee + ventitea;
            coffee_grounds = tallcoffee * 6 + grandecoffee * 9 + venticoffee * 12;
            creamer = tallcoffee + grandecoffee * 2 + venticoffee * 3;
            milk = tallcoffee * 6 + grandecoffee * 9 + venticoffee * 12;
            tea_bags = talltea + grandetea + ventitea;

            if (tallcups < tallcups_inventory * 0.1) {
                excess_arr.push({ name: 'TallCups', quantity: tallcups, inventory: tallcups_inventory });
            }

            if (grandecups < grandecups_inventory * 0.1) {
                excess_arr.push({ name: 'GrandeCups', quantity: grandecups, inventory: grandecups_inventory });
            }

            if (venticups < venticups_inventory * 0.1) {
                excess_arr.push({ name: 'VentiCups', quantity: venticups, inventory: venticups_inventory });
            }

            if (coffee_grounds < coffee_grounds_inventory * 0.1) {
                excess_arr.push({ name: 'CoffeeGrounds(oz.)', quantity: coffee_grounds, inventory: coffee_grounds_inventory });
            }

            if (tea_bags < tea_bags_inventory * 0.1) {
                excess_arr.push({ name: 'Teabags', quantity: tea_bags, inventory: tea_bags_inventory });
            }

            if (creamer < creamer_inventory * 0.1) {
                excess_arr.push({ name: 'Half-n-HalfCups', quantity: creamer, inventory: creamer_inventory });
            }

            if (milk < milk_inventory * 0.1) {
                excess_arr.push({ name: 'WholeMilk(oz.)', quantity: milk, inventory: milk_inventory });
            }

            for (let i = 0; i < foodRes.rowCount; i++) {
                excess_arr.push({ name: foodRes.rows[i].name, quantity: foodRes.rows[i].sales_count, inventory: foodRes.rows[i].inventory_quantity })
            }
            const data = { excess_arr: excess_arr, type: 'Excess Report' };
            console.log(data);
            res.render('XReport', data);

        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Internal Server Error');
        });
});


/**
 * WORK IN PROGRESS Restock report requirement from project 2 phase four. Looks at the current quantities of each item and lists if there is sufficient inventory.
 * @module RestockReportGetFunction
 * @function
 * @returns {void} - renders the restock report in reports.ejs
 */
router.get('/restock-report', (req, res) => {
    let restock_arr = [];
    pool.query(`select * from inventory where quantity < restockquantity`)
        .then(query_res => {
            for (let i = 0; i < query_res.rowCount; i++) {
                restock_arr.push(query_res.rows[i]);
            }
            const data = { restock_arr: restock_arr, type: 'Restock Report' };
            console.log(data);
            res.render('XReport', data);
        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Internal Server Error');
        }
        );
});


/**
 * X report requirement from project 2 phase four. Displays the current X report SQL table with the sum of the item prices as revenue.
 * @module XReportGetFunction
 * @function
 * @returns {void} - renders the X report report in reports.ejs
 */
router.get('/XReport', (req, res) => {
    let revenue = 0.0;
    let report_arr = [];
    pool.query("select * from xreport")
        .then(query_res => {
            for (let i = 0; i < query_res.rowCount; i++) {
                report_arr.push(query_res.rows[i]);

            }
            pool.query("select SUM(price) from xreport")
                .then(query_res => {
                    for (let i = 0; i < query_res.rowCount; i++) {
                        revenue = query_res.rows[i];
                    }
                    if (revenue.sum == null) {
                        revenue.sum = 0.00;
                    }
                    const data = { report_arr: report_arr, revenue: revenue, type: 'XReport' };
                    console.log(data);
                    res.render('XReport', data);
                })
                .catch(err => {
                    console.error(err);
                    res.status(500).send('Internal Server Error');
                });

        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Internal Server Error');

        });

});


/**
 * Z report requirement from project 2 phase four. Displays the current X report SQL table with the sum of the item prices as revenue. After it gets the data from the xreport table, it clears it.
 * @module ZReportGetFunction
 * @function
 * @returns {void} - renders the Xzreport report in reports.ejs
 */
router.get('/ZReport', (req, res) => {
    let revenue = 0.0;
    let report_arr = [];
    pool.query("select * from xreport")
        .then(query_res => {
            for (let i = 0; i < query_res.rowCount; i++) {
                report_arr.push(query_res.rows[i]);

            }
            pool.query("select SUM(price) from xreport")
                .then(query_res => {
                    for (let i = 0; i < query_res.rowCount; i++) {
                        revenue = query_res.rows[i];
                    }
                    const data = { report_arr: report_arr, revenue: revenue, type: 'ZReport: WARNING REFRESHING WILL REQUEST A NEW Z REPORT DELETING' };
                    console.log(data);

                    pool.query("truncate xreport")
                        .then(() => {
                            console.log("report cleared");
                            res.render('XReport', data);
                        })
                        .catch(err => {
                            console.error(err);
                            res.status(500).send('Internal Server Error');
                        });

                })
                .catch(err => {
                    console.error(err);
                    res.status(500).send('Internal Server Error');
                });

        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Internal Server Error');

        });

});

/*
router.post('/add-inventory-item', (req, res) => {
    const item = req.body.item;
    const quantity = req.body.quantity;
    pool.query("insert into inventory (item, quantity) values ($1, $2)", [item, quantity])
*/

/**
 * Adds a seasonal item to the seasonal menu. The item can then be ordered on the customer or server page.
 * @module AddSeasonalItemFunction
 * @function
 * @param {string} Name - name of the seasonal item
 * @param {Number} Tall - price of the tall drink
 * @param {Number} Grande - price of the grande drink
 * @param {Number} Venti- price of the Venti drink
 * @returns {void} - redirects to manager page
 */
router.post('/add-menu-item', (req, res) => {

    const item = req.body.SeasonName;
    const tallPrice = req.body.PriceTall;
    const grandePrice = req.body.PriceGrande;
    const ventiPrice = req.body.PriceVenti;

    pool.query("insert into menu (category, subcategory, item, tall, grande, venti) values ('Drink', 'seasonal', $1, $2, $3, $4)", [item, tallPrice, grandePrice, ventiPrice])
        .then(() => {
            console.log("Menu item added");
            res.redirect("../Manager");
        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Internal Server Error');
        });
});

/**
 * renders the finder page with the maps API. The actual maps API is located in the finder.ejs file
 * @module LocationGetFunction
 * @function
 * @returns {void} - renders the finder page
 */
router.get('/finder', function (req, res) {
    res.render('finder');
});


//uses / as the home page
app.use('/', router);

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
});
