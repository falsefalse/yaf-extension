/* eslint-env node */

/* BUILD ALL THE THINGS */

const {
  namespace,
  desc,
  task,
  packageTask,
  directory,
  rmRf,
  FileList
} = require('jake')

const fs = require('fs')
const path = require('path')
const uglify = require('uglify-js')
const template = require('lodash.template')

const { DEV_BUILD } = process.env

const manifest = require('./manifest.json.js')

// utilities
const replacers = ['%s', '%d', '%i', '%f', '%j', '%o', '%O', '%c', '%%']
const prefix = '→'
const log = (...[first, ...rest]) => {
  if (replacers.find(r => first.toString().includes(r))) {
    console.log(...[`${prefix} ${first}`, ...rest])
  } else {
    console.log(...[prefix, first, ...rest])
  }
}

function size(fpath) {
  if (!fs.existsSync(fpath)) return 'N/A'
  const fsize = fs.statSync(fpath).size
  return fsize < 1024 ? fsize + 'B' : ~~(fsize / 1024) + 'KB'
}

/* eslint-disable no-unused-vars */
const green = s => `\x1b[32m${s}\x1b[0m`
const magenta = s => `\x1b[35m${s}\x1b[0m`
const cyan = s => `\x1b[36m${s}\x1b[0m`
const yellow = s => `\x1b[33m${s}\x1b[0m`
const blue = s => `\x1b[34m${s}\x1b[0m`
const grey = s => `\x1b[90m${s}\x1b[0m`
/* eslint-enable no-unused-vars */

const utf = 'utf-8'

const scriptsList = new FileList()
const templatesList = new FileList()

scriptsList.include('src/*.js')
templatesList.include('src/templates/*.ejs')

const SRC = {
  scripts: scriptsList.toArray(),
  templates: templatesList.toArray()
}

const BUILD_DIR = './build'
const BUILD = {
  scripts: [...SRC.scripts]
    .map(sp => path.basename(sp))
    .map(srcName => path.join(BUILD_DIR, srcName)),
  templates: path.join(BUILD_DIR, 'templates.js')
}

// minifies passed JS file
// if no resultpath was passed, overwrites the source file
function minify(sourcepath, resultpath) {
  const sourceSize = size(sourcepath)
  resultpath = resultpath || sourcepath

  let code = fs.readFileSync(sourcepath, utf)
  if (!DEV_BUILD) {
    code = uglify.minify(fs.readFileSync(sourcepath, utf)).code
  }
  fs.writeFileSync(resultpath, code)

  log('Minified:', sourcepath, grey(sourceSize), '→', blue(size(resultpath)))
}

directory(BUILD_DIR)

desc('Minify scripts')
task('scripts', [BUILD_DIR], () =>
  SRC.scripts.forEach((sp, i) => minify(sp, BUILD.scripts[i]))
)

namespace('scripts', () => {
  desc('Remove scripts')
  task('clean', () => BUILD.scripts.forEach(sp => rmRf(sp)))
})

const isIndexJs = p => path.basename(p).startsWith('index.js')

desc('Compile and minify templates')
task('templates', [BUILD_DIR], () => {
  // prepare templates
  const templates = SRC.templates.filter(tp => !isIndexJs(tp))

  const compiled = templates.reduce((_, tp) => {
    const fileName = path.basename(tp)
    const fileContent = fs.readFileSync(tp, utf)
    return {
      ..._,
      [fileName]: template(fileContent, { variable: 'locals' }).source
    }
  }, {})

  // prepare index meta template
  let indexTemplate = template(
    fs.readFileSync(SRC.templates.find(isIndexJs), utf),
    { variable: 'locals' }
  )

  indexTemplate = indexTemplate({ entries: Object.entries(compiled) })
  fs.writeFileSync(BUILD.templates, indexTemplate, utf)

  log(
    'Compiled %s templates → %s',
    yellow(SRC.templates.length),
    grey(size(BUILD.templates))
  )

  minify(BUILD.templates)
})

namespace('templates', () => {
  desc('Remove templates')
  task('clean', () => rmRf(BUILD.templates))
})

desc('Compile all')
task('compile', ['scripts', `templates`])

desc('Remove all')
task(
  'clean',
  ['scripts:clean', 'templates:clean', 'manifest:clean', 'clobber'],
  () => rmRf(BUILD_DIR)
)

desc('Produce manifest.json')
task('manifest', forFirefox => {
  forFirefox = Boolean(forFirefox)
  const monefest = JSON.stringify(manifest({ forFirefox }), null, 2)
  fs.writeFileSync('manifest.json', monefest)

  if (!forFirefox) packageFiles.exclude('src/module.html')

  log(
    `Created manifest version %s`,
    yellow(aManifest.version),
    forFirefox ? 'for 🦊' : '🌍'
  )
})
namespace('manifest', () => {
  desc('Remove manifest.json')
  task('clean', () => rmRf('manifest.json'))
})

const aManifest = manifest()
const pkgName = aManifest.name.replace(/ /g, '-').toLowerCase()

let packageFiles
packageTask(pkgName, aManifest.version, ['compile'], function () {
  packageFiles = this.packageFiles

  const fileList = ['manifest.json', 'build/*', 'img/**', 'src/*.html']
  this.packageFiles.include(fileList)
  this.needZip = true
  this.archiveNoBaseDir = true
})

const [_, ...__] = ['manifest', 'package', 'manifest:clean']

desc('Build & package for Firefox')
task('firefox', ['manifest[🦊]', ...__])

desc('Build & package')
task('default', [_, ...__])
