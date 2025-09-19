export interface SortItem {
  id: string
  text: string
  el: HTMLElement
}

export interface SortSlot {
  id: string
  context: string
  el: HTMLElement
}

const clean = (s: string | null | undefined) => (s || '').replace(/\s+/g, ' ').trim()

export function isSortQuestion(): boolean {
  return (
    document.querySelectorAll('kp-drag-item').length > 0 &&
    document.querySelectorAll('kp-drop-target').length > 0
  )
}

export function getSortItems(): SortItem[] {
  const items = Array.from(document.querySelectorAll('kp-drag-item')) as HTMLElement[]
  return items
    .filter((el) => isVis(el))
    .map((el) => ({ id: el.id || '', text: clean(el.textContent || ''), el }))
    .filter((i) => i.text.length > 0)
}

export function getSortSlots(): SortSlot[] {
  const slots = Array.from(document.querySelectorAll('kp-drop-target')) as HTMLElement[]
  const slotRows = slots.filter((el) => isVis(el))
  return slotRows.map((el) => ({ id: el.id || '', context: getRowContext(el), el }))
}

function isVis(el: HTMLElement | null): el is HTMLElement {
  if (!el) return false as any
  const r = el.getBoundingClientRect()
  const cs = window.getComputedStyle(el)
  return r.width > 5 && r.height > 5 && cs.display !== 'none' && cs.visibility !== 'hidden'
}

function getRowContext(el: HTMLElement): string {
  // Try obvious text nodes in the same row
  const row = el.closest('kp-sort-row, .row, .sia-row, .answer-row, [class*="row"], [class*="answer"]') as HTMLElement | null
  if (row) {
    // Prefer a labelled element to the right
    const candidates = Array.from(row.querySelectorAll('p, span, div, .label, .text')) as HTMLElement[]
    for (const c of candidates) {
      const t = clean(c.textContent || '')
      if (t && t !== '?' && !el.contains(c) && !c.contains(el)) return t
    }
    const tx = clean(row.textContent || '').replace(/\?\s*/g, '').trim()
    if (tx) return tx
  }
  // Fallback: parent text
  const t = clean((el.parentElement?.textContent || '').replace(/\?\s*/g, ''))
  return t || 'Row'
}

export async function performSortPairs(
  pairs: Array<{ row: number; item: number }>,
  items: SortItem[],
  slots: SortSlot[]
): Promise<void> {
  for (const { row, item } of pairs) {
    const slot = slots[row - 1]?.el
    const it = items[item - 1]?.el
    if (!slot || !it) continue
    const ok = await simulateHtml5Drop(it, slot)
    if (!ok) {
      // Click fallbacks, try both orders
      try { slot.click(); await delay(60); it.click() } catch {}
      if (!(await waitPopulated(slot))) {
        try { it.click(); await delay(60); slot.click() } catch {}
        await delay(60)
      }
    }
    await delay(120)
  }
}

async function simulateHtml5Drop(source: HTMLElement, target: HTMLElement): Promise<boolean> {
  try {
    const dt = new DataTransfer()
    const center = (el: HTMLElement) => {
      const r = el.getBoundingClientRect()
      return { clientX: Math.floor(r.left + r.width / 2), clientY: Math.floor(r.top + r.height / 2) }
    }
    const s = center(source)
    // Many implementations attach listeners to a child DIV inside kp-drop-target
    const inner = (target.querySelector('div, [role="button"], [draggable], *') as HTMLElement) || target
    const t = center(inner)
    // Some UIs expect pointerdown/mousedown before dragstart to set aria-grabbed
    source.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, buttons: 1, clientX: s.clientX, clientY: s.clientY }))
    source.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, buttons: 1, clientX: s.clientX, clientY: s.clientY }))

    source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: s.clientX, clientY: s.clientY }))
    inner.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: t.clientX, clientY: t.clientY }))
    inner.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: t.clientX, clientY: t.clientY }))
    inner.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: t.clientX, clientY: t.clientY }))
    source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: t.clientX, clientY: t.clientY }))

    // Wait briefly for class update
    const ok = await waitPopulated(target)
    return ok
  } catch {
    return false
  }
}

function waitPopulated(target: HTMLElement, ms = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now()
    const iv = window.setInterval(() => {
      const ok = target.classList.contains('populated') || target.classList.contains('ng-valid')
      if (ok || Date.now() - start > ms) {
        clearInterval(iv)
        resolve(ok)
      }
    }, 40)
  })
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)) }
