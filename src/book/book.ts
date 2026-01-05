import * as THREE from 'three'
import type {
  BookConfig,
  BookCallbacks,
  Spread,
  BookAnimationSpeeds,
} from './book.types'

export class Book {
  private readonly group: THREE.Group
  private readonly config: BookConfig & {
    dimensions: Required<NonNullable<BookConfig['dimensions']>>
    speeds: Required<NonNullable<BookConfig['speeds']>>
    initialSpreadIndex: number
  }
  private readonly callbacks?: BookCallbacks

  // Dimensiones
  private readonly pageW: number
  private readonly pageH: number
  private readonly pageGap: number
  private readonly spineW: number
  private readonly zEps: number
  private readonly coverT: number
  private readonly pageBlockT: number
  private readonly coverPad: number
  private readonly coverCenterZ: number

  // Estado
  private spreadIndex: number
  private readonly spreads: Spread[]
  private readonly pageInfo: HTMLDivElement | null

  // Cache para texturas volteadas
  private readonly flippedCache = new Map<string, THREE.Texture>()

  // Geometrías y materiales
  private readonly paperTex: THREE.Texture
  private readonly leftMat: THREE.MeshStandardMaterial
  private readonly rightMat: THREE.MeshStandardMaterial
  private readonly leftPage: THREE.Mesh
  private readonly rightPage: THREE.Mesh
  private readonly underLeft: THREE.Mesh
  private readonly underRight: THREE.Mesh
  private readonly underMatL: THREE.MeshStandardMaterial
  private readonly underMatR: THREE.MeshStandardMaterial

  // Pivots y grupos
  private readonly pivotL: THREE.Group
  private readonly pivotR: THREE.Group
  private readonly leftCoverPivot: THREE.Group
  private readonly rightCoverPivot: THREE.Group
  private readonly leftCover: THREE.Mesh
  private readonly rightCover: THREE.Mesh
  private readonly halfL: THREE.Group
  private readonly halfR: THREE.Group

  // Animaciones
  private readonly cover = {
    open: true,
    t0: 0,
    anim: false,
    leftPivot: null as THREE.Group | null,
    rightPivot: null as THREE.Group | null,
    leftOpenRot: 0,
    rightOpenRot: 0,
    leftClosedRot: Math.PI / 2,
    rightClosedRot: -Math.PI / 2,
  }

  private readonly flip: {
    active: boolean
    dir: number
    t0: number
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
    pivot: null,
    hidden: null,
    frontMesh: null,
    backMesh: null,
    under: null,
    other: null,
    otherWasVisible: true,
  }

  private readonly geoTurnR: THREE.PlaneGeometry
  private readonly geoTurnL: THREE.PlaneGeometry

  // Velocidades
  private readonly speeds: Required<BookAnimationSpeeds>

