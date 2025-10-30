// Highlighter: safely highlight ingredient mentions and show tooltip with allergen + substitute

type Detection = {
  ingredientText: string
  allergen: string
  substituteSuggested?: string
  // optional CSS selector to narrow search
  selector?: string
}

const HIGHLIGHT_CLASS = 'eatwell-highlight'
const STYLE_ID = 'eatwell-highlighter-style'
const TOOLTIP_ID = 'eatwell-highlighter-tooltip'

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      background-color: rgba(255, 230, 128, 0.6);
      text-decoration: underline;
      text-decoration-color: rgba(255,120,0,0.9);
      border-radius: 2px;
      cursor: pointer;
    }
    .${HIGHLIGHT_CLASS}[data-allergen] {
      box-shadow: inset 0 -2px 0 rgba(255,120,0,0.6);
    }
    #${TOOLTIP_ID} {
      position: fixed;
      z-index: 2147483646; /* very high but below extension panels */
      background: rgba(33,33,33,0.95);
      color: white;
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 13px;
      max-width: 320px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      pointer-events: none;
      transition: opacity 120ms ease-in-out;
      opacity: 0;
    }
    #${TOOLTIP_ID}.visible { opacity: 1; pointer-events: auto; }
    #${TOOLTIP_ID} .title { font-weight: 600; margin-bottom: 4px; }
    #${TOOLTIP_ID} .sub { font-size: 12px; opacity: 0.95 }
  `
  document.head.appendChild(style)
}

function createTooltip() {
  let t = document.getElementById(TOOLTIP_ID) as HTMLDivElement | null
  if (t) return t
  t = document.createElement('div')
  t.id = TOOLTIP_ID
  t.setAttribute('role', 'tooltip')
  t.innerHTML = `<div class="title"></div><div class="sub"></div>`
  document.body.appendChild(t)
  return t
}

function positionTooltip(tooltip: HTMLElement, x: number, y: number) {
  const pad = 8
  const rect = tooltip.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  let left = x + 12
  let top = y + 12
  if (left + rect.width + pad > vw) left = x - rect.width - 12
  if (top + rect.height + pad > vh) top = y - rect.height - 12
  tooltip.style.left = `${Math.max(6, left)}px`
  tooltip.style.top = `${Math.max(6, top)}px`
}

function isSkippableNode(n: Node) {
  if (!n) return true
  if (n.nodeType !== Node.TEXT_NODE) return true
  const parent = n.parentElement
  if (!parent) return true
  const tag = parent.tagName.toLowerCase()
  if (['script', 'style', 'textarea', 'input'].includes(tag)) return true
  if ((parent as HTMLElement).isContentEditable) return true
  return false
}

function wrapTextNodeWithSpan(textNode: Text, start: number, end: number, attrs: Record<string, string>) {
  const range = document.createRange()
  range.setStart(textNode, start)
  range.setEnd(textNode, end)
  const span = document.createElement('span')
  span.className = HIGHLIGHT_CLASS
  for (const k in attrs) span.setAttribute(k, attrs[k])
  try {
    range.surroundContents(span)
  } catch (e) {
    // fallback: create new text node from substring and replace
    const text = textNode.textContent || ''
    const before = text.slice(0, start)
    const middle = text.slice(start, end)
    const after = text.slice(end)
    const beforeNode = document.createTextNode(before)
    const middleNode = document.createElement('span')
    middleNode.className = HIGHLIGHT_CLASS
    for (const k in attrs) middleNode.setAttribute(k, attrs[k])
    middleNode.textContent = middle
    const afterNode = document.createTextNode(after)
    const parent = textNode.parentNode
    if (!parent) return
    parent.insertBefore(beforeNode, textNode)
    parent.insertBefore(middleNode, textNode)
    parent.insertBefore(afterNode, textNode)
    parent.removeChild(textNode)
  }
}

function findAndWrapInElement(el: Element, search: string, attrs: Record<string, string>) {
  const text = el.textContent || ''
  const needle = search.trim()
  if (!needle) return 0
  let count = 0
  // Walk text nodes and match
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (isSkippableNode(node)) return NodeFilter.FILTER_REJECT
      if (!node.nodeValue) return NodeFilter.FILTER_REJECT
      if (node.nodeValue.toLowerCase().includes(needle.toLowerCase())) return NodeFilter.FILTER_ACCEPT
      return NodeFilter.FILTER_REJECT
    }
  })
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  for (const tn of nodes) {
    const val = tn.nodeValue || ''
    const idx = val.toLowerCase().indexOf(needle.toLowerCase())
    if (idx >= 0) {
      wrapTextNodeWithSpan(tn, idx, idx + needle.length, attrs)
      count++
    }
  }
  return count
}

export function highlightDetections(detections: Detection[]) {
  injectStyles()
  const tooltip = createTooltip()

  // Attach global mouse handlers via event delegation
  function onMouseEnter(e: Event) {
    const el = e.target as HTMLElement | null
    if (!el) return
    const h = el.closest(`.${HIGHLIGHT_CLASS}`) as HTMLElement | null
    if (!h) return
    const allergen = h.getAttribute('data-allergen') || 'Allergen'
    const substitute = h.getAttribute('data-substitute') || 'No suggestion'
    const title = tooltip.querySelector('.title') as HTMLElement
    const sub = tooltip.querySelector('.sub') as HTMLElement
    title.textContent = allergen
    sub.textContent = substitute ? `Suggested substitute: ${substitute}` : ''
    tooltip.classList.add('visible')
    // Position near mouse if possible
    const ev = (e as MouseEvent)
    positionTooltip(tooltip, ev.clientX, ev.clientY)
  }

  function onMouseMove(e: Event) {
    const el = e.target as HTMLElement | null
    const h = el && el.closest ? el.closest(`.${HIGHLIGHT_CLASS}`) as HTMLElement | null : null
    if (h) {
      const ev = e as MouseEvent
      positionTooltip(tooltip, ev.clientX, ev.clientY)
    }
  }

  function onMouseLeave(e: Event) {
    const el = e.target as HTMLElement | null
    const h = el && el.closest ? el.closest(`.${HIGHLIGHT_CLASS}`) as HTMLElement | null : null
    if (!h) return
    tooltip.classList.remove('visible')
  }

  // Add listeners once
  if (!document.body.hasAttribute('data-eatwell-highlighter-listeners')) {
    document.addEventListener('mouseenter', onMouseEnter, true)
    document.addEventListener('mousemove', onMouseMove, true)
    document.addEventListener('mouseleave', onMouseLeave, true)
    document.body.setAttribute('data-eatwell-highlighter-listeners', '1')
  }

  let total = 0
  for (const d of detections) {
    const attrs = {
      'data-ingredient': d.ingredientText,
      'data-allergen': d.allergen,
      'data-substitute': d.substituteSuggested || ''
    }

    if (d.selector) {
      const els = Array.from(document.querySelectorAll(d.selector))
      for (const el of els) {
        total += findAndWrapInElement(el, d.ingredientText, attrs)
      }
    } else {
      // search whole body
      total += findAndWrapInElement(document.body, d.ingredientText, attrs)
    }
  }

  return { highlighted: total }
}

export function clearHighlights() {
  const els = Array.from(document.querySelectorAll(`.${HIGHLIGHT_CLASS}`))
  for (const el of els) {
    const parent = el.parentNode
    if (!parent) continue
    const text = document.createTextNode(el.textContent || '')
    parent.replaceChild(text, el)
  }
  const tooltip = document.getElementById(TOOLTIP_ID)
  if (tooltip && tooltip.parentNode) tooltip.parentNode.removeChild(tooltip)
}
