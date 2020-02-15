module.exports = function(port){
	const createError = require('http-errors');
	const express = require('express');
	const path = require('path');
	const cookieParser = require('cookie-parser');
	const logger = require('morgan');
	const sassMiddleware = require('node-sass-middleware');
	const http = require('http');
	const url = require("url");
	const favicon = require('serve-favicon');

	const driverManager = require('./driverManager');
	const deviceManager = require('./deviceManager')(driverManager);
	const fileManager = require("./fileManager")();
	const experimentManager = require('./experimentManager')(deviceManager, driverManager, fileManager);

	const indexRouter = require('./routes/index');
	const usersRouter = require('./routes/users');
	const devicesRouter = require('./routes/devices')(driverManager, deviceManager);
	const experimentsRouter = require('./routes/experiments')(deviceManager, experimentManager, fileManager);
	const settingsRouter = require('./routes/settings');

	let app = express();

	// view engine setup
	app.set('views', path.join(__dirname, 'views'));
	app.set('view engine', 'twig');

	app.use(logger('dev'));
	app.use(express.json());
	app.use(express.urlencoded({ extended: false }));
	app.use(cookieParser());
	app.use(sassMiddleware({
		src: path.join(__dirname, 'public'),
		dest: path.join(__dirname, 'public'),
		indentedSyntax: true, // true = .sass and false = .scss
		sourceMap: true,
		includePaths: path.join(__dirname, 'node_modules')
	}));
	app.use(express.static(path.join(__dirname, 'public')));
	app.use(favicon(path.join(__dirname, "public", "images", "favicon.ico")));

	app.use('/', indexRouter);
	app.use('/users', usersRouter);
	app.use('/devices', devicesRouter);
	app.use('/experiments', experimentsRouter);
	app.use('/settings', settingsRouter);

	// catch 404 and forward to error handler
	app.use(function(req, res, next) {
		next(createError(404));
	});

	// error handler
	app.use(function(err, req, res, next) {
		// set locals, only providing error in development
		res.locals.message = err.message;
		res.locals.error = req.app.get('env') === 'development' ? err : {};

		// render the error page
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
				if (res && typeof res === "function") res(result);
				else socket.emit(name, result);
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
		linkFunction("addDevice", deviceManager.addDevice,["name", "type", "extraData"]);
		linkFunction("getDevice", deviceManager.getDevice,["id"]);
		linkFunction("getDevices", deviceManager.getDevices);
		
		socket.on("listenDevice", (deviceID) => {
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
		
		linkFunction("addSensor", deviceManager.addSensor,["deviceID", "sensorName", "extraData"]);
		linkFunction("configureSensor", deviceManager.configureSensor,["deviceID", "sensorID", "extraData"]);
		linkFunction("removeSensor", deviceManager.removeSensor,["deviceID", "sensorID"],{deviceID: checkAndGetFromUrl("devices")});
		
		linkFunction("addExperiment", experimentManager.addExperiment,["name"]);
		linkFunction("getExperiment", experimentManager.getExperiment,["id"]);
		linkFunction("getExperiments", experimentManager.getExperiments);
		linkFunction("setExperimentMeasurement", experimentManager.setExperimentMeasurement,["id", "type", "frequency", "measurementData"]);
		linkFunction("updateExperimentDataflow", experimentManager.updateExperimentDataflow,["id", "dataflowStructure"]);
		linkFunction("addSensorToExperiment", experimentManager.addSensorToExperiment,["experimentID", "deviceID", "sensorID"]);
		linkFunction("removeSensorFromExperiment", experimentManager.removeSensorFromExperiment, ["experimentID", "sensorID"]);
		linkFunction("beginExperiment", experimentManager.beginExperiment, ["id"]);
		linkFunction("stopExperiment", experimentManager.stopExperiment, ["id"]);
		linkFunction("addGraphToExperiment", experimentManager.addGraphToExperiment,["experimentID", "title", "xLbl", "yLbl", "saveType"]);
		linkFunction("listenToExperiment", experimentManager.listenToExperiment,["id", "listenerID", "listener"],{
			listenerID: socket.id,
			listener: (title, point) => {
				socket.emit("graphData", {title: title, point: point});
			}
		});
		
		// TODO: Temporary fix, final fix will be to create a single manager that uses UUID namespaces
		socket.on("getDevicesAndExperiments", (res) => {
			let obj = {devices: deviceManager.getDevices(), experiments: experimentManager.getExperiments()};
			if(res && typeof res === "function") res(obj);
			else socket.emit("getDevicesAndExperiments", obj);
		});
		
		socket.on('disconnect', function() {
			for(const device of deviceManager.getDeviceList())
				device.removeListener(socket.id);
		});
	});

	return app;
};
