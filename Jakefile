/* BUILD ALL THE THINGS */

/*jshint evil: true, node: true */
/*global task, desc, namespace, file, complete */

var fs   = require('fs'),
    path = require('path'),
    Lazy = require('lazy'),
    jsp  = require('uglify-js').parser,
    pro  = require('uglify-js').uglify,
    _    = require('underscore');

var ENC         = 'utf-8';

var ROOT        = path.join('.', './'),
    BUILD_DIR   = path.join(ROOT, './build');

var SRC = {
    service : path.join(ROOT, 'js/service.js'),
    _       : path.join(ROOT, 'lib/underscore.js'),
    tpls    : [
        './tpl/_compiled.js'
    ]
},
    BUILD = {
    service : path.join(BUILD_DIR, 'service.min.js'),
    _       : path.join(BUILD_DIR, 'underscore.min.js'),
    tpl     : path.join(BUILD_DIR, 'templates.js')
};

;(function fill() {
    SRC.tpls = SRC.tpls.concat(
        fs
            .readdirSync( path.join(ROOT, './tpl') )
            .filter(function(file) {
                return /\.ejs$/.test(file);
            })
            .map(function(fileName) {
                return path.join('./tpl', fileName)
            })
    );
})();

// utilities
function size (filepath) {
    if ( !fs.existsSync(filepath) ) return 'N/A';
    var fsize = fs.statSync(filepath).size;
    return (fsize < 1024) ? fsize + 'B' : ~~(fsize / 1024) + 'KB';
}

// create BUILD_DIR folder if there is none
if (!fs.existsSync(BUILD_DIR)) fs.mkdirSync(BUILD_DIR, 0755);

namespace('js', function() {
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

    desc('Minify service');
    file(BUILD.service, [SRC.service], function() {
        minify(SRC.service, BUILD.service);
    });

    desc('Minify _');
    file(BUILD._, [SRC._], function() {
        minify(SRC._, BUILD._);
    });

    desc('Clean JavaScript');
    task('clean', function() {
        [ BUILD.service, BUILD._ ].forEach(function(filepath) {
            if ( fs.existsSync(filepath) ) {
                fs.unlinkSync(filepath);
                console.log('Removed:', filepath);
            }
        });
    });
});

namespace('templates', function() {
    desc('Compile templates');
    file(BUILD.tpl, SRC.tpls, function() {
        var compiled = {},
            // this is file we're gonna generate compiled templates into
            // it's itself and underscore template, yo dawg
            result = _.template( fs.readFileSync(SRC.tpls[0], ENC) );

        SRC.tpls.forEach(function(fullpath) {
            var fileName = path.basename(fullpath),
                content = fs.readFileSync(fullpath, ENC);

            compiled[fileName] = _.template(content).source;
        });

        result = result({ compiled: compiled });
        fs.writeFileSync(BUILD.tpl, result, ENC);

        console.log('Compiled %s templates %s', SRC.tpls.length, size(BUILD.tpl));
    });
});

desc('Build all');
task({ 'default': [
     'js:'        + BUILD.service,
     'js:'        + BUILD._
] }, function() {
    console.log('Build completed');
});

desc('Clean all');
task({ 'clean': ['js:clean', 'templates:clean'] }, function() {
    console.log('Cleaned');
});
