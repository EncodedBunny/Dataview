module.exports = function(port){
	const createError = require('http-errors');
	const express = require('express');
	const path = require('path');
	const logger = require('morgan');
	const sassMiddleware = require('node-sass-middleware');
	const fileUpload = require('express-fileupload');
	const http = require('http');
	const url = require("url");
	const favicon = require('serve-favicon');
	const session = require("express-session");
	const crypto = require("crypto");
	
	Array.prototype.remove = function(x) {
		let i = this.indexOf(+x);
		if(i > -1)
			this.splice(i, 1);
		return this;
	};
	
	const users = require("./users");
	
	const driverManager = require('./driverManager');
	const deviceManager = require('./deviceManager')(driverManager);
	const fileManager = require("./fileManager")();
	const experimentManager = require('./experimentManager')(deviceManager, driverManager, fileManager);

	const indexRouter = require('./routes/index');
	const usersRouter = require('./routes/users');
	const devicesRouter = require('./routes/devices')(driverManager, deviceManager);
	const experimentsRouter = require('./routes/experiments')(deviceManager, experimentManager, fileManager);
	const settingsRouter = require('./routes/settings');
	const driversRouter = require('./routes/drivers')(driverManager, fileManager);
	
	const settings = require("./settings");
	
	const cp = require("child_process");
	
	let child = cp.spawn(path.join(__dirname, "node_modules", "electron", "dist", "electron.exe"), [path.join(__dirname, "interface.js")], {
		stdio: [ "ignore", "ignore", "ignore" ]
	});
	
	let app = express();
	
	app.use(logger('dev'));
	app.use(express.json());
	app.use(express.urlencoded({ extended: false }));
	
	app.set("views", path.join(__dirname, "views"));
	app.set("view engine", "twig");
	app.disable("x-powered-by");
	
	let sessionSecret = settings.getSetting("sessionSecret");
	if(sessionSecret === undefined || sessionSecret.length <= 0){
		sessionSecret = crypto.randomBytes(32).toString("hex");
		settings.setSetting("sessionSecret", sessionSecret);
	}
	
	let sessionConfig = {
		secret: sessionSecret,
		name: "dv_sid",
		resave: false,
		saveUninitialized: true,
		cookie: {
			maxAge: 1000*60*30,
			httpOnly: true
		}
	};
	
	if(app.get("env") === "production") {
		app.set("trust proxy", 1);
		sessionConfig.cookie.secure = true;
	}
	
	app.use((req, res, next) => {
		res.setHeader("X-Frame-Options", "DENY");
		res.setHeader("X-XSS-Protection", "1; mode=block");
		res.setHeader("X-Content-Type-Options", "nosniff");
		next();
	});
	app.use(fileUpload({
		limits: {
			fileSize: 10 * 1024 * 1024
		},
		useTempFiles: true,
		tempFileDir: fileManager.tmpDir
	}));
	
	app.use(sassMiddleware({
		src: path.join(__dirname, "public"),
		dest: path.join(__dirname, "public"),
		indentedSyntax: true,
		sourceMap: true,
		includePaths: path.join(__dirname, "node_modules")
	}));
	/*app.use("stylesheets/", postCssMiddleware({
		plugins: [autoprefixer()],
		options: {
			map: {
				inline: true
			}
		},
		src: req => {
			return path.join(__dirname, "public", req.path);
		}
	}));*/
	app.use(express.static(path.join(__dirname, "public")));
	app.use(favicon(path.join(__dirname, "public", "images", "favicon.ico")));
	
	app.use(session(sessionConfig));
	
	app.use("/", indexRouter);
	app.use((req, res, next) => {
		if(!req.session.user && req.session.cookie)
			res.clearCookie("dv_sid");
		next();
	});
	app.use((req, res, next) => {
		if(!req.session.user)
			res.redirect("/");
		else
			next();
	});
	app.use("/users", usersRouter);
	app.use("/devices", devicesRouter);
	app.use("/experiments", experimentsRouter);
	app.use("/settings", settingsRouter);
	app.use("/drivers", driversRouter);
	
	app.use(function(req, res, next) {
		next(createError(404));
	});
	
	app.use(function(err, req, res, next) {
		res.locals.message = err.message;
		res.locals.error = req.app.get('env') === 'development' ? err : {};
		
		res.status(err.status || 500);
		res.render('error');
	});
	
	app.server = http.createServer(app);
	app.server.listen(port);

	const io = require("socket.io")(app.server);
	io.on('connection', function(socket){
		let linkFunction = function(name, fun, keys, values) {
			socket.on(name, (data, res) => {
				let args = [];
				if(keys !== undefined)
					if(keys.length > 0)
						for(const key of keys)
							args.push((values !== undefined ? values[key] : undefined) || data[key]);
					else
						args.push(data);
				let result = fun.apply(undefined, args);
				let respond = () => {
					if (res && typeof res === "function") res(result);
					else socket.emit(name, result);
				};
				if(typeof result === "object" && typeof result.then === "function"){
					result.then(res => {
						result = res;
						respond();
					}).catch(err => {
						result = err;
						respond();
					});
				} else{
					respond();
				}
			});
		};
		let checkAndGetFromUrl = function(parent){
			let path = new url.URL(socket.request.headers.referer || "").pathname;
			if(path.length > 0)
				path = path.substring(1);
			path = path.split("/");
			if(path.length >= 2 && path[0] === parent)
				return path[1];
			return "";
		};
		linkFunction("addDevice", deviceManager.addDevice,["name", "type", "extraData", "model"]);
		linkFunction("getDevice", deviceManager.getDevice,["id"]);
		linkFunction("getDevices", deviceManager.getDevices);
		
		socket.on("listenDevice", deviceID => {
			let dev = deviceManager.getDevice(deviceID || checkAndGetFromUrl("devices"));
			if(dev)
				dev.addListener(socket.id, (updates) => { // TODO: Add this listener to default device listener function
					let ups = {};
					for(const senID of Object.keys(dev.sensors))
						if (Object.keys(updates).includes(dev.sensors[senID].id + ""))
							ups[senID] = updates[dev.sensors[senID].id];
					socket.emit("sensorData", ups);
				});
		});
		
		linkFunction("addSensor", deviceManager.addSensor,["deviceID", "name", "location", "extraData"]);
		linkFunction("addActuator", deviceManager.addActuator,["deviceID", "name", "location", "extraData"]);
		linkFunction("addPeripheral", deviceManager.addPeripheral,["deviceID", "name", "model", "extraData"]);
		linkFunction("getPeripheralForm", deviceManager.getPeripheralForm,["deviceID", "model"]);
		linkFunction("configureSensor", deviceManager.configureSensor,["deviceID", "sensorID", "location", "extraData"]);
		linkFunction("configureActuator", deviceManager.configureActuator,["deviceID", "sensorID", "location", "extraData"]);
		linkFunction("removeSensor", deviceManager.removeSensor,["deviceID", "sensorID"],{deviceID: checkAndGetFromUrl("devices")});
		linkFunction("setDeviceI2C", deviceManager.setI2C,["deviceID", "enabled"]);
		
		linkFunction("addExperiment", experimentManager.addExperiment,["name"]);
		linkFunction("getExperiment", experimentManager.getExperiment,["id"]);
		linkFunction("getExperiments", experimentManager.getExperiments);
		linkFunction("setExperimentMeasurement", experimentManager.setExperimentMeasurement,["id", "condition", "frequency", "measurementData"]);
		linkFunction("updateExperimentDataflow", experimentManager.updateExperimentDataflow,["id", "dataflowStructure"]);
		linkFunction("beginExperiment", experimentManager.beginExperiment, ["id"]);
		linkFunction("stopExperiment", experimentManager.stopExperiment, ["id"]);
		linkFunction("addGraphToExperiment", experimentManager.addGraphToExperiment,["experimentID", "title", "xLbl", "yLbl", "saveType"]);
		linkFunction("listenToExperiment", experimentManager.listenToExperiment,["id", "listenerID", "listener"],{
			listenerID: socket.id,
			listener: {
				onGraphData: (title, point) => {
					socket.emit("graphData", {title: title, point: point});
				},
				onEnd: () => {
					socket.emit("experimentEnd");
				}
			}
		});
		
		// TODO: Temporary fix, final fix will be to create a single manager that uses UUID namespaces
		socket.on("getDevicesAndExperiments", (res) => {
			let obj = {
				devices: deviceManager.getDevices(),
				experiments: experimentManager.getExperimentList().map(experiment => {
					return {
						name: experiment.name,
						id: experiment.id
					};
				})
			};
			if(res && typeof res === "function") res(obj);
			else socket.emit("getDevicesAndExperiments", obj);
		});
		
		socket.on('disconnect', function() {
			for(const experiment of experimentManager.getExperimentList())
				experiment.removeListener(socket.id);
		});
	});

	return app;
};
