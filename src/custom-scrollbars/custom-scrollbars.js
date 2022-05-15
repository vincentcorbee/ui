import {
  isType,
  getOffset,
  createNewElement,
  bind,
  capFirst,
  addListener,
  removeListener,
  append,
  clamp
} from '@digitalbranch/u'
import Emitter from '@digitalbranch/emitter'
import normalizeWheel from '../../lib/normalizeWheel'

const onResize = () => {
  let elements = []
  let listen = () =>
    elements.forEach(element => {
      let {
        node: { offsetWidth, offsetHeight },
        width,
        height
      } = element
      if (width !== offsetWidth || height !== offsetHeight) {
        element.node.setAttribute(
          'data-resized',
          offsetWidth - width + ',' + (offsetHeight - height)
        )
        element.width = offsetWidth
        element.height = offsetHeight
      }
    })
  return {
    add: node =>
      elements.push({
        node,
        width: node.offsetWidth,
        height: node.offsetHeight
      }),
    listen
  }
}

const emitScrollEvent = (inst, target) =>
  inst.container.emit('scrolling', {
    type: 'scrolling',
    target,
    scrollbar: inst,
    progress: inst.position
  })
const getContentDimensions = viewport => ({
  height: viewport.scrollHeight,
  width: viewport.scrollWidth
})

let resizeEvent = onResize()
let containers = []

