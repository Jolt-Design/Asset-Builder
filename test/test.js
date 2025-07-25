var chai = require('chai');
var assert = chai.assert;
var fs = require('node:fs');
var m = require('../index');
var readManifest = require('../lib/readManifest');
var processManifest = require('../lib/processManifest');
var buildGlobs = require('../lib/buildGlobs');
var Dependency = require('../lib/Dependency');
var Q = require('q');
var { mkdirp } = require('mkdirp');
var _ = require('lodash');
var path = require('node:path');

var bower = null;

try {
  bower = require('bower');
} catch (e) {
  if (!(e instanceof Error) || e.code !== 'MODULE_NOT_FOUND') {
    throw e;
  }
}

function normalizeAll(files) {
  return _.map(files, (f) => path.normalize(f));
}

function bowerSetup(bowerJson) {
  if (!bower) {
    return Q.resolve();
  }

  bowerJson = bowerJson || 'bower.json';
  var deferred = Q.defer();
  fs.writeFileSync(
    'test/tmp/bower.json',
    fs.readFileSync(`test/fixtures/${bowerJson}`),
  );
  bower.commands.prune().on('end', () => {
    bower.commands.install(null, null, { cwd: 'test/tmp/' }).on('end', () => {
      deferred.resolve();
    });
  });
  return deferred.promise;
}

describe('JSON Reading and Parsing', () => {
  it('should throw an error if the manifest cannot be found', () => {
    assert.throws(() => {
      readManifest('totally/bogus/file.json');
    }, Error);
  });
  it('should throw an error if the manifest is not valid JSON', () => {
    assert.throws(() => {
      readManifest('test/fixtures/invalid.json');
    }, SyntaxError);
  });
  it('should return an object if JSON is valid', () => {
    assert.isObject(readManifest('test/fixtures/manifest-v1.json'));
  });
});

describe('Processing the Manifest', () => {
  var manifest;
  it('should throw an error if the json file is missing the "dependencies" property', () => {
    assert.throws(
      () => {
        manifest = processManifest(
          readManifest('test/fixtures/manifest-missing.json'),
        );
      },
      Error,
      'Manifest File Error: missing',
    );
  });
  it('should throw an error if the json file is not a plain object', () => {
    assert.throws(
      () => {
        manifest = processManifest([{ lol: 'not valid' }]);
      },
      Error,
      'Manifest File Error: file seems',
    );
  });
  it('should turn all "files" strings into arrays', () => {
    manifest = processManifest(
      readManifest('test/fixtures/manifest-mixed.json'),
    );
    assert.isArray(manifest.dependencies['app.css'].files);
    assert.isArray(manifest.dependencies['home.js'].files);
  });
  it('should append the source dir to all files arrays except external', () => {
    manifest = processManifest(readManifest('test/fixtures/manifest-v1.json'));
    assert.equal(
      manifest.dependencies['app.css'].files[0],
      'assets/styles/main.less',
    );
    assert.equal(
      manifest.dependencies['noappend.js'].files[0],
      '../themedir/home.js',
    );
  });
});

describe('Dependency', () => {
  var dep = new Dependency('app.js', {
    vendor: ['test.js'],
    files: ['test1.js'],
  });
  var depBare = new Dependency('app.css', {});
  var depVendor = new Dependency('app.js', {
    vendor: ['assets/vendor1.js', 'assets/vendor2.js'],
    files: ['firstparty1.js', 'firstparty2.js'],
  });
  it('should set properties correctly', () => {
    assert.equal(dep.type, 'js');
    assert.equal(depBare.type, 'css');
    assert.sameMembers(dep.globs, ['test.js', 'test1.js']);
    assert.sameMembers(depBare.globs, []);
  });
  it('should put globs in order', () => {
    assert.equal(dep.globs[0], 'test.js');
    assert.equal(dep.globs[1], 'test1.js');
    assert.equal(depVendor.globs[0], 'assets/vendor1.js');
    assert.equal(depVendor.globs[1], 'assets/vendor2.js');
    assert.equal(depVendor.globs[2], 'firstparty1.js');
    assert.equal(depVendor.globs[3], 'firstparty2.js');
  });
  it('should prependGlobs correctly', () => {
    dep.prependGlobs('new.js');
    assert.sameMembers(dep.globs, ['new.js', 'test.js', 'test1.js']);
  });
  it('should parse the type correctly', () => {
    assert.equal(Dependency.parseType('app.css'), 'css');
    assert.equal(Dependency.parseType('app.js'), 'js');
    assert.equal(Dependency.parseType('app.min.1.11.1.js'), 'js');
  });
});

