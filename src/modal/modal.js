import Emitter from '@digitalbranch/emitter'
import { isType, createNewElement, append, removeListener, addListener, animate } from '@digitalbranch/u'

export default class Modal extends Emitter {
  constructor (obj) {
    super()

    this.target = obj.target && isType('Node', obj.target) ? obj.target
      : obj.target ? document.getElementById(obj.target) || document.querySelector(`.${obj.target}`) || document[obj.target]
        : document.body
    this.heightOverlay = 0
    this.heightModal = 0
    this.contentBox = null
    this.container = null
    this.content = null
    this.height = obj.height || null
    this.width = obj.width || null
    this.overlay = null
    this.position = obj.position || 'top'
    this.id = obj.id || null
    this.scrollToTop = obj.scrollToTop || false
    this.active = false
    this.modal = null

    if (obj) {
      this.create(obj)
    }
  }
  resize () {
    let offset = window.pageYOffset

    this.modal.style.height = this.heightOverlay + offset + 'px'
  }
  reposition () {
    let innerWidth = window.innerWidth
    let contentWidth = this.container.offsetWidth

    this.container.style.left = (innerWidth - contentWidth) / 2 + 'px'
  }
  create (obj) {
    let overlay = this.overlay = createNewElement('div', ['class=modal_overlay'])
    let wrapper = this.container = createNewElement('div', ['class=modal_container'])
    let contentBox = this.contentBox = createNewElement('div', ['class=modal_contentBox'])
    let content = this.content = obj.content || ''

    if (obj.id) {
      overlay.id = obj.id
    }

    if (obj.listener) {
      this.listener = obj.listener

      wrapper.addEventListener('click', obj.listener.bind(this), false)
    } else if (obj.listener === false) {
      this.listener = false
    }

    append(wrapper, contentBox)

    if (content) {
      let arr = isType('array', content) ? content : [content]
      arr.forEach(element => {
        if (isType('node', element) || isType('documentFragment', element)) {
          append(contentBox, element)
        } else {
          contentBox.innerHTML += element
        }
      })
    }

    append(overlay, wrapper)

    this.modal = overlay
  }
  close (e, callback) {
    if (e && e.target.className !== 'modal_overlay') return

    if (this.active) {
      let that = this
      let { modal, contentBox, container, close, target } = that
      let doc = document.documentElement
      let contentHeight = container.offsetHeight
      let contentWidth = container.offsetWidth
      let scrolled = doc.scrollTop
      if (that.listener) {
        removeListener(modal, 'click', close)
      }
      that.active = false
      container.style.overflow = 'hidden'
      animate({
        fn: rate => {
          if (that.scrollToTop) {
            doc.scrollTop = scrolled - (scrolled * rate)
          }
          contentBox.style.opacity = 1 - rate
        },
        dur: 0.4
      }, {
        fn: rate => {
          container.style.height = contentHeight - (contentHeight * rate) + 'px'
          container.style.width = contentWidth - (contentWidth * rate) + 'px'
          if (rate === 1) {
            target.removeChild(modal)
            container.removeAttribute('style')
            contentBox.removeAttribute('style')
            modal.removeAttribute('style')
            that.emit('close', { event: 'close' })
            if (callback) {
              callback()
            }
          }
        },
        dur: 0.4
      })
    }
  }
  open (cb) {
    if (!this.active) {
      let that = this
      let docFrag = createNewElement('documentFragment')
      let { modal, contentBox, container, heightOverlay, target, close, reposition, width, height, position } = that
      let doc = document.documentElement
      let innerWidth = window.innerWidth
      let innerHeight = window.innerHeight
      let pageYOffset = window.pageYOffset

      append(docFrag, modal)
      append(target, docFrag)

      if (this.listener !== false) {
        addListener(modal, 'click', bind(close, this))
      }

      addListener(window, 'resize', bind(reposition, this))

      let offset = container.offsetTop * 2
      let contentHeight = height || container.offsetHeight
      let contentWidth = width || container.offsetWidth

      if (this.position === 'middle') {
        // klopt niks van
        container.style.top = (innerHeight - (doc.scrollHeight - innerHeight) - contentHeight) / 2 + 'px'
      } else if (position === 'top') {
        container.style.top = '0px'
      }

      container.style.overflow = 'hidden'
      container.style.left = (innerWidth - contentWidth) / 2 + 'px'
      container.style.height = 0
      container.style.width = 0
      contentBox.style.opacity = 0

      modal.style.zIndex = getZindex()

      heightOverlay = innerHeight + pageYOffset

      this.heightOverlay = heightOverlay > contentHeight + offset ? heightOverlay : contentHeight + offset

      modal.style.height = this.heightOverlay + 'px'

      this.active = true

      animate({
        fn(rate) {
          modal.style.opacity = rate
          container.style.width = (contentWidth * rate) + 'px'
          container.style.height = (contentHeight * rate) + 'px'
          container.style.minHeight = (contentHeight * rate) + 'px'

          if (rate === 1) {
            container.style.overflow = 'visible'
            container.style.height = 'auto'
            container.style.minHeight = 'initial'
          }
        },
        dur: 0.4
      }, {
        fn(rate) {
          contentBox.style.opacity = rate

          if (rate === 1) {
            if (cb && isType('function', cb)) {
              cb.call(that)
            }
          }
        },
        dur: 0.4
      })
    }

    return this
  }
}
