const Dataflow = require("./dataflow");

module.exports = function (driverManager) {
	let module = {};
	let devices = [];

	module.addDevice = function(name, type, link, extraData){
		if(!name) return false;
		let nameT = name.trim();
		if(nameT.length <= 0 || module.getDevice(link) !== undefined || module.getDeviceByName(nameT) !== undefined) return false;
		let device = {
			name: nameT,
			link: link,
			formattedDevice: type,
			/* TODO: Change this to driver */
			device: driverManager.formattedNameToBaseName(type),
			data: extraData,
			sensors: [],
			listeners: [],
			listener: function (updates) {
				for(const list of Object.values(device.listeners))
					list(updates);
			}
		};
		if(driverManager.attachDevice(device)) {
			devices.push(device);
			return true;
		}
		return false;
	};
	
	module.addSensor = function(deviceName, sensorName, extraData){
		if(!deviceName || !sensorName) return -1;
		let devName = deviceName.trim(), senName = sensorName.trim();
		if(devName.length <= 0 || senName <= 0) return -1;
		let device = module.getDeviceByName(devName);
		if(!device) return -1;
		let id = driverManager.attachSensor(device.device, device.name, extraData);
		if(id !== -1) {
			let sen = {type: senName, id: id, data: extraData};
			device.sensors.push(sen);
			Dataflow.registerNode(sensorName + " (" + deviceName + ")", "Sensors", [], ["value"], () => {
				// TODO
				return [];
			});
		}
		return id;
	};
	
	module.removeSensor = function(deviceName, sensorID){
		if(!deviceName || sensorID === undefined || !Number.isInteger(sensorID)) return false;
		let devName = deviceName.trim();
		if(devName.length <= 0) return false;
		let device = module.getDeviceByName(devName);
		if(!device) return false;
		let filtered = device.sensors.filter(sensor => sensor.id !== sensorID);
		let rem = filtered.length < device.sensors.length;
		if(rem) {
			device.sensors = filtered;
			return driverManager.detachSensor(device, sensorID);
		}
		return false;
	};
	
	module.getDevices = function() {
		return devices;
	};

	module.getDevice = function(link) {
		return _getObjectByProperty(devices,"link", link);
	};

	module.getDeviceByName = function(name) {
		return _getObjectByProperty(devices,"name", name);
	};

	module.getSensor = function(device, sensorId){
		return _getObjectByProperty(module.getDeviceByName(device).sensors, "id", sensorId);
	};

	function _getObjectByProperty(array, prop, val){
		if(!array) return undefined;
		for(const obj of array)
			if(obj[prop] === val)
				return obj;
		return undefined;
	}

	return module;
};