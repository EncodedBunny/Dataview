const utils = require("../utils");

/**
 * Adapted from https://github.com/adafruit/MAX6675-library
 */
module.exports = {
	name: "Max6675",
	protocols: ["spi"],
	dataflow: {
		inputs: [],
		outputs: ["temperature"],
		worker: async (device, extraData) => {
			await device.driver.setOutputValue(device.id, utils.locStringToObject(extraData.cs), 0);
			
			let temp = await device.driver.readSPI8(device.id, utils.locStringToObject(extraData.scl), utils.locStringToObject(extraData.miso));
			temp <<= 8;
			temp |= await device.driver.readSPI8(device.id, utils.locStringToObject(extraData.scl), utils.locStringToObject(extraData.miso));
			
			await device.driver.setOutputValue(device.id, utils.locStringToObject(extraData.cs), 1);
			
			temp >>= 3;
			
			return [temp*0.25];
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
		}
	},
	onCreate: async (device, extraData) => {
		let cs = utils.locStringToObject(extraData.cs);
		await device.driver.setOutputValue(device.id, cs, 1);
		return [cs, utils.locStringToObject(extraData.scl), utils.locStringToObject(extraData.miso)];
	}
};