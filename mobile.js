/**
 * JS1 Reportes - Mobile Adaptation Layer (MAL)
 * Senior Implementation - High-Fidelity Refraction (Pebble & Void Engine)
 * Architecture: backdrop-filter + SVG displacement (Chrome path)
 */

(function () {
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (!isTouch) return;

    document.documentElement.classList.add('touch-ui');
    console.log('📱 Mobile Adaptation Layer: Refractive Engine Active');

    // ─── CORE OPTICS UTILITIES (from Pebble & Void reference) ───
    const SurfaceEquations = {
        convex_squircle: (x) => Math.pow(1 - Math.pow(1 - x, 4), 1 / 4)
    };

    function calculateDisplacementMap1D(gt, bw, sf, ri, steps = 128) {
        const e = 1 / ri;
        const result = [];
        for (let i = 0; i < steps; i++) {
            const x = i / steps;
            const y = sf(x);
            const dx = x < 1 ? 0.0001 : -0.0001;
            const d = (sf(Math.max(0, Math.min(1, x + dx))) - y) / dx;
            const m = Math.sqrt(d * d + 1);
            const n = [-d / m, -1 / m];
            const dt = n[1];
            const k = 1 - e * e * (1 - dt * dt);
            if (k < 0) {
                result.push(0);
            } else {
                const rf = [
                    -(e * dt + Math.sqrt(k)) * n[0],
                    e - (e * dt + Math.sqrt(k)) * n[1]
                ];
                result.push(rf[0] * ((y * bw + gt) / rf[1]));
            }
        }
        return result;
    }

    function calculateDisplacementMap2D(cw, ch, ow, oh, rad, bw, md, pMap) {
        const img = new ImageData(cw, ch);
        for (let i = 0; i < img.data.length; i += 4) {
            img.data[i] = 128;
            img.data[i + 1] = 128;
            img.data[i + 2] = 128;
            img.data[i + 3] = 255;
        }
        const rSq = rad * rad;
        const rp1Sq = (rad + 1) ** 2;
        const rmBwSq = Math.max(0, rad - bw) ** 2;
        const wB = ow - rad * 2;
        const hB = oh - rad * 2;
        const oX = (cw - ow) / 2;
        const oY = (ch - oh) / 2;

        for (let y1 = 0; y1 < oh; y1++) {
            for (let x1 = 0; x1 < ow; x1++) {
                const idx = ((oY + y1) * cw + oX + x1) * 4;
                const x = x1 < rad ? x1 - rad : x1 >= ow - rad ? x1 - rad - wB : 0;
                const y = y1 < rad ? y1 - rad : y1 >= oh - rad ? y1 - rad - hB : 0;
                const dSq = x * x + y * y;

                if (dSq <= rp1Sq && dSq >= rmBwSq) {
                    const dist = Math.sqrt(dSq);
                    const op = dSq < rSq ? 1 : 1 - (dist - rad) / (Math.sqrt(rp1Sq) - rad);
                    const bIdx = Math.floor(Math.max(0, Math.min(1, (rad - dist) / bw)) * pMap.length);
                    const dVal = pMap[Math.max(0, Math.min(bIdx, pMap.length - 1))] || 0;
                    const dX = md > 0 ? (-(dist > 0 ? x / dist : 0) * dVal) / md : 0;
                    const dY = md > 0 ? (-(dist > 0 ? y / dist : 0) * dVal) / md : 0;

                    img.data[idx] = Math.max(0, Math.min(255, 128 + dX * 127 * op));
                    img.data[idx + 1] = Math.max(0, Math.min(255, 128 + dY * 127 * op));
                }
            }
        }
        return img;
    }

    function calculateSpecularHighlight(ow, oh, rad, bw) {
        const img = new ImageData(ow, oh);
        const sVec = [Math.cos(Math.PI / 3), Math.sin(Math.PI / 3)];
        const rSq = rad * rad;
        const rp1Sq = (rad + 1) ** 2;
        const rmSSq = Math.max(0, (rad - 1.5) ** 2);

        for (let y1 = 0; y1 < oh; y1++) {
            for (let x1 = 0; x1 < ow; x1++) {
                const x = x1 < rad ? x1 - rad : x1 >= ow - rad ? x1 - rad - (ow - rad * 2) : 0;
                const y = y1 < rad ? y1 - rad : y1 >= oh - rad ? y1 - rad - (oh - rad * 2) : 0;
                const dSq = x * x + y * y;

                if (dSq <= rp1Sq && dSq >= rmSSq) {
                    const dist = Math.sqrt(dSq);
                    const op = dSq < rSq ? 1 : 1 - (dist - rad) / (Math.sqrt(rp1Sq) - rad);
                    const dp = Math.abs((dist > 0 ? x / dist : 0) * sVec[0] + (dist > 0 ? -y / dist : 0) * sVec[1]);
                    const cf = dp * Math.sqrt(1 - (1 - Math.max(0, Math.min(1, (rad - dist) / 1.5))) ** 2);
                    const c = Math.min(255, 255 * cf);
                    const idx = (y1 * ow + x1) * 4;

                    img.data[idx] = img.data[idx + 1] = img.data[idx + 2] = c;
                    img.data[idx + 3] = Math.min(255, c * cf * op);
                }
            }
        }
        return img;
    }

    function imageDataToDataURL(img) {
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        c.getContext("2d").putImageData(img, 0, 0);
        return c.toDataURL();
    }

    // ─── DOCK IMPLEMENTATION ───

    // Indicator dimensions (fixed for consistent optics)
    const INDICATOR_W = 80;
    const INDICATOR_H = 60;
    const INDICATOR_R = 30;
    const BEZEL_W = 20;

    // Pre-compute displacement & specular maps ONCE
    const precomputed1D = calculateDisplacementMap1D(100, BEZEL_W, SurfaceEquations.convex_squircle, 1.6);
    const maxDisp = Math.max(...precomputed1D.map(Math.abs));
    const displacementDataURL = imageDataToDataURL(
        calculateDisplacementMap2D(INDICATOR_W, INDICATOR_H, INDICATOR_W, INDICATOR_H, INDICATOR_R, BEZEL_W, maxDisp || 1, precomputed1D)
    );
    const specularDataURL = imageDataToDataURL(
        calculateSpecularHighlight(INDICATOR_W, INDICATOR_H, INDICATOR_R, BEZEL_W)
    );

    const injectLiquidGlassFilter = () => {
        if (document.getElementById('dockGlassFilter')) return;
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute('width', '0');
        svg.setAttribute('height', '0');
        svg.style.cssText = 'position:absolute;pointer-events:none;';

        // Mirror the EXACT reference filter pipeline:
        // blur → displacement → saturate → specular → blend(screen)
        svg.innerHTML = `<defs>
            <filter id="dockGlassFilter" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
                <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" result="blurred" />
                <feImage id="dockDispImage" href="${displacementDataURL}" x="0" y="0" width="${INDICATOR_W}" height="${INDICATOR_H}" result="displacement_map" preserveAspectRatio="none" />
                <feDisplacementMap id="dockDispMap" in="blurred" in2="displacement_map" scale="30" xChannelSelector="R" yChannelSelector="G" result="displaced" />
                <feColorMatrix in="displaced" type="saturate" values="1.2" result="displaced_saturated" />
                <feImage id="dockSpecImage" href="${specularDataURL}" x="0" y="0" width="${INDICATOR_W}" height="${INDICATOR_H}" result="specular_layer" preserveAspectRatio="none" />
                <feComponentTransfer in="specular_layer" result="specular_faded">
                    <feFuncA type="linear" slope="0.8" />
                </feComponentTransfer>
                <feBlend in="specular_faded" in2="displaced_saturated" mode="screen" />
            </filter>
        </defs>`;
        document.body.appendChild(svg);
    };

    const mountDock = () => {
        if (document.getElementById('mobileCaptureDock')) return;
        injectLiquidGlassFilter();

        const dock = document.createElement('div');
        dock.id = 'mobileCaptureDock';

        // The indicator has an INNER div that receives backdrop-filter
        // This is the key architectural difference from before
        dock.innerHTML = `
            <div class="dock-indicator" id="dockIndicator">
                <div class="dock-indicator-inner" id="dockIndicatorInner"></div>
            </div>
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

        // Drag Dock interaction
        const items = dock.querySelectorAll('.dock-item');
        let isDragging = false;

        const handleInteraction = (e) => {
            const rect = dock.getBoundingClientRect();
            const clientX = e.clientX !== undefined ? e.clientX : (e.touches ? e.touches[0].clientX : 0);
            const x = clientX - rect.left;
            const segmentWidth = rect.width / items.length;
            const index = Math.max(0, Math.min(items.length - 1, Math.floor(x / segmentWidth)));

            const targetCode = items[index].dataset.capture;
            const desktopBtn = document.getElementById('tab' + targetCode);
            if (desktopBtn && !items[index].classList.contains('active')) {
                desktopBtn.click();
                if (window.navigator.vibrate) window.navigator.vibrate(5);
            }
        };

        dock.addEventListener('pointerdown', (e) => {
            isDragging = true;
            handleInteraction(e);
            dock.setPointerCapture(e.pointerId);
        });
        dock.addEventListener('pointermove', (e) => {
            if (isDragging) handleInteraction(e);
        });
        dock.addEventListener('pointerup', () => { isDragging = false; });
        dock.addEventListener('pointercancel', () => { isDragging = false; });

        syncDockState();
    };

    const unmountDock = () => {
        document.getElementById('mobileCaptureDock')?.remove();
    };

    const syncDockState = () => {
        const indicator = document.getElementById('dockIndicator');
        if (!indicator) return;
        let activeBtn = null;

        ['SR', 'CONS', 'BIO', 'PINOL'].forEach(code => {
            const form = document.getElementById('form' + code);
            const isActive = form && form.style.display !== 'none';
            const dockBtn = document.querySelector(`.dock-item[data-capture="${code}"]`);
            if (dockBtn) {
                dockBtn.classList.toggle('active', isActive);
                if (isActive) activeBtn = dockBtn;
            }
        });

        if (activeBtn) {
            const dock = document.getElementById('mobileCaptureDock');
            const dockRect = dock.getBoundingClientRect();
            const btnRect = activeBtn.getBoundingClientRect();

            indicator.style.width = `${INDICATOR_W}px`;
            indicator.style.left = `${btnRect.left - dockRect.left + (btnRect.width - INDICATOR_W) / 2}px`;
            indicator.style.opacity = '1';
        } else {
            indicator.style.opacity = '0';
        }
    };

    const syncDockLifecycle = () => {
        const panel = document.getElementById('panelCAP');
        const isVisible = panel && panel.offsetParent !== null;
        if (isVisible) mountDock(); else unmountDock();
    };

    // ─── ANCHORED CARD POSITIONING (Profile, Notifications, Explorer) ───

    const positionAnchoredCard = (triggerId, overlayId) => {
        const trigger = document.getElementById(triggerId);
        const overlay = document.getElementById(overlayId);
        if (!trigger || !overlay) return;

        if (overlay.parentElement !== document.body) document.body.appendChild(overlay);

        const isVisible = !overlay.classList.contains('hidden') && overlay.style.display !== 'none';
        if (!isVisible) return;

        const rect = trigger.getBoundingClientRect();
        const margin = 12;
        const viewportWidth = window.innerWidth;
        if (rect.width === 0) return;

        // Archivos panel needs more width than profile card
        const isArchivos = overlayId === 'archivosDropdown';
        const cardWidth = isArchivos ? Math.min(viewportWidth - margin * 2, 420) : 280;

        let left = rect.left + (rect.width / 2) - (cardWidth / 2);
        if (left < margin) left = margin;
        if (left + cardWidth > viewportWidth - margin) left = viewportWidth - cardWidth - margin;

        const topPos = rect.bottom + 8;
        const maxH = window.innerHeight - topPos - margin;

        overlay.style.setProperty('position', 'fixed', 'important');
        overlay.style.setProperty('top', `${topPos}px`, 'important');
        overlay.style.setProperty('left', `${left}px`, 'important');
        overlay.style.setProperty('right', 'auto', 'important');
        overlay.style.setProperty('bottom', 'auto', 'important');
        overlay.style.setProperty('width', `${cardWidth}px`, 'important');
        overlay.style.setProperty('max-height', `${maxH}px`, 'important');
        overlay.style.setProperty('transform', 'none', 'important');
        overlay.style.setProperty('margin', '0', 'important');
        overlay.style.setProperty('z-index', '2147483647', 'important');
        overlay.style.setProperty('pointer-events', 'auto', 'important');
    };

    // ─── LIFECYCLE OBSERVER ───

    const observer = new MutationObserver(() => {
        syncDockLifecycle();
        if (document.getElementById('mobileCaptureDock')) syncDockState();
        positionAnchoredCard('btnProfileToggle', 'profileDropdown');
        positionAnchoredCard('glassBtnNotifs', 'topNotifDropdown');
    });

    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style', 'class'] });
    syncDockLifecycle();

    window.visualViewport?.addEventListener('resize', () => {
        const dock = document.getElementById('mobileCaptureDock');
        if (dock) {
            const isKeyboard = window.visualViewport.height < window.innerHeight * 0.75;
            dock.style.transform = isKeyboard ? 'translateX(-50%) translateY(100px)' : 'translateX(-50%)';
            dock.style.opacity = isKeyboard ? '0' : '1';
        }
    });

})();
