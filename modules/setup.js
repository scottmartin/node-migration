const path = require('path')
const fse = require('fs-extra')

module.exports = ({ dir, file }) => {
  const userSetupPath = path.resolve(dir, 'setup.js')
  const migrationStatePath = path.resolve(dir, file)

  let context = {
    _getState () {
      return Promise.resolve(this.getJSON())
      .then((state) => { this.state = state })
    },

    _saveState () {
      return Promise.resolve(this.saveJSON(this.state))
    },

    getJSON () {
      if (fse.existsSync(migrationStatePath)) {
        try {
          return require(migrationStatePath)
        } catch (e) {
          return []
        }
      }
      return []
    },

    saveJSON (state) {
      fse.outputJSONSync(migrationStatePath, state)
    }
  }

  if (fse.existsSync(userSetupPath)) {
    return Promise.resolve(require(userSetupPath)(context))
    .then(() => context)
  } else {
    return Promise.resolve(context)
  }
}