describe('Glob building', () => {
  var manifest;
  var mockBowerFiles = require('./fixtures/sampleMainBowerFiles.json').files;
  mockBowerFiles = normalizeAll(mockBowerFiles);
  var mockTypesFiles = require('./fixtures/types.json').files;
  mockTypesFiles = normalizeAll(mockTypesFiles);
  var globInstance = new buildGlobs(manifest, mockBowerFiles);
  describe('filtering by package', () => {
    it('should get particular package files by string', () => {
      var jq = buildGlobs.prototype.filterByPackage(mockBowerFiles, 'jquery');
      assert.isArray(jq);
      assert.sameMembers(jq, [
        path.normalize('/asset-builder/bower_components/jquery/dist/jquery.js'),
      ]);
    });
    it('should get particular package files by array', () => {
      var jq = buildGlobs.prototype.filterByPackage(mockBowerFiles, ['jquery']);
      assert.isArray(jq);
      assert.sameMembers(jq, [
        path.normalize('/asset-builder/bower_components/jquery/dist/jquery.js'),
      ]);
    });
  });

  describe('rejecting by package', () => {
    it('should return everything except specified packages', () => {
      var rejected = buildGlobs.prototype.rejectByPackage(
        normalizeAll([
          '/bogus/bower_components/jquery/main.js',
          '/bogus/bower_components/mootools/main.js',
        ]),
        ['jquery'],
      );
      assert.sameMembers(
        rejected,
        normalizeAll(['/bogus/bower_components/mootools/main.js']),
      );
    });
  });

  describe('filtering by type', () => {
    it('should get fonts', () => {
      assert.sameMembers(
        globInstance.filterByType(mockBowerFiles, 'fonts'),
        normalizeAll([
          '/asset-builder/bower_components/bootstrap/fonts/glyphicons-halflings-regular.eot',
          '/asset-builder/bower_components/bootstrap/fonts/glyphicons-halflings-regular.svg',
          '/asset-builder/bower_components/bootstrap/fonts/glyphicons-halflings-regular.ttf',
          '/asset-builder/bower_components/bootstrap/fonts/glyphicons-halflings-regular.woff',
        ]),
      );
    });
    it('should get images', () => {
      assert.sameMembers(
        globInstance.filterByType(mockBowerFiles, 'images'),
        normalizeAll([
          '/Some/Path/images/imagesGIF.gif',
          '/Some/Path/images/imagesPNG.png',
          '/Some/Path/images/imagesJPG.jpg',
        ]),
      );
    });
    it('should match woff2', () => {
      assert.sameMembers(
        globInstance.filterByType(mockTypesFiles, 'fonts'),
        normalizeAll([
          '/asset-builder/bower_components/bootstrap/fonts/glyphicons-halflings-regular.eot',
          '/asset-builder/bower_components/bootstrap/fonts/glyphicons-halflings-regular.svg',
          '/asset-builder/bower_components/bootstrap/fonts/glyphicons-halflings-regular.ttf',
          '/asset-builder/bower_components/bootstrap/fonts/glyphicons-halflings-regular.woff',
          '/asset-builder/bower_components/bootstrap/fonts/glyphicons-halflings-regular.woff2',
          '/asset-builder/bower_components/bootstrap/fonts/glyphicons-halflings-regular.otf',
        ]),
      );
    });
    it('should get javascript', () => {
      assert.sameMembers(
        globInstance.filterByType(mockBowerFiles, 'js'),
        normalizeAll([
          '/asset-builder/bower_components/jquery/dist/jquery.js',
          '/asset-builder/bower_components/bootstrap/js/transition.js',
          '/asset-builder/bower_components/bootstrap/js/alert.js',
          '/asset-builder/bower_components/bootstrap/js/button.js',
          '/asset-builder/bower_components/bootstrap/js/carousel.js',
          '/asset-builder/bower_components/bootstrap/js/collapse.js',
          '/asset-builder/bower_components/bootstrap/js/dropdown.js',
          '/asset-builder/bower_components/bootstrap/js/modal.js',
          '/asset-builder/bower_components/bootstrap/js/tooltip.js',
          '/asset-builder/bower_components/bootstrap/js/popover.js',
          '/asset-builder/bower_components/bootstrap/js/scrollspy.js',
          '/asset-builder/bower_components/bootstrap/js/tab.js',
          '/asset-builder/bower_components/bootstrap/js/affix.js',
        ]),
      );
    });
    it('should get css', () => {
      assert.sameMembers(
        globInstance.filterByType(mockBowerFiles, 'css'),
        normalizeAll([
          '/asset-builder/bower_components/bootstrap/bogus/file.css',
        ]),
      );
    });
  });

  describe('output globs', () => {
    var dependencies = {
      'app.js': {
        files: ['path/to/script.js'],
      },
      fonts: {
        files: ['font/path/*'],
      },
      images: {
        files: ['image/path/*'],
      },
    };
    var bower = [
      '/lol/fonts/test.woff',
      '/lol/fonts/test.woff2',
      '/lol/images/imageJPG.jpg',
      '/lol/images/imagePNG.png',
      '/lol/images/imageGIF.gif',
    ];
    it('should output a fonts glob', () => {
      assert.sameMembers(new buildGlobs(dependencies, bower).globs.fonts, [
        'font/path/*',
        '/lol/fonts/test.woff',
        '/lol/fonts/test.woff2',
      ]);
    });
    it('should output an images glob', () => {
      assert.sameMembers(new buildGlobs(dependencies, bower).globs.images, [
        'image/path/*',
        '/lol/images/imageJPG.jpg',
        '/lol/images/imagePNG.png',
        '/lol/images/imageGIF.gif',
      ]);
    });
    it('should output a bower glob', () => {
      assert.sameMembers(
        new buildGlobs(dependencies, bower).globs.bower,
        bower,
      );
    });
  });

  describe('excluded bower dependencies from main', () => {
    it('should build a list of bower packages to exclude', () => {
      var deps = {
        'random.js': {
          bower: ['jquery'],
        },
        'other.js': {
          bower: ['bootstrap', 'bogus'],
        },
      };
      var exclude = buildGlobs.prototype.bowerExclude(deps);
      assert.sameMembers(exclude, ['jquery', 'bootstrap', 'bogus']);
    });
  });

  describe('getting output files', () => {
    var mockBower = normalizeAll([
      '/asset-builder/bower_components/jquery/dist/jquery.js',
      '/asset-builder/bower_components/bootstrap/js/transition.js',
      '/asset-builder/bower_components/bootstrap/js/alert.js',
    ]);
    it('should add bower deps to the main dependency', () => {
      var expected = [
        {
          type: 'js',
          name: 'app.js',
          globs: [].concat(mockBower, ['path/to/script.js']),
        },
      ];
      var actual = buildGlobs.prototype.getOutputFiles(
        'js',
        {
          'app.js': {
            files: ['path/to/script.js'],
            main: true,
          },
        },
        mockBower,
      );
      assert.sameMembers(actual[0].globs, expected[0].globs);
    });
    it('should add everything except jquery if defined elsewhere', () => {
      var expected = [
        {
          type: 'js',
          name: 'app.js',
          globs: [
            path.normalize(
              '/asset-builder/bower_components/bootstrap/js/transition.js',
            ),
            path.normalize(
              '/asset-builder/bower_components/bootstrap/js/alert.js',
            ),
            'path/to/script.js',
          ],
        },
        {
          type: 'js',
          name: 'jquery.js',
          globs: [
            path.normalize(
              '/asset-builder/bower_components/jquery/dist/jquery.js',
            ),
          ],
        },
      ];
      var actual = buildGlobs.prototype.getOutputFiles(
        'js',
        {
          'app.js': {
            files: ['path/to/script.js'],
            main: true,
          },
          'jquery.js': {
            bower: ['jquery'],
          },
        },
        mockBower,
      );
      assert.sameMembers(
        actual[0].globs,
        expected[0].globs,
        'app.js not the same',
      );
      assert.sameMembers(
        actual[1].globs,
        expected[1].globs,
        'jquery not the same',
      );
    });
  });
});

