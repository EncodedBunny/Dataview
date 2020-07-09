module.exports = {
	locStringToObject: function(loc){
		let toks = loc.split(" ");
		let type = toks.length > 1 ? toks.slice(0, toks.length-1).join(" ") : undefined;
		return {
			type: type,
			value: toks[toks.length-1]
		};
	},
	getListPosition: function(value, list, bitMask){
		let i = list.indexOf(value);
		if(bitMask !== undefined){
			i &= bitMask;
		}
		if(i < 0){
			i = 0;
		}
		return i;
	}
};