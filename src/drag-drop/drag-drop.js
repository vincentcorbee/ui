import { createNewElement, getOffset, addListener, insertAfter, clamp, removeStyles, removeListener, bind, forEach, map, getZindex } from '@digitalbranch/u'
import Emitter from '@digitalbranch/emitter'
import Cursor from '../cursor/cursor'

const _private = new WeakMap()

export default class DragDrop extends Emitter {
  constructor(
    parent,
    container,
    { grid = false, bounds = {}, dropMsg = 'Drop here' } = {}
  ) {
    super()

    const self = this
    const htmlElement = container ?? document.documentElement
    const draggables = Array.prototype.slice(container.querySelectorAll('.draggable'))

    _private.set(this, {
      htmlElement,
      scrollable: container ?? window,
      doc: parent.ownerDocument,
      win: parent.ownerDocument.defaultView,
      bounds,
      draggables,
      cursor: new Cursor(htmlElement),
      grid,
      parent,
      dropMsg,
      getParent(child, className) {
        let parent = null

        if (child.classList.contains(className)) {
          return child
        }

        while (child.parentNode) {
          child = child.parentNode

          if (
            child.classList &&
            child.classList.contains(className) &&
            _private.get(self).htmlElement.contains(child)
          ) {
            parent = child
            break
          }
        }

        return parent
      },
      init(e) {
        const {
          bounds,
          grid,
          getParent,
          cursor,
          parent,
          doc,
          draggables,
          scrollable,
          dropMsg
        } = _private.get(self)
        const { target, button, currentTarget } = e
        const { draggableArea } = this

        if (target === draggableArea && button === 0) {
          const draggable = getParent(currentTarget, 'draggable')

          if (draggable) {
            const initialStyles = (draggable.getAttribute('style') || '')
              .split(';')
              .filter(prop => prop)
            const startOffset = getOffset(draggable, parent)
            const dropzone = createNewElement('div', [
              'class=dropzone',
              `content=${dropMsg}`
            ])
            const draggableWidth = draggable.size
              ? draggable.size.width
              : draggable.getBoundingClientRect().width
            const draggableHeight = draggable.size
              ? draggable.size.height
              : draggable.getBoundingClientRect().height

            let scrolled = htmlElement.scrollTop
            let draggableY = draggable.offsetTop

            draggable.style.pointerEvents = 'none'
            draggable.style.transition = 'none'

            draggable.setAttribute('data-drag', true)

            doc.body.classList.add('dragging')

            if (grid) {
              draggable.style.minWidth = draggableWidth + 'px'
              draggable.style.minHeight = draggableHeight + 'px'
            }

            const setElement = () =>
              draggable.style.top = draggableY + (htmlElement.scrollTop - scrolled) + 'px'

            const drag = e => {
              const offset = getOffset(draggable, parent)
              const { target, clientY } = e
              const mouseY = clientY - htmlElement.scrollTop

              draggableY = draggable.offsetTop
              scrolled = htmlElement.scrollTop

              draggable.style.left = offset.x + cursor.moved.x + 'px'
              draggable.style.top =
                clamp(
                  offset.y + cursor.moved.y,
                  bounds.top ?? 0,
                  parent.clientHeight
                ) + 'px'
              draggable.style.pointerEvents = 'none'

              if (window.innerHeight - mouseY < 150) {
                htmlElement.scrollTop += 20

                self.emit('scroll', {
                  type: 'scroll',
                  target: draggable,
                  x: 20
                })
              } else if (mouseY < 50) {
                htmlElement.scrollTop -= 20

                self.emit('scroll', {
                  type: 'scroll',
                  target: draggable,
                  x: -20
                })
              }

              self.emit('dragging', {
                x: offset.x + cursor.moved.x,
                y: offset.y + cursor.moved.y,
                target: draggable
              })

              if (grid) {
                const element = getParent(target, 'draggable')

                if (element) {
                  const { x, y } = getOffset(element)
                  const height = element.offsetHeight / 2
                  const width = element.offsetWidth / 2
                  const [, position = ''] = dropzone.className.split(' ')
                  const offsetY = e.pageY - y
                  const offsetX = e.pageX - x
                  const parentNode = element.parentNode

                  dropzone.style.minWidth = draggableWidth + 'px'
                  dropzone.style.minHeight = draggableHeight + 'px'

                  console.log(height, y, offsetY)

                  if (
                    width < offsetX &&
                    (position !== 'after' ||
                      dropzone.previousElementSibling !== element)
                  ) {
                    insertAfter(dropzone, element)

                    dropzone.classList.remove('before')
                    dropzone.classList.add('after')
                  } else if (
                    width > offsetX &&
                    (position !== 'before' || dropzone.nextElementSibling !== element)
                  ) {
                    parentNode.insertBefore(dropzone, element)

                    dropzone.classList.remove('after')
                    dropzone.classList.add('before')
                  } else if (
                    height < offsetY &&
                    (position !== 'after' ||
                      dropzone.previousElementSibling !== element)
                  ) {
                    insertAfter(dropzone, element)

                    dropzone.classList.remove('before')
                    dropzone.classList.add('after')
                  } else if (
                    height > offsetY &&
                    (position !== 'before' || dropzone.nextElementSibling !== element)
                  ) {
                    parentNode.insertBefore(dropzone, element)

                    dropzone.classList.remove('after')
                    dropzone.classList.add('before')
                  }
                } else if (
                  target !== dropzone &&
                  target !== draggable &&
                  target.children.length === 0
                ) {
                  target.appendChild(dropzone)
                }

              }
            }
            const stop = () => {
              if (document.body.contains(dropzone)) {
                self.emit('drop', {
                  type: 'drop',
                  target: draggable
                })

                dropzone.parentNode.replaceChild(draggable, dropzone)
              } else if (!grid) {
                self.emit('drop', {
                  type: 'drop',
                  target: draggable
                })
              }
              if (grid) {
                removeStyles(draggable, initialStyles)
              }

              draggable.style.pointerEvents = null
              draggable.style.transition = null

              draggable.removeAttribute('data-drag')

              doc.body.classList.remove('dragging')

              removeListener(parent, 'mousemove', drag)
              removeListener(doc, 'mouseup', stop)
              removeListener(scrollable, 'scroll', setElement)
            }

            if (button === 0) {
              draggable.style.left = startOffset.x + 'px'
              draggable.style.top = startOffset.y + 'px'
              draggable.style.position = 'absolute'
              draggable.style.opacity = grid ? 0.7 : 1

              if (!grid) {
                const zIndex = map(draggables, draggable => {
                  const node = draggable.node ?? draggable
                  const index = parseInt(node.style.zIndex, 10)

                  if (Number.isNaN(index)) {
                    node.style.zIndex = 0
                    index = 0
                  }

                  return index
                })

                const newIndex = zIndex.sort((a, b) => a - b)[zIndex.length - 1] + 1
                const curIndex = parseInt(draggable.style.zIndex, 10) || 0

                draggable.style.zIndex = newIndex

                if (newIndex === draggables.length) {
                  forEach(draggables, draggable => {
                    const node = draggable.node ?? draggable
                    const index = parseInt(node.style.zIndex, 10) || 0

                    node.style.zIndex =
                      (index >= newIndex || index > curIndex) && index !== 0
                        ? index - 1
                        : index
                  })
                }
                draggable.setAttribute('data-stacked', true)
              } else {
                draggable.style.zIndex = getZindex(
                  `[class='${htmlElement.className}'] .draggable`
                )
              }
              addListener(parent, 'mousemove', drag)
              addListener(doc, 'mouseup', stop)
              addListener(scrollable, 'scroll', setElement)
            }
          }
        } else {
          return false
        }
      }
    })

    if (draggables.length > 0) {
      // draggables.forEach(node => self.addDraggable(node))
    }
  }
  addDraggable(draggable) {
    const { grid, draggables } = _private.get(this)
    const node = draggable.node || draggable
    const draggableArea = node.querySelector('.draggablearea') || node

    if (!grid) {
      node.setAttribute('data-stacked', true)
    }

    draggables.push(draggable)

    addListener(
      draggableArea,
      'mousedown',
      bind(_private.get(this).init, {
        draggableArea
      })
    )
  }
  removeDraggable(draggable) {
    const { grid, draggables } = _private.get(this)
    const node = draggable.node || draggable
    const draggableArea = node.querySelector('.draggablearea') || node

    if (!grid) {
      node.removeAttribute('data-stacked')
    }

    draggables.splice(draggables.indexOf(draggable, 1))

    removeListener(draggableArea, 'mousedown', _private.get(this).init)
  }
}
