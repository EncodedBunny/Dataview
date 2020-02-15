const Dataflow = require("../dataflow");

module.exports = function(deviceManager, experimentManager, fileManager) {
	const express = require('express');
	let router = express.Router();
	const { check } = require('express-validator');
	
	router.get('/', function(req, res, next) {
		res.render('experiments', {devices: deviceManager.getDevices(), experiments: experimentManager.getExperiments(), registeredNodes: Dataflow.registeredNodes});
	});
	
	router.get('/:experiment', [check("experiment").not().isEmpty().trim().escape()], function(req, res, next) {
		let experiment = experimentManager.getExperiment(req.params.experiment);
		if(experiment)
			res.render('experiment', {title: experiment.name, experiment: experiment.webInfo, experimentID: req.params.experiment, devices: deviceManager.getDevices(), registeredNodes: Dataflow.registeredNodes, measurementTypes: experimentManager.getMeasurementTypes(), fileTypes: fileManager.fileTypes});
		else
			next();
	});

	return router;
};
