import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0"
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const gmailUser = Deno.env.get('GMAIL_USER') ?? ''
    const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD') ?? ''
    const platformUrl = Deno.env.get('PLATFORM_URL') ?? 'https://carlosgbd94-design.github.io/SIREVAQ/'

    if (!supabaseServiceKey) {
      throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY')
    }
    if (!gmailUser || !gmailPassword) {
      throw new Error('Configuración SMTP incompleta')
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Leer payload
    const payload = await req.json().catch(() => ({}))
    const action = payload.action || 'send-reminders' // 'send-reminders' o 'send-summaries'
    
    // Obtener la fecha y el día de la semana locales de México
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    
    // Convertir a fecha local para determinar el día de la semana
    const localTimeStr = now.toLocaleString("en-US", { timeZone: "America/Mexico_City" })
    const localTime = new Date(localTimeStr)
    const dayOfWeek = localTime.getDay() // 0 = Dom, 1 = Lun, ..., 4 = Jue, 5 = Vie
    
    // Normalizador de municipios para evitar fallos por acentos
    const normalizeMuni = (m: string) => {
      return String(m || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase()
    }

    // Función para limpiar HTML y evitar codificación "=20" de espacios al final de las líneas
    const cleanHtml = (html: string) => {
      return html
        .split('\n')
        .map(line => line.trimEnd())
        .filter(line => line.trim().length > 0)
        .join('\n')
    }
    
    const todayYmd = formatter.format(localTime) // YYYY-MM-DD
    
    const yesterday = new Date(localTime)
    yesterday.setDate(localTime.getDate() - 1)
    const yesterdayYmd = formatter.format(yesterday)

    console.log(`[ALERTA LOG] Fecha Local: ${todayYmd}, Día de la Semana: ${dayOfWeek}, Acción: ${action}`)

    // 1. Obtener catálogo de unidades médicas activas
    const { data: rawUnits, error: unitsErr } = await supabaseAdmin
      .from('unidades')
      .select('clues, unidad, municipio')
      .eq('activo', 'SI')
      .order('unidad')
    
    if (unitsErr) throw new Error(`Error obteniendo unidades: ${unitsErr.message}`)
    
    const activeUnits = rawUnits || []

    // 2. Obtener capturas de hoy y de ayer
    const [resBioToday, resConsToday, resBioYesterday] = await Promise.all([
      supabaseAdmin.from('biologicos_existencia').select('clues').eq('fecha', todayYmd),
      supabaseAdmin.from('consumibles').select('clues').eq('fecha', todayYmd),
      supabaseAdmin.from('biologicos_existencia').select('clues').eq('fecha', yesterdayYmd)
    ])

    const capturedBioToday = new Set((resBioToday.data || []).map(r => String(r.clues).trim().toUpperCase()))
    const capturedConsToday = new Set((resConsToday.data || []).map(r => String(r.clues).trim().toUpperCase()))
    const capturedBioYesterday = new Set((resBioYesterday.data || []).map(r => String(r.clues).trim().toUpperCase()))

    // Configurar cliente SMTP
    const smtpClient = new SMTPClient({
      connection: {
        hostname: 'smtp.gmail.com',
        port: 465,
        tls: true,
        auth: {
          username: gmailUser,
          password: gmailPassword,
        },
      },
    })

    if (action === 'send-reminders') {
      // --- RECORDATORIOS DE CAPTURA INDIVIDUALES (A LAS 14:30) ---
      let sentCount = 0

      // Obtener perfiles de rol UNIDAD para mandarles el correo
      const { data: userProfiles, error: profErr } = await supabaseAdmin
        .from('perfiles')
        .select('email, clues_asignado')
        .eq('rol', 'UNIDAD')

      if (profErr) throw new Error(`Error obteniendo perfiles de unidades: ${profErr.message}`)

      for (const unit of activeUnits) {
        const unitClues = String(unit.clues).trim().toUpperCase()
        const userForUnit = (userProfiles || []).find(p => String(p.clues_asignado).trim().toUpperCase() === unitClues)

        if (!userForUnit?.email) continue

        const missingItems = []

        if (dayOfWeek === 5) {
          // Viernes: Solo verificamos biológicos. Si no capturó ni jueves ni viernes, enviamos recordatorio
          const bioOk = capturedBioToday.has(unitClues) || capturedBioYesterday.has(unitClues)
          if (!bioOk) {
            missingItems.push('Existencias de biológico')
          }
        } else {
          // Jueves (o cualquier otro día de prueba): Verificamos ambos del día de hoy
          const bioOk = capturedBioToday.has(unitClues)
          const consOk = capturedConsToday.has(unitClues)

          if (!consOk) missingItems.push('Consumibles')
          if (!bioOk) missingItems.push('Existencias de biológico')
        }

        if (missingItems.length > 0) {
          const htmlBody = `
<div style="font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;">
  <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px 20px; text-align: center;">
    <div style="background-color: rgba(255, 255, 255, 0.2); width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 15px auto; text-align: center;">
      <span style="font-size: 30px; line-height: 60px; display: block;">⏱️</span>
    </div>
    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Acción Requerida</h1>
    <p style="color: #dbeafe; margin: 8px 0 0 0; font-size: 15px; font-weight: 500;">Recordatorio de Captura Diario</p>
  </div>
  
  <div style="padding: 35px 30px; color: #334155; line-height: 1.6;">
    <p style="font-size: 16px; margin-top: 0; color: #0f172a;">Estimado(a) capturista de la unidad <strong style="color: #1e40af; font-weight: 700;">${unit.unidad}</strong>,</p>
    <p style="font-size: 15px; color: #475569;">El sistema ha detectado que aún existen registros pendientes correspondientes a tu unidad para el día de hoy:</p>
    
    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-left: 5px solid #ef4444; padding: 20px; border-radius: 8px; margin: 25px 0;">
      <div style="color: #b91c1c; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">Pendiente de Capturar</div>
      <ul style="margin: 0; padding-left: 20px; color: #7f1d1d; font-size: 16px; font-weight: 600;">
        ${missingItems.map(item => `<li style="margin-bottom: 6px;">${item}</li>`).join('')}
      </ul>
    </div>
    
    <p style="font-size: 15px; color: #475569;">Te solicitamos ingresar a la plataforma a la brevedad para realizar tu registro y mantener los indicadores actualizados.</p>
    
    <div style="text-align: center; margin: 40px 0 10px 0;">
      <a href="${platformUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; text-decoration: none; display: inline-block; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2), 0 2px 4px -2px rgba(37, 99, 235, 0.2);">Acceder a la Plataforma</a>
    </div>
  </div>
  
  <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; color: #64748b; font-size: 12px; font-weight: 500;">Jurisdicción Sanitaria 1 - SIREVAQ</p>
    <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 11px;">Este es un correo automático de no-reply. Favor de no responder a esta dirección.</p>
  </div>
</div>
`

          await smtpClient.send({
            from: gmailUser,
            to: userForUnit.email,
            subject: `Aviso Pendiente: Captura en ${unit.unidad}`,
            content: `Recordatorio de captura pendiente para ${unit.unidad}: ${missingItems.join(', ')}`,
            html: cleanHtml(htmlBody),
            replyTo: 'no-reply@js1reportes.com',
            encodeLB: true
          })
          sentCount++
        }
      }

      await smtpClient.close()

      return new Response(JSON.stringify({ ok: true, message: `Recordatorios individuales enviados: ${sentCount} correos.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })

    } else if (action === 'send-summaries') {
      // --- RESÚMENES DE CAPTURA (A LAS 18:00) ---
      // Determinamos qué métrica reportar hoy
      // Jueves reportamos CONSUMIBLES
      // Viernes (o cualquier otro día) reportamos BIOLÓGICOS (Jueves + Viernes)
      const reportType = (dayOfWeek === 4) ? 'CONSUMIBLES' : 'BIOLOGICOS'
      
      // Obtener perfiles de usuarios
      const { data: profiles, error: profErr } = await supabaseAdmin
        .from('perfiles')
        .select('email, rol, municipio, municipios_allowed')
        .in('rol', ['MUNICIPAL', 'ADMIN', 'JURISDICCIONAL', 'CARAVANAS'])

      if (profErr) throw new Error(`Error obteniendo perfiles de supervisión: ${profErr.message}`)

      let sentCount = 0

      // Helper para renderizar los badges de estado
      const renderStatusBadge = (isOk: boolean) => {
        return isOk 
          ? `<span style="background-color: #d1fae5; color: #065f46; padding: 4px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600;">Completado</span>`
          : `<span style="background-color: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600;">Pendiente</span>`
      }

      // Enviar a perfiles MUNICIPALES (solo sus unidades correspondientes)
      const municipalProfiles = (profiles || []).filter(p => p.rol === 'MUNICIPAL' && p.email)
      for (const supervisor of municipalProfiles) {
        let allowedMunis: string[] = []
        if (Array.isArray(supervisor.municipios_allowed) && supervisor.municipios_allowed.length > 0) {
          allowedMunis = supervisor.municipios_allowed.map(normalizeMuni)
        } else if (supervisor.municipio) {
          allowedMunis = String(supervisor.municipio).split(',').map(normalizeMuni)
        }

        if (allowedMunis.length === 0) continue

        const muniUnits = activeUnits.filter(u => allowedMunis.includes(normalizeMuni(u.municipio)))

        if (muniUnits.length === 0) continue

        const muniLabel = allowedMunis.join(', ')

        let completedCount = 0
        const rowsHtml = muniUnits.map(unit => {
          const uClues = String(unit.clues).trim().toUpperCase()
          
          // Estatus dependiendo del reporte de hoy
          const isOk = (reportType === 'CONSUMIBLES')
            ? capturedConsToday.has(uClues)
            : (capturedBioToday.has(uClues) || capturedBioYesterday.has(uClues))
          
          if (isOk) completedCount++

          return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 12px 16px; font-size: 14px; font-weight: 500; color: #1e293b;">${unit.unidad}</td>
              <td style="padding: 12px 16px; font-size: 13px; font-family: monospace; color: #64748b;">${unit.clues}</td>
              <td style="padding: 12px 16px; text-align: center;">${renderStatusBadge(isOk)}</td>
            </tr>
          `
        }).join('')

        const pct = Math.round((completedCount / muniUnits.length) * 100)
        const progressColor = pct === 100 ? '#10b981' : (pct >= 70 ? '#f59e0b' : '#ef4444')

        const htmlBody = `
<div style="font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;">
  <div style="background: linear-gradient(135deg, #0f172a 0%, #334155 100%); padding: 30px 25px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Resumen de Captura</h1>
    <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 13px; text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">Módulo: ${reportType} | Región: ${muniLabel}</p>
  </div>
  
  <div style="padding: 30px 25px; color: #334155; line-height: 1.6;">
    <p style="font-size: 16px; margin-top: 0; color: #0f172a;">Estimado(a) Coordinador(a),</p>
    <p style="font-size: 15px; color: #475569;">Te compartimos el estatus de captura para las unidades adscritas a tu supervisión el día de hoy <strong style="color: #1e293b;">${todayYmd}</strong>:</p>
    
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 25px; border-radius: 12px; margin: 25px 0; text-align: center;">
      <div style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Avance General</div>
      <div style="font-size: 48px; font-weight: 800; color: ${progressColor}; margin: 8px 0;">${pct}%</div>
      <div style="font-size: 14px; color: #475569; font-weight: 500;">
        Unidades Completadas: <strong style="color: #0f172a;">${completedCount}</strong> de <strong style="color: #0f172a;">${muniUnits.length}</strong>
      </div>
    </div>
    
    <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-top: 25px;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f1f5f9; text-align: left; border-bottom: 2px solid #e2e8f0;">
            <th style="padding: 14px 16px; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Unidad</th>
            <th style="padding: 14px 16px; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">CLUES</th>
            <th style="padding: 14px 16px; font-size: 12px; font-weight: 700; color: #475569; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">Estado</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  </div>

  <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; color: #64748b; font-size: 12px; font-weight: 500;">Jurisdicción Sanitaria 1 - Sistema de Indicadores JS1</p>
    <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 11px;">Este es un correo automático de no-reply. Favor de no responder a esta dirección.</p>
  </div>
</div>
`

        await smtpClient.send({
          from: gmailUser,
          to: supervisor.email,
          subject: `Reporte ${reportType}: Región ${muniLabel} (${pct}% Capturado) - ${todayYmd}`,
          content: `Resumen de captura para ${muniLabel}.`,
          html: cleanHtml(htmlBody),
          replyTo: 'no-reply@js1reportes.com',
          encodeLB: true
        })
        sentCount++
      }

      // Enviar a perfiles CARAVANAS (solo unidades UMME y FAM)
      const caravanasProfiles = (profiles || []).filter(p => p.rol === 'CARAVANAS' && p.email)
      for (const supervisor of caravanasProfiles) {
        const caravanaUnits = activeUnits.filter(u => {
          const name = String(u.unidad || '').trim().toUpperCase()
          return name.startsWith('FAM') || name.startsWith('UMME')
        })

        if (caravanaUnits.length === 0) continue

        let completedCount = 0
        const rowsHtml = caravanaUnits.map(unit => {
          const uClues = String(unit.clues).trim().toUpperCase()
          
          const isOk = (reportType === 'CONSUMIBLES')
            ? capturedConsToday.has(uClues)
            : (capturedBioToday.has(uClues) || capturedBioYesterday.has(uClues))
          
          if (isOk) completedCount++

          return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 12px 16px; font-size: 14px; font-weight: 500; color: #1e293b;">${unit.unidad}</td>
              <td style="padding: 12px 16px; font-size: 13px; font-family: monospace; color: #64748b;">${unit.clues}</td>
              <td style="padding: 12px 16px; text-align: center;">${renderStatusBadge(isOk)}</td>
            </tr>
          `
        }).join('')

        const pct = Math.round((completedCount / caravanaUnits.length) * 100)
        const progressColor = pct === 100 ? '#10b981' : (pct >= 70 ? '#f59e0b' : '#ef4444')
        const regionLabel = 'CARAVANAS MÓVILES (UMME/FAM)'

        const htmlBody = `
<div style="font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;">
  <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px 25px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Resumen de Captura</h1>
    <p style="color: #d1fae5; margin: 8px 0 0 0; font-size: 13px; text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">Módulo: ${reportType} | Región: ${regionLabel}</p>
  </div>
  
  <div style="padding: 30px 25px; color: #334155; line-height: 1.6;">
    <p style="font-size: 16px; margin-top: 0; color: #0f172a;">Estimado(a) Coordinador(a),</p>
    <p style="font-size: 15px; color: #475569;">Te compartimos el estatus de captura para las unidades adscritas a tu supervisión el día de hoy <strong style="color: #1e293b;">${todayYmd}</strong>:</p>
    
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 25px; border-radius: 12px; margin: 25px 0; text-align: center;">
      <div style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Avance General</div>
      <div style="font-size: 48px; font-weight: 800; color: ${progressColor}; margin: 8px 0;">${pct}%</div>
      <div style="font-size: 14px; color: #475569; font-weight: 500;">
        Unidades Completadas: <strong style="color: #0f172a;">${completedCount}</strong> de <strong style="color: #0f172a;">${caravanaUnits.length}</strong>
      </div>
    </div>
    
    <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-top: 25px;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f1f5f9; text-align: left; border-bottom: 2px solid #e2e8f0;">
            <th style="padding: 14px 16px; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Unidad</th>
            <th style="padding: 14px 16px; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">CLUES</th>
            <th style="padding: 14px 16px; font-size: 12px; font-weight: 700; color: #475569; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">Estado</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  </div>

  <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; color: #64748b; font-size: 12px; font-weight: 500;">Jurisdicción Sanitaria 1 - Sistema de Indicadores JS1</p>
    <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 11px;">Este es un correo automático de no-reply. Favor de no responder a esta dirección.</p>
  </div>
</div>
`

        await smtpClient.send({
          from: gmailUser,
          to: supervisor.email,
          subject: `Reporte ${reportType}: CARAVANAS (${pct}% Capturado) - ${todayYmd}`,
          content: `Resumen de captura para Caravanas Móviles.`,
          html: cleanHtml(htmlBody),
          replyTo: 'no-reply@js1reportes.com',
          encodeLB: true
        })
        sentCount++
      }

      // Enviar a perfiles JURISDICCIONALES Y ADMIN (Resumen general de todas las unidades, separado por municipio)
      const adminProfiles = (profiles || []).filter(p => (p.rol === 'ADMIN' || p.rol === 'JURISDICCIONAL') && p.email)
      
      if (adminProfiles.length > 0) {
        // Agrupar unidades por municipio
        const unitsByMuni: { [key: string]: typeof activeUnits } = {}
        activeUnits.forEach(u => {
          const mKey = normalizeMuni(u.municipio)
          if (!unitsByMuni[mKey]) unitsByMuni[mKey] = []
          unitsByMuni[mKey].push(u)
        })

        // Generar secciones de HTML para cada municipio
        let totalCompleted = 0
        const municipiosHtml = Object.keys(unitsByMuni).map(muniName => {
          const muniUnits = unitsByMuni[muniName]
          let muniCompleted = 0

          const rows = muniUnits.map(unit => {
            const uClues = String(unit.clues).trim().toUpperCase()
            const isOk = (reportType === 'CONSUMIBLES')
              ? capturedConsToday.has(uClues)
              : (capturedBioToday.has(uClues) || capturedBioYesterday.has(uClues))
            
            if (isOk) {
              muniCompleted++
              totalCompleted++
            }

            return `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 12px; font-size: 13px; color: #334155;">${unit.unidad}</td>
                <td style="padding: 8px 12px; font-size: 12px; font-family: monospace; color: #64748b;">${unit.clues}</td>
                <td style="padding: 8px 12px; text-align: center;">${renderStatusBadge(isOk)}</td>
              </tr>
            `
          }).join('')

          const muniPct = muniUnits.length > 0 ? Math.round((muniCompleted / muniUnits.length) * 100) : 0

          return `
            <div style="margin-top: 25px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <div style="background-color: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 700; color: #1e293b; font-size: 14px;">📍 Municipio: ${muniName}</span>
                <span style="font-weight: 700; color: ${muniPct === 100 ? '#10b981' : '#f59e0b'}; font-size: 13px;">${muniPct}% (${muniCompleted}/${muniUnits.length})</span>
              </div>
              <table style="width: 100%; border-collapse: collapse;">
                <tbody>
                  ${rows}
                </tbody>
              </table>
            </div>
          `
        }).join('')

        const totalPct = activeUnits.length > 0 ? Math.round((totalCompleted / activeUnits.length) * 100) : 0

        const htmlBodyAdmin = `
<div style="font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 750px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;">
  <div style="background: linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%); padding: 30px 25px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Reporte General Jurisdiccional</h1>
    <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 13px; text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">Jurisdicción Sanitaria 1 | Módulo: ${reportType}</p>
  </div>
  
  <div style="padding: 35px 30px; color: #334155; line-height: 1.6;">
    <p style="font-size: 16px; margin-top: 0; color: #0f172a;">Estimado(a) Administrador(a) / Personal Jurisdiccional,</p>
    <p style="font-size: 15px; color: #475569;">Se presenta el consolidado de capturas generales para el día de hoy <strong style="color: #1e293b;">${todayYmd}</strong>:</p>
    
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 25px; border-radius: 12px; margin: 25px 0; text-align: center; box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.02);">
      <div style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Estatus Jurisdiccional Global</div>
      <div style="font-size: 52px; font-weight: 800; color: #1e3a8a; margin: 8px 0;">${totalPct}%</div>
      <div style="font-size: 15px; color: #475569; font-weight: 500;">
        Total General: <strong style="color: #0f172a;">${totalCompleted}</strong> de <strong style="color: #0f172a;">${activeUnits.length}</strong> unidades capturadas
      </div>
    </div>
    
    <h3 style="color: #0f172a; font-size: 18px; font-weight: 800; margin-top: 40px; margin-bottom: 20px; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">Consolidado por Municipios</h3>
    ${municipiosHtml}
  </div>

  <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; color: #64748b; font-size: 12px; font-weight: 500;">Jurisdicción Sanitaria 1 - Sistema de Indicadores JS1</p>
    <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 11px;">Este es un correo automático de no-reply. Favor de no responder a esta dirección.</p>
  </div>
</div>
`

        for (const admin of adminProfiles) {
          await smtpClient.send({
            from: gmailUser,
            to: admin.email,
            subject: `[GENERAL] Reporte JS1 ${reportType} (${totalPct}% Global) - ${todayYmd}`,
            content: `Estatus general de captura: ${totalCompleted}/${activeUnits.length} completadas.`,
            html: cleanHtml(htmlBodyAdmin),
            replyTo: 'no-reply@js1reportes.com',
            encodeLB: true
          })
          sentCount++
        }
      }

      await smtpClient.close()

      return new Response(JSON.stringify({ ok: true, message: `Reportes generales y municipales enviados: ${sentCount} correos.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    throw new Error('Acción no soportada.')

  } catch (error) {
    console.error("Edge Function Error:", error)
    return new Response(
      JSON.stringify({ ok: false, error: error.message || 'Ocurrió un error inesperado' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

