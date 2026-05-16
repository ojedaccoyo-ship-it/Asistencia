import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const root = createRoot(document.getElementById('root'));

root.render(
  <div style={{ padding: '20px', color: 'white', background: '#3b82f6', minHeight: '100vh' }}>
    <h1>Arrancando Sistema...</h1>
    <p>Por favor, espera.</p>
  </div>
);

import('./App.jsx')
  .then(module => {
    const App = module.default;
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  })
  .catch(err => {
    root.render(
      <div style={{ padding: '20px', color: 'white', background: '#ef4444', minHeight: '100vh' }}>
        <h1>Error Crítico de Inicialización</h1>
        <p>El archivo principal falló al cargar. Aquí está el error exacto:</p>
        <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', overflowX: 'auto' }}>{err.toString()}</pre>
        <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', overflowX: 'auto', fontSize: '12px' }}>{err.stack}</pre>
      </div>
    );
  });
