const Dataflow = require("./dataflow");
const uuid = require("uuid/v4");

const measurementTypes = {
	"Execution Number": {
		form: {
			"maxCycles": {
				type: "textbox",
				isTitled: true,
				title: "Execution Number"
			}
		},
		createTask: function(data, experiment, callback) {
			experiment._measurementTask.data = 0;
			return (data.maxCycles > 0 ? () => {
				if(experiment._measurementTask.data < data.maxCycles) {
					callback();
					experiment._measurementTask.data++;
				} else
					experiment.cancelActiveMeasurement();
			} : callback);
		}
	},
	"Time": {
		form: {
			"timeLimit": {
				type: "textbox",
				isTitled: true,
				title: "Time Limit (ms)"
			}
		},
		createTask: function(data, experiment, callback) {
			experiment._measurementTask.data = Date.now();
			return () => {
				if(Date.now()-experiment._measurementTask.data < data.timeLimit) {
					callback();
				} else {
					experiment.cancelActiveMeasurement();
				}
			};
		}
	},
	"Manual": {
		createTask: function(data, experiment, callback) {
			return callback;
		}
	}
};

module.exports = function(deviceManager, driverManager, fileManager) {
	let module = {};
	let experiments = {};
	
	module.addExperiment = function(name){
		let id;
		do{
			id = uuid();
		} while(experiments[id] !== undefined);
		experiments[id] = new Experiment(name, id);
		return id;
	};
	
	module.getExperiment = function(id){
		return experiments[id];
	};
	
	module.getExperimentList = function(){
		return Object.values(experiments);
	};
	
	module.setExperimentMeasurement = function(id, condition, frequency, measurementData){
		if(experiments[id] && measurementTypes[condition])
			return experiments[id].setMeasurementType(condition, frequency, measurementData);
		return false;
	};
	
	module.updateExperimentDataflow = function(id, dataflowStructure){
		if(experiments[id])
			return experiments[id].setDataflowStructure(dataflowStructure);
		return false;
	};
	
	module.beginExperiment = function(id){
		if(experiments[id])
			return experiments[id].beginMeasurement();
		return false;
	};
	
	module.stopExperiment = function(id){
		if(experiments[id])
			return experiments[id].cancelActiveMeasurement();
		return false;
	};
	
	module.addGraphToExperiment = function(id, title, xLbl, yLbl, saveType){
		if(experiments[id])
			return experiments[id].addGraph(title, xLbl, yLbl, saveType);
		return false;
	};
	
	module.listenToExperiment = function(id, listenerID, listener){
		if(experiments[id])
			return experiments[id].addListener(listenerID, listener);
		return false;
	};
	
	module.getMeasurementTypes = () => {return measurementTypes};
	
	class Experiment{
		constructor(name, id, dataflowStructure) {
			this._name = name;
			this._id = id;
			this._dataflow = new Dataflow(dataflowStructure);
			this._graphs = [];
			this._outputs = [];
			this._measurement = undefined;
			this._measurementTask = undefined;
			this._listeners = {};
			
			this._dataflow.registerNode("Measurement Start","Measurement",[],["time"],() => {
				return [this._measurement.start];
			});
			this._dataflow.registerNode("Sample Number","Measurement",[],["sample"],() => {
				return [this._measurement.sample];
			});
			this._dataflow.registerNode("Current Time","Time",[],["time"],(input, props) => {
				let x = Date.now()-this._measurement.start;
				switch (props.unit) {
					case "Milliseconds":
						break;
					default:
					case "Seconds":
						x /= 1000;
						break;
					case "Minutes":
						x /= 60*1000;
						break;
					case "Hours":
						x /= 60*60*1000;
						break;
				}
				return [Math.floor(x)];
			},{
				unit: {
					value: "Seconds",
					possibleValues: ["Milliseconds", "Seconds", "Minutes", "Hours"]
				}
			});
		}
		
		setDataflowStructure(dataflowStructure){
			if(!this._dataflow.verifyFileStructure(dataflowStructure)) return false;
			this._dataflow.loadFileStructure(dataflowStructure);
			return true;
		}
		
		addOutput(title, labels, format){
			if(typeof title !== "string" || title.length <= 0) return false;
			for(const output of this._outputs) {
				if(output.title === title) {
					return false;
				}
			}
			
			let output = new Output(title, labels, format);
			if(this._measurement !== undefined && this._measurement.start >= 0)
				graph.saveFile = fileManager.createGraphSave(this._name, this._measurement.start, graph, saveType);
			this._graphs.push(graph);
			
			this._dataflow.registerNode(title + " Graph","Graph",["x", "y"],[],(input) => {
				let point = {x: input[0], y: input[1]};
				graph.addData(point);
				for(const listener of Object.values(this._listeners))
					listener.onGraphData(title, point);
				if(graph.data.length >= 25)
					Experiment._saveGraph(graph);
				return [];
			});
			return true;
		}
		
		addGraph(title, xLbl, yLbl, saveType){
			if(typeof title !== "string" || title.length <= 0) return false;
			for(const graph of this._graphs) {
				if(graph.title === title) {
					return false;
				}
			}
			
			let graph = new Graph(title, xLbl, yLbl, saveType);
			if(this._measurement !== undefined && this._measurement.start >= 0)
				graph.saveFile = fileManager.createGraphSave(this._name, this._measurement.start, graph, saveType);
			this._graphs.push(graph);
			
			this._dataflow.registerNode(title + " Graph","Graph",["x", "y"],[],(input) => {
				let point = {x: input[0], y: input[1]};
				graph.addData(point);
				for(const listener of Object.values(this._listeners))
					listener.onGraphData(title, point);
				if(graph.data.length >= 25)
					Experiment._saveGraph(graph);
				return [];
			});
			return true;
		}
		
		loadFromFile(fileStructure){
			for(const g of fileStructure.graphs)
				this.addGraph(g.title, g.axis.x, g.axis.y);
		}
		
		setMeasurementType(measurement, frequency, measurementData){
			this._measurement = {
				type: measurement,
				frequency: frequency,
				data: measurementData,
				start: -1,
				sample: 0,
				isActive: false
			};
			if(this._measurementTask !== undefined)
				this.cancelActiveMeasurement();
			this._measurementTask = {};
			return true;
		}
		
		beginMeasurement(){
			if(this._measurement !== undefined && this._measurementTask !== undefined && this._measurementTask.task === undefined){
				this._measurement.start = Date.now();
				
				for(const graph of this._graphs)
					graph.saveFile = fileManager.createGraphSave(this._name, this._measurement.start, graph, graph.saveType);
				this._measurementTask.task = setInterval(measurementTypes[this._measurement.type].createTask(this._measurement.data, this, () => {
					this._measurement.sample++;
					this._dataflow.activate().catch(err => {
						console.error("At " + Date.now() + " an error occurred while trying to activate a dataflow:", err);
					});
				}), this._measurement.frequency);
				this._measurement.isActive = true;
				return true;
			}
			return false;
		}
		
		cancelActiveMeasurement(){
			if(this._measurementTask !== undefined) {
				clearInterval(this._measurementTask.task);
				this._measurementTask = undefined;
				this._measurement.isActive = false;
				for(let graph of this._graphs) {
					Experiment._saveGraph(graph);
					fileManager.endGraphSave(graph.saveFile, this._measurement.start);
				}
				for(const listener of Object.values(this._listeners))
					listener.onEnd();
				return true;
			}
			return false;
		}
		
		addListener(id, listener){
			if(id !== undefined && !this.hasListener(id)){
				this._listeners[id] = listener;
				return true;
			}
			return false;
		}
		
		hasListener(id){
			return this._listeners.hasOwnProperty(id);
		}
		
		removeListener(id){
			if(this.hasListener(id)) {
				delete this._listeners[id];
				return true;
			}
			return false;
		}
		
		static _saveGraph(graph){
			if(graph.data.length > 0)
				graph.saveFile.write(graph.data.splice(0, graph.data.length));
		}
		
		get measurement(){
			return this._measurement ? this._measurement : {
				type: undefined,
				frequency: undefined,
				data: undefined,
				start: -1,
				sample: 0,
				isActive: false
			};
		}
		
		get dataflow(){
			return this._dataflow;
		}
		
		get name() {
			return this._name;
		}
		
		get id(){
			return this._id;
		}
		
		get graphs() {
			return this._graphs;
		}
	}
	
	return module;
};

