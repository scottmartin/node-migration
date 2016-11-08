# node-migration

A generic promise based migration tool for node.js.

## Command-Line Usage

The main way to use this tool is from the command line by installing it through NPM globally.

```bash
$ npm install -g node-migration
```

```bash
$ cd ~/Projects/test-project

$ migrate create create_users
Created migration: /Users/scott/Projects/test-project/migrations/1478281876745_create_users.js

$ migrate up
Running migration: create_users (1478281876745)

$ migrate down
Reversing migration: create_users (1478281876745)
```

Each time you run `migrate up` it runs and keeps track of all migrations that have not been previously run. Every time you run `migrate down` it will then just reverse one step at a time until you've reversed every `migrate up` call.

Up and Down allow you to pass the `-f [file]` or `--file [file]` flags to change the filename of the file that the current migration state is stored in, and all three commands allow you to pass the `-d [dir]` or `--dir [dir]` flags to change the directory the migrations are stored in.

## Programmatic Usage

It is also possible to use it programmatically.

```javascript
const migrate = require('node-migration')

// Run the up migrations
migrate.run('up', { dir: './migrations', file: 'migrations.json' })

// Run the down migrations
migrate.run('down', { dir: './migrations', file: 'migrations.json' })
```

Run always returns a promise that will resolve when the migrations have been finished.

## Migrations

The purpose of this tool was to not care what you were migrating and to allow you to do it synchronously or asynchronously. Which means by default it doesn't **DO** anything except keep track of the migration files. It's up to you to tell it how to deal with your particular database or system you're migrating, and/or where you want to store the migration JSON that keeps track of which migrations have run.

Each migration file just exports the `up` and `down` functions. Both functions can return a promise if your code is asynchronous.

```javascript
// ./migrations/1478281876745_create_users.js
const db = // Do your database connection setup

// Example of a synchronous migration
exports.up = (ctx) => {
  db.createTable('users') // Some synchronous code
}

// Example of an asynchronous migration
exports.down = (ctx) => {
  return new Promise((resolve, reject) => {
    db.dropTable('users', (err, result) => { // Some asynchronous code
      if (err) reject(err)
      resolve()
    })
  })
}

// Or if dropTable already returns a promise
exports.down = (ctx) => {
  return db.dropTable('users')
}
```

## What's the context for?

The context is an object that gets passed around throughout the lifecycle of the migration process. If the system you are migrating doesn't need much setup or teardown, you could always just do those in each migration file. However, most database systems will probably have some connection opening and closing boilerplate that would be annoying to rewrite multiple times.

You can manipulate the context before the migrations are run. Allowing you to add a database handle, and/or override how the current state JSON gets stored. All you need to do is create a `setup.js` file in your migrations folder that exports a function that takes the context object and modifies it as needed. If your code is asynchronous, just like in the exported functions in your migration files, you can also return a promise.

```javascript
// ./migrations/setup.js
const db = // Do your database connection setup here.

module.exports = (ctx) => {
  ctx.db = db // Attach db to the context
}
```

You can also use the `setup.js` file to change the way the state of the current migrations is stored. For instance, you may want to store the current state in the database you're migrating instead of in a JSON file alongside the code. Just override the `getJSON` and `saveJSON` methods on the context. `getJSON` gets the JSON, parses it, and returns the object. While the `saveJSON` method takes the object, stringifies it and stores it. Both of these functions can also return promises.

```javascript
// ./migrations/setup.js

module.exports = (ctx) => {
  ctx.getJSON = () => {
    const json = // Get the JSON from your database
    return JSON.parse(json)
  }

  ctx.saveJSON = (state) => {
    const json = JSON.stringify(state)
    // Store json in your database

    // This is also where you can do any teardown, like closing any database connections
  }

  // Or if you need to do tear down, but want to keep the default saveJSON behavior

  const _saveJSON = ctx.saveJSON
  ctx.saveJSON = (state) => {
    _saveJSON(state)
    // Do your teardown
  }
}
```

Anything you add to the context can then be used from your migration files.

```javascript
// ./migrations/1478281876745_create_users.js
// Now using the db handle on the context

// Example of a synchronous migration
exports.up = (ctx) => {
  ctx.db.createTable('users') // Some synchronous code
}

// Example of an asynchronous migration
exports.down = (ctx) => {
  return new Promise((resolve, reject) => {
    ctx.db.dropTable('users', (err, result) => { // Some asynchronous code
      if (err) reject(err)
      resolve()
    })
  })
}

// Or if dropTable already returns a promise
exports.down = (ctx) => {
  return ctx.db.dropTable('users')
}
```
