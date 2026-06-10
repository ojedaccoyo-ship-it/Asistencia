import React, { useState, useEffect, useMemo } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Html5Qrcode } from 'html5-qrcode'
import { 
  LayoutDashboard, QrCode, Scan, History, Users, Monitor, Smartphone,
  CheckCircle2, Clock, UserCheck, ChevronRight, BarChart3, CalendarDays, 
  FileEdit, AlertCircle, CalendarOff, Home
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { supabase } from './lib/supabase'
import { format, parseISO, isToday, isSameDay, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

// --- Componentes Compartidos ---
const Card = ({ children, className = "", padding = "2rem" }) => (
  <div className={`glass-card ${className}`} style={{ padding }}>
    {children}
  </div>
)

const COLORS = ['#10b981', '#f59e0b', '#6366f1', '#f43f5e'];

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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <div className="float-animation">
          <h1 style={{ fontSize: '4.5rem', letterSpacing: '-0.02em' }}>Punto de <span className="text-gradient">Control</span></h1>
        </div>
        <p style={{ fontSize: '1.4rem', color: 'var(--text-muted)', marginBottom: '3.5rem', fontWeight: '300' }}>Escanea para registrar tu jornada laboral</p>
        
        <div className="glass-card hover-card" style={{ padding: '3.5rem', position: 'relative', display: 'inline-block', borderRadius: '40px' }}>
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
      </motion.div>
    </div>
  )
}