  constructor(
    _renderer: THREE.WebGLRenderer,
    _camera: THREE.Camera,
    config: BookConfig,
    callbacks?: BookCallbacks,
  ) {
    this.callbacks = callbacks

    // Configuración con valores por defecto
    this.config = {
      frontCoverTexture: config.frontCoverTexture,
      backCoverTexture: config.backCoverTexture,
      paperTexture: config.paperTexture,
      spreads: config.spreads,
      dimensions: {
        pageWidth: 1.6,
        pageHeight: 2.1,
        pageGap: 0.0,
        spineWidth: 0.08,
        coverThickness: 0.06,
        pageBlockThickness: 0.09,
        coverPadding: 0.1,
        ...config.dimensions,
      },
      speeds: {
        cover: 1.6,
        flip: 1.2,
        ...config.speeds,
      },
      initialSpreadIndex: config.initialSpreadIndex ?? 0,
      pageInfoElementId: config.pageInfoElementId,
    } as BookConfig & {
      dimensions: Required<NonNullable<BookConfig['dimensions']>>
      speeds: Required<NonNullable<BookConfig['speeds']>>
      initialSpreadIndex: number
    }

    // Dimensiones
    const dims = this.config.dimensions
    this.pageW = dims.pageWidth ?? 1.6
    this.pageH = dims.pageHeight ?? 2.1
    this.pageGap = dims.pageGap ?? 0.0
    this.spineW = dims.spineWidth ?? 0.08
    this.zEps = 0.0012
    this.coverT = dims.coverThickness ?? 0.06
    this.pageBlockT = dims.pageBlockThickness ?? 0.09
    this.coverPad = dims.coverPadding ?? 0.1
    this.coverCenterZ = -(this.pageBlockT + this.coverT / 2)

    this.spreads = config.spreads
    this.spreadIndex = this.config.initialSpreadIndex ?? 0
    this.pageInfo = this.config.pageInfoElementId
      ? (document.getElementById(
          this.config.pageInfoElementId,
        ) as HTMLDivElement | null)
      : null

    this.speeds = this.config.speeds as Required<BookAnimationSpeeds>

    // Validaciones
    this.validateConfig()

    // Crear grupo principal
    this.group = new THREE.Group()
    this.group.position.set(0, 0.35, 0)

    // Usar texturas proporcionadas
    this.paperTex = config.paperTexture
    const coverTexFront = config.frontCoverTexture.clone()
    const coverTexBack = config.backCoverTexture.clone()

    // Orientar texturas de portada
    coverTexFront.center.set(0.5, 0.5)
    coverTexFront.rotation = -Math.PI / 2
    coverTexFront.needsUpdate = true

    coverTexBack.center.set(0.5, 0.5)
    coverTexBack.rotation = -Math.PI / 2
    coverTexBack.needsUpdate = true

    // Materiales de portada
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
      map: this.paperTex,
      roughness: 0.98,
      metalness: 0,
      color: 0xffffff,
    })

    // Geometrías base
    const coverW = this.pageW + this.coverPad * 2
    const coverGeom = new THREE.BoxGeometry(
      coverW,
      this.pageH + this.coverPad * 2,
      this.coverT,
    )
    const pagesGeom = new THREE.BoxGeometry(
      this.pageW,
      this.pageH,
      this.pageBlockT,
    )

    // Lomo
    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(
        Math.max(this.spineW, 0.06) + this.coverPad * 1.2,
        this.pageH + this.coverPad * 2,
        this.coverT + 0.15,
      ),
      new THREE.MeshStandardMaterial({
        color: 0x10172d,
        roughness: 0.9,
        metalness: 0,
      }),
    )
    spine.position.set(0, 0, this.coverCenterZ - 0.002)
    this.group.add(spine)

    // Pivots de flip
    this.pivotR = new THREE.Group()
    this.pivotR.position.x = this.pageGap / 2
    this.group.add(this.pivotR)

    this.pivotL = new THREE.Group()
    this.pivotL.position.x = -this.pageGap / 2
    this.group.add(this.pivotL)

    // Pivots de tapas
    const spineWidth = Math.max(this.spineW, 0.06) + this.coverPad * 1.2
    const spineHalfX = spineWidth / 2

    this.leftCoverPivot = new THREE.Group()
    this.leftCoverPivot.position.set(-spineHalfX, 0, this.coverCenterZ)
    this.group.add(this.leftCoverPivot)

    this.rightCoverPivot = new THREE.Group()
    this.rightCoverPivot.position.set(+spineHalfX, 0, this.coverCenterZ)
    this.group.add(this.rightCoverPivot)

    this.cover.leftPivot = this.leftCoverPivot
    this.cover.rightPivot = this.rightCoverPivot

    // Tapas
    this.leftCover = new THREE.Mesh(coverGeom, [
      coverSideMat,
      coverSideMat,
      coverSideMat,
      coverSideMat,
      coverInnerMat,
      coverMatBack,
    ])
    this.leftCover.position.set(-(coverW / 2), 0, 0)
    this.leftCoverPivot.add(this.leftCover)

    this.rightCover = new THREE.Mesh(coverGeom, [
      coverSideMat,
      coverSideMat,
      coverSideMat,
      coverSideMat,
      coverInnerMat,
      coverMatFront,
    ])
    this.rightCover.position.set(+(coverW / 2), 0, 0)
    this.rightCoverPivot.add(this.rightCover)

    // Bloques de hojas
    const pageEdgeMat = new THREE.MeshStandardMaterial({
      color: 0xf0e6cf,
      roughness: 0.98,
      metalness: 0,
    })
    const pageBlockL = new THREE.Mesh(pagesGeom, pageEdgeMat)
    pageBlockL.position.set(
      -(this.pageW / 2 + this.pageGap / 2),
      0,
      -(this.pageBlockT / 2),
    )

    const pageBlockR = new THREE.Mesh(pagesGeom, pageEdgeMat)
    pageBlockR.position.set(
      +(this.pageW / 2 + this.pageGap / 2),
      0,
      -(this.pageBlockT / 2),
    )

    // Materiales de páginas
    this.leftMat = new THREE.MeshStandardMaterial({
      roughness: 0.95,
      metalness: 0,
      side: THREE.FrontSide,
    })
    this.rightMat = new THREE.MeshStandardMaterial({
      roughness: 0.95,
      metalness: 0,
      side: THREE.FrontSide,
    })

    // Páginas visibles
    this.leftPage = new THREE.Mesh(
      new THREE.PlaneGeometry(this.pageW, this.pageH),
      this.leftMat,
    )
    this.leftPage.position.x = -(this.pageW / 2 + this.pageGap / 2)
    this.leftPage.position.z = +this.zEps
    this.leftPage.name = 'leftPage'

    this.rightPage = new THREE.Mesh(
      new THREE.PlaneGeometry(this.pageW, this.pageH),
      this.rightMat,
    )
    this.rightPage.position.x = +(this.pageW / 2 + this.pageGap / 2)
    this.rightPage.position.z = +this.zEps
    this.rightPage.name = 'rightPage'

    // Backs de papel
    const backPaperMatL = new THREE.MeshStandardMaterial({
      roughness: 0.98,
      metalness: 0,
      side: THREE.FrontSide,
      map: this.paperTex,
    })
    const backPaperMatR = new THREE.MeshStandardMaterial({
      roughness: 0.98,
      metalness: 0,
      side: THREE.FrontSide,
      map: this.paperTex,
    })

    const leftBack = new THREE.Mesh(
      new THREE.PlaneGeometry(this.pageW, this.pageH),
      backPaperMatL,
    )
    leftBack.position.copy(this.leftPage.position)
    leftBack.position.z = -this.zEps
    leftBack.rotation.y = Math.PI

    const rightBack = new THREE.Mesh(
      new THREE.PlaneGeometry(this.pageW, this.pageH),
      backPaperMatR,
    )
    rightBack.position.copy(this.rightPage.position)
    rightBack.position.z = -this.zEps
    rightBack.rotation.y = Math.PI

    // Páginas debajo
    this.underMatR = new THREE.MeshStandardMaterial({
      roughness: 0.95,
      metalness: 0,
      side: THREE.FrontSide,
    })
    this.underMatL = new THREE.MeshStandardMaterial({
      roughness: 0.95,
      metalness: 0,
      side: THREE.FrontSide,
    })

    this.underRight = new THREE.Mesh(
      new THREE.PlaneGeometry(this.pageW, this.pageH),
      this.underMatR,
    )
    this.underRight.position.copy(this.rightPage.position)
    this.underRight.position.z = this.zEps * 2
    this.underRight.renderOrder = 5
    this.underRight.visible = false

    this.underLeft = new THREE.Mesh(
      new THREE.PlaneGeometry(this.pageW, this.pageH),
      this.underMatL,
    )
    this.underLeft.position.copy(this.leftPage.position)
    this.underLeft.position.z = this.zEps * 2
    this.underLeft.renderOrder = 5
    this.underLeft.visible = false

    // Contenido del libro
    const content = new THREE.Group()
    this.group.add(content)

    this.halfL = new THREE.Group()
    this.halfR = new THREE.Group()
    content.add(this.halfL, this.halfR)

    this.halfL.add(
      pageBlockL,
      this.leftPage,
      leftBack,
      this.underLeft,
      this.pivotL,
    )
    this.halfR.add(
      pageBlockR,
      this.rightPage,
      rightBack,
      this.underRight,
      this.pivotR,
    )

    // Geometrías de flip
    this.geoTurnR = new THREE.PlaneGeometry(this.pageW, this.pageH)
    this.geoTurnR.translate(this.pageW / 2, 0, 0)

    this.geoTurnL = new THREE.PlaneGeometry(this.pageW, this.pageH)
    this.geoTurnL.translate(-this.pageW / 2, 0, 0)

    // Inicializar spread
    this.setSpread(this.spreadIndex)
  }

  public getGroup(): THREE.Group {
    return this.group
  }

  public getLeftPage(): THREE.Mesh {
    return this.leftPage
  }

  public getRightPage(): THREE.Mesh {
    return this.rightPage
  }

  public getLeftCover(): THREE.Mesh {
    return this.leftCover
  }

  public getRightCover(): THREE.Mesh {
    return this.rightCover
  }

  public isCoverOpen(): boolean {
    return this.cover.open
  }

  public isFlipActive(): boolean {
    return this.flip.active
  }

  public toggleCover(): void {
    if (this.flip.active || this.cover.anim) return
    this.cover.anim = true
    this.cover.t0 = performance.now() / 1000
    this.cover.open = !this.cover.open
    this.callbacks?.onCoverToggle?.(this.cover.open)
  }

  public flipPage(dir: number): void {
    if (!this.cover.open || this.cover.anim) return
    if (this.flip.active) return
    const nextIndex = this.spreadIndex + dir
    if (nextIndex < 0 || nextIndex >= this.spreads.length) return

    this.flip.active = true
    this.flip.dir = dir
    this.flip.t0 = performance.now() / 1000

    if (dir === 1) {
      // Avanzar
      this.flip.other = this.leftPage
      this.flip.otherWasVisible = this.leftPage.visible

      this.underRight.visible = true
      const nextSpread = this.spreads[nextIndex]
      this.underMatR.map = nextSpread.right
      this.underMatR.needsUpdate = true
      this.flip.under = this.underRight

      this.rightPage.visible = false
      this.flip.hidden = this.rightPage
      this.flip.pivot = this.pivotR
      this.pivotR.rotation.y = 0

      const frontTex = this.rightMat.map
      const backTexSource = nextSpread.left
      const backTex = this.getFlippedTex(
        backTexSource,
        `flip:${nextIndex}:left`,
      )

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

      this.flip.frontMesh = new THREE.Mesh(this.geoTurnR, frontMat)
      this.flip.backMesh = new THREE.Mesh(this.geoTurnR, backMat)
      this.flip.frontMesh.position.z = this.zEps * 10
      this.flip.backMesh.position.z = this.zEps * 10
      this.flip.frontMesh.renderOrder = 10
      this.flip.backMesh.renderOrder = 10

      this.pivotR.add(this.flip.frontMesh, this.flip.backMesh)
    } else {
      // Retroceder
      this.flip.other = this.rightPage
      this.flip.otherWasVisible = this.rightPage.visible

      this.underLeft.visible = true
      const nextSpread = this.spreads[nextIndex]
      this.underMatL.map = nextSpread.left
      this.underMatL.needsUpdate = true
      this.flip.under = this.underLeft

      this.leftPage.visible = false
      this.flip.hidden = this.leftPage
      this.flip.pivot = this.pivotL
      this.pivotL.rotation.y = 0

      const frontTex = this.leftMat.map
      const backTexSource = nextSpread.right
      const backTex = this.getFlippedTex(
        backTexSource,
        `flip:${nextIndex}:right`,
      )

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

      this.flip.frontMesh = new THREE.Mesh(this.geoTurnL, frontMat)
      this.flip.backMesh = new THREE.Mesh(this.geoTurnL, backMat)
      this.flip.frontMesh.position.z = this.zEps * 10
      this.flip.backMesh.position.z = this.zEps * 10
      this.flip.frontMesh.renderOrder = 10
      this.flip.backMesh.renderOrder = 10

      this.pivotL.add(this.flip.frontMesh, this.flip.backMesh)
    }
  }

  public update(_deltaTime: number): void {
    const easeInOut = (x: number) =>
      x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2

    // Animación de portada
    if (this.cover.anim) {
      const now = performance.now() / 1000
      const u = Math.min(1, (now - this.cover.t0) / this.speeds.cover)
      const k = easeInOut(u)
      const a = this.cover.open ? k : 1 - k

      if (this.cover.leftPivot && this.cover.rightPivot) {
        this.cover.leftPivot.rotation.y = THREE.MathUtils.lerp(
          this.cover.leftClosedRot,
          this.cover.leftOpenRot,
          a,
        )
        this.cover.rightPivot.rotation.y = THREE.MathUtils.lerp(
          this.cover.rightClosedRot,
          this.cover.rightOpenRot,
          a,
        )
      }

      const halfLClosedRotY = +Math.PI / 2
      const halfRClosedRotY = -Math.PI / 2
      this.halfL.rotation.y = THREE.MathUtils.lerp(halfLClosedRotY, 0, a)
      this.halfR.rotation.y = THREE.MathUtils.lerp(halfRClosedRotY, 0, a)

      if (!this.flip.active) {
        this.underLeft.visible = false
        this.underRight.visible = false
      }

      if (u >= 1) this.cover.anim = false
    } else {
      if (this.cover.leftPivot && this.cover.rightPivot) {
        this.cover.leftPivot.rotation.y = this.cover.open
          ? this.cover.leftOpenRot
          : this.cover.leftClosedRot
        this.cover.rightPivot.rotation.y = this.cover.open
          ? this.cover.rightOpenRot
          : this.cover.rightClosedRot
      }

      const closed = !this.cover.open
      const halfLClosedRotY = +Math.PI / 2
      const halfRClosedRotY = -Math.PI / 2
      this.halfL.rotation.y = closed ? halfLClosedRotY : 0
      this.halfR.rotation.y = closed ? halfRClosedRotY : 0

      if (!this.flip.active) {
        this.underLeft.visible = false
        this.underRight.visible = false
      }
    }

    // Animación de flip
    if (this.flip.active && this.flip.pivot) {
      const now = performance.now() / 1000
      const u = Math.min(1, (now - this.flip.t0) / this.speeds.flip)
      const k = easeInOut(u)

      if (this.flip.other)
        this.flip.other.visible = k <= 0.55 ? this.flip.otherWasVisible : false

      this.flip.pivot.rotation.y =
        (this.flip.dir === 1 ? -Math.PI : Math.PI) * k
      if (u >= 1) this.endFlip()
    }
  }

  private validateConfig(): void {
    if (!Array.isArray(this.spreads) || this.spreads.length === 0) {
      throw new Error('spreads debe tener al menos 1 spread')
    }
    if (!this.spreads.every(s => s.left && s.right)) {
      throw new Error('cada spread debe tener left y right')
    }
  }

  private setSpread(i: number): void {
    this.spreadIndex = THREE.MathUtils.clamp(i, 0, this.spreads.length - 1)

    const spread = this.spreads[this.spreadIndex]
    this.leftMat.map = spread.left
    this.rightMat.map = spread.right
    this.leftMat.needsUpdate = true
    this.rightMat.needsUpdate = true

    if (this.pageInfo) {
      this.pageInfo.textContent = `Spread ${this.spreadIndex + 1} / ${
        this.spreads.length
      }`
    }

    this.callbacks?.onSpreadChange?.(this.spreadIndex, this.spreads.length)
  }

  private endFlip(): void {
    const otherToRestore = this.flip.other
    if (otherToRestore) otherToRestore.visible = false

    const toReveal = this.flip.hidden
    if (toReveal) toReveal.visible = false

    this.cleanupFlipMeshes()
    this.setSpread(this.spreadIndex + this.flip.dir)

    if (toReveal) toReveal.visible = true
    if (otherToRestore) otherToRestore.visible = true

    this.flip.active = false
    this.flip.dir = 0
    this.flip.pivot = null
    this.flip.hidden = null
  }

  private cleanupFlipMeshes(): void {
    if (this.flip.frontMesh) {
      this.flip.pivot?.remove(this.flip.frontMesh)
      this.flip.frontMesh = null
    }
    if (this.flip.backMesh) {
      this.flip.pivot?.remove(this.flip.backMesh)
      this.flip.backMesh = null
    }
    if (this.flip.under) {
      this.flip.under.visible = false
      this.flip.under = null
    }
    if (this.flip.other) {
      this.flip.other.visible = this.flip.otherWasVisible
      this.flip.other = null
    }
    this.flip.otherWasVisible = true
  }

  private getFlippedTex(tex: THREE.Texture, cacheId: string): THREE.Texture {
    if (this.flippedCache.has(cacheId)) return this.flippedCache.get(cacheId)!
    const t = this.cloneFlipX(tex)
    this.flippedCache.set(cacheId, t)
    return t
  }

  private cloneFlipX(tex: THREE.Texture): THREE.Texture {
    const t = tex.clone()
    t.repeat.set(-1, 1)
    t.offset.set(1, 0)
    t.needsUpdate = true
    return t
  }
}
