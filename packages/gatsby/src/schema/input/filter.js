const {
  getNamedType,
  getNullableType,
  GraphQLInputObjectType,
  GraphQLList,
} = require(`graphql`)
const { InputTypeComposer } = require(`graphql-compose`)

const { getListQueryOperator, getQueryOperators } = require(`../query`)

const cache = new Map()

const convert = itc => {
  const type = itc.getType()
  if (cache.has(type)) {
    return cache.get(type)
  }

  const convertedItc = new InputTypeComposer(
    new GraphQLInputObjectType({
      name: itc.getTypeName(),
      fields: {},
    })
  )
  cache.set(type, convertedItc)

  const fields = itc.getFields()
  const convertedFields = Object.entries(fields).reduce(
    (acc, [fieldName, fieldConfig]) => {
      const type = getNamedType(fieldConfig.type)

      if (type instanceof GraphQLInputObjectType) {
        const OperatorsInputTC = convert(new InputTypeComposer(type))

        // TODO: array of arrays?
        const isListType =
          getNullableType(fieldConfig.type) instanceof GraphQLList

        // elemMatch operator
        acc[fieldName] = isListType
          ? getListQueryOperator(OperatorsInputTC)
          : OperatorsInputTC
      } else {
        // GraphQLScalarType || GraphQLEnumType
        const operatorFields = getQueryOperators(type)
        if (operatorFields) {
          acc[fieldName] = operatorFields
        }
      }

      return acc
    },
    {}
  )

  convertedItc.addFields(convertedFields)
  return convertedItc
}

const getFilterInput = itc => convert(itc)

module.exports = getFilterInput
