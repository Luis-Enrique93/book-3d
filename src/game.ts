import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Book } from './book'
import type { BookConfig } from './book'
import {
  makePageTexture,
  makeCoverTexture,
  tuneCoverTexture,
} from './book/texture-generator'
import type { PageContent, CoverContent } from './book/texture-generator'

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
    // Generar texturas del libro
    // ---------------------------
    const paperTex = makePageTexture(renderer, {
      title: '',
      body: '',
      pageLabel: '',
    })

    const frontCoverContent: CoverContent = {
      title: 'Tzedek Tome',
      subtitle: 'Prototype Grimoire',
      author: 'Luis Enrique',
      accent: '#d6b35c',
      sigilText: 'TV',
    }
    const frontCoverTex = makeCoverTexture(renderer, frontCoverContent, 'front')
    tuneCoverTexture(frontCoverTex)

    const backCoverContent: CoverContent = {
      accent: '#8bd6ff',
      sigilText: '',
      blurb:
        'Un libro 3D simple (tipo Skyrim) con paginas que se pasan en tiempo real.\n\n' +
        '- Portada + contratapa + lomo\n' +
        '- Texturas generadas con Canvas\n' +
        '- Flip con doble cara y sin parpadeos\n\n' +
        'Siguiente: curvatura de hoja, sombras y sonido.',
    }
    const backCoverTex = makeCoverTexture(renderer, backCoverContent, 'back')
    tuneCoverTexture(backCoverTex)

    const pageContents: PageContent[] = [
      {
        title: 'Bienvenido',
        body:
          'Este es un libro simple hecho con planos.\n' +
          'La pagina es una textura generada con Canvas.\n\n' +
          'Haz click en la pagina derecha para avanzar.',
        pageLabel: 'Pag. 1',
      },
      {
        title: 'Como se usa',
        body:
          'Arrastra para orbitar, rueda para zoom.\n' +
          'Click derecha = siguiente, izquierda = anterior.\n\n' +
          'Ahora ademas hay animacion de pasar pagina.',
        pageLabel: 'Pag. 2',
      },
      {
        title: 'Texto dinamico',
        body:
          'Podemos inyectar texto desde JSON, tu backend, o incluso desde Markdown.\n' +
          'Tambien podemos cambiar tipografias, margenes y estilos.',
        pageLabel: 'Pag. 3',
      },
      {
        title: 'Proximo paso',
        body:
          'El siguiente upgrade (si quieres) es doblar la hoja con subdivisiones\n' +
          'para que se curve durante el giro.',
        pageLabel: 'Pag. 4',
      },
      {
        title: 'Lore',
        body:
          'Esto ya sirve para libros tipo Skyrim: notas, cartas, bestiarios.\n' +
          'Lo importante es la tipografia, el ritmo y el sonido.',
        pageLabel: 'Pag. 5',
      },
      {
        title: 'Fin',
        body:
          'Cuando quieras, hacemos: portada, lomo, sombras,\n' +
          'y una curvatura leve al girar.',
        pageLabel: 'Pag. 6',
      },
    ]

    const spreads = [
      {
        left: makePageTexture(renderer, pageContents[0]),
        right: makePageTexture(renderer, pageContents[1]),
      },
      {
        left: makePageTexture(renderer, pageContents[2]),
        right: makePageTexture(renderer, pageContents[3]),
      },
      {
        left: makePageTexture(renderer, pageContents[4]),
        right: makePageTexture(renderer, pageContents[5]),
      },
    ]

    // ---------------------------
    // Configuración del libro
    // ---------------------------
    const bookConfig: BookConfig = {
      frontCoverTexture: frontCoverTex,
      backCoverTexture: backCoverTex,
      paperTexture: paperTex,
      spreads,
      pageInfoElementId: 'pageInfo',
    }

    const book = new Book(renderer, camera, bookConfig)
    scene.add(book.getGroup())

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
      if (book.isFlipActive()) return

      const dx = ev.clientX - downX
      const dy = ev.clientY - downY
      const dist2 = dx * dx + dy * dy
      const elapsed = performance.now() - downAt
      if (dist2 > 25 || elapsed > 350) return

      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1)

      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(
        [book.getLeftPage(), book.getRightPage()],
        true,
      )
      if (!hits.length) return

      const hit = hits[0].object
      if (hit.name === 'rightPage') book.flipPage(1)
      if (hit.name === 'leftPage') book.flipPage(-1)
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)

    // Doble click en la tapa para abrir/cerrar
    function toggleCoverFromPointer(ev: PointerEvent) {
      if (book.isFlipActive()) return
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1)
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(
        [book.getLeftCover(), book.getRightCover()],
        true,
      )
      if (hits.length) book.toggleCover()
    }
    renderer.domElement.addEventListener(
      'dblclick',
      toggleCoverFromPointer as EventListener,
    )

    // Teclado
    window.addEventListener('keydown', e => {
      if (e.key === 'c' || e.key === 'C') book.toggleCover()
      if (book.isFlipActive()) return
      if (e.key === 'ArrowRight') book.flipPage(1)
      if (e.key === 'ArrowLeft') book.flipPage(-1)
    })

    // ---------------------------
    // Loop
    // ---------------------------
    const clock = new THREE.Clock()
    function animate() {
      const deltaTime = clock.getDelta()
      book.update(deltaTime)

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
