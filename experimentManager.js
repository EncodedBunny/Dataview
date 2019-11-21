const Dataflow = require("./dataflow");
const uuid = require("uuid/v4");

const measurementTypes = {
	"Time Limited": {
		form: {
			"timeLimit": {
				type: "textbox",
				isTitled: true,
				title: "Time Limit"
			}
		},
		execute: function(dataflow, config){
			let intv = setInterval(() => {
				dataflow.activate();
			}, 100); // TODO: Get experiment execution rate
			setTimeout(() => {
				clearInterval(intv);
			}, config.timeLimit);
		}
	},
	"Cyclic": {
		form: {
			"cycleLength": {
				type: "textbox",
				isTitled: true,
				title: "Cycle Duration"
			},
			"maxCycles": {
				type: "textbox",
				isTitled: true,
				title: "Cycle Count"
			}
		},
		execute: function(dataflow, config){
			let intv = setInterval(() => {
				dataflow.activate();
			}, 100); // TODO: Get experiment execution rate
			let cycle = 0;
			let cycleSwitch = function(){
				setTimeout(() => {
					cycle++;
					if(cycle >= config.maxCycles)
						clearInterval(intv);
					else
						cycleSwitch();
				}, config.cycleLength);
			}
			cycleSwitch();
		}
	},
	"Signal Limited": {
		form: {
			"watcherName": {
				type: "textbox",
				isTitled: true,
				title: "Watcher Node Name"
			}
		}
	}
};

module.exports = function(deviceManager) {
	let module = {};
	let experiments = {};
	
	module.addExperiment = function(name){
		let id;
		do{
			id = uuid();
		} while(experiments[id] !== undefined);
		experiments[id] = new Experiment(name);
		return id;
	};
	
	module.addSensorToExperiment = function(experimentID, deviceID, sensorID){
		if(experiments[experimentID])
			if(experiments[experimentID].addSensor(deviceID, sensorID))
				return deviceManager.getDevice(deviceID).sensors[sensorID];
		return undefined;
	};
	
	module.removeSensorFromExperiment = function(experimentID, sensorID){
		if(experiments[experimentID])
			return experiments[experimentID].removeSensor(sensorID);
		return false;
	};
	
	module.getExperiment = function(id){
		return experiments[id];
	};
	
	module.getExperiments = function(){
		let res = [];
		for(const id of Object.keys(experiments))
			res.push({id: id, experiment: experiments[id].webInfo});
		return res;
	};
	
	module.updateExperimentDataflow = function(id, dataflowStructure){
		if(experiments[id])
			return experiments[id].setDataflowStructure(dataflowStructure);
		return false;
	};
	
	module.getMeasurementTypes = () => {return measurementTypes};
	
	module.configureExperimentMeasurement = function(id, type, config){
		if(experiments[id])
			return experiments[id].configureMeasurement(type, config);
		return false;
	};
	
	class Experiment{
		constructor(name, dataflowStructure) {
			this._name = name;
			this._sensors = {};
			this._dataflow = new Dataflow(dataflowStructure);
			this._graphs = [];
			this._measurement = undefined;
		}
		
		addSensor(deviceID, sensorID){
			if(this._sensors[sensorID]) return false;
			if(deviceManager.getSensor(deviceID, sensorID)) {
				this._sensors[sensorID] = deviceID; // TODO: Make sub arrays of device IDs
				return true;
			}
			return false;
		}
		
		removeSensor(sensorID){
			if(!this._sensors[sensorID]) return false;
			delete this._sensors[sensorID]; // TODO: Clean places where sensor is used (Dataflows)
			return true;
		}
		
		setDataflowStructure(dataflowStructure){
			if(!this._dataflow.verifyFileStructure(dataflowStructure)) return false;
			this._dataflow.loadFileStructure(dataflowStructure);
			return true;
		}
		
		addGraph(title, xLbl, yLbl, graphID){
			let graph = new Graph(title, xLbl, yLbl);
			let id = graphID || uuid();
			this._graphs[id] = graph;
			
			let node = Dataflow.createNodeFromSpec({inputLabels: ["x", "y"], outputLabels: [], workerFunction: (input) => {
					graph.addData({x: input[0], y: input[1]});
					return [];
				}},0,0,{"graph": id});
			
			this._dataflow.addNode(node);
		}
		
		loadFromFile(fileStructure){
			for(const sensor of fileStructure.sensors)
				this._sensors.push({sensor});
			for(const g of fileStructure.graphs)
				this.addGraph(g.title, g.axis.x, g.axis.y, g.id);
		}
		
		beginMeasurement(){
			if(!this._measurement || this._measurement.active) return false;
			this._measurement.active = true;
			
		}
		
		configureMeasurement(type, config){
			if((this._measurement && this._measurement.active) || !measurementTypes[type]) return false;
			this._measurement = {
				active: false,
				type: type,
				config: config
			};
			return true;
		}
		
		get dataflow(){
			return this._dataflow;
		}
		
		get name(){
			return this._name;
		}
		
		get sensors(){
			return this._sensors;
		}
		
		get graphs(){
			return this._graphs;
		}
		
		get webInfo(){
			let res = {name: this.name, dataflow: this.dataflow.webStructure, graphs: this.graphs};
			let sensors = [];
			for(const sensorID in this.sensors)
				if(this.sensors.hasOwnProperty(sensorID))
					sensors.push({name: deviceManager.getSensor(this.sensors[sensorID], sensorID).type, id: sensorID, device: deviceManager.getDevice(this.sensors[sensorID]).name, deviceID: this.sensors[sensorID]});
			res.sensors = sensors;
			return res;
		}
	}
	
	return module;
};

/*
 *	An experiment's graph contains a single dataflow object responsible for processing
 *  the raw sensor data into meaningful graph data points
 */
class Graph {
	constructor(title, xLbl, yLbl){
		this.data = [];
		this._listeners = [];
		this._title = title;
		this._labels = {x: xLbl, y: yLbl};
	}
	
	addData(dataPoint){
		if(!dataPoint || dataPoint.x === undefined || dataPoint.y === undefined) return false;
		data.push(dataPoint);
		for(const listener of this._listeners)
			listener(dataPoint);
		return true;
	}
	
	getDataPoints(number){
		return Number.isInteger(number) ? data.slice(-Math.abs(number)) : this.data;
	}
	
	addListener(listener){
		if(typeof listener === "function")
			this._listeners.push(listener);
	}
	
	get title(){
		return this._title;
	}
	
	get axisLabels(){
		return this._labels;
	}
}
