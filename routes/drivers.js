const path = require("path");
const fs = require("fs-extra");
let AdmZip = require("adm-zip");

module.exports = function (driverManager, fileManager) {
	const express = require('express');
	let router = express.Router();
	
	router.get('/', function(req, res) {
		res.render('drivers', {
			drivers: driverManager.getInstalledDrivers().map(driver => {
				return {
					name: driver.formattedName,
					rawName: driver.name
				};
			})
		});
	});
	
	router.post("/", async (req, res) => {
		if(req.files && req.files.driverRoot){
			let file = req.files.driverRoot;
			if(
				file.name.length > 4
				&& (
					file.mimetype === "application/x-zip-compressed"
					|| file.mimetype === "application/zip"
				)
				&& (
					file.name.substring(file.name.length-4).toLowerCase() === ".zip"
					|| (file.data[0] === 0x80 && file.data[1] === 0x75)
				)
			){
				try {
					let zip = new AdmZip(file.tempFilePath);
					let dstFolder = path.join(fileManager.tmpDir, file.name.substring(0, file.name.indexOf(".")));
					zip.extractAllTo(dstFolder,true);
					
					driverManager.installDriver(dstFolder).then(() => {
						res.status(200).end();
					}).catch(err => {
						fs.remove(dstFolder, err => {
							if(err) console.error(err);
						});
						sendError(res, err);
					});
				} catch(e){
					sendError(res,"An internal error occurred: " + e);
				}
			} else{
				sendError(res,"Invalid driver file format, expected ZIP");
			}
			fs.remove(file.tempFilePath, err => {
				if(err) console.error(err);
			});
		} else{
			sendError(res,"Upload failed");
		}
	});
	
	return router;
};

function sendError(res, msg){
	res.setHeader("Content-Type", "text/plain");
	res.status(400).send(msg);
}