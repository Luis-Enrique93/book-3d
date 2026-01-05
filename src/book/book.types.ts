import * as THREE from 'three'

export interface Spread {
  left: THREE.Texture
  right: THREE.Texture
}

export interface BookDimensions {
  pageWidth?: number
  pageHeight?: number
  pageGap?: number
  spineWidth?: number
  coverThickness?: number
  pageBlockThickness?: number
  coverPadding?: number
}

export interface BookAnimationSpeeds {
  cover?: number
  flip?: number
}

export interface BookConfig {
  frontCoverTexture: THREE.Texture
  backCoverTexture: THREE.Texture
  paperTexture: THREE.Texture
  spreads: Spread[]
  dimensions?: BookDimensions
  speeds?: BookAnimationSpeeds
  initialSpreadIndex?: number
  pageInfoElementId?: string
}

export interface BookCallbacks {
  onSpreadChange?: (index: number, total: number) => void
  onCoverToggle?: (isOpen: boolean) => void
}
