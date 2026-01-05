import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export class Game {
  private static instance: Game | null = null

  private constructor() {
    // ---------------------------
    // Self-tests (mini)
    // ---------------------------
    function assert(condition: any, message: string) {
      if (!condition) throw new Error('[SelfTest] ' + message)
    }
    assert(
      THREE && typeof THREE.Scene === 'function',
      'Three.js no cargo correctamente',
    )
    assert(
      typeof OrbitControls === 'function',
      'OrbitControls no cargo correctamente',
    )

    // ---------------------------
    // Setup
    // ---------------------------
    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x0b0f19, 6, 30)

    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    )
    camera.position.set(0.2, 0.35, 3.2)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    document.getElementById('app')?.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0.25, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 1.2
    controls.maxDistance = 10.0
    controls.maxPolarAngle = Math.PI * 0.48
    controls.update()

    // Luces
    scene.add(new THREE.AmbientLight(0xffffff, 0.72))
    const key = new THREE.DirectionalLight(0xffffff, 1.1)
    key.position.set(3, 6, 2)
    scene.add(key)

    // Piso (solo referencia espacial)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({
        color: 0x0f1630,
        roughness: 1,
        metalness: 0,
      }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -1.2
    scene.add(floor)

    // ---------------------------
    // Util: Canvas -> textura (paginas)
    // ---------------------------
    function makePageTexture({
      title,
      body,
      pageLabel,
    }: {
      title: string
      body: string
      pageLabel: string
    }) {
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

      // Titulo
      ctx.fillStyle = '#1c1c1c'
      ctx.font =
        'bold 54px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
      ctx.fillText(String(title ?? ''), 70, 130)

      // Cuerpo (wrap simple)
      ctx.font = '34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
      ctx.fillStyle = 'rgba(0,0,0,0.85)'
      const maxWidth = w - 140

      const words = String(body ?? '')
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
      ctx.fillText(String(pageLabel ?? ''), 70, h - 70)

      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
      return tex
    }

    // Clona una textura y la invierte en X (para que el texto se lea bien por el reverso)
    function cloneFlipX(tex: THREE.Texture) {
      const t = tex.clone()
      t.repeat.set(-1, 1)
      t.offset.set(1, 0)
      t.needsUpdate = true
      return t
    }

    // Cache de texturas por spread/side
    const texCache = new Map()
    const flippedCache = new Map()

    function texKey(index: number, side: string) {
      return `${index}:${side}`
    }

    function getSpreadTex(index: number, side: string, spreads: any) {
      const k = texKey(index, side)
      if (texCache.has(k)) return texCache.get(k)
      const s = spreads[index]
      const data = side === 'left' ? s.left : s.right
      const t = makePageTexture(data)
      texCache.set(k, t)
      return t
    }

    function getFlippedTex(tex: THREE.Texture, cacheId: string) {
      if (flippedCache.has(cacheId)) return flippedCache.get(cacheId)
      const t = cloneFlipX(tex)
      flippedCache.set(cacheId, t)
      return t
    }

    // Textura base de papel
    const paperTex = makePageTexture({ title: '', body: '', pageLabel: '' })

    // ---------------------------
    // Contenido (spreads)
    // ---------------------------
    const spreads = [
      {
        left: {
          title: 'Bienvenido',
          body:
            'Este es un libro simple hecho con planos.\n' +
            'La pagina es una textura generada con Canvas.\n\n' +
            'Haz click en la pagina derecha para avanzar.',
          pageLabel: 'Pag. 1',
        },
        right: {
          title: 'Como se usa',
          body:
            'Arrastra para orbitar, rueda para zoom.\n' +
            'Click derecha = siguiente, izquierda = anterior.\n\n' +
            'Ahora ademas hay animacion de pasar pagina.',
          pageLabel: 'Pag. 2',
        },
      },
      {
        left: {
          title: 'Texto dinamico',
          body:
            'Podemos inyectar texto desde JSON, tu backend, o incluso desde Markdown.\n' +
            'Tambien podemos cambiar tipografias, margenes y estilos.',
          pageLabel: 'Pag. 3',
        },
        right: {
          title: 'Proximo paso',
          body:
            'El siguiente upgrade (si quieres) es doblar la hoja con subdivisiones\n' +
            'para que se curve durante el giro.',
          pageLabel: 'Pag. 4',
        },
      },
      {
        left: {
          title: 'Lore',
          body:
            'Esto ya sirve para libros tipo Skyrim: notas, cartas, bestiarios.\n' +
            'Lo importante es la tipografia, el ritmo y el sonido.',
          pageLabel: 'Pag. 5',
        },
        right: {
          title: 'Fin',
          body:
            'Cuando quieras, hacemos: portada, lomo, sombras,\n' +
            'y una curvatura leve al girar.',
          pageLabel: 'Pag. 6',
        },
      },
    ]

    // Tests extra
    assert(
      Array.isArray(spreads) && spreads.length > 0,
      'spreads debe tener al menos 1 spread',
    )
    assert(
      spreads.every(s => s.left && s.right),
      'cada spread debe tener left y right',
    )
    assert(
      spreads.every(
        s =>
          typeof s.left.body === 'string' && typeof s.right.body === 'string',
      ),
      'body debe ser string',
    )

    // ---------------------------
    // Dimensiones / params
    // ---------------------------
    let spreadIndex = 0
    const pageInfo = document.getElementById('pageInfo') as HTMLDivElement

    const pageW = 1.6
    const pageH = 2.1
    const pageGap = 0.0 // bisagra en x=0
    const spineW = 0.08
    const zEps = 0.0012

    const coverT = 0.06
    const pageBlockT = 0.09
    const coverPad = 0.1

    // Centro en Z de las tapas (detrás del bloque de hojas)
    // Lo usamos también para ubicar el lomo visual, así no “asoma” como un bloque grueso.
    const coverCenterZ = -(pageBlockT + coverT / 2)

    // ---------------------------
    // Texturas de portada/contratapa
    // ---------------------------
    function makeCoverTexture({
      title = 'Libro',
      subtitle = '',
      author = '',
      accent = '#d6b35c',
      mode = 'front', // "front" | "back"
      blurb = '',
      sigilText = 'TV',
    } = {}) {
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
        ctx.font =
          '800 84px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
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
        ctx.font =
          '800 76px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
        ctx.fillText(String(title), 110, 220)

        if (subtitle) {
          ctx.fillStyle = 'rgba(255,255,255,0.78)'
          ctx.font =
            '42px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
          ctx.fillText(String(subtitle), 110, 282)
        }

        if (author) {
          ctx.fillStyle = 'rgba(255,255,255,0.72)'
          ctx.font =
            '34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
          ctx.fillText(String(author), 110, 340)
        }

        // Linea + badge
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
        ctx.font =
          '800 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
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

    const coverTexFront = makeCoverTexture({
      mode: 'front',
      title: 'Tzedek Tome',
      subtitle: 'Prototype Grimoire',
      author: 'Luis Enrique',
      accent: '#d6b35c',
      sigilText: 'TV',
    })

    const coverTexBack = makeCoverTexture({
      mode: 'back',
      accent: '#8bd6ff',
      sigilText: '',
      blurb:
        'Un libro 3D simple (tipo Skyrim) con paginas que se pasan en tiempo real.\n\n' +
        '- Portada + contratapa + lomo\n' +
        '- Texturas generadas con Canvas\n' +
        '- Flip con doble cara y sin parpadeos\n\n' +
        'Siguiente: curvatura de hoja, sombras y sonido.',
    })

    // Orientamos arte en la tapa (UV del box)
    function tuneCoverTexture(tex: THREE.Texture) {
      tex.center.set(0.5, 0.5)
      tex.rotation = -Math.PI / 2
      tex.needsUpdate = true
    }
    tuneCoverTexture(coverTexFront)
    tuneCoverTexture(coverTexBack)

    const coverMatFront = new THREE.MeshStandardMaterial({
      map: coverTexFront,
      roughness: 0.85,
      metalness: 0.05,
    })
    const coverMatBack = new THREE.MeshStandardMaterial({
      map: coverTexBack,
      roughness: 0.9,
      metalness: 0.02,
    })
    const coverSideMat = new THREE.MeshStandardMaterial({
      color: 0x141c35,
      roughness: 0.95,
      metalness: 0,
    })
    const coverInnerMat = new THREE.MeshStandardMaterial({
      map: paperTex,
      roughness: 0.98,
      metalness: 0,
      color: 0xffffff,
    })

    // ---------------------------
    // Libro (UNICO) - PARADO mirando a cámara
    // X: izquierda/derecha | Y: arriba/abajo | Z: profundidad (camara está en +Z)
    // ---------------------------
    const book = new THREE.Group()
    book.position.set(0, 0.35, 0)
    book.rotation.set(0, 0, 0)
    scene.add(book)

    // ---------------------------
    // Geometrias base
    // ---------------------------
    const coverW = pageW + coverPad * 2
    const coverGeom = new THREE.BoxGeometry(
      coverW,
      pageH + coverPad * 2,
      coverT,
    )
    const pagesGeom = new THREE.BoxGeometry(pageW, pageH, pageBlockT)

    // Lomo (visual): mantener el ANCHO (X) para que el cierre calce,
    // pero hacerlo FINO en Z (hacia las hojas) para que no parezca del grosor del bloque de páginas.
    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(
        Math.max(spineW, 0.06) + coverPad * 1.2, // ancho X (no tocar: lo usa la bisagra)
        pageH + coverPad * 2,
        coverT + 0.15, // grosor Z (FINO)
      ),
      new THREE.MeshStandardMaterial({
        color: 0x10172d,
        roughness: 0.9,
        metalness: 0,
      }),
    )
    // Alineado con las tapas, levemente hacia atrás
    spine.position.set(0, 0, coverCenterZ - 0.002)
    book.add(spine)

    // ---------------------------
    // Pivots de flip (DEBEN existir ANTES de reparent)
    // ---------------------------
    const pivotR = new THREE.Group()
    pivotR.position.x = pageGap / 2
    book.add(pivotR)

    const pivotL = new THREE.Group()
    pivotL.position.x = -pageGap / 2
    book.add(pivotL)

    // ---------------------------
    // Pivots de tapas (bisagra en borde del lomo)
    // ---------------------------
    const spineWidth = Math.max(spineW, 0.06) + coverPad * 1.2
    const spineHalfX = spineWidth / 2

    const leftCoverPivot = new THREE.Group()
    // IMPORTANTE: el eje de bisagra debe estar en el mismo plano Z que la tapa,
    // si no, al rotar parece que la tapa se "desplaza" (porque gira alrededor de Z=0).
    leftCoverPivot.position.set(-spineHalfX, 0, coverCenterZ)
    book.add(leftCoverPivot)

    const rightCoverPivot = new THREE.Group()
    rightCoverPivot.position.set(+spineHalfX, 0, coverCenterZ)
    book.add(rightCoverPivot)

    // BoxGeometry material index order: 0=+X,1=-X,2=+Y,3=-Y,4=+Z,5=-Z
    // Como las tapas están en z negativo (detrás de páginas):
    // +Z = cara interior (hacia hojas) | -Z = cara exterior (portada/contratapa)
    const leftCover = new THREE.Mesh(coverGeom, [
      coverSideMat,
      coverSideMat,
      coverSideMat,
      coverSideMat,
      coverInnerMat, // +Z interior
      coverMatBack, // -Z exterior (contratapa)
    ])
    leftCover.position.set(-(coverW / 2), 0, 0)
    leftCoverPivot.add(leftCover)

    const rightCover = new THREE.Mesh(coverGeom, [
      coverSideMat,
      coverSideMat,
      coverSideMat,
      coverSideMat,
      coverInnerMat, // +Z interior
      coverMatFront, // -Z exterior (portada)
    ])
    rightCover.position.set(+(coverW / 2), 0, 0)
    rightCoverPivot.add(rightCover)

    // ---------------------------
    // Bloques de hojas (canto)
    // ---------------------------
    const pageEdgeMat = new THREE.MeshStandardMaterial({
      color: 0xf0e6cf,
      roughness: 0.98,
      metalness: 0,
    })
    const pageBlockL = new THREE.Mesh(pagesGeom, pageEdgeMat)
    pageBlockL.position.set(-(pageW / 2 + pageGap / 2), 0, -(pageBlockT / 2))

    const pageBlockR = new THREE.Mesh(pagesGeom, pageEdgeMat)
    pageBlockR.position.set(+(pageW / 2 + pageGap / 2), 0, -(pageBlockT / 2))

    // ---------------------------
    // Paginas quietas (solo frente) + backs de papel
    // ---------------------------
    const leftMat = new THREE.MeshStandardMaterial({
      roughness: 0.95,
      metalness: 0,
      side: THREE.FrontSide,
    })
    const rightMat = new THREE.MeshStandardMaterial({
      roughness: 0.95,
      metalness: 0,
      side: THREE.FrontSide,
    })

    const leftPage = new THREE.Mesh(
      new THREE.PlaneGeometry(pageW, pageH),
      leftMat,
    )
    leftPage.position.x = -(pageW / 2 + pageGap / 2)
    leftPage.position.z = +zEps
    leftPage.name = 'leftPage'

    const rightPage = new THREE.Mesh(
      new THREE.PlaneGeometry(pageW, pageH),
      rightMat,
    )
    rightPage.position.x = +(pageW / 2 + pageGap / 2)
    rightPage.position.z = +zEps
    rightPage.name = 'rightPage'

    const backPaperMatL = new THREE.MeshStandardMaterial({
      roughness: 0.98,
      metalness: 0,
      side: THREE.FrontSide,
      map: paperTex,
    })
    const backPaperMatR = new THREE.MeshStandardMaterial({
      roughness: 0.98,
      metalness: 0,
      side: THREE.FrontSide,
      map: paperTex,
    })

    const leftBack = new THREE.Mesh(
      new THREE.PlaneGeometry(pageW, pageH),
      backPaperMatL,
    )
    leftBack.position.copy(leftPage.position)
    leftBack.position.z = -zEps
    leftBack.rotation.y = Math.PI

    const rightBack = new THREE.Mesh(
      new THREE.PlaneGeometry(pageW, pageH),
      backPaperMatR,
    )
    rightBack.position.copy(rightPage.position)
    rightBack.position.z = -zEps
    rightBack.rotation.y = Math.PI

    // Pagina debajo
    const underMatR = new THREE.MeshStandardMaterial({
      roughness: 0.95,
      metalness: 0,
      side: THREE.FrontSide,
    })
    const underMatL = new THREE.MeshStandardMaterial({
      roughness: 0.95,
      metalness: 0,
      side: THREE.FrontSide,
    })

    const underRight = new THREE.Mesh(
      new THREE.PlaneGeometry(pageW, pageH),
      underMatR,
    )
    underRight.position.copy(rightPage.position)
    // Un pelin por encima para evitar z-fighting y asegurar que se vea al destapar.
    underRight.position.z = zEps * 2
    underRight.renderOrder = 5
    underRight.visible = false

    const underLeft = new THREE.Mesh(
      new THREE.PlaneGeometry(pageW, pageH),
      underMatL,
    )
    underLeft.position.copy(leftPage.position)
    underLeft.position.z = zEps * 2
    underLeft.renderOrder = 5
    underLeft.visible = false

    // ---------------------------
    // Contenido del libro: 2 mitades plegables (sin hacks)
    // ---------------------------
    const content = new THREE.Group()
    book.add(content)

    const halfL = new THREE.Group()
    const halfR = new THREE.Group()
    content.add(halfL, halfR)

    // Reparent de todo el spread a cada mitad (IMPORTANTE: pivotL/pivotR ya existen)
    halfL.add(pageBlockL, leftPage, leftBack, underLeft, pivotL)
    halfR.add(pageBlockR, rightPage, rightBack, underRight, pivotR)

    // Tests de orden/rig
    assert(halfL.children.includes(pivotL), 'pivotL debe estar dentro de halfL')
    assert(halfR.children.includes(pivotR), 'pivotR debe estar dentro de halfR')

    // ---------------------------
    // Estado de apertura
    // ---------------------------
    const cover = {
      open: true,
      t0: 0,
      dur: 0.55, // duración animación tapas (segundos)
      anim: false,
      leftPivot: leftCoverPivot,
      rightPivot: rightCoverPivot,
      leftOpenRot: 0,
      rightOpenRot: 0,
      // Cerrado: tapas rotan ~90° hacia el frente para cubrir páginas
      leftClosedRot: Math.PI / 2,
      rightClosedRot: -Math.PI / 2,
    }

    // Plegado del contenido al cerrar (mitades hacia el lomo)
    const halfLClosedRotY = +Math.PI / 2
    const halfRClosedRotY = -Math.PI / 2

    // ---------------------------
    // Spread management
    // ---------------------------
    function setSpread(i: number) {
      spreadIndex = THREE.MathUtils.clamp(i, 0, spreads.length - 1)

      leftMat.map = getSpreadTex(spreadIndex, 'left', spreads)
      rightMat.map = getSpreadTex(spreadIndex, 'right', spreads)
      leftMat.needsUpdate = true
      rightMat.needsUpdate = true

      pageInfo.textContent = `Spread ${spreadIndex + 1} / ${spreads.length}`
    }

    // ---------------------------
    // Page flip con doble cara + anti-flash
    // ---------------------------
    const geoTurnR = new THREE.PlaneGeometry(pageW, pageH)
    geoTurnR.translate(pageW / 2, 0, 0)

    const geoTurnL = new THREE.PlaneGeometry(pageW, pageH)
    geoTurnL.translate(-pageW / 2, 0, 0)

    const flip: {
      active: boolean
      dir: number
      t0: number
      dur: number
      pivot: THREE.Group | null
      hidden: THREE.Mesh | null
      frontMesh: THREE.Mesh | null
      backMesh: THREE.Mesh | null
      under: THREE.Mesh | null
      other: THREE.Mesh | null
      otherWasVisible: boolean
    } = {
      active: false,
      dir: 0,
      t0: 0,
      dur: 0.48, // duración animación pasar página (segundos)
      pivot: null,
      hidden: null,
      frontMesh: null,
      backMesh: null,
      under: null,
      other: null,
      otherWasVisible: true,
    }

    const easeInOut = (x: number) =>
      x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2

    function cleanupFlipMeshes() {
      if (flip.frontMesh) {
        flip.pivot?.remove(flip.frontMesh)
        // flip.frontMesh.material.dispose()
        flip.frontMesh = null
      }
      if (flip.backMesh) {
        flip.pivot?.remove(flip.backMesh)
        // flip.backMesh.material.dispose()
        flip.backMesh = null
      }
      if (flip.under) {
        flip.under.visible = false
        flip.under = null
      }
      if (flip.other) {
        flip.other.visible = flip.otherWasVisible
        flip.other = null
      }
      flip.otherWasVisible = true
    }

    function startFlip(dir: number) {
      if (!cover.open || cover.anim) return
      if (flip.active) return
      const nextIndex = spreadIndex + dir
      if (nextIndex < 0 || nextIndex >= spreads.length) return

      flip.active = true
      flip.dir = dir
      flip.t0 = performance.now() / 1000

      if (dir === 1) {
        // Avanzar (gira pagina derecha hacia izquierda)
        flip.other = leftPage
        flip.otherWasVisible = leftPage.visible

        underRight.visible = true
        underMatR.map = getSpreadTex(nextIndex, 'right', spreads)
        underMatR.needsUpdate = true
        flip.under = underRight

        rightPage.visible = false
        flip.hidden = rightPage
        flip.pivot = pivotR
        pivotR.rotation.y = 0

        const frontTex = rightMat.map
        const backTexSource = getSpreadTex(nextIndex, 'left', spreads)
        const backTex = getFlippedTex(backTexSource, `flip:${nextIndex}:left`)

        const frontMat = new THREE.MeshStandardMaterial({
          roughness: 0.95,
          metalness: 0,
          side: THREE.FrontSide,
          map: frontTex,
        })
        const backMat = new THREE.MeshStandardMaterial({
          roughness: 0.95,
          metalness: 0,
          side: THREE.BackSide,
          map: backTex,
        })

        flip.frontMesh = new THREE.Mesh(geoTurnR, frontMat)
        flip.backMesh = new THREE.Mesh(geoTurnR, backMat)
        flip.frontMesh.position.z = zEps * 10
        flip.backMesh.position.z = zEps * 10
        flip.frontMesh.renderOrder = 10
        flip.backMesh.renderOrder = 10

        pivotR.add(flip.frontMesh, flip.backMesh)
      } else {
        // Retroceder (gira pagina izquierda hacia derecha)
        flip.other = rightPage
        flip.otherWasVisible = rightPage.visible

        underLeft.visible = true
        underMatL.map = getSpreadTex(nextIndex, 'left', spreads)
        underMatL.needsUpdate = true
        flip.under = underLeft

        leftPage.visible = false
        flip.hidden = leftPage
        flip.pivot = pivotL
        pivotL.rotation.y = 0

        const frontTex = leftMat.map
        const backTexSource = getSpreadTex(nextIndex, 'right', spreads)
        const backTex = getFlippedTex(backTexSource, `flip:${nextIndex}:right`)

        const frontMat = new THREE.MeshStandardMaterial({
          roughness: 0.95,
          metalness: 0,
          side: THREE.FrontSide,
          map: frontTex,
        })
        const backMat = new THREE.MeshStandardMaterial({
          roughness: 0.95,
          metalness: 0,
          side: THREE.BackSide,
          map: backTex,
        })

        flip.frontMesh = new THREE.Mesh(geoTurnL, frontMat)
        flip.backMesh = new THREE.Mesh(geoTurnL, backMat)
        flip.frontMesh.position.z = zEps * 10
        flip.backMesh.position.z = zEps * 10
        flip.frontMesh.renderOrder = 10
        flip.backMesh.renderOrder = 10

        pivotL.add(flip.frontMesh, flip.backMesh)
      }
    }

    function endFlip() {
      const otherToRestore = flip.other
      if (otherToRestore) otherToRestore.visible = false

      const toReveal = flip.hidden
      if (toReveal) toReveal.visible = false

      cleanupFlipMeshes()
      setSpread(spreadIndex + flip.dir)

      if (toReveal) toReveal.visible = true
      if (otherToRestore) otherToRestore.visible = true

      flip.active = false
      flip.dir = 0
      flip.pivot = null
      flip.hidden = null
    }

    // ---------------------------
    // Interaccion (click vs drag)
    // ---------------------------
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    let downX = 0
    let downY = 0
    let downAt = 0

    function onPointerDown(ev: PointerEvent) {
      downX = ev.clientX
      downY = ev.clientY
      downAt = performance.now()
    }

    function onPointerUp(ev: PointerEvent) {
      if (flip.active) return

      const dx = ev.clientX - downX
      const dy = ev.clientY - downY
      const dist2 = dx * dx + dy * dy
      const elapsed = performance.now() - downAt
      if (dist2 > 25 || elapsed > 350) return

      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1)

      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects([leftPage, rightPage], true)
      if (!hits.length) return

      const hit = hits[0].object
      if (hit.name === 'rightPage') startFlip(1)
      if (hit.name === 'leftPage') startFlip(-1)
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)

    // Doble click en la tapa para abrir/cerrar
    function toggleCoverFromPointer(ev: PointerEvent) {
      if (flip.active) return
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1)
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects([leftCover, rightCover], true)
      if (hits.length) startToggleCover()
    }
    renderer.domElement.addEventListener(
      'dblclick',
      toggleCoverFromPointer as EventListener,
    )

    // Teclado
    window.addEventListener('keydown', e => {
      if (e.key === 'c' || e.key === 'C') startToggleCover()
      if (flip.active) return
      if (e.key === 'ArrowRight') startFlip(1)
      if (e.key === 'ArrowLeft') startFlip(-1)
    })

    // ---------------------------
    // Toggle cover
    // ---------------------------
    function startToggleCover() {
      if (flip.active || cover.anim) return
      cover.anim = true
      cover.t0 = performance.now() / 1000
      cover.open = !cover.open
    }

    // ---------------------------
    // Init + tests
    // ---------------------------
    setSpread(0)
    assert(
      leftMat.map && rightMat.map,
      'las texturas de paginas deben crearse al iniciar',
    )

    if (spreads.length > 1) {
      getSpreadTex(1, 'left', spreads)
      getSpreadTex(1, 'right', spreads)
    }

    // ---------------------------
    // Velocidades (AJUSTABLES)
    // ---------------------------
    const SPEED = {
      cover: 1.6, // segundos (abrir/cerrar libro) — BIEN LENTO
      flip: 1.2, // segundos (pasar pagina) — BIEN LENTO
    }

    // ---------------------------
    // Loop
    // ---------------------------
    const clock = new THREE.Clock()
    function animate() {
      clock.getElapsedTime()

      // Animacion de apertura/cierre de tapas + plegado del contenido
      if (cover.anim) {
        const now = performance.now() / 1000
        const u = Math.min(1, (now - cover.t0) / SPEED.cover)
        const k = easeInOut(u)
        const a = cover.open ? k : 1 - k // 1=open, 0=closed

        cover.leftPivot.rotation.y = THREE.MathUtils.lerp(
          cover.leftClosedRot,
          cover.leftOpenRot,
          a,
        )
        cover.rightPivot.rotation.y = THREE.MathUtils.lerp(
          cover.rightClosedRot,
          cover.rightOpenRot,
          a,
        )

        halfL.rotation.y = THREE.MathUtils.lerp(halfLClosedRotY, 0, a)
        halfR.rotation.y = THREE.MathUtils.lerp(halfRClosedRotY, 0, a)

        // No tapar la "pagina de debajo" durante un flip activo.
        // (Si la ocultamos acá, al levantar la hoja se ve "en blanco" hasta el final.)
        if (!flip.active) {
          underLeft.visible = false
          underRight.visible = false
        }

        if (u >= 1) cover.anim = false
      } else {
        cover.leftPivot.rotation.y = cover.open
          ? cover.leftOpenRot
          : cover.leftClosedRot
        cover.rightPivot.rotation.y = cover.open
          ? cover.rightOpenRot
          : cover.rightClosedRot

        const closed = !cover.open
        halfL.rotation.y = closed ? halfLClosedRotY : 0
        halfR.rotation.y = closed ? halfRClosedRotY : 0

        // No tapar la "pagina de debajo" durante un flip activo.
        if (!flip.active) {
          underLeft.visible = false
          underRight.visible = false
        }
      }

      // Flip
      if (flip.active && flip.pivot) {
        const now = performance.now() / 1000
        const u = Math.min(1, (now - flip.t0) / SPEED.flip)
        const k = easeInOut(u)

        if (flip.other)
          flip.other.visible = k <= 0.55 ? flip.otherWasVisible : false

        flip.pivot.rotation.y = (flip.dir === 1 ? -Math.PI : Math.PI) * k
        if (u >= 1) endFlip()
      }

      controls.update()
      renderer.render(scene, camera)
      requestAnimationFrame(animate)
    }
    animate()

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    })
  }

  public static getInstance(): Game {
    if (this.instance === null) {
      this.instance = new Game()
    }
    return this.instance
  }
}
