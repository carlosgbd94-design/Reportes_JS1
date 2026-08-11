/**
 * auditoria_console.js — Panel "Auditoría de Datos" (SIREVAQ, ADMIN)
 * Corre la RPC get_audit_findings (Postgres, restringida a ADMIN por RLS/RAISE EXCEPTION) y
 * renderiza los hallazgos como tabla. No modifica nada: es de solo lectura, cada hallazgo se
 * corrige manualmente después de revisarlo (igual que se hizo hoy a mano para varios casos reales).
 */

const AUDIT_SEVERIDAD_LABEL = { alta: 'Alta', media: 'Media', baja: 'Baja' };
const AUDIT_SEVERIDAD_COLOR = { alta: '#dc2626', media: '#d97706', baja: '#64748b' };
const AUDIT_CATEGORIA_LABEL = {
    clues_formato: 'CLUES con formato inválido',
    unidad_huerfana: 'Unidad huérfana',
    unidad_sin_ficha_medica: 'Unidad sin ficha médica',
    poblacion_duplicada_sospechosa: 'Población duplicada entre años',
    meses_faltantes: 'Meses faltantes',
    mapeo_duplicado_mayusculas: 'Mapeo SIS duplicado (mayúsculas)',
    rpc_sin_verificacion_rol: 'RPC sin verificación de rol'
};

window.initConsoleAuditoria = function() {
    const role = String((window.USER || {}).rol || (window.USER || {}).role || '').toUpperCase();
    if (role !== 'ADMIN') {
        const container = document.getElementById('adminSection_auditoria');
        if (container) {
            container.innerHTML = `
                <div style="padding: 40px; text-align: center; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; margin-top: 20px;">
                    <div style="font-size: 32px; margin-bottom: 12px;">🚫</div>
                    <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a;">Acceso Restringido</h3>
                    <p style="margin-top: 6px; font-size: 13px; color: #64748b;">Solo Admin puede correr la auditoría de datos.</p>
                </div>
            `;
        }
    }
};

window.auditRunFindings = async function() {
    const tbody = document.getElementById('auditFindingsTbody');
    const summaryBar = document.getElementById('auditSummaryBar');
    const btn = document.getElementById('btnRunAuditFindings');
    if (!tbody) return;

    if (btn) btn.disabled = true;
    if (typeof showOverlay === 'function') {
        showOverlay('Corriendo auditoría de integridad de datos...', 'Auditoría de Datos');
    }
    tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-slate-400">Consultando...</td></tr>`;

    try {
        const currentYear = new Date().getFullYear();
        const { data, error } = await window.supabase.rpc('get_audit_findings', { p_anio: currentYear });
        if (error) throw error;

        const findings = data || [];

        if (summaryBar) {
            summaryBar.style.display = 'block';
            const counts = { alta: 0, media: 0, baja: 0 };
            findings.forEach(f => { counts[f.severidad] = (counts[f.severidad] || 0) + 1; });
            summaryBar.textContent = findings.length === 0
                ? `Sin hallazgos para ${currentYear}. Última corrida: ${new Date().toLocaleString('es-MX')}.`
                : `${findings.length} hallazgo(s) para ${currentYear} — Alta: ${counts.alta || 0} · Media: ${counts.media || 0} · Baja: ${counts.baja || 0}. Última corrida: ${new Date().toLocaleString('es-MX')}.`;
        }

        if (findings.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-slate-400">Sin hallazgos — no se detectó ningún problema.</td></tr>`;
        } else {
            const severidadOrder = { alta: 0, media: 1, baja: 2 };
            findings.sort((a, b) => (severidadOrder[a.severidad] ?? 9) - (severidadOrder[b.severidad] ?? 9));

            tbody.innerHTML = findings.map(f => {
                const color = AUDIT_SEVERIDAD_COLOR[f.severidad] || '#64748b';
                const sevLabel = AUDIT_SEVERIDAD_LABEL[f.severidad] || f.severidad;
                const catLabel = AUDIT_CATEGORIA_LABEL[f.categoria] || f.categoria;
                return `
                    <tr>
                        <td class="px-6 py-3"><span style="display:inline-block; padding:3px 10px; border-radius:999px; font-size:10.5px; font-weight:800; color:#fff; background:${color};">${sevLabel}</span></td>
                        <td class="px-6 py-3" style="font-weight:700; font-size:12.5px; color:#0f172a;">${catLabel}</td>
                        <td class="px-6 py-3" style="font-family:monospace; font-size:12px; color:#475569;">${f.clues || '—'}</td>
                        <td class="px-6 py-3" style="font-size:12.5px; color:#334155;">${f.descripcion || ''}</td>
                    </tr>
                `;
            }).join('');
        }

        if (typeof showToast === 'function') {
            showToast(`Auditoría completa: ${findings.length} hallazgo(s)`, true, findings.length === 0 ? 'good' : 'warn');
        }
    } catch (e) {
        console.error('Error al correr auditoría de datos:', e);
        tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center" style="color:#dc2626;">Error: ${e.message}</td></tr>`;
        if (typeof showToast === 'function') {
            showToast('Error al correr la auditoría: ' + e.message, false, 'bad');
        }
    } finally {
        if (btn) btn.disabled = false;
        if (typeof hideOverlay === 'function') hideOverlay();
    }
};
