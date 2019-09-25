module.exports = function(port){
	const createError = require('http-errors');
	const express = require('express');
	const path = require('path');
	const cookieParser = require('cookie-parser');
	const logger = require('morgan');
	const sassMiddleware = require('node-sass-middleware');
	//const fs = require("fs");
	const http = require('http');
	//const privateKey  = fs.readFileSync('sslcert/server.key', 'utf8');
	//const certificate = fs.readFileSync('sslcert/server.crt', 'utf8');

	const driverManager = require('./driverManager');
	const deviceManager = require('./deviceManager')(driverManager);
	const experimentManager = require('./experimentManager')(deviceManager);

	const indexRouter = require('./routes/index');
	const usersRouter = require('./routes/users');
	const devicesRouter = require('./routes/devices')(driverManager, deviceManager);
	const experimentsRouter = require('./routes/experiments')(deviceManager, experimentManager);
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
		let linkFunction = function(name, fun, keys) {
			socket.on(name, (data, res) => {
				let args = [];
				if(keys !== undefined)
					if(keys.length > 0)
						for(const key of keys)
							args.push(data[key]);
					else
						args.push(data);
				let result = fun.apply(undefined, args);
				if (res && typeof res === "function") res(result);
				else socket.emit(name, result);
			});
		};
		linkFunction("addDevice", deviceManager.addDevice,["name", "device", "link", "extraData"]);
		linkFunction("getDevice", deviceManager.getDevice,["link"]);
		linkFunction("getDevices", deviceManager.getDevices);

		socket.on("listenDevice", (device, res) => {
			let dev = deviceManager.getDeviceByName(device);
			let status = false;
			if(dev && !dev.listeners[socket.id]) {
				dev.listeners[socket.id] = (updates) => {
					socket.emit("sensorData", updates);
				};
				status = true;
			}
			if(res && typeof res === "function") res(status);
		});

		linkFunction("addSensor", deviceManager.addSensor,["deviceName", "sensorName", "extraData"]);
		linkFunction("removeSensor", deviceManager.removeSensor,["deviceName", "sensorID"]);

		linkFunction("addExperiment", experimentManager.addExperiment,["name", "link"]);
		linkFunction("getExperiment", experimentManager.getExperiment,["link"]);
		linkFunction("getExperiments", experimentManager.getExperiments);

		socket.on('disconnect', function() {
			for(const device of deviceManager.getDevices())
				if(device.listeners[socket.id])
					delete device.listeners[socket.id];
		});
	});

	return app;
};
