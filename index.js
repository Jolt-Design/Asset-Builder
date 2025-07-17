var Manifest = require('./lib/Manifest.js');

/**
 * Create an instance of [Manifest]{@link module:lib/Manifest~Manifest}
 *
 * @see [Manifest]{@link module:lib/Manifest~Manifest}
 * @param {String} path File path to the manifest JSON file
 * @param {Object} options
 * @return {Manifest}
 */
module.exports = (path, options) => new Manifest(path, options);

/**
 * The Manifest constructor
 * @see [Manifest]{@link module:lib/Manifest~Manifest}
 */
module.exports.Manifest = Manifest;
