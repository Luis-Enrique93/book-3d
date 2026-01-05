import * as THREE from 'three'

export interface PageContent {
  title: string
  body: string
  pageLabel: string
}

export interface CoverContent {
  title?: string
  subtitle?: string
  author?: string
  accent?: string
  sigilText?: string
  blurb?: string
}

export function makePageTexture(
  renderer: THREE.WebGLRenderer,
  data: PageContent,
): THREE.Texture {
  const w = 1024
  const h = 1024
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

  // Papel
  ctx.fillStyle = '#f3ead4'
  ctx.fillRect(0, 0, w, h)

  // Borde
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'
  ctx.lineWidth = 8
  ctx.strokeRect(20, 20, w - 40, h - 40)

  // Sombra lateral
  const grad = ctx.createLinearGradient(0, 0, w, 0)
  grad.addColorStop(0, 'rgba(0,0,0,0.10)')
  grad.addColorStop(0.08, 'rgba(0,0,0,0.00)')
  grad.addColorStop(0.92, 'rgba(0,0,0,0.00)')
  grad.addColorStop(1, 'rgba(0,0,0,0.10)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  // Título
  ctx.fillStyle = '#1c1c1c'
  ctx.font = 'bold 54px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.fillText(String(data.title ?? ''), 70, 130)

  // Cuerpo (wrap simple)
  ctx.font = '34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.fillStyle = 'rgba(0,0,0,0.85)'
  const maxWidth = w - 140

  const words = String(data.body ?? '')
    .replaceAll('\n', ' ')
    .split(' ')
    .filter(Boolean)

  let line = ''
  let y = 210
  const lineHeight = 46

  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i]
    const metrics = ctx.measureText(test)
    if (metrics.width > maxWidth) {
      ctx.fillText(line, 70, y)
      line = words[i]
      y += lineHeight
      if (y > h - 120) break
    } else {
      line = test
    }
  }
  if (y <= h - 120 && line) ctx.fillText(line, 70, y)

  // Footer
  ctx.font = '28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillText(String(data.pageLabel ?? ''), 70, h - 70)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
  return tex
}

