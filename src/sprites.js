/** Hand-drawn pixel mascots. All original, all cursed. */

export const SPRITE_COLORS = {
  k: '#0a0a0f', // outline
  f: '#c88a56', // fur
  F: '#8a5a34', // dark fur
  w: '#f4f0e4', // eyes / teeth
  p: '#ff8fb8', // nose
  h: '#00f0ff', // headphones
  H: '#008a99', // headphone dark
  s: '#ff2bd6', // shirt
  S: '#a8008a', // shirt dark
  l: '#6b4a2e', // leg
  q: '#17171f', // shoe
  r: '#14141f', // record
  c: '#00c8d8', // cyan
  y: '#ffe800',
  m: '#8d5bff', // hat
  M: '#4b2a99', // hat dark
  b: '#d8d2c2', // beard
  d: '#d8a35a', // dog
  D: '#a06a35', // dog dark
  u: '#26315c', // suit
  U: '#151b33', // suit dark
  t: '#d42036', // tie
  g: '#a8a8b8', // CRT grey
  G: '#5b5b70', // CRT dark
  e: '#7dff5a', // green
  o: '#7a5cff', // orb
}

export const RAT = [
  '......hhhh......',
  '....hhHHHHhh....',
  '...hHHHHHHHHh...',
  '..hHffffffffHh..',
  '..hHfkffffkfHh..',
  '..hHffffffffHh..',
  '..hHffpffpffHh..',
  '...hffffffffh...',
  '...fffwwwwfff...',
  '....ffffffff....',
  '...fffffffffff..',
  '..ffffsssssffff.',
  '..fffsssssssfff.',
  '..ff.sssssss.ff.',
  '.....ssssssss...',
  '.....ll....ll...',
  '....lll....lll..',
  '....qqq....qqq..',
]

export const WIZARD = [
  '.......mm.......',
  '......mmmm......',
  '.....mMMMMm.....',
  '....MMMMMMMM....',
  '...MMMMMMMMMM...',
  '..MMMMMMMMMMMM..',
  '.......ff.......',
  '......ffff......',
  '.....fFffFf.....',
  '.....fwwwwf.....',
  '....ffffffff....',
  '...ffffffffff...',
  '...cccccccccc...',
  '..ccccc.cccccc..',
  '..cccc...ccccc..',
  '..cccc...ccccc..',
  '...ccc...cccc...',
  '...qqq...qqq....',
]

export const DOG = [
  '...DDDDDDDD.....',
  '..DDDDDDDDDD....',
  '..DDwwDDwwDD....',
  '..DDDDddDDDD....',
  '...DDDDDDDD.....',
  '....dddddd......',
  '...uuuuuuuu.....',
  '..uuuuuuuuuu....',
  '..uuttttttuu....',
  '..uuttttttuu....',
  '..uuuuuuuuuu....',
  '...uuuuuuuu.....',
  '....uu..uu......',
  '....qq..qq......',
]

export const CRT_UNCLE = [
  '....gggggggg....',
  '...gGGGGGGGGg...',
  '...gGccccccGg...',
  '...gGcGGGGcGg...',
  '...gGcGccGcGg...',
  '...gGccGGccGg...',
  '...gGGGGGGGGg...',
  '....gggggggg....',
  '.....ffffff.....',
  '....ffffffff....',
  '...ffffffffff...',
  '..dddddddddddd..',
  '..dddddddddddd..',
  '..dddddddddddd..',
  '...dddddddddd...',
  '....dd....dd....',
  '....qq....qq....',
]

export const MOTH = [
  '..w........w..',
  '.www......www.',
  'wwwww....wwwww',
  '.wwww.ff.wwww.',
  '..ww..ff..ww..',
  '......ff......',
  '.....f..f.....',
]

export function drawSprite(ctx, sprite, x, y, scale, opts = {}) {
  const colors = { ...SPRITE_COLORS, ...(opts.colors || {}) }
  const w = Math.max(...sprite.map(r => r.length))
  const h = sprite.length
  const px = Math.round(x - (w * scale) / 2)
  const py = Math.round(y - h * scale)
  const alpha = opts.alpha ?? 1
  ctx.save()
  ctx.globalAlpha = alpha
  for (let r = 0; r < h; r++) {
    const row = sprite[r]
    for (let c = 0; c < row.length; c++) {
      const ch = row[c]
      if (ch === '.' || ch === ' ') continue
      const col = colors[ch]
      if (!col) continue
      ctx.fillStyle = col
      ctx.fillRect(px + c * scale, py + r * scale, scale, scale)
    }
  }
  ctx.restore()
  return { x: px, y: py, w: w * scale, h: h * scale }
}

export function spriteSize(sprite, scale) {
  return {
    w: Math.max(...sprite.map(r => r.length)) * scale,
    h: sprite.length * scale,
  }
}
