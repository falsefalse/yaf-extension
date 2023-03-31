/* eslint-env node */

/* BUILD ALL THE THINGS */

const {
  namespace,
  desc,
  task,
  packageTask,
  directory,
  rmRf,
  FileList,
  Task
} = require('jake')

const fs = require('fs')
const path = require('path')
const uglify = require('uglify-js')
const template = require('lodash.template')

const manifest = require('./manifest.json.js')
let { DEV } = process.env
DEV = Boolean(DEV)

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
const red = s => `\x1b[31m${s}\x1b[0m`
const magenta = s => `\x1b[35m${s}\x1b[0m`
const cyan = s => `\x1b[36m${s}\x1b[0m`
const yellow = s => `\x1b[33m${s}\x1b[0m`
const blue = s => `\x1b[34m${s}\x1b[0m`
const grey = s => `\x1b[90m${s}\x1b[0m`
/* eslint-enable no-unused-vars */

const utf = 'utf-8'

const SRC = {
  scripts: new FileList().include('src/*.js', 'src/*.json'),
  templates: new FileList().include('src/templates/*.ejs')
}

const BUILD_DIR = './build'
const BUILD = {
  templates: path.join(BUILD_DIR, 'templates.js')
}
const resolveBuild = fileList =>
  [...fileList.toArray()]
    .map(sp => path.basename(sp))
    .map(srcName => path.join(BUILD_DIR, srcName))

const min = (code, isJson) =>
  isJson
    ? JSON.stringify(JSON.parse(code), null, null)
    : uglify.minify(code).code
// minifies passed .js or .json
function minify(sourcepath, resultpath, skip = false) {
  const sourceSize = size(sourcepath)
  skip = skip || DEV

  const isJson = path.extname(sourcepath) == '.json'
  let code = fs.readFileSync(sourcepath, utf)
  code = skip ? code : min(code, isJson)

  if (!code) {
    const error = `❌ Failed to minify ${red(sourcepath)}`
    log(error)
    throw new Error(error)
  }

  fs.writeFileSync(resultpath, code)
  if (skip) {
    log(yellow('Copied'), resultpath, grey(sourceSize))
  } else {
    log('Minified', sourcepath, grey(sourceSize), '→', blue(size(resultpath)))
  }
}

directory(BUILD_DIR)

desc('Minify scripts')
task('scripts', [BUILD_DIR], (skipMinification = false) => {
  const sources = SRC.scripts.toArray()
  const build = resolveBuild(SRC.scripts)
  sources.forEach((sp, i) => minify(sp, build[i], skipMinification))
})

namespace('scripts', () => {
  desc('Remove scripts')
  task('clean', () => resolveBuild(SRC.scripts).forEach(bp => rmRf(bp)))
})

desc('Compile and minify templates')
task('templates', [BUILD_DIR], (skipMinification = false) => {
  const sources = SRC.templates.toArray()
  const compiled = sources.reduce((_, tp) => {
    const name = path.basename(tp).replace('.ejs', '')
    const { source } = template(fs.readFileSync(tp, utf), {
      variable: 'locals'
    })

    return _ + `export const ${name} = ${source}\n`
  }, '')

  fs.writeFileSync(BUILD.templates, compiled)

  log(
    'Compiled %s templates %s',
    yellow(sources.length),
    grey(size(BUILD.templates))
  )
  minify(BUILD.templates, BUILD.templates, skipMinification)
})

namespace('templates', () => {
  desc('Remove templates')
  task('clean', () => rmRf(BUILD.templates))
})

const ENDPOINT = DEV ? 'http://localhost:8080' : 'https://geoip.furman.im'
const DOH_ENDPOINT = 'https://dns.google/resolve'
desc('Produce src/config.js')
task('config', () => {
  const config = {
    apiUrl: ENDPOINT,
    version: aManifest.version,
    dohApiUrl: DOH_ENDPOINT
  }

  fs.writeFileSync(
    'src/config.js',
    // TODO: use .json when importing json as a es6 module becomes possible
    `export default ${JSON.stringify(config, null, 2)}`
  )

  log(`Created %s config`, DEV ? red('🔧 development') : green('🌍 production'))
})
namespace('config', () => {
  desc('Remove src/config.js')
  task('clean', () => rmRf('src/config.js'))
})

desc('Compile all')
task('compile', (...args) => {
  ;['config', 'scripts', `templates`].forEach(taskName => {
    const task = Task[taskName]
    task.invoke.apply(task, args)
  })
})

desc('Remove all')
task(
  'clean',
  [
    'scripts:clean',
    'templates:clean',
    'manifest:clean',
    'config:clean',
    'clobber'
  ],
  () => rmRf(BUILD_DIR)
)

desc('Produce manifest.json')
task('manifest', (forFirefox = false) => {
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
let pkgName = aManifest.name.toLowerCase().replace(/ /g, '-')
pkgName = DEV ? `DEV-${pkgName}` : pkgName

let packageFiles
packageTask(pkgName, aManifest.version, [], function () {
  packageFiles = this.packageFiles

  const fileList = ['manifest.json', 'build/*', 'img/**', 'src/*.html']
  this.packageFiles.include(fileList)
  this.needZip = true
  // otherwise firefox just can't
  this.archiveNoBaseDir = true
})

// run after `yarn relase:firefox`, commenting above task out
// desc('Package source')
// packageTask(`${pkgName}-source`, aManifest.version, [], function () {
//   const fileList = ['build/**', 'pkg/**', 'src/**', 'img/**', '*']
//   this.packageFiles.include(fileList)
//   this.needZip = true
//   this.packageDir = './pkg-source'
// })

task('onlyzip', () => rmRf(`pkg/${pkgName}-${aManifest.version}`))

const [manifestT, compileT, ...restT] = [
  'manifest',
  'compile',
  'package',
  'manifest:clean',
  'config:clean'
]

desc('Build & package for Firefox')
task('firefox', ['manifest[🦊]', 'compile[🦊]', ...restT, 'onlyzip'])

desc('Build & package')
task('default', [manifestT, compileT, ...restT])