class Output {
	constructor(title, dimensionLabels, saveFormat){
		this._title = title;
		this._dimensionLabels = dimensionLabels;
		this._dimension = dimensionLabels.length;
		this._format = saveFormat;
		this._data = [];
	}
	
	addData(data){
		if((!Array.isArray(data) && this._dimension > 1) || data.length !== this._dimension) return false;
		this._data.push(data);
		return true;
	}
	
	get title(){
		return this._title;
	}
	
	get dimensionLabels(){
		return this._dimensionLabels;
	}
	
	get dimension(){
		return this._dimension;
	}
	
	get format(){
		return this._format;
	}
	
	get data(){
		return this._data;
	}
}

/*
 *	An experiment's graph contains a single dataflow object responsible for processing
 *  the raw sensor data into meaningful graph data points
 */
class Graph {
	constructor(title, xLbl, yLbl, saveType){
		this._data = [];
		this._listeners = [];
		this._title = title;
		this._labels = {x: xLbl, y: yLbl};
		this._saveType = saveType;
		this.saveFile = undefined;
	}
	
	addData(dataPoint){
		if(!dataPoint || dataPoint.x === undefined || dataPoint.y === undefined) return false;
		this._data.push(dataPoint);
		for(const listener of this._listeners)
			listener(dataPoint);
		return true;
	}
	
	addListener(listener){
		if(typeof listener === "function")
			this._listeners.push(listener);
	}
	
	get data(){
		return this._data;
	}
	
	get title(){
		return this._title;
	}
	
	get axisLabels(){
		return this._labels;
	}
	
	get saveType(){
		return this._saveType;
	}
}
