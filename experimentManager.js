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

/**
 * Listens to new data points generated on the graphs of an experiment
 * @typedef {Object} ExperimentListener
 * @property {Function} onGraphData Callback which will be called with a string that represents the graph's title, and
 * an object which contains the x and y values of the generated point
 * @property {Function} onEnd Callback which will be called once without arguments when the experiment's measurements
 * are either finished or were cancelled
 */

/**
 * Manages all the experiments, used to add/remove experiments, aswell as graphs to them
 * @module ExperimentManager
 */
module.exports = function(deviceManager, driverManager, fileManager) {
	/**
	 * @exports ExperimentManager
	 */
	let module = {};
	let experiments = {};
	
	/**
	 * Adds a new experiment
	 * @param {string} name The name of the new experiment
	 * @returns {string} The id of this experiment
	 */
	module.addExperiment = function(name){
		let id;
		do{
			id = uuid();
		} while(experiments[id] !== undefined);
		experiments[id] = new Experiment(name, id);
		return id;
	};
	
	/**
	 * Gets an {@link Experiment} by it's id
	 * @param {string} id The id of the experiment
	 * @returns {Experiment|undefined} The experiment whose id matches the one given, or undefined if none are be found
	 */
	module.getExperiment = function(id){
		return experiments[id];
	};
	
	/**
	 * Retrieves a list of all {@link Experiment}
	 * @returns {Experiment[]} An array of the instances of the experiments
	 */
	module.getExperimentList = function(){
		return Object.values(experiments);
	};
	
	/**
	 * Sets the measurement configuration for a given experiment
	 * @param {string} id The id of the experiment
	 * @param {string} condition The stopping condition for the measurement, represent the type of measurement that will
	 * be made
	 * @param {number} frequency The frequency, in milliseconds, at which a measurement will be made (in other words,
	 * the frequency at which the dataflow of this experiment will be evaluated)
	 * @param {Object} measurementData Additional condition specific information
	 * @returns {boolean} True if the measurement was successfully configured, false otherwise
	 */
	module.setExperimentMeasurement = function(id, condition, frequency, measurementData){
		if(experiments[id] && measurementTypes[condition])
			return experiments[id].setMeasurementType(condition, frequency, measurementData);
		return false;
	};
	
	/**
	 * Changes the dataflow structure of an experiment
	 * @param {string} id The id of the experiment
	 * @param {Object} dataflowStructure The new node structure of this experiment's dataflow
	 * @returns {boolean} True if the dataflow structure was changed, false otherwise
	 */
	module.updateExperimentDataflow = function(id, dataflowStructure){
		if(experiments[id])
			return experiments[id].setDataflowStructure(dataflowStructure);
		return false;
	};
	
	/**
	 * Starts measurements in a experiment according to the measurement configuration in said experiment, the experiment
	 * must not be currently executing measurements and must be already be configured to do measurements
	 * @param {string} id The id of the experiment
	 * @returns {boolean} True if measurements have started, false otherwise
	 */
	module.beginExperiment = function(id){
		if(experiments[id])
			return experiments[id].beginMeasurement();
		return false;
	};
	
	/**
	 * Stops ongoing measurements in an experiment, the experiment must be currently executing measurements
	 * @param {string} id The id of the experiment
	 * @returns {boolean} True if measurements were stopped, false otherwise
	 */
	module.stopExperiment = function(id){
		if(experiments[id])
			return experiments[id].cancelActiveMeasurement();
		return false;
	};
	
	/**
	 * Attaches a new graph to an experiment, and makes it available in the dataflow editor of this experiment
	 * @param {string} id The id of the experiment
	 * @param {string} title The title of the graph
	 * @param {string} xLbl The x-axis label
	 * @param {string} yLbl The y-axis label
	 * @param {string} saveType The type of format to use in the graph's save file
	 * @returns {boolean} True if the graph was successfully added, false otherwise
	 */
	module.addGraphToExperiment = function(id, title, xLbl, yLbl, saveType){
		if(experiments[id])
			return experiments[id].addGraph(title, xLbl, yLbl, saveType);
		return false;
	};
	
	/**
	 * Attaches an {@link ExperimentListener} to the experiment represented by the given id
	 * @param {string} id The id of the experiment
	 * @param {string} listenerID The id of this listener
	 * @param {ExperimentListener} listener The listener to be attached
	 * @returns {boolean} True if the listener was attached, false otherwise
	 */
	module.listenToExperiment = function(id, listenerID, listener){
		if(experiments[id])
			return experiments[id].addListener(listenerID, listener);
		return false;
	};
	
	/**
	 * Gets the available measurement types (a.k.a. stop conditions)
	 * @returns {Object} An object containing the available measurement types, whose keys are the names of the
	 * stopping criteria
	 */
	module.getMeasurementTypes = () => {return measurementTypes};
	
	/**
	 * Represents an experiment
	 */
	class Experiment{
		/**
		 * Constructs a new experiment
		 * @param {string} name The name of the experiment
		 * @param {string} id The id of the experiment
		 * @param {Object} [dataflowStructure] The dataflow structure to be used by this experiment, or undefined to
		 * create an empty dataflow
		 */
		constructor(name, id, dataflowStructure) {
			this._name = name;
			this._id = id;
			this._dataflow = new Dataflow();
			this._graphs = [];
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
			// Dataflow structure loaded after all nodes are registered in order to avoid missing nodes
			this._dataflow.loadFileStructure(dataflowStructure);
			
			if(!fileManager.experimentHasSaveFile(name)){
				fileManager.saveExperiment(this._name, this._id, dataflowStructure);
			}
		}
		
		/**
		 * Sets the structure of the dataflow
		 * @param {Object} dataflowStructure The new structure to be used
		 * @returns {boolean} True if the dataflow structure was changed, false if the structure provided is not valid
		 */
		setDataflowStructure(dataflowStructure){
			if(!this._dataflow.verifyFileStructure(dataflowStructure)) return false;
			this._dataflow.loadFileStructure(dataflowStructure);
			fileManager.saveExperiment(this.name, this.id, dataflowStructure);
			return true;
		}
		
		/**
		 * Adds a new graph
		 * @param {string} title The title of the graph
		 * @param {string} xLbl The x-axis label
		 * @param {string} yLbl The y-axis label
		 * @param {string} saveType The format in which the graph's file will be saved
		 * @returns {boolean} True if the graph was added, false if a graph with this title already exists in this
		 * experiment
		 */
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
		
		/**
		 * Sets the measurement type
		 * @param {string} measurement The name of the measurement type to be used
		 * @param {number} frequency The frequency, in milliseconds, at which measurements will be made
		 * @param {Object} measurementData Additional measurement type specific information
		 * @returns {boolean} True if the measurement type was changed, false if the measurement name does not correspond
		 * to a valid measurement type, or if the frequency is not a number greater than zero
		 */
		setMeasurementType(measurement, frequency, measurementData){
			if(!measurementTypes.hasOwnProperty(measurement) || frequency <= 0) return false;
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
		
		/**
		 * Starts executing measurements
		 * @returns {boolean} True if measurements have begun, false if measurements are already being executed or if
		 * this experiment is not yet configured to run measurements
		 */
		beginMeasurement(){
			if(this._measurement !== undefined && this._measurementTask !== undefined && this._measurementTask.task === undefined){
				this._measurement.start = Date.now();
				
				for(const graph of this._graphs)
					graph.saveFile = fileManager.createGraphSave(this._name, this._measurement.start, graph, graph.saveType);
				this._measurementTask.task = setInterval(measurementTypes[this._measurement.type].createTask(this._measurement.data, this, () => {
					this._measurement.sample++;
					this._dataflow.activate().catch(err => {
						console.error("At " + Date.now() + " an error occurred while trying to execute a dataflow:", err);
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
	
	for(let experiment of fileManager.getSavedExperiments()){
		experiments[experiment.id] = new Experiment(experiment.name, experiment.id, experiment.dataflow);
	}
	
	return module;
};

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
