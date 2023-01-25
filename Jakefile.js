/* eslint-env node */

/* BUILD ALL THE THINGS */

const {
  namespace,
  desc,
  task,
  file,
  packageTask,
  directory,
  rmRf
} = require('jake')

const fs = require('fs')
const path = require('path')
const uglify = require('uglify-js')
const template = require('lodash.template')

const ENC = 'utf-8'
const ROOT = './'
const BUILD_DIR = path.join(ROOT, './build')

const TEMPLATES_DIR = path.join(ROOT, './src/templates')

const SRC = {
  service: path.join(ROOT, 'src/service.js'),
  popup: path.join(ROOT, 'src/popup.js'),
  // gets expanded in `readEjs` with others
  templates: ['index.ejs.js']
}

const BUILD = {
  service: path.join(BUILD_DIR, 'service.js'),
  popup: path.join(BUILD_DIR, 'popup.js'),
  templates: path.join(BUILD_DIR, 'templates.js')
}

;(function readEjs() {
  SRC.templates = [
    ...SRC.templates,
    ...fs.readdirSync(TEMPLATES_DIR).filter(name => /\.ejs$/.test(name))
  ].map(name => path.join(TEMPLATES_DIR, name))
})()

// utilities
function size(filepath) {
  if (!fs.existsSync(filepath)) return 'N/A'
  const fsize = fs.statSync(filepath).size
  return fsize < 1024 ? fsize + 'B' : ~~(fsize / 1024) + 'KB'
}
// minifies passed JS file
// if no resultpath was passed, overwrites the source file
function minify(sourcepath, resultpath) {
  const sourceSize = size(sourcepath)
  resultpath = resultpath || sourcepath

  const { code } = uglify.minify(fs.readFileSync(sourcepath, ENC))

  fs.writeFileSync(resultpath, code)
  console.log('Minified:', sourcepath, sourceSize, '→', size(resultpath))
}

directory(BUILD_DIR)

namespace('js', function () {
  desc('Minify service')
  file(BUILD.service, [SRC.service], function () {
    minify(SRC.service, BUILD.service)
  })

  desc('Minify popup')
  file(BUILD.popup, [SRC.popup], function () {
    minify(SRC.popup, BUILD.popup)
  })

  desc('Clean JavaScript')
  task('clean', function () {
    ;[BUILD.service, BUILD.popup].forEach(function (filepath) {
      if (!fs.existsSync(filepath)) return

      fs.unlinkSync(filepath)
      console.log('Removed:', filepath)
    })
  })

  desc('Build JavaScript')
  task(
    'default',
    [BUILD_DIR, `js:${BUILD.service}`, `js:${BUILD.popup}`],
    function () {
      console.log('Finished building JavaScript')
    }
  )
})

namespace('tpl', function () {
  desc('Compile and minify templates')
  file(BUILD.templates, [...SRC.templates, BUILD_DIR], function () {
    const compiled = {}
    const meta = SRC.templates.shift()
    let result = template(fs.readFileSync(meta, ENC))

    SRC.templates.forEach(function (fullpath) {
      const fileName = path.basename(fullpath)
      const content = fs.readFileSync(fullpath, ENC)

      compiled[fileName] = template(content, { variable: 'locals' }).source
    })

    result = result({ compiled })
    fs.writeFileSync(BUILD.templates, result, ENC)
    console.log(
      'Compiled %s templates → %s',
      SRC.templates.length,
      size(BUILD.templates)
    )

    minify(BUILD.templates)
  })

  desc('Clean templates')
  task('clean', function () {
    ;[BUILD.templates].forEach(function (filepath) {
      if (!fs.existsSync(filepath)) return
      fs.unlinkSync(filepath)
      console.log('Removed:', filepath)
    })
  })
})

desc('Compile')
task('compile', [BUILD_DIR, 'js:default', `tpl:${BUILD.templates}`])

desc('Clean all')
task('clean', ['js:clean', 'tpl:clean', 'clobber'], function () {
  rmRf(BUILD_DIR)
  // package dir as well
})

// Package it up for Webstore
const manifest = JSON.parse(fs.readFileSync('manifest.json', ENC))
const pkgName = manifest.name.replace(/ /g, '-').toLowerCase()

packageTask(pkgName, manifest.version, ['compile'], function () {
  const fileList = ['manifest.json', 'build/*', 'img/**', 'src/popup.html']
  this.packageFiles.include(fileList)
  this.needZip = true
  this.archiveNoBaseDir = true
})

desc('Rebuild & package')
task('default', ['clean', 'compile', 'package'])
