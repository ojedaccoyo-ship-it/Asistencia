import React, { useState, useEffect, useMemo } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Html5Qrcode } from 'html5-qrcode'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { FileEdit, Trash2, PlusCircle } from 'lucide-react'
import { supabase } from './lib/supabase'

// --- Helpers de fecha JS puro ---
const parseDate = (ts) => new Date(ts)
const isToday = (d) => d.toDateString() === new Date().toDateString()
const isSameDay = (a, b) => a.toDateString() === b.toDateString()
const subDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() - n); return r }
const DAY_NAMES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const fmtHora = (d) => d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
const fmtFecha = (d) => d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })

// --- Card ---
const Card = ({ children, style = {} }) => (
  <div style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '1.5rem', ...style }}>
    {children}
  </div>
)

// ===== KIOSKO =====
const KioskView = () => {
  const [qrValue, setQrValue] = useState(`checkin-${Date.now()}`)
  const [timeLeft, setTimeLeft] = useState(30)
  useEffect(() => {
    const t = setInterval(() => setTimeLeft(p => {
      if (p <= 1) { setQrValue(`checkin-${Date.now()}`); return 30 }
      return p - 1
    }), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'2rem' }}>
      <h1 style={{ fontSize:'3.5rem', background:'linear-gradient(to right,#818cf8,#34d399)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', marginBottom:'0.5rem' }}>Punto de Control</h1>
      <p style={{ color:'#94a3b8', marginBottom:'2.5rem' }}>Escanea para registrar tu asistencia</p>
      <Card style={{ position:'relative', display:'inline-block', borderRadius:'32px', padding:'2.5rem' }}>
        <div style={{ position:'absolute', top:0, left:0, height:'6px', background:'linear-gradient(90deg,#6366f1,#34d399)', width:`${(timeLeft/30)*100}%`, borderRadius:'32px 32px 0 0', transition:'width 1s linear' }} />
        <div style={{ background:'white', padding:'1.5rem', borderRadius:'20px', display:'inline-block' }}>
          <QRCodeSVG value={qrValue} size={300} level="H" includeMargin />
        </div>
        <div style={{ marginTop:'1.5rem', color: timeLeft < 5 ? '#f43f5e' : '#10b981', fontWeight:'700', fontSize:'1.4rem' }}>
          ⏱ {timeLeft}s
        </div>
      </Card>
    </div>
  )
}

// ===== MÓVIL =====
const MobileView = () => {
  const [empName, setEmpName] = useState(localStorage.getItem('emp_name') || '')
  const [empPhone, setEmpPhone] = useState(localStorage.getItem('emp_phone') || '')
  const [tab, setTab] = useState('scan')
  const [scanning, setScanning] = useState(false)
  const [status, setStatus] = useState('idle')
  const [myLogs, setMyLogs] = useState([])

  // Estados para solicitud de permiso con fecha futura
  const [permTipo, setPermTipo] = useState('Permiso Personal')
  const [permFecha, setPermFecha] = useState('')
  const [permMotivo, setPermMotivo] = useState('')
  const [permEnviado, setPermEnviado] = useState(false)

  // Estados para justificante
  const [justFecha, setJustFecha] = useState('')
  const [justMotivo, setJustMotivo] = useState('')
  const [justEnviado, setJustEnviado] = useState(false)

  useEffect(() => {
    if (empPhone && tab === 'stats') {
      supabase.from('asistencia').select('*').eq('celular', empPhone).order('timestamp', { ascending: false }).limit(30)
        .then(({ data }) => data && setMyLogs(data))
    }
  }, [empPhone, tab])

  useEffect(() => {
    let qr = null
    if (tab === 'scan' && scanning && status === 'idle') {
      const t = setTimeout(() => {
        if (!document.getElementById('reader')) return
        try {
          qr = new Html5Qrcode('reader')
          qr.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 250 } },
            (text) => { if (text.startsWith('checkin-')) { setScanning(false); setStatus('selecting') } },
            () => {}
          ).catch(console.error)
        } catch (e) { console.error(e) }
      }, 300)
      return () => {
        clearTimeout(t)
        if (qr && qr.isScanning) qr.stop().then(() => qr.clear()).catch(console.error)
      }
    }
  }, [tab, scanning, status])

  const register = async (tipo) => {
    setStatus('success')
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })
    const rec = { nombre: empName, celular: empPhone, tipo, timestamp: new Date().toISOString() }
    try { await supabase.from('asistencia').insert([rec]) } catch (e) { console.error(e) }
    setTimeout(() => { setStatus('idle'); setTab('stats') }, 3000)
  }

  const handleSolicitarPermiso = async () => {
    if (!permFecha || !permMotivo.trim()) return alert('Completa la fecha y el motivo')
    const ts = new Date(`${permFecha}T08:00:00`).toISOString()
    // Guardamos el motivo DENTRO del campo tipo para no necesitar columna extra
    const tipoConMotivo = `${permTipo}: ${permMotivo.trim()}`
    const rec = { nombre: empName, celular: empPhone, tipo: tipoConMotivo, timestamp: ts }
    try {
      await supabase.from('asistencia').insert([rec])
      setPermEnviado(true)
      setPermFecha(''); setPermMotivo('');
    } catch (e) { alert('Error al enviar la solicitud.') }
  }

  const handleEnviarJustificante = async () => {
    if (!justFecha || !justMotivo.trim()) return alert('Completa la fecha y el motivo')
    const ts = new Date(`${justFecha}T08:00:00`).toISOString()
    // Guardamos el motivo DENTRO del campo tipo para no necesitar columna extra
    const tipoConMotivo = `Justificante: ${justMotivo.trim()}`
    const rec = { nombre: empName, celular: empPhone, tipo: tipoConMotivo, timestamp: ts }
    try {
      await supabase.from('asistencia').insert([rec])
      setJustEnviado(true)
      setJustFecha(''); setJustMotivo('');
    } catch (e) { alert('Error al enviar el justificante.') }
  }

  if (!empName) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'radial-gradient(circle at top right,#1e1b4b,#020617)', padding:'1rem' }}>
        <Card style={{ width:'100%', maxWidth:'380px', borderRadius:'32px', padding:'2rem' }}>
          <h2 style={{ textAlign:'center', marginBottom:'1.5rem' }}>Registro Inicial</h2>
          <form onSubmit={e => {
            e.preventDefault()
            const fd = new FormData(e.target)
            const n = fd.get('name'), p = fd.get('phone')
            if (n && p) { localStorage.setItem('emp_name', n); localStorage.setItem('emp_phone', p); setEmpName(n); setEmpPhone(p) }
          }}>
            <input name="name" placeholder="Nombre completo" required style={{ width:'100%', padding:'0.9rem', marginBottom:'1rem', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'12px', color:'white', fontSize:'1rem', boxSizing:'border-box' }} />
            <input name="phone" placeholder="Número de celular" type="tel" required style={{ width:'100%', padding:'0.9rem', marginBottom:'1.5rem', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'12px', color:'white', fontSize:'1rem', boxSizing:'border-box' }} />
            <button type="submit" style={{ width:'100%', padding:'1rem', background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', borderRadius:'14px', fontWeight:'700', cursor:'pointer', fontSize:'1rem' }}>Comenzar →</button>
          </form>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100dvh', background:'radial-gradient(circle at top right,#1e1b4b,#020617)', display:'flex', flexDirection:'column', alignItems:'center', paddingTop:'1.5rem', paddingBottom:'90px', paddingLeft:'1rem', paddingRight:'1rem' }}>
      <div style={{ width:'100%', maxWidth:'400px', marginBottom:'1.5rem' }}>
        <span style={{ fontSize:'0.75rem', color:'#10b981', fontWeight:'600' }}>● ACTIVO</span>
        <h3 style={{ margin:0, fontSize:'1.3rem' }}>{empName}</h3>
      </div>

      {tab === 'scan' && (
        <Card style={{ width:'100%', maxWidth:'400px', borderRadius:'28px' }}>
          {status === 'idle' && !scanning && (
            <div style={{ textAlign:'center', padding:'1.5rem 0' }}>
              <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>📷</div>
              <h3>¿Listo para marcar?</h3>
              <p style={{ color:'#94a3b8', marginBottom:'2rem' }}>Acércate al Kiosko de la oficina</p>
              <button onClick={() => setScanning(true)} style={{ width:'100%', padding:'1rem', background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', borderRadius:'14px', fontWeight:'700', cursor:'pointer', fontSize:'1rem' }}>Activar Cámara</button>
            </div>
          )}
          {status === 'idle' && scanning && (
            <div style={{ textAlign:'center' }}>
              <div style={{ position:'relative', width:'100%', aspectRatio:'1', borderRadius:'20px', overflow:'hidden', background:'#000' }}>
                <div id="reader" style={{ width:'100%', height:'100%' }} />
              </div>
              <p style={{ color:'#94a3b8', marginTop:'1rem' }}>Apuntando al QR de la oficina...</p>
              <button onClick={() => setScanning(false)} style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.2)', color:'white', padding:'0.5rem 1.5rem', borderRadius:'20px', cursor:'pointer', marginTop:'0.5rem' }}>Cancelar</button>
            </div>
          )}
          {status === 'selecting' && (
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>✅</div>
              <h3 style={{ marginBottom:'1.5rem' }}>¡QR Detectado!</h3>
              <div style={{ display:'grid', gap:'0.8rem' }}>
                <button onClick={() => register('Ingreso')} style={{ padding:'1rem', background:'rgba(16,185,129,0.15)', color:'#10b981', border:'1px solid #10b981', borderRadius:'14px', cursor:'pointer', fontWeight:'700' }}>👋 Marcar Ingreso</button>
                <button onClick={() => register('Almuerzo')} style={{ padding:'1rem', background:'rgba(245,158,11,0.15)', color:'#f59e0b', border:'1px solid #f59e0b', borderRadius:'14px', cursor:'pointer', fontWeight:'700' }}>🍔 Salida a Almuerzo</button>
                <button onClick={() => register('Regreso Almuerzo')} style={{ padding:'1rem', background:'rgba(99,102,241,0.15)', color:'#818cf8', border:'1px solid #818cf8', borderRadius:'14px', cursor:'pointer', fontWeight:'700' }}>🔙 Regreso de Almuerzo</button>
                <button onClick={() => register('Salida')} style={{ padding:'1rem', background:'rgba(244,63,94,0.15)', color:'#f43f5e', border:'1px solid #f43f5e', borderRadius:'14px', cursor:'pointer', fontWeight:'700' }}>🚪 Marcar Salida</button>
              </div>
            </div>
          )}
          {status === 'success' && (
            <div style={{ textAlign:'center', padding:'2rem 0' }}>
              <div style={{ fontSize:'4rem', marginBottom:'1rem' }}>🎉</div>
              <h2>¡Registrado!</h2>
              <p style={{ color:'#94a3b8' }}>Tu asistencia fue guardada correctamente.</p>
            </div>
          )}
        </Card>
      )}

      {tab === 'stats' && (
        <div style={{ width:'100%', maxWidth:'400px', display:'flex', flexDirection:'column', gap:'0.8rem' }}>
          <h2 style={{ fontSize:'1.2rem', margin:'0 0 0.5rem 0' }}>Mis Registros</h2>
          {myLogs.length === 0
            ? <Card><p style={{ textAlign:'center', color:'gray' }}>No tienes registros aún.</p></Card>
            : myLogs.map(log => {
              const d = parseDate(log.timestamp)
              const tipoIconos = { 'Ingreso':'👋', 'Ingreso Justificado':'✅', 'Almuerzo':'🍔', 'Regreso Almuerzo':'🔙', 'Salida':'🚪', 'Permiso Médico':'🏥', 'Permiso Personal':'👤', 'Día de Descanso':'🌴', 'Justificante':'📝' }
              const tipoColores = { 'Permiso Médico':'#f59e0b', 'Permiso Personal':'#818cf8', 'Día de Descanso':'#10b981', 'Justificante':'#f59e0b', 'Ingreso Justificado':'#10b981' }
              const isFuture = d > new Date()
              return (
                <Card key={log.id} style={{ padding:'1rem', display:'flex', alignItems:'center', gap:'1rem', opacity: isFuture ? 0.75 : 1, border: isFuture ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize:'1.5rem' }}>{tipoIconos[log.tipo] || '📋'}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:'700', color: tipoColores[log.tipo] || 'white' }}>{log.tipo} {isFuture && <span style={{ fontSize:'0.65rem', background:'rgba(99,102,241,0.2)', color:'#818cf8', padding:'2px 6px', borderRadius:'6px', marginLeft:'4px' }}>PROGRAMADO</span>}</div>
                    <div style={{ color:'#94a3b8', fontSize:'0.8rem' }}>{fmtFecha(d)}</div>
                    {log.motivo && <div style={{ color:'#64748b', fontSize:'0.75rem', marginTop:'2px', fontStyle:'italic' }}>Motivo: {log.motivo}</div>}
                  </div>
                  <div style={{ fontWeight:'700', fontSize:'0.85rem' }}>{fmtHora(d)}</div>
                </Card>
              )
            })
          }
        </div>
      )}

      {tab === 'permisos' && (
        <div style={{ width:'100%', maxWidth:'400px', display:'flex', flexDirection:'column', gap:'1rem' }}>
          <h2 style={{ margin:'0 0 0.5rem 0' }}>🗓️ Solicitar Permiso</h2>
          <p style={{ color:'#94a3b8', margin:'0 0 0.5rem 0', fontSize:'0.9rem' }}>Pide tu permiso con anticipación. El administrador lo verá en su panel.</p>

          {permEnviado ? (
            <Card style={{ textAlign:'center', padding:'2rem' }}>
              <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>✅</div>
              <h3>¡Solicitud Enviada!</h3>
              <p style={{ color:'#94a3b8' }}>El administrador revisará tu permiso.</p>
              <button onClick={() => setPermEnviado(false)} style={{ marginTop:'1rem', padding:'0.8rem 1.5rem', background:'#6366f1', color:'white', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:'bold' }}>Nueva Solicitud</button>
            </Card>
          ) : (
            <Card style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
              <div>
                <label style={{ color:'#94a3b8', fontSize:'0.8rem', display:'block', marginBottom:'0.5rem' }}>TIPO DE PERMISO</label>
                <select value={permTipo} onChange={e => setPermTipo(e.target.value)} style={{ width:'100%', padding:'0.8rem', background:'rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'10px', color:'white', fontSize:'1rem', boxSizing:'border-box' }}>
                  <option value="Permiso Personal">👤 Asunto Personal</option>
                  <option value="Permiso Médico">🏥 Cita Médica / Salud</option>
                  <option value="Día de Descanso">🌴 Día de Descanso</option>
                </select>
              </div>
              <div>
                <label style={{ color:'#94a3b8', fontSize:'0.8rem', display:'block', marginBottom:'0.5rem' }}>FECHA DEL PERMISO</label>
                <input type="date" value={permFecha} onChange={e => setPermFecha(e.target.value)} style={{ width:'100%', padding:'0.8rem', background:'rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'10px', color:'white', fontSize:'1rem', boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ color:'#94a3b8', fontSize:'0.8rem', display:'block', marginBottom:'0.5rem' }}>MOTIVO (obligatorio)</label>
                <textarea value={permMotivo} onChange={e => setPermMotivo(e.target.value)} placeholder="Describe brevemente el motivo de tu permiso..." rows={3} style={{ width:'100%', padding:'0.8rem', background:'rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'10px', color:'white', fontSize:'0.95rem', boxSizing:'border-box', resize:'none', fontFamily:'inherit' }} />
              </div>
              <button onClick={handleSolicitarPermiso} style={{ padding:'1rem', background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:'bold', fontSize:'1rem' }}>Enviar Solicitud</button>
            </Card>
          )}
        </div>
      )}

      {tab === 'justificante' && (
        <div style={{ width:'100%', maxWidth:'400px', display:'flex', flexDirection:'column', gap:'1rem' }}>
          <h2 style={{ margin:'0 0 0.5rem 0' }}>📝 Enviar Justificante</h2>
          <p style={{ color:'#94a3b8', margin:'0 0 0.5rem 0', fontSize:'0.9rem' }}>¿No pudiste escanear o marcar tu asistencia? Explica el motivo aquí.</p>

          {justEnviado ? (
            <Card style={{ textAlign:'center', padding:'2rem' }}>
              <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>📨</div>
              <h3>¡Justificante Enviado!</h3>
              <p style={{ color:'#94a3b8' }}>El administrador revisará tu caso y actualizará tu registro si corresponde.</p>
              <button onClick={() => setJustEnviado(false)} style={{ marginTop:'1rem', padding:'0.8rem 1.5rem', background:'#f59e0b', color:'white', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:'bold' }}>Nuevo Justificante</button>
            </Card>
          ) : (
            <Card style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
              <div style={{ padding:'0.8rem', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'10px', color:'#f59e0b', fontSize:'0.85rem' }}>
                ⚠️ Este formulario es para cuando <strong>no pudiste escanear</strong> o <strong>no marcaste tu salida/ingreso</strong>. El administrador revisará y corregirá tu registro.
              </div>
              <div>
                <label style={{ color:'#94a3b8', fontSize:'0.8rem', display:'block', marginBottom:'0.5rem' }}>FECHA EN QUE FALLÓ EL MARCADO</label>
                <input type="date" value={justFecha} onChange={e => setJustFecha(e.target.value)} style={{ width:'100%', padding:'0.8rem', background:'rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'10px', color:'white', fontSize:'1rem', boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ color:'#94a3b8', fontSize:'0.8rem', display:'block', marginBottom:'0.5rem' }}>¿QUÉ PASÓ? (obligatorio)</label>
                <textarea value={justMotivo} onChange={e => setJustMotivo(e.target.value)} placeholder="Ej: No pude escanear el QR porque el kiosko no funcionaba, pero sí asistí a las 9:00am..." rows={4} style={{ width:'100%', padding:'0.8rem', background:'rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'10px', color:'white', fontSize:'0.95rem', boxSizing:'border-box', resize:'none', fontFamily:'inherit' }} />
              </div>
              <button onClick={handleEnviarJustificante} style={{ padding:'1rem', background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'white', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:'bold', fontSize:'1rem' }}>Enviar Justificante</button>
            </Card>
          )}
        </div>
      )}

      {/* Bottom Nav */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'rgba(2,6,23,0.95)', backdropFilter:'blur(20px)', borderTop:'1px solid rgba(255,255,255,0.1)', padding:'0.8rem 1rem', display:'flex', justifyContent:'center', zIndex:100 }}>
        <div style={{ display:'flex', gap:'1rem', maxWidth:'440px', width:'100%', justifyContent:'space-around' }}>
          {[['scan','📷','Escanear'],['stats','📋','Mi Historial'],['permisos','🗓️','Permiso'],['justificante','📝','Justificante']].map(([t,icon,label]) => (
            <div key={t} onClick={() => setTab(t)} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.2rem', cursor:'pointer', color: tab === t ? '#6366f1' : '#94a3b8' }}>
              <span style={{ fontSize:'1.4rem' }}>{icon}</span>
              <span style={{ fontSize:'0.65rem', fontWeight:'600', textAlign:'center' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ===== ADMIN =====
const AdminView = () => {
  const [logs, setLogs] = useState([])
  const [dbStatus, setDbStatus] = useState('checking')
  const [tab, setTab] = useState('dashboard')
  const [selectedColab, setSelectedColab] = useState('')
  const [selectedTipo, setSelectedTipo] = useState('')
  const [selectedMes, setSelectedMes] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(sessionStorage.getItem('adminAuth') === 'true')
  const [passInput, setPassInput] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  
  // Estado para la edición de registros
  const [editingLogId, setEditingLogId] = useState(null)
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editTipo, setEditTipo] = useState('')
  
  // Estado para añadir nuevos registros
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newNombre, setNewNombre] = useState('')
  const [newCelular, setNewCelular] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [newTipo, setNewTipo] = useState('Ingreso')

  // Estado para módulo de descanso rápido
  const [descansoColab, setDescansoColab] = useState('')
  const [descansoDiaSemana, setDescansoDiaSemana] = useState('')

  useEffect(() => {
    supabase.from('asistencia').select('*').order('timestamp', { ascending: false }).limit(500)
      .then(({ data, error }) => { if (error) { setDbStatus('error') } else { setLogs(data || []); setDbStatus('ok') } })
      .catch(() => setDbStatus('error'))

    const sub = supabase.channel('admin_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'asistencia' }, p => {
        setLogs(cur => [p.new, ...cur])
      }).subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const d = parseDate(l.timestamp);
      const matchColab = !selectedColab || l.nombre === selectedColab;
      const matchTipo = !selectedTipo || l.tipo === selectedTipo;
      const matchMes = !selectedMes || (d.getMonth() + 1).toString() === selectedMes;
      return matchColab && matchTipo && matchMes;
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [logs, selectedColab, selectedTipo, selectedMes]);

  const stats = useMemo(() => {
    const todayLogs = filteredLogs.filter(l => isToday(parseDate(l.timestamp)))
    const presentes = new Set(todayLogs.filter(l => l.tipo === 'Ingreso' || l.tipo === 'Ingreso Justificado').map(l => l.celular)).size
    const permisos = todayLogs.filter(l => l.tipo.includes('Permiso') || l.tipo.includes('Descanso')).length
    const totalHoy = todayLogs.length

    // Calcular tardanzas (Ingreso después de 09:05)
    let tardanzas = 0;
    const ingresosHoy = todayLogs.filter(l => l.tipo === 'Ingreso');
    ingresosHoy.forEach(l => {
        const d = parseDate(l.timestamp);
        const hours = d.getHours();
        const minutes = d.getMinutes();
        if (hours > 9 || (hours === 9 && minutes > 5)) {
            tardanzas++;
        }
    });

    const daysData = []
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i)
      const count = filteredLogs.filter(l => isSameDay(parseDate(l.timestamp), d) && l.tipo === 'Ingreso').length
      daysData.push({ name: DAY_NAMES[d.getDay()], count })
    }
    const maxCount = Math.max(...daysData.map(d => d.count), 1)

    // Datos para el gráfico de línea (Hora de ingreso de los últimos días)
    const lineData = [];
    if (selectedColab) {
        // Obtener los últimos 7 ingresos del colaborador
        const ingresosColab = filteredLogs.filter(l => l.tipo === 'Ingreso').slice(0, 7).reverse();
        ingresosColab.forEach(l => {
            const d = parseDate(l.timestamp);
            const timeValue = d.getHours() + (d.getMinutes() / 60); // Valor numérico para graficar
            lineData.push({
                fecha: fmtFecha(d),
                horaStr: fmtHora(d),
                timeValue: timeValue,
                isLate: (d.getHours() > 9 || (d.getHours() === 9 && d.getMinutes() > 5))
            });
        });
    }

    return { presentes, permisos, totalHoy, tardanzas, daysData, maxCount, lineData }
  }, [filteredLogs, selectedColab])

  // Obtener lista de colaboradores únicos para el filtro
  const colaboradoresUnicos = useMemo(() => {
      const names = logs.map(l => l.nombre);
      return [...new Set(names)].sort();
  }, [logs]);

  const exportToExcel = () => {
    // Generar CSV simple
    const headers = ['Fecha', 'Hora', 'Colaborador', 'Celular', 'Marcacion', 'Estado'];
    const csvRows = [headers.join(',')];
    
    filteredLogs.forEach(log => {
        const d = parseDate(log.timestamp);
        const fecha = fmtFecha(d);
        const hora = fmtHora(d);
        let estado = 'OK';
        
        if (log.tipo === 'Ingreso') {
            const hours = d.getHours();
            const minutes = d.getMinutes();
            if (hours > 9 || (hours === 9 && minutes > 5)) estado = 'Tardanza';
        }

        const row = [
            `"${fecha}"`, `"${hora}"`, `"${log.nombre}"`, `"${log.celular}"`, `"${log.tipo}"`, `"${estado}"`
        ];
        csvRows.push(row.join(','));
    });

    const csvData = "\uFEFF" + csvRows.join('\n'); // \uFEFF for Excel UTF-8 BOM
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Reporte_Asistencia_${fmtFecha(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tipoColor = (tipo) => tipo === 'Ingreso' ? '#10b981' : tipo === 'Almuerzo' ? '#f59e0b' : tipo === 'Regreso Almuerzo' ? '#818cf8' : tipo === 'Salida' ? '#f43f5e' : '#94a3b8'

  const handleLogin = (e) => {
    e.preventDefault()
    if (passInput === 'admin2026') { // Contraseña por defecto
       sessionStorage.setItem('adminAuth', 'true')
       setIsAuthenticated(true)
    } else {
       setErrorMsg('Contraseña incorrecta. Intente de nuevo.')
    }
  }

  if (!isAuthenticated) {
     return (
       <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
         <Card style={{ width:'100%', maxWidth:'400px', textAlign:'center', padding:'2.5rem' }}>
           <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>🔒</div>
           <h2 style={{ marginBottom:'0.5rem' }}>Acceso Restringido</h2>
           <p style={{ color:'#94a3b8', marginBottom:'2rem' }}>Ingrese la contraseña de administrador</p>
           <form onSubmit={handleLogin}>
             <input 
                type="password" 
                placeholder="Contraseña" 
                value={passInput} 
                onChange={e => setPassInput(e.target.value)} 
                style={{ width:'100%', padding:'1rem', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'12px', color:'white', marginBottom:'1rem', boxSizing:'border-box', textAlign:'center', letterSpacing:'0.2rem', fontSize:'1.2rem' }} 
             />
             {errorMsg && <div style={{ color:'#f43f5e', fontSize:'0.85rem', marginBottom:'1rem', fontWeight:'bold' }}>{errorMsg}</div>}
             <button type="submit" style={{ width:'100%', padding:'1rem', background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', borderRadius:'12px', fontWeight:'bold', cursor:'pointer', fontSize:'1rem' }}>Desbloquear Dashboard</button>
           </form>
         </Card>
       </div>
     )
  }

  const handleLogout = () => {
    sessionStorage.removeItem('adminAuth')
    setIsAuthenticated(false)
  }

  // Funciones de Edición
  const handleEditClick = (log) => {
    const d = new Date(log.timestamp)
    const pad = (n) => n.toString().padStart(2, '0')
    setEditDate(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`)
    setEditTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`)
    setEditTipo(log.tipo)
    setEditingLogId(log.id)
  }

  const handleSaveEdit = async () => {
    const newTimestamp = new Date(`${editDate}T${editTime}:00`).toISOString()
    try {
      const { error } = await supabase.from('asistencia').update({
        timestamp: newTimestamp,
        tipo: editTipo
      }).eq('id', editingLogId)
      
      if (error) throw error
      
      setLogs(cur => cur.map(l => l.id === editingLogId ? { ...l, timestamp: newTimestamp, tipo: editTipo } : l))
      setEditingLogId(null)
      alert("Registro actualizado correctamente")
    } catch (err) {
      console.error(err)
      alert('Error al actualizar el registro.')
    }
  }

  const handleDeleteClick = async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este registro permanentemente?')) return
    try {
      const { error } = await supabase.from('asistencia').delete().eq('id', id)
      if (error) throw error
      setLogs(cur => cur.filter(l => l.id !== id))
    } catch (err) {
      console.error(err)
      alert('Error al eliminar el registro.')
    }
  }

  const handleSaveNew = async () => {
    if (!newNombre || !newDate || !newTime) return alert("Completa los campos obligatorios")
    const newTimestamp = new Date(`${newDate}T${newTime}:00`).toISOString()
    try {
      const { error } = await supabase.from('asistencia').insert([{
        nombre: newNombre,
        celular: newCelular,
        tipo: newTipo,
        timestamp: newTimestamp
      }])
      if (error) throw error
      setIsAddingNew(false)
      setNewNombre(''); setNewCelular(''); setNewDate(''); setNewTime(''); setNewTipo('Ingreso');
      alert("Registro creado correctamente")
    } catch (err) {
      console.error(err)
      alert('Error al crear el registro.')
    }
  }

  const handleAssignDescanso = async () => {
    if (!descansoColab || !descansoDiaSemana) return alert("Selecciona el colaborador y el día de la semana")
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const targetDay = parseInt(descansoDiaSemana); // 0=Dom, 1=Lun...
    
    // Obtener todas las fechas del mes actual que caigan en ese día de la semana
    const datesToInsert = [];
    const date = new Date(year, month, 1);
    while (date.getMonth() === month) {
        if (date.getDay() === targetDay) {
            datesToInsert.push(new Date(date));
        }
        date.setDate(date.getDate() + 1);
    }
    
    const colabInfo = logs.find(l => l.nombre === descansoColab)
    const celular = colabInfo ? colabInfo.celular : 'N/A'

    const inserts = datesToInsert.map(d => {
        const pad = (n) => n.toString().padStart(2, '0');
        const isoDateStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T08:00:00`;
        return {
            nombre: descansoColab,
            celular: celular,
            tipo: 'Día de Descanso',
            timestamp: new Date(isoDateStr).toISOString()
        };
    });

    try {
      const { error } = await supabase.from('asistencia').insert(inserts)
      if (error) throw error
      setDescansoColab(''); setDescansoDiaSemana('');
      alert(`Se han programado exitosamente ${inserts.length} días de descanso para ${descansoColab} durante este mes.`)
    } catch (err) {
      console.error(err)
      alert('Error al asignar los descansos.')
    }
  }

  return (
    <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'2rem 1rem' }}>
      <header style={{ marginBottom:'2rem', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'1rem' }}>
        <div>
          <h1 style={{ fontSize:'2.2rem', margin:0, background:'linear-gradient(to right,#818cf8,#34d399)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Centro de Operaciones</h1>
          <p style={{ color:'#94a3b8', margin:0 }}>Panel de Administración</p>
        </div>
        <div style={{ display:'flex', gap:'1rem', alignItems:'center' }}>
          <div style={{ padding:'8px 18px', borderRadius:'20px', fontSize:'0.85rem', fontWeight:'bold', background: dbStatus === 'ok' ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)', color: dbStatus === 'ok' ? '#10b981' : '#f43f5e', border:'1px solid currentColor' }}>
            {dbStatus === 'ok' ? '● CONECTADO EN VIVO' : dbStatus === 'error' ? '● ERROR DE RED' : '● VERIFICANDO...'}
          </div>
          <button onClick={handleLogout} style={{ padding:'8px 18px', background:'transparent', border:'1px solid rgba(244,63,94,0.3)', color:'#f43f5e', borderRadius:'20px', cursor:'pointer', fontWeight:'bold', fontSize:'0.85rem' }}>Cerrar Sesión</button>
        </div>
      </header>

      <div style={{ display:'flex', gap:'0.8rem', marginBottom:'2rem', borderBottom:'1px solid rgba(255,255,255,0.1)', paddingBottom:'1rem', flexWrap: 'wrap' }}>
        {[['dashboard','📊 Dashboard'],['en-vivo','⚡ Registros en Vivo']].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding:'0.6rem 1.2rem', background: tab === t ? '#6366f1' : 'transparent', color: tab === t ? 'white' : '#94a3b8', border: tab === t ? 'none' : '1px solid rgba(255,255,255,0.1)', borderRadius:'12px', cursor:'pointer', fontWeight:'600' }}>{label}</button>
        ))}
        
        {/* Controles Empresariales */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <select 
                value={selectedMes} 
                onChange={(e) => setSelectedMes(e.target.value)}
                style={{ padding: '0.6rem 1rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', outline: 'none' }}
            >
                <option value="">📅 Todos los Meses</option>
                <option value="1">Enero</option><option value="2">Febrero</option><option value="3">Marzo</option>
                <option value="4">Abril</option><option value="5">Mayo</option><option value="6">Junio</option>
                <option value="7">Julio</option><option value="8">Agosto</option><option value="9">Septiembre</option>
                <option value="10">Octubre</option><option value="11">Noviembre</option><option value="12">Diciembre</option>
            </select>
            <select 
                value={selectedTipo} 
                onChange={(e) => setSelectedTipo(e.target.value)}
                style={{ padding: '0.6rem 1rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', outline: 'none' }}
            >
                <option value="">🏷️ Todos los Tipos</option>
                <option value="Ingreso">Ingreso</option>
                <option value="Ingreso Justificado">Ingreso Justificado</option>
                <option value="Almuerzo">Salida Almuerzo</option>
                <option value="Regreso Almuerzo">Regreso Almuerzo</option>
                <option value="Salida">Salida</option>
                <option value="Permiso Personal">Permiso Personal</option>
                <option value="Permiso Médico">Permiso Médico</option>
                <option value="Día de Descanso">Día de Descanso</option>
            </select>
            <select 
                value={selectedColab} 
                onChange={(e) => setSelectedColab(e.target.value)}
                style={{ padding: '0.6rem 1rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', outline: 'none' }}
            >
                <option value="">👥 Todos los Colaboradores</option>
                {colaboradoresUnicos.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={exportToExcel} style={{ padding:'0.6rem 1.2rem', background:'#10b981', color:'white', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:'600', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                📥 Exportar Excel
            </button>
        </div>
      </div>

      {tab === 'dashboard' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'1rem', marginBottom:'2rem' }}>
            {[
              { label: selectedColab ? `Ingresos Hoy` : 'Presentes Hoy', value: stats.presentes, icon:'👥', color:'#10b981' },
              { label:'Tardanzas Hoy', value: stats.tardanzas, icon:'⏰', color:'#f43f5e' },
              { label:'Permisos/Descansos', value: stats.permisos, icon:'📋', color:'#f59e0b' },
              { label:'Total Movimientos', value: selectedColab ? filteredLogs.length : logs.length, icon:'📁', color:'#818cf8' },
            ].map(s => (
              <Card key={s.label} style={{ padding:'1.5rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
                  <span style={{ fontSize:'2rem' }}>{s.icon}</span>
                  <div>
                    <div style={{ color:'#94a3b8', fontSize:'0.85rem' }}>{s.label}</div>
                    <div style={{ fontSize:'2rem', fontWeight:'800', color: s.color }}>{s.value}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Módulo Rápido de Descansos */}
          <Card style={{ padding:'1.5rem', marginBottom:'2rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🌴 Asignación Rápida de Descanso
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.5rem', marginTop: 0 }}>
              Programa el día libre de un colaborador. Esto generará automáticamente su registro de asistencia como "Día de Descanso" sin que tengan que escanear nada.
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <select 
                    value={descansoColab} 
                    onChange={(e) => setDescansoColab(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', padding: '0.8rem 1rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', outline: 'none' }}
                >
                    <option value="">👤 Seleccionar Colaborador...</option>
                    {colaboradoresUnicos.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select 
                    value={descansoDiaSemana} 
                    onChange={(e) => setDescansoDiaSemana(e.target.value)}
                    style={{ flex: 1, minWidth: '150px', padding: '0.8rem 1rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', outline: 'none' }}
                >
                    <option value="">📅 Día de la semana...</option>
                    <option value="1">Lunes</option>
                    <option value="2">Martes</option>
                    <option value="3">Miércoles</option>
                    <option value="4">Jueves</option>
                    <option value="5">Viernes</option>
                    <option value="6">Sábado</option>
                    <option value="0">Domingo</option>
                </select>
                <button 
                    onClick={handleAssignDescanso} 
                    style={{ padding:'0.8rem 1.5rem', background:'#10b981', color:'white', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:'bold', display:'flex', alignItems:'center', gap:'0.5rem' }}
                >
                    Asignar Descanso
                </button>
            </div>
          </Card>

          {!selectedColab ? (
            <Card style={{ padding:'2rem' }}>
              <h3 style={{ marginBottom:'1.5rem' }}>Evolución General de Ingresos (Últimos 7 días)</h3>
              <div style={{ position: 'relative', height: '220px', width: '100%', paddingBottom: '25px', paddingTop: '10px' }}>
                {(() => {
                    const maxVal = stats.maxCount;
                    const points = stats.daysData.map((d, i) => `${(i / (stats.daysData.length - 1)) * 100},${100 - (d.count / maxVal) * 100}`);
                    const polylinePoints = points.map(p => {
                        const [x, y] = p.split(',');
                        return `${x}% ${y}%`;
                    }).join(', ');
                    
                    // Simple path representation for pure CSS/SVG
                    return (
                        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                            <svg style={{ position: 'absolute', width: '100%', height: '100%', overflow: 'visible' }} preserveAspectRatio="none">
                                <polyline 
                                    points={stats.daysData.map((d, i) => `${(i / (stats.daysData.length - 1)) * 1000},${1000 - (d.count / maxVal) * 1000}`).join(' ')} 
                                    fill="none" 
                                    stroke="#6366f1" 
                                    strokeWidth="4" 
                                    strokeLinejoin="round"
                                    vectorEffect="non-scaling-stroke"
                                />
                                {stats.daysData.map((d, i) => (
                                    <circle 
                                        key={i} 
                                        cx={(i / (stats.daysData.length - 1)) * 1000} 
                                        cy={1000 - (d.count / maxVal) * 1000} 
                                        r="6" 
                                        fill="#0f172a" 
                                        stroke="#818cf8" 
                                        strokeWidth="3"
                                        vectorEffect="non-scaling-stroke"
                                    />
                                ))}
                            </svg>
                            {/* Etiquetas del eje X y Y (valores) */}
                            {stats.daysData.map((d, i) => (
                                <div key={i} style={{ position: 'absolute', left: `${(i / (stats.daysData.length - 1)) * 100}%`, bottom: '-25px', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '700' }}>{d.name}</span>
                                </div>
                            ))}
                            {stats.daysData.map((d, i) => (
                                <div key={`val-${i}`} style={{ position: 'absolute', left: `${(i / (stats.daysData.length - 1)) * 100}%`, top: `${100 - (d.count / maxVal) * 100}%`, transform: 'translate(-50%, -25px)', color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                    {d.count}
                                </div>
                            ))}
                        </div>
                    );
                })()}
              </div>
            </Card>
          ) : (
            <Card style={{ padding:'2rem' }}>
              <h3 style={{ marginBottom:'1.5rem' }}>Evolución de Ingresos - {selectedColab}</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' }}>Línea de tiempo de los últimos ingresos. La línea roja marca el límite de las 09:05.</p>
              
              <div style={{ position: 'relative', height: '200px', width: '100%', borderBottom: '1px solid #334155', borderLeft: '1px solid #334155', paddingBottom: '20px', paddingLeft: '10px' }}>
                
                {/* Línea base 09:05 */}
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '2px dashed #f43f5e', zIndex: 1 }}>
                    <span style={{ position: 'absolute', right: 0, top: '-20px', color: '#f43f5e', fontSize: '0.8rem', fontWeight: 'bold' }}>09:05 Límite</span>
                </div>

                {stats.lineData.length > 0 ? (
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'space-around', position: 'relative', zIndex: 2 }}>
                        {stats.lineData.map((d, i) => {
                            // Calcular posición relativa al límite de las 9:05 (9.083 horas)
                            const limitValue = 9 + (5/60);
                            const diff = d.timeValue - limitValue;
                            // Amplificamos la diferencia para que sea visual (1 hora = 50px)
                            // Restamos (-) para que si el diff es positivo (tardanza), suba en el eje Y
                            const topPos = `calc(50% - ${diff * 50}px)`;

                            return (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                                    <div style={{ position: 'absolute', top: topPos, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <span style={{ color: d.isLate ? '#f43f5e' : '#10b981', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '4px', textShadow: '0 0 5px rgba(0,0,0,0.5)' }}>{d.horaStr}</span>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: d.isLate ? '#f43f5e' : '#10b981', boxShadow: `0 0 10px ${d.isLate ? '#f43f5e' : '#10b981'}` }} />
                                    </div>
                                    <span style={{ position: 'absolute', bottom: '-25px', color: '#94a3b8', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{d.fecha}</span>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>No hay ingresos recientes</div>
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === 'en-vivo' && (
        <Card style={{ padding:0, overflow:'hidden' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'1rem 1.5rem', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ margin:0, color:'#94a3b8' }}>Registros del Sistema</h3>
            <button onClick={() => setIsAddingNew(!isAddingNew)} style={{ padding:'0.5rem 1rem', background:'#10b981', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'bold', display:'flex', alignItems:'center', gap:'0.5rem' }}>
              <PlusCircle size={18} /> {isAddingNew ? 'Cancelar Creación' : 'Nuevo Registro'}
            </button>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'left' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
                  {['FECHA Y HORA','COLABORADOR','CELULAR','MARCACIÓN', 'ACCIONES'].map(h => (
                    <th key={h} style={{ padding:'1.2rem 1.5rem', color:'#94a3b8', fontSize:'0.8rem', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isAddingNew && (
                  <tr style={{ background: 'rgba(16, 185, 129, 0.1)', borderBottom: '2px solid #10b981' }}>
                    <td style={{ padding:'1rem 1.5rem' }}>
                      <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ padding: '0.4rem', background: 'rgba(0,0,0,0.5)', border: '1px solid #10b981', color: 'white', borderRadius: '8px', marginBottom: '4px', display: 'block', width: '130px' }} />
                      <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} style={{ padding: '0.4rem', background: 'rgba(0,0,0,0.5)', border: '1px solid #10b981', color: 'white', borderRadius: '8px', display: 'block', width: '130px' }} />
                    </td>
                    <td style={{ padding:'1rem 1.5rem' }}>
                      <input type="text" placeholder="Nombre completo" value={newNombre} onChange={e => setNewNombre(e.target.value)} style={{ padding: '0.4rem', background: 'rgba(0,0,0,0.5)', border: '1px solid #10b981', color: 'white', borderRadius: '8px', width: '100%' }} />
                    </td>
                    <td style={{ padding:'1rem 1.5rem' }}>
                      <input type="text" placeholder="Celular (opcional)" value={newCelular} onChange={e => setNewCelular(e.target.value)} style={{ padding: '0.4rem', background: 'rgba(0,0,0,0.5)', border: '1px solid #10b981', color: 'white', borderRadius: '8px', width: '100%' }} />
                    </td>
                    <td style={{ padding:'1rem 1.5rem' }}>
                      <select value={newTipo} onChange={e => setNewTipo(e.target.value)} style={{ padding: '0.4rem', background: 'rgba(0,0,0,0.5)', border: '1px solid #10b981', color: 'white', borderRadius: '8px' }}>
                        <option value="Ingreso">Ingreso</option>
                        <option value="Ingreso Justificado">Ingreso Justificado</option>
                        <option value="Almuerzo">Salida Almuerzo</option>
                        <option value="Regreso Almuerzo">Regreso Almuerzo</option>
                        <option value="Salida">Salida</option>
                        <option value="Permiso Personal">Permiso Personal</option>
                        <option value="Permiso Médico">Permiso Médico</option>
                        <option value="Día de Descanso">Día de Descanso</option>
                      </select>
                    </td>
                    <td style={{ padding:'1rem 1.5rem' }}>
                      <button onClick={handleSaveNew} style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Crear</button>
                    </td>
                  </tr>
                )}
                {filteredLogs.length === 0 && !isAddingNew
                  ? <tr><td colSpan="4" style={{ padding:'3rem', textAlign:'center', color:'#94a3b8' }}>No hay datos aún.</td></tr>
                  : filteredLogs.map(log => {
                    const d = parseDate(log.timestamp)
                    
                    // Lógica para detectar tardanza
                    let isLate = false;
                    if (log.tipo === 'Ingreso') {
                        const hours = d.getHours();
                        const minutes = d.getMinutes();
                        if (hours > 9 || (hours === 9 && minutes > 5)) {
                            isLate = true;
                        }
                    }

                    return editingLogId === log.id ? (
                      <tr key={log.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.05)', background: 'rgba(99, 102, 241, 0.1)' }}>
                        <td style={{ padding:'1rem 1.5rem' }}>
                          <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} style={{ padding: '0.4rem', background: 'rgba(0,0,0,0.5)', border: '1px solid #6366f1', color: 'white', borderRadius: '8px', marginBottom: '4px', display: 'block', width: '130px' }} />
                          <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} style={{ padding: '0.4rem', background: 'rgba(0,0,0,0.5)', border: '1px solid #6366f1', color: 'white', borderRadius: '8px', display: 'block', width: '130px' }} />
                        </td>
                        <td style={{ padding:'1rem 1.5rem', fontWeight:'700', color: 'white' }}>{log.nombre}</td>
                        <td style={{ padding:'1rem 1.5rem', color:'#94a3b8' }}>{log.celular}</td>
                        <td style={{ padding:'1rem 1.5rem' }}>
                          <select value={editTipo} onChange={e => setEditTipo(e.target.value)} style={{ padding: '0.4rem', background: 'rgba(0,0,0,0.5)', border: '1px solid #6366f1', color: 'white', borderRadius: '8px' }}>
                            <option value="Ingreso">Ingreso</option>
                            <option value="Ingreso Justificado">Ingreso Justificado</option>
                            <option value="Almuerzo">Salida Almuerzo</option>
                            <option value="Regreso Almuerzo">Regreso Almuerzo</option>
                            <option value="Salida">Salida</option>
                            <option value="Permiso Personal">Permiso Personal</option>
                            <option value="Permiso Médico">Permiso Médico</option>
                            <option value="Día de Descanso">Día de Descanso</option>
                          </select>
                        </td>
                        <td style={{ padding:'1rem 1.5rem' }}>
                          <button onClick={handleSaveEdit} style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', marginRight: '8px', fontWeight: 'bold' }}>Guardar</button>
                          <button onClick={() => setEditingLogId(null)} style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #94a3b8', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={log.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.05)', background: isLate ? 'rgba(244, 63, 94, 0.05)' : 'transparent' }}>
                        <td style={{ padding:'1rem 1.5rem' }}>
                          <div style={{ fontWeight:'600', color: isLate ? '#f43f5e' : 'white' }}>
                            {fmtHora(d)} {isLate && <span style={{ fontSize: '0.7rem', background: '#f43f5e', color: 'white', padding: '2px 6px', borderRadius: '4px', marginLeft: '5px' }}>TARDE</span>}
                          </div>
                          <div style={{ color:'#94a3b8', fontSize:'0.8rem' }}>{fmtFecha(d)}</div>
                        </td>
                        <td style={{ padding:'1rem 1.5rem', fontWeight:'700', color: isLate ? '#f43f5e' : 'white' }}>{log.nombre}</td>
                        <td style={{ padding:'1rem 1.5rem', color:'#94a3b8' }}>{log.celular}</td>
                        <td style={{ padding:'1rem 1.5rem' }}>
                          <span style={{ padding:'5px 12px', borderRadius:'10px', fontSize:'0.85rem', fontWeight:'700', background:`${tipoColor(log.tipo)}22`, color: tipoColor(log.tipo) }}>{log.tipo}</span>
                        </td>
                        <td style={{ padding:'1rem 1.5rem' }}>
                          <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                              <button onClick={() => handleEditClick(log)} style={{ background: 'transparent', border: 'none', color: '#818cf8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }} title="Modificar Marcación">
                                <FileEdit size={18} />
                                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Editar</span>
                              </button>
                              <button onClick={() => handleDeleteClick(log.id)} style={{ background: 'transparent', border: 'none', color: '#f43f5e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }} title="Eliminar Registro">
                                <Trash2 size={18} />
                              </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                }
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  render() {
    if (this.state.hasError) return (
      <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#020617', color:'white', textAlign:'center', padding:'2rem' }}>
        <h2>Error al cargar</h2>
        <p style={{ color:'#f43f5e' }}>{this.state.error?.message}</p>
        <button onClick={() => window.location.reload()} style={{ marginTop:'1rem', padding:'10px 24px', background:'#6366f1', color:'white', border:'none', borderRadius:'10px', cursor:'pointer' }}>Recargar</button>
      </div>
    )
    return this.props.children
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MobileView />} />
          <Route path="/mobile" element={<MobileView />} />
          <Route path="/kiosko" element={<KioskView />} />
          <Route path="/admin" element={<AdminView />} />
          <Route path="*" element={<MobileView />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