class Container extends Emitter {
  constructor(node, win = null) {
    super()

    let scrolling = (node.dataset.scroll || '').split(',').map(axis => axis.trim())

    this.observer = new window.MutationObserver(mutations =>
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' || mutation.type === 'subtree') {
          this.insertScrollbars()
        } else if (mutation.attributeName === 'data-resized') {
          this.resizeScrollbars()
        }
      })
    )

    this.scrollbars = {}
    this.node = node
    this.scrollableContent = {
      x: node.scrollWidth - node.clientWidth,
      y: node.scrollHeight - node.clientHeight
    }
    this.viewport =
      node.nodeName === 'HTML' || node.nodeName === 'BODY'
        ? node.ownerDocument.documentElement
        : node
    this.width = node.clientWidth
    this.height = node.clientHeight
    this.content = {
      width: node.scrollWidth,
      height: node.scrollHeight
    }
    this.windowContentRatio = {
      x: node.clientWidth / node.scrollWidth || 0,
      y: node.clientHeight / node.scrollHeight || 0
    }
    this.offset = getOffset(node)
    this.createScrollbars(scrolling)
    this.addWheelEvent(this.viewport)
    this.win = win

    for (const child of this.node.children) {
      if (child.nodeName && child.nodeName === 'IFRAME') {
        this.addWheelEvent(child.contentDocument.documentElement)
      }
    }

    if (win) {
      win.on('resizing', this.resizeScrollbars.bind(this))
    } else {
      window.addEventListener('resize', resizeEvent.listen, false)
      resizeEvent.add(node)
    }

    this.addDragEvent()

    if (this.scrollbars.x && this.scrollbars.y) {
      node.classList.add('duo')
    }
  }

  createScrollbars(scrolling) {
    let that = this
    let { scrollbars } = that

    scrolling.forEach(axis => (scrollbars[axis] = new Scrollbar(that, axis)))
    that.insertScrollbars()
  }

  setScrollbars(...scrolling) {
    for (const scrollbar in this.scrollbars) {
      this.removeScrollbar(scrollbar)
    }
    this.node.dataset.scroll = scrolling.join(',')
    this.createScrollbars(scrolling)
  }

  removeScrollbar(axis) {
    let scrollbar = this.scrollbars[axis]
    let container = scrollbar.container

    removeListener(scrollbar.thumb, 'mousedown', bind(scrollbar.start, scrollbar))
    removeListener(scrollbar.track, 'click', bind(scrollbar.scrollTo, scrollbar))

    if (container.node.contains(scrollbar.bar)) {
      container.node.removeChild(scrollbar.bar)
    }

    delete this.scrollbars[axis]
  }

  addWheelEvent(node) {
    let that = this
    let { scrollbars } = that

    addListener(node, normalizeWheel.getEventType(), e => {
      let normValues = normalizeWheel(e)
      let { spinX, spinY } = normValues

      if (spinX !== 0) {
        if (scrollbars.x) {
          scrollbars.x.scroll(e, normValues)
        }
      }

      if (spinY !== 0) {
        if (scrollbars.y) {
          scrollbars.y.scroll(e, normValues)
        }
      }
    }, false, { passive: true })
  }

  addDragEvent() {
    let that = this
    let { node, width, height, scrollbars } = that
    let offset = getOffset(node)
    let x = 0
    let y = 0
    let toScroll = 0
    let scrolling = false
    let t = null
    let curEl = null

    const getElement = () => {
      let el = document.elementFromPoint(x, y)
      if (curEl !== el) {
        curEl = el
      }
      that.emit('draggScroll', {
        type: 'draggScroll',
        target: el
      })
    }

    const scroll = scrollbar => {
      if (scrolling) {
        let o = {
          type: 'drag'
        }
        o[scrollbar.axis] = toScroll
        scrollbar.scroll(o)
        t = null
        t = setTimeout(() => scroll(scrollbar), (100 / 10) * Math.abs(toScroll))
        getElement()
      } else {
        clearTimeout(t)
        t = null
      }
    }
    const move = e => {
      let { target } = e
      let eX = e.x
      let eY = e.y
      if (eX - x >= 0 && eX - offset.x > width - 40) {
        toScroll = eX - x === 0 ? 1 : eX - x
        if (
          scrollbars.x &&
          (scrollbars.x.track !== target && !scrollbars.x.track.contains(target)) &&
          !scrolling
        ) {
          scrolling = true
          scroll(scrollbars.x)
        }
      } else if (eX - x <= 0 && e.x - offset.x < 40) {
        toScroll = eX - x === 0 ? -1 : eX - x
        if (
          scrollbars.x &&
          (scrollbars.x.track !== target && !scrollbars.x.track.contains(target)) &&
          !scrolling
        ) {
          scrolling = true
          scroll(scrollbars.x)
        }
      } else if (eY - y >= 0 && eY - offset.y > height - 40) {
        toScroll = eY - y === 0 ? 1 : eY - y
        if (
          scrollbars.y &&
          (scrollbars.y.track !== target && !scrollbars.y.track.contains(target)) &&
          !scrolling
        ) {
          scrolling = true
          scroll(scrollbars.y)
        }
      } else if (eY - y <= 0 && eY - offset.y < 40) {
        toScroll = eY - y === 0 ? -1 : eY - y
        if (
          scrollbars.y &&
          (that.scrollbars.y.track !== target && !scrollbars.y.track.contains(target)) &&
          !scrolling
        ) {
          scrolling = true
          scroll(scrollbars.y)
        }
      } else {
        scrolling = false
      }
      y = eY
      x = eX
    }
    const stop = e => {
      clearTimeout(t)

      scrolling = false

      removeListener(window, 'mousemove', move)
      removeListener(window, 'mouseup', stop)
    }
    addListener(node, 'mousedown', e => {
      if (e.button !== 0) return

      x = e.x
      y = e.y

      addListener(window, 'mousemove', move)
      addListener(window, 'mouseup', stop)
    })
  }
  sizeFrame(frame) {
    frame.style.height = null

    let that = this
    let doc = frame.contentDocument
    let html = doc.documentElement
    let height = html.scrollHeight
    let width = html.scrollWidth

    frame.style.height = height > that.height ? height + 'px' : '100%'
    frame.style.width = width > that.width ? width + 'px' : '100%'
  }
  insertScrollbars() {
    let that = this
    let { scrollbars, observer, sizeFrame, node } = that
    let config = {
      childList: true,
      attributes: true
    }
    let docFrag = createNewElement('documentFragment')

    observer.disconnect()

    for (const child of node.children) {
      if (child.nodeName && child.nodeName === 'IFRAME') {
        sizeFrame(child)
        observer.observe(child.contentDocument.documentElement, config)
      }
    }

    that.updateDimensions()

    for (const axis in scrollbars) {
      const scrollbar = scrollbars[axis]

      append(docFrag, scrollbar.bar)
      append(node, docFrag)
      addListener(scrollbar.thumb, 'mousedown', bind(scrollbar.start, scrollbar))
      addListener(scrollbar.track, 'click', bind(scrollbar.scrollTo, scrollbar))
    }
    observer.observe(node, config)
  }
  resizeScrollbars() {
    let that = this
    let {
      width,
      height,
      viewport,
      viewport: { clientWidth, clientHeight },
      scrollbars: { x, y }
    } = that

    for (const child of that.node.children) {
      if (child.nodeName && child.nodeName === 'IFRAME') {
        that.sizeFrame(child)
      }
    }

    let resized = viewport
      .getAttribute('data-resized')
      .split(',')
      .map(a => parseInt(a, 10))

    if (width !== clientWidth && x) {
      x.resizeScrollbar(resized)
    }

    if (height !== clientHeight && y) {
      y.resizeScrollbar(resized)
    }
  }
  updateDimensions(adjust = 0) {
    let that = this
    let { viewport, scrollbars } = that
    let clientWidth = viewport.clientWidth
    let clientHeight = viewport.clientHeight
    let dimensions = getContentDimensions(viewport)
    let contentHeight = dimensions.height
    let contentWidth = dimensions.width
    let scroll = {
      scrollTop: viewport.scrollTop,
      scrollLeft: viewport.scrollLeft
    }

    that.width = clientWidth
    that.height = clientHeight
    that.content.width = contentWidth
    that.content.height = contentHeight
    that.scrollableContent.x = contentWidth > clientWidth ? contentWidth - clientWidth : 0
    that.scrollableContent.y =
      contentHeight > clientHeight ? contentHeight - clientHeight : 0
    that.windowContentRatio.x = clientWidth / contentWidth
    that.windowContentRatio.y = clientHeight / contentHeight

    for (let axis in scrollbars) {
      if (scrollbars.hasOwnProperty(axis)) {
        that.scrollableContent[axis] -= adjust
        let scrollbar = scrollbars[axis]
        let d = axis === 'y' ? 'top' : 'left'
        let dir = axis === 'x' ? 'width' : 'height'
        let size = clamp((that[dir] / that.content[dir] || 1) * 100, 0, 100)
        size = size < 8 ? 8 : size
        let scrollable = clamp(
          ((that.scrollableContent[axis] - scroll[`scroll${capFirst(d)}`]) /
            that.scrollableContent[axis]) *
            100 || 0,
          0,
          100
        )
        let scrolled = clamp(100 - scrollable, 0, 100)
        let thumbOffset = ((100 - size) / 100) * scrolled
        scrollbar.position = clamp(100 - scrolled, 0, 100)
        scrollbar.thumb.style[dir] = size + '%'
        scrollbar.thumb.style[d] = thumbOffset + '%'
        scrollbar.thumb.setAttribute('aria-hidden', size === 100)
        scrollbar.track.style[d] = scroll[`scroll${capFirst(d)}`] + 'px'
      }
    }
  }
  refresh() {
    this.insertScrollbars()
  }
  clear() {
    let that = this

    that.observer.disconnect()

    for (let bar in that.scrollbars) {
      that.node.removeChild(that.scrollbars[bar].bar)
    }

    containers = containers.filter(c => c !== that)
  }
  scrollTo(params) {
    let that = this
    let { position } = params
    let {
      offset,
      node: { offsetWidth },
      scrollbars
    } = that
    let scrollbar = scrollbars[params.axis]
    let obj = {
      target: scrollbar.track
    }
    obj[params.axis] = offsetWidth + (offset[params.axis] / 100) * position
    scrollbar.scrollTo(obj)
  }
  position(axis) {
    let position = this.scrollbars[axis].position

    return position ? 100 - position : position
  }
}
class Scrollbar extends Emitter {
  constructor(container, axis) {
    super()
    this.axis = axis
    this.container = container
    this.bar = null
    this.thumb = null
    this.track = null
    this.position = 100
    this.startPosition = 0
    this.createScrollbar()
  }
  createScrollbar() {
    let that = this
    let track = createNewElement('div', ['class=track ' + that.axis])
    let thumb = createNewElement('div', ['class=thumb'])

    that.bar = append(track, thumb)
    that.thumb = thumb
    that.track = track
  }
  resizeScrollbar(resized) {
    let that = this
    let {
      container,
      axis,
      position,
      container: { node }
    } = that
    let siblingAxis = axis === 'x' ? 'y' : 'x'
    let dir = axis === 'x' ? 'left' : 'top'
    let dim = axis === 'x' ? 'width' : 'height'
    let base = node['scroll' + capFirst(dim)] - node['client' + capFirst(dim)]
    let sibling = container.scrollbars[siblingAxis]
    let adjust = 0

    if (position === 0 && base >= 0) {
      adjust = resized[axis === 'x' ? 0 : 1]
      node['scroll' + capFirst(dir)] -= adjust
      if (sibling) {
        let offset =
          node['scroll' + capFirst(siblingAxis === 'x' ? 'left' : 'top')] -
          (getContentDimensions(container.viewport)[
            siblingAxis === 'x' ? 'width' : 'height'
          ] -
            container.viewport[
              'client' + capFirst(siblingAxis === 'x' ? 'width' : 'height')
            ])
        sibling.bar.style[axis === 'x' ? 'right' : 'bottom'] =
          -node['scroll' + capFirst(dir)] + 'px'
        node['scroll' + capFirst(siblingAxis === 'x' ? 'left' : 'top')] -=
          offset > 0 ? offset : 0
      }
    } else if (position === 100) {
      node['scroll' + capFirst(dir)] = 0
    }
    container.updateDimensions(adjust)
  }
  start(e) {
    if (e instanceof window.Event) {
      e.preventDefault()
      e.stopImmediatePropagation()
    }

    let that = this
    let {
      thumb,
      axis,
      start,
      container,
      scroll,
      stop,
      thumb: { offsetTop, offsetLeft }
    } = that
    container.node.setAttribute('data-resized', '0,0')
    thumb.setAttribute('aria-pressed', true)

    if (e.button === 0) {
      that.startPosition = e[axis]
      that.offset = axis === 'x' ? offsetLeft : offsetTop
      removeListener(thumb, 'mousedown', start)
      addListener(window, 'mousemove', bind(scroll, that))
      addListener(window, 'mouseup', bind(stop, that))
    }
  }
  stop(e) {
    let that = this
    let { thumb, scroll, start, stop } = that

    thumb.setAttribute('aria-pressed', false)

    removeListener(window, 'mousemove', scroll)
    removeListener(window, 'mouseup', stop)
    addListener(thumb, 'mousedown', bind(start, that))
  }
  scroll(e, normValues) {
    if (e instanceof window.Event) {
      e.preventDefault()
      e.stopImmediatePropagation()
    }

    let that = this
    let { type, target } = e
    let {
      track,
      bar,
      axis,
      thumb,
      position,
      offset,
      startPosition,
      container,
      container: { node }
    } = that

    let dir = axis === 'x' ? 'left' : 'top'
    let dim = axis === 'x' ? 'width' : 'height'
    let trackDim = track['client' + capFirst(dim)]
    let thumbDim = thumb['offset' + capFirst(dim)]
    let base = container.scrollableContent[axis]
    let sibling = container.scrollbars[axis === 'x' ? 'y' : 'x']
    let X = Math.floor((base / 100) * (100 - position))
    let scrolled =
      ((type === 'mousemove'
        ? e[axis] - startPosition + offset
        : type === 'drag'
        ? -e[axis]
        : -normValues['spin' + capFirst(axis)]) /
        (trackDim - thumbDim)) *
      100
    let offsetThumb =
      ((((trackDim - thumbDim) / 100) *
        (100 - position) *
        ((trackDim - thumbDim) / trackDim)) /
        (trackDim - thumbDim)) *
      100

    if (type === 'mousemove') {
      that.position = clamp(100 - scrolled, 0, 100)
    } else {
      that.position = clamp(position + scrolled, 0, 100)
    }

    if (that.position === 100) {
      node['scroll' + capFirst(dir)] = 0
      bar.style[dir] = 0
      thumb.style[dir] = 0
    } else if (that.position === 0) {
      node['scroll' + capFirst(dir)] = X
      bar.style[dir] = X + 'px'
      thumb.style[dir] = trackDim - thumbDim + 'px'
    } else {
      node['scroll' + capFirst(dir)] = X
      bar.style[dir] = X + 'px'
      thumb.style[dir] = offsetThumb + '%'
    }

    if (sibling) {
      sibling.bar.style[axis === 'x' ? 'right' : 'bottom'] =
        -node['scroll' + capFirst(dir)] + 'px'
    }

    emitScrollEvent(that, target)
  }
  scrollTo(e) {
    let that = this
    let { target } = e
    let {
      axis,
      bar,
      thumb,
      container,
      track,
      position,
      container: { scrollableContent, scrollbars, offset }
    } = that
    track = target === track ? target : null
    let dir = axis === 'x' ? 'left' : 'top'
    let dim = axis === 'x' ? 'width' : 'height'
    let base = scrollableContent[axis]
    let sibling = scrollbars[axis === 'x' ? 'y' : 'x']
    let mousePos = e[axis] - offset[axis]

    container.node.setAttribute('data-resized', '0,0')

    if (track) {
      let trackDim = track['client' + capFirst(dim)]
      let thumbDim = thumb['offset' + capFirst(dim)]

      that.position = clamp(
        ((trackDim - thumbDim / 2 - mousePos) / (trackDim - thumbDim)) * 100,
        0,
        100
      )

      let X = Math.floor((base / 100) * (100 - position))

      thumb.style[dir] =
        position === 100
          ? 0
          : (position === 0 ? trackDim - thumbDim : mousePos - thumbDim / 2) + 'px'
      if (sibling) {
        sibling.bar.style[axis === 'x' ? 'right' : 'bottom'] = -X + 'px'
      }

      container.node['scroll' + capFirst(dir)] = X
      bar.style[dir] = X + 'px'
    }
  }
}

export default {
  create(nodes, config) {
    let cons = []
    nodes = isType('Array', nodes) ? nodes : [nodes]
    nodes.forEach(node => {
      let container = new Container(node, config)
      cons.push(container)
      containers.push(container)
    })
    return cons.length === 0 ? null : cons.length === 1 ? cons[0] : cons
  },
  refresh: () => containers.forEach(container => container.refresh()),
  clear() {
    containers.forEach(container => {
      container.observer.disconnect()
      for (let bar in container.scrollbars) {
        container.node.removeChild(container.scrollbars[bar].bar)
      }
    })
    containers = []
  },
  on: (event, cb) => containers.forEach(container => container.on(event, cb)),
  scrollTo: (node, params) =>
    containers.forEach(container => {
      if (container.node === node) {
        let scrollbar = container.scrollbars[params.axis]
        let obj = {
          target: scrollbar.track
        }
        obj[params.axis] =
          node.offsetWidth + (container.offset[params.axis] / 100) * params.position
        scrollbar.scrollTo(obj)
      }
    }),
  position(node, scrollbar) {
    let position = containers
      .filter(container => container.node === node)
      .map(container => container.scrollbars[scrollbar].position)[0]

    return position ? 100 - position : position
  }
}
