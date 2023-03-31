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
const template = require('lodash.template')
const { minify: uglify } = require('uglify-js')
const { execSync: exec } = require('child_process')

const DEV = Boolean(process.env.DEV)

const replacers = ['%s', '%d', '%i', '%f', '%j', '%o', '%O', '%c', '%%']
const arrow = '→'
function log(...[first, ...rest]) {
  if (replacers.find(r => first.toString().includes(r))) {
    console.log(...[`${arrow} ${first}`, ...rest])
  } else {
    console.log(...[arrow, first, ...rest])
  }
}

function logAndThrow(error, output = null) {
  log(output || error)
  if (error) throw error
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

function minify(sourcepath, skip = false) {
  const sourceSize = size(sourcepath)
  skip = skip || DEV

  let code = fs.readFileSync(sourcepath, utf)
  code = skip ? code : uglify(code).code

  !code && logAndThrow(`❌ Failed to minify ${red(sourcepath)}`)

  fs.writeFileSync(sourcepath, code)

  if (skip) {
    log(yellow('Copied'), sourcepath, grey(sourceSize))
  } else {
    log('Minified', sourcepath, grey(sourceSize), '→', blue(size(sourcepath)))
  }
}

// lesssgoo!

const BUILD_DIR = './build'

// templates sources
const EJS = new FileList().include('src/templates/*.ejs')
// compiled templates
const TEMPLATES = path.join(BUILD_DIR, 'templates.js')
// generated config
const CONFIG = path.join(BUILD_DIR, 'config.js')
// generated and emitted scripts
const SCRIPTS = new FileList().include('build/*.js')

directory(BUILD_DIR)

desc('Typecheck & emit sources')
task('typescript', [BUILD_DIR], () => {
  let output

  try {
    exec('yarn tsc --pretty', { encoding: utf })
  } catch (error) {
    output = error.stdout.toString()
  }

  log('🦜 Typecheck %s', !output ? cyan('passed') : red('failed'))

  output && logAndThrow('❌ Typecheck failed', output)
})

desc('Minify scripts')
task('scripts', ['typescript', BUILD_DIR], (skipMinification = false) => {
  SCRIPTS.toArray().forEach(file => minify(file, skipMinification))
})

namespace('scripts', () => {
  desc(`Remove ${BUILD_DIR}`)
  task('clean', () => rmRf(BUILD_DIR))
})

desc('Compile templates')
task('templates', [BUILD_DIR], () => {
  const sources = EJS.toArray()
  const compiled = sources.reduce((_, tp) => {
    const name = path.basename(tp).replace('.ejs', '')
    const { source } = template(fs.readFileSync(tp, utf), {
      variable: 'locals'
    })

    return _ + `export const ${name} = ${source}\n`
  }, '')

  fs.writeFileSync(TEMPLATES, compiled)

  log(
    `Compiled %s templates ${arrow} %s`,
    yellow(sources.length),
    grey(size(TEMPLATES))
  )
})

const API_ENDPOINT = DEV ? 'http://localhost:8080' : 'https://geoip.furman.im'
const DOH_ENDPOINT = 'https://dns.google/resolve'
desc(`Produce ${CONFIG}`)
task('config', [BUILD_DIR], () => {
  const config = {
    apiUrl: API_ENDPOINT,
    dohApiUrl: DOH_ENDPOINT,
    version: aManifest.version
  }

  fs.writeFileSync(
    CONFIG,
    // TODO: use .json when importing json as a es6 module becomes possible
    `export default ${JSON.stringify(config, null, 2)}`
  )

  log('Created %s config', DEV ? red('🔧 development') : green('🌍 production'))
})

desc('Compile all')
task('compile', (...args) => {
  ;['config', 'templates', 'scripts'].forEach(taskName => {
    const task = Task[taskName]
    task.invoke.apply(task, args)
  })
})

desc('Remove all')
task('clean', ['scripts:clean', 'manifest:clean', 'clobber'], () =>
  rmRf(BUILD_DIR)
)

const manifest = require('./manifest.json.js')

desc('Produce manifest.json')
task('manifest', (forFirefox = false) => {
  const monefest = JSON.stringify(manifest({ forFirefox }), null, 2)
  fs.writeFileSync('manifest.json', monefest)

  if (!forFirefox) packageFiles.exclude('src/module.html')

  log(
    'Created manifest version %s',
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
  'manifest:clean'
]

desc('Build & package for 🦊')
task('firefox', ['manifest[🦊]', 'compile[🦊]', ...restT, 'onlyzip'])

desc('Build & package')
task('default', [manifestT, compileT, ...restT])
