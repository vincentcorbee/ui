import { getOffset } from '@digitalbranch/u'
import Emitter from '@digitalbranch/emitter'

const _private = new WeakMap()

export default class Cursor extends Emitter {
  constructor (ctx, tar) {
    super()

    let self = this

    _private.set(this, {
      tar: tar || ctx,
      ctx,
      target: {
        node: null,
        x: 0,
        y: 0
      },
      pos: {
        x: 0,
        y: 0,
        prevX: 0,
        prevY: 0
      },
      moved: {
        x: 0,
        y: 0
      },
      update(e) {
        let {
          tar,
          target,
          pos,
          moved
        } = _private.get(self)
        let x = e.clientX - getOffset(tar).x
        let y = e.clientY - getOffset(tar).y

        target.node = e.target
        target.x = (x > tar.clientWidth || x < 0) || (y > tar.clientHeight || y < 0) ? 0 : x
        target.y = (y > tar.clientHeight || y < 0) || (x > tar.clientWidth || x < 0) ? 0 : y
        pos.x = e.clientX
        pos.y = e.clientY
        moved.x = e.clientX - pos.prevX
        moved.y = e.clientY - pos.prevY
        pos.prevX = pos.x
        pos.prevY = pos.y

        self.emit('cursor', {
          type: 'cursor',
          cursor: self,
          event: e,
          target: e.target
        })
      }
    })

    ctx.addEventListener('mousemove', _private.get(self).update, false)
  }
  get target () {
    return _private.get(this).target
  }
  get moved () {
    return _private.get(this).moved
  }
}
