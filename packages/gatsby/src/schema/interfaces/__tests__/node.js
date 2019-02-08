const { TypeComposer } = require(`graphql-compose`)

const {
  addNodeInterface,
  addNodeInterfaceFields,
  getNodeInterfaceFields,
} = require(`../node`)

describe(`Node interface`, () => {
  it(`addNodeInterface`, () => {
    const tc = TypeComposer.create(`type Foo { bar: Boolean }`)
    const fields = getNodeInterfaceFields()
    addNodeInterface(tc)
    expect(tc.hasInterface(`Node`)).toBeTruthy()
    expect(tc.getFieldNames()).toEqual(expect.arrayContaining(fields))
  })

  it(`addNodeInterfaceFields`, () => {
    const tc = TypeComposer.create(`type Baz { qux: Boolean }`)
    const fields = getNodeInterfaceFields()
    addNodeInterfaceFields(tc)
    expect(tc.getFieldNames()).toEqual(expect.arrayContaining(fields))
  })

  it(`getNodeInterfaceFields`, () => {
    const fields = getNodeInterfaceFields()
    expect(fields).toEqual([`id`, `parent`, `children`, `internal`])
  })
})
