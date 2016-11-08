const path = require('path')
const fse = require('fs-extra')
const setup = require('./setup')

module.exports = {
  run (direction, { dir = './migrations', file = 'migrations.json' } = {}) {
    fse.ensureDirSync(path.resolve(dir))
    let context

    direction = String(direction).toLowerCase()
    return new Promise((resolve, reject) => {
      if (direction !== 'up' && direction !== 'down') {
        reject(new Error('Run was called with a direction other than up or down.'))
      }
      resolve()
    })
    .then(() => setup({ dir, file }))
    .then((ctx) => {
      context = ctx
      return context._getState()
    })
    .then(() => {
      return this[direction](context, { dir })
    })
    .then(() => context._saveState())
    .catch((error) => {
      console.error(error)
    })
  },

  up (ctx, { dir }) {
    // Get the list of migration files and the currently applied migration
    const fileList = this._getMigrationsFromFiles(dir)
    const currentMigration = ctx.state.length > 0
      ? ctx.state[ctx.state.length - 1] : null
    let migrationCount = 0

    // Check to see if each migration needs to be run
    const promiseChain = fileList.reduce((promiseChain, file) => {
      if (!currentMigration || file.id > currentMigration.id) {
        const fileContents = require(path.resolve(dir, this.toFilename(file)))
        if (fileContents.up) {
          migrationCount += 1
          promiseChain
          .then(() => {
            console.log('Running migration:', file.name, `(${file.id})`)
          })
          .then(() => fileContents.up(ctx))
        }
      }
      return promiseChain
    }, Promise.resolve())

    // Add the last run migration to the state
    if (migrationCount > 0) {
      promiseChain.then(() => {
        const migration = fileList.slice(-1)[0]
        migration.migratedOn = new Date()
        ctx.state.push(migration)
      })
    } else {
      promiseChain.then(() => { console.log('No migrations to run') })
    }

    return promiseChain
  },

  down (ctx, { dir }) {
    // Get the list of migration files in reverse and the currently and
    // previously applied migrations
    const fileList = this._getMigrationsFromFiles(dir).reverse()
    const currentMigration = ctx.state.length > 0
      ? ctx.state[ctx.state.length - 1] : null
    const previousMigration = ctx.state.length > 1
      ? ctx.state[ctx.state.length - 2] : null
    let migrationCount = 0

    // Check to see if each migration needs to be run
    const promiseChain = fileList.reduce((promiseChain, file) => {
      const revertToPrevious = previousMigration &&
        (file.id <= currentMigration.id && file.id > previousMigration.id)
      const revertCurrent = (currentMigration && !previousMigration) &&
        file.id <= currentMigration.id

      if (revertToPrevious || revertCurrent) {
        const fileContents = require(path.resolve(dir, this.toFilename(file)))
        if (fileContents.down) {
          migrationCount += 1
          promiseChain
          .then(() => {
            console.log('Reversing migration:', file.name, `(${file.id})`)
          })
          .then(() => fileContents.down(ctx))
        }
      }
      return promiseChain
    }, Promise.resolve())

    // Remove the last run migration from the state
    if (migrationCount > 0) {
      promiseChain.then(() => {
        ctx.state.pop()
      })
    } else {
      promiseChain.then(() => { console.log('No migrations to run') })
    }

    return promiseChain
  },

  toFilename (migration) {
    return `${migration.id}_${migration.name}.js`
  },

  fromFilename (filename) {
    const regex = /^(\d+)_(\w+).js$/i
    const m = regex.exec(filename)

    if (m !== null) {
      return {
        id: parseInt(m[1], 10),
        name: m[2]
      }
    }
    return null
  },

  _getMigrationsFromFiles (dir) {
    const migrationsPath = path.resolve(dir)
    if (fse.existsSync(migrationsPath)) {
      return fse.readdirSync(migrationsPath)
      .reduce((fileList, filename) => {
        const migration = this.fromFilename(filename)
        if (migration) fileList.push(migration)
        return fileList
      }, [])
    }
  }
}
