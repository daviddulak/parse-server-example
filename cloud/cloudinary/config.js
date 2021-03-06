// Generated by CoffeeScript 1.6.2
(function() {
  var cloudinary_config, _;

  _ = require("./lib/underscore");

  cloudinary_config = void 0;

  module.exports = function(new_config, new_value) {
    var err;

    if (cloudinary_config === void 0 || new_config === true) {
      try {
        cloudinary_config = require('../cloudinary_config').config;
      } catch (_error) {
        err = _error;
        console.log("Couldn't find configuration file at 'cloud/cloudinary_config.js'");
        cloudinary_config = {};
      }
    }
    if (!_.isUndefined(new_value)) {
      cloudinary_config[new_config] = new_value;
    } else if (_.isString(new_config)) {
      return cloudinary_config[new_config];
    } else if (_.isObject(new_config)) {
      cloudinary_config = new_config;
    }
    return cloudinary_config;
  };

}).call(this);
