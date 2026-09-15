/* BUILD ALL THE THINGS */

import jake from 'jake'
import { build, loadEnv } from 'vite'
import { writeFileSync as writeFile } from 'node:fs'

import manifest, { version } from './manifest.json.js'

// jake is CommonJS with a runtime-built `module.exports`, Node sees no named exports
const { namespace, desc, task, packageTask, rmRf } = jake

const log = (first, ...rest) => console.log(`→ ${first}`, ...rest)

const stringify = json => JSON.stringify(json, null, 2)

/* eslint-disable no-unused-vars */
const green = s => `\x1b[32m${s}\x1b[0m`
const red = s => `\x1b[31m${s}\x1b[0m`
const magenta = s => `\x1b[35m${s}\x1b[0m`
const cyan = s => `\x1b[36m${s}\x1b[0m`
const yellow = s => `\x1b[33m${s}\x1b[0m`
const blue = s => `\x1b[34m${s}\x1b[0m`
const grey = s => `\x1b[90m${s}\x1b[0m`
/* eslint-enable no-unused-vars */

// lesssgoo!

const BUILD_DIR = './build'
// generated manifest
const MANIFEST = 'manifest.json'

const ENV = {}
desc('Set build env, create package tasks')
task('set_env', (release, firefox) => {
  release = Boolean(release)
  firefox = Boolean(firefox)

  const { name } = manifest({ release, firefox })
  const pkgName = name.toLowerCase().replaceAll(' ', '-')

  Object.assign(ENV, { release, firefox, pkgName })

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
  const { release, firefox } = ENV
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

desc('Bundle sources')
task('bundle', async () => {
  const { release, firefox } = ENV
  const mode = release ? 'production' : 'development'
  // same resolution vite uses when inlining, including shell overrides
  const { VITE_API_URL } = loadEnv(mode, process.cwd())

  log(
    '📦 Bundling %s → %s',
    release ? blue(mode) : yellow(`${mode} 🚧`),
    grey(VITE_API_URL)
  )

  await build({
    mode,
    logLevel: release ? 'info' : 'warn',
    // AMO reviewers get a readable bundle
    ...(firefox && { build: { minify: false } })
  })
})

desc('Build all')
task('build', ['manifest', 'bundle'])

desc('Remove all')
task('clean', ['manifest:clean'], () => {
  rmRf(BUILD_DIR)
  rmRf('pkg/')
  rmRf('pkg-src/')
  rmRf('coverage/')
})

task('onlyzip', () => {
  rmRf(`pkg/${ENV.pkgName}-${version}`)
  rmRf(`pkg-src/${ENV.pkgName}-src-${version}`)
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
