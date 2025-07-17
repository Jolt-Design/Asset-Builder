var fs = require('node:fs');
var p = require('node:path');

/**
 * readManifest
 * Converts the manifest JSON file to an object
 *
 * @private
 * @param {String} path path to the manifest file
 * @return {Object} The contents of the JSON file
 */
module.exports = (path) =>
  JSON.parse(fs.readFileSync(p.normalize(path), 'utf8'));
