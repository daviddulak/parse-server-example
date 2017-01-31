_ = require('./cloudinary/lib/underscore.js');

_.extend(exports, require('./cloudinary/sign.js'));
exports.config = require('./cloudinary/config.js');
