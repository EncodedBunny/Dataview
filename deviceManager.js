const Dataflow = require("./dataflow");
const uuid = require("uuid/v4");

module.exports = function (driverManager) {
	let module = {};
	let devices = {};
	
	module.addDevice = function(name, type, extraData){
		if(!name) return undefined;
		let nameT = name.trim();
		if(nameT.length <= 0 || module.getDeviceByName(nameT) !== undefined) return undefined;
		let device = new Device(nameT, driverManager.formattedNameToBaseName(type), extraData, driverManager);
		let id;
		do{
			id = uuid();
		} while(device[id] !== undefined);
		devices[id] = device;
		if(driverManager.attachDevice(device, id))
			return id;
		return undefined;
	};
	
	module.addSensor = function(deviceID, sensorName, extraData){
		if(!sensorName) return -1;
		let senName = sensorName.trim();
		if(senName <= 0) return -1;
		let device = devices[deviceID];
		if(!device) return -1;
		let id = uuid(); // TODO: Verify uniqueness with respect to all devices (or a faster alternative, maybe global UUIDs)
		if(driverManager.attachSensor(device.driver, deviceID, extraData, id)){
			device.sensors[id] = {type: senName, data: extraData, value: 0};
			return id;
		}
		return undefined;
	};
	
	module.removeSensor = function(deviceID, sensorID){
		let device = devices[deviceID];
		if(!device) return false;
		let status = driverManager.detachSensor(device.driver, deviceID, sensorID);
		if(status) delete device.sensors[sensorID];
		return status;
	};
	
	module.getDevices = function() {
		let res = [];
		for(const id of Object.keys(devices))
			res.push({id: id, device: devices[id].webInfo});
		return res;
	};
	
	module.getDeviceList = function(){
		return Object.values(devices);
	};
	
	module.getDevice = function(id) {
		return devices[id];
	};
	
	module.getDeviceByName = function(name) {
		for(const device of Object.values(devices))
			if(device.name === name)
				return device;
		return undefined;
	};
	
	module.getSensor = function(deviceId, sensorId){
		let device = devices[deviceId];
		if(device)
			return device.sensors[sensorId];
		return undefined;
	};
	
	return module;
};

class Device{
	constructor(name, driver, extraData, driverManager){
		this._name = name;
		this._driver = driver;
		this._deviceType = driverManager.baseNameToFormattedName(this._driver);
		this._extraData = extraData;
		this._sensors = {};
		this._listeners = {};
		this._listener = (updates) => {
			for(const sensor of Object.values(this.sensors))
				if(updates[sensor.id] !== undefined)
					sensor.value = updates[sensor.id];
			for(const list of Object.values(this._listeners))
				list(updates);
		}
	}
	
	get name(){
		return this._name;
	}
	
	get deviceType(){
		return this._deviceType;
	}
	
	get driver(){
		return this._driver;
	}
	
	get extraData(){
		return this._extraData;
	}
	
	get sensors(){
		return this._sensors;
	}
	
	get listener(){
		return this._listener;
	}
	
	addListener(id, listener){
		if(!this.hasListener(id)){
			this._listeners[id] = listener;
			return true;
		}
		return false;
	}
	
	hasListener(listenerID){
		return this._listeners[listenerID] !== undefined;
	}
	
	removeListener(listenerID){
		if(this.hasListener(listenerID)) {
			delete this._listeners[listenerID];
			return true;
		}
		return false;
	}
	
	get webInfo(){
		return {name: this.name, type: this.deviceType, sensors: this.sensors};
	}
}