/**
 * JS1 Reportes - Mobile Adaptation Layer (MAL)
 * Senior Implementation - Direct Patch
 */

(function () {
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isTouch) {
        document.documentElement.classList.add('touch-ui');
        console.log('📱 Mobile Adaptation Layer Active');

        const mountDock = () => {
            if (document.getElementById('mobileCaptureDock')) return;
            const dock = document.createElement('div');
            dock.id = 'mobileCaptureDock';
            dock.innerHTML = `
                <button class="dock-item" data-capture="SR">
                    <span class="material-symbols-rounded">vaccines</span>
                    <label>BIOLÓGICOS</label>
                </button>
                <button class="dock-item" data-capture="CONS">
                    <span class="material-symbols-rounded">add_business</span>
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

            dock.querySelectorAll('.dock-item').forEach(btn => {
                btn.onclick = () => {
                    const captureCode = btn.dataset.capture;
                    const desktopBtn = document.getElementById('tab' + captureCode);
                    if (desktopBtn) desktopBtn.click();
                };
            });
            syncDockState();
        };

        const unmountDock = () => {
            document.getElementById('mobileCaptureDock')?.remove();
        };

        const syncDockState = () => {
            ['SR', 'CONS', 'BIO', 'PINOL'].forEach(code => {
                const form = document.getElementById('form' + code);
                const isActive = form && form.style.display !== 'none';
                const dockBtn = document.querySelector(`.dock-item[data-capture="${code}"]`);
                if (dockBtn) {
                    dockBtn.classList.toggle('active', isActive);
                }
            });
        };

        const syncDockLifecycle = () => {
            const panel = document.getElementById('panelCAP');
            const isVisible = panel && panel.offsetParent !== null;
            if (isVisible) mountDock(); else unmountDock();
        };

        const positionAnchoredCard = (triggerId, overlayId) => {
            const trigger = document.getElementById(triggerId);
            const overlay = document.getElementById(overlayId);
            if (!trigger || !overlay) return;

            if (overlay.parentElement !== document.body) {
                document.body.appendChild(overlay);
            }

            const isVisible = !overlay.classList.contains('hidden') && overlay.style.display !== 'none';
            if (!isVisible) return;

            const rect = trigger.getBoundingClientRect();
            const cardWidth = 280;
            const margin = 12;
            const viewportWidth = window.innerWidth;
            if (rect.width === 0) return;

            let left = rect.left + (rect.width / 2) - (cardWidth / 2);
            if (left < margin) left = margin;
            if (left + cardWidth > viewportWidth - margin) {
                left = viewportWidth - cardWidth - margin;
            }

            overlay.style.setProperty('position', 'fixed', 'important');
            overlay.style.setProperty('top', `${rect.bottom + 8}px`, 'important');
            overlay.style.setProperty('left', `${left}px`, 'important');
            overlay.style.setProperty('right', 'auto', 'important');
            overlay.style.setProperty('bottom', 'auto', 'important');
            overlay.style.setProperty('width', `${cardWidth}px`, 'important');
            overlay.style.setProperty('transform', 'none', 'important');
            overlay.style.setProperty('margin', '0', 'important');
            overlay.style.setProperty('z-index', '2147483647', 'important');
            overlay.style.setProperty('pointer-events', 'auto', 'important');
        };

        const closeProfile = () => {
            const profile = document.getElementById('profileDropdown');
            const btn = document.getElementById('btnProfileToggle');
            if (profile && !profile.classList.contains('hidden')) {
                profile.classList.add('hidden');
                if (btn) btn.classList.remove('btn-active');
            }
        };

        const observer = new MutationObserver(() => {
            syncDockLifecycle();
            if (document.getElementById('mobileCaptureDock')) syncDockState();
            positionAnchoredCard('btnProfileToggle', 'profileDropdown');
            positionAnchoredCard('glassBtnNotifs', 'topNotifDropdown');
            positionAnchoredCard('glassBtnExplorer', 'archivosDropdown');
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeProfile();
        });

        observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style', 'class'] });
        syncDockLifecycle();

        window.visualViewport?.addEventListener('resize', () => {
            const dock = document.getElementById('mobileCaptureDock');
            if (dock) {
                const isKeyboard = window.visualViewport.height < window.innerHeight * 0.75;
                dock.style.transform = isKeyboard ? 'translateY(100px)' : 'translateY(0)';
                dock.style.opacity = isKeyboard ? '0' : '1';
            }
        });

        document.addEventListener('click', (e) => {
            const profile = document.getElementById('profileDropdown');
            const trigger = document.getElementById('btnProfileToggle');
            if (profile && !profile.classList.contains('hidden')) {
                if (!profile.contains(e.target) && !trigger?.contains(e.target)) {
                    closeProfile();
                }
            }
        }, true);
    }
})();
