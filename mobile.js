/**
 * JS1 Reportes - Mobile Adaptation Layer (MAL)
 * Detects touch devices and applies the 'touch-ui' class to document.body.
 * No core logic is modified.
 */

(function() {
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
    
    if (isTouchDevice) {
        document.body.classList.add('touch-ui');
        
        // FASE 3: Sync Logic
        const dock = document.getElementById('mobileCaptureDock');
        if (dock) {
            dock.style.display = 'flex';
            
            // 1. Ejecutar activateCapture
            dock.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-capture]');
                if (btn && typeof window.activateCapture === 'function') {
                    window.activateCapture(btn.dataset.capture);
                }
            });

            // 2. Sincronizar active state con MutationObserver
            const observer = new MutationObserver(() => {
                const activeTabId = document.querySelector('.tab-btn.tab-active')?.id;
                if (activeTabId) {
                    const captureCode = activeTabId.replace('tab', '');
                    document.querySelectorAll('.dock-btn').forEach(b => {
                        b.classList.toggle('active', b.dataset.capture === captureCode);
                    });
                }
            });

            const tabsContainer = document.getElementById('desktopCaptureTabs');
            if (tabsContainer) {
                observer.observe(tabsContainer, { attributes: true, subtree: true, attributeFilter: ['class'] });
            }

            // 3. Hide on keyboard
            window.visualViewport?.addEventListener('resize', () => {
                const isKeyboard = window.visualViewport.height < window.innerHeight * 0.75;
                dock.style.transform = isKeyboard ? 'translateY(100px)' : 'translateY(0)';
                dock.style.opacity = isKeyboard ? '0' : '1';
            });
        }
    }
})();
