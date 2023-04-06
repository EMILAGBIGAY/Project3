const axios = require('axios');

axios.get('https://www.worldcoinindex.com/apiservice/ticker?key={key}&label=ethbtc-ltcbtc&fiat=btc').then(resp => {

    console.log(resp.data);
});