export function makeCoverTexture(
  renderer: THREE.WebGLRenderer,
  content: CoverContent,
  mode: 'front' | 'back',
): THREE.Texture {
  const {
    title = 'Libro',
    subtitle = '',
    author = '',
    accent = '#d6b35c',
    blurb = '',
    sigilText = mode === 'front' ? 'TV' : '',
  } = content

  const w = 1024
  const h = 1024
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d') as CanvasRenderingContext2D

  ctx.fillStyle = mode === 'front' ? '#162040' : '#0f1833'
  ctx.fillRect(0, 0, w, h)

  // Grano
  ctx.globalAlpha = 0.06
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * w
    const y = Math.random() * h
    const s = Math.random() * 2.2
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x, y, s, s)
  }
  ctx.globalAlpha = 1

  // Gradiente
  const g = ctx.createRadialGradient(
    w * 0.35,
    h * 0.28,
    60,
    w * 0.55,
    h * 0.55,
    900,
  )
  g.addColorStop(0, 'rgba(255,255,255,0.12)')
  g.addColorStop(1, 'rgba(0,0,0,0.35)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  // Marco
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'
  ctx.lineWidth = 10
  ctx.strokeRect(56, 56, w - 112, h - 112)
  ctx.strokeStyle = 'rgba(0,0,0,0.30)'
  ctx.lineWidth = 6
  ctx.strokeRect(72, 72, w - 144, h - 144)

  // Esquinas
  ctx.strokeStyle = accent
  ctx.globalAlpha = 0.55
  ctx.lineWidth = 6
  const corner = (x: number, y: number, sx: number, sy: number) => {
    ctx.beginPath()
    ctx.moveTo(x, y + 90 * sy)
    ctx.lineTo(x, y)
    ctx.lineTo(x + 90 * sx, y)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(x + 18 * sx, y + 62 * sy)
    ctx.lineTo(x + 62 * sx, y + 18 * sy)
    ctx.stroke()
  }
  corner(90, 90, 1, 1)
  corner(w - 90, 90, -1, 1)
  corner(90, h - 90, 1, -1)
  corner(w - 90, h - 90, -1, -1)
  ctx.globalAlpha = 1

  // Patrón
  ctx.globalAlpha = mode === 'front' ? 0.1 : 0.08
  ctx.strokeStyle = 'rgba(255,255,255,0.40)'
  ctx.lineWidth = 2
  for (let yy = 140; yy < h - 140; yy += 46) {
    for (let xx = 120; xx < w - 120; xx += 64) {
      ctx.beginPath()
      ctx.moveTo(xx, yy)
      ctx.lineTo(xx + 18, yy + 10)
      ctx.lineTo(xx + 8, yy + 24)
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1

  // Sigilo
  const cx = w * 0.5
  const cy = mode === 'front' ? h * 0.55 : h * 0.45
  ctx.save()
  ctx.translate(cx, cy)

  ctx.globalAlpha = 0.22
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.arc(0, 0, 170, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.strokeStyle = accent
  ctx.lineWidth = 10
  ctx.globalAlpha = 0.8
  ctx.beginPath()
  ctx.arc(0, 0, 150, 0, Math.PI * 2)
  ctx.stroke()

  ctx.globalAlpha = 0.65
  ctx.beginPath()
  ctx.moveTo(0, -90)
  ctx.lineTo(78, 70)
  ctx.lineTo(-78, 70)
  ctx.closePath()
  ctx.stroke()

  if (sigilText) {
    ctx.globalAlpha = 0.95
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.font = '800 84px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(sigilText), 0, 8)
  }
  ctx.globalAlpha = 1
  ctx.restore()

  // Texto portada
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  if (mode === 'front') {
    ctx.fillStyle = 'rgba(255,255,255,0.94)'
    ctx.font = '800 76px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
    ctx.fillText(String(title), 110, 220)

    if (subtitle) {
      ctx.fillStyle = 'rgba(255,255,255,0.78)'
      ctx.font = '42px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
      ctx.fillText(String(subtitle), 110, 282)
    }

    if (author) {
      ctx.fillStyle = 'rgba(255,255,255,0.72)'
      ctx.font = '34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
      ctx.fillText(String(author), 110, 340)
    }

    // Línea + badge
    ctx.globalAlpha = 0.85
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(110, 410)
    ctx.lineTo(w - 110, 410)
    ctx.stroke()
    ctx.globalAlpha = 1

    ctx.fillStyle = accent
    ctx.globalAlpha = 0.92
    ctx.beginPath()
    ctx.arc(w - 170, h - 170, 90, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.font = '800 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
    ctx.fillText('VOL I', w - 215, h - 155)
  }

  // Contratapa
  if (mode === 'back') {
    ctx.globalAlpha = 0.75
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(120, 260, w - 240, 470)
    ctx.globalAlpha = 1

    const text = String(
      blurb ||
        'Una maqueta de libro 3D: portada, lomo, grosor y paginas con flip.\n\nHecho con Three.js + CanvasTexture.',
    )
    const maxWidth = w - 280
    const words = text.replaceAll('\n', ' \\n ').split(' ')

    ctx.fillStyle = 'rgba(255,255,255,0.88)'
    ctx.font = '30px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'

    let x = 140
    let y = 320
    let line = ''
    const lh = 40

    for (let i = 0; i < words.length; i++) {
      const wds = words[i]
      if (wds === '\\n') {
        if (line) ctx.fillText(line, x, y)
        line = ''
        y += lh
        continue
      }
      const test = line ? line + ' ' + wds : wds
      if (ctx.measureText(test).width > maxWidth) {
        if (line) ctx.fillText(line, x, y)
        line = wds
        y += lh
        if (y > 690) break
      } else {
        line = test
      }
    }
    if (y <= 690 && line) ctx.fillText(line, x, y)

    ctx.globalAlpha = 0.7
    ctx.fillStyle = 'rgba(255,255,255,0.14)'
    ctx.fillRect(w - 330, h - 210, 210, 110)
    ctx.globalAlpha = 1
    ctx.fillStyle = 'rgba(255,255,255,0.65)'
    ctx.font =
      '24px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
    ctx.fillText('ISBN 000-0-00-000000-0', w - 315, h - 160)
    ctx.fillText('ED. PROTOTYPE', w - 315, h - 125)
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
  return tex
}

export function tuneCoverTexture(tex: THREE.Texture): void {
  tex.center.set(0.5, 0.5)
  tex.rotation = -Math.PI / 2
  tex.needsUpdate = true
}
