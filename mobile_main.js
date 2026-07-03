(() => {
    // --- Configuración Global ---
    const SUPABASE_URL = "https://utclfqjietlxzlorxhrs.supabase.co";
    const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Y2xmcWppZXRseHpsb3J4aHJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTYyNTQsImV4cCI6MjA5MTkzMjI1NH0.EgDK7xkSZHZyUlGF5m2C7bZjrfkx1M8cBXzxIFedDa4"; 

    let supabaseClient = null;
    let currentUser = null;
    let currentProfile = null;
    let activePanel = 'SR';
    let biologicosCatalogo = [];
    let biologicosParams = [];
    let lotesCatalogo = [];

    let hasTodaySR = false;
    let hasTodayCONS = false;
    let hasTodayBIO = false;
    let hasActivePinol = false;

    let isEditingSR = false;
    let isEditingCONS = false;
    let isEditingBIO = false;
    let targetPedidoDate = "";
    let canCaptureBioGlobal = true;
    let canCaptureConsGlobal = true;
    let recentErrors = [];
    const originalConsoleError = console.error;
    console.error = function(...args) {
        recentErrors.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
        if (recentErrors.length > 5) recentErrors.shift();
        originalConsoleError.apply(console, args);
    };
    const INDICATOR_W = 50; // Circular pointer width/height

    // Drag state for Selection Dock
    let isDraggingDock = false;
    let dragStartX = 0;
    let dockLeftOffset = 0;

    // --- Toast Alerts ---
    const showToast = (message, type = 'success') => {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast-msg ${type}`;
        toast.innerHTML = `
            <span class="material-symbols-rounded text-lg">${type === 'success' ? 'check_circle' : 'error'}</span>
            <span>${message}</span>
        `;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    // --- Expiration Utilities ---
    const getShelfLifeClass = (cad) => {
        if (!cad) return "";
        let cadDate = new Date(cad + "T00:00:00");
        if (isNaN(cadDate.getTime())) return "";

        const today = new Date();
        const firstOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const diffMonths = (cadDate.getFullYear() - firstOfCurrentMonth.getFullYear()) * 12 + (cadDate.getMonth() - firstOfCurrentMonth.getMonth());

        if (diffMonths <= 3) return "shelf-life-danger"; // Expirado/Crítico
        if (diffMonths <= 6) return "shelf-life-warn";   // Alerta
        return "shelf-life-ok";
    };

    const formatToMmmAa = (cad) => {
        if (!cad) return "—";
        const parts = cad.split('-');
        if (parts.length < 3) return cad;
        
        const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
        const mIdx = parseInt(parts[1]) - 1;
        const yy = parts[0].substring(2);
        
        return `${months[mIdx]}-${yy}`;
    };

    // --- Initialize Supabase ---
    const initSupabase = () => {
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
                auth: {
                    experimental: {
                        passkey: true
                    }
                }
            });
            checkSession();
        } else {
            showToast("Error de conexión con base de datos. Reintente.", "error");
        }
    };

    // --- Autenticación ---
    const checkSession = async () => {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            handleAuthSuccess(session.user);
        }
    };

    const handleAuthSuccess = async (user) => {
        currentUser = user;
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        showToast("Sesión iniciada correctamente");
        
        initTheme();
        await fetchProfile();
        await fetchCatalogs();
        await fetchTargetDate();
        canCaptureConsGlobal = checkConsumiblesCaptureWindow();
        await fetchLotes();
        await loadCompliance();
        await checkCapturesState();
        await loadNotifications();
        await loadFiles();
        loadWeather();
        initNotificationsRealtime();
        switchPanel('SR');
        initDockDrag();
    };

    const fetchProfile = async () => {
        if (!currentUser) return;
        
        const { data, error } = await supabaseClient
            .from('perfiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error || !data) {
            console.warn("Profile error, using metadata fallback:", error);
            currentProfile = {
                id: currentUser.id,
                usuario: currentUser.email,
                rol: currentUser.user_metadata?.rol || "UNIDAD",
                clues: currentUser.user_metadata?.clues || "QTSSA012154",
                unidad: currentUser.user_metadata?.unidad || "OFICINAS DE LA JURISDICCION SANITARIA",
                municipio: currentUser.user_metadata?.municipio || "Querétaro",
                activo: "SI"
            };
        } else {
            currentProfile = data;
        }
        const dataProfile = currentProfile;
        document.getElementById('profileName').textContent = dataProfile.usuario || currentUser.email;
        document.getElementById('profileRole').textContent = dataProfile.rol || 'UNIDAD';
        
        const isAdmin = dataProfile.rol === 'ADMIN' || dataProfile.rol === 'JURISDICCIONAL';
        document.getElementById('profileClues').textContent = dataProfile.clues || (isAdmin ? 'QTSSA012154 (Jurisdicción 1)' : 'Ninguna');
        document.getElementById('profileUnidad').textContent = dataProfile.unidad || (isAdmin ? 'Jurisdicción JS1' : 'No asignada');
        document.getElementById('profileMunicipio').textContent = dataProfile.municipio || (isAdmin ? 'Querétaro' : 'Ninguno');
        document.getElementById('profileAllowed').textContent = dataProfile.municipios_allowed || (isAdmin ? 'Todos' : 'Ninguno');

        // BCG button mobile dynamic visibility (Unidad non-UMME/FAM only)
        const btnSetBCGMobile = document.getElementById('btnSetBCGMobile');
        if (btnSetBCGMobile) {
            const isUnidad = dataProfile.rol === 'UNIDAD';
            const cluesUpper = String(dataProfile.clues || "").toUpperCase();
            const nameUpper = String(dataProfile.usuario || currentUser.email || "").toUpperCase();
            const isUmmeOrFam = cluesUpper.includes("UMME") || cluesUpper.includes("FAM") || nameUpper.includes("UMME") || nameUpper.includes("FAM") || dataProfile.rol === "CARAVANAS";
            if (isUnidad && !isUmmeOrFam) {
                btnSetBCGMobile.classList.remove('hidden');
            } else {
                btnSetBCGMobile.classList.add('hidden');
            }
        }
    };

    const normalizeString = (str) => {
        if (!str) return "";
        return String(str)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toUpperCase();
    };

    const fetchCatalogs = async () => {
        const { data: catData, error: catError } = await supabaseClient
            .from('biologicos_catalogo')
            .select('*')
            .order('orden_biologico');

        if (catError) {
            console.error("fetchCatalogs master catalog error:", catError);
            showToast("Error catálogos: " + catError.message, "error");
            return;
        }

        if (catData) {
            biologicosCatalogo = catData;
        }

        if (currentProfile) {
            const isAdmin = currentProfile.rol === 'ADMIN' || currentProfile.rol === 'JURISDICCIONAL';
            const cluesFilter = (isAdmin ? 'QTSSA012154' : (currentProfile.clues || '*')).trim().toUpperCase();

            const { data: paramsData, error: paramsError } = await supabaseClient
                .from('biologicos_params')
                .select('*')
                .in('clues', [cluesFilter, '*']);

            if (paramsError) {
                console.error("fetchCatalogs params error:", paramsError);
                showToast("Error parámetros: " + paramsError.message, "error");
                return;
            }

            if (paramsData && paramsData.length > 0) {
                biologicosParams = paramsData;

                biologicosCatalogo.forEach(bio => {
                    const bioNormalized = normalizeString(bio.biologico);
                    const matchedParam = paramsData.find(p => 
                        normalizeString(p.biologico) === bioNormalized && String(p.clues).trim().toUpperCase() === cluesFilter
                    ) || paramsData.find(p => 
                        normalizeString(p.biologico) === bioNormalized && String(p.clues).trim().toUpperCase() === '*'
                    );
                    
                    if (matchedParam) {
                        bio.promedio_frascos = matchedParam.promedio_frascos || 0;
                        bio.min_dosis = matchedParam.min_dosis || 0;
                        bio.max_dosis = matchedParam.max_dosis || 0;
                    } else {
                        bio.promedio_frascos = 0;
                        bio.min_dosis = 0;
                        bio.max_dosis = 0;
                    }
                });
            }
        }
    };

    const prefillBIOReport = async () => {
        if (!currentProfile || !targetPedidoDate) return;
        const isAdmin = currentProfile.rol === 'ADMIN' || currentProfile.rol === 'JURISDICCIONAL';
        const cluesFilter = isAdmin ? 'QTSSA012154' : (currentProfile.clues || '');

        const { data: savedItems, error } = await supabaseClient
            .from('biologicos_pedido')
            .select('*')
            .eq('clues', cluesFilter)
            .eq('fecha_pedido_programada', targetPedidoDate);

        if (error) {
            console.error("prefillBIOReport error:", error);
            showToast("Error pre-llenado BIO: " + error.message, "error");
            return;
        }

        if (savedItems && savedItems.length > 0) {
            savedItems.forEach(item => {
                const bioName = String(item.biologico).trim().toUpperCase();
                const matchedBio = biologicosCatalogo.find(b => String(b.biologico).trim().toUpperCase() === bioName);
                if (matchedBio) {
                    const existInput = document.querySelector(`input[data-bio-id="${matchedBio.id}"][data-field="existencia"]`);
                    const pedInput = document.querySelector(`input[data-bio-id="${matchedBio.id}"][data-field="pedido"]`);
                    if (existInput) {
                        existInput.value = item.existencia_actual_frascos || 0;
                        existInput.dispatchEvent(new Event('input'));
                    }
                    if (pedInput) {
                        pedInput.value = item.pedido_frascos || 0;
                        pedInput.dispatchEvent(new Event('input'));
                    }
                }
            });
            hasTodayBIO = true;
            syncCommandHub();
        }
    };

    const fetchLotes = async () => {
        const { data, error } = await supabaseClient.from('lotes').select('*');
        if (error) {
            console.error("fetchLotes error:", error);
            showToast("Error lotes: " + error.message, "error");
            return;
        }
        if (data) {
            lotesCatalogo = data;
            
            const container = document.getElementById('srCardsContainer');
            if (container) container.innerHTML = '';
            
            renderPedidosCards();
            await prefillPreviousReport();
            await prefillBIOReport();
        }
    };

    const fetchTargetDate = async () => {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabaseClient
            .from('calendario_pedidos')
            .select('*')
            .eq('anio_mes', today.substring(0, 7))
            .eq('activo', 'SI')
            .maybeSingle();

        if (error) {
            console.error("fetchTargetDate error:", error);
        }

        const now = new Date();
        let start, target, end;
        if (data && data.fecha_programada) {
            start = new Date(data.habilitar_desde);
            target = new Date(data.fecha_programada);
            end = new Date(data.habilitar_hasta);
        } else {
            const intelligentWindow = calculateBioIntelligentWindow(now.getFullYear(), now.getMonth());
            start = intelligentWindow.start;
            target = intelligentWindow.target;
            end = intelligentWindow.end;
        }

        const windowStartYmd = dateToLocalYmd(start);
        const windowTargetYmd = dateToLocalYmd(target);
        const windowEndYmd = dateToLocalYmd(end);
        const hoyYmd = dateToLocalYmd(now);

        canCaptureBioGlobal = hoyYmd >= windowStartYmd && hoyYmd <= windowEndYmd;
        targetPedidoDate = windowTargetYmd;

        const bioBox = document.getElementById('fechaPedidoBIOBox');
        if (bioBox) {
            bioBox.className = "p-5 rounded-2xl mb-6 text-center border-none transition-all";
            
            const startLabel = window.dayjs ? window.dayjs(start).format('DD/MM') : windowStartYmd.substring(5);
            const endLabel = window.dayjs ? window.dayjs(end).format('DD/MM') : windowEndYmd.substring(5);
            const targetLabelStr = window.dayjs ? window.dayjs(target).format('DD/MM/YYYY') : windowTargetYmd;

            if (canCaptureBioGlobal) {
                bioBox.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)";
                bioBox.style.color = "#ffffff";
                bioBox.innerHTML = `
                    <span class="text-[10px] font-black uppercase tracking-widest block opacity-90 mb-1">🟢 Ventana de Captura Activa</span>
                    <span class="text-lg font-black block mb-1">${targetLabelStr}</span>
                    <span class="text-[9px] font-bold opacity-85 block">Disponible del ${startLabel} al ${endLabel}</span>
                `;
            } else if (hoyYmd < windowStartYmd) {
                // Future capture window
                bioBox.style.background = "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)";
                bioBox.style.color = "#ffffff";
                bioBox.innerHTML = `
                    <span class="text-[10px] font-black uppercase tracking-widest block opacity-90 mb-1">🔵 Ventana de Captura Próxima</span>
                    <span class="text-lg font-black block mb-1">${targetLabelStr}</span>
                    <span class="text-[9px] font-bold opacity-85 block">Estará disponible del ${startLabel} al ${endLabel}</span>
                `;
            } else {
                // Past capture window
                bioBox.style.background = "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
                bioBox.style.color = "#ffffff";
                bioBox.innerHTML = `
                    <span class="text-[10px] font-black uppercase tracking-widest block opacity-90 mb-1">🔴 Ventana de Captura Cerrada</span>
                    <span class="text-lg font-black block mb-1">${targetLabelStr}</span>
                    <span class="text-[9px] font-bold opacity-85 block">Estuvo disponible del ${startLabel} al ${endLabel}</span>
                `;
            }
        }
    };

    // --- Dynamic Card Management in Existencia de Biológico (SR) ---
    const addSRCard = (data = null) => {
        const container = document.getElementById('srCardsContainer');
        if (!container) return;

        if (container.querySelector('.font-bold')) container.innerHTML = '';

        const cardId = 'card_' + Math.random().toString(36).substring(2, 9);
        const card = document.createElement('div');
        card.className = 'biologic-card dynamic-sr-card';
        card.dataset.cardId = cardId;

        const bioOptions = biologicosCatalogo.map(bio => {
            const isSelected = data?.biologico && (String(data.biologico).trim().toUpperCase() === String(bio.biologico).trim().toUpperCase());
            return `<option value="${bio.biologico}" ${isSelected ? 'selected' : ''}>${bio.biologico}</option>`;
        }).join('');

        card.innerHTML = `
            <div class="card-header flex justify-between items-center pb-2 border-b border-slate-100">
                <span class="text-xs font-black text-slate-800 uppercase tracking-widest">Entrada de Biológico</span>
                <div class="flex items-center gap-2 ml-auto">
                    <button type="button" class="btn-clone-card" title="Duplicar">
                        <span class="material-symbols-rounded">post_add</span>
                    </button>
                    <button type="button" class="btn-delete-card" title="Eliminar">
                        <span class="material-symbols-rounded">delete</span>
                    </button>
                </div>
            </div>
            <div class="cascade-inputs pt-3">
                <div class="cascade-field">
                    <label>Biológico</label>
                    <select class="sr-bio-select w-full" data-field="biologico">
                        <option value="">Selecciona...</option>
                        ${bioOptions}
                    </select>
                </div>
                <div class="cascade-field">
                    <label>Lote</label>
                    <select class="sr-lote-select w-full" data-field="lote" disabled>
                        <option value="">Selecciona lote...</option>
                    </select>
                </div>
                <div class="cascade-field">
                    <label>Caducidad</label>
                    <span class="text-xs font-black text-slate-400 sr-cad-badge">—</span>
                </div>
                <div class="cascade-field">
                    <label>Recepción</label>
                    <input type="date" data-field="recepcion" class="w-full" value="${data?.fecha_recepcion || ''}">
                </div>
                <div class="cascade-field">
                    <label>Cantidad</label>
                    <div class="touch-stepper-wrap flex items-center gap-2">
                        <button type="button" class="stepper-btn" onclick="const inp=this.nextElementSibling; inp.value=Math.max(0, (parseInt(inp.value)||0)-1);">-</button>
                        <input type="number" data-field="cantidad" value="${data?.cantidad || 0}" min="0" class="w-full text-center font-black sr-qty-input">
                        <button type="button" class="stepper-btn" onclick="const inp=this.previousElementSibling; inp.value=(parseInt(inp.value)||0)+1;">+</button>
                    </div>
                </div>
            </div>
        `;

        const bioSelect = card.querySelector('.sr-bio-select');
        const loteSelect = card.querySelector('.sr-lote-select');
        const cadBadge = card.querySelector('.sr-cad-badge');
        const qtyInput = card.querySelector('.sr-qty-input');

        qtyInput.addEventListener('input', (e) => {
            let val = e.target.value;
            if (val.length > 1 && val.startsWith('0')) {
                e.target.value = val.replace(/^0+/, '');
            }
        });

        const updateLoteDropdown = (selectedBio, preselectedLote = null) => {
            if (!selectedBio) {
                loteSelect.innerHTML = '<option value="">Selecciona lote...</option>';
                loteSelect.disabled = true;
                cadBadge.className = 'text-xs font-black text-slate-400 sr-cad-badge';
                cadBadge.textContent = '—';
                return;
            }

            const filteredLotes = lotesCatalogo.filter(l => 
                String(l.biologico).trim().toUpperCase() === selectedBio.trim().toUpperCase()
            );

            if (filteredLotes.length === 0) {
                loteSelect.innerHTML = '<option value="">Sin lotes activos</option>';
                loteSelect.disabled = true;
                cadBadge.textContent = '—';
                return;
            }

            loteSelect.innerHTML = '<option value="">Selecciona lote...</option>' + filteredLotes.map(l => 
                `<option value="${l.lote}" data-cad="${l.caducidad}" ${preselectedLote === l.lote ? 'selected' : ''}>${l.lote}</option>`
            ).join('');
            loteSelect.disabled = false;

            if (preselectedLote) {
                const matched = filteredLotes.find(l => l.lote === preselectedLote);
                if (matched) {
                    const lifeClass = getShelfLifeClass(matched.caducidad);
                    cadBadge.className = `text-xs font-black sr-cad-badge ${lifeClass}`;
                    cadBadge.textContent = formatToMmmAa(matched.caducidad);
                }
            }
        };

        bioSelect.addEventListener('change', () => {
            updateLoteDropdown(bioSelect.value);
        });

        loteSelect.addEventListener('change', () => {
            const opt = loteSelect.selectedOptions[0];
            const cad = opt ? opt.dataset.cad : null;
            if (cad) {
                const formatted = formatToMmmAa(cad);
                const lifeClass = getShelfLifeClass(cad);
                cadBadge.className = `text-xs font-black sr-cad-badge ${lifeClass}`;
                cadBadge.textContent = formatted;
            } else {
                cadBadge.className = 'text-xs font-black text-slate-400 sr-cad-badge';
                cadBadge.textContent = '—';
            }
        });

        card.querySelector('.btn-clone-card').addEventListener('click', () => {
            addSRCard({
                biologico: bioSelect.value,
                lote: loteSelect.value,
                fecha_recepcion: '',
                cantidad: 0
            });
            showToast("Entrada duplicada. Asigna la nueva cantidad/fecha.");
        });

        card.querySelector('.btn-delete-card').addEventListener('click', () => {
            card.remove();
            showToast("Registro eliminado.", "error");
        });

        container.appendChild(card);

        if (data) {
            updateLoteDropdown(data.biologico, data.lote);
        }

        if (hasTodaySR && !isEditingSR) {
            card.querySelectorAll('select, input').forEach(el => el.disabled = true);
            card.querySelectorAll('.btn-delete-card, .btn-clone-card').forEach(el => el.style.display = 'none');
        }
    };

    // --- Pre-llenado de Captura Semanal Anterior ---
    const prefillPreviousReport = async () => {
        if (!currentProfile) return;
        const isAdmin = currentProfile.rol === 'ADMIN' || currentProfile.rol === 'JURISDICCIONAL';
        const cluesFilter = (isAdmin ? 'QTSSA012154' : (currentProfile.clues || '')).trim().toUpperCase();

        if (!cluesFilter) return;

        const { data: lastRecord } = await supabaseClient
            .from('biologicos_existencia')
            .select('fecha')
            .eq('clues', cluesFilter)
            .order('fecha', { ascending: false })
            .limit(1);

        if (lastRecord && lastRecord.length > 0) {
            const lastDate = lastRecord[0].fecha;
            
            const { data: details } = await supabaseClient
                .from('existencia_detalle')
                .select('*')
                .eq('clues', cluesFilter)
                .eq('fecha', lastDate);

            if (details && details.length > 0) {
                const container = document.getElementById('srCardsContainer');
                if (container) container.innerHTML = '';

                details.forEach(item => {
                    addSRCard({
                        biologico: item.biologico,
                        lote: item.lote,
                        fecha_recepcion: item.fecha_recepcion,
                        cantidad: item.cantidad
                    });
                });
                showToast("Se pre-llenó la información de la captura anterior.");
            }
        } else {
            addSRCard();
        }
    };

    // --- Command Hub Lock/Edit State Sync ---
    const applyFormLocks = () => {
        const isSRLocked = hasTodaySR && !isEditingSR;
        const isCONSLocked = (hasTodayCONS && !isEditingCONS) || !canCaptureConsGlobal;
        const isBIOLocked = (hasTodayBIO && !isEditingBIO) || !canCaptureBioGlobal;
        const isPinolLocked = hasActivePinol;

        // Lock/Unlock SR inputs
        document.querySelectorAll('#srCardsContainer select, #srCardsContainer input, #srCardsContainer button').forEach(el => {
            if (el.classList.contains('btn-delete-card') || el.classList.contains('btn-clone-card')) {
                el.style.display = isSRLocked ? 'none' : 'flex';
            } else {
                el.disabled = isSRLocked;
            }
        });
        const btnAddSRCard = document.getElementById('btnAddSRCard');
        if (btnAddSRCard) btnAddSRCard.style.display = isSRLocked ? 'none' : 'flex';

        // Lock/Unlock CONS inputs
        document.querySelectorAll('#panelCONS input, #panelCONS textarea').forEach(el => {
            if (el.id !== 'chkSinMovimientoCONS') {
                el.disabled = isCONSLocked;
            }
        });
        const chkSinMovCONS = document.getElementById('chkSinMovimientoCONS');
        if (chkSinMovCONS) chkSinMovCONS.disabled = isCONSLocked || !canCaptureConsGlobal;

        // Lock/Unlock BIO inputs
        document.querySelectorAll('#panelBIO input, #panelBIO select, #panelBIO textarea').forEach(el => {
            if (el.id !== 'chkNoPedido') {
                el.disabled = isBIOLocked;
            }
        });
        const chkNoPedido = document.getElementById('chkNoPedido');
        if (chkNoPedido) chkNoPedido.disabled = isBIOLocked || !canCaptureBioGlobal;

        // Lock/Unlock PINOL inputs
        document.querySelectorAll('#panelPINOL input, #panelPINOL textarea').forEach(el => {
            el.disabled = isPinolLocked;
            el.style.opacity = isPinolLocked ? "0.55" : "";
            el.style.pointerEvents = isPinolLocked ? "none" : "";
        });
    };

    const syncCommandHub = () => {
        const hub = document.getElementById('globalCommandHub');
        if (!hub) return;

        const saveBtn = document.getElementById('hubSaveBtn');
        const editBtn = document.getElementById('hubEditBtn');
        const cancelBtn = document.getElementById('hubCancelBtn');
        const statusChip = document.getElementById('hubStatusChip');
        const statusText = document.getElementById('hubStatusText');

        let isAlreadySaved = false;
        let isEditing = false;

        if (activePanel === 'SR') {
            isAlreadySaved = hasTodaySR;
            isEditing = isEditingSR;
        } else if (activePanel === 'CONS') {
            isAlreadySaved = hasTodayCONS || !canCaptureConsGlobal;
            isEditing = isEditingCONS;
        } else if (activePanel === 'BIO') {
            isAlreadySaved = hasTodayBIO || !canCaptureBioGlobal;
            isEditing = isEditingBIO;
        } else if (activePanel === 'PINOL') {
            isAlreadySaved = hasActivePinol;
            isEditing = false;
        }

        // Update status text and chip classes
        if (statusText && statusChip) {
            statusChip.style.display = "flex";
            if ((activePanel === 'BIO' && !canCaptureBioGlobal) || (activePanel === 'CONS' && !canCaptureConsGlobal)) {
                statusText.textContent = 'Fuera de Ventana';
                statusChip.className = 'status-chip-v5 flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-full text-[10px] font-black uppercase tracking-wider';
            } else if (isAlreadySaved) {
                statusText.textContent = isEditing ? 'Editando' : 'Reporte Guardado';
                statusChip.className = 'status-chip-v5 flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-wider';
            } else {
                statusText.textContent = 'Listo';
                statusChip.className = 'status-chip-v5 flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-wider';
            }
        }

        // Show/Hide buttons
        if (saveBtn) {
            let show = (!isAlreadySaved || isEditing);
            const iconSpan = saveBtn.querySelector('.material-symbols-rounded');
            const isOutsideWindow = (activePanel === 'BIO' && !canCaptureBioGlobal) || (activePanel === 'CONS' && !canCaptureConsGlobal);

            if (isOutsideWindow) {
                saveBtn.disabled = true;
                saveBtn.style.background = '#e2e8f0';
                saveBtn.style.color = '#94a3b8';
                saveBtn.style.pointerEvents = 'none';
                saveBtn.style.opacity = '0.7';
                saveBtn.style.boxShadow = 'none';
                if (iconSpan) iconSpan.textContent = 'save';
                saveBtn.style.setProperty('display', 'flex', 'important');
            } else {
                saveBtn.disabled = false;
                saveBtn.style.background = '';
                saveBtn.style.color = '';
                saveBtn.style.pointerEvents = '';
                saveBtn.style.opacity = '';
                saveBtn.style.boxShadow = '';
                if (iconSpan) iconSpan.textContent = 'save';
                saveBtn.style.setProperty('display', show ? 'flex' : 'none', 'important');
            }
        }
        if (editBtn) {
            const hasActualCapture = (activePanel === 'SR' && hasTodaySR) || (activePanel === 'CONS' && hasTodayCONS) || (activePanel === 'BIO' && hasTodayBIO);
            const show = (hasActualCapture && !isEditing && activePanel !== 'PINOL');
            editBtn.style.setProperty('display', show ? 'flex' : 'none', 'important');
        }
        if (cancelBtn) {
            const show = isEditing;
            cancelBtn.style.setProperty('display', show ? 'flex' : 'none', 'important');
        }

        applyFormLocks();
    };

    const checkCapturesState = async () => {
        if (!currentProfile) return;
        const isAdmin = currentProfile.rol === 'ADMIN' || currentProfile.rol === 'JURISDICCIONAL';
        const cluesFilter = isAdmin ? 'QTSSA012154' : (currentProfile.clues || '');
        const today = new Date().toISOString().split('T')[0];

        // Weekly capture check: if Thursday or Friday, check both dates
        let srDateFilter = [today];
        const dow = new Date().getDay();
        if (dow === 5) {
            const yesterdayObj = new Date();
            yesterdayObj.setDate(yesterdayObj.getDate() - 1);
            srDateFilter.push(yesterdayObj.toISOString().split('T')[0]);
        } else if (dow === 4) {
            const tomorrowObj = new Date();
            tomorrowObj.setDate(tomorrowObj.getDate() + 1);
            srDateFilter.push(tomorrowObj.toISOString().split('T')[0]);
        }

        try {
            const [resSR, resCONS, resBIO, resPinol] = await Promise.all([
                supabaseClient.from('biologicos_existencia').select('id').eq('clues', cluesFilter).in('fecha', srDateFilter).limit(1),
                supabaseClient.from('consumibles').select('id').eq('clues', cluesFilter).eq('fecha', today).maybeSingle(),
                supabaseClient.from('biologicos_pedido').select('id').eq('clues', cluesFilter).eq('fecha_pedido_programada', targetPedidoDate).limit(1),
                supabaseClient.from('pinol_solicitudes').select('id').eq('clues', cluesFilter).in('estatus', ['PENDIENTE', 'ENTREGADO']).limit(1)
            ]);

            hasTodaySR = resSR.data && resSR.data.length > 0;
            hasTodayCONS = !!resCONS.data;
            hasTodayBIO = resBIO.data && resBIO.data.length > 0;
            hasActivePinol = resPinol.data && resPinol.data.length > 0;
            
            syncCommandHub();
        } catch (e) {
            console.error("Error checking captures state:", e);
            syncCommandHub();
        }
    };

    // --- Weather Widget ---
    const loadWeather = async () => {
        try {
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=20.5881&longitude=-100.3899&current_weather=true&timezone=America/Mexico_City`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.current_weather) {
                    const temp = Math.round(data.current_weather.temperature);
                    document.getElementById('hdrClima').textContent = `${temp}°C`;
                    
                    const code = data.current_weather.weathercode;
                    let emoji = "🌤️";
                    if (code === 0) emoji = "☀️";
                    else if (code >= 1 && code <= 3) emoji = "🌤️";
                    else if (code >= 45 && code <= 48) emoji = "🌫️";
                    else if (code >= 51 && code <= 67) emoji = "🌧️";
                    else if (code >= 71 && code <= 77) emoji = "❄️";
                    else if (code >= 80 && code <= 82) emoji = "🌦️";
                    
                    document.getElementById('lblClimaEmoji').textContent = emoji;
                }
            }
        } catch (e) {
            console.warn(e);
        }
    };

    // --- Cálculo del Cumplimiento Real ---
    const loadCompliance = async () => {
        if (!currentProfile) return;
        const isAdmin = currentProfile.rol === 'ADMIN' || currentProfile.rol === 'JURISDICCIONAL';
        const cluesFilter = isAdmin ? 'QTSSA012154' : (currentProfile.clues || '');

        if (!cluesFilter) {
            document.getElementById('lblCumplimientoVal').textContent = '100%';
            return;
        }

        const todayObj = new Date();
        const year = todayObj.getFullYear();
        const month = todayObj.getMonth();
        const todayYmd = todayObj.toISOString().split('T')[0];
        const startOfMonthStr = new Date(year, month, 1).toISOString().split('T')[0];

        const [resBio, resCons, resPedido] = await Promise.all([
            supabaseClient.from('biologicos_existencia').select('fecha').eq('clues', cluesFilter).gte('fecha', startOfMonthStr),
            supabaseClient.from('consumibles').select('fecha').eq('clues', cluesFilter).gte('fecha', startOfMonthStr),
            supabaseClient.from('biologicos_pedido').select('id').eq('clues', cluesFilter).gte('fecha_captura', startOfMonthStr).eq('tipo_pedido', 'MENSUAL').limit(1)
        ]);

        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0);

        const expectedDatesCons = [];
        const expectedDatesBio = [];
        let iter = new Date(startOfMonth);
        while (iter <= endOfMonth) {
            const dow = iter.getDay();
            const ymd = iter.toISOString().split('T')[0];
            if (dow === 4) expectedDatesCons.push(ymd);
            if (dow === 5) expectedDatesBio.push(ymd);
            iter.setDate(iter.getDate() + 1);
        }

        const denominatorCons = expectedDatesCons.length || 4;
        const denominatorBio = expectedDatesBio.length || 4;

        let cons_semanas_ok = 0;
        expectedDatesCons.forEach(targetJueves => {
            const dJue = new Date(`${targetJueves}T12:00:00`);
            const targetWindow = [targetJueves];
            if (isMexicanHoliday(dJue)) {
                const dMie = new Date(dJue);
                dMie.setDate(dJue.getDate() - 1);
                targetWindow.push(dMie.toISOString().split('T')[0]);
            }
            if (resCons.data && resCons.data.some(r => targetWindow.includes(r.fecha))) {
                cons_semanas_ok++;
            }
        });

        let bio_semanas_ok = 0;
        expectedDatesBio.forEach(targetViernes => {
            const dVie = new Date(`${targetViernes}T12:00:00`);
            const dJue = new Date(dVie);
            dJue.setDate(dVie.getDate() - 1);
            const targetWindow = [targetViernes, dJue.toISOString().split('T')[0]];
            if (isMexicanHoliday(dVie) && isMexicanHoliday(dJue)) {
                const dMie = new Date(dJue);
                dMie.setDate(dJue.getDate() - 1);
                targetWindow.push(dMie.toISOString().split('T')[0]);
            }
            if (resBio.data && resBio.data.some(r => targetWindow.includes(r.fecha))) {
                bio_semanas_ok++;
            }
        });

        const bPct = (bio_semanas_ok / denominatorBio) * 100;
        const cPct = (cons_semanas_ok / denominatorCons) * 100;
        const pPct = (resPedido.data && resPedido.data.length > 0) ? 100 : 0;

        const intelligentWindow = calculateBioIntelligentWindow(year, month);
        const windowStartYmd = intelligentWindow.start.toISOString().split('T')[0];
        const isPedidoRequired = todayYmd >= windowStartYmd;

        let score = 0;
        if (isPedidoRequired) {
            score = Math.round((bPct * 0.4) + (cPct * 0.4) + (pPct * 0.2));
        } else {
            score = Math.round((bPct * 0.5) + (cPct * 0.5));
        }
        if (score > 100) score = 100;

        document.getElementById('lblCumplimientoVal').textContent = `${score}%`;
    };

    // --- Biometric Passkey Functions ---
    const handleBiometricLogin = async () => {
        showToast("Escaneando datos biométricos...", "success");
        try {
            const { data, error } = await supabaseClient.auth.signInWithPasskey();
            if (error) throw error;
            if (data.session) {
                handleAuthSuccess(data.user);
            }
        } catch (err) {
            showToast("Error de acceso biométrico: " + err.message, "error");
        }
    };

    const handleRegisterBiometrics = async (checked) => {
        if (!checked) return;
        showToast("Registrando dispositivo biométrico...", "success");
        try {
            const { error } = await supabaseClient.auth.registerPasskey();
            if (error) throw error;
            showToast("Dispositivo biométrico enlazado con éxito.");
        } catch (err) {
            showToast("Error al registrar: " + err.message, "error");
            document.getElementById('chkBiometria').checked = false;
        }
    };

    // --- Theme Control ---
    const initTheme = () => {
        const theme = localStorage.getItem('theme') || 'light';
        applyThemeClass(theme === 'dark');
    };

    const applyThemeClass = (isDark) => {
        if (isDark) {
            document.documentElement.classList.add('dark');
            document.getElementById('themeIconProfile').textContent = 'dark_mode';
        } else {
            document.documentElement.classList.remove('dark');
            document.getElementById('themeIconProfile').textContent = 'light_mode';
        }
    };

    const toggleTheme = () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        applyThemeClass(isDark);
    };

    // --- Render Pedidos Cards with Real Validation Rules ---
    const renderPedidosCards = () => {
        const container = document.getElementById('bioCardsContainer');
        if (!container) return;

        container.innerHTML = '';
        
        const allowedBios = biologicosParams.filter(p => p.activo === 'SI').map(p => normalizeString(p.biologico));
        const filtered = biologicosCatalogo.filter(bio => allowedBios.includes(normalizeString(bio.biologico)));

        filtered.forEach(bio => {
            const card = document.createElement('div');
            card.className = 'biologic-card';
            
            const promedio = bio.promedio_frascos || 0;
            const minDosis = bio.min_dosis || 0;
            const maxDosis = bio.max_dosis || 0;

            const bioKey = String(bio.biologico).trim().toUpperCase();
            const requires5 = ["BCG", "HEXAVALENTE", "ROTAVIRUS", "NEUMOCOCICA 13", "NEUMOCOCICA 20", "SRP"].includes(bioKey);
            const multiple = requires5 ? 5 : 1;

            card.innerHTML = `
                <div class="card-header">
                    <span class="card-title">${bio.biologico}</span>
                    <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">${bio.tipo_esquema || 'Dosis'}</span>
                </div>
                <div class="cascade-inputs">
                    <div class="flex justify-between text-[10px] font-black text-slate-400 pb-2 border-b border-slate-100">
                        <span>Promedio: <strong class="text-slate-700 dark:text-slate-200">${promedio} fr.</strong></span>
                        <span>Mín/Máx: <strong class="text-slate-700 dark:text-slate-200">${minDosis}/${maxDosis} d.</strong></span>
                    </div>
                    <div class="cascade-field">
                        <label>Existencia</label>
                        <div class="touch-stepper-wrap flex items-center gap-2">
                            <button type="button" class="stepper-btn" onclick="const inp=this.nextElementSibling; inp.value=Math.max(0, (parseInt(inp.value)||0)-1); inp.dispatchEvent(new Event('input'));">-</button>
                            <input type="number" data-bio-id="${bio.id}" data-field="existencia" value="0" min="0" class="w-full text-center font-black bio-exist-input">
                            <button type="button" class="stepper-btn" onclick="const inp=this.previousElementSibling; inp.value=(parseInt(inp.value)||0)+1; inp.dispatchEvent(new Event('input'));">+</button>
                        </div>
                    </div>
                    <div class="cascade-field">
                        <label>Pedido</label>
                        <div class="touch-stepper-wrap flex items-center gap-2">
                            <button type="button" class="stepper-btn" onclick="const inp=this.nextElementSibling; inp.value=Math.max(0, (parseInt(inp.value)||0)-1); inp.dispatchEvent(new Event('input'));">-</button>
                            <input type="number" data-bio-id="${bio.id}" data-field="pedido" value="0" min="0" class="w-full text-center font-black bio-ped-input">
                            <button type="button" class="stepper-btn" onclick="const inp=this.previousElementSibling; inp.value=(parseInt(inp.value)||0)+1; inp.dispatchEvent(new Event('input'));">+</button>
                        </div>
                    </div>
                    <div class="text-center pt-2">
                        <span class="text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider stock-val-badge bg-slate-100 text-slate-500">
                            Sin Captura
                        </span>
                    </div>
                </div>
            `;

            const existInput = card.querySelector('.bio-exist-input');
            const pedInput = card.querySelector('.bio-ped-input');
            const valBadge = card.querySelector('.stock-val-badge');

            const stripZeroes = (e) => {
                let val = e.target.value;
                if (val.length > 1 && val.startsWith('0')) {
                    e.target.value = val.replace(/^0+/, '');
                }
            };
            existInput.addEventListener('input', stripZeroes);
            pedInput.addEventListener('input', stripZeroes);

            const validateStock = () => {
                const exist = parseInt(existInput.value) || 0;
                const ped = parseInt(pedInput.value) || 0;
                const total = exist + ped;

                let isError = false;
                let message = "";
                let badgeClass = "";

                if (multiple > 1 && ped > 0 && (ped % multiple !== 0)) {
                    isError = true;
                    message = `⚠️ Múltiplo de ${multiple}`;
                    badgeClass = "bg-red-100 text-red-700 border border-red-200";
                }
                else if (promedio > 0 && total < promedio) {
                    message = `⚠️ Faltan ${promedio - total} fr.`;
                    badgeClass = "bg-amber-100 text-amber-700 border border-amber-200";
                } else if (promedio > 0) {
                    message = "✓ Correcto";
                    badgeClass = "bg-emerald-100 text-emerald-700 border border-emerald-200";
                } else {
                    message = "✓ Correcto";
                    badgeClass = "bg-slate-100 text-slate-500";
                }

                valBadge.className = `text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider stock-val-badge ${badgeClass}`;
                valBadge.textContent = message;
                
                if (isError) {
                    card.classList.add('border-red-500');
                    card.dataset.invalid = "true";
                } else {
                    card.classList.remove('border-red-500');
                    delete card.dataset.invalid;
                }

                const hasErrors = document.querySelectorAll('[data-invalid="true"]').length > 0;
                const saveBtn = document.getElementById('hubSaveBtn');
                if (saveBtn) saveBtn.disabled = hasErrors;
            };

            existInput.addEventListener('input', validateStock);
            pedInput.addEventListener('input', validateStock);

            container.appendChild(card);
        });
    };

    // --- Notificaciones ---
    const loadNotifications = async () => {
        if (!currentUser || !currentProfile) return;
        const { data } = await supabaseClient
            .from('notificaciones_perfil')
            .select('id, notificacion_id, status, read_ts, notificacion:notificaciones(*)')
            .eq('usuario', currentProfile.usuario)
            .eq('deleted', false)
            .order('created_at', { ascending: false })
            .limit(100);

        if (data) {
            const list = document.getElementById('notifList');
            if (!list) return;
            const unreadCount = data.filter(n => n.status === 'UNREAD').length;

            const badge = document.getElementById('notifBadge');
            if (badge) {
                if (unreadCount > 0) badge.classList.remove('hidden');
                else badge.classList.add('hidden');
            }

            if (data.length === 0) {
                list.innerHTML = `<div class="p-4 text-center text-slate-400 text-xs font-bold">No hay nuevas notificaciones</div>`;
                return;
            }

            const sortedData = [...data].sort((a, b) => {
                const aUnread = a.status === 'UNREAD';
                const bUnread = b.status === 'UNREAD';
                if (aUnread && !bUnread) return -1;
                if (!aUnread && bUnread) return 1;

                const dateA = new Date(a.created_at || a.notificacion?.created_at || 0);
                const dateB = new Date(b.created_at || b.notificacion?.created_at || 0);
                return dateB - dateA;
            });

            list.innerHTML = sortedData.map(item => {
                const notif = item.notificacion || {};
                const isUnread = item.status === 'UNREAD';
                const formattedDate = window.dayjs ? window.dayjs(notif.created_at).format('DD/MM HH:mm') : '';
                return `
                    <div class="p-3 rounded-xl border ${isUnread ? 'bg-slate-50 border-slate-200' : 'bg-transparent border-transparent'} flex flex-col gap-1 transition-all">
                        <div class="flex justify-between items-center">
                            <span class="text-[11px] font-black ${isUnread ? 'text-slate-900' : 'text-slate-500'}">${notif.title || 'Alerta'}</span>
                            <span class="text-[9px] font-bold text-slate-400">${formattedDate}</span>
                        </div>
                        <p class="text-xs text-slate-600 font-medium leading-relaxed">${notif.message || ''}</p>
                    </div>
                `;
            }).join('');
        }
    };

    const initNotificationsRealtime = () => {
        if (!currentUser || !currentProfile) return;
        supabaseClient
            .channel('mobile-notificaciones-perfil')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones_perfil', filter: `usuario=eq.${currentProfile.usuario}` }, () => {
                loadNotifications();
            })
            .subscribe();
    };

    // --- Archivos ---
    const loadFiles = async () => {
        if (!currentUser || !currentProfile) return;
        const role = currentProfile.rol;
        const userClues = currentProfile.clues || "";

        const { data } = await supabaseClient.rpc('get_evidences_list_by_category', {
            category_name: 'Evidencia_de_capacitaciones'
        });

        if (data) {
            let filtered = data;
            if (role === "UNIDAD") {
                filtered = data.filter(f => String(f.name || "").includes(userClues));
            }

            const list = document.getElementById('archivosList');
            if (!list) return;

            if (filtered.length === 0) {
                list.innerHTML = `<div class="p-4 text-center text-slate-400 text-xs font-bold">No hay archivos disponibles</div>`;
                return;
            }

            list.innerHTML = filtered.map(f => {
                const parts = (f.name || "").split("/");
                const fileName = parts[parts.length - 1] || f.name;
                const publicUrl = supabaseClient.storage.from('evidencias').getPublicUrl(f.name).data.publicUrl;

                return `
                    <a href="${publicUrl}" target="_blank" class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-slate-700 hover:bg-slate-100 transition-all">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <span class="material-symbols-rounded text-slate-400 text-lg flex-shrink-0">description</span>
                            <span class="text-xs font-bold truncate">${fileName}</span>
                        </div>
                        <span class="material-symbols-rounded text-slate-400 text-sm">open_in_new</span>
                    </a>
                `;
            }).join('');
        }
    };

    // --- BCG Apertura Modal Flow ---
    const openBCGApertura = async () => {
        if (!currentProfile) return;
        const isAdmin = currentProfile.rol === 'ADMIN' || currentProfile.rol === 'JURISDICCIONAL';
        const clues = isAdmin ? 'QTSSA012154' : (currentProfile.clues || '');

        const { data } = await supabaseClient
            .from('unidades_bcg_apertura')
            .select('*')
            .eq('clues', clues);

        const box = document.getElementById('bcgAperturaTurnosBox');
        if (!box) return;

        const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo", "No abre"];
        const turnos = ["MATUTINO", "VESPERTINO", "ESPECIAL"];
        
        let html = '';
        turnos.forEach(t => {
            const match = data ? data.find(d => d.turno === t) : null;
            const currentDay = match ? match.dia_semana : 'No abre';
            const options = days.map(d => `<option value="${d}" ${d === currentDay ? 'selected' : ''}>${d}</option>`).join('');
            html += `
                <div class="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${t.replace('_', ' ')}</span>
                    <select name="bcgAperturaSelect" data-turno="${t}" class="w-full h-10 border border-slate-200 rounded-lg px-2 text-xs font-bold text-slate-800">
                        <option value="NO_ABRE" ${currentDay === 'No abre' ? 'selected' : ''}>No abre</option>
                        ${options.replace('<option value="No abre" >No abre</option>', '')}
                    </select>
                </div>
            `;
        });
        box.innerHTML = html;
        document.getElementById('bcgAperturaOverlay').classList.remove('hidden');
    };

    const saveBCGApertura = async () => {
        if (!currentProfile) return;
        const isAdmin = currentProfile.rol === 'ADMIN' || currentProfile.rol === 'JURISDICCIONAL';
        const clues = isAdmin ? 'QTSSA012154' : (currentProfile.clues || '');
        
        const selects = Array.from(document.querySelectorAll('select[name="bcgAperturaSelect"]'));
        const rows = [];
        const turnosToDelete = [];

        selects.forEach(sel => {
            const t = sel.getAttribute("data-turno");
            const val = sel.value;
            if (val && val !== "NO_ABRE") {
                rows.push({
                    clues: clues,
                    turno: t,
                    dia_semana: val,
                    updated_at: new Date().toISOString()
                });
            } else {
                turnosToDelete.push(t);
            }
        });

        try {
            if (turnosToDelete.length > 0) {
                const { error: delErr } = await supabaseClient
                    .from('unidades_bcg_apertura')
                    .delete()
                    .eq('clues', clues)
                    .in('turno', turnosToDelete);
                if (delErr) throw delErr;
            }

            if (rows.length > 0) {
                const { error: upsErr } = await supabaseClient
                    .from('unidades_bcg_apertura')
                    .upsert(rows);
                if (upsErr) throw upsErr;
            }

            showToast("Apertura BCG guardada con éxito");
            document.getElementById('bcgAperturaOverlay').classList.add('hidden');
        } catch (error) {
            console.error(error);
            showToast("Error al guardar: " + error.message, "error");
        }
    };

    // --- Directorio BCG Flow ---
    const openBCGDirectorio = async () => {
        try {
            const [resUnits, resApertura] = await Promise.all([
                supabaseClient.from('unidades').select('clues, unidad, municipio').eq('activo', 'SI').order('municipio').order('unidad'),
                supabaseClient.from('unidades_bcg_apertura').select('*')
            ]);

            if (resUnits.error) throw resUnits.error;
            if (resApertura.error) throw resApertura.error;

            window.bcgDirUnits = resUnits.data.filter(u => {
                const name = String(u.unidad || "").toUpperCase();
                return !name.includes("UMME") && !name.includes("FAM");
            });
            window.bcgDirAperturas = resApertura.data;

            const munis = Array.from(new Set(window.bcgDirUnits.map(u => u.municipio))).filter(Boolean).sort();
            const muniSelect = document.getElementById("bcgDirMuniSelect");
            if (muniSelect) {
                muniSelect.innerHTML = '<option value="">Todos los Municipios</option>' + munis.map(m => 
                    `<option value="${m}">${m}</option>`
                ).join('');
            }

            document.getElementById("bcgDirSearchInput").value = "";
            document.getElementById("bcgDirMuniSelect").value = "";
            document.getElementById("bcgDirDaySelect").value = "";

            renderBCGDirectorioList();
            document.getElementById('bcgDirectorioOverlay').classList.remove('hidden');
        } catch (error) {
            console.error("Error al cargar directorio BCG:", error);
            showToast("Error al cargar directorio.", "error");
        }
    };

    const renderBCGDirectorioList = () => {
        const queryInp = document.getElementById("bcgDirSearchInput");
        const muniSel = document.getElementById("bcgDirMuniSelect");
        const daySel = document.getElementById("bcgDirDaySelect");
        const container = document.getElementById("bcgDirList");
        if (!container || !queryInp || !muniSel || !daySel) return;

        const query = queryInp.value.trim().toUpperCase();
        const selectedMuni = muniSel.value;
        const selectedDay = daySel.value;

        const units = window.bcgDirUnits || [];
        const apertures = window.bcgDirAperturas || [];

        const apMap = {};
        apertures.forEach(ap => {
            if (!apMap[ap.clues]) apMap[ap.clues] = [];
            apMap[ap.clues].push(ap);
        });

        const filtered = units.filter(u => {
            if (query) {
                const matchClues = (u.clues || '').toUpperCase().includes(query);
                const matchName = (u.unidad || '').toUpperCase().includes(query);
                if (!matchClues && !matchName) return false;
            }
            if (selectedMuni && u.municipio !== selectedMuni) return false;

            const aps = apMap[u.clues] || [];
            if (selectedDay) {
                const matchesDay = aps.some(ap => String(ap.dia_semana).trim().toUpperCase() === selectedDay.toUpperCase());
                if (!matchesDay) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs font-bold">Sin resultados</div>`;
            return;
        }

        filtered.sort((a, b) => {
            const muniComp = String(a.municipio || "").localeCompare(String(b.municipio || ""));
            if (muniComp !== 0) return muniComp;
            return String(a.unidad || "").localeCompare(String(b.unidad || ""));
        });

        let html = "";
        let lastMuni = null;

        filtered.forEach(u => {
            const muni = u.municipio || "Sin Municipio";
            if (muni !== lastMuni) {
                lastMuni = muni;
                html += `
                    <div class="text-[#0284c7] font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5 mt-4 mb-2">
                        <span class="material-symbols-rounded text-sm">location_on</span>
                        <span>${muni}</span>
                        <div class="flex-1 h-[1px] bg-slate-200"></div>
                    </div>
                `;
            }

            const aps = apMap[u.clues] || [];
            let badgeHtml = "";
            if (aps.length > 0) {
                badgeHtml = aps.map(ap => {
                    let color = "#0284c7";
                    let bg = "#e0f2fe";
                    let icon = "☀️";
                    if (ap.turno === "VESPERTINO") { color = "#d97706"; bg = "#fffbeb"; icon = "⛅"; }
                    else if (ap.turno === "ESPECIAL") { color = "#7c3aed"; bg = "#f5f3ff"; icon = "✨"; }
                    
                    return `
                        <div class="flex items-center gap-1 bg-[${bg}] text-[${color}] border border-[${color}]/10 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase">
                            <span>${icon}</span>
                            <span>${ap.turno.toLowerCase()}</span>
                            <span class="opacity-40">•</span>
                            <span>${ap.dia_semana}</span>
                        </div>
                    `;
                }).join('');
            } else {
                badgeHtml = `
                    <div class="flex items-center gap-1 bg-slate-100 text-slate-400 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase">
                        <span>💤</span>
                        <span>Sin apertura registrada</span>
                    </div>
                `;
            }

            html += `
                <div class="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col gap-2">
                    <div class="flex flex-col">
                        <span class="text-xs font-black text-slate-800">${u.unidad}</span>
                        <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">${u.clues}</span>
                    </div>
                    <div class="flex gap-2 flex-wrap pt-2 border-t border-dashed border-slate-100 mt-1">
                        ${badgeHtml}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    };

    // --- Dock View Switching ---
    const switchPanel = (panelId) => {
        activePanel = panelId;
        
        document.querySelectorAll('.panel-section').forEach(sec => sec.classList.add('hidden'));
        document.getElementById(`panel${panelId}`)?.classList.remove('hidden');

        const items = document.querySelectorAll('.dock-item');
        let activeBtn = null;
        items.forEach(item => {
            const isActive = item.dataset.panel === panelId;
            item.classList.toggle('active', isActive);
            if (isActive) activeBtn = item;
        });

        if (activeBtn) {
            const indicator = document.getElementById('dockIndicator');
            const dock = document.getElementById('mobileCaptureDock');
            const dockRect = dock.getBoundingClientRect();
            const btnRect = activeBtn.getBoundingClientRect();
            
            const transformX = btnRect.left - dockRect.left + (btnRect.width - 76) / 2;

            requestAnimationFrame(() => {
                indicator.style.transform = `translate(${transformX}px, -50%) scale(1.1)`;
                indicator.style.opacity = '1';
            });
        }

        const hub = document.getElementById('globalCommandHub');
        if (hub) {
            hub.classList.add('visible');
            syncCommandHub();
        }
    };

    // --- Dock Touch/Drag Logic (Fully non-blocking) ---
    const initDockDrag = () => {
        const indicator = document.getElementById('dockIndicator');
        const dock = document.getElementById('mobileCaptureDock');

        dock.addEventListener('touchstart', (e) => {
            const touchX = e.touches[0].clientX;
            const indRect = indicator.getBoundingClientRect();
            
            if (touchX >= indRect.left && touchX <= indRect.right) {
                isDraggingDock = true;
                dragStartX = touchX;
                const dockRect = dock.getBoundingClientRect();
                dockLeftOffset = indRect.left - dockRect.left;
                indicator.style.transition = 'none';
            }
        }, { passive: true });

        dock.addEventListener('touchmove', (e) => {
            if (!isDraggingDock) return;
            const clientX = e.touches[0].clientX;
            const deltaX = clientX - dragStartX;
            const dockRect = dock.getBoundingClientRect();
            
            let newX = dockLeftOffset + deltaX;
            newX = Math.max(8, Math.min(newX, dockRect.width - 84));

            requestAnimationFrame(() => {
                indicator.style.transform = `translate(${newX}px, -50%) scale(1.1)`;
            });
        }, { passive: true });

        dock.addEventListener('touchend', (e) => {
            if (!isDraggingDock) return;
            isDraggingDock = false;
            indicator.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.2, 1)';

            const indRect = indicator.getBoundingClientRect();
            const indCenter = indRect.left + indRect.width / 2;

            const items = Array.from(document.querySelectorAll('.dock-item'));
            let closestItem = items[0];
            let minDistance = Infinity;

            items.forEach(item => {
                const rect = item.getBoundingClientRect();
                const itemCenter = rect.left + rect.width / 2;
                const dist = Math.abs(indCenter - itemCenter);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestItem = item;
                }
            });

            switchPanel(closestItem.dataset.panel);
        });
    };

    // --- Guardar Reportes ---
    const saveReport = async () => {
        if (!currentUser || !currentProfile) {
            showToast("No autorizado o sesión expirada.", "error");
            return;
        }

        const isAdmin = currentProfile.rol === 'ADMIN' || currentProfile.rol === 'JURISDICCIONAL';
        const cluesFilter = isAdmin ? 'QTSSA012154' : (currentProfile.clues || '');
        const muniFilter = isAdmin ? 'Querétaro' : (currentProfile.municipio || '');

        const btn = document.getElementById('hubSaveBtn');
        const statusText = document.getElementById('hubStatusText');

        btn.disabled = true;
        statusText.textContent = "Guardando...";

        try {
            let dataObject = {
                usuario: currentProfile.usuario,
                clues: cluesFilter,
                municipio: muniFilter,
                fecha_captura: new Date().toISOString().split('T')[0]
            };

            let tableName = "";
            let isAlreadySaved = false;

            if (activePanel === 'SR') {
                tableName = "reportes_diarios_legacy";
                isAlreadySaved = hasTodaySR;
                const nombreSR = document.getElementById('nombreSR')?.value.trim() || "";
                if (!nombreSR) {
                    showToast("Ingresa el nombre del responsable", "error");
                    throw new Error("Nombre requerido");
                }
                dataObject.nombre_responsable = nombreSR;

                const chkSinMov = document.getElementById('chkSinMovimientoSR');
                const sinMovimiento = chkSinMov && chkSinMov.checked;
                dataObject.sin_movimiento = sinMovimiento ? "SI" : "NO";

                const items = [];
                let hasInvalid = false;
                const errors = [];

                const cards = document.querySelectorAll('.dynamic-sr-card');
                cards.forEach((card, index) => {
                    const bioSelect = card.querySelector('[data-field="biologico"]');
                    const loteSelect = card.querySelector('[data-field="lote"]');
                    const qtyInput = card.querySelector('[data-field="cantidad"]');
                    const recInput = card.querySelector('[data-field="recepcion"]');

                    const bio = bioSelect?.value;
                    const lote = loteSelect?.value;
                    const cant = qtyInput?.value;
                    const recep = recInput?.value;

                    if (!bio && !lote && !cant && !recep) return;

                    const rowErrors = [];
                    if (!bio) rowErrors.push("falta seleccionar el biológico");
                    if (bio && !lote) rowErrors.push("falta seleccionar el lote");
                    if (bio && !recep) rowErrors.push("falta la fecha de recepción");
                    if (cant === "") {
                        rowErrors.push("falta ingresar la cantidad");
                    } else if (Number(cant) < 0) {
                        rowErrors.push("la cantidad no puede ser negativa");
                    } else if (Number(cant) === 0) {
                        rowErrors.push("no puedes guardar lotes en ceros, si se terminó elimina la fila");
                    } else if (bio) {
                        const allowedDecimals = ["TD", "COVID-19", "INFLUENZA", "DPT", "HEPATITIS B"];
                        const hasDecimal = Number(cant) % 1 !== 0;
                        if (hasDecimal && !allowedDecimals.includes(bio)) {
                            rowErrors.push(`la vacuna ${bio} no admite decimales`);
                        }
                    }

                    if (lote && loteSelect) {
                        const selectedOpt = loteSelect.selectedOptions[0];
                        const cad = selectedOpt?.dataset?.cad;
                        if (cad) {
                            let cadDate = new Date(cad + "T23:59:59");
                            if (cadDate < new Date()) {
                                rowErrors.push(`el lote ${lote} está caducado (${formatToMmmAa(cad)})`);
                            }
                        }
                    }

                    if (rowErrors.length > 0) {
                        hasInvalid = true;
                        errors.push(`Tarjeta ${index + 1}: ${rowErrors.join(", ")}`);
                    } else {
                        const matchedBio = biologicosCatalogo.find(b => 
                            String(b.biologico).trim().toUpperCase() === String(bio).trim().toUpperCase()
                        );
                        if (matchedBio) {
                            items.push({
                                id: matchedBio.id,
                                cantidad: Number(cant),
                                lote,
                                recepcion: recep
                            });
                        }
                    }
                });

                if (hasInvalid) {
                    errors.forEach(err => showToast(err, "error"));
                    throw new Error("Validaciones fallidas");
                }

                if (!items.length && !sinMovimiento) {
                    showToast("Captura al menos un biológico", "error");
                    throw new Error("Sin items");
                }

                let biologicos = {};
                items.forEach(item => {
                    biologicos[item.id] = {
                        lote: item.lote,
                        cantidad: item.cantidad,
                        recepcion: item.recepcion
                    };
                });
                dataObject.biologicos = biologicos;

            } else if (activePanel === 'CONS') {
                tableName = "consumibles";
                isAlreadySaved = hasTodayCONS;
                const nombreCONS = document.getElementById('nombreCONS')?.value.trim() || "";
                if (!nombreCONS) {
                    showToast("Ingresa el nombre del responsable", "error");
                    throw new Error("Nombre requerido");
                }
                dataObject.nombre_captura = nombreCONS;

                const chkSinMov = document.getElementById('chkSinMovimientoCONS');
                dataObject.sin_movimiento = (chkSinMov && chkSinMov.checked) ? "SI" : "NO";

                const srpVal = document.getElementById('srp_dosis')?.value;
                const srVal = document.getElementById('sr_dosis')?.value;
                const j05Val = document.getElementById('jeringa_aplic_05ml_0605502657')?.value;
                const j50Val = document.getElementById('jeringa_reconst_5ml_0605500438')?.value;

                if (srpVal === "" || srVal === "" || j05Val === "" || j50Val === "") {
                    showToast("Completa todos los campos obligatorios", "error");
                    throw new Error("Campos incompletos");
                }

                const srp = parseInt(srpVal) || 0;
                const sr = parseInt(srVal) || 0;
                const j05 = parseInt(j05Val) || 0;
                const j50 = parseInt(j50Val) || 0;

                if (srp < 0 || sr < 0 || j05 < 0 || j50 < 0) {
                    showToast("Las cantidades no pueden ser negativas", "error");
                    throw new Error("Valores negativos");
                }

                dataObject.srp_dosis = srp;
                dataObject.sr_dosis = sr;
                dataObject.jeringa_aplic_05ml_0605502657 = j05;
                dataObject.jeringa_reconst_5ml_0605500438 = j50;
                dataObject.fecha = new Date().toISOString().split('T')[0];

            } else if (activePanel === 'BIO') {
                tableName = "biologicos_pedido";
                isAlreadySaved = hasTodayBIO;
                const nombreBIO = document.getElementById('nombreBIO')?.value.trim() || "";
                if (!nombreBIO) {
                    showToast("Ingresa el nombre del responsable", "error");
                    throw new Error("Nombre requerido");
                }

                // Delete existing first to avoid duplicate keys (desktop parity)
                await supabaseClient.from('biologicos_pedido').delete().eq('clues', cluesFilter).eq('fecha_pedido_programada', targetPedidoDate);

                let records = [];
                let hasError = false;

                document.querySelectorAll('#bioCardsContainer input').forEach(el => {
                    const bioId = el.dataset.bioId;
                    const field = el.dataset.field;
                    const bioName = el.dataset.bioName || "Biológico";
                    const val = parseInt(el.value) || 0;

                    if (bioId && field) {
                        if (val < 0) {
                            showToast(`La cantidad para ${bioName} no puede ser negativa`, "error");
                            hasError = true;
                            return;
                        }
                        const bioKey = String(bioName).trim().toUpperCase();
                        const requires5 = ["BCG", "HEXAVALENTE", "ROTAVIRUS", "NEUMOCOCICA 13", "NEUMOCOCICA 20", "SRP"].includes(bioKey);
                        if (field === 'pedido' && requires5 && val % 5 !== 0) {
                            showToast(`El pedido para ${bioName} debe ser múltiplo de 5 (se ingresó ${val})`, "error");
                            hasError = true;
                            return;
                        }
                        
                        let rec = records.find(r => r.biologico === bioName);
                        if (!rec) {
                            rec = {
                                id: btoa(cluesFilter + ":" + bioName + ":" + Date.now()),
                                timestamp: new Date().toISOString(),
                                fecha_captura: new Date().toISOString().split('T')[0],
                                fecha_pedido_programada: targetPedidoDate,
                                municipio: muniFilter,
                                clues: cluesFilter,
                                biologico: bioName,
                                capturado_por: nombreBIO.toUpperCase(),
                                tipo_pedido: "MENSUAL",
                                sin_pedido: document.getElementById('chkNoPedido').checked,
                                existencia_actual_frascos: 0,
                                pedido_frascos: 0
                            };
                            records.push(rec);
                        }
                        if (field === 'existencia') {
                            rec.existencia_actual_frascos = val;
                        } else if (field === 'pedido') {
                            rec.pedido_frascos = val;
                        }
                    }
                });

                if (hasError) throw new Error("Validación de pedido fallida");

                // Enforce stock vs average monthly rules (BIO lock)
                let warningMsgs = [];
                const sinPedido = document.getElementById('chkNoPedido').checked;
                records.forEach(rec => {
                    const matchedBio = biologicosCatalogo.find(b => 
                        String(b.biologico).trim().toUpperCase() === String(rec.biologico).trim().toUpperCase()
                    );
                    const promedioVal = matchedBio ? (matchedBio.promedio_frascos || 0) : 0;
                    const totalVal = rec.existencia_actual_frascos + rec.pedido_frascos;
                    const normKey = String(rec.biologico).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                    const isExento = ["VPH", "INFLUENZA", "COVID-19", "COVID 19", "VARICELA", "HEPATITIS A"].includes(normKey);
                    
                    if (promedioVal > 0 && totalVal < promedioVal && !isExento) {
                        warningMsgs.push(`${rec.biologico} (Promedio: ${promedioVal}, Ingresado: ${totalVal})`);
                    }
                });

                if (warningMsgs.length > 0) {
                    showToast("🚫 Ajuste de cantidades requerido: " + warningMsgs.join(", "), "error");
                    throw new Error("Existencia + Pedido es menor al promedio mensual");
                }
                
                const { error } = await supabaseClient.from('biologicos_pedido').insert(records);
                if (error) throw error;

                // Mark as successfully processed and exit saveReport insert block early since it's already done
                showToast("Pedido guardado con éxito");
                hasTodayBIO = true;
                isEditingBIO = false;
                syncCommandHub();
                return;

            } else if (activePanel === 'PINOL') {
                if (hasActivePinol) {
                    showToast("Ya tienes una solicitud de Pinol activa.", "error");
                    throw new Error("Múltiples pedidos de Pinol no permitidos");
                }
                tableName = "pinol_solicitudes";
                const nombrePINOL = document.getElementById('nombrePINOL')?.value.trim() || "";
                if (!nombrePINOL) {
                    showToast("Ingresa el nombre de quien solicita", "error");
                    throw new Error("Nombre requerido");
                }
                const solicitud = parseInt(document.getElementById('pinol_solicitud').value) || 0;
                if (isNaN(solicitud) || solicitud < 1) {
                    showToast("La solicitud debe ser de al menos 1 botella", "error");
                    throw new Error("Cantidad de solicitud inválida");
                }
                dataObject.nombre_solicita = nombrePINOL.toUpperCase();
                dataObject.existencia = parseInt(document.getElementById('pinol_existencia').value) || 0;
                dataObject.solicitud = solicitud;
                dataObject.observaciones = document.getElementById('pinol_observaciones').value.trim();
                dataObject.estatus = "PENDIENTE";
            }

            // Save or update using upsert/insert
            const { error } = await supabaseClient
                .from(tableName)
                .upsert([dataObject]);

            if (error) throw error;

            showToast("Reporte guardado con éxito");
            
            // Update states and trigger Command Hub Sync
            if (activePanel === 'SR') {
                hasTodaySR = true;
                isEditingSR = false;
            } else if (activePanel === 'CONS') {
                hasTodayCONS = true;
                isEditingCONS = false;
            } else if (activePanel === 'BIO') {
                hasTodayBIO = true;
                isEditingBIO = false;
            } else if (activePanel === 'PINOL') {
                hasActivePinol = true;
            }

            syncCommandHub();

        } catch (err) {
            console.error(err);
            if (err.message !== "Nombre requerido" && err.message !== "Validaciones fallidas" && err.message !== "Sin items" && err.message !== "Campos incompletos" && err.message !== "Valores negativos" && err.message !== "Validación de pedido fallida") {
                showToast("Error al guardar reporte.", "error");
            }
            syncCommandHub();
        } finally {
            btn.disabled = false;
        }
    };

    // --- Event Listeners Setup ---
    const setupEventListeners = () => {
        document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const pass = document.getElementById('loginPassword').value;
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
            if (error) showToast(error.message, "error");
            else handleAuthSuccess(data.user);
        });

        document.getElementById('btnBiometricLogin')?.addEventListener('click', handleBiometricLogin);
        document.getElementById('chkBiometria')?.addEventListener('change', (e) => handleRegisterBiometrics(e.target.checked));

        document.getElementById('btnThemeToggleProfile')?.addEventListener('click', toggleTheme);
        document.getElementById('btnLogout')?.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            location.reload();
        });

        document.getElementById('btnAddSRCard')?.addEventListener('click', () => {
            addSRCard();
            showToast("Nuevo registro añadido.");
        });

        const setupModalToggle = (btnId, modalId) => {
            const btn = document.getElementById(btnId);
            const overlay = document.getElementById(modalId);
            const card = overlay?.querySelector('.dropdown-card');

            btn?.addEventListener('click', (e) => {
                e.stopPropagation();
                ['profileDropdown', 'topNotifDropdown', 'archivosDropdown', 'bcgAperturaOverlay', 'bcgDirectorioOverlay'].forEach(id => {
                    if (id !== modalId) document.getElementById(id)?.classList.add('hidden');
                });
                overlay.classList.toggle('hidden');
            });
            card?.addEventListener('click', (e) => e.stopPropagation());
            overlay?.addEventListener('click', () => overlay.classList.add('hidden'));
        };

        setupModalToggle('btnProfileToggle', 'profileDropdown');
        setupModalToggle('btnNotifToggle', 'topNotifDropdown');
        setupModalToggle('btnFilesToggle', 'archivosDropdown');

        // BCG Modals Setup
        document.getElementById('btnSetBCGMobile')?.addEventListener('click', openBCGApertura);
        document.getElementById('btnDirectorioBCGMobile')?.addEventListener('click', openBCGDirectorio);
        
        document.getElementById('bcgAperturaOverlay')?.addEventListener('click', (e) => {
            if (e.target.id === 'bcgAperturaOverlay') e.target.classList.add('hidden');
        });
        document.getElementById('bcgDirectorioOverlay')?.addEventListener('click', (e) => {
            if (e.target.id === 'bcgDirectorioOverlay') e.target.classList.add('hidden');
        });

        document.getElementById('btnCancelBCGApertura')?.addEventListener('click', () => {
            document.getElementById('bcgAperturaOverlay').classList.add('hidden');
        });
        document.getElementById('btnSaveBCGApertura')?.addEventListener('click', saveBCGApertura);
        document.getElementById('btnCancelBCGDir')?.addEventListener('click', () => {
            document.getElementById('bcgDirectorioOverlay').classList.add('hidden');
        });

        document.getElementById('bcgDirSearchInput')?.addEventListener('input', renderBCGDirectorioList);
        document.getElementById('bcgDirMuniSelect')?.addEventListener('change', renderBCGDirectorioList);
        document.getElementById('bcgDirDaySelect')?.addEventListener('change', renderBCGDirectorioList);

        document.querySelectorAll('.profile-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.profile-tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.profile-tab-content').forEach(c => c.classList.add('hidden'));
                btn.classList.add('active');
                document.getElementById(`profileTab_${btn.dataset.tab}`)?.classList.remove('hidden');
            });
        });

        document.getElementById('chkSinMovimientoSR')?.addEventListener('change', (e) => {
            const disabled = e.target.checked;
            document.querySelectorAll('#srCardsContainer select, #srCardsContainer input, #srCardsContainer button, #btnAddSRCard').forEach(el => {
                if (el.id === 'chkSinMovimientoSR') return;
                el.disabled = disabled;
                el.style.opacity = disabled ? "0.55" : "";
                el.style.pointerEvents = disabled ? "none" : "";
                if (disabled && el.type === 'number') el.value = 0;
            });
            if (disabled) showToast("Biológicos marcados Sin Movimiento.");
        });

        document.getElementById('chkSinMovimientoCONS')?.addEventListener('change', (e) => {
            const disabled = e.target.checked;
            document.querySelectorAll('#panelCONS input, #panelCONS textarea, #panelCONS select').forEach(el => {
                if (el.id !== 'chkSinMovimientoCONS' && el.id !== 'nombreCONS') {
                    el.disabled = disabled;
                    el.style.opacity = disabled ? "0.55" : "";
                    el.style.pointerEvents = disabled ? "none" : "";
                    if (disabled && el.type === 'number') el.value = 0;
                }
            });
            if (disabled) showToast("Consumibles marcados Sin Movimiento.");
        });

        document.getElementById('chkNoPedido')?.addEventListener('change', (e) => {
            const disabled = e.target.checked;
            document.querySelectorAll('.bio-ped-input').forEach(el => {
                el.disabled = disabled;
                el.style.opacity = disabled ? "0.55" : "";
                el.style.pointerEvents = disabled ? "none" : "";
                if (disabled) {
                    el.value = 0;
                    el.dispatchEvent(new Event('input'));
                }
            });
            if (disabled) showToast("Solo existencias activo.");
        });

        document.addEventListener('click', () => {
            document.getElementById('profileDropdown')?.classList.add('hidden');
            document.getElementById('topNotifDropdown')?.classList.add('hidden');
            document.getElementById('archivosDropdown')?.classList.add('hidden');
        });

        document.getElementById('mobileCaptureDock')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.dock-item');
            if (btn && !isDraggingDock) {
                switchPanel(btn.dataset.panel);
            }
        });

        let touchStartX = 0;
        let touchEndX = 0;
        const mainArea = document.getElementById('captureContentArea');
        mainArea?.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        mainArea?.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            const diffX = touchStartX - touchEndX;
            const panels = ['SR', 'CONS', 'BIO', 'PINOL'];
            const curIdx = panels.indexOf(activePanel);
            if (Math.abs(diffX) > 80 && !isDraggingDock) {
                if (diffX > 0 && curIdx < panels.length - 1) switchPanel(panels[curIdx + 1]);
                else if (diffX < 0 && curIdx > 0) switchPanel(panels[curIdx - 1]);
            }
        }, { passive: true });

        const syncNeedles = () => {
            const srp = parseInt(document.getElementById('srp_dosis')?.value) || 0;
            const sr = parseInt(document.getElementById('sr_dosis')?.value) || 0;
            const agujaInput = document.getElementById('aguja_0600403711');
            if (agujaInput) {
                agujaInput.value = srp + sr;
            }
        };
        document.getElementById('srp_dosis')?.addEventListener('input', syncNeedles);
        document.getElementById('sr_dosis')?.addEventListener('input', syncNeedles);

        document.getElementById('hubEditBtn')?.addEventListener('click', () => {
            if (activePanel === 'SR') isEditingSR = true;
            if (activePanel === 'CONS') isEditingCONS = true;
            if (activePanel === 'BIO') isEditingBIO = true;
            syncCommandHub();
            showToast("Modo edición activado", "success");
        });

        document.getElementById('hubCancelBtn')?.addEventListener('click', async () => {
            if (activePanel === 'SR') {
                isEditingSR = false;
                await prefillPreviousReport();
            } else if (activePanel === 'CONS') {
                isEditingCONS = false;
                // Reload CONS data if any
            } else if (activePanel === 'BIO') {
                isEditingBIO = false;
                // Reload BIO data if any
            }
            syncCommandHub();
            showToast("Edición cancelada", "error");
        });

        document.getElementById('hubSaveBtn')?.addEventListener('click', saveReport);

        // --- Mobile Feedback Event Listeners ---
        const fbBtn = document.getElementById('btnFeedbackMobile');
        const fbOverlay = document.getElementById('feedbackMobileOverlay');
        const fbForm = document.getElementById('feedbackMobileForm');
        const fbUploadArea = document.getElementById('fbMobileUploadArea');
        const fbImagesInput = document.getElementById('fbMobileImagesInput');
        const fbPreviewGrid = document.getElementById('fbMobilePreviewGrid');

        let fbUploadedFiles = [];

        if (fbBtn && fbOverlay) {
            fbBtn.addEventListener('click', () => {
                fbOverlay.classList.remove('hidden');
                fbUploadedFiles = [];
                if (fbPreviewGrid) fbPreviewGrid.innerHTML = '';
                if (fbForm) fbForm.reset();
            });
        }

        if (fbUploadArea && fbImagesInput) {
            fbUploadArea.addEventListener('click', () => {
                fbImagesInput.click();
            });
        }

        const handleFbFiles = (files) => {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (!file.type.startsWith('image/')) continue;
                fbUploadedFiles.push(file);

                const reader = new FileReader();
                reader.onload = (e) => {
                    const idx = fbUploadedFiles.length - 1;
                    const item = document.createElement('div');
                    item.className = 'fb-mobile-preview-item';
                    item.innerHTML = `
                        <img src="${e.target.result}" alt="Preview">
                        <button type="button" class="fb-mobile-preview-remove" data-index="${idx}">✕</button>
                    `;
                    fbPreviewGrid.appendChild(item);
                };
                reader.readAsDataURL(file);
            }
        };

        if (fbImagesInput) {
            fbImagesInput.addEventListener('change', (e) => {
                if (e.target.files) {
                    handleFbFiles(e.target.files);
                    fbImagesInput.value = '';
                }
            });
        }

        if (fbPreviewGrid) {
            fbPreviewGrid.addEventListener('click', (e) => {
                const removeBtn = e.target.closest('.fb-mobile-preview-remove');
                if (removeBtn) {
                    const idx = parseInt(removeBtn.dataset.index);
                    fbUploadedFiles.splice(idx, 1);
                    removeBtn.closest('.fb-mobile-preview-item').remove();
                    // Update indices
                    fbPreviewGrid.querySelectorAll('.fb-mobile-preview-remove').forEach((btn, newIdx) => {
                        btn.dataset.index = newIdx;
                    });
                }
            });
        }

        if (fbOverlay) {
            // Paste screenshot handler
            fbOverlay.addEventListener('paste', (e) => {
                if (fbOverlay.classList.contains('hidden')) return;
                const items = e.clipboardData?.items;
                if (items) {
                    const files = [];
                    for (let i = 0; i < items.length; i++) {
                        if (items[i].type.indexOf('image') !== -1) {
                            const file = items[i].getAsFile();
                            if (file) files.push(file);
                        }
                    }
                    if (files.length > 0) {
                        handleFbFiles(files);
                        showToast("Imagen pegada desde el portapapeles");
                    }
                }
            });
        }

        if (fbForm) {
            fbForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const type = document.getElementById('fbMobileType').value;
                const moduleVal = document.getElementById('fbMobileModule').value;
                const message = document.getElementById('fbMobileMessage').value;
                const submitBtn = document.getElementById('btnSubmitFeedbackMobile');

                const originalBtnText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<span class="material-symbols-rounded animate-spin text-sm">refresh</span> Enviando...';
                submitBtn.disabled = true;

                const userName = currentProfile?.nombre || currentProfile?.usuario || "Usuario Anónimo Móvil";
                const userRole = currentProfile?.rol || "Desconocido";
                const userUnit = currentProfile?.unidad || "N/A";
                const userClues = currentProfile?.clues || "N/A";

                let embedColor = 3447003;
                let typeEmoji = "❓ Pregunta/Duda";
                if (type === "Sugerencia") {
                    embedColor = 16766720;
                    typeEmoji = "💡 Sugerencia (Mobile)";
                } else if (type === "Error") {
                    embedColor = 15158332;
                    typeEmoji = "🚨 Reporte de Error (Mobile)";
                }

                const fields = [
                    { name: "👤 Usuario", value: userName, inline: true },
                    { name: "🔑 Rol", value: userRole, inline: true },
                    { name: "🏥 Unidad", value: userUnit, inline: true },
                    { name: "🏢 CLUES", value: userClues, inline: true },
                    { name: "🛠️ Módulo", value: moduleVal, inline: true }
                ];

                if (type === "Error" && recentErrors.length > 0) {
                    fields.push({
                        name: "💻 Errores Recientes (Consola)",
                        value: "```js\n" + recentErrors.join("\n") + "\n```",
                        inline: false
                    });
                }

                const embed = {
                    title: `${typeEmoji}`,
                    description: `**Mensaje:**\n${message}`,
                    color: embedColor,
                    fields: fields,
                    footer: { text: "SIREVAQ Mobile" },
                    timestamp: new Date().toISOString()
                };

                if (fbUploadedFiles.length > 0) {
                    embed.image = { url: "attachment://image_0.png" };
                }

                const DISCORD_WEBHOOK_URL = atob("aHR0cHM6Ly9kaXNjb3JkLmNvbS9hcGkvd2ViaG9va3MvMTUxNjE5OTgzNTQzNzM3MTU1My8yU19XYW1qck9PcE5ybUdYbHV3QTdTcmRTa3FhZXNiTXY1aXpzWVByQlN4dnJPaDg0LWZIYThHQlFEanNVYWVLc0VIUw==");

                const formData = new FormData();
                formData.append("payload_json", JSON.stringify({ embeds: [embed] }));

                fbUploadedFiles.forEach((file, index) => {
                    const ext = file.name.split('.').pop() || "png";
                    formData.append(`files[${index}]`, file, `image_${index}.${ext}`);
                });

                try {
                    const response = await fetch(DISCORD_WEBHOOK_URL, {
                        method: "POST",
                        body: formData
                    });

                    if (response.ok) {
                        showToast("¡Feedback recibido con éxito!");
                        fbOverlay.classList.add('hidden');
                        fbForm.reset();
                    } else {
                        throw new Error("Discord response not ok");
                    }
                } catch (error) {
                    console.error("Error sending mobile feedback:", error);
                    showToast("No se pudo enviar el reporte. Intenta más tarde.", "error");
                } finally {
                    submitBtn.innerHTML = originalBtnText;
                    submitBtn.disabled = false;
                }
            });
        }
    };

    // --- Animated Particles Background ---
    const initBgCanvas = () => {
        const canvas = document.createElement('canvas');
        canvas.id = 'bgCanvas';
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.zIndex = '-2';
        canvas.style.pointerEvents = 'none';
        canvas.style.opacity = '0.35';
        document.body.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        window.addEventListener('resize', () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        });

        const particles = [];
        const count = 24;

        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                r: Math.random() * 2 + 1
            });
        }

        const animate = () => {
            ctx.clearRect(0, 0, width, height);
            const isDark = document.documentElement.classList.contains('dark');
            ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)';
            ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(15, 23, 42, 0.1)';

            particles.forEach((p, idx) => {
                p.x += p.vx;
                p.y += p.vy;

                if (p.x < 0 || p.x > width) p.vx *= -1;
                if (p.y < 0 || p.y > height) p.vy *= -1;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();

                for (let j = idx + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dx = p.x - p2.x;
                    const dy = p.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 110) {
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();
                    }
                }
            });

            requestAnimationFrame(animate);
        };

        animate();
    };

    // --- Date & Capture Window Calculations ---
    function calculateBioIntelligentWindow(year, month) {
        return getBioCaptureWindow(year, month + 1);
    }

    function checkConsumiblesCaptureWindow() {
        const d = new Date();
        const dow = d.getDay();

        // 4 = Thursday
        if (dow === 4) {
            return true;
        }

        // 3 = Wednesday
        if (dow === 3) {
            const tomorrow = new Date(d);
            tomorrow.setDate(d.getDate() + 1);
            if (isMexicanHoliday(tomorrow)) {
                return true;
            }
        }

        return false;
    }

    function getBioCaptureWindow(year, month) {
        let target = new Date(year, month - 1, 22);
        while (!isBusinessDay(target)) {
            target.setDate(target.getDate() - 1);
        }
        let start = new Date(target);
        start.setDate(start.getDate() - 1);
        while (!isBusinessDay(start)) {
            start.setDate(start.getDate() - 1);
        }
        let end = new Date(target);
        end.setDate(end.getDate() + 1);
        while (!isBusinessDay(end)) {
            end.setDate(end.getDate() + 1);
        }
        return { start, target, end };
    }

    function isBusinessDay(date) {
        const day = date.getDay();
        if (day === 0 || day === 6) return false;
        if (isMexicanHoliday(date)) return false;
        return true;
    }

    function isMexicanHoliday(date) {
        if (typeof dayjs === 'undefined') {
            return false;
        }
        const d = dayjs(date);
        const y = d.year();
        const m = d.month() + 1;
        const dayOfMonth = d.date();
        const dayOfWeek = d.day();

        const fixed = [
            "01-01", // Año nuevo
            "05-01", // Trabajo
            "09-16", // Independencia
            "12-25"  // Navidad
        ];

        const mmdd = `${String(m).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
        if (fixed.includes(mmdd)) return true;

        if (m === 2 && dayOfWeek === 1 && dayOfMonth <= 7) return true;
        if (m === 3 && dayOfWeek === 1 && dayOfMonth >= 15 && dayOfMonth <= 21) return true;
        if (m === 11 && dayOfWeek === 1 && dayOfMonth >= 15 && dayOfMonth <= 21) return true;

        const easter = dayjs(getEasterDate(y));
        const juevesSanto = easter.subtract(3, 'day');
        const viernesSanto = easter.subtract(2, 'day');

        if (d.isSame(juevesSanto, 'day') || d.isSame(viernesSanto, 'day')) {
            return true;
        }
        return false;
    }

    function getEasterDate(year) {
        const a = year % 19;
        const b = Math.floor(year / 100);
        const c = year % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31);
        const day = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(year, month - 1, day);
    }

    function dateToLocalYmd(d) {
        if (!d) return "";
        if (typeof d === "string") return d;
        if (!(d instanceof Date)) return "";
        if (isNaN(d.getTime())) return "";
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initSupabase();
            setupEventListeners();
            initBgCanvas();
        });
    } else {
        initSupabase();
        setupEventListeners();
        initBgCanvas();
    }
})();
