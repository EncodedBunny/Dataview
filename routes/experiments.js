const Dataflow = require("../dataflow");

module.exports = function(deviceManager, experimentManager, fileManager) {
	const express = require('express');
	let router = express.Router();
	const { check } = require('express-validator');
	
	router.get('/', function(req, res) {
		res.render('experiments', {
			devices: deviceManager.getDevices(),
			experiments: experimentManager.getExperimentList().map(experiment => {
				return {
					name: experiment.name,
					id: experiment.id,
					measurement: experiment.measurement,
					graphs: experiment.graphs.length
				};
			}),
			registeredNodes: Dataflow.registeredNodes
		});
	});
	
	router.get('/:experiment', [check("experiment").not().isEmpty().trim().escape()], function(req, res, next) {
		let experiment = experimentManager.getExperiment(req.params.experiment);
		if(experiment) {
			res.render('experiment', {
				title: experiment.name,
				experiment: {
					name: experiment.name,
					dataflow: experiment.dataflow.webStructure,
					measurement: experiment.measurement,
					graphs: experiment.graphs.map(graph => {
						return {
							title: graph.title,
							axisLabels: graph.axisLabels
						};
					})
				},
				experimentID: req.params.experiment,
				registeredNodes: Dataflow.registeredNodes,
				measurementTypes: experimentManager.getMeasurementTypes(),
				fileTypes: fileManager.fileTypes
			});
		} else {
			next();
		}
	});

	return router;
};
