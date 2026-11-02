import {CONNECT_EVENT, UPDATE_EVENT} from '.'
import NumberFlow from '.'
import {ServerSafeHTMLElement} from './ssr'
import {define} from './util/dom'

// queueMicrotask is missing in some old WebViews (< Chrome 71):
const microtask =
  typeof queueMicrotask === 'function'
    ? queueMicrotask
    : (cb: () => void) => void Promise.resolve().then(cb)

// A removed node is the flow itself or a wrapper around some:
const flowsIn = (node: Node): NumberFlow[] =>
  node instanceof NumberFlow
    ? [node]
    : node instanceof Element
      ? Array.from(node.querySelectorAll<NumberFlow>('number-flow'))
      : []

export default class NumberFlowGroup extends ServerSafeHTMLElement {
  private _mutationObserver?: MutationObserver

  connectedCallback() {
    // The descendants are probably already connected, so query the DOM first.
    // Note: this won't work with a custom-defined element, if that ever exists:
    this.querySelectorAll<NumberFlow>('number-flow').forEach((flow) => {
      this._addDescendant(flow)
    })

    this.addEventListener(CONNECT_EVENT, this._onDescendantConnected)
    this.addEventListener(UPDATE_EVENT, this._onDescendantUpdate)

    // We can't emit disconnection events, so use a mutation observer to track those
    this._mutationObserver ??= new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          // Flows can leave inside a wrapper (yceffort/number-flow#26), and
          // one moved within the group was re-inserted before this ran:
          flowsIn(node).forEach((flow) => {
            if (this.contains(flow)) return
            // One moved to another group was registered there on connect,
            // before this ran: only its membership here ends.
            if (flow.closest('number-flow-group')) this._flows.delete(flow)
            else this._removeDescendant(flow)
          })
        })
      })
    })
    this._mutationObserver.observe(this, {childList: true, subtree: true})
  }

  private _flows = new Set<NumberFlow>()

  private _addDescendant = (flow: NumberFlow) => {
    flow.batched = true
    this._flows.add(flow)
  }
  private _removeDescendant = (flow: NumberFlow) => {
    flow.batched = false
    this._flows.delete(flow)
  }

  private _onDescendantConnected = (event: Event) => {
    this._addDescendant(event.target as NumberFlow)
  }

  private _updating = false
  private _onDescendantUpdate = () => {
    if (this._updating) return
    this._updating = true
    this._flows.forEach((flow) => {
      if (!flow.created) return
      flow.willUpdate()
      microtask(() => {
        if (flow.connected) flow.didUpdate()
      })
    })
    microtask(() => {
      this._updating = false
    })
  }

  disconnectedCallback() {
    this.removeEventListener(CONNECT_EVENT, this._onDescendantConnected)
    this.removeEventListener(UPDATE_EVENT, this._onDescendantUpdate)
    this._mutationObserver?.disconnect()
    // connectedCallback collects them again if the group comes back:
    this._flows.forEach(this._removeDescendant)
  }
}

define('number-flow-group', NumberFlowGroup)

declare global {
  interface HTMLElementTagNameMap {
    'number-flow-group': NumberFlowGroup
  }
}
