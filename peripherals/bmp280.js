const utils = require("../utils");

const stbyVals = ["1 ms", "62.5 ms", "125 ms", "250 ms", "500 ms", "1000 ms", "2000 ms", "4000 ms"];
const filterVals = ["Off", "x2", "x4", "x8", "x16"];
const oversampleVals = ["None", "x1", "x2", "x4", "x8", "x16"];

/*
 * Adapted from https://github.com/adafruit/Adafruit_BMP280_Library
 */
module.exports = {
	name: "BMP280",
	protocols: ["spi"],
	dataflow: {
		inputs: [],
		outputs: ["temperature", "pressure"],
		worker: async (device, extraData) => {
			let cs = utils.locStringToObject(extraData.cs);
			let scl = utils.locStringToObject(extraData.scl);
			let miso = utils.locStringToObject(extraData.miso);
			let mosi = utils.locStringToObject(extraData.mosi);
			
			let adcT = _bmp280_readReg24(device, scl, cs, miso, mosi, 0xFA);
			adcT >>= 4;
			
			let tFine = (((adcT >> 3) - (extraData.t1 << 1)) * extraData.t2) >> 11 +
				(((((adcT >> 4) - (extraData.t1)) * ((adcT >> 4) - extraData.t1)) >> 12) * extraData.t3) >> 14;
			
			let t = (tFine * 5 + 128) >> 8;
			
			let adcP = _bmp280_readReg24(device, scl, cs, miso, mosi, 0xF7);
			adcP >>= 4;
			
			let var1 = BigInt(tFine) - 128000n;
			let var2 = BigInt(var1 * var1 * BigInt(extraData.p6));
			var2 = var2 + ((var1 * BigInt(extraData.p5)) << 17n);
			var2 = var2 + (BigInt(extraData.p4) << 35n);
			var1 = ((var1 * var1 * BigInt(extraData.p3)) >> 8n) + ((var1 * BigInt(extraData.p2)) << 12n);
			var1 = (((BigInt(1) << 47n) + var1)) * (BigInt(extraData.p1) >> 33n);
			
			let p = undefined;
			if(var1 !== 0n) {
				p = BigInt(1048576-adcP);
				p = (((p << 31n) - var2) * 3125n) / var1;
				var1 = (BigInt(extraData.p9) * (p >> 13n) * (p >> 13n)) >> 25n;
				var2 = (BigInt(extraData.p8) * p) >> 19n;
				
				p = ((p + var1 + var2) >> 8n) + (BigInt(extraData.p7) << 4n);
			}
			
			return [t/100, p === undefined ? p : Number(p)/256];
		}
	},
	form: {
		scl: {
			"type": "location_spi",
			"isTitled": true,
			"title": "Clock (SCLK)"
		},
		cs: {
			"type": "location_spi",
			"isTitled": true,
			"title": "Chip Select (CS)"
		},
		miso: {
			"type": "location_spi",
			"isTitled": true,
			"title": "Data Out (MISO)"
		},
		mosi: {
			"type": "location_spi",
			"isTitled": true,
			"title": "Data In (MOSI)"
		},
		stby: {
			"type": "list",
			"isTitled": true,
			"title": "Standby Duration",
			"items": stbyVals
		},
		filterLvl: {
			"type": "list",
			"isTitled": true,
			"title": "Filter Level",
			"items": filterVals
		},
		tempOversample: {
			"type": "list",
			"isTitled": true,
			"title": "Temperature Oversampling",
			"items": oversampleVals
		},
		pressOversample: {
			"type": "list",
			"isTitled": true,
			"title": "Pressure Oversampling",
			"items": oversampleVals
		}
	},
	onCreate: (device, extraData) => {
		let cs = utils.locStringToObject(extraData.cs);
		let scl = utils.locStringToObject(extraData.scl);
		let miso = utils.locStringToObject(extraData.miso);
		let mosi = utils.locStringToObject(extraData.mosi);
		device.driver.setOutputValue(device.id, cs, 1);
		
		extraData.t1 = _bmp280_readRegLE(device, scl, cs, miso, mosi, 0x88);
		extraData.t2 = _bmp280_readRegLE(device, scl, cs, miso, mosi, 0x8A);
		extraData.t3 = _bmp280_readRegLE(device, scl, cs, miso, mosi, 0x8C);
		
		extraData.p1 = _bmp280_readRegLE(device, scl, cs, miso, mosi, 0x8E);
		extraData.p2 = _bmp280_readRegLE(device, scl, cs, miso, mosi, 0x90);
		extraData.p3 = _bmp280_readRegLE(device, scl, cs, miso, mosi, 0x92);
		extraData.p4 = _bmp280_readRegLE(device, scl, cs, miso, mosi, 0x94);
		extraData.p5 = _bmp280_readRegLE(device, scl, cs, miso, mosi, 0x96);
		extraData.p6 = _bmp280_readRegLE(device, scl, cs, miso, mosi, 0x98);
		extraData.p7 = _bmp280_readRegLE(device, scl, cs, miso, mosi, 0x9A);
		extraData.p8 = _bmp280_readRegLE(device, scl, cs, miso, mosi, 0x9C);
		extraData.p9 = _bmp280_readRegLE(device, scl, cs, miso, mosi, 0x9E);
		
		_bmp280_writeReg(device, scl, cs, miso, mosi, 0xF5, (
			utils.getListPosition(extraData.stby, stbyVals, 0x07) << 5)
			| (utils.getListPosition(extraData.filterLvl, filterVals, 0x04) << 2));
		
		_bmp280_writeReg(device, scl, cs, miso, mosi, 0xF4, (
			utils.getListPosition(extraData.tempOversample, oversampleVals, 0x05) << 5)
			| (utils.getListPosition(extraData.pressOversample, oversampleVals, 0x05) << 5) << 2);
		
		return [cs, scl, miso, mosi];
	}
};

function _bmp280_readRegLE(device, scl, cs, miso, mosi, reg){
	device.driver.setOutputValue(device.id, cs, 0);
	device.driver.transferSPI8(device.id, scl, miso, mosi, reg | 0x80);
	let res = device.driver.swapEndianness16(device.driver.readSPI16(device.id, cs, miso));
	device.driver.setOutputValue(device.id, cs, 1);
	return res;
}

function _bmp280_readReg24(device, scl, cs, miso, mosi, reg){
	device.driver.setOutputValue(device.id, cs, 0);
	device.driver.transferSPI8(device.id, scl, miso, mosi, reg | 0x80);
	let res = device.driver.readSPI24(device.id, cs, miso);
	device.driver.setOutputValue(device.id, cs, 1);
	return res;
}

function _bmp280_writeReg(device, scl, cs, miso, mosi, reg, value){
	device.driver.setOutputValue(device.id, cs, 0);
	device.driver.transferSPI8(device.id, scl, miso, mosi, reg & ~0x80);
	device.driver.transferSPI8(device.id, scl, miso, mosi, value);
	device.driver.setOutputValue(device.id, cs, 1);
}