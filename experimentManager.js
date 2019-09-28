const Dataflow = require("./dataflow");
const uuid = require("uuid/v1");

module.exports = function(deviceManager) {
	let module = {};
	let experiments = {};

	module.addExperiment = function(name, link){
		if(!experiments[link]){
			experiments[link] = new Experiment(name, link);
			return true;
		}
		return false;
	};

	module.addSensorToExperiment = function(experiment, device, sensorId){
		if(experiments[experiment] && deviceManager.getSensor(device, sensorId)){
			experiments[experiment].addSensor(device, sensorId);
			return true;
		}
		return false;
	};
	
	module.getExperiment = function(link){
		return experiments[link];
	};

	module.getExperiments = function(){
		let res = [];
		for(experiment of Object.values(experiments))
			res.push(experiment.getWebInfo());
		console.log(res);
		return res;
	};

	return module;
};

class Experiment{
	constructor(name, link, dataflowStructure) {
		this._name = name;
		this._link = link;
		this._sensors = [];
		this._dataflow = new Dataflow(dataflowStructure);
		this._graphs = [];
	}
	
	addSensor(device, id){
		this._sensors.push({device: device, id: id});
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
		for(const sensor of fileStructure.sensors){
			this._sensors.push({sensor})
		}
		for(const g of fileStructure.graphs) {
			this.addGraph(g.title, g.axis.x, g.axis.y, g.id);
		}
	}
	
	get dataflow(){
		return this._dataflow;
	}
	
	get name(){
		return this._name;
	}
	
	get link(){
		return this._link;
	}
	
	get sensors(){
		return this._sensors;
	}
	
	get graphs(){
		return this._graphs;
	}
	
	getWebInfo(){
		return {name: this.name, dataflow: this.dataflow.webStructure, link: this.link, sensors: this.sensors, graphs: this.graphs};
	}
}

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