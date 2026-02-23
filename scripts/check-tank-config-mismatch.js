/**
 * One-off script: compare tank_configurations (DB) with old CMS Devices list.
 * Finds: DB rows where site_ref != CMS Site for that device_serial, or device is Inactive in CMS.
 * Output: mismatch report (no .md per project rule; log to console and optional JSON).
 */

const DB_CONFIGS = [{"idx":0,"site_ref":"Neerabup","device_ref":"D00065","device_serial":"100000002928e370","product_type":"TW","tank_number":2,"active":true},{"idx":1,"site_ref":"Kingston","device_ref":"D00087","device_serial":"10000000ab856208","product_type":"GEL","tank_number":1,"active":true},{"idx":2,"site_ref":"Redbank","device_ref":"D00017","device_serial":"000000004f1b279b","product_type":"CONC","tank_number":1,"active":true},{"idx":3,"site_ref":"Clyde","device_ref":"D00003","device_serial":"00000000d1328278","product_type":"TW","tank_number":2,"active":true},{"idx":4,"site_ref":"Banksmeadow","device_ref":"D00050","device_serial":"00000000f3d031e3","product_type":"TW","tank_number":2,"active":true},{"idx":5,"site_ref":"Dandenong South","device_ref":"D00038","device_serial":"10000000a10a01cf","product_type":"FOAM","tank_number":1,"active":true},{"idx":6,"site_ref":"Greenacre","device_ref":"D00047","device_serial":"00000000aa5a9b24","product_type":"CONC","tank_number":1,"active":true},{"idx":7,"site_ref":"Narangba","device_ref":"D00007","device_serial":"000000001555fdbf","product_type":"CONC","tank_number":1,"active":true},{"idx":8,"site_ref":"Croydon","device_ref":"D00034","device_serial":"00000000e7c85e79","product_type":"FOAM","tank_number":1,"active":true},{"idx":9,"site_ref":"Merotherie","device_ref":"D00073","device_serial":"00000000d5edf745","product_type":"FOAM","tank_number":1,"active":true},{"idx":10,"site_ref":"Pendle Hill","device_ref":"D00055","device_serial":"0000000010d7416c","product_type":"FOAM","tank_number":1,"active":true},{"idx":11,"site_ref":"Everton Park","device_ref":"D00005","device_serial":"000000009925bcd3","product_type":"CONC","tank_number":1,"active":true},{"idx":12,"site_ref":"Pendle Hill","device_ref":"D00054","device_serial":"00000000902c2258","product_type":"CONC","tank_number":1,"active":true},{"idx":13,"site_ref":"Banksmeadow","device_ref":"D00023","device_serial":"000000008eea9733","product_type":"FOAM","tank_number":1,"active":true},{"idx":14,"site_ref":"Gateshead","device_ref":"D00081","device_serial":"10000000ebd15d96","product_type":"CONC","tank_number":1,"active":true},{"idx":15,"site_ref":"Archerfield","device_ref":"D00011","device_serial":"0000000072d8d4f3","product_type":"CONC","tank_number":1,"active":true},{"idx":16,"site_ref":"Prestons","device_ref":"D00053","device_serial":"00000000bda16579","product_type":"TW","tank_number":2,"active":true},{"idx":17,"site_ref":"Burleigh","device_ref":"D00082","device_serial":"000000000aeb1dd8","product_type":"CONC","tank_number":1,"active":true},{"idx":18,"site_ref":"Toowoomba","device_ref":"D00092","device_serial":"00000000fe66ab23","product_type":"CONC","tank_number":1,"active":true},{"idx":19,"site_ref":"Epping","device_ref":"D00042","device_serial":"000000005712dae3","product_type":"FOAM","tank_number":1,"active":true},{"idx":20,"site_ref":"Port Melbourne","device_ref":"D00037","device_serial":"00000000cb775d23","product_type":"FOAM","tank_number":1,"active":true},{"idx":21,"site_ref":"Artarmon","device_ref":"D00045","device_serial":"1000000050db9682","product_type":"CONC","tank_number":1,"active":true},{"idx":22,"site_ref":"Silverwater","device_ref":"D00028","device_serial":"00000000bf7c63d5","product_type":"TW","tank_number":2,"active":true},{"idx":23,"site_ref":"Merotherie","device_ref":"D00070","device_serial":"10000000701d77d9","product_type":"TW","tank_number":2,"active":true},{"idx":24,"site_ref":"Smeaton Grange","device_ref":"D00029","device_serial":"1000000074cfba9c","product_type":"TW","tank_number":2,"active":true},{"idx":25,"site_ref":"Hoppers Crossing","device_ref":"D00041","device_serial":"0000000012d44eb5","product_type":"FOAM","tank_number":1,"active":true},{"idx":26,"site_ref":"Raeburn","device_ref":"D00033","device_serial":"000000002c46d835","product_type":"CONC","tank_number":1,"active":true},{"idx":27,"site_ref":"Greenacre","device_ref":"D00046","device_serial":"0000000063a35be3","product_type":"FOAM","tank_number":1,"active":true},{"idx":28,"site_ref":"Caringbah","device_ref":"D00044","device_serial":"10000000abf2a60c","product_type":"CONC","tank_number":1,"active":true},{"idx":29,"site_ref":"Geelong","device_ref":"D00059","device_serial":"0000000074c310ab","product_type":"FOAM","tank_number":1,"active":true},{"idx":30,"site_ref":"Burleigh","device_ref":"D00022","device_serial":"0000000003c0f8c0","product_type":"CONC","tank_number":1,"active":false},{"idx":31,"site_ref":"Labrador","device_ref":"D00018","device_serial":"10000000c6da5a64","product_type":"CONC","tank_number":1,"active":true},{"idx":32,"site_ref":"Albion Park","device_ref":"D00021","device_serial":"100000003a40f952","product_type":"TW","tank_number":2,"active":true},{"idx":33,"site_ref":"Prestons","device_ref":"D00052","device_serial":"00000000bba9a972","product_type":"FOAM","tank_number":1,"active":true},{"idx":34,"site_ref":"Laverton","device_ref":"D00079","device_serial":"1000000075362940","product_type":"FOAM","tank_number":1,"active":true},{"idx":35,"site_ref":"Wollert","device_ref":"D00036","device_serial":"00000000677a7c7f","product_type":"FOAM","tank_number":1,"active":true},{"idx":36,"site_ref":"Geebung","device_ref":"D00009","device_serial":"00000000616cf95f","product_type":"CONC","tank_number":1,"active":true},{"idx":37,"site_ref":"Smeaton Grange","device_ref":"D00024","device_serial":"00000000ff9dd2ad","product_type":"FOAM","tank_number":1,"active":true},{"idx":38,"site_ref":"Thornton","device_ref":"D00080","device_serial":"0000000041b4f25f","product_type":"FOAM","tank_number":1,"active":true},{"idx":39,"site_ref":"Canning Vale","device_ref":"D00068","device_serial":"000000005acf89af","product_type":"CONC","tank_number":1,"active":true},{"idx":40,"site_ref":"East Perth","device_ref":"D00063","device_serial":"10000000232e1e7b","product_type":"CONC","tank_number":1,"active":true},{"idx":41,"site_ref":"Pendle Hill","device_ref":"D00048","device_serial":"00000000137e6dad","product_type":"TW","tank_number":2,"active":true},{"idx":42,"site_ref":"Murarrie","device_ref":"D00016","device_serial":"10000000172a90b1","product_type":"CONC","tank_number":1,"active":true},{"idx":43,"site_ref":"Coopers Plains","device_ref":"D00015","device_serial":"10000000c0e57c6f","product_type":"CONC","tank_number":1,"active":true},{"idx":44,"site_ref":"Brooklyn","device_ref":"D00039","device_serial":"1000000007aa6f18","product_type":"FOAM","tank_number":1,"active":true},{"idx":45,"site_ref":"Benowa","device_ref":"D00012","device_serial":"000000007fb4a4af","product_type":"CONC","tank_number":1,"active":true},{"idx":46,"site_ref":"Banksmeadow","device_ref":"D00027","device_serial":"00000000f6dfc0e8","product_type":"TW","tank_number":2,"active":true},{"idx":47,"site_ref":"Silverwater","device_ref":"D00026","device_serial":"00000000af688293","product_type":"FOAM","tank_number":1,"active":true},{"idx":48,"site_ref":"Tamworth","device_ref":"D00083","device_serial":"1000000034d7d8fa","product_type":"CONC","tank_number":1,"active":true},{"idx":49,"site_ref":"Burleigh","device_ref":"D00006","device_serial":"000000007ac97f59","product_type":"CONC","tank_number":1,"active":true},{"idx":50,"site_ref":"East Perth","device_ref":"D00069","device_serial":"000000003e550d48","product_type":"TW","tank_number":2,"active":true},{"idx":51,"site_ref":"Gnangara","device_ref":"D00066","device_serial":"100000000eb4ea67","product_type":"TW","tank_number":2,"active":true},{"idx":52,"site_ref":"Epping","device_ref":"D00078","device_serial":"000000008aaa2ae3","product_type":"FOAM","tank_number":1,"active":true},{"idx":53,"site_ref":"Beaudesert","device_ref":"D00085","device_serial":"0000000021a53789","product_type":"FOAM","tank_number":1,"active":true},{"idx":54,"site_ref":"Cleveland","device_ref":"D00013","device_serial":"000000009cdfa7b5","product_type":"CONC","tank_number":1,"active":true},{"idx":55,"site_ref":"Greenacre","device_ref":"D00057","device_serial":"00000000d72a11f9","product_type":"TW","tank_number":2,"active":true},{"idx":56,"site_ref":"Glendenning","device_ref":"D00030","device_serial":"000000006d8e0866","product_type":"TW","tank_number":2,"active":true},{"idx":57,"site_ref":"Epping","device_ref":"D00077","device_serial":"00000000ccff9940","product_type":"TW","tank_number":2,"active":true},{"idx":58,"site_ref":"Geelong","device_ref":"D00058","device_serial":"000000006e11f0a4","product_type":"CONC","tank_number":1,"active":true},{"idx":59,"site_ref":"Capalaba","device_ref":"D00010","device_serial":"76016100","product_type":"CONC","tank_number":1,"active":true},{"idx":60,"site_ref":"Banksmeadow","device_ref":"D00056","device_serial":"000000009b6c50f0","product_type":"FOAM","tank_number":1,"active":true},{"idx":61,"site_ref":"Prestons","device_ref":"D00031","device_serial":"0000000023a73efc","product_type":"FOAM","tank_number":1,"active":true},{"idx":62,"site_ref":"Prestons","device_ref":"D00025","device_serial":"0000000015d63586","product_type":"TW","tank_number":2,"active":true},{"idx":63,"site_ref":"Kingston","device_ref":"D00086","device_serial":"10000000fd50e8df","product_type":"FOAM","tank_number":1,"active":true},{"idx":64,"site_ref":"Oaklands Junction","device_ref":"D00076","device_serial":"000000004dc21757","product_type":"FOAM","tank_number":1,"active":true},{"idx":65,"site_ref":"Ulan","device_ref":"D00071","device_serial":"00000000bb1fd25c","product_type":"TW","tank_number":2,"active":true},{"idx":66,"site_ref":"Epping","device_ref":"D00004","device_serial":"000000005f9a19a7","product_type":"FOAM","tank_number":1,"active":true},{"idx":67,"site_ref":"Epping","device_ref":"D00002","device_serial":"00000000213ec38d","product_type":"TW","tank_number":2,"active":true},{"idx":68,"site_ref":"Clyde","device_ref":"D00001","device_serial":"10000000aa8464a1","product_type":"CONC","tank_number":1,"active":true},{"idx":69,"site_ref":"Prestons","device_ref":"D00051","device_serial":"00000000841530f3","product_type":"CONC","tank_number":1,"active":true},{"idx":70,"site_ref":"Collingwood","device_ref":"D00043","device_serial":"00000000ac518355","product_type":"FOAM","tank_number":1,"active":true},{"idx":71,"site_ref":"Caloundra","device_ref":"D00008","device_serial":"0000000041ac048f","product_type":"FOAM","tank_number":1,"active":true},{"idx":72,"site_ref":"Wacol","device_ref":"D00019","device_serial":"00000000e81bac37","product_type":"CONC","tank_number":1,"active":true},{"idx":73,"site_ref":"Rockingham","device_ref":"D00062","device_serial":"100000005d806a4f","product_type":"TW","tank_number":2,"active":true},{"idx":74,"site_ref":"Tamworth","device_ref":"D00084","device_serial":"00000000c9b5d417","product_type":"FOAM","tank_number":1,"active":true},{"idx":75,"site_ref":"Banksmeadow","device_ref":"D00049","device_serial":"000000007379574b","product_type":"CONC","tank_number":1,"active":true},{"idx":76,"site_ref":"Browns Plains","device_ref":"D00014","device_serial":"10000000137ca1d7","product_type":"CONC","tank_number":1,"active":true},{"idx":77,"site_ref":"Pinkenba","device_ref":"D00089","device_serial":"10000000a7853d34","product_type":"CONC","tank_number":1,"active":true},{"idx":78,"site_ref":"Glendenning","device_ref":"D00032","device_serial":"00000000ee4755ef","product_type":"FOAM","tank_number":1,"active":true},{"idx":79,"site_ref":"Pinkenba","device_ref":"D00090","device_serial":"10000000d10cedc0","product_type":"TW","tank_number":2,"active":true},{"idx":80,"site_ref":"Oaklands Junction","device_ref":"D00075","device_serial":"00000000bc11d216","product_type":"TW","tank_number":2,"active":true},{"idx":81,"site_ref":"Ipswich","device_ref":"D00020","device_serial":"000000007be65fca","product_type":"CONC","tank_number":1,"active":true},{"idx":82,"site_ref":"Swanbank","device_ref":"D00088","device_serial":"10000000023eacf2","product_type":"FOAM","tank_number":1,"active":true},{"idx":83,"site_ref":"Neerabup","device_ref":"D00064","device_serial":"10000000e9806236","product_type":"CONC","tank_number":1,"active":true},{"idx":84,"site_ref":"Bayswater","device_ref":"D00074","device_serial":"000000007950bead","product_type":"FOAM","tank_number":1,"active":true},{"idx":85,"site_ref":"Gnangara","device_ref":"D00067","device_serial":"00000000fd8c72a9","product_type":"CONC","tank_number":1,"active":true},{"idx":86,"site_ref":"Rockingham","device_ref":"D00061","device_serial":"100000006560f676","product_type":"CONC","tank_number":1,"active":true},{"idx":87,"site_ref":"Westall","device_ref":"D00040","device_serial":"00000000fe21c5da","product_type":"FOAM","tank_number":1,"active":true},{"idx":88,"site_ref":"Toowoomba","device_ref":"D00091","device_serial":"10000000070fef22","product_type":"TW","tank_number":2,"active":true},{"idx":89,"site_ref":"Canning Vale","device_ref":"D00060","device_serial":"00000000369c950f","product_type":"TW","tank_number":2,"active":true},{"idx":90,"site_ref":"Ulan","device_ref":"D00072","device_serial":"00000000b8febe39","product_type":"FOAM","tank_number":1,"active":true},{"idx":91,"site_ref":"Somerton","device_ref":"D00035","device_serial":"000000008423f222","product_type":"FOAM","tank_number":1,"active":true}];

// Old CMS devices: serial (normalized) -> { customer, site, status }
const CMS_DEVICES = {
  "00000000cb775d23": { customer: "HEIDELBERG MATERIALS - MELB METRO", site: "Port Melbourne", status: "Active" },
  "000000005acf89af": { customer: "HEIDELBERG MATERIALS - WA", site: "Canning Vale", status: "Active" },
  "000000000aeb1dd8": { customer: "NUCON", site: "Burleigh", status: "Active" },
  "000000007be65fca": { customer: "BORAL - QLD", site: "Ipswich", status: "Active" },
  "1000000034d7d8fa": { customer: "REGIONAL GROUP", site: "Tamworth", status: "Active" },
  "10000000c0e57c6f": { customer: "BORAL - QLD", site: "Coopers Plains", status: "Active" },
  "00000000e81bac37": { customer: "BORAL - QLD", site: "Wacol", status: "Active" },
  "00000000213ec38d": { customer: "ACM", site: "Epping", status: "Active" },
  "100000002928e370": { customer: "HEIDELBERG MATERIALS - WA", site: "Neerabup", status: "Active" },
  "1000000075362940": { customer: "HOLCIM - VIC", site: "Laverton", status: "Active" },
  "10000000023eacf2": { customer: "SUNMIX CONCRETE", site: "Swanbank", status: "Active" },
  "100000000eb4ea67": { customer: "HEIDELBERG MATERIALS - WA", site: "Gnangara", status: "Active" },
  "00000000fd8c72a9": { customer: "HEIDELBERG MATERIALS - WA", site: "Gnangara", status: "Active" },
  "000000001555fdbf": { customer: "BORAL - QLD", site: "Narangba", status: "Active" },
  "00000000841530f3": { customer: "HEIDELBERG MATERIALS - NSW", site: "Prestons", status: "Active" },
  "00000000f6dfc0e8": { customer: "GUNLAKE", site: "Banksmeadow", status: "Active" },
  "10000000e9806236": { customer: "HEIDELBERG MATERIALS - WA", site: "Neerabup", status: "Active" },
  "00000000fe66ab23": { customer: "WAGNERS", site: "Toowoomba", status: "Active" },
  "000000008423f222": { customer: "HEIDELBERG MATERIALS - MELB METRO", site: "Somerton", status: "Active" },
  "10000000c6da5a64": { customer: "BORAL - QLD", site: "Labrador", status: "Active" },
  "000000006d8e0866": { customer: "GUNLAKE", site: "Glendenning", status: "Active" },
  "000000007950bead": { customer: "HOLCIM - VIC", site: "Bayswater", status: "Active" },
  "10000000aa8464a1": { customer: "ACM", site: "Clyde", status: "Active" },
  "1000000050db9682": { customer: "HEIDELBERG MATERIALS - NSW", site: "Artarmon", status: "Active" },
  "00000000ee4755ef": { customer: "GUNLAKE", site: "Glendenning", status: "Active" },
  "00000000bf7c63d5": { customer: "GUNLAKE", site: "Silverwater", status: "Active" },
  "00000000af688293": { customer: "GUNLAKE", site: "Silverwater", status: "Active" },
  "000000004f1b279b": { customer: "BORAL - QLD", site: "Redbank", status: "Active" },
  "00000000bba9a972": { customer: "HEIDELBERG MATERIALS - NSW", site: "Prestons", status: "Active" },
  "76016100": { customer: "BORAL - QLD", site: "Capalaba", status: "Active" },
  "0000000076016100": { customer: "BORAL - QLD", site: "Capalaba", status: "Active" },
  "00000000902c2258": { customer: "HEIDELBERG MATERIALS - NSW", site: "Pendle Hill", status: "Active" },
  "00000000137e6dad": { customer: "HEIDELBERG MATERIALS - NSW", site: "Pendle Hill", status: "Active" },
  "100000003a40f952": { customer: "CLEARY BROS", site: "Albion Park", status: "Active" },
  "00000000fe21c5da": { customer: "HEIDELBERG MATERIALS - MELB METRO", site: "Westall", status: "Active" },
  "1000000007aa6f18": { customer: "HEIDELBERG MATERIALS - MELB METRO", site: "Brooklyn", status: "Active" },
  "0000000003c0f8c0": { customer: "Elora", site: "Burleigh", status: "Active" },
  "00000000616cf95f": { customer: "BORAL - QLD", site: "Geebung", status: "Active" },
  "10000000172a90b1": { customer: "BORAL - QLD", site: "Murarrie", status: "Active" },
  "00000000ff9dd2ad": { customer: "GUNLAKE", site: "Smeaton Grange", status: "Active" },
  "100000006560f676": { customer: "HEIDELBERG MATERIALS - WA", site: "Rockingham", status: "Active" },
  "10000000a10a01cf": { customer: "HEIDELBERG MATERIALS - MELB METRO", site: "Dandenong South", status: "Active" },
  "0000000015d63586": { customer: "GUNLAKE", site: "Prestons", status: "Active" },
  "0000000023a73efc": { customer: "GUNLAKE", site: "Prestons", status: "Active" },
  "1000000074cfba9c": { customer: "GUNLAKE", site: "Smeaton Grange", status: "Active" },
  "00000000ac518355": { customer: "HEIDELBERG MATERIALS - MELB METRO", site: "Collingwood", status: "Active" },
  "00000000f3d031e3": { customer: "HEIDELBERG MATERIALS - NSW", site: "Banksmeadow", status: "Active" },
  "000000006e11f0a4": { customer: "HEIDELBERG MATERIALS - VIC WEST", site: "Geelong", status: "Active" },
  "0000000012d44eb5": { customer: "HEIDELBERG MATERIALS - MELB METRO", site: "Hoppers Crossing", status: "Active" },
  "000000007379574b": { customer: "HEIDELBERG MATERIALS - NSW", site: "Banksmeadow", status: "Active" },
  "0000000041b4f25f": { customer: "HUNTER READY MIX", site: "Thornton", status: "Active" },
  "1000000049ec67d7": { customer: "---", site: "---", status: "Active" },
  "000000003e550d48": { customer: "HEIDELBERG MATERIALS - WA", site: "East Perth", status: "Active" },
  "000000005f9a19a7": { customer: "ACM", site: "Epping", status: "Active" },
  "000000009925bcd3": { customer: "BORAL - QLD", site: "Everton Park", status: "Active" },
  "000000008eea9733": { customer: "GUNLAKE", site: "Banksmeadow", status: "Active" },
  "00000000d1328278": { customer: "ACM", site: "Clyde", status: "Active" },
  "00000000bda16579": { customer: "HEIDELBERG MATERIALS - NSW", site: "Prestons", status: "Active" },
  "10000000ab856208": { customer: "SUNMIX CONCRETE", site: "Kingston", status: "Active" },
  "10000000137ca1d7": { customer: "BORAL - QLD", site: "Browns Plains", status: "Active" },
  "10000000abf2a60c": { customer: "HEIDELBERG MATERIALS - NSW", site: "Caringbah", status: "Active" },
  "000000004dc21757": { customer: "HOLCIM - VIC", site: "Oaklands Junction", status: "Active" },
  "000000005712dae3": { customer: "HEIDELBERG MATERIALS - MELB METRO", site: "Epping", status: "Active" },
  "10000000232e1e7b": { customer: "HEIDELBERG MATERIALS - WA", site: "East Perth", status: "Active" },
  "10000000fd50e8df": { customer: "SUNMIX CONCRETE", site: "Kingston", status: "Active" },
  "100000005d806a4f": { customer: "HEIDELBERG MATERIALS - WA", site: "Rockingham", status: "Active" },
  "00000000c9b5d417": { customer: "REGIONAL GROUP", site: "Tamworth", status: "Active" },
  "00000000bb1fd25c": { customer: "HOLCIM - NSW", site: "Ulan", status: "Active" },
  "00000000b8febe39": { customer: "HOLCIM - NSW", site: "Ulan", status: "Active" },
  "00000000e3f3446f": { customer: "---", site: "---", status: "Active" },
  "000000007fb4a4af": { customer: "BORAL - QLD", site: "Benowa", status: "Active" },
  "00000000aa5a9b24": { customer: "HEIDELBERG MATERIALS - NSW", site: "Greenacre", status: "Active" },
  "00000000d72a11f9": { customer: "HEIDELBERG MATERIALS - NSW", site: "Greenacre", status: "Active" },
  "0000000063a35be3": { customer: "HEIDELBERG MATERIALS - NSW", site: "Greenacre", status: "Active" },
  "0000000072d8d4f3": { customer: "BORAL - QLD", site: "Archerfield", status: "Active" },
  "10000000d10cedc0": { customer: "WAGNERS", site: "Pinkenba", status: "Active" },
  "00000000ca10ec77": { customer: "GUNLAKE", site: "Prestons", status: "Inactive" },
  "00000000ae0921b4": { customer: "---", site: "---", status: "Active" },
  "000000004d7e0c40": { customer: "---", site: "---", status: "Active" },
  "0000000074c310ab": { customer: "HEIDELBERG MATERIALS - VIC WEST", site: "Geelong", status: "Active" },
  "10000000070fef22": { customer: "WAGNERS", site: "Toowoomba", status: "Active" },
  "000000007ac97f59": { customer: "BORAL - QLD", site: "Burleigh", status: "Active" },
  "0000000010d7416c": { customer: "HEIDELBERG MATERIALS - NSW", site: "Pendle Hill", status: "Active" },
  "00000000e7c85e79": { customer: "HEIDELBERG MATERIALS - MELB METRO", site: "Croydon", status: "Active" },
  "0000000021a53789": { customer: "SUNMIX CONCRETE", site: "Beaudesert", status: "Active" },
  "10000000ebd15d96": { customer: "HUNTER READY MIX", site: "Gateshead", status: "Active" },
  "00000000db4e8993": { customer: "---", site: "---", status: "Inactive" },
  "00000000dc51295d": { customer: "REGIONAL GROUP", site: "---", status: "Inactive" },
  "000000009b6c50f0": { customer: "HEIDELBERG MATERIALS - NSW", site: "Banksmeadow", status: "Active" },
  "00000000369c950f": { customer: "HEIDELBERG MATERIALS - WA", site: "Canning Vale", status: "Active" },
  "000000008aaa2ae3": { customer: "HOLCIM - VIC", site: "Epping", status: "Active" },
  "00000000ccff9940": { customer: "HOLCIM - VIC", site: "Epping", status: "Active" },
  "000000002c46d835": { customer: "HAZELL BROS", site: "Raeburn", status: "Active" },
  "000000009cdfa7b5": { customer: "BORAL - QLD", site: "Cleveland", status: "Active" },
  "00000000677a7c7f": { customer: "HEIDELBERG MATERIALS - MELB METRO", site: "Wollert", status: "Active" },
  "10000000a7853d34": { customer: "WAGNERS", site: "Pinkenba", status: "Active" },
  "10000000701d77d9": { customer: "HOLCIM - NSW", site: "Merotherie", status: "Active" },
  "00000000d5edf745": { customer: "HOLCIM - NSW", site: "Merotherie", status: "Active" },
  "1000000095221e89": { customer: "GUNLAKE", site: "Glendenning", status: "Inactive" },
  "100000000ebec870": { customer: "HEIDELBERG MATERIALS - WA", site: "Neerabup", status: "Inactive" },
  "10000000514b1660": { customer: "BORAL - QLD", site: "Benowa", status: "Inactive" },
  "0000000041ac048f": { customer: "BORAL - QLD", site: "Caloundra", status: "Active" },
  "00000000bc11d216": { customer: "HOLCIM - VIC", site: "Oaklands Junction", status: "Active" },
};

