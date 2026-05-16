import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <div style={{ padding: '20px', color: 'white', background: 'green' }}>
      <h1>¡REACT ESTÁ VIVO!</h1>
      <p>Si ves este recuadro verde, el problema está adentro de App.jsx</p>
    </div>
  </StrictMode>,
)
