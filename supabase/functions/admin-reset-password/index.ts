import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const JS1_SALT = "JS1_SALT_2026_MX";
async function hashPassword(text: string) {
  const msgUint8 = new TextEncoder().encode(text + JS1_SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseServiceKey) {
       throw new Error('Configuración incompleta: Falta SUPABASE_SERVICE_ROLE_KEY en los Secrets.');
    }

    // 1. Validar Token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No se encontró cabecera de autorización');
    
    const token = authHeader.replace(/bearer /i, '');
    if (token === 'null' || token === 'undefined' || !token) {
      throw new Error('Sesión no válida. Por favor, cierra sesión y vuelve a entrar.');
    }

    // Cliente para validación de usuario
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error(`Token inválido o sesión expirada: ${authError?.message || 'Error desconocido'}`);
    }

    // 2. Cliente Admin para operaciones
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Verificar en la base de datos que este usuario realmente sea ADMIN
    const { data: callerProfile } = await supabaseAdmin
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (!callerProfile || callerProfile.rol !== 'ADMIN') {
      throw new Error('Solo los administradores pueden resetear contraseñas');
    }

    // 4. Leer Payload
    const payload = await req.json();
    const { usuario: internalID } = payload;
    
    if (!internalID) {
      throw new Error('El ID de usuario es obligatorio');
    }

    // Buscar el usuario real en 'perfiles' para obtener su Auth ID
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('perfiles')
      .select('id, email')
      .eq('usuario', internalID)
      .single();

    if (targetError || !targetProfile) {
      throw new Error('No se encontró el perfil del usuario en la base de datos');
    }

    const tempPassword = 'JS1-2026-Temp';

    // 5. Actualizar usuario en Auth
    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
      targetProfile.id,
      { 
        password: tempPassword,
        user_metadata: { force_password_change: true }
      }
    );

    if (updateAuthError) {
      throw new Error(`Error al resetear la contraseña en Auth: ${updateAuthError.message}`);
    }

    // 6. Actualizar en tabla perfiles (marcar must_change = true)
    const { error: updatePerfilError } = await supabaseAdmin
      .from('perfiles')
      .update({ must_change: true })
      .eq('id', targetProfile.id);

    if (updatePerfilError) console.error("Error al actualizar perfiles:", updatePerfilError);

    // 7. Actualizar en tabla usuarios_legacy
    const legacyHash = await hashPassword(tempPassword);
    const { error: legacyError } = await supabaseAdmin
      .from('usuarios_legacy')
      .update({ password: legacyHash, must_change: true })
      .eq('usuario', internalID);

    if (legacyError) console.error("Error al actualizar legacy:", legacyError);

    return new Response(
      JSON.stringify({ ok: true, message: 'Contraseña reiniciada a JS1-2026-Temp exitosamente' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error("Edge Function Error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message || 'Ocurrió un error inesperado' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
})
