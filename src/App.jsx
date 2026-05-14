import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Html5QrcodeScanner } from 'html5-qrcode'
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

  const registerAttendance = (type) => {
    setStatus('success')
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#6366f1', '#10b981', '#f43f5e'] })
    
    const records = JSON.parse(localStorage.getItem('attendance_logs') || '[]')
    records.unshift({ 
      name: employeeName, 
      timestamp: new Date().toISOString(),
      type: type 
    })
    localStorage.setItem('attendance_logs', JSON.stringify(records))

    setTimeout(() => {
      setStatus('idle')
      setScanning(true)
    }, 3500)
  }

  useEffect(() => {
    if (scanning && status === 'idle') {
      const scanner = new Html5QrcodeScanner("reader", { 
        fps: 25, 
        qrbox: { width: 280, height: 280 },
        aspectRatio: 1.0 
      })
      scanner.render(handleScan, (err) => {})
      return () => scanner.clear().catch(e => {})
    }
  }, [scanning, status])

  const registerDevice = (name) => {
    if (!name.trim()) return
    localStorage.setItem('emp_name', name)
    setEmployeeName(name)
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

  if (!employeeName) {
    return (
      <div style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto', minHeight: '90vh', display: 'flex', alignItems: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} style={{ width: '100%' }}>
          <Card style={{ padding: '2.5rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
              <div style={{ 
                background: 'linear-gradient(135deg, #6366f1, #a855f7)', 
                width: '70px', height: '70px', borderRadius: '22px', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                margin: '0 auto 1.5rem',
                boxShadow: '0 15px 30px -5px rgba(99, 102, 241, 0.4)'
              }}>
                <Smartphone color="white" size={34} />
              </div>
              <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Tu Identidad</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Vincula este celular a tu cuenta de empleado.</p>
            </div>
            
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block', fontWeight: '600', textTransform: 'uppercase' }}>Nombre Completo</label>
              <input 
                type="text" 
                placeholder="Ej. Juan Pérez"
                id="nameInput"
                style={{ width: '100%', padding: '1.2rem', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white', fontSize: '1.1rem', boxSizing: 'border-box' }}
              />
            </div>
            
            <button className="btn-primary" style={{ width: '100%', padding: '1.2rem', fontSize: '1.1rem' }} onClick={() => registerDevice(document.getElementById('nameInput').value)}>
              Vincular Dispositivo <ChevronRight size={20} />
            </button>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
      <AnimatePresence mode="wait">
        {status === 'success' ? (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }} style={{ padding: '4rem 1rem' }}>
            <div className="float-animation">
              <CheckCircle2 size={100} color="#10b981" style={{ margin: '0 auto 2rem', filter: 'drop-shadow(0 0 20px rgba(16, 185, 129, 0.4))' }} />
            </div>
            <h1 style={{ fontSize: '2.8rem', marginBottom: '1rem' }}>¡Perfecto!</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '300px', margin: '0 auto' }}>Tu registro ha sido procesado con éxito.</p>
          </motion.div>
        ) : status === 'selecting' ? (
          <motion.div key="selecting" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}>
            <div style={{ marginBottom: '2.5rem', textAlign: 'left' }}>
              <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Selecciona <span className="text-gradient">Acción</span></h2>
              <p style={{ color: 'var(--text-muted)' }}>¿Qué registro deseas realizar ahora?</p>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
              <AttendanceButton label="Ingreso" color="#10b981" icon={UserCheck} description="Entrada mañana" />
              <AttendanceButton label="Almuerzo" color="#fbbf24" icon={Clock} description="Inicio descanso" />
              <AttendanceButton label="Regreso" color="#818cf8" icon={History} description="Fin de descanso" />
              <AttendanceButton label="Salida" color="#f43f5e" icon={LayoutDashboard} description="Fin de jornada" />
            </div>
            
            <button className="btn-secondary" style={{ marginTop: '2.5rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', textDecoration: 'underline' }} onClick={() => { setStatus('idle'); setScanning(true); }}>
              Cancelar y volver a escanear
            </button>
          </motion.div>
        ) : (
          <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div style={{ textAlign: 'left' }}>
                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase' }}>Sesión Activa</p>
                <h3 style={{ margin: 0, fontSize: '1.3rem' }}>{employeeName}</h3>
              </div>
              <button onClick={() => { localStorage.clear(); window.location.reload(); }} style={{ background: 'rgba(244, 63, 94, 0.1)', border: 'none', color: '#f43f5e', fontSize: '0.75rem', padding: '0.5rem 1rem', borderRadius: '10px', fontWeight: '600' }}>Cerrar Sesión</button>
            </div>
            
            <div style={{ position: 'relative' }}>
              <div id="reader" style={{ borderRadius: '32px', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}></div>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '220px', height: '220px', border: '2px dashed rgba(99, 102, 241, 0.5)', borderRadius: '30px', pointerEvents: 'none' }}></div>
            </div>
            
            <div style={{ marginTop: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem', color: 'var(--text-muted)' }}>
              <div style={{ width: '6px', height: '6px', background: 'var(--primary)', borderRadius: '50%', boxShadow: '0 0 8px var(--primary)' }}></div>
              <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>Buscando código QR de oficina...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// --- 3. VISTA ADMIN (Panel de Control) ---

const AdminView = () => {
  const [logs, setLogs] = useState([])

  useEffect(() => {
    const updateLogs = () => {
      const localLogs = JSON.parse(localStorage.getItem('attendance_logs') || '[]')
      setLogs(localLogs)
    }
    updateLogs()
    const interval = setInterval(updateLogs, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ padding: '1rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '0.2rem' }}>Control <span className="text-gradient">Maestro</span></h1>
          <p style={{ color: 'var(--text-muted)' }}>Gestión de personal en tiempo real</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link to="/kiosko" target="_blank" className="btn-secondary" style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.05)', padding: '0.8rem 1.5rem', borderRadius: '14px', border: '1px solid var(--glass-border)', fontSize: '0.9rem', color: 'white' }}>Monitor QR</Link>
          <Link to="/mobile" target="_blank" className="btn-secondary" style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.05)', padding: '0.8rem 1.5rem', borderRadius: '14px', border: '1px solid var(--glass-border)', fontSize: '0.9rem', color: 'white' }}>Vista Móvil</Link>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <Card style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, padding: '1rem' }}>
              <Users size={40} color="var(--primary)" style={{ opacity: 0.2 }} />
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '600', textTransform: 'uppercase' }}>Registros Hoy</p>
            <div style={{ fontSize: '3.5rem', fontWeight: '800', margin: '0.5rem 0' }}>{logs.length}</div>
            <div style={{ fontSize: '0.85rem', color: '#10b981' }}>+12% que ayer</div>
          </Card>
          
          <Card>
            <h3 style={{ marginBottom: '1.5rem' }}>Resumen por Tipo</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {['Ingreso', 'Almuerzo', 'Regreso', 'Salida'].map(type => {
                const count = logs.filter(l => l.type.includes(type)).length
                return (
                  <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{type}</span>
                    <span style={{ fontWeight: '700' }}>{count}</span>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        <Card style={{ padding: '1.5rem 0' }}>
          <div style={{ padding: '0 2rem 1.5rem 2rem', borderBottom: '1px solid var(--glass-border)' }}>
            <h3 style={{ margin: 0 }}>Historial de Actividad</h3>
          </div>
          <div style={{ maxHeight: '500px', overflowY: 'auto', padding: '0 1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0.8rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '1rem' }}>Empleado</th>
                  <th style={{ padding: '1rem' }}>Acción</th>
                  <th style={{ padding: '1rem' }}>Hora Exacta</th>
                  <th style={{ padding: '1rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>Sin registros recientes</td></tr>
                ) : (
                  logs.map((log, i) => (
                    <motion.tr initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} key={i} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '14px' }}>
                      <td style={{ padding: '1rem', borderRadius: '14px 0 0 14px', fontWeight: '600' }}>{log.name}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ 
                          background: log.type.includes('Ingreso') ? 'rgba(16, 185, 129, 0.15)' : 
                                     log.type.includes('Salida') ? 'rgba(244, 63, 94, 0.15)' : 
                                     log.type.includes('Almuerzo') ? 'rgba(251, 191, 36, 0.15)' : 'rgba(129, 140, 248, 0.15)',
                          color: log.type.includes('Ingreso') ? '#10b981' : 
                                 log.type.includes('Salida') ? '#f43f5e' : 
                                 log.type.includes('Almuerzo') ? '#fbbf24' : '#818cf8',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '10px',
                          fontSize: '0.8rem',
                          fontWeight: '700'
                        }}>
                          {log.type}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{new Date(log.timestamp).toLocaleTimeString()}</td>
                      <td style={{ padding: '1rem', borderRadius: '0 14px 14px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontSize: '0.85rem', fontWeight: '600' }}>
                          <div style={{ width: '6px', height: '6px', background: '#10b981', borderRadius: '50%' }}></div>
                          VÁLIDO
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/admin" element={<AdminView />} />
        <Route path="/kiosko" element={<KioskView />} />
        <Route path="/mobile" element={<MobileView />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
