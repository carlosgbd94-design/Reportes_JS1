/**
 * JS1 Reportes - Mobile Exclusive UX Layer
 * Designed & Implemented to provide a native mobile experience on iOS/Android touch devices.
 * Completely decouples the mobile view from desktop rules and structures.
 */

(function () {
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (!isTouch) return;

    // Apply mobile touch identifier
    document.documentElement.classList.add('touch-ui');
    console.log('📱 Exclusive Mobile UI Activated: Decoupled viewport structure.');

    // Inject styles and hide desktop right column
    const styleNode = document.createElement('style');
    styleNode.innerHTML = `
        .touch-ui #rightColumn {
            display: none !important;
        }
        .touch-ui #mobileAppContainer:not(.hidden) {
            display: flex !important;
            flex-direction: column !important;
            gap: 24px;
            padding-bottom: 120px;
        }
    `;
    document.head.appendChild(styleNode);

    // Dynamic state trackers
    let activeTab = 'SR'; // SR, CONS, BIO, PINOL
    let activeUnidadTab = 'CAPTURE'; // CAPTURE, RDA
    let isInitialized = false;

    // ─── UTILITIES & DOM SYNCHRONIZATION ───

    const triggerEvent = (el, type) => {
        if (!el) return;
        const event = document.createEvent('HTMLEvents');
        event.initEvent(type, true, false);
        el.dispatchEvent(event);
    };

    // Keep inputs synchronized from Mobile -> Hidden Desktop
    const syncMobileToDesktop = (mobileInput, desktopInputId) => {
        const desktopInput = document.getElementById(desktopInputId);
        if (!desktopInput) return;

        mobileInput.addEventListener('input', () => {
            desktopInput.value = mobileInput.value;
            triggerEvent(desktopInput, 'input');
        });
        mobileInput.addEventListener('change', () => {
            desktopInput.value = mobileInput.value;
            triggerEvent(desktopInput, 'change');
        });
    };

    // Keep inputs synchronized from Hidden Desktop -> Mobile
    const syncDesktopToMobile = (desktopInputId, mobileInput) => {
        const desktopInput = document.getElementById(desktopInputId);
        if (!desktopInput) return;

        const observer = new MutationObserver(() => {
            if (mobileInput.value !== desktopInput.value) {
                mobileInput.value = desktopInput.value;
            }
        });
        observer.observe(desktopInput, { attributes: true, attributeFilter: ['value'] });

        // Standard event listener for user inputs
        desktopInput.addEventListener('input', () => {
            if (mobileInput.value !== desktopInput.value) {
                mobileInput.value = desktopInput.value;
            }
        });
        desktopInput.addEventListener('change', () => {
            if (mobileInput.value !== desktopInput.value) {
                mobileInput.value = desktopInput.value;
            }
        });

        // Set initial value
        mobileInput.value = desktopInput.value;
    };

    // ─── TEMPLATES AND VIEW RENDERER ───

    const initMobileApp = () => {
        if (isInitialized) return;
        const container = document.getElementById('mobileAppContainer');
        if (!container) return;

        isInitialized = true;

        container.innerHTML = `
            <!-- 👤 WELCOME & compliance PANEL -->
            <div class="mobile-welcome-card animate-fadeIn">
                <div class="mobile-welcome-header">
                    <span class="mobile-eyebrow">Resumen Operativo</span>
                    <h2 id="mobileWelcomeText">Hola...</h2>
                </div>
                
                <!-- Compliance and Achievement Medals -->
                <div class="mobile-compliance-wrap" id="mobileComplianceBox">
                    <div class="mobile-compliance-kpi">
                        <span class="material-symbols-rounded mobile-kpi-icon">leaderboard</span>
                        <div class="mobile-kpi-text">
                            <span class="mobile-kpi-label">Cumplimiento</span>
                            <span class="mobile-kpi-val" id="mobileCompliancePercent">0%</span>
                        </div>
                    </div>
                    <div class="mobile-medals-row" id="mobileMedalsRow"></div>
                </div>

                <!-- Fact Card -->
                <div class="mobile-fact-card" id="mobileFactCardBox">
                    <div class="mobile-fact-icon-bg">
                        <span class="material-symbols-rounded text-primary" id="mobileFactIcon">auto_awesome</span>
                    </div>
                    <div class="mobile-fact-content">
                        <span class="mobile-fact-title" id="mobileFactTitle">Dato de Interés</span>
                        <p class="mobile-fact-body" id="mobileFactBody">Cargando sugerencia operativa...</p>
                    </div>
                </div>
            </div>

            <!-- 🧱 MOBILE TABS BAR (For role: UNIDAD) -->
            <div class="mobile-role-tabs-container" id="mobileUnidadTabs" style="display: none;">
                <button class="mobile-role-tab active" id="mobTabCapture" onclick="window.switchMobileUnidadTab('CAPTURE')">
                    <span class="material-symbols-rounded">edit_note</span>
                    <span>Captura</span>
                </button>
                <button class="mobile-role-tab" id="mobTabRda" onclick="window.switchMobileUnidadTab('RDA')">
                    <span class="material-symbols-rounded">stacked_bar_chart</span>
                    <span>Indicadores</span>
                </button>
            </div>

            <!-- 🧱 FORM CONTAINER -->
            <div id="mobileFormContent" class="mobile-form-content">
                <!-- Capture Forms will render here -->
            </div>

            <!-- 📱 FLOATING COMMAND HUB -->
            <div class="mobile-command-hub" id="mobileCommandHub">
                <div class="mobile-status-chip" id="mobileStatusChip">
                    <span class="material-symbols-rounded">info</span>
                    <span id="mobileStatusLabel">Sin capturar</span>
                </div>
                <div class="mobile-actions-group">
                    <button class="mobile-btn-circle cancel" id="mobileBtnCancel" title="Cancelar cambios">
                        <span class="material-symbols-rounded">close</span>
                    </button>
                    <button class="mobile-btn-circle edit" id="mobileBtnEdit" title="Editar reporte">
                        <span class="material-symbols-rounded">edit</span>
                    </button>
                    <button class="mobile-btn-circle save" id="mobileBtnSave" title="Guardar reporte">
                        <span class="material-symbols-rounded">done</span>
                    </button>
                </div>
            </div>
        `;

        // Initialize event observers and click triggers
        setupWelcomeObservers();
        setupCommandHubTriggers();
        renderActiveForm();
        mountDock();
        syncRoleVisibility();
    };

    // Switch between Capture views and native RDA dashboard in Mobile layout
    window.switchMobileUnidadTab = (tab) => {
        activeUnidadTab = tab;
        document.getElementById('mobTabCapture')?.classList.toggle('active', tab === 'CAPTURE');
        document.getElementById('mobTabRda')?.classList.toggle('active', tab === 'RDA');

        if (tab === 'RDA') {
            document.getElementById('mobileFormContent').style.display = 'none';
            document.getElementById('mobileCommandHub').style.display = 'none';
            document.getElementById('mobileCaptureDock').style.display = 'none';
            
            // Open the native mobile RDA view directly
            const rdaMobile = document.getElementById('rdaMobileDashboard');
            if (rdaMobile) {
                rdaMobile.style.display = 'flex';
                setTimeout(() => rdaMobile.classList.remove('translate-y-full'), 50);
            }
        } else {
            document.getElementById('mobileFormContent').style.display = 'block';
            document.getElementById('mobileCommandHub').style.display = 'flex';
            document.getElementById('mobileCaptureDock').style.display = 'flex';
            
            // Close RDA mobile dashboard if it's open
            window.closeRdaMobile();
        }
    };

    // Override the closing of RDA Mobile to bring back the Capture section nicely
    const originalCloseRdaMobile = window.closeRdaMobile;
    window.closeRdaMobile = function() {
        const rdaMobile = document.getElementById('rdaMobileDashboard');
        if (rdaMobile) {
            rdaMobile.classList.add('translate-y-full');
            setTimeout(() => {
                rdaMobile.style.display = 'none';
                // Switch mobile tabs back to capture
                activeUnidadTab = 'CAPTURE';
                document.getElementById('mobTabCapture')?.classList.add('active');
                document.getElementById('mobTabRda')?.classList.remove('active');
                document.getElementById('mobileFormContent').style.display = 'block';
                document.getElementById('mobileCommandHub').style.display = 'flex';
                document.getElementById('mobileCaptureDock').style.display = 'flex';
            }, 300);
        }
    };

    // ─── WELCOME PANEL AND LOGO SYNC ───

    const setupWelcomeObservers = () => {
        // Sync User Greeting
        const desktopWelcome = document.getElementById('welcome');
        const mobileWelcome = document.getElementById('mobileWelcomeText');
        if (desktopWelcome && mobileWelcome) {
            const updateWelcome = () => { mobileWelcome.innerHTML = desktopWelcome.innerHTML; };
            updateWelcome();
            new MutationObserver(updateWelcome).observe(desktopWelcome, { childList: true, characterData: true });
        }

        // Sync Compliance KPI Percent
        const desktopDayTxt = document.getElementById('dayTxt');
        const mobileCompPercent = document.getElementById('mobileCompliancePercent');
        if (desktopDayTxt && mobileCompPercent) {
            const updatePercent = () => { mobileCompPercent.innerText = desktopDayTxt.innerText; };
            updatePercent();
            new MutationObserver(updatePercent).observe(desktopDayTxt, { childList: true });
        }

        // Sync Compliance Medals Row
        const desktopMedals = document.getElementById('bCumplimientoMedals');
        const mobileMedals = document.getElementById('mobileMedalsRow');
        if (desktopMedals && mobileMedals) {
            const updateMedals = () => { mobileMedals.innerHTML = desktopMedals.innerHTML; };
            updateMedals();
            new MutationObserver(updateMedals).observe(desktopMedals, { childList: true });
        }

        // Sync Fact/Insight Cards
        const desktopFactBody = document.getElementById('factBody');
        const desktopFactTitle = document.getElementById('factTitle');
        const desktopFactIcon = document.getElementById('factIcon');
        const mobileFactBody = document.getElementById('mobileFactBody');
        const mobileFactTitle = document.getElementById('mobileFactTitle');
        const mobileFactIcon = document.getElementById('mobileFactIcon');

        if (desktopFactBody && mobileFactBody) {
            const updateFact = () => {
                mobileFactBody.innerHTML = desktopFactBody.innerHTML;
                if (desktopFactTitle) mobileFactTitle.innerText = desktopFactTitle.innerText;
                if (desktopFactIcon) mobileFactIcon.innerText = desktopFactIcon.innerText;
            };
            updateFact();
            new MutationObserver(updateFact).observe(desktopFactBody, { childList: true });
        }
    };

    const syncRoleVisibility = () => {
        const desktopRole = document.getElementById('rolTxt')?.innerText || '';
        const hasUnidadOps = desktopRole.includes('UNIDAD') || document.querySelector('[data-role-gate="UNIDAD"]');
        
        const tabsBar = document.getElementById('mobileUnidadTabs');
        if (tabsBar) {
            tabsBar.style.display = hasUnidadOps ? 'flex' : 'none';
        }
    };

    // ─── COMMAND HUB TRIGGERS ───

    const setupCommandHubTriggers = () => {
        const btnSave = document.getElementById('mobileBtnSave');
        const btnEdit = document.getElementById('mobileBtnEdit');
        const btnCancel = document.getElementById('mobileBtnCancel');
        const statusLabel = document.getElementById('mobileStatusLabel');

        const getDesktopButtons = () => {
            return {
                save: document.getElementById('btnSave' + activeTab),
                edit: document.getElementById('btnEdit' + activeTab),
                cancel: document.getElementById('btnCancelEdit' + activeTab)
            };
        };

        // Command Click forwards to hidden desktop buttons
        btnSave?.addEventListener('click', () => getDesktopButtons().save?.click());
        btnEdit?.addEventListener('click', () => getDesktopButtons().edit?.click());
        btnCancel?.addEventListener('click', () => getDesktopButtons().cancel?.click());

        // Observe and mirror the state box updates (Guardado, Editando, etc.)
        const desktopStateText = document.getElementById('captureStateText');
        const desktopStateBox = document.getElementById('captureStateBox');

        const updateStatus = () => {
            const text = desktopStateText?.innerText || 'Sin capturar';
            const isVisible = desktopStateBox && !desktopStateBox.classList.contains('hidden') && desktopStateBox.style.display !== 'none';
            
            if (statusLabel) {
                statusLabel.innerText = text;
            }

            // Sync visual states on Mobile buttons
            if (text.includes('Editando') || text.includes('Capturando')) {
                btnSave.style.display = 'flex';
                btnCancel.style.display = 'flex';
                btnEdit.style.display = 'none';
                document.getElementById('mobileCommandHub')?.classList.add('editing');
            } else if (text.includes('Guardado') || text.includes('Completo')) {
                btnSave.style.display = 'none';
                btnCancel.style.display = 'none';
                btnEdit.style.display = 'flex';
                document.getElementById('mobileCommandHub')?.classList.remove('editing');
            } else {
                btnSave.style.display = 'flex';
                btnCancel.style.display = 'none';
                btnEdit.style.display = 'none';
                document.getElementById('mobileCommandHub')?.classList.remove('editing');
            }
        };

        if (desktopStateText) {
            updateStatus();
            new MutationObserver(updateStatus).observe(desktopStateText, { childList: true, characterData: true });
        }
    };

    // ─── FORM RENDERERS ───

    const renderActiveForm = () => {
        const content = document.getElementById('mobileFormContent');
        if (!content) return;

        content.innerHTML = '';

        if (activeTab === 'SR') {
            renderBiológicosForm(content);
        } else if (activeTab === 'CONS') {
            renderConsumiblesForm(content);
        } else if (activeTab === 'BIO') {
            renderPedidoForm(content);
        } else if (activeTab === 'PINOL') {
            renderPinolForm(content);
        }
    };

    // Form 1: Biológicos (SR) - Dynamic cards synced with hidden table
    const renderBiológicosForm = (container) => {
        container.innerHTML = `
            <div class="mobile-section-header">
                <span class="mobile-section-emoji">📦</span>
                <div>
                    <h3>Existencia de Biológicos (SR)</h3>
                    <p>Semanal - Captura habilitada Jueves y Viernes</p>
                </div>
            </div>

            <!-- Responsable Input -->
            <div class="mobile-input-card">
                <label class="mobile-field-label">Responsable de Existencias</label>
                <div class="mobile-input-wrapper">
                    <span class="material-symbols-rounded mobile-input-icon">person</span>
                    <input type="text" id="mobNombreSR" placeholder="Nombre completo" class="mobile-text-input">
                </div>
            </div>

            <!-- Dynamic Batch Cards Container -->
            <div id="mobBiológicosCards" class="mobile-cards-list"></div>

            <!-- Add Row Button -->
            <button class="mobile-btn-primary" id="mobBtnAddSR">
                <span class="material-symbols-rounded">add_circle</span>
                <span>Agregar lote/biológico</span>
            </button>
        `;

        // Sync Responsable
        syncDesktopToMobile('nombreSR', document.getElementById('mobNombreSR'));
        syncMobileToDesktop(document.getElementById('mobNombreSR'), 'nombreSR');

        // Add Row trigger
        document.getElementById('mobBtnAddSR')?.addEventListener('click', () => {
            document.getElementById('btnAddSRRow')?.click();
        });

        // Setup MutationObserver on hidden table body to sync rows in real time
        const hiddenTbody = document.getElementById('srCaptureTbody');
        const cardsContainer = document.getElementById('mobBiológicosCards');

        const syncCards = () => {
            if (!cardsContainer || !hiddenTbody) return;
            cardsContainer.innerHTML = '';

            const rows = hiddenTbody.querySelectorAll('tr');
            if (rows.length === 0) {
                cardsContainer.innerHTML = `<div class="mobile-empty-cards">No hay lotes agregados.</div>`;
                return;
            }

            rows.forEach((tr, index) => {
                const card = document.createElement('div');
                card.className = 'mobile-batch-card animate-slideIn';

                const bioSelect = tr.querySelector('.sr-bio-select');
                const loteSelect = tr.querySelector('.sr-lote-select');
                const cadCell = tr.querySelector('.sr-cad-cell');
                const recepInput = tr.querySelector('.sr-recepcion-input');
                const cantInput = tr.querySelector('.sr-cantidad-input');
                const btnClone = tr.querySelector('.md-clone-btn');
                const btnDelete = tr.querySelector('.md-delete-btn');

                const cardId = `mob_sr_card_${index}`;

                card.innerHTML = `
                    <div class="mobile-card-header">
                        <span class="mobile-card-title-val">Lote #${index + 1}</span>
                        <div class="mobile-card-actions">
                            <button class="mobile-action-btn-mini clone" id="${cardId}_clone" title="Duplicar">
                                <span class="material-symbols-rounded">post_add</span>
                            </button>
                            <button class="mobile-action-btn-mini delete" id="${cardId}_delete" title="Eliminar">
                                <span class="material-symbols-rounded">delete</span>
                            </button>
                        </div>
                    </div>

                    <div class="mobile-card-body">
                        <!-- Biológico Dropdown -->
                        <div class="mobile-form-field">
                            <label>Biológico</label>
                            <select id="${cardId}_bio" class="mobile-select-element">
                                ${bioSelect ? bioSelect.innerHTML : ''}
                            </select>
                        </div>

                        <!-- Lote Dropdown -->
                        <div class="mobile-form-field">
                            <label>Lote</label>
                            <select id="${cardId}_lote" class="mobile-select-element">
                                ${loteSelect ? loteSelect.innerHTML : ''}
                            </select>
                        </div>

                        <!-- Caducidad & Info -->
                        <div class="mobile-field-row">
                            <div class="mobile-form-field flex-1">
                                <label>Caducidad</label>
                                <span class="mobile-badge-label info" id="${cardId}_cad">${cadCell ? cadCell.innerText : '—'}</span>
                            </div>
                        </div>

                        <!-- Fecha Recepción -->
                        <div class="mobile-form-field">
                            <label>Fecha de Recepción</label>
                            <input type="date" id="${cardId}_recep" class="mobile-date-element" value="${recepInput ? recepInput.value : ''}">
                        </div>

                        <!-- Cantidad (Frascos) -->
                        <div class="mobile-form-field">
                            <label>Cantidad (Frascos)</label>
                            <div class="mobile-counter-wrapper">
                                <button class="counter-btn dec" id="${cardId}_dec">-</button>
                                <input type="number" id="${cardId}_cant" class="mobile-number-input text-center" min="0" placeholder="0" value="${cantInput ? cantInput.value : ''}">
                                <button class="counter-btn inc" id="${cardId}_inc">+</button>
                            </div>
                        </div>
                    </div>
                `;

                cardsContainer.appendChild(card);

                // Bind select option and values dynamically
                const mobBio = document.getElementById(`${cardId}_bio`);
                const mobLote = document.getElementById(`${cardId}_lote`);
                const mobRecep = document.getElementById(`${cardId}_recep`);
                const mobCant = document.getElementById(`${cardId}_cant`);

                if (bioSelect && mobBio) {
                    mobBio.value = bioSelect.value;
                    mobBio.addEventListener('change', () => {
                        bioSelect.value = mobBio.value;
                        triggerEvent(bioSelect, 'change');
                        // Lote select values rebuild on change, sync it back
                        setTimeout(() => {
                            if (loteSelect && mobLote) mobLote.innerHTML = loteSelect.innerHTML;
                        }, 100);
                    });
                }

                if (loteSelect && mobLote) {
                    mobLote.value = loteSelect.value;
                    mobLote.addEventListener('change', () => {
                        loteSelect.value = mobLote.value;
                        triggerEvent(loteSelect, 'change');
                    });
                }

                if (recepInput && mobRecep) {
                    mobRecep.addEventListener('input', () => {
                        recepInput.value = mobRecep.value;
                        triggerEvent(recepInput, 'input');
                    });
                }

                // Expiration cell text observer
                if (cadCell) {
                    new MutationObserver(() => {
                        const cell = document.getElementById(`${cardId}_cad`);
                        if (cell) cell.innerText = cadCell.innerText;
                    }).observe(cadCell, { childList: true, characterData: true });
                }

                // Quantity counter with inc/dec bounds
                if (cantInput && mobCant) {
                    mobCant.addEventListener('input', () => {
                        cantInput.value = mobCant.value;
                        triggerEvent(cantInput, 'input');
                    });

                    document.getElementById(`${cardId}_dec`)?.addEventListener('click', () => {
                        const val = Math.max(0, parseInt(mobCant.value || 0) - 1);
                        mobCant.value = val;
                        cantInput.value = val;
                        triggerEvent(cantInput, 'input');
                    });

                    document.getElementById(`${cardId}_inc`)?.addEventListener('click', () => {
                        const val = parseInt(mobCant.value || 0) + 1;
                        mobCant.value = val;
                        cantInput.value = val;
                        triggerEvent(cantInput, 'input');
                    });
                }

                // Actions forwards
                document.getElementById(`${cardId}_clone`)?.addEventListener('click', () => btnClone?.click());
                document.getElementById(`${cardId}_delete`)?.addEventListener('click', () => btnDelete?.click());
            });
        };

        if (hiddenTbody) {
            syncCards();
            new MutationObserver(syncCards).observe(hiddenTbody, { childList: true, subtree: true });
        }
    };

    // Form 2: Consumibles (Jeringas) - Touch-optimized with counter adjustments
    const renderConsumiblesForm = (container) => {
        container.innerHTML = `
            <div class="mobile-section-header">
                <span class="mobile-section-emoji">💉</span>
                <div>
                    <h3>Control de Insumos y Consumibles</h3>
                    <p>Reporte semanal obligatorio de jeringas</p>
                </div>
            </div>

            <!-- Responsable -->
            <div class="mobile-input-card">
                <label class="mobile-field-label">Responsable de Captura</label>
                <div class="mobile-input-wrapper">
                    <span class="material-symbols-rounded mobile-input-icon">person</span>
                    <input type="text" id="mobNombreCONS" placeholder="Nombre completo" class="mobile-text-input">
                </div>
            </div>

            <!-- Quantity Grid Cards -->
            <div class="mobile-input-grid">
                <div class="mobile-quantity-card">
                    <span class="qty-card-label">SRP (Dosis)</span>
                    <div class="mobile-counter-wrapper large">
                        <button class="counter-btn dec" id="dec_srp_dosis">-</button>
                        <input type="number" id="mob_srp_dosis" class="mobile-number-input text-center" min="0" placeholder="0">
                        <button class="counter-btn inc" id="inc_srp_dosis">+</button>
                    </div>
                </div>

                <div class="mobile-quantity-card">
                    <span class="qty-card-label">SR (Dosis)</span>
                    <div class="mobile-counter-wrapper large">
                        <button class="counter-btn dec" id="dec_sr_dosis">-</button>
                        <input type="number" id="mob_sr_dosis" class="mobile-number-input text-center" min="0" placeholder="0">
                        <button class="counter-btn inc" id="inc_sr_dosis">+</button>
                    </div>
                </div>

                <div class="mobile-quantity-card">
                    <span class="qty-card-label">Jeringa 0.5 mL</span>
                    <div class="mobile-counter-wrapper large">
                        <button class="counter-btn dec" id="dec_jer_05">-</button>
                        <input type="number" id="mob_jeringa_05" class="mobile-number-input text-center" min="0" placeholder="0">
                        <button class="counter-btn inc" id="inc_jer_05">+</button>
                    </div>
                </div>

                <div class="mobile-quantity-card">
                    <span class="qty-card-label">Jeringa 5.0 mL</span>
                    <div class="mobile-counter-wrapper large">
                        <button class="counter-btn dec" id="dec_jer_50">-</button>
                        <input type="number" id="mob_jeringa_50" class="mobile-number-input text-center" min="0" placeholder="0">
                        <button class="counter-btn inc" id="inc_jer_50">+</button>
                    </div>
                </div>
            </div>

            <!-- Computed Aguja Indicator -->
            <div class="mobile-calc-card">
                <span class="calc-label">Agujas Asignadas (Autocalculado)</span>
                <span class="calc-val" id="mob_aguja_val">—</span>
            </div>
        `;

        // Sync text inputs
        syncDesktopToMobile('nombreCONS', document.getElementById('mobNombreCONS'));
        syncMobileToDesktop(document.getElementById('mobNombreCONS'), 'nombreCONS');

        // Sync values and binds for number fields
        const binds = [
            { mob: 'mob_srp_dosis', desk: 'srp_dosis', dec: 'dec_srp_dosis', inc: 'inc_srp_dosis' },
            { mob: 'mob_sr_dosis', desk: 'sr_dosis', dec: 'dec_sr_dosis', inc: 'inc_sr_dosis' },
            { mob: 'mob_jeringa_05', desk: 'jeringa_aplic_05ml_0605502657', dec: 'dec_jer_05', inc: 'inc_jer_05' },
            { mob: 'mob_jeringa_50', desk: 'jeringa_reconst_5ml_0605500438', dec: 'dec_jer_50', inc: 'inc_jer_50' }
        ];

        binds.forEach(b => {
            const mobInput = document.getElementById(b.mob);
            syncDesktopToMobile(b.desk, mobInput);
            syncMobileToDesktop(mobInput, b.desk);

            document.getElementById(b.dec)?.addEventListener('click', () => {
                const val = Math.max(0, parseInt(mobInput.value || 0) - 1);
                mobInput.value = val;
                const desktop = document.getElementById(b.desk);
                if (desktop) { desktop.value = val; triggerEvent(desktop, 'input'); }
            });

            document.getElementById(b.inc)?.addEventListener('click', () => {
                const val = parseInt(mobInput.value || 0) + 1;
                mobInput.value = val;
                const desktop = document.getElementById(b.desk);
                if (desktop) { desktop.value = val; triggerEvent(desktop, 'input'); }
            });
        });

        // Sync computed needles
        const desktopAguja = document.getElementById('aguja_0600403711');
        const mobAguja = document.getElementById('mob_aguja_val');
        if (desktopAguja && mobAguja) {
            const updateAguja = () => { mobAguja.innerText = desktopAguja.value || '—'; };
            updateAguja();
            new MutationObserver(updateAguja).observe(desktopAguja, { attributes: true, attributeFilter: ['value'] });
            desktopAguja.addEventListener('change', updateAguja);
            desktopAguja.addEventListener('input', updateAguja);
        }
    };

    // Form 3: Pedido Mensual - Fully optimized list layout
    const renderPedidoForm = (container) => {
        container.innerHTML = `
            <div class="mobile-section-header">
                <span class="mobile-section-emoji">📋</span>
                <div>
                    <h3>Pedido Mensual de Biológicos</h3>
                    <p>Ficha logística y solicitud mensual</p>
                </div>
            </div>

            <!-- Info and date banner -->
            <div class="mobile-info-banner">
                <span class="material-symbols-rounded">event_upcoming</span>
                <div>
                    <strong id="mobFechaPedidoVal">—</strong>
                    <span id="mobBioHintVal">—</span>
                </div>
            </div>

            <div class="mobile-input-card">
                <label class="mobile-field-label">Nombre del Responsable del Pedido</label>
                <div class="mobile-input-wrapper">
                    <span class="material-symbols-rounded mobile-input-icon">person</span>
                    <input type="text" id="mobNombreBIO" placeholder="Nombre completo" class="mobile-text-input">
                </div>
            </div>

            <!-- Single existencias checkbox -->
            <div class="mobile-checkbox-card">
                <div class="checkbox-text">
                    <strong>Solo Existencias</strong>
                    <p>Activa si no requieres hacer pedido este mes</p>
                </div>
                <label class="mobile-toggle-switch">
                    <input type="checkbox" id="mobChkNoPedido">
                    <div class="toggle-slider"></div>
                </label>
            </div>

            <!-- Dynamic Vaccine Cards list -->
            <div id="mobPedidoList" class="mobile-cards-list"></div>
        `;

        // Sync basic elements
        syncDesktopToMobile('nombreBIO', document.getElementById('mobNombreBIO'));
        syncMobileToDesktop(document.getElementById('mobNombreBIO'), 'nombreBIO');

        // Sync Logistics text
        const desktopDateBox = document.getElementById('fechaPedidoBIOBox');
        const mobDateVal = document.getElementById('mobFechaPedidoVal');
        if (desktopDateBox && mobDateVal) {
            mobDateVal.innerText = desktopDateBox.innerText;
        }

        const desktopHint = document.getElementById('bioHint');
        const mobHintVal = document.getElementById('mobBioHintVal');
        if (desktopHint && mobHintVal) {
            mobHintVal.innerText = desktopHint.innerText;
        }

        // Sync Checkbox
        const desktopChk = document.getElementById('chkNoPedido');
        const mobChk = document.getElementById('mobChkNoPedido');
        if (desktopChk && mobChk) {
            mobChk.checked = desktopChk.checked;
            mobChk.addEventListener('change', () => {
                desktopChk.checked = mobChk.checked;
                triggerEvent(desktopChk, 'change');
            });
            desktopChk.addEventListener('change', () => {
                mobChk.checked = desktopChk.checked;
            });
        }

        // Sync Vaccine Cards List
        const hiddenBioList = document.getElementById('bioTbody');
        const mobPedidoList = document.getElementById('mobPedidoList');

        const syncPedidoCards = () => {
            if (!mobPedidoList || !hiddenBioList) return;
            mobPedidoList.innerHTML = '';

            const rows = hiddenBioList.querySelectorAll('.bio-card-item, tr');
            if (rows.length === 0 || hiddenBioList.innerText.includes('Cargando')) {
                mobPedidoList.innerHTML = `<div class="mobile-empty-cards">Cargando biológicos...</div>`;
                return;
            }

            rows.forEach((row, index) => {
                // Read row data dynamically
                const nameEl = row.querySelector('.bioNameCell, td:first-child');
                const existInput = row.querySelector('.bioInput[id^="exist_"], td:nth-child(2) input');
                const pedInput = row.querySelector('.bioInput[id^="ped_"], td:nth-child(3) input');
                const metricEl = row.querySelector('.bioMetricCell, td:nth-child(4)');
                const minMaxEl = row.querySelector('.bioMetricCell:nth-of-type(2), td:nth-child(5)');
                const alertWrap = row.querySelector('.bioAlertWrap, td:nth-child(6)');

                if (!nameEl) return;

                const name = nameEl.innerText.trim();
                const cardId = `mob_bio_row_${index}`;

                // Extract metrics
                const average = metricEl ? metricEl.innerText.trim() : '—';
                const minMax = minMaxEl ? minMaxEl.innerText.trim() : '—';
                const hasWarning = alertWrap && (alertWrap.innerText.includes('⚠️') || alertWrap.innerHTML.includes('warning') || alertWrap.classList.contains('warning'));

                const card = document.createElement('div');
                card.className = `mobile-pedido-card ${hasWarning ? 'warning-glow' : ''}`;

                card.innerHTML = `
                    <div class="pedido-card-header">
                        <strong class="vaccine-name">${name}</strong>
                        ${hasWarning ? '<span class="material-symbols-rounded warning-icon animate-pulse">warning</span>' : ''}
                    </div>

                    <div class="pedido-card-meta">
                        <div class="meta-badge">
                            <span class="meta-lbl">Promedio</span>
                            <span class="meta-val">${average}</span>
                        </div>
                        <div class="meta-badge">
                            <span class="meta-lbl">Mín / Máx</span>
                            <span class="meta-val">${minMax}</span>
                        </div>
                    </div>

                    <div class="pedido-card-fields">
                        <div class="mobile-form-field flex-1">
                            <label>Existencia (Frascos)</label>
                            <input type="number" id="${cardId}_exist" class="mobile-select-element" min="0" placeholder="0" value="${existInput ? existInput.value : ''}">
                        </div>
                        <div class="mobile-form-field flex-1">
                            <label>Pedido (Frascos)</label>
                            <input type="number" id="${cardId}_ped" class="mobile-select-element" min="0" placeholder="0" value="${pedInput ? pedInput.value : ''}">
                        </div>
                    </div>
                `;

                mobPedidoList.appendChild(card);

                // Inputs change binds
                const mobExist = document.getElementById(`${cardId}_exist`);
                const mobPed = document.getElementById(`${cardId}_ped`);

                if (existInput && mobExist) {
                    mobExist.addEventListener('input', () => {
                        existInput.value = mobExist.value;
                        triggerEvent(existInput, 'input');
                    });
                }
                if (pedInput && mobPed) {
                    mobPed.addEventListener('input', () => {
                        pedInput.value = mobPed.value;
                        triggerEvent(pedInput, 'input');
                    });
                }
            });
        };

        if (hiddenBioList) {
            syncPedidoCards();
            new MutationObserver(syncPedidoCards).observe(hiddenBioList, { childList: true, subtree: true });
        }
    };

    // Form 4: Pinol Form
    const renderPinolForm = (container) => {
        container.innerHTML = `
            <div class="mobile-section-header">
                <span class="mobile-section-emoji">🧴</span>
                <div>
                    <h3>Multilimpiador Desinfectante Pinol®</h3>
                    <p>Uso exclusivo para refrigeradores y farmacia</p>
                </div>
            </div>

            <!-- Responsable -->
            <div class="mobile-input-card">
                <label class="mobile-field-label">Nombre de quien realiza la solicitud</label>
                <div class="mobile-input-wrapper">
                    <span class="material-symbols-rounded mobile-input-icon">person</span>
                    <input type="text" id="mobNombrePINOL" placeholder="Nombre completo" class="mobile-text-input">
                </div>
            </div>

            <!-- Existing/Order Fields -->
            <div class="mobile-input-grid">
                <div class="mobile-quantity-card">
                    <span class="qty-card-label">Existencia (Botellas)</span>
                    <div class="mobile-counter-wrapper large">
                        <button class="counter-btn dec" id="dec_pinol_exist">-</button>
                        <input type="number" id="mob_pinol_exist" class="mobile-number-input text-center" min="0" placeholder="0">
                        <button class="counter-btn inc" id="inc_pinol_exist">+</button>
                    </div>
                </div>

                <div class="mobile-quantity-card">
                    <span class="qty-card-label">Pedido (Botellas)</span>
                    <div class="mobile-counter-wrapper large">
                        <button class="counter-btn dec" id="dec_pinol_ped">-</button>
                        <input type="number" id="mob_pinol_ped" class="mobile-number-input text-center" min="0" placeholder="0">
                        <button class="counter-btn inc" id="inc_pinol_ped">+</button>
                    </div>
                </div>
            </div>

            <!-- Observaciones -->
            <div class="mobile-input-card">
                <label class="mobile-field-label">Observaciones Opcionales</label>
                <div class="mobile-textarea-wrapper">
                    <span class="material-symbols-rounded mobile-textarea-icon">notes</span>
                    <textarea id="mob_pinol_obs" placeholder="Detalles o especificaciones adicionales..." class="mobile-textarea"></textarea>
                </div>
            </div>
        `;

        // Sync names & values
        syncDesktopToMobile('nombrePINOL', document.getElementById('mobNombrePINOL'));
        syncMobileToDesktop(document.getElementById('mobNombrePINOL'), 'nombrePINOL');

        syncDesktopToMobile('pinol_existencia', document.getElementById('mob_pinol_exist'));
        syncMobileToDesktop(document.getElementById('mob_pinol_exist'), 'pinol_existencia');

        syncDesktopToMobile('pinol_solicitud', document.getElementById('mob_pinol_ped'));
        syncMobileToDesktop(document.getElementById('mob_pinol_ped'), 'pinol_solicitud');

        syncDesktopToMobile('pinol_observaciones', document.getElementById('mob_pinol_obs'));
        syncMobileToDesktop(document.getElementById('mob_pinol_obs'), 'pinol_observaciones');

        // Counters triggers
        const setupCounter = (mobId, deskId, decId, incId) => {
            const mob = document.getElementById(mobId);
            const desk = document.getElementById(deskId);

            document.getElementById(decId)?.addEventListener('click', () => {
                const val = Math.max(0, parseInt(mob.value || 0) - 1);
                mob.value = val;
                if (desk) { desk.value = val; triggerEvent(desk, 'input'); }
            });

            document.getElementById(incId)?.addEventListener('click', () => {
                const val = parseInt(mob.value || 0) + 1;
                mob.value = val;
                if (desk) { desk.value = val; triggerEvent(desk, 'input'); }
            });
        };

        setupCounter('mob_pinol_exist', 'pinol_existencia', 'dec_pinol_exist', 'inc_pinol_exist');
        setupCounter('mob_pinol_ped', 'pinol_solicitud', 'dec_pinol_ped', 'inc_pinol_ped');
    };

    // ─── BOTTOM NAVIGATION DOCK ───

    const mountDock = () => {
        if (document.getElementById('mobileCaptureDock')) return;

        const dock = document.createElement('div');
        dock.id = 'mobileCaptureDock';

        dock.innerHTML = `
            <div class="dock-indicator" id="dockIndicator">
                <div class="dock-indicator-inner"></div>
            </div>
            <button class="dock-item" data-capture="SR">
                <span class="material-symbols-rounded">vaccines</span>
                <label>BIOLÓGICOS</label>
            </button>
            <button class="dock-item" data-capture="CONS">
                <span class="material-symbols-rounded">medical_services</span>
                <label>CONSUMIBLES</label>
            </button>
            <button class="dock-item" data-capture="BIO">
                <span class="material-symbols-rounded">science</span>
                <label>PEDIDO</label>
            </button>
            <button class="dock-item" data-capture="PINOL">
                <span class="material-symbols-rounded">inventory_2</span>
                <label>PINOL</label>
            </button>
        `;
        document.body.appendChild(dock);

        // Click handler to trigger tab changes
        const items = dock.querySelectorAll('.dock-item');
        items.forEach(item => {
            item.addEventListener('click', () => {
                const code = item.dataset.capture;
                activeTab = code;

                // Sync click back to hidden desktop tab buttons
                const desktopTabBtn = document.getElementById('tab' + code);
                if (desktopTabBtn) {
                    desktopTabBtn.click();
                }

                syncDockState();
                renderActiveForm();
            });
        });

        syncDockState();
    };

    const syncDockState = () => {
        const indicator = document.getElementById('dockIndicator');
        const dock = document.getElementById('mobileCaptureDock');
        if (!indicator || !dock) return;

        let activeBtn = null;

        ['SR', 'CONS', 'BIO', 'PINOL'].forEach(code => {
            const dockBtn = dock.querySelector(`.dock-item[data-capture="${code}"]`);
            const isActive = activeTab === code;
            if (dockBtn) {
                dockBtn.classList.toggle('active', isActive);
                if (isActive) activeBtn = dockBtn;
            }
        });

        if (activeBtn) {
            const dockRect = dock.getBoundingClientRect();
            const btnRect = activeBtn.getBoundingClientRect();
            const indW = 80;

            indicator.style.width = `${indW}px`;
            indicator.style.left = `${btnRect.left - dockRect.left + (btnRect.width - indW) / 2}px`;
            indicator.style.opacity = '1';
        } else {
            indicator.style.opacity = '0';
        }
    };

    // ─── LIFECYCLE INTERCEPTOR ───

    // Check if right column is active, to launch the exclusive mobile app container instead
    const checkAppLifecycle = () => {
        const rightColumn = document.getElementById('rightColumn');
        const loginWrapper = document.getElementById('loginWrapper');
        const mobileApp = document.getElementById('mobileAppContainer');

        if (rightColumn && !rightColumn.classList.contains('hidden') && rightColumn.style.display !== 'none') {
            // Logged in!
            initMobileApp();
            mobileApp?.classList.remove('hidden');
        } else {
            // Logged out / Login screen
            mobileApp?.classList.add('hidden');
            document.getElementById('mobileCaptureDock')?.remove();
        }
    };

    // Setup global observer to run checkAppLifecycle
    const observer = new MutationObserver(checkAppLifecycle);
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style', 'class'] });

    // Initial check
    setTimeout(checkAppLifecycle, 200);

    // Keep activeTab updated if changed externally
    const tabsObserver = new MutationObserver(() => {
        ['SR', 'CONS', 'BIO', 'PINOL'].forEach(code => {
            const deskForm = document.getElementById('form' + code);
            if (deskForm && deskForm.style.display !== 'none' && activeTab !== code) {
                activeTab = code;
                syncDockState();
                renderActiveForm();
            }
        });
    });
    tabsObserver.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style'] });

})();
