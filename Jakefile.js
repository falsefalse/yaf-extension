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

const scriptsList = new FileList()
scriptsList.include(path.join(ROOT, 'src/*.js'))
const templatesList = new FileList()
templatesList.include(path.join(ROOT, 'src/templates/*.ejs'))

const SRC = {
  scripts: scriptsList.toArray(),
  templates: templatesList.toArray()
}

const BUILD = {
  scripts: [...SRC.scripts]
    .map(srcPath => path.basename(srcPath))
    .map(srcName => path.join(BUILD_DIR, srcName)),
  templates: path.join(BUILD_DIR, 'templates.js')
}

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

  let code = fs.readFileSync(sourcepath, ENC)
  if (!process.env.DEV_BUILD) {
    code = uglify.minify(fs.readFileSync(sourcepath, ENC)).code
  }
  fs.writeFileSync(resultpath, code)

  console.log('Minified:', sourcepath, sourceSize, '→', size(resultpath))
}

directory(BUILD_DIR)

namespace('scripts', () => {
  desc('Minify scripts')
  task('default', [BUILD_DIR], () => {
    SRC.scripts.forEach((srcPath, i) => minify(srcPath, BUILD.scripts[i]))
  })

  desc('Clean scripts')
  task('clean', () => {
    BUILD.scripts.forEach(filepath => {
      if (!fs.existsSync(filepath)) return

      fs.unlinkSync(filepath)
      console.log('Removed:', filepath)
    })
  })
})

const isIndex = filepath => path.basename(filepath).startsWith('index.js')

namespace('templates', () => {
  desc('Compile and minify templates')
  file(BUILD.templates, [...SRC.templates, BUILD_DIR], () => {
    // prepare templates
    const templates = SRC.templates.filter(path => !isIndex(path))

    const compiled = templates.reduce((acc, filepath) => {
      const fileName = path.basename(filepath)
      const fileContent = fs.readFileSync(filepath, ENC)
      acc[fileName] = template(fileContent, { variable: 'locals' }).source
      return acc
    }, {})

    // prepare index meta template
    let indexTemplate = template(
      fs.readFileSync(SRC.templates.find(isIndex), ENC),
      { variable: 'locals' }
    )

    indexTemplate = indexTemplate({ entries: Object.entries(compiled) })
    fs.writeFileSync(BUILD.templates, indexTemplate, ENC)

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
task('compile', [BUILD_DIR, 'scripts:default', `templates:${BUILD.templates}`])

desc('Clean all')
task('clean', ['scripts:clean', 'templates:clean', 'clobber'], () =>
  rmRf(BUILD_DIR)
)

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
