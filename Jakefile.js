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
const template = require('lodash.template')
const { minify: uglify } = require('uglify-js')

const {
  existsSync: exists,
  statSync: stat,
  writeFileSync: writeFile,
  readFileSync
} = require('fs')
const readFile = path => readFileSync(path, 'utf-8')
const { basename, join } = require('path')
const { execSync: exec } = require('child_process')

const DEV = Boolean(process.env.DEV)

const log = (...[first, ...rest]) => console.log(...[`→ ${first}`, ...rest])

const stringify = json => JSON.stringify(json, null, 2)

function size(path) {
  if (!exists(path)) return 'N/A'
  const { size } = stat(path)
  return size < 1024 ? size + 'B' : (size / 1024).toFixed(1) + 'KB'
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

function minify(srcPath, forFirefox = false) {
  const srcSize = size(srcPath)

  const config = {
    module: true,
    ...(forFirefox && {
      compress: false,
      mangle: false,
      output: {
        beautify: true,
        indent_level: 1,
        quote_style: 3,
        comments: false
      }
    })
  }

  const { code } = uglify(readFile(srcPath), config)
  writeFile(srcPath, code)

  log('Minified', srcPath, grey(srcSize), '→', blue(size(srcPath)))
}

// lesssgoo!

const BUILD_DIR = './build'

// templates sources
const EJS = new FileList().include('src/templates/*.ejs.html')
// compiled templates
const TEMPLATES = join(BUILD_DIR, 'templates.js')
// generated config
const CONFIG = join(BUILD_DIR, 'config.js')
const SPEC_CONFIG = join('src', 'config.js')
// generated manifest
const MANIFEST = 'manifest.json'
// generated and emitted scripts
const SCRIPTS = new FileList().include(`${BUILD_DIR}/*.js`)

directory(BUILD_DIR)

const manifest = require('./manifest.json.js')
const { version, name } = manifest()
let pkgName = name.toLowerCase().replace(/ /g, '-')
pkgName = DEV ? `DEV-${pkgName}` : pkgName

desc(`Generate ${MANIFEST}`)
task('manifest', (forFirefox = false) => {
  const monefest = stringify(manifest({ forFirefox }))
  writeFile(MANIFEST, monefest)

  log('Created manifest', yellow(version), forFirefox ? 'for 🦊' : '')
})
namespace('manifest', () => {
  desc(`Remove ${MANIFEST}`)
  task('clean', () => rmRf('manifest.json'))
})

desc('Typecheck & emit sources')
task('typescript', [BUILD_DIR], () => {
  log('🦜 Typechecking & emitting...')

  try {
    exec('yarn -s tsc', { stdio: [0, DEV ? null : 1] })
  } catch (error) {
    if (!DEV) throw error
    log('❌ Failed!')
  }
})

const API_ENDPOINT = DEV ? 'http://localhost:8080' : 'https://geoip.furman.im'
const DOH_ENDPOINT = 'https://dns.google/resolve'
desc(`Generate config`)
task('config', [BUILD_DIR], (forSpecs = false) => {
  const config = `export default ${stringify({
    apiUrl: API_ENDPOINT,
    dohApiUrl: DOH_ENDPOINT,
    version
  })}`

  writeFile(forSpecs ? SPEC_CONFIG : CONFIG, config)

  log('Created %s config', DEV ? red('🔧 development') : green('🌍 production'))
})

desc('Compile templates')
task('templates', [BUILD_DIR], () => {
  const sources = EJS.toArray()
  const compiled = sources.reduce((_, tp) => {
    const name = basename(tp).replace('.ejs.html', '')
    const { source } = template(readFile(tp), {
      variable: 'locals'
    })

    return _ + `export const ${name} = ${source}\n`
  }, '')

  writeFile(TEMPLATES, compiled)

  log(
    `Compiled %s templates → %s`,
    yellow(sources.length),
    grey(size(TEMPLATES))
  )
})

desc('Minify')
task('minify', ['typescript', 'config', 'templates'], (forFirefox = false) => {
  if (DEV) return
  SCRIPTS.toArray().forEach(file => minify(file, forFirefox))
})

desc('Build all')
task('build', (...args) => {
  const [forFirefox] = args
  if (!forFirefox) packageFiles.exclude('src/module.html')
  ;['manifest', 'minify'].forEach(name => Task[name].invoke(...args))
})

desc('Remove all')
task('clean', ['manifest:clean', 'build:clobber', 'src:clobber'], () => {
  rmRf(BUILD_DIR)
  rmRf(SPEC_CONFIG)
})

let packageFiles
namespace('build', () => {
  function define() {
    packageFiles = this.packageFiles

    this.packageFiles.include([
      'manifest.json',
      'build/**',
      'img/**',
      'src/*.html',
      'src/*.css'
    ])
    this.needZip = true
    // otherwise firefox just can't
    this.archiveNoBaseDir = true
  }

  packageTask(pkgName, version, [], define)
})

namespace('src', () => {
  function define() {
    this.packageFiles.include(['src/**', 'img/**', 'pkg/**', '*.*'])
    this.packageDir = './pkg-src'
    this.needZip = true
  }

  packageTask(`${pkgName}-src`, version, ['build[🦊]', 'build:package'], define)
})

const tasks = ['build', 'build:package', 'manifest:clean']
task('onlyzip', () => rmRf(`pkg/${pkgName}-${version}`))

const [, ...rest] = tasks
desc('Build & package for 🦊')
task('firefox', ['build[🦊]', ...rest, 'onlyzip'])

desc('Build & package')
task('default', tasks)
