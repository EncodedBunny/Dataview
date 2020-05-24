let express = require('express');
let router = express.Router();

router.get('/', function(req, res, next) {
	res.render('settings', { title: 'Settings' });
});

module.exports = router;
