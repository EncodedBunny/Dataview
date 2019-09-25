var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
	res.render('index', { title: 'Dataview Login' });
});

router.post("/", function(req, res, next) {
	console.log("User: " + req.body.user, "Password: " + req.body.password);
	res.render("index", {title: "Dataview Login"});
});

module.exports = router;
