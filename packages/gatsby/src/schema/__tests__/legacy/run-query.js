// FIXME: enable after rebase on current master
// const nodesQuery = require(`../../../db/nodes-query`)
const { findMany } = require(`../../resolvers/resolvers`)

const { store } = require(`../../../redux`)
// FIXME: enable after rebase on current master
// require(`../../db/__tests__/fixtures/ensure-loki`)()

const makeNodes = () => [
  {
    id: `0`,
    parent: null,
    children: [],
    internal: { type: `Test` },
    index: 0,
    name: `The Mad Max`,
    string: `a`,
    float: 1.5,
    hair: 1,
    date: `2006-07-22T22:39:53.000Z`,
    anArray: [1, 2, 3, 4],
    key: {
      withEmptyArray: [],
    },
    anotherKey: {
      withANested: {
        nestedKey: `foo`,
        emptyArray: [],
        anotherEmptyArray: [],
      },
    },
    frontmatter: {
      date: `2006-07-22T22:39:53.000Z`,
      title: `The world of dash and adventure`,
      tags: [`moo`, `foo`],
      blue: 100,
    },
    anObjectArray: [
      { aString: `some string`, aNumber: 2, aBoolean: true },
      { aString: `some string`, aNumber: 2, anArray: [1, 2] },
    ],
    boolean: true,
  },
  {
    id: `1`,
    parent: null,
    children: [],
    internal: { type: `Test` },
    index: 1,
    name: `The Mad Wax`,
    string: `b`,
    float: 2.5,
    hair: 2,
    anArray: [1, 2, 5, 4],
    waxOnly: {
      foo: true,
    },
    anotherKey: {
      withANested: {
        nestedKey: `foo`,
      },
    },
    frontmatter: {
      date: `2006-07-22T22:39:53.000Z`,
      title: `The world of slash and adventure`,
      blue: 10010,
      circle: `happy`,
    },
    boolean: false,
    data: {
      tags: [
        {
          tag: {
            document: [
              {
                data: {
                  tag: `Design System`,
                },
                number: 3,
              },
            ],
          },
        },
      ],
    },
  },
  {
    id: `2`,
    parent: null,
    children: [],
    internal: { type: `Test` },
    index: 2,
    name: `The Mad Wax`,
    string: `c`,
    float: 3.5,
    hair: 0,
    date: `2006-07-29T22:39:53.000Z`,
    waxOnly: null,
    anotherKey: {
      withANested: {
        nestedKey: `bar`,
      },
    },
    frontmatter: {
      date: `2006-07-22T22:39:53.000Z`,
      title: `The world of shave and adventure`,
      blue: 10010,
      circle: `happy`,
    },
    data: {
      tags: [
        {
          tag: {
            document: [
              {
                data: {
                  tag: `Gatsby`,
                },
              },
            ],
          },
        },
        {
          tag: {
            document: [
              {
                data: {
                  tag: `Design System`,
                },
                number: 5,
              },
            ],
          },
        },
      ],
    },
  },
]

const runFilter = filter => runQuery({ filter })

let buildSchema
const runQuery = async (args, nodes = makeNodes()) => {
  for (const node of nodes) {
    store.dispatch({ type: `CREATE_NODE`, payload: node })
  }

  const schema = await buildSchema()

  const context = { path: `foo` }
  // FIXME: Adjust after rebase on current master
  return findMany(`Test`)({ args, context, info: { schema } })
}