// --- 2. VISTA MÓVIL (Celular del Empleado) ---
const MobileView = () => {
  const [employeeName, setEmployeeName] = useState(localStorage.getItem('emp_name') || '')
  const [employeePhone, setEmployeePhone] = useState(localStorage.getItem('emp_phone') || '')
  const [activeTab, setActiveTab] = useState('scan') // scan, stats, permisos
  
  const [scanning, setScanning] = useState(false)
  const [status, setStatus] = useState('idle') 
  const [myLogs, setMyLogs] = useState([])

  // Cargar mis registros
  useEffect(() => {
    if (employeePhone && activeTab === 'stats') {
      const loadMyData = async () => {
        try {
          const { data } = await supabase.from('asistencia').select('*').eq('celular', employeePhone).order('timestamp', { ascending: false }).limit(20)
          if (data) setMyLogs(data)
        } catch (e) {
          console.error(e)
        }
      }
      loadMyData()
    }
  }, [employeePhone, activeTab])

  const handleScan = (decodedText) => {
    if (decodedText.startsWith('checkin-')) {
      setScanning(false)
      setStatus('selecting')
    }
  }

  const registerAttendance = async (type) => {
    setStatus('success')
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#6366f1', '#10b981', '#f43f5e'] })
    
    const record = { nombre: employeeName, celular: employeePhone, tipo: type, timestamp: new Date().toISOString() }

    try {
      await supabase.from('asistencia').insert([record])
    } catch (e) { console.error(e) }

    setTimeout(() => {
      setStatus('idle')
      setActiveTab('stats')
    }, 3000)
  }

  const requestPermission = async (tipo) => {
    const record = { nombre: employeeName, celular: employeePhone, tipo: tipo, timestamp: new Date().toISOString() }
    try {
      await supabase.from('asistencia').insert([record])
      alert(`Tu solicitud de ${tipo} ha sido enviada al administrador.`)
      setActiveTab('stats')
    } catch (e) {
      alert("Hubo un error al enviar la solicitud.")
    }
  }

  useEffect(() => {
    let html5QrCode = null;
    if (activeTab === 'scan' && scanning && status === 'idle') {
      const initScanner = setTimeout(() => {
        const readerElement = document.getElementById('reader');
        if (!readerElement) return;

        try {
          html5QrCode = new Html5Qrcode("reader");
          html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
            (text) => handleScan(text), () => {}
          ).catch(err => console.error(err));
        } catch (err) { console.error(err); }
      }, 300);

      return () => {
        clearTimeout(initScanner);
        if (html5QrCode && html5QrCode.isScanning) {
          html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error);
        }
      }
    }
  }, [scanning, status, activeTab])

  if (!employeeName) {
    return (
      <div className="mobile-app-shell">
        <Card className="mobile-card" padding="2.5rem">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '1rem', borderRadius: '50%', display: 'inline-block', marginBottom: '1rem' }}>
              <UserPlus size={40} color="var(--primary)" />
            </div>
            <h2 style={{ fontSize: '1.8rem', margin: '0 0 0.5rem 0' }}>Registro Inicial</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Ingresa tus datos para vincular tu dispositivo.</p>
          </div>
          
          <form onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.target)
            const n = fd.get('name'); const p = fd.get('phone')
            if (n && p) {
              localStorage.setItem('emp_name', n); localStorage.setItem('emp_phone', p)
              setEmployeeName(n); setEmployeePhone(p)
            }
          }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Nombre Completo</label>
              <input name="name" type="text" required style={{ width: '100%', padding: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: '1rem' }} />
            </div>
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Número de Celular</label>
              <input name="phone" type="tel" required style={{ width: '100%', padding: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: '1rem' }} />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%' }}>Comenzar <ChevronRight size={20}/></button>
          </form>
        </Card>
      </div>
    )
  }

  return (
    <div className="mobile-app-shell" style={{ paddingBottom: '80px', justifyContent: 'flex-start', paddingTop: '2rem' }}>
      {/* Header */}
      <div style={{ width: '100%', maxWidth: '400px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '600' }}><div style={{width:8, height:8, background:'#10b981', borderRadius:'50%'}}></div> ACTIVO</span>
          <h3 style={{ margin: 0, fontSize: '1.4rem' }}>{employeeName}</h3>
        </div>
      </div>

      {activeTab === 'scan' && (
        <Card className="mobile-card" padding="1.5rem">
          {status === 'idle' && (
            <>
              {!scanning ? (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <QrCode size={60} color="var(--primary)" style={{ marginBottom: '1rem', opacity: 0.8 }} />
                  <h3 style={{ marginBottom: '0.5rem' }}>¿Listo para marcar?</h3>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>Acércate al Kiosko de la oficina.</p>
                  <button className="btn-primary" style={{ width: '100%' }} onClick={() => setScanning(true)}>
                    <Scan size={20} /> Activar Cámara
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div className="scanner-wrapper">
                    <div id="reader" style={{ width: '100%', height: '100%' }}></div>
                    <div className="scanner-lens">
                      <div className="scanner-corner corner-tl"></div>
                      <div className="scanner-corner corner-tr"></div>
                      <div className="scanner-corner corner-bl"></div>
                      <div className="scanner-corner corner-br"></div>
                    </div>
                    <div className="scan-line"></div>
                  </div>
                  <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Apuntando al QR de la oficina...</p>
                  <button onClick={() => setScanning(false)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '0.5rem 1rem', borderRadius: '20px', marginTop: '1rem', cursor: 'pointer' }}>Cancelar</button>
                </div>
              )}
            </>
          )}

          {status === 'selecting' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center' }}>
              <CheckCircle2 size={50} color="#10b981" style={{ marginBottom: '1rem' }} />
              <h3 style={{ marginBottom: '2rem' }}>¡QR Detectado!</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>¿Qué deseas registrar?</p>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <button onClick={() => registerAttendance('Ingreso')} className="btn-primary" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid #10b981' }}>👋 Marcar Ingreso</button>
                <button onClick={() => registerAttendance('Almuerzo')} className="btn-primary" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: '1px solid #f59e0b' }}>🍔 Marcar Almuerzo</button>
                <button onClick={() => registerAttendance('Salida')} className="btn-primary" style={{ background: 'rgba(244, 63, 94, 0.2)', color: '#f43f5e', border: '1px solid #f43f5e' }}>🚪 Marcar Salida</button>
              </div>
            </motion.div>
          )}

          {status === 'success' && (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.2)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <CheckCircle2 size={40} color="#10b981" />
              </div>
              <h2>¡Registrado!</h2>
              <p style={{ color: 'var(--text-muted)' }}>Tu asistencia ha sido guardada en el servidor central.</p>
            </motion.div>
          )}
        </Card>
      )}

      {activeTab === 'stats' && (
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.3rem' }}>Mis Registros Recientes</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {myLogs.length === 0 ? (
              <Card padding="2rem"><p style={{ textAlign: 'center', color: 'gray' }}>No tienes registros aún.</p></Card>
            ) : (
              myLogs.map((log) => {
                const dateObj = parseISO(log.timestamp)
                let icon = <CheckCircle2 size={20} color="#10b981" />
                if (log.tipo.includes('Permiso') || log.tipo.includes('Descanso')) icon = <CalendarOff size={20} color="#f59e0b" />
                else if (log.tipo === 'Salida') icon = <LogOut size={20} color="#f43f5e" />

                return (
                  <Card key={log.id} padding="1rem" className="hover-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '15px' }}>{icon}</div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: '0 0 0.2rem 0' }}>{log.tipo}</h4>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{format(dateObj, "d 'de' MMMM, yyyy", { locale: es })}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{format(dateObj, 'HH:mm')}</span>
                      </div>
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'permisos' && (
        <Card className="mobile-card" padding="2rem">
          <h2 style={{ marginBottom: '1rem', fontSize: '1.3rem' }}><CalendarOff size={24} style={{verticalAlign: 'middle', marginRight: '8px'}}/> Solicitar Permiso</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>Notifica al administrador si necesitas ausentarte.</p>
          
          <div style={{ display: 'grid', gap: '1rem' }}>
            <button onClick={() => requestPermission('Permiso Médico')} className="btn-primary" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: '1px solid #f59e0b' }}>Salud / Médico</button>
            <button onClick={() => requestPermission('Permiso Personal')} className="btn-primary" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', border: '1px solid #818cf8' }}>Asunto Personal</button>
            <button onClick={() => requestPermission('Día de Descanso')} className="btn-primary" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid #10b981' }}>Día de Descanso Libre</button>
          </div>
        </Card>
      )}

      {/* Bottom Nav Bar */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.1)', padding: '1rem', display: 'flex', justifyContent: 'center', zIndex: 100 }}>
        <div style={{ display: 'flex', gap: '2rem', maxWidth: '400px', width: '100%', justifyContent: 'space-around' }}>
          <div onClick={() => setActiveTab('scan')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', color: activeTab === 'scan' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}>
            <QrCode size={24} /> <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>Escanear</span>
          </div>
          <div onClick={() => setActiveTab('stats')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', color: activeTab === 'stats' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}>
            <History size={24} /> <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>Mi Historial</span>
          </div>
          <div onClick={() => setActiveTab('permisos')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', color: activeTab === 'permisos' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}>
            <CalendarOff size={24} /> <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>Permisos</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- 3. VISTA DE ADMINISTRADOR (Dashboard Completo) ---
const AdminView = () => {
  const [logs, setLogs] = useState([])
  const [dbStatus, setDbStatus] = useState('checking')
  const [activeTab, setActiveTab] = useState('dashboard') // dashboard, en-vivo, gestion

  // Escuchar a Supabase en Vivo
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const { data, error } = await supabase.from('asistencia').select('*').order('timestamp', { ascending: false }).limit(200)
        if (error) throw error
        setLogs(data || [])
        setDbStatus('ok')
      } catch (err) {
        setDbStatus('error')
        console.error(err)
      }
    }
    
    fetchLogs()
    const subscription = supabase.channel('asistencia_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'asistencia' }, payload => {
        setLogs(current => [payload.new, ...current])
      }).subscribe()

    return () => { supabase.removeChannel(subscription) }
  }, [])

  // --- CÁLCULOS PARA EL DASHBOARD ---
  const stats = useMemo(() => {
    const todayLogs = logs.filter(l => isToday(parseISO(l.timestamp)))
    
    // Asistencias únicas hoy (Solo Ingresos)
    const presentesHoy = new Set(todayLogs.filter(l => l.tipo === 'Ingreso').map(l => l.celular)).size
    
    // Permisos / Descansos hoy
    const permisosHoy = todayLogs.filter(l => l.tipo.includes('Permiso') || l.tipo.includes('Descanso')).length

    // Tipos de marcación hoy para PieChart
    const pieDataMap = { 'Ingreso': 0, 'Almuerzo': 0, 'Salida': 0, 'Permisos': 0 }
    todayLogs.forEach(l => {
      if (l.tipo.includes('Permiso') || l.tipo.includes('Descanso')) pieDataMap['Permisos']++
      else if (pieDataMap[l.tipo] !== undefined) pieDataMap[l.tipo]++
    })
    const pieData = Object.keys(pieDataMap).map(k => ({ name: k, value: pieDataMap[k] })).filter(d => d.value > 0)

    // Actividad últimos 7 días para BarChart
    const daysData = []
    for(let i=6; i>=0; i--) {
      const d = subDays(new Date(), i)
      const label = format(d, 'EEE', { locale: es })
      const count = logs.filter(l => isSameDay(parseISO(l.timestamp), d) && l.tipo === 'Ingreso').length
      daysData.push({ name: label, ingresos: count })
    }

    return { presentesHoy, permisosHoy, pieData, daysData }
  }, [logs])

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', margin: 0 }}>Centro de <span className="text-gradient">Operaciones</span></h1>
          <p style={{ color: 'var(--text-muted)' }}>Gestión Administrativa y Dashboard</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'inline-block', padding: '8px 20px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold', background: dbStatus === 'ok' ? '#10b98122' : '#f43f5e22', color: dbStatus === 'ok' ? '#10b981' : '#f43f5e', border: '1px solid currentColor' }}>
            {dbStatus === 'ok' ? '● CONECTADO EN VIVO' : dbStatus === 'error' ? '● ERROR DE RED' : '● VERIFICANDO...'}
          </div>
        </div>
      </header>

      {/* Navegación Admin */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', overflowX: 'auto' }}>
        <button onClick={() => setActiveTab('dashboard')} className="btn-primary" style={{ background: activeTab === 'dashboard' ? 'var(--primary)' : 'transparent', color: activeTab === 'dashboard' ? 'white' : 'var(--text-muted)', boxShadow: 'none' }}>
          <BarChart3 size={20} /> Dashboard
        </button>
        <button onClick={() => setActiveTab('en-vivo')} className="btn-primary" style={{ background: activeTab === 'en-vivo' ? 'var(--primary)' : 'transparent', color: activeTab === 'en-vivo' ? 'white' : 'var(--text-muted)', boxShadow: 'none' }}>
          <Activity size={20} /> Registros en Vivo
        </button>
      </div>

      {/* TAB: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Tarjetas de Resumen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
            <Card className="hover-card" padding="1.5rem">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '15px' }}><Users size={30} color="#10b981"/></div>
                <div>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Presentes Hoy (Ingresos)</p>
                  <h2 style={{ margin: 0, fontSize: '2rem' }}>{stats.presentesHoy}</h2>
                </div>
              </div>
            </Card>
            <Card className="hover-card" padding="1.5rem">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '1rem', borderRadius: '15px' }}><CalendarOff size={30} color="#f59e0b"/></div>
                <div>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Permisos / Descansos Hoy</p>
                  <h2 style={{ margin: 0, fontSize: '2rem' }}>{stats.permisosHoy}</h2>
                </div>
              </div>
            </Card>
            <Card className="hover-card" padding="1.5rem">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '1rem', borderRadius: '15px' }}><History size={30} color="#6366f1"/></div>
                <div>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Total Registros Históricos</p>
                  <h2 style={{ margin: 0, fontSize: '2rem' }}>{logs.length}</h2>
                </div>
              </div>
            </Card>
          </div>

          {/* Gráficos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
            <Card padding="2rem">
              <h3 style={{ marginBottom: '1.5rem' }}>Tendencia de Ingresos (Últimos 7 días)</h3>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.daysData}>
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" allowDecimals={false} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '10px', color: '#fff' }} />
                    <Bar dataKey="ingresos" fill="#6366f1" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card padding="2rem">
              <h3 style={{ marginBottom: '1.5rem' }}>Distribución Operativa (Hoy)</h3>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">
                      {stats.pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '10px' }} />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {stats.pieData.length === 0 && <p style={{textAlign: 'center', color: 'gray', marginTop: '-150px'}}>Sin datos para graficar hoy.</p>}
            </Card>
          </div>
        </motion.div>
      )}

      {/* TAB: EN VIVO */}
      {activeTab === 'en-vivo' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card padding="0">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>FECHA Y HORA</th>
                    <th style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>COLABORADOR</th>
                    <th style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>CELULAR</th>
                    <th style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>MARCACIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr><td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No hay datos disponibles en la base de datos.</td></tr>
                  ) : (
                    logs.map((log) => {
                      const dateObj = parseISO(log.timestamp)
                      return (
                        <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                          <td style={{ padding: '1.5rem' }}>
                            <div style={{ fontWeight: '500' }}>{format(dateObj, 'HH:mm:ss')}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{format(dateObj, "d MMM, yyyy", { locale: es })}</div>
                          </td>
                          <td style={{ padding: '1.5rem', fontWeight: 'bold' }}>{log.nombre}</td>
                          <td style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>{log.celular}</td>
                          <td style={{ padding: '1.5rem' }}>
                            <span style={{
                              display: 'inline-block', padding: '6px 12px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold',
                              background: log.tipo === 'Ingreso' ? 'rgba(16, 185, 129, 0.15)' : log.tipo === 'Almuerzo' ? 'rgba(245, 158, 11, 0.15)' : log.tipo === 'Salida' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                              color: log.tipo === 'Ingreso' ? '#10b981' : log.tipo === 'Almuerzo' ? '#f59e0b' : log.tipo === 'Salida' ? '#f43f5e' : '#818cf8'
                            }}>
                              {log.tipo}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}

    </div>
  )
}

// Para usar el ícono de Activity que falta
const Activity = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
  </svg>
)

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', background: '#020617', color: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2>Algo salió mal al cargar la aplicación.</h2>
          <p style={{ color: '#f43f5e' }}>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '20px' }}>Recargar</button>
        </div>
      )
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
          <Route path="*" element={<MobileView />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
