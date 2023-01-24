/* BUILD ALL THE THINGS */

/*global jake, task, desc, namespace, file */
var {
    task, desc, namespace,
    directory,
    rmRf,
    packageTask
} = require('jake');

var fs   = require('fs'),
    path = require('path'),
    uglify  = require('uglify-js');

var template = require( './js/lib/underscore.templates.js' ).template;

var ENC = 'utf-8',
    ROOT        = './',
    BUILD_DIR   = path.join(ROOT, './build');

var SRC = {
    service : path.join(ROOT, 'js/service.js'),
    popup   : path.join(ROOT, 'js/popup.js'),
    tpls    : [
        '_compiled.js'
    ]
};

var BUILD = {
    service : path.join(BUILD_DIR, 'service.min.js'),
    popup   : path.join(BUILD_DIR, 'popup.min.js'),
    tpl     : path.join(BUILD_DIR, 'templates.min.js')
};

;(function fill() {
    SRC.tpls = SRC.tpls
        .concat( fs
                .readdirSync( path.join(ROOT, './tpl') )
                .filter( function(fileName) {
                    return (/\.ejs$/).test(fileName);
                } )
         )
        .map(function(fileName) {
            return path.join(ROOT, './tpl', fileName);
        });
})();

// utilities
function size (filepath) {
    if ( !fs.existsSync(filepath) ) return 'N/A';
    var fsize = fs.statSync(filepath).size;
    return (fsize < 1024) ? fsize + 'B' : ~~(fsize / 1024) + 'KB';
}
// minifies passed JS file
// if no resultpath was passed, overwrites the source file
function minify (sourcepath, resultpath) {
    var compressed,
        sourceSize = size(sourcepath);

    compressed = uglify.minify(fs.readFileSync(sourcepath, ENC));

    fs.writeFileSync(resultpath || sourcepath, compressed.code);
    console.log('Minified:', sourcepath, sourceSize, size(resultpath || sourcepath));
}

directory( BUILD_DIR );

namespace('js', function() {
    desc('Minify service');
    file(BUILD.service, [SRC.service], function() {
        minify(SRC.service, BUILD.service);
    });

    desc('Minify popup');
    file(BUILD.popup, [SRC.popup], function() {
        minify(SRC.popup, BUILD.popup);
    });

    desc('Clean JavaScript');
    task('clean', function() {
        [ BUILD.service, BUILD.popup ].forEach(function(filepath) {
            if ( fs.existsSync(filepath) ) {
                fs.unlinkSync(filepath);
                console.log('Removed:', filepath);
            }
        });
    });

    desc('Build JavaScript');
    task('default', [
        BUILD_DIR,
        `js:${BUILD.service}`,
        `js:${BUILD.popup}`
    ], function() {
        console.log('Finished building JavaScript');
    });
});

namespace('tpl', function() {
    desc('Compile and minify templates');
    file(BUILD.tpl, [...SRC.tpls, BUILD_DIR], function() {
        var compiled = {},
            meta = SRC.tpls.shift(),
            result = template( fs.readFileSync(meta, ENC) );

        SRC.tpls.forEach(function(fullpath) {
            var fileName = path.basename(fullpath),
                content = fs.readFileSync(fullpath, ENC);

            compiled[fileName] = template(content, null, { variable: 'tplData' }).source;
        });

        result = result({ compiled: compiled });
        fs.writeFileSync(BUILD.tpl, result, ENC);
        console.log('Compiled %s templates %s', SRC.tpls.length, size(BUILD.tpl));

        minify(BUILD.tpl);
    });

    desc('Clean templates');
    task('clean', function() {
        [ BUILD.tpl ].forEach(function(filepath) {
            if ( !fs.existsSync(filepath) ) return
            fs.unlinkSync(filepath);
            console.log('Removed:', filepath);
        });
    });
});

desc('Build all');
task('default', [
     'js:default',
     `tpl:${BUILD.tpl}`
]);

desc('Clean all');
task('clean', ['js:clean', 'tpl:clean', 'clobber'], function() {
    var remains = fs.readdirSync(BUILD_DIR);
    // directory itself is always the 1st item
    remains.shift();
    if (remains.length) {
        console.log( 'Orphanes in %s:\n %s', BUILD_DIR, remains.join('\n ') );
    }
    rmRf( BUILD_DIR );
    console.log('Cleaned');
});

// Package it up for Webstore
var manifest = JSON.parse(fs.readFileSync('manifest.json', ENC)),
    pkgName = manifest.name.replace(/ /g, '-').toLowerCase();

packageTask(pkgName, manifest.version, ['default'], function () {
  var fileList = [
      'manifest.json',
      'build/*',
      'img/**',
      'popup.html'
  ];
  this.packageFiles.include(fileList);
  this.needZip = true;
});
