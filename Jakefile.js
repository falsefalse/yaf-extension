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

function minify(srcPath, beautify = false) {
  const srcSize = size(srcPath)

  const config = {
    module: true,
    ...(beautify && {
      compress: { dead_code: true },
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

  log(
    beautify ? 'Beautified 💅🏼' : 'Minified',
    srcPath,
    grey(srcSize),
    '→',
    blue(size(srcPath))
  )
}

// lesssgoo!

const BUILD_DIR = './build'
const SRC_DIR = './src'

// templates sources
const EJS = new FileList().include('src/templates/*.ejs.html')
// compiled templates
const TEMPLATES = join(BUILD_DIR, 'templates.js')
const SPEC_TEMPLATES = join(SRC_DIR, 'templates.js')
// generated config
const CONFIG = join(BUILD_DIR, 'config.js')
const SPEC_CONFIG = join(SRC_DIR, 'config.js')
// generated manifest
const MANIFEST = 'manifest.json'
// generated and emitted scripts
const SCRIPTS = new FileList().include(`${BUILD_DIR}/*.js`)

directory(BUILD_DIR)

const manifest = require('./manifest.json.js')
const { version, name } = manifest({ DEV })
const pkgName = name.toLowerCase().replaceAll(' ', '-')

desc(`Generate ${MANIFEST}`)
task('manifest', (forFirefox = false) => {
  const monefest = stringify(manifest({ DEV, forFirefox }))
  writeFile(MANIFEST, monefest)

  log(
    'Created manifest %s %s',
    DEV ? yellow(version) + ' 🚧' : blue(version),
    forFirefox ? '🦊' : ''
  )
})
namespace('manifest', () => {
  desc(`Remove ${MANIFEST}`)
  task('clean', () => rmRf(MANIFEST))
})

desc('Typecheck & emit sources')
task('typescript', [BUILD_DIR], () => {
  log('🦜 Typechecking, emitting...')

  try {
    exec('yarn -s tsc', { stdio: [0, DEV ? null : 1] })
  } catch (error) {
    if (!DEV) throw error
    log('❌ Typecheck %s!', red('failed'))
  }
})

const API_ENDPOINT = 'https://geoip.furman.im'
const DEV_ENDPOINT = 'http://localhost:8080'
const DOH_ENDPOINT = 'https://dns.google/resolve'
desc(`Generate config`)
task('config', [BUILD_DIR], (forSpecs = false) => {
  const forDev = forSpecs || DEV
  const apiUrl = forDev ? DEV_ENDPOINT : API_ENDPOINT
  const dohApiUrl = DOH_ENDPOINT

  const config = `export default ${stringify({
    apiUrl,
    dohApiUrl,
    version
  })}`

  const path = forSpecs ? SPEC_CONFIG : CONFIG
  writeFile(path, config)

  log(
    'Created %s config',
    forDev ? yellow('development 🚧') : blue('production 🌍')
  )
})

desc('Compile templates')
task('templates', [BUILD_DIR], (forSpecs = false) => {
  const sources = EJS.toArray()
  const compiled = sources.reduce((_, tp) => {
    const name = basename(tp).replace('.ejs.html', '')
    const { source } = template(readFile(tp), {
      variable: 'locals'
    })

    return _ + `export const ${name} = ${source}\n`
  }, '')

  const path = forSpecs ? SPEC_TEMPLATES : TEMPLATES
  writeFile(path, compiled)

  log(`Compiled %s templates → %s`, yellow(sources.length), grey(size(path)))

  if (forSpecs) minify(path, true)
})

// otherwise ts-node can not import anything
desc('Pretend src/ and spec/ are modules')
task('module', () => {
  const typeModule = stringify({ type: 'module' })
  writeFile('src/package.json', typeModule)
  writeFile('spec/package.json', typeModule)
})

desc('Minify')
task('minify', ['typescript', 'config', 'templates'], (forFirefox = false) => {
  if (DEV) return
  SCRIPTS.toArray().forEach(file => minify(file, forFirefox))
})

desc('Build all')
task('build', (forFirefox = false) => {
  if (!forFirefox) packageFiles.exclude('src/module.html')
  ;['manifest', 'minify'].forEach(name => Task[name].invoke(forFirefox))
})

desc('Remove all')
task(
  'clean',
  ['manifest:clean', 'build:clobber', 'src:clobber'],
  (onlySpecs = false) => {
    if (!onlySpecs) rmRf(BUILD_DIR)
    rmRf(SPEC_CONFIG)
    rmRf(SPEC_TEMPLATES)
    rmRf('src/package.json')
    rmRf('spec/package.json')
    rmRf('coverage/')
  }
)

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
    this.packageFiles.include([
      'build/**',
      'img/**',
      'src/**',
      'spec/**',
      'pkg/**',
      '*.*'
    ])
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
