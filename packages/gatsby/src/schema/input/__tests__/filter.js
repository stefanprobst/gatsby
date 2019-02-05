const { TypeComposer } = require(`graphql-compose`)
const {
  GraphQLInputObjectType,
  GraphQLBoolean,
  GraphQLList,
  GraphQLID,
  GraphQLString,
  GraphQLEnumType,
} = require(`graphql`)

const getFilterInput = require(`../filter`)
const { addNodeInterface, getNodeInterfaceFields } = require(`../../interfaces`)
const { getQueryOperatorInput } = require(`../../query`)

const nodeInterfaceFields = getNodeInterfaceFields()
const operators = {
  bool: getQueryOperatorInput(GraphQLBoolean).getFieldNames(),
  id: getQueryOperatorInput(GraphQLID).getFieldNames(),
  string: getQueryOperatorInput(GraphQLString).getFieldNames(),
  enum: getQueryOperatorInput(
    new GraphQLEnumType({ name: `FooEnum` })
  ).getFieldNames(),
}

const tc = TypeComposer.create({
  name: `Foo`,
  fields: {
    bool: `Boolean`,
    int: `Int`,
    float: `Float`,
    string: `String`,
    date: `Date`,
    json: `JSON`,
    array: [`Boolean`],
    nested: [`type Nested { bool: [Boolean!]! }`],
    enum: `enum CustomEnum { FOO BAR }`,
  },
})
addNodeInterface(tc)
const itc = tc.getITC()
const filter = getFilterInput(itc)

describe(`Filter input`, () => {
  it(`constructs complete input filter`, () => {
    expect(filter.getType()).toBeInstanceOf(GraphQLInputObjectType)
    expect(filter.getFieldNames()).toEqual(
      itc.getFieldNames().filter(name => ![`json`].includes(name))
    )
  })

  it(`adds query operator fields`, () => {
    expect(filter.getFieldTC(`bool`).getFieldNames()).toEqual(operators.bool)
    expect(filter.getFieldTC(`array`).getFieldNames()).toEqual(operators.bool)
  })

  it(`does not mutate input`, () => {
    expect(itc.getFieldType(`bool`)).toBe(GraphQLBoolean)
    expect(itc.getFieldType(`array`)).toBeInstanceOf(GraphQLList)
    expect(itc.getFieldType(`array`).ofType).toBe(GraphQLBoolean)
  })

  it(`adds query operator fields for nested fields`, () => {
    expect(filter.getFieldTC(`nested`).getFieldNames()).toEqual([
      `elemMatch`,
      `bool`,
    ])
    expect(
      filter
        .getFieldTC(`nested`)
        .getFieldTC(`bool`)
        .getFieldNames()
    ).toEqual(operators.bool)
  })

  it(`adds query operator field for arrays of objects`, () => {
    expect(
      filter
        .getFieldTC(`nested`)
        .getFieldTC(`elemMatch`)
        .getFieldNames()
    ).toEqual([`bool`])
  })

  it(`adds query operator fields for enum fields`, () => {
    expect(filter.getFieldTC(`enum`).getFieldNames()).toEqual(operators.enum)
    expect(filter.getFieldTC(`enum`).getFieldType(`eq`).name).toBe(`CustomEnum`)
    expect(filter.getFieldTC(`enum`).getField(`eq`)).toBeInstanceOf(
      GraphQLEnumType
    )
  })

  it(`does not add query operator fields for JSON fields`, () => {
    expect(filter.getFieldNames()).not.toEqual(expect.arrayContaining([`json`]))
  })

  it(`adds query operator fields for Node interface fields`, () => {
    expect(filter.getFieldTC(`id`).getFieldNames()).toEqual(operators.id)

    expect(filter.getFieldType(`parent`)).toBeInstanceOf(GraphQLInputObjectType)
    expect(filter.getFieldType(`parent`).name).toBe(`NodeInput`)
    expect(filter.getFieldTC(`parent`).getFieldNames()).toEqual(
      nodeInterfaceFields
    )

    expect(filter.getFieldType(`children`)).toBeInstanceOf(
      GraphQLInputObjectType
    )
    expect(filter.getFieldType(`children`).name).toBe(`NodeListInput`)
    expect(filter.getFieldTC(`children`).getFieldNames()).toEqual(
      expect.arrayContaining([...nodeInterfaceFields, `elemMatch`])
    )

    expect(filter.getFieldType(`internal`)).toBeInstanceOf(
      GraphQLInputObjectType
    )
    expect(filter.getFieldType(`internal`).name).toBe(`InternalInput`)
    expect(filter.getFieldTC(`internal`).getFieldNames()).toEqual([
      `content`,
      `contentDigest`,
      `description`,
      `fieldOwners`,
      `ignoreType`,
      `mediaType`,
      `owner`,
      `type`,
    ])
    expect(
      filter
        .getFieldTC(`internal`)
        .getFieldTC(`type`)
        .getFieldNames()
    ).toEqual(operators.string)

    expect(
      filter
        .getFieldTC(`children`)
        .getFieldTC(`id`)
        .getFieldNames()
    ).toEqual(operators.id)
    expect(
      filter
        .getFieldTC(`parent`)
        .getFieldTC(`parent`)
        .getFieldTC(`id`)
        .getFieldNames()
    ).toEqual(operators.id)
    expect(
      filter
        .getFieldTC(`children`)
        .getFieldTC(`parent`)
        .getFieldTC(`children`)
        .getFieldTC(`id`)
        .getFieldNames()
    ).toEqual(operators.id)
  })

  it(`constructs input filter with query operator fields`, () => {
    expect(
      Object.entries(filter.getFields()).map(([field, tc]) => ({
        field,
        type: {
          name: tc.getTypeName(),
          fields: tc.getFieldNames(),
        },
      }))
    ).toMatchSnapshot()
  })

  it(`does not add fields without query operators`, () => {
    // JSON fields don't have query operators
    TypeComposer.create(`type EmptyNested { json: JSON }`)
    TypeComposer.create(
      `type EmptyNestedNested { json: JSON, nested: EmptyNested }`
    )
    const tc = TypeComposer.create(
      `type Empty {
        json: JSON
        nested: EmptyNested
        nestedNested: EmptyNestedNested
      }`
    )
    addNodeInterface(tc)
    const itc = tc.getITC()
    const filter = getFilterInput(itc)
    expect(filter.getTypeName()).toBe(`EmptyInput`)
    expect(filter.getFields().nested).toBeUndefined()
    expect(filter.getFields().nestedNested).toBeUndefined()
    expect(filter.getFieldNames()).toEqual([
      `id`,
      `parent`,
      `children`,
      `internal`,
    ])
  })
})
