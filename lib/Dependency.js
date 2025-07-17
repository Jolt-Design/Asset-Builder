var _ = require('lodash');

/**
 * Dependency
 * creates an object to be consumed by external sources
 *
 * @class
 * @param {String} name
 * @param {Object} dependency dependency options object
 */
var Dependency = function (name, dependency) {
  this.type = Dependency.parseType(name);
  this.name = name;
  this.globs = [].concat(dependency.vendor || [], dependency.files || []);
};

/**
 * prependGlobs
 * Adds globs to the beginning of the Dependency's globs property
 *
 * @param {Array} files Array of glob strings
 */
Dependency.prototype.prependGlobs = function (files) {
  this.globs = [].concat(files, this.globs);
};

/**
 * parseType
 *
 * @param {String} name
 * @return {String}
 */
Dependency.parseType = (name) => _.last(name.split('.'));

module.exports = Dependency;
