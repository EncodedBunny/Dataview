const Dataflow = require("../dataflow");

module.exports = function (deviceManager, experimentManager) {
	const express = require('express');
	let router = express.Router();
	const { check } = require('express-validator');
	
	router.get('/', function(req, res, next) {
		res.render('experiments', {devices: deviceManager.getDevices(), experiments: experimentManager.getExperiments(), registeredNodes: Dataflow.registeredNodes});
	});
	
	router.get('/:experiment', [check("experiment").not().isEmpty().trim().escape()], function(req, res, next) {
		let experiment = experimentManager.getExperiment(req.params.experiment);
		if(experiment)
			res.render('experiment', {title: experiment.name, experiment: experiment.getWebInfo(), experimentID: req.params.experiment, devices: deviceManager.getDevices(), registeredNodes: Dataflow.registeredNodes});
		else
			next();
	});

	return router;
};
