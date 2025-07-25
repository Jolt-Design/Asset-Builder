var _ = require('lodash');
var readManifest = require('./readManifest');
var processManifest = require('./processManifest');
var BuildGlobs = require('./buildGlobs');
var Dependency = require('./Dependency');

var mainBowerFiles = null;

try {
  mainBowerFiles = require('main-bower-files');
} catch (e) {
  if (!(e instanceof Error) || e.code !== 'MODULE_NOT_FOUND') {
    throw e;
  }
}

/**
 * Manifest
 *
 * @class
 * @param {String} path File path to the manifest JSON file
 * @param {Object} options
 * @property {Object} config the original config from the manifest JSON file
 * @property {Object} dependencies the original dependencies property from the manifest JSON file
 * @property {Object} globs [see buildGlobs.globs property]{@link module:lib/buildGlobs~buildGlobs}
 * @property {Object} paths
 * @property {Object} paths.source the path to the asset source directory. Includes a trailing slash.
 * @property {Object} paths.dist path to the build directory. Includes a trailing slash.
 */
var Manifest = function (path, options) {
  var manifest = processManifest(readManifest(path));
  var bower = [];

  if (mainBowerFiles) {
    bower = mainBowerFiles(_.pick(options, ['paths']));
  }

  this.config = manifest.config;
  this.dependencies = manifest.dependencies;
  this.globs = new BuildGlobs(manifest.dependencies, bower, options).globs;
  this.paths = manifest.paths;
};

/**
 * forEachDependency
 * loops through the dependencies of the specified type and calls the callback for each dependency.
 *
 * @param {String} type The type of dependencies you want to loop through. These can be
 * @param {Function} callback Callback called per iteration with the arguments (value, index|key, collection)
 * @see {@link https://lodash.com/docs#forEach}
 */
Manifest.prototype.forEachDependency = function (type, callback) {
  _.forEach(this.globs[type], callback);
};

/**
 * getDependency
 *
 * @param {String} name
 * @return {Object}
 */
Manifest.prototype.getDependencyByName = function (name) {
  return _.find([].concat(this.globs.js, this.globs.css), { name: name });
};

/**
 * getProjectGlobs
 * gets
 *
 * @return {Object} returns an object with properties corresponding to
 * @example
 * // if you had a manifest with a dependencies property that looked like:
 * {
 *   "app.js": {
 *     files: [ "scripts/main.js" ],
 *     vendor: [ "vendor/hello-world.js" ]
 *   }
 *   "app.css": {
 *     files: [ "styles/main.css" ],
 *     vendor: [ "vendor/hello-world.css" ]
 *   }
 * }
 * // then
 * manifest.getProjectGlobs();
 * // will output
 * {
 *   "js": [
 *     "scripts/main.js"
 *   ],
 *   "css": [
 *     "styles/main.css"
 *   ]
 * }
 */
Manifest.prototype.getProjectGlobs = function () {
  return _.reduce(
    this.dependencies,
    (result, dep, key) => {
      var type = Dependency.parseType(key);
      if (!_.isArray(result[type])) {
        result[type] = [];
      }
      result[type] = result[type].concat(dep.files);
      return result;
    },
    {},
  );
};

module.exports = Manifest;