describe('Integration Tests', () => {
  describe('manifests', () => {
    beforeEach(function (done) {
      this.timeout(30e3);
      mkdirp('test/tmp').then(() => {
        bowerSetup().then(() => {
          done();
        });
      });
    });

    describe('sage manifest', () => {
      it('default sage manifest', () => {
        var output = m('test/fixtures/sage.json', {
          paths: {
            bowerDirectory: 'test/tmp/bower_components',
            bowerJson: 'test/tmp/bower.json',
          },
        });

        assert.lengthOf(output.globs.js, 3);
        assert.lengthOf(output.globs.css, 1);

        // app.css
        assert.equal(output.globs.css[0].type, 'css');
        assert.equal(output.globs.css[0].name, 'app.css');
        assert.lengthOf(output.globs.css[0].globs, 1);
        assert.include(output.globs.css[0].globs[0], 'main.less');

        // app.js
        assert.equal(output.globs.js[0].type, 'js');
        assert.equal(output.globs.js[0].name, 'app.js');
        assert.include(output.globs.js[0].globs, 'assets/scripts/**/*');
        _.forEach(output.globs.js[0].globs, (s) => {
          assert.notInclude(s, 'jquery');
          assert.notInclude(s, 'modernizr');
        });

        // jquery.js
        assert.equal(output.globs.js[1].type, 'js');
        assert.equal(output.globs.js[1].name, 'jquery.js');

        if (bower) {
          assert.lengthOf(output.globs.js[1].globs, 1);
          assert.include(output.globs.js[1].globs[0], 'jquery.js');
        }

        // modernizr.js
        assert.equal(output.globs.js[2].type, 'js');
        assert.equal(output.globs.js[2].name, 'modernizr.js');

        if (bower) {
          assert.lengthOf(output.globs.js[2].globs, 1);
          assert.include(output.globs.js[2].globs[0], 'modernizr.js');
        }

        // has images
        assert.sameMembers(output.globs.images, ['assets/images/**/*']);
      });
    });

    describe('extremely verbose manifest', () => {
      it('extremely verbose manifest', () => {
        var output = m('test/fixtures/verbose.json', {
          paths: {
            bowerDirectory: 'test/tmp/bower_components',
            bowerJson: 'test/tmp/bower.json',
          },
        });

        var globs = output.globs;

        assert.sameMembers(_.find(globs.js, { name: 'external.js' }).globs, [
          '../../noappend.js',
        ]);

        assert.sameMembers(_.find(globs.js, { name: 'vendor.js' }).globs, [
          '../../plugin/script.js',
          'assets/scripts/somescript.js',
        ]);

        assert.equal(
          _.find(globs.js, { name: 'vendor.js' }).globs[0],
          '../../plugin/script.js',
        );
        assert.equal(
          _.find(globs.js, { name: 'vendor.js' }).globs[1],
          'assets/scripts/somescript.js',
        );
      });
    });
  });
});

