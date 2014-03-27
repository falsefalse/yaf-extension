/* BUILD ALL THE THINGS */

/*global jake, task, desc, namespace, file */

var fs   = require('fs'),
    path = require('path'),
    jsp  = require('uglify-js').parser,
    pro  = require('uglify-js').uglify;

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
    var compressed, ast,
        source = fs.readFileSync(sourcepath, ENC),
        sourceSize = size(sourcepath);

    ast = jsp.parse(source);
    ast = pro.ast_mangle(ast);
    ast = pro.ast_squeeze(ast);
    compressed = pro.gen_code(ast);

    fs.writeFileSync(resultpath || sourcepath, compressed);
    console.log('Minified:', sourcepath, sourceSize, size(resultpath || sourcepath));
}

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
    task({ 'default': [
         'js:' + BUILD.service,
         'js:' + BUILD.popup
    ] }, function() {
        console.log('Finished building JavaScript');
    });
});

namespace('tpl', function() {
    desc('Compile and minify templates');
    file(BUILD.tpl, SRC.tpls, function() {
        var compiled = {},
            meta = SRC.tpls.shift(),
            result = template( fs.readFileSync(meta, ENC) );

        SRC.tpls.forEach(function(fullpath) {
            var fileName = path.basename(fullpath),
                content = fs.readFileSync(fullpath, ENC);

            compiled[fileName] = template(content).source;
        });

        result = result({ compiled: compiled });
        fs.writeFileSync(BUILD.tpl, result, ENC);
        console.log('Compiled %s templates %s', SRC.tpls.length, size(BUILD.tpl));

        minify(BUILD.tpl);
    });

    desc('Clean templates');
    task('clean', function() {
        [ BUILD.tpl ].forEach(function(filepath) {
            if ( fs.existsSync(filepath) ) {
                fs.unlinkSync(filepath);
                console.log('Removed:', filepath);
            }
        });
    });
});

// ensure BUILD_DIR directory is there
jake.mkdirP( BUILD_DIR );

desc('Build all');
task({ 'default': [
     'js:default',
     'tpl:' + BUILD.tpl
] }, function() {
    console.log('Build completed');
});

desc('Clean all');
task({ 'clean': ['js:clean', 'tpl:clean'] }, function() {
    var remains = jake.readdirR(BUILD_DIR);
    // directory itself is always the 1st item
    remains.shift();
    if (remains.length) {
        console.log( 'Orphanes in %s:\n %s', BUILD_DIR, remains.join('\n ') );
    }
    jake.rmRf( BUILD_DIR );
    console.log('Cleaned');
});

// Package the shit
var manifest = JSON.parse(fs.readFileSync('manifest.json', ENC)),
    pkgName = manifest.name.replace(/ /g, '-').toLowerCase();
new jake.PackageTask(pkgName, manifest.version, function () {
    var fileList = [
        'manifest.json',
        'build/*',
        'img/**',
        'popup.html'
    ];
    this.packageFiles.include(fileList);
    this.needZip = true;
});
