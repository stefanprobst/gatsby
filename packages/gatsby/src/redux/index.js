const Redux = require(`redux`)
const _ = require(`lodash`)
const fs = require(`fs-extra`)
const mitt = require(`mitt`)
const stringify = require(`json-stringify-safe`)

// Create event emitter for actions
const emitter = mitt()

// Reducers
const reducers = require(`./reducers`)

const objectToMap = obj => {
  let map = new Map()
  Object.keys(obj).forEach(key => {
    map.set(key, obj[key])
  })
  return map
}

const mapToObject = map => {
  const obj = {}
  for (let [key, value] of map) {
    obj[key] = value
  }
  return obj
}

// Read from cache the old node data.
let initialState = {}
try {
  const file = fs.readFileSync(`${process.cwd()}/.cache/redux-state.json`)
  // Apparently the file mocking in node-tracking-test.js
  // can override the file reading replacing the mocked string with
  // an already parsed object.
  if (Buffer.isBuffer(file) || typeof file === `string`) {
    initialState = JSON.parse(file)
  }
  if (initialState.staticQueryComponents) {
    initialState.staticQueryComponents = objectToMap(
      initialState.staticQueryComponents
    )
  }
  if (initialState.components) {
    initialState.components = objectToMap(initialState.components)
  }
} catch (e) {
  // ignore errors.
}

const saveReduxState = state => {
  const pickedState = _.pick(state, [
    `status`,
    `componentDataDependencies`,
    `jsonDataPaths`,
    `components`,
    `staticQueryComponents`,
  ])

  pickedState.staticQueryComponents = mapToObject(
    pickedState.staticQueryComponents
  )
  pickedState.components = mapToObject(pickedState.components)
  const stringified = stringify(pickedState, null, 2)

  return fs.writeFile(`${process.cwd()}/.cache/redux-state.json`, stringified)
}

// Persist state.
let saveInProgress = false
const saveState = async state => {
  // FIXME: Don't just return, but enqueue in Promise chain
  // probably needs savingStatePromise as module-level state,
  // which is set to null when Promise resolves.
  if (saveInProgress) return
  saveInProgress = true

  try {
    await Promise.all([saveReduxState(state), state.nodes.db.saveState()])
  } catch (err) {
    const report = require(`gatsby-cli/lib/reporter`)
    report.warn(`Error persisting state: ${(err && err.message) || err}`)
  }

  saveInProgress = false
}

const saveStateDebounced = _.debounce(saveState, 1000)

const multiMiddleware = store => next => action => {
  if (Array.isArray(action)) {
    return action.filter(Boolean).map(store.dispatch)
  } else {
    return next(action)
  }
}

// TODO: isBootstrapFinished should be in redux as app state
let isBootstrapFinished = false
emitter.on(`BOOTSTRAP_FINISHED`, () => (isBootstrapFinished = true))
const autoSaveMiddleware = store => next => action => {
  const result = next(action)
  // const isBootstrapFinished = store.getState().???
  if (isBootstrapFinished) {
    const state = store.getState()
    saveStateDebounced(state)
  }
  return result
}

const store = Redux.createStore(
  Redux.combineReducers({ ...reducers }),
  initialState,
  Redux.applyMiddleware(autoSaveMiddleware, multiMiddleware)
)

// Re-emit actions as events
store.subscribe(() => {
  const lastAction = store.getState().lastAction
  emitter.emit(lastAction.type, lastAction)
})

/** Event emitter */
exports.emitter = emitter

/** Redux store */
exports.store = store
