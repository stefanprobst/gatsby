/**
 * Nodes in the store don't have fields which are
 * - added in `setFieldsOnGraphQLNodeType`
 * - added in `@link` directive.
 * Therefore we need to resolve those fields so they are
 * available for querying.
 */

// TODO: Possible PERFORMANCE:
// * either deepcopy the node object with JSON.parse(JSON.stringify())
//   before, so we can mutate it with reduce/forEach
// * or start reducing from an empty object, and copy over scalars

const { schemaComposer } = require(`graphql-compose`)
const { GraphQLNonNull } = require(`graphql`)

// const { store } = require(`../../redux`)
const { getNodesByType } = require(`../db`)
const { dropQueryOperators } = require(`../query`)
const { isProductionBuild } = require(`../utils`)
const { trackObjects } = require(`../utils/node-tracking`)

const { emitter } = require(`../../redux`)
let isBootstrapFinished = false
emitter.on(`BOOTSTRAP_FINISHED`, () => (isBootstrapFinished = true))

const cache = new Map()
const nodeCache = new Map()

// const getLinkResolver = (astNode, type) => {
//   const linkDirective = astNode.directives.find(
//     directive => directive.name.value === `link`
//   )
//   if (linkDirective) {
//     const { GraphQLList } = require(`graphql`)
//     const { findOne, findMany, link } = require(`./resolvers`)

//     const by = linkDirective.arguments.find(
//       argument => argument.name.value === `by`
//     ).value.value

//     return link({ by })(
//       type instanceof GraphQLList
//         ? findMany(type.ofType.name)
//         : findOne(type.name)
//     )
//   }
//   return null
// }

// TODO: Filter sparse arrays?

const resolveValue = (value, filterValue, type) => {
  const nullableType = type instanceof GraphQLNonNull ? type.ofType : type
  // FIXME: We probably have to check that node data and schema are actually in sync,
  // i.e. both are arrays or scalars
  // return Array.isArray(value) && nullableType instanceof GraphQLList
  return Array.isArray(value)
    ? Promise.all(
        value.map(item => resolveValue(item, filterValue, nullableType.ofType))
      )
    : prepareForQuery(value, filterValue, nullableType)
}

const prepareForQuery = (node, filter, parentType) => {
  // FIXME: Make this a .map() and resolve with Promise.all.
  // .reduce() works sequentially: must resolve `acc` before the next iteration
  // Promise.all(
  //   Object.entries(filter)
  //     .map(async ([fieldName, filterValue]) => {
  //       // ...
  //       return result && [fieldName, result]
  //     })
  //     .filter(Boolean)
  // ).then(fields =>
  //   fields.reduce((acc, [key, value]) => (acc[key] = value) && acc, node)
  // )

  const fields = parentType.getFields()

  const queryNode = Object.entries(filter).reduce(
    async (acc, [fieldName, filterValue]) => {
      const node = await acc
      // FIXME: What is the expectation here if this is null?
      // Continue and call the field resolver or not?
      // I.e. should we check hasOwnProperty instead?
      // if (Object.prototype.hasOwnProperty.call(node, fieldName))
      if (node[fieldName] == null) return node

      const { resolve, type } = fields[fieldName]

      // FIXME: This is just to test if manually calling the link directive
      // resolver would work (it does). Instead we should use the executable
      // schema where the link resolvers are already added.
      // let { resolve, type, astNode } = tc.getFieldConfig(fieldName)
      // resolve = (astNode && getLinkResolver(astNode, type)) || resolv

      // const value =
      //   typeof resolver === `function`
      //     ? await resolver(
      //         node,
      //         {},
      //         {},
      //         { fieldName, fieldNodes: [{}], parentType: {}, returnType: type }
      //       )
      //     : node[fieldName]

      // node[fieldName] =
      //   filterValue !== true && value != null
      //     ? await resolveValue(value, filterValue, tc.getFieldTC(fieldName))
      //     : value

      if (typeof resolve === `function`) {
        node[fieldName] = await resolve(
          node,
          {},
          {},
          // FIXME: parentType should be checked elsewhere
          // NOTE: fieldNodes is needed for `graphql-tools` schema stitching to work
          { fieldName, fieldNodes: [{}], parentType, returnType: type }
        )
      }

      // `dropQueryOperators` sets value to `true` for leaf values.
      // Maybe be more explicit: `const isLeaf = !isObject(filterValue)`
      // TODO:
      // * Do we have to check if
      //   - isObject(value) || Array.isArray(value) ?
      //   i.e. can we rely on the filter being correct? or the node data not being wrong?
      //   also: do we have to check that TC and field value are in sync with regards to
      //   being scalar or array?
      const isLeaf = filterValue === true
      const value = node[fieldName]

      if (!isLeaf && value != null) {
        node[fieldName] = await resolveValue(value, filterValue, type)
      }

      return node
    },
    // FIXME: Shallow copy the node, to avoid mutating the nodes in the store.
    // Possible alternative: start reducing not from node, but from {}, and copy fields
    // when no resolver.
    { ...node }
  )
  return queryNode
}

const getNodesForQuery = async (type, filter) => {
  const nodes = await getNodesByType(type)

  if (!filter) return nodes

  const filterFields = dropQueryOperators(filter)

  let cacheKey
  if (isProductionBuild || !isBootstrapFinished) {
    cacheKey = JSON.stringify({ type, count: nodes.length, filterFields })
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)
    }
  }

  // Use executable schema from store (includes resolvers added by @link directive).
  // Alternatively, call @link resolvers manually.
  const { GraphQLSchema } = require(`graphql`)
  const { schema } = require(`../../redux`).store.getState()

  // FIXME: In testing, when no schema is built yet, use schemaComposer.
  // Should mock store in tests instead.
  const parentType =
    schema instanceof GraphQLSchema
      ? schema.getType(type)
      : schemaComposer.getTC(type).getType()

  // Should we do it the other way around, i.e. queryNodes = filter.reduce?
  const queryNodes = Promise.all(
    nodes.map(async node => {
      const cacheKey = JSON.stringify({
        id: node.id,
        digest: node.internal.contentDigest,
        filterFields,
      })
      if (nodeCache.has(cacheKey)) {
        return nodeCache.get(cacheKey)
      }

      const queryNode = prepareForQuery(node, filterFields, parentType)

      nodeCache.set(cacheKey, queryNode)
      trackObjects(await queryNode)
      return queryNode
    })
  )

  if (isProductionBuild || !isBootstrapFinished) {
    cache.set(cacheKey, queryNodes)
  }

  return queryNodes
}

module.exports = getNodesForQuery
