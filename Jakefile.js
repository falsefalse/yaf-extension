/* eslint-env node */

/* BUILD ALL THE THINGS */

const {
  namespace,
  desc,
  task,
  file,
  packageTask,
  directory,
  rmRf,
  FileList
} = require('jake')

const fs = require('fs')
const path = require('path')
const uglify = require('uglify-js')
const template = require('lodash.template')

const ENC = 'utf-8'
const ROOT = './'
const BUILD_DIR = path.join(ROOT, './build')

const TEMPLATES_DIR = path.join(ROOT, './src/templates')

const jsList = new FileList()
jsList.include(path.join(ROOT, 'src/*.js'))

const SRC = {
  js: jsList.toArray(),
  // gets expanded in `readEjs`
  templates: ['index.ejs.js']
}

const BUILD = {
  js: [...SRC.js]
    .map(srcPath => path.basename(srcPath))
    .map(srcName => path.join(BUILD_DIR, srcName)),
  templates: path.join(BUILD_DIR, 'templates.js')
}

SRC.templates = [
  ...SRC.templates,
  ...fs.readdirSync(TEMPLATES_DIR).filter(name => /\.ejs$/.test(name))
].map(name => path.join(TEMPLATES_DIR, name))

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

namespace('js', () => {
  desc('Minify scripts')
  task('default', [BUILD_DIR], () => {
    SRC.js.forEach((srcPath, i) => minify(srcPath, BUILD.js[i]))
  })

  desc('Clean scripts')
  task('clean', () => {
    BUILD.js.forEach(filepath => {
      if (!fs.existsSync(filepath)) return

      fs.unlinkSync(filepath)
      console.log('Removed:', filepath)
    })
  })
})

namespace('tpl', () => {
  desc('Compile and minify templates')
  file(BUILD.templates, [...SRC.templates, BUILD_DIR], () => {
    const compiled = {}
    const meta = SRC.templates.shift()
    let result = template(fs.readFileSync(meta, ENC))

    SRC.templates.forEach(fullpath => {
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
  task('clean', () => {
    ;[BUILD.templates].forEach(filepath => {
      if (!fs.existsSync(filepath)) return
      fs.unlinkSync(filepath)
      console.log('Removed:', filepath)
    })
  })
})

desc('Compile all')
task('compile', [BUILD_DIR, 'js:default', `tpl:${BUILD.templates}`])

desc('Clean all')
task('clean', ['js:clean', 'tpl:clean', 'clobber'], () => rmRf(BUILD_DIR))

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
