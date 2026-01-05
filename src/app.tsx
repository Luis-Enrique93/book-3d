import './app.css'
import { Component, type JSX } from 'preact'
import { Game } from './game'

export class App extends Component {
  public override componentDidMount(): void {
    Game.getInstance()
  }

  public override render(): JSX.Element {
    return (
      <div>
        <div class='hud'>
          <b>Libro 3D</b> + <b>OrbitControls</b>
          <br />
          Arrastra para orbitar · rueda para zoom
          <br />
          Click derecha = siguiente · izquierda = anterior · <kbd>→</kbd>/
          <kbd>←</kbd> · <kbd>C</kbd> abrir/cerrar
        </div>
        <div class='hint' id='pageInfo'>
          Spread 1
        </div>
      </div>
    )
  }
}
