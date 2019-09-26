module.exports = function (driverManager, deviceManager) {
	const express = require('express');
	let router = express.Router();
	const { check } = require('express-validator');

	router.get('/', function(req, res, next) {
		res.render('devices', {deviceForms: driverManager.getDriversForms(), installedDrivers: driverManager.getInstalledDrivers(), devices: deviceManager.getDevices()});
	});

	router.get("/:device", [check("device").not().isEmpty().trim().escape()], (req, res, next) => {
		let device = deviceManager.getDevice(req.params.device);
		if(device)
			res.render('device', {title: device.name, device: device, sensorLayout: driverManager.getDeviceSensorLayout(device.device)});
		else
			next();
	});

	return router;
};