describe('convenience methods', () => {
  describe('getProjectGlobs', () => {
    it('should return project JS', () => {
      var proj = m.Manifest.prototype.getProjectGlobs.call({
        dependencies: {
          'app.js': {
            files: ['app.js', 'script.js'],
          },
          'cool.js': {
            files: ['cool1.js', 'cool2.js'],
          },
        },
      });
      assert.isArray(proj.js);
      assert.sameMembers(proj.js, [
        'app.js',
        'script.js',
        'cool1.js',
        'cool2.js',
      ]);
    });
    it('should return project CSS', () => {
      var proj = m.Manifest.prototype.getProjectGlobs.call({
        dependencies: {
          'app.css': {
            files: ['app.less', 'styles.scss'],
          },
        },
      });
      assert.sameMembers(proj.css, ['app.less', 'styles.scss']);
    });
  });
  describe('getDependency', () => {
    var globs = {
      globs: {
        css: [
          { type: 'css', name: 'main.css', globs: [] },
          { type: 'css', name: 'editor-style.css', globs: [] },
        ],
        js: [
          {
            type: 'js',
            name: 'script.js',
            globs: ['class.js', 'important.js'],
          },
          {
            type: 'js',
            name: 'test.js',
            globs: ['class.js', 'important.js'],
          },
        ],
      },
    };
    it('should get a css dependency by name', () => {
      var css = m.Manifest.prototype.getDependencyByName.call(
        globs,
        'main.css',
      );
      var js = m.Manifest.prototype.getDependencyByName.call(globs, 'test.js');
      assert.equal('main.css', css.name);
      assert.equal('test.js', js.name);
    });
  });
  describe('foreach dep', () => {
    it('should loop through the dependencies', () => {
      var count = 0;
      m.Manifest.prototype.forEachDependency.call(
        {
          globs: {
            js: [
              {
                type: 'js',
                name: 'script.js',
                globs: ['class.js', 'important.js'],
              },
              {
                type: 'js',
                name: 'test.js',
                globs: ['class.js', 'important.js'],
              },
            ],
          },
        },
        'js',
        (value) => {
          count += 1;
          assert.equal(value.type, 'js');
          assert.sameMembers(value.globs, ['class.js', 'important.js']);
        },
      );
      assert.equal(count, 2);
    });
  });
});
