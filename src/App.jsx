import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Html5Qrcode } from 'html5-qrcode'
import { 
  LayoutDashboard, 
  QrCode, 
  Scan, 
  History, 
  Users, 
  Monitor, 
  Smartphone,
  CheckCircle2,
  Clock,
  UserCheck,
  ChevronRight
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { supabase } from './lib/supabase'

// --- Simulación de Base de Datos Local (hasta que se configuren las llaves) ---
const mockAttendance = [
  { id: 1, name: 'Admin Demo', timestamp: new Date().toISOString() }
]

// --- Componentes Compartidos ---

const Card = ({ children, className = "" }) => (
  <div className={`glass-card ${className}`}>
    {children}
  </div>
)

// --- 1. VISTA DE KIOSKO (Pantalla de Oficina) ---

const KioskView = () => {
  const [qrValue, setQrValue] = useState(`checkin-${Date.now()}`)
  const [timeLeft, setTimeLeft] = useState(30)
  
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          const newToken = `checkin-${Date.now()}`
          setQrValue(newToken)
          return 30
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div style={{ height: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <div className="float-animation">
          <h1 style={{ fontSize: '4.5rem', letterSpacing: '-0.02em' }}>Punto de <span className="text-gradient">Control</span></h1>
        </div>
        <p style={{ fontSize: '1.4rem', color: 'var(--text-muted)', marginBottom: '3.5rem', fontWeight: '300' }}>Escanea para registrar tu jornada laboral</p>
        
        <div className="glass-card" style={{ padding: '3.5rem', position: 'relative', display: 'inline-block', borderRadius: '40px' }}>
          <div style={{ 
            position: 'absolute', top: 0, left: 0, height: '8px', 
            background: 'linear-gradient(90deg, #6366f1, #34d399)', 
            width: `${(timeLeft / 30) * 100}%`, transition: 'width 1s linear',
            borderRadius: '40px 40px 0 0'
          }}></div>
          
          <div className="qr-container" style={{ padding: '2rem', background: 'white', borderRadius: '30px' }}>
            <QRCodeSVG value={qrValue} size={380} level="H" includeMargin={true} />
          </div>

          <div style={{ marginTop: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.2rem' }}>
            <div style={{ background: timeLeft < 5 ? 'rgba(244, 63, 94, 0.1)' : 'rgba(16, 185, 129, 0.1)', padding: '0.8rem 1.5rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'all 0.3s' }}>
              <Clock size={28} color={timeLeft < 5 ? '#f43f5e' : '#10b981'} />
              <span style={{ fontSize: '1.8rem', fontWeight: '700', color: timeLeft < 5 ? '#f43f5e' : '#10b981' }}>{timeLeft}s</span>
            </div>
          </div>
        </div>
        
        <div style={{ marginTop: '3rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <div style={{ width: '8px', height: '8px', background: '#34d399', borderRadius: '50%', boxShadow: '0 0 10px #34d399' }}></div>
          <span style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Servidor Seguro Activo</span>
        </div>
      </motion.div>
    </div>
  )
}

// --- 2. VISTA MÓVIL (Celular del Empleado) ---

const MobileView = () => {
  const [employeeName, setEmployeeName] = useState(localStorage.getItem('emp_name') || '')
  const [employeePhone, setEmployeePhone] = useState(localStorage.getItem('emp_phone') || '')
  const [scanning, setScanning] = useState(!!employeeName)
  const [status, setStatus] = useState('idle') // idle, selecting, success
  const [lastScanData, setLastScanData] = useState(null)

  const handleScan = (decodedText) => {
    if (decodedText.startsWith('checkin-')) {
      setLastScanData(decodedText)
      setScanning(false)
      setStatus('selecting')
    }
  }

  const registerAttendance = async (type) => {
    setStatus('success')
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#6366f1', '#10b981', '#f43f5e'] })
    
    const record = { 
      nombre: employeeName, 
      celular: employeePhone,
      tipo: type,
      timestamp: new Date().toISOString()
    }

    // Guardar en Supabase si está configurado
    try {
      const { error } = await supabase.from('asistencia').insert([record])
      if (error) console.error("Error en Supabase:", error)
    } catch (e) {
      console.error("Error de conexión:", e)
    }

    // Seguir guardando en local como respaldo
    const records = JSON.parse(localStorage.getItem('attendance_logs') || '[]')
    records.unshift(record)
    localStorage.setItem('attendance_logs', JSON.stringify(records))

    setTimeout(() => {
      setStatus('idle')
      setScanning(true)
    }, 3500)
  }

  useEffect(() => {
    let html5QrCode = null;
    
    if (scanning && status === 'idle') {
      const initScanner = setTimeout(() => {
        const readerElement = document.getElementById('reader');
        if (!readerElement) return;

        try {
          html5QrCode = new Html5Qrcode("reader");
          html5QrCode.start(
            { facingMode: "environment" }, 
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0
            },
            (decodedText) => handleScan(decodedText),
            (errorMessage) => { /* silencioso */ }
          ).catch(err => {
            console.error("Error al arrancar cámara:", err);
          });
        } catch (err) {
          console.error("Error inicializando:", err);
        }
      }, 300);

      return () => {
        clearTimeout(initScanner);
        if (html5QrCode && html5QrCode.isScanning) {
          html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error);
        }
      }
    }
  }, [scanning, status])

  const registerDevice = (name, phone) => {
    if (!name.trim() || !phone.trim()) return
    localStorage.setItem('emp_name', name)
    localStorage.setItem('emp_phone', phone)
    setEmployeeName(name)
    setEmployeePhone(phone)
    setScanning(true)
  }

  const AttendanceButton = ({ label, color, icon: Icon, description }) => (
    <button 
      onClick={() => registerAttendance(label)}
      className="hover-card"
      style={{ 
        background: 'rgba(255,255,255,0.03)', 
        border: `1px solid ${color}33`, 
        borderRadius: '24px', 
        padding: '1.8rem 1rem', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        gap: '0.8rem',
        cursor: 'pointer',
        color: 'white',
        width: '100%',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      <div style={{ 
        background: `linear-gradient(135deg, ${color}22, ${color}11)`, 
        padding: '1.2rem', 
        borderRadius: '20px',
        boxShadow: `0 8px 16px -4px ${color}33`
      }}>
        <Icon color={color} size={32} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '0.2rem' }}>{label}</div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '400' }}>{description}</div>
      </div>
    </button>
  )

  return (
    <div className="mobile-app-shell">
      {!employeeName ? (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mobile-card">
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, #6366f1, #a855f7)', 
              width: '80px', height: '80px', borderRadius: '24px', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              margin: '0 auto 1.5rem',
              boxShadow: '0 15px 30px -5px rgba(99, 102, 241, 0.4)'
            }}>
              <Smartphone color="white" size={36} />
            </div>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Tu Identidad</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Vincula este celular a tu cuenta.</p>
          </div>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block', fontWeight: '600' }}>NOMBRE COMPLETO</label>
            <input type="text" id="nameInput" className="glass-card" style={{ width: '100%', padding: '1.2rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '16px' }} />
          </div>

          <div style={{ marginBottom: '2.5rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block', fontWeight: '600' }}>NÚMERO DE CELULAR</label>
            <input type="tel" id="phoneInput" className="glass-card" style={{ width: '100%', padding: '1.2rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '16px' }} />
          </div>
          
          <button className="btn-primary" style={{ width: '100%', padding: '1.2rem' }} onClick={() => registerDevice(document.getElementById('nameInput').value, document.getElementById('phoneInput').value)}>
            Registrar Dispositivo <ChevronRight size={20} />
          </button>
        </motion.div>
      ) : (
        <div className="mobile-card">
          <AnimatePresence mode="wait">
            {status === 'success' ? (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} style={{ textAlign: 'center', padding: '2rem 0' }}>
                <CheckCircle2 size={100} color="#10b981" style={{ margin: '0 auto 2rem' }} />
                <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>¡Perfecto!</h1>
                <p style={{ color: 'var(--text-muted)' }}>Tu registro ha sido procesado.</p>
              </motion.div>
            ) : status === 'selecting' ? (
              <motion.div key="selecting" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <h2 style={{ fontSize: '1.8rem', marginBottom: '2rem', textAlign: 'center' }}>¿Qué deseas <span className="text-gradient">Marcar</span>?</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <AttendanceButton label="Ingreso" color="#10b981" icon={UserCheck} description="Mañana" />
                  <AttendanceButton label="Almuerzo" color="#fbbf24" icon={Clock} description="Inicio" />
                  <AttendanceButton label="Regreso" color="#818cf8" icon={History} description="Fin" />
                  <AttendanceButton label="Salida" color="#f43f5e" icon={LayoutDashboard} description="Tarde" />
                </div>
              </motion.div>
            ) : (
              <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.1rem' }}>
                      <div style={{ width: '6px', height: '6px', background: '#34d399', borderRadius: '50%' }}></div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>ACTIVO</span>
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{employeeName}</h3>
                  </div>
                  <button onClick={() => { localStorage.clear(); window.location.reload(); }} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#f43f5e', fontSize: '0.7rem', padding: '0.5rem 1rem', borderRadius: '12px' }}>Salir</button>
                </div>
                
                <div className="scanner-wrapper">
                  <div id="reader"></div>
                  <div className="scanner-lens">
                    <div className="scanner-corner corner-tl"></div>
                    <div className="scanner-corner corner-tr"></div>
                    <div className="scanner-corner corner-bl"></div>
                    <div className="scanner-corner corner-br"></div>
                    <div className="scan-line"></div>
                  </div>
                </div>
                
                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                  <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.4rem' }}>Escaneando QR...</div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Apunta a la pantalla de la entrada</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// --- 3. VISTA ADMIN (Panel de Control) ---

const AdminView = () => {
  const [logs, setLogs] = useState([])
  const [dbStatus, setDbStatus] = useState('checking')

  useEffect(() => {
    let channel;
    
    const initAdmin = async () => {
      try {
        // 1. Carga inicial
        const { data, error } = await supabase
          .from('asistencia')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(50)
        
        if (error) throw error
        setLogs(data || [])
        setDbStatus('ok')

        // 2. Suscripción Realtime
        channel = supabase
          .channel('admin-live')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'asistencia' }, (payload) => {
            setLogs(prev => [payload.new, ...prev])
          })
          .subscribe()
          
      } catch (e) {
        console.error("Error Admin:", e)
        setDbStatus('error')
      }
    }

    initAdmin()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [])

  return (
    <div style={{ padding: '20px', minHeight: '100vh', background: 'var(--bg-dark)', color: 'white' }}>
      <header style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2rem' }}>Panel <span className="text-gradient">Admin</span></h1>
        <div style={{ 
          display: 'inline-block', padding: '5px 15px', borderRadius: '20px', 
          fontSize: '0.8rem', background: dbStatus === 'ok' ? '#10b98122' : '#f43f5e22',
          color: dbStatus === 'ok' ? '#10b981' : '#f43f5e', border: '1px solid currentColor'
        }}>
          {dbStatus === 'ok' ? '● CONECTADO' : dbStatus === 'error' ? '● ERROR DE RED' : '● VERIFICANDO...'}
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        <Card style={{ padding: '20px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>REGISTROS TOTALES</div>
          <div style={{ fontSize: '3rem', fontWeight: 'bold' }}>{logs.length}</div>
        </Card>

        <Card style={{ gridColumn: 'span 2', padding: '20px', overflowX: 'auto' }}>
          <h3 style={{ marginBottom: '20px' }}>Actividad Reciente</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px' }}>Empleado</th>
                <th style={{ padding: '10px' }}>Acción</th>
                <th style={{ padding: '10px' }}>Hora</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan="3" style={{ textAlign: 'center', padding: '20px' }}>Esperando registros...</td></tr>
              ) : (
                logs.map((log, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px', fontWeight: '600' }}>{log.nombre || 'Anónimo'}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ color: log.tipo?.includes('Ingreso') ? '#10b981' : '#818cf8' }}>{log.tipo}</span>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                      {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '--:--'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}

// --- PANTALLA DE SELECCIÓN INICIAL ---

const Welcome = () => (
  <div style={{ height: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
    <h1 style={{ marginBottom: '3rem' }}>Sistema de <span className="text-gradient">Asistencia QR</span></h1>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', maxWidth: '800px', width: '100%' }}>
      <Link to="/kiosko" style={{ textDecoration: 'none' }}>
        <Card className="hover-card" style={{ height: '100%', textAlign: 'center', cursor: 'pointer' }}>
          <Monitor size={48} style={{ marginBottom: '1.5rem', color: 'var(--primary)' }} />
          <h2>App Pantalla</h2>
          <p style={{ color: 'var(--text-muted)' }}>Muestra el QR en la entrada de la oficina</p>
        </Card>
      </Link>
      <Link to="/mobile" style={{ textDecoration: 'none' }}>
        <Card className="hover-card" style={{ height: '100%', textAlign: 'center', cursor: 'pointer' }}>
          <Smartphone size={48} style={{ marginBottom: '1.5rem', color: '#34d399' }} />
          <h2>App Móvil</h2>
          <p style={{ color: 'var(--text-muted)' }}>Para que los empleados escaneen con su celular</p>
        </Card>
      </Link>
      <Link to="/admin" style={{ textDecoration: 'none', gridColumn: 'span 2' }}>
        <Card className="hover-card" style={{ textAlign: 'center', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
          <LayoutDashboard size={24} />
          <span>Panel de Administración</span>
        </Card>
      </Link>
    </div>
  </div>
)

// --- CAPTURADOR DE ERRORES GLOBAL ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#f43f5e', background: '#0f172a', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h2>Oops! Algo salió mal.</h2>
          <p>La aplicación se detuvo. Por favor, toma una captura de este error:</p>
          <pre style={{ background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '10px', textAlign: 'left', overflowX: 'auto', color: 'white', marginTop: '1rem' }}>
            {this.state.error && this.state.error.toString()}
          </pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: '2rem', padding: '1rem', background: '#f43f5e', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>
            Recargar Página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MobileView />} />
          <Route path="/admin" element={<AdminView />} />
          <Route path="/kiosko" element={<KioskView />} />
          <Route path="/mobile" element={<MobileView />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
