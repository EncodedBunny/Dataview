const express = require('express');
const router = express.Router();
const users = require("../users");

/* GET home page. */
router.get('/', function(req, res, next) {
	if(!req.session.user)
		res.render('index', { title: 'Dataview Login' });
	else
		res.redirect("/devices");
});

router.post("/", (req, res, next) => {
	console.log("User: " + req.body.user, "Password: " + req.body.password);
	if(req.body.user.length < 4 || req.body.user.length > 20){
		sendError(res,"html","<label>Username must:</label><ul><li>Have between 4 and 20 characters</li><li>Only contain alphanumeric characters (a-z A-Z 0-9)</li></ul>");
	} else{
		users.authenticate(req.body.user, req.body.password).then((userData) => {
			req.session.user = userData;
			res.status(200).end();
		}).catch(() => {
			sendError(res,"plain","Invalid credentials");
		});
	}
});

function sendError(res, type, msg){
	res.setHeader("Content-Type", "text/" + type);
	res.status(400).send(msg);
}

module.exports = router;