describe(`[legacy] Filter fields`, () => {
  beforeEach(() => {
    store.dispatch({ type: `DELETE_CACHE` })
    const { schemaComposer } = require(`graphql-compose`)
    schemaComposer.clear()
    jest.isolateModules(() => {
      buildSchema = require(`../../schema`).buildSchema
    })
  })

  it(`handles eq operator`, async () => {
    let result = await runFilter({ hair: { eq: 2 } })

    expect(result.length).toEqual(1)
    expect(result[0].hair).toEqual(2)
  })

  it(`handles eq operator with false value`, async () => {
    let result = await runFilter({ boolean: { eq: false } })

    expect(result.length).toEqual(1)
    expect(result[0].name).toEqual(`The Mad Wax`)
  })

  it(`handles eq operator with 0`, async () => {
    let result = await runFilter({ hair: { eq: 0 } })

    expect(result.length).toEqual(1)
    expect(result[0].hair).toEqual(0)
  })

  it(`handles ne operator`, async () => {
    let result = await runFilter({ hair: { ne: 2 } })

    expect(result.length).toEqual(2)
    expect(result[0].hair).toEqual(1)
  })

  it(`handles nested ne: true operator`, async () => {
    let result = await runFilter({ waxOnly: { foo: { ne: true } } })

    expect(result.length).toEqual(2)
  })

  it(`handles lt operator`, async () => {
    let result = await runFilter({ hair: { lt: 2 } })

    expect(result.length).toEqual(2)
    expect(result[0].hair).toEqual(1)
    expect(result[1].hair).toEqual(0)
  })

  it(`handles lte operator`, async () => {
    let result = await runFilter({ hair: { lte: 1 } })

    expect(result.length).toEqual(2)
    expect(result[0].hair).toEqual(1)
    expect(result[1].hair).toEqual(0)
  })

  it(`handles gt operator`, async () => {
    let result = await runFilter({ hair: { gt: 0 } })

    expect(result.length).toEqual(2)
    expect(result[0].hair).toEqual(1)
    expect(result[1].hair).toEqual(2)
  })

  it(`handles gte operator`, async () => {
    let result = await runFilter({ hair: { gte: 1 } })

    expect(result.length).toEqual(2)
    expect(result[0].hair).toEqual(1)
    expect(result[1].hair).toEqual(2)
  })

  it(`handles the regex operator`, async () => {
    let result = await runFilter({ name: { regex: `/^the.*wax/i` } })
    expect(result.length).toEqual(2)
    expect(result[0].name).toEqual(`The Mad Wax`)
  })

  it(`handles the in operator for strings`, async () => {
    let result = await runFilter({ string: { in: [`b`, `c`] } })
    expect(result.length).toEqual(2)
    expect(result[0].index).toEqual(1)
  })

  it(`handles the in operator for ints`, async () => {
    let result = await runFilter({ index: { in: [0, 2] } })
    expect(result.length).toEqual(2)
    expect(result[0].index).toEqual(0)
    expect(result[1].index).toEqual(2)
  })

  it(`handles the in operator for floats`, async () => {
    let result = await runFilter({ float: { in: [1.5, 2.5] } })
    expect(result.length).toEqual(2)
    expect(result[0].index).toEqual(0)
    expect(result[1].index).toEqual(1)
  })

  it(`handles the in operator for booleans`, async () => {
    let result = await runFilter({ boolean: { in: [true] } })
    expect(result.length).toEqual(1) // 2
    expect(result[0].index).toEqual(0)
    //    expect(result[1].index).toEqual(2)
  })

  it(`handles the in operator for array`, async () => {
    let result = await runFilter({ anArray: { in: [5] } })
    expect(result.length).toEqual(1)
    expect(result[0].name).toEqual(`The Mad Wax`)
  })

  it(`handles the nested in operator for array of strings`, async () => {
    let result = await runFilter({ frontmatter: { tags: { in: [`moo`] } } })
    expect(result).toHaveLength(1)
    expect(result[0].name).toEqual(`The Mad Max`)
  })

  it(`handles the elemMatch operator for array of objects`, async () => {
    // This needs `MAX_DEPTH` >= 5 in `infer/infer.js` to work
    let result = await runFilter({
      data: {
        tags: {
          elemMatch: {
            tag: {
              document: {
                elemMatch: {
                  data: {
                    tag: { eq: `Gatsby` },
                  },
                },
              },
            },
          },
        },
      },
    })

    expect(result.length).toEqual(1)
    expect(result[0].index).toEqual(2)
  })

  it(`handles the elemMatch operator for array of objects (2)`, async () => {
    // This needs `MAX_DEPTH` >= 5 in `infer/infer.js` to work
    let result = await runFilter({
      data: {
        tags: {
          elemMatch: {
            tag: {
              document: {
                elemMatch: {
                  data: {
                    tag: { eq: `Design System` },
                  },
                },
              },
            },
          },
        },
      },
    })

    expect(result.length).toEqual(2)
    expect(result[0].index).toEqual(1)
    expect(result[1].index).toEqual(2)
  })

  it(`handles the elemMatch operator for array of objects (number)`, async () => {
    let result = await runFilter({
      data: {
        tags: {
          elemMatch: {
            tag: {
              document: {
                elemMatch: {
                  number: { lt: 4 },
                },
              },
            },
          },
        },
      },
    })

    expect(result.length).toEqual(1)
    expect(result[0].index).toEqual(1)
  })

  it(`handles the nin operator for array`, async () => {
    let result = await runFilter({ anArray: { nin: [5] } })

    expect(result.length).toEqual(2)

    result.forEach(edge => {
      expect(edge.anArray).not.toEqual(expect.arrayContaining([5]))
    })
  })

  it(`handles the nin operator for strings`, async () => {
    let result = await runFilter({ string: { nin: [`b`, `c`] } })

    expect(result.length).toEqual(1)
    result.forEach(edge => {
      expect(edge.string).not.toEqual(`b`)
      expect(edge.string).not.toEqual(`c`)
    })
  })

  it(`handles the nin operator for ints`, async () => {
    let result = await runFilter({ index: { nin: [0, 2] } })

    expect(result.length).toEqual(1)
    result.forEach(edge => {
      expect(edge.index).not.toEqual(0)
      expect(edge.index).not.toEqual(2)
    })
  })

  it(`handles the nin operator for floats`, async () => {
    let result = await runFilter({ float: { nin: [1.5] } })

    expect(result.length).toEqual(2)
    result.forEach(edge => {
      expect(edge.float).not.toEqual(1.5)
    })
  })

  it(`handles the nin operator for booleans`, async () => {
    let result = await runFilter({ boolean: { nin: [true, null] } })

    expect(result.length).toEqual(1)
    result.forEach(edge => {
      expect(edge.boolean).not.toEqual(null)
      expect(edge.boolean).not.toEqual(true)
    })
  })

  it(`handles the glob operator`, async () => {
    let result = await runFilter({ name: { glob: `*Wax` } })

    expect(result.length).toEqual(2)
    expect(result[0].name).toEqual(`The Mad Wax`)
  })

  it(`filters date fields`, async () => {
    let result = await runFilter({ date: { ne: null } })

    expect(result.length).toEqual(2)
    expect(result[0].index).toEqual(0)
    expect(result[1].index).toEqual(2)
  })
})

describe(`[legacy] collection fields`, () => {
  it(`sorts results`, async () => {
    let result = await runQuery({
      limit: 10,
      sort: {
        fields: [`frontmatter.blue`],
        order: `DESC`,
      },
    })

    expect(result.length).toEqual(3)
    expect(result[0].name).toEqual(`The Mad Wax`)
  })

  it(`sorts results with desc has null fields first`, async () => {
    // FIXME: Do we really want this?
    let result = await runQuery({
      limit: 10,
      sort: {
        fields: [`waxOnly`],
        order: `DESC`,
      },
    })

    expect(result.length).toEqual(3)
    expect(result[0].id).toEqual(`0`)
    expect(result[1].id).toEqual(`2`)
    expect(result[2].id).toEqual(`1`)
  })

  it(`sorts results with asc has null fields last`, async () => {
    // FIXME: Do we really want this?
    let result = await runQuery({
      limit: 10,
      sort: {
        fields: [`waxOnly`],
        order: `ASC`,
      },
    })

    expect(result.length).toEqual(3)
    expect(result[0].id).toEqual(`1`)
    expect(result[1].id).toEqual(`2`)
    expect(result[2].id).toEqual(`0`)
  })

  it(`applies order (asc/desc) to all sort fields`, async () => {
    // FIXME: This tests that sort order is only applied to the first field!
    // What is the expectation?
    let result = await runQuery({
      limit: 10,
      sort: {
        fields: [`frontmatter.blue`, `id`],
        order: `DESC`,
      },
    })

    expect(result.length).toEqual(3)
    expect(result[0].id).toEqual(`1`) // blue = 10010, id = 1
    expect(result[1].id).toEqual(`2`) // blue = 10010, id = 2
    expect(result[2].id).toEqual(`0`) // blue = 100, id = 0
  })
})
