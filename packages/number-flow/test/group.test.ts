import {afterEach, describe, expect, it} from 'vitest'

import NumberFlowGroup from '../src/group'
import NumberFlow from '../src/index'

// MutationObserver callbacks run as microtasks:
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

// The membership the group keeps for the lifetime of its flows
// (yceffort/number-flow#26):
const flowsOf = (group: NumberFlowGroup) =>
  (group as unknown as {_flows: Set<NumberFlow>})._flows

describe('NumberFlowGroup membership', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  // A flow directly under the group, or inside a wrapper element:
  const mount = (wrapped: boolean) => {
    const group = document.createElement('number-flow-group')
    const flow = document.createElement('number-flow')
    const node = wrapped ? document.createElement('div') : flow
    if (wrapped) node.appendChild(flow)
    group.appendChild(node)
    document.body.appendChild(group)
    expect(flow.batched).toBe(true)
    expect(flowsOf(group).size).toBe(1)
    return {group, flow, node}
  }

  it.each([
    ['a flow', false],
    ['a wrapper around a flow', true],
  ])('drops the flow when %s is removed', async (_name, wrapped) => {
    const {group, flow, node} = mount(wrapped)
    node.remove()
    await tick()
    expect(flow.batched).toBe(false)
    expect(flowsOf(group).size).toBe(0)
  })

  it.each([
    ['a flow', false],
    ['a wrapper around a flow', true],
  ])(
    'keeps the flow when %s moves within the group',
    async (_name, wrapped) => {
      const {group, flow, node} = mount(wrapped)
      const other = document.createElement('div')
      group.appendChild(other)
      other.appendChild(node) // removed and re-inserted in one task
      await tick()
      expect(flow.batched).toBe(true)
      expect(flowsOf(group).size).toBe(1)
    },
  )

  it('releases its flows when it is disconnected', () => {
    const {group, flow} = mount(true)
    group.remove()
    expect(flow.batched).toBe(false)
    expect(flowsOf(group).size).toBe(0)
  })

  // The new group registers the flow when it connects there; the old group's
  // observer runs after that and must not take the batching back:
  it.each([
    ['a flow', false],
    ['a wrapper around a flow', true],
  ])(
    'hands the flow over when %s moves to another group',
    async (_name, wrapped) => {
      const {group, flow, node} = mount(wrapped)
      const other = document.createElement('number-flow-group')
      document.body.appendChild(other)
      other.appendChild(node)
      expect(flow.batched).toBe(true)
      await tick()
      expect(flow.batched).toBe(true)
      expect(flowsOf(group).size).toBe(0)
      expect(flowsOf(other).size).toBe(1)
    },
  )
})
