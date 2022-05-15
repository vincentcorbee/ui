import { clamp, addClassName, removeClassName, forEach } from '@digitalbranch/u'
import Emitter from '@digitalbranch/emitter'

const _private = new WeakMap()

export default class Resizer extends Emitter {
  constructor(node, { pos = 'right', min = 0, max, type = 'horizontal' }) {
    super()

    let self = this
    let parent = node.parentNode

    _private.set(this, {
      parent,
      sibling: null,
      node,
      container: parent.parentNode,
      startX: 0,
      startY: 0,
      width: 0,
      height: 0,
      siblingWidth: 0,
      siblingHeight: 0,
      pos,
      min,
      max:
        max !== undefined
          ? max
          : type === 'vertical'
          ? node.parentNode.clientHeight
          : node.parentNode.clientWidth,
      type,
      resize(e) {
        e.preventDefault()

        let {
          startX,
          startY,
          width,
          height,
          siblingWidth,
          siblingHeight,
          parent,
          sibling,
          min,
          max,
          stop,
          pos,
        } = _private.get(self)
        let { clientX: curX, clientY: curY } = e
        // let containerDim =
        //   type === 'horizontal' ? container.clientWidth : container.clientHeight
        let newWidth = clamp(
          pos === 'left' ? Math.abs(curX - (startX + width)) : curX - startX + width,
          min,
          max
        )
        let newHeight = clamp(
          pos === 'left' ? Math.abs(curY - (startY + height)) : curY - startY + height,
          min,
          max
        )

        // Het onderstaande kan in 1 blok
        if (type === 'horizontal' && newWidth >= min && newWidth <= max) {
          if (sibling) {
            sibling.style.minWidth = siblingWidth - (newWidth - width) + 'px'
            sibling.style.width = siblingWidth - (newWidth - width) + 'px'
            sibling.style.MaxWidth = 'none'
          }

          parent.style.minWidth = newWidth + 'px'
          parent.style.width = newWidth + 'px'
          parent.style.MaxWidth = 'none'

          self.emit('resizing', {
            type: 'resizing',
            direction: type,
            parent: parent,
            dimension: newWidth,
          })
        } else if (type === 'vertical' && newHeight >= min && newHeight <= max) {
          if (sibling) {
            sibling.style.minHeight = siblingHeight - (newHeight - height) + 'px'
            sibling.style.height = siblingHeight - (newHeight - height) + 'px'
            sibling.style.maxHeight = 'none'
          }

          parent.style.minHeight = newHeight + 'px'
          parent.style.height = newHeight + 'px'
          parent.style.maxHeight = 'none'

          self.emit('resizing', {
            type: 'resizing',
            direction: type,
            dimension: newHeight,
            parent: parent,
          })
        }

        window.addEventListener('mouseup', stop, false)
      },
      stop() {
        let { node, resize } = _private.get(self)

        removeClassName(node, 'drag')

        window.removeEventListener('mousemove', resize, false)
      },
      start(e) {
        e.preventDefault()

        let { parent, node, resize, container, type } = _private.get(self)

        if (e.button === 0) {
          let sibling =
            pos === 'right' ? parent.nextElementSibling : parent.previousElementSibling

          _private.get(self).sibling = sibling
          _private.get(self).startX = e.clientX
          _private.get(self).startY = e.clientY
          _private.get(self).width = parent.clientWidth
          _private.get(self).height = parent.clientHeight
          _private.get(self).siblingWidth = sibling ? sibling.clientWidth : 0
          _private.get(self).siblingHeight = sibling ? sibling.clientHeight : 0

          parent.style.transition = 'none'

          forEach(container.children, sibling => {
            sibling.style[type === 'vertical' ? 'minHeight' : 'minWidth'] =
              sibling[type === 'vertical' ? 'clientHeight' : 'clientWidth'] + 'px'
            sibling.style[type === 'vertical' ? 'height' : 'width'] =
              sibling[type === 'vertical' ? 'clientHeight' : 'clientWidth'] + 'px'
            sibling.style[type === 'vertical' ? 'maxHeight' : 'maxWidth'] = 'none'
          })

          window.addEventListener('mousemove', resize, false)

          addClassName(node, 'drag')
        }
      },
    })

    node.addEventListener('mousedown', _private.get(self).start, false)
  }
}
