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
	
	module.addSensor = function(deviceID, name, location, extraData){
		if(!name) return false;
		let senName = name.trim();
		if(senName <= 0) return false;
		let device = devices[deviceID];
		if(!device) return false;
		let id = uuid(); // TODO: Verify uniqueness with respect to all devices (or a faster alternative, maybe global UUIDs)
		if(driverManager.attachSensor(device.driver, deviceID, location, extraData, id)){
			if(device.addSensor(id, senName, location.value, location.type)){
				Dataflow.registerGlobalNode(senName + " (" + device.name + ")", "Sensors", [], ["value"], async () => {
					let x = await driverManager.getSensorValue(device.driver, deviceID, id);
					return [x];
				});
				return true;
			}
		}
		return false;
	};
	
	module.addActuator = function(deviceID, name, location, extraData){
		if(!name) return false;
		let actName = name.trim();
		if(actName <= 0) return false;
		let device = devices[deviceID];
		if(!device) return false;
		let id = uuid(); // TODO: Verify uniqueness with respect to all devices (or a faster alternative, maybe global UUIDs)
		if(driverManager.attachActuator(device.driver, deviceID, location, extraData, id)){
			if(device.addActuator(id, actName, location.value, location.type)){
				Dataflow.registerGlobalNode(actName + " (" + device.name + ")", "Actuators", ["value"], [], async (input) => {
					driverManager.setActuatorValue(device.driver, deviceID, id, input[0]);
					return [];
				});
				return true;
			}
		}
		return false;
	};
	
	module.configureSensor = function(deviceID, sensorID, location, extraData){
		let device = devices[deviceID];
		if(!device) return false;
		let res = driverManager.configureSensor(device.driver, deviceID, sensorID, location, extraData);
		if(res) device.sensors[sensorID].loc = location;
		return res;
	};
	
	module.configureActuator = function(deviceID, sensorID, location, extraData){
		let device = devices[deviceID];
		if(!device) return false;
		let res = driverManager.configureActuator(device.driver, deviceID, sensorID, location, extraData);
		if(res) device.actuators[sensorID].loc = location;
		return res;
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

function parseLocationString(str) {
	let intervals = str.trim().split(" ");
	let locs = [];
	for(let s of intervals){
		if(s.length > 0){
			let sep = s.indexOf("...");
			if(sep > -1){
				let a = Number.parseInt(s.substring(0, sep));
				let b = Number.parseInt(s.substring(sep+3));
				for(let i = a; i <= b; i++)
					if(!locs.includes(i))
						locs.push(i);
			} else{
				let i = Number.parseInt(s);
				if(!locs.includes(i))
					locs.push(i);
			}
		}
	}
	return locs;
}

class Device{
	constructor(name, driver, extraData, driverManager){
		this._name = name;
		this._driver = driver;
		this._deviceType = driverManager.baseNameToFormattedName(this._driver);
		this._extraData = extraData;
		this._sensors = {};
		this._actuators = {};
		this._listeners = {};
		this._listener = (updates) => {
			for(const sensor of Object.values(this.sensors))
				if(updates[sensor.id] !== undefined)
					sensor.value = updates[sensor.id];
			for(const list of Object.values(this._listeners))
				list(updates);
		};
		this._locations = driverManager.getLocationLayout(this._driver);
		if(typeof this._locations !== "object"){
			this._locations = parseLocationString(this._locations);
		} else
			for(let type of Object.keys(this._locations))
				this._locations[type] = parseLocationString(this._locations[type]);
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
	
	get actuators(){
		return this._actuators;
	}
	
	get listener(){
		return this._listener;
	}
	
	get locations(){
		return this._locations;
	}
	
	addSensor(id, name, location, locationType){
		return this._registerLocation(id,"_sensors", name, location, locationType);
	}
	
	addActuator(id, name, location, locationType){
		return this._registerLocation(id,"_actuators", name, location, locationType);
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
	
	_locAvailable(location, type){
		if(Array.isArray(this._locations) !== (type === undefined)) return false;
		if(Array.isArray(this._locations))
			return this._locations.includes(Number.parseInt(location));
		return this._locations.hasOwnProperty(type) ? this._locations[type].includes(Number.parseInt(location)) : false;
	}
	
	_registerLocation(id, array, name, location, locationType){
		if(!this._locAvailable(location, locationType)) return false;
		this[array][id] = {
			name: name,
			loc: {
				value: location
			}
		};
		if(!Array.isArray(this._locations)) {
			this[array][id].loc.type = locationType;
			this._locations[locationType].remove(location);
		}
		return true;
	}
	
	get webInfo(){
		return {name: this.name, type: this.deviceType, sensors: this.sensors, actuators: this.actuators};
	}
}