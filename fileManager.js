const fs = require("fs");
const path = require("path");
const dataviewDir = path.join(require("os").homedir(), "Documents", "Dataview");
const experimentsDir = path.join(dataviewDir, "Experiments");

module.exports = function(){
	let module = {};
	
	module.fileTypes = ["JSON", "CSV", "Origin"];
	module.userDir = dataviewDir;
	module.tmpDir = path.join(__dirname, "tmp");
	
	module.ensureFolder = function(path){
		if(!fs.existsSync(path))
			fs.mkdirSync(path);
	};
	
	module.ensureFolder(dataviewDir);
	module.ensureFolder(experimentsDir);
	
	module.createGraphSave = function(experimentName, startDate, graph, type){
		if(!experimentName || !startDate || !graph) return undefined;
		let saveFolder = path.join(experimentsDir, experimentName);
		module.ensureFolder(saveFolder);
		saveFolder = path.join(saveFolder, "Graphs");
		module.ensureFolder(saveFolder);
		saveFolder = path.join(saveFolder, graph.title);
		module.ensureFolder(saveFolder);
		
		let start = new Date(startDate);
		saveFolder = path.join(saveFolder, start.getFullYear().toString());
		module.ensureFolder(saveFolder);
		saveFolder = path.join(saveFolder, start.getDate()+"-"+(start.getMonth()+1));
		module.ensureFolder(saveFolder);
		
		let file;
		switch(type) {
			default:
			case "JSON":
				file = new JsonDataFile(saveFolder,{
					axis: graph.axisLabels
				});
				break;
			case "CSV":
				file = new CsvDataFile(saveFolder,[graph.axisLabels.x, graph.axisLabels.y]);
				break;
			case "Origin":
				file = new CsvDataFile(saveFolder,[graph.axisLabels.x, graph.axisLabels.y],"ascii","\t");
				break;
		}
		
		return file;
	};
	
	module.saveGraphData = function(data, saveFile){
		saveFile.write(data);
	};
	
	module.endGraphSave = function(saveFile, startDate){
		let today = new Date();
		let start = new Date(startDate);
		
		if(today.getDate() === start.getDate() && today.getMonth() === start.getMonth() && today.getFullYear() === start.getFullYear())
			saveFile.close(start.getHours()+"h"+start.getMinutes()+"m"+start.getSeconds()+"s to "+today.getHours()+"h"+today.getMinutes()+"m"+today.getSeconds()+"s");
		else
			saveFile.close(start.getDay()+"-"+start.getMonth()+(today.getFullYear() !== start.getFullYear() ? "-"+start.getFullYear() : "")+" "+start.getHours()+":"+start.getMinutes());
	};
	
	module.saveExperiment = function(name, id, dataflowStructure){
		let saveFile = path.join(experimentsDir, name); // This should use id instead
		module.ensureFolder(saveFile);
		saveFile = path.join(saveFile, "experiment.json");
		
		let data = {};
		
		if(fs.existsSync(saveFile)){
			data = JSON.parse(fs.readFileSync(saveFile).toString("utf8"));
		}
		
		data.name = name;
		data.id = id;
		data.dataflow = dataflowStructure;
		
		fs.writeFileSync(saveFile, JSON.stringify(data));
	};
	
	module.getSavedExperiments = function(){
		let saved = [];
		let contents = fs.readdirSync(experimentsDir);
		for(let file of contents){
			let loc = path.join(experimentsDir, file);
			if(fs.existsSync(loc) && fs.lstatSync(loc).isDirectory()){
				let saveFile = path.join(loc, "experiment.json");
				if(fs.existsSync(saveFile)){
					try {
						let data = JSON.parse(fs.readFileSync(saveFile).toString("utf8"));
						if (data.hasOwnProperty("name") && data.hasOwnProperty("id")) {
							saved.push(data);
						}
					} catch(e){
						console.error("Error parsing possible experiment save file (Located at " + saveFile + "):", e);
					}
				}
			}
		}
		return saved;
	};
	
	module.experimentHasSaveFile = function(name){
		return fs.existsSync(path.join(experimentsDir, name, "experiment.json")); // This should use id instead
	};
	
	class SaveFile {
		constructor(folder, ext, header){
			this._tmpPath = path.join(folder, "current.tmp");
			if(fs.existsSync(this._tmpPath))
				fs.unlinkSync(this._tmpPath);
			this._ws = fs.createWriteStream(this._tmpPath);
			this._folder = folder;
			this._ext = ext;
			if(header !== undefined)
				this._ws.write(header);
			this._ws.on("finish",() => {
				fs.renameSync(this._tmpPath, path.join(this._folder, this._name + "." + this._ext));
				this._ws.close();
			});
		}
		
		write(content){
			this._ws.write(content);
		}
		
		close(name){
			this._name = name;
			if(!this._ws.writableEnded)
				this._ws.end();
		}
	}
	
	class JsonDataFile extends SaveFile{
		constructor(folder, header){
			let headJson = header || {};
			headJson.data = [];
			super(folder, "json", JSON.stringify(headJson).slice(0, -2));
		}
		
		write(content){
			if(Array.isArray(content))
				for(const line of content)
					super.write((typeof line === "object" ? JSON.stringify(line) : line) + ",");
			else
				super.write((typeof content === "object" ? JSON.stringify(content) : content) + ",");
		}
		
		close(name){
			this._ws.end("]}");
			super.close(name);
		}
	}
	
	class CsvDataFile extends SaveFile{
		constructor(folder, header, ext, separator){
			let sep = separator || ",";
			let head;
			if(header !== undefined && header !== null) {
				if(typeof header === "object")
					head = (Array.isArray(header) ? header : Object.keys(header)).join(sep);
				else
					head = header;
				head += "\n";
			}
			super(folder, ext || "csv", head);
			this._separator = sep;
		}
		
		write(content){
			if(Array.isArray(content) && content.length > 0 && typeof content[0] === "object")
				for(const line of content)
					super.write((typeof line === "object" ? ((Array.isArray(line) ? line : Object.values(line)).join(this._separator)) : line) + "\n");
			else
				super.write((typeof content === "object" ? ((Array.isArray(content) ? content : Object.values(content)).join(this._separator)) : content) + "\n");
		}
	}
	
	return module;
};