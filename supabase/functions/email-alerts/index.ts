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
    const platformUrl = Deno.env.get('PLATFORM_URL') ?? 'https://carlosgbd94-design.github.io/Reportes_JS1/'

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
    
    const todayYmd = formatter.format(localTime) // YYYY-MM-DD
    
    const yesterday = new Date(localTime)
    yesterday.setDate(localTime.getDate() - 1)
    const yesterdayYmd = formatter.format(yesterday)

    console.log(`[ALERTA LOG] Fecha Local: ${todayYmd}, Día de la Semana: ${dayOfWeek}, Acción: ${action}`)

    // 1. Obtener catálogo de unidades médicas activas
    const { data: units, error: unitsErr } = await supabaseAdmin
      .from('unidades_medicas')
      .select('clues, nombre, municipio')
      .order('nombre')
    
    if (unitsErr) throw new Error(`Error obteniendo unidades: ${unitsErr.message}`)

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

      for (const unit of units) {
        const unitClues = String(unit.clues).trim().toUpperCase()
        const userForUnit = (userProfiles || []).find(p => String(p.clues_asignado).trim().toUpperCase() === unitClues)

        if (!userForUnit?.email) continue

        const missingItems = []

        if (dayOfWeek === 5) {
          // Viernes: Solo verificamos biológicos. Si no capturó ni jueves ni viernes, enviamos recordatorio
          const bioOk = capturedBioToday.has(unitClues) || capturedBioYesterday.has(unitClues)
          if (!bioOk) {
            missingItems.push('Biológicos (Existencias)')
          }
        } else {
          // Jueves (o cualquier otro día de prueba): Verificamos ambos del día de hoy
          const bioOk = capturedBioToday.has(unitClues)
          const consOk = capturedConsToday.has(unitClues)

          if (!consOk) missingItems.push('Consumibles')
          if (!bioOk) missingItems.push('Biológicos (Existencias)')
        }

        if (missingItems.length > 0) {
          const htmlBody = `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
              <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 25px; border-radius: 8px 8px 0 0; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">Recordatorio de Captura Diario</h1>
              </div>
              <div style="padding: 25px; color: #334155; line-height: 1.6;">
                <p style="font-size: 16px; margin-top: 0;">Estimado(a) capturista de la unidad <strong>${unit.nombre}</strong>,</p>
                <p style="font-size: 15px;">Te recordamos que tenemos registros pendientes para tu unidad:</p>
                
                <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 4px; margin: 20px 0;">
                  <span style="color: #991b1b; font-weight: 700; font-size: 14px; text-transform: uppercase;">Pendiente de Capturar:</span>
                  <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #7f1d1d; font-size: 15px; font-weight: 500;">
                    ${missingItems.map(item => `<li>${item}</li>`).join('')}
                  </ul>
                </div>
                
                <p style="font-size: 15px;">Por favor, ingresa a la plataforma a la brevedad para realizar el registro y mantener la información actualizada.</p>
                
                <div style="text-align: center; margin: 30px 0 10px 0;">
                  <a href="${platformUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 30px; border-radius: 6px; font-weight: 600; text-decoration: none; display: inline-block; box-shadow: 0 4px 6px rgba(37,99,235,0.2);">Ir a la Plataforma</a>
                </div>
              </div>
              <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; color: #64748b; font-size: 12px; line-height: 1.4;">
                <p style="margin: 0 0 5px 0;">Este es un recordatorio automático del Sistema de Reportes JS1.</p>
                <p style="margin: 0;">Por favor no respondas a este correo.</p>
              </div>
            </div>
          `

          await smtpClient.send({
            from: gmailUser,
            to: userForUnit.email,
            subject: `⚠️ Recordatorio Pendiente: Captura en ${unit.nombre}`,
            content: `Recordatorio de captura pendiente para ${unit.nombre}: ${missingItems.join(', ')}`,
            html: htmlBody,
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
        .select('email, rol, municipio_asignado')
        .in('rol', ['MUNICIPAL', 'ADMIN', 'JURISDICCIONAL'])

      if (profErr) throw new Error(`Error obteniendo perfiles de supervisión: ${profErr.message}`)

      let sentCount = 0

      // Helper para renderizar los badges de estado
      const renderStatusBadge = (isOk: boolean) => {
        return isOk 
          ? `<span style="background-color: #d1fae5; color: #065f46; padding: 4px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600;">Completado</span>`
          : `<span style="background-color: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600;">Pendiente</span>`
      }

      // Enviar a perfiles MUNICIPALES (solo sus unidades correspondientes)
      const municipalProfiles = (profiles || []).filter(p => p.rol === 'MUNICIPAL' && p.email && p.municipio_asignado)
      for (const supervisor of municipalProfiles) {
        const myMuni = String(supervisor.municipio_asignado).trim().toUpperCase()
        const muniUnits = units.filter(u => String(u.municipio).trim().toUpperCase() === myMuni)

        if (muniUnits.length === 0) continue

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
              <td style="padding: 12px 16px; font-size: 14px; font-weight: 500; color: #1e293b;">${unit.nombre}</td>
              <td style="padding: 12px 16px; font-size: 13px; font-family: monospace; color: #64748b;">${unit.clues}</td>
              <td style="padding: 12px 16px; text-align: center;">${renderStatusBadge(isOk)}</td>
            </tr>
          `
        }).join('')

        const pct = Math.round((completedCount / muniUnits.length) * 100)
        const progressColor = pct === 100 ? '#10b981' : (pct >= 70 ? '#f59e0b' : '#ef4444')

        const htmlBody = `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 25px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">Resumen Municipal de Captura</h1>
              <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 13px; text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">Módulo: ${reportType} | Municipio: ${supervisor.municipio_asignado}</p>
            </div>
            
            <div style="padding: 25px; color: #334155; line-height: 1.6;">
              <p style="font-size: 15px; margin-top: 0;">Estimado(a) Coordinador(a),</p>
              <p style="font-size: 14px;">Te compartimos el estatus de captura para las unidades adscritas a tu municipio el día de hoy <strong>${todayYmd}</strong>:</p>
              
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <div style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Avance del Municipio</div>
                <div style="font-size: 40px; font-weight: 800; color: ${progressColor}; margin: 5px 0;">${pct}%</div>
                <div style="font-size: 13px; color: #475569; font-weight: 500;">
                  Unidades Completadas: <strong>${completedCount}</strong> de <strong>${muniUnits.length}</strong>
                </div>
              </div>
              
              <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                  <tr style="background-color: #f1f5f9; text-align: left;">
                    <th style="padding: 12px 16px; font-size: 12px; font-weight: 700; color: #475569; border-radius: 4px 0 0 4px;">Unidad</th>
                    <th style="padding: 12px 16px; font-size: 12px; font-weight: 700; color: #475569;">CLUES</th>
                    <th style="padding: 12px 16px; font-size: 12px; font-weight: 700; color: #475569; text-align: center; border-radius: 0 4px 4px 0;">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </div>

            <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; color: #64748b; font-size: 11px; margin-top: 20px;">
              <p style="margin: 0;">Jurisdicción Sanitaria 1 - Sistema de Indicadores JS1.</p>
            </div>
          </div>
        `

        await smtpClient.send({
          from: gmailUser,
          to: supervisor.email,
          subject: `📊 Reporte ${reportType}: Municipio ${supervisor.municipio_asignado} (${pct}% Capturado) - ${todayYmd}`,
          content: `Resumen de capture municipal para ${supervisor.municipio_asignado}.`,
          html: htmlBody,
        })
        sentCount++
      }

      // Enviar a perfiles JURISDICCIONALES Y ADMIN (Resumen general de todas las unidades, separado por municipio)
      const adminProfiles = (profiles || []).filter(p => (p.rol === 'ADMIN' || p.rol === 'JURISDICCIONAL') && p.email)
      
      if (adminProfiles.length > 0) {
        // Agrupar unidades por municipio
        const unitsByMuni: { [key: string]: typeof units } = {}
        units.forEach(u => {
          const mKey = String(u.municipio).trim().toUpperCase()
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
                <td style="padding: 8px 12px; font-size: 13px; color: #334155;">${unit.nombre}</td>
                <td style="padding: 8px 12px; font-size: 12px; font-family: monospace; color: #64748b;">${unit.clues}</td>
                <td style="padding: 8px 12px; text-align: center;">${renderStatusBadge(isOk)}</td>
              </tr>
            `
          }).join('')

          const muniPct = Math.round((muniCompleted / muniUnits.length) * 100)

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

        const totalPct = Math.round((totalCompleted / units.length) * 100)

        const htmlBodyAdmin = `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 750px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="background: linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%); padding: 25px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">Reporte General Jurisdiccional</h1>
              <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 13px; text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">Jurisdicción Sanitaria 1 | Módulo: ${reportType}</p>
            </div>
            
            <div style="padding: 25px; color: #334155; line-height: 1.6;">
              <p style="font-size: 15px; margin-top: 0;">Estimado(a) Administrador(a) / Personal Jurisdiccional,</p>
              <p style="font-size: 14px;">Se presenta el consolidado de capturas generales para el día de hoy <strong>${todayYmd}</strong>:</p>
              
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <div style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Estatus Jurisdiccional Global</div>
                <div style="font-size: 44px; font-weight: 800; color: #1e3a8a; margin: 5px 0;">${totalPct}%</div>
                <div style="font-size: 14px; color: #475569; font-weight: 500;">
                  Total General: <strong>${totalCompleted}</strong> de <strong>${units.length}</strong> unidades capturadas
                </div>
              </div>
              
              <h3 style="color: #1e293b; font-size: 16px; font-weight: 700; margin-top: 30px; margin-bottom: 10px;">Consolidado por Municipios</h3>
              ${municipiosHtml}
            </div>

            <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; color: #64748b; font-size: 11px; margin-top: 30px;">
              <p style="margin: 0;">Jurisdicción Sanitaria 1 - Sistema de Indicadores JS1.</p>
            </div>
          </div>
        `

        for (const admin of adminProfiles) {
          await smtpClient.send({
            from: gmailUser,
            to: admin.email,
            subject: `📊 [GENERAL] Reporte JS1 ${reportType} (${totalPct}% Global) - ${todayYmd}`,
            content: `Estatus general de captura: ${totalCompleted}/${units.length} completadas.`,
            html: htmlBodyAdmin,
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