// Generate SQL to fix device_ref in tank_configurations (run: node this-script.js --fix-device-ref-sql)
if (process.argv.includes("--fix-device-ref-sql")) {
  const fs = require("fs");
  const path = require("path");
  const lines = [
    "-- Set device_ref from canonical mapping (device_serial + tank_number).",
    "-- Run against your DB, e.g. psql $DATABASE_URL -f scripts/fix-tank-config-device-ref.sql",
    "BEGIN;",
    ...DB_CONFIGS.map((row) => {
      const serial = row.device_serial.replace(/'/g, "''");
      const ref = row.device_ref.replace(/'/g, "''");
      return `UPDATE public.tank_configurations SET device_ref = '${ref}' WHERE device_serial = '${serial}' AND tank_number = ${row.tank_number};`;
    }),
    "COMMIT;",
  ];
  const outPath = path.join(process.cwd(), "scripts", "fix-tank-config-device-ref.sql");
  fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
  console.log("Wrote " + outPath + " (" + DB_CONFIGS.length + " UPDATEs).");
  process.exit(0);
}

function norm(s) {
  if (s == null) return "";
  const t = String(s).trim().toLowerCase();
  return t;
}

function normSerial(s) {
  if (s == null) return "";
  return String(s).trim();
}

const report = { siteMismatch: [], customerMismatch: [], inactiveInCms: [], notInCms: [], ok: [] };

for (const row of DB_CONFIGS) {
  const serial = normSerial(row.device_serial);
  const cms = CMS_DEVICES[serial] || CMS_DEVICES[serial.replace(/^0+/, "")] || CMS_DEVICES["00000000" + serial] || CMS_DEVICES[serial.padStart(16, "0")];
  if (!cms) {
    report.notInCms.push({ device_serial: serial, device_ref: row.device_ref, site_ref: row.site_ref, product_type: row.product_type });
    continue;
  }
  if (cms.status === "Inactive") {
    report.inactiveInCms.push({ device_serial: serial, device_ref: row.device_ref, site_ref: row.site_ref, cms_site: cms.site, cms_customer: cms.customer, product_type: row.product_type });
    continue;
  }
  const dbSite = norm(row.site_ref);
  const cmsSite = norm(cms.site);
  const siteMatch = dbSite === cmsSite || (dbSite && cmsSite && cmsSite.includes(dbSite)) || (cmsSite && dbSite && dbSite.includes(cmsSite));
  if (!siteMatch && cms.site !== "---") {
    report.siteMismatch.push({
      device_serial: serial,
      device_ref: row.device_ref,
      db_site_ref: row.site_ref,
      cms_site: cms.site,
      cms_customer: cms.customer,
      product_type: row.product_type,
    });
  } else {
    report.ok.push({ device_serial: serial, site_ref: row.site_ref, cms_customer: cms.customer });
  }
}

console.log("=== TANK_CONFIG vs OLD CMS DEVICES — MISMATCH REPORT ===\n");

console.log("0) DEVICE REF & SERIAL VERIFICATION (New DB vs Old System):");
console.log("   Matching key: new DB device_serial = old system Computer Serial ID (computerSerialId).");
console.log("   New DB device_ref (D00001..D00092) is your internal ref; old system uses deviceRef (e.g. 20220929141003S28442).");
console.log("   All " + DB_CONFIGS.length + " new DB rows are matched by serial to the old system list below.\n");
console.log("1) SITE MISMATCH (DB site_ref != CMS Site for this device):");
console.log("   These rows cause wrong site grouping / wrong tank count per site.\n");
if (report.siteMismatch.length === 0) {
  console.log("   None.\n");
} else {
  report.siteMismatch.forEach((m) => {
    console.log(`   - Serial ${m.device_serial} (${m.device_ref}): DB site_ref="${m.db_site_ref}" | CMS Site="${m.cms_site}" | CMS Customer="${m.cms_customer}" | ${m.product_type}`);
  });
  console.log("");
}

console.log("2) DEVICE INACTIVE IN CMS (DB has active config; CMS shows Inactive):");
console.log("   Set active=false in tank_configurations for these.\n");
if (report.inactiveInCms.length === 0) {
  console.log("   None.\n");
} else {
  report.inactiveInCms.forEach((m) => {
    console.log(`   - Serial ${m.device_serial} (${m.device_ref}): DB site_ref="${m.site_ref}" | CMS ${m.cms_customer} / ${m.cms_site} | ${m.product_type}`);
  });
  console.log("");
}

console.log("3) IN DB BUT NOT IN CMS DEVICES LIST:");
console.log("   Serial not found in provided CMS export (may be new or typo).\n");
if (report.notInCms.length === 0) {
  console.log("   None.\n");
} else {
  report.notInCms.forEach((m) => {
    console.log(`   - Serial ${m.device_serial} (${m.device_ref}) site_ref="${m.site_ref}" ${m.product_type}`);
  });
  console.log("");
}

console.log("4) SUMMARY:");
console.log(`   Site mismatch: ${report.siteMismatch.length}`);
console.log(`   Inactive in CMS: ${report.inactiveInCms.length}`);
console.log(`   Not in CMS list: ${report.notInCms.length}`);
console.log(`   OK (site matches): ${report.ok.length}`);

// Epping / Banksmeadow breakdown
const eppingDb = DB_CONFIGS.filter((r) => norm(r.site_ref) === "epping");
const banksmeadowDb = DB_CONFIGS.filter((r) => norm(r.site_ref) === "banksmeadow");
console.log("\n5) EPPING in DB: " + eppingDb.length + " rows. Serials: " + eppingDb.map((r) => r.device_serial).join(", "));
eppingDb.forEach((r) => {
  const c = CMS_DEVICES[normSerial(r.device_serial)] || CMS_DEVICES["00000000" + r.device_serial];
  console.log("   - " + r.device_serial + " => CMS: " + (c ? c.customer + " / " + c.site : "not in CMS"));
});
console.log("\n6) BANKSMEADOW in DB: " + banksmeadowDb.length + " rows. Serials: " + banksmeadowDb.map((r) => r.device_serial).join(", "));
banksmeadowDb.forEach((r) => {
  const c = CMS_DEVICES[normSerial(r.device_serial)] || CMS_DEVICES["00000000" + r.device_serial];
  console.log("   - " + r.device_serial + " => CMS: " + (c ? c.customer + " / " + c.site : "not in CMS"));
});
