module.exports = function (driverManager, deviceManager) {
	const express = require('express');
	let router = express.Router();
	const { check } = require('express-validator');
	
	router.get('/', function(req, res, next) {
		res.render('devices', {
			deviceForms: driverManager.getDriversForms(),
			installedDrivers: driverManager.getInstalledDrivers().map(driver => driver.formattedName),
			devices: deviceManager.getDeviceList().map(device => {
				return {
					id: device.id,
					name: device.name,
					type: device.deviceType,
					model: device.model,
					sensors: device.sensors,
					actuators: device.actuators
				};
			})
		});
	});
	
	router.get("/:device", [check("device").not().isEmpty().trim().escape()], (req, res, next) => {
		let device = deviceManager.getDevice(req.params.device);
		if(device) {
			res.render('device', {
				title: device.name,
				device: {
					name: device.name,
					type: device.deviceType,
					model: device.model,
					sensors: device.sensors,
					actuators: device.actuators
				},
				deviceID: req.params.device,
				availableLocations: device.locations,
				locationLabels: device.driver.locationLabels
			});
		} else {
			next();
		}
	});
	
	return router;
};
