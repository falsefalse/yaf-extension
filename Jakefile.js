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

function minify(srcPath, { beautify = false }) {
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

  log(beautify ? '💅🏼' : '🗜', srcPath, grey(srcSize), '→', blue(size(srcPath)))
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
const SCRIPTS = new FileList().include(`${BUILD_DIR}/**/*.js`)

directory(BUILD_DIR)

const manifest = require('./manifest.json.js')

const ENV = {}
desc('Set build env, create package tasks')
task('set_env', (release, firefox) => {
  release = Boolean(release)
  firefox = Boolean(firefox)

  const { name, version } = manifest({ release, firefox })
  const pkgName = name.toLowerCase().replaceAll(' ', '-')

  Object.assign(ENV, { release, firefox, pkgName, version })

  namespace('build', () => {
    packageTask(pkgName, version, ['build'], function () {
      this.packageFiles.include([
        'manifest.json',
        'build/**',
        'img/**',
        'src/*.html',
        'src/*.css'
      ])
      if (!firefox) this.packageFiles.exclude('src/module.html')

      this.needZip = true
      // otherwise firefox just can't
      this.archiveNoBaseDir = true
    })
  })

  namespace('src', () => {
    packageTask(`${pkgName}-src`, version, [], function () {
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
    })
  })
})

desc(`Generate ${MANIFEST}`)
task('manifest', () => {
  const { release, firefox, version } = ENV
  writeFile(MANIFEST, stringify(manifest({ release, firefox })))

  log(
    'Created manifest %s %s',
    !release ? yellow(version) + ' 🚧' : blue(version),
    firefox ? '🦊' : ''
  )
})
namespace('manifest', () => {
  desc(`Remove ${MANIFEST}`)
  task('clean', () => rmRf(MANIFEST))
})

desc('Typecheck & emit sources')
task('typescript', [BUILD_DIR], () => {
  const { release } = ENV
  log('🦜 Typechecking, emitting...')

  try {
    exec('yarn -s tsc', { stdio: [0, release ? 1 : null] })
  } catch (error) {
    if (release) throw error
    log('❌ Typecheck %s!', red('failed'))
  }
})

const API_ENDPOINT = 'https://geoip.furman.im'
const DEV_ENDPOINT = 'http://localhost:8080'
const DOH_ENDPOINT = 'https://dns.google/resolve'
desc(`Generate config`)
task('config', [BUILD_DIR], (/*prettier-ignore*/ specs) => {
  const { release, version } = ENV

  const config = `export default ${stringify({
    apiUrl: release ? API_ENDPOINT : DEV_ENDPOINT,
    dohApiUrl: DOH_ENDPOINT,
    version
  })}`

  writeFile(specs ? SPEC_CONFIG : CONFIG, config)

  log(
    'Created %s config %s',
    !release || specs ? yellow('development 🚧') : blue('production 🌍'),
    !release || specs ? yellow(version) : blue(version)
  )
})

desc('Compile templates')
task('templates', [BUILD_DIR], (/*prettier-ignore*/ specs) => {
  const sources = EJS.toArray()
  const compiled = sources.reduce((_, tp) => {
    const name = basename(tp).replace('.ejs.html', '')
    const { source } = template(readFile(tp), {
      variable: 'locals'
    })

    return _ + `export const ${name} = ${source}\n`
  }, '')

  const path = specs ? SPEC_TEMPLATES : TEMPLATES
  writeFile(path, compiled)

  log(`Compiled %s templates → %s`, yellow(sources.length), grey(size(path)))

  // cut dead code from complited templates
  if (specs) minify(path, { beautify: true })
})

// otherwise ts-node can not import anything
desc('Pretend src/ and spec/ are modules')
task('module', () => {
  const typeModule = stringify({ type: 'module' })
  writeFile('src/package.json', typeModule)
  writeFile('spec/package.json', typeModule)
})

desc('Minify')
task('minify', [BUILD_DIR], () =>
  SCRIPTS.toArray().forEach(file => minify(file, { beautify: ENV.firefox }))
)

desc('Build all')
task(
  'build',
  ['manifest', 'config', 'typescript', 'templates'],
  () => ENV.release && Task['minify'].invoke()
)

desc('Remove all')
task('clean', ['manifest:clean'], (/*prettier-ignore*/ specs) => {
  if (!specs) {
    rmRf(BUILD_DIR)
    rmRf('pkg/')
    rmRf('pkg-src/')
  }
  rmRf(SPEC_CONFIG)
  rmRf(SPEC_TEMPLATES)
  rmRf('src/package.json')
  rmRf('spec/package.json')
  rmRf('coverage/')
})

task('onlyzip', () => {
  rmRf(`pkg/${ENV.pkgName}-${ENV.version}`)
  rmRf(`pkg-src/${ENV.pkgName}-src-${ENV.version}`)
})

namespace('release', () => {
  desc('Release package 🦊')
  task('firefox', ['set_env[🌍,🦊]', 'build:package', 'src:package', 'onlyzip'])
})

desc('Release package')
task('release', ['set_env[🌍,]', 'build:package'])

desc('Dev package 🦊')
task('firefox', ['set_env[,🦊]', 'build:package', 'manifest:clean', 'onlyzip'])

desc('Dev package')
task('default', ['set_env', 'build:package', 'manifest:clean'])
