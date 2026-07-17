/**
 * Zen Trace - App Logic
 * An asynchronous, high-fidelity tactile sand garden prototype.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Canvas & Context
    const canvas = document.getElementById('sandCanvas');
    const ctx = canvas.getContext('2d');
    const sandBed = document.getElementById('sandBed');

    // UI Elements
    const toolStylusBtn = document.getElementById('toolStylus');
    const toolRakeBtn = document.getElementById('toolRake');
    const toolStoneBtn = document.getElementById('toolStone');
    const statusText = document.getElementById('statusText');
    const statTime = document.getElementById('statTime');
    const statStrokes = document.getElementById('statStrokes');
    const testerPanel = document.getElementById('testerPanel');
    const testerToggle = document.getElementById('testerToggle');
    const btnSimulatePartner = document.getElementById('btnSimulatePartner');
    const btnSimulatePartnerText = document.getElementById('btnSimulatePartnerText');
    const btnClearCanvas = document.getElementById('btnClearCanvas');

    // Application State
    let activeTool = 'stylus'; // 'stylus' | 'rake' | 'stone'
    let isDrawing = false;
    let strokes = []; // Array of stroke objects
    let currentStroke = null;
    let lastMousePos = null;

    // Simulated Time State
    // Start at 09:50 AM, but maintain a full Date object
    let virtualTime = new Date();
    virtualTime.setHours(9, 50, 0, 0);

    // Track the last time there was an interaction (for the dynamic status text)
    let lastInteraction = {
        who: null, // 'you' | 'partner' | null
        time: null, // Date object
        type: null // 'sketched' | 'raked' | 'flattened'
    };

    // Color Constants for Tactile Sand Physics Rendering
    const SAND_BASE = '#fcf9f2';
    const GROOVE_DEEP = '#dcd1bd'; // deep shadow of groove
    const GROOVE_SHADOW = '#e2d7c2'; // soft shadow wall
    const LIP_HIGHLIGHT = 'rgba(255, 255, 255, 0.85)'; // sandy lip reflecting light

    // Initialize Canvas Dimensions with High-DPI Support
    function resizeCanvas() {
        const rect = sandBed.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        draw();
    }

    // Set up Resize Observer to make it perfectly responsive
    const resizeObserver = new ResizeObserver(() => resizeCanvas());
    resizeObserver.observe(sandBed);

    // Initialize Clock Display
    function updateClockDisplay() {
        const hours = virtualTime.getHours();
        const minutes = virtualTime.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        const displayMinutes = minutes < 10 ? '0' + minutes : minutes;
        statTime.textContent = `${displayHours}:${displayMinutes} ${ampm}`;
        updateStatusMessage();
    }

    // Dynamic, natural status text updater
    function updateStatusMessage() {
        if (!lastInteraction.time) {
            statusText.textContent = "The sand lies undisturbed and quiet.";
            return;
        }

        const diffMs = virtualTime - lastInteraction.time;
        const diffHrs = Math.max(0, diffMs / (1000 * 60 * 60));

        if (diffHrs >= 6) {
            statusText.textContent = "The traces have completely returned to flat sand.";
            return;
        }

        const person = lastInteraction.who === 'you' ? 'You' : 'Your partner';
        const action = lastInteraction.type === 'raked' ? 'raked the sand' : 'sketched a trace';
        
        if (diffHrs < 0.1) {
            statusText.textContent = `${person} just ${action} - perfectly crisp.`;
        } else if (diffHrs < 1) {
            const mins = Math.round(diffHrs * 60);
            statusText.textContent = `${person} ${action} ${mins}m ago - fading gently...`;
        } else {
            const hrs = diffHrs.toFixed(1);
            statusText.textContent = `${person} ${action} ${hrs} hours ago - fading...`;
        }
    }

    // Calculate normal vector of a line segment for Parallel Raking Lines
    function getNormal(p1, p2, length) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return { x: 0, y: 0 };
        return {
            x: (-dy / len) * length,
            y: (dx / len) * length
        };
    }

    // Tactile Sand Rendering Engine
    function draw() {
        // 1. Draw Sandy Base Layer
        ctx.fillStyle = SAND_BASE;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Draw all Strokes with blur and opacity decay based on simulated time
        strokes.forEach(stroke => {
            const elapsedHours = (virtualTime - stroke.timestamp) / (1000 * 60 * 60);
            if (elapsedHours >= 6) return; // Completely faded out

            // Calculate fade loop constants
            const opacity = Math.max(0, 1 - elapsedHours / 6);
            const blurRadius = elapsedHours * 2.0; // Grows blurrier over 6 hours

            ctx.save();
            
            // Set smooth fading opacities & soft blurring filter
            ctx.globalAlpha = opacity;
            if (blurRadius > 0.1) {
                ctx.filter = `blur(${blurRadius}px)`;
            }

            if (stroke.tool === 'stylus') {
                drawStylusStroke(stroke);
            } else if (stroke.tool === 'rake') {
                drawRakeStroke(stroke);
            }

            ctx.restore();
        });

        // 3. Draw Smoothing Stone active visualizer
        if (isDrawing && activeTool === 'stone' && lastMousePos) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(lastMousePos.x, lastMousePos.y, 35, 0, Math.PI * 2);
            const gradient = ctx.createRadialGradient(
                lastMousePos.x, lastMousePos.y, 0,
                lastMousePos.x, lastMousePos.y, 35
            );
            gradient.addColorStop(0, 'rgba(252, 249, 242, 0.95)');
            gradient.addColorStop(0.4, 'rgba(252, 249, 242, 0.8)');
            gradient.addColorStop(0.8, 'rgba(252, 249, 242, 0.3)');
            gradient.addColorStop(1, 'rgba(252, 249, 242, 0)');
            ctx.fillStyle = gradient;
            ctx.fill();
            ctx.restore();
        }

        // 4. Update active stroke counts
        const activeStrokes = strokes.filter(s => (virtualTime - s.timestamp) / (1000 * 60 * 60) < 6);
        statStrokes.textContent = `${activeStrokes.length} active trace${activeStrokes.length === 1 ? '' : 's'}`;
    }

    // Helper to draw a stylus (fine, deep line with light highlight lip)
    function drawStylusStroke(stroke) {
        const pts = stroke.points;
        if (pts.length < 2) return;

        // Draw segment by segment to respect dynamic point strength (smoothing block)
        for (let i = 1; i < pts.length; i++) {
            const p1 = pts[i - 1];
            const p2 = pts[i];
            const avgStrength = (p1.strength + p2.strength) / 2;
            if (avgStrength <= 0.05) continue;

            ctx.save();
            ctx.globalAlpha = ctx.globalAlpha * avgStrength;

            // A. Draw white highlight lip (offset slightly top-left: -0.8px, -0.8px)
            ctx.beginPath();
            ctx.strokeStyle = LIP_HIGHLIGHT;
            ctx.lineWidth = 3.5 * avgStrength;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(p1.x - 0.8, p1.y - 0.8);
            ctx.lineTo(p2.x - 0.8, p2.y - 0.8);
            ctx.stroke();

            // B. Draw main groove shadow (offset slightly bottom-right: 0.8px, 0.8px)
            ctx.beginPath();
            ctx.strokeStyle = GROOVE_SHADOW;
            ctx.lineWidth = 3 * avgStrength;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(p1.x + 0.8, p1.y + 0.8);
            ctx.lineTo(p2.x + 0.8, p2.y + 0.8);
            ctx.stroke();

            // C. Draw deep center trough
            ctx.beginPath();
            ctx.strokeStyle = GROOVE_DEEP;
            ctx.lineWidth = 1.8 * avgStrength;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            ctx.restore();
        }
    }

    // Helper to draw parallel rake paths
    function drawRakeStroke(stroke) {
        const pts = stroke.points;
        if (pts.length < 2) return;

        // Wide wooden rake has 4 prongs
        const prongs = [-15, -5, 5, 15];

        for (let i = 1; i < pts.length; i++) {
            const p1 = pts[i - 1];
            const p2 = pts[i];
            const avgStrength = (p1.strength + p2.strength) / 2;
            if (avgStrength <= 0.05) continue;

            // Draw segment for each prong trail individually
            prongs.forEach(offset => {
                const nextPointForNormal = pts[i + 1] || p2;
                const prevPointForNormal = pts[i - 2] || p1;
                
                const norm1 = getNormal(prevPointForNormal, p2, offset);
                const norm2 = getNormal(p1, nextPointForNormal, offset);

                const x1 = p1.x + norm1.x;
                const y1 = p1.y + norm1.y;
                const x2 = p2.x + norm2.x;
                const y2 = p2.y + norm2.y;

                ctx.save();
                ctx.globalAlpha = ctx.globalAlpha * avgStrength;

                // For highlight lip
                ctx.beginPath();
                ctx.strokeStyle = LIP_HIGHLIGHT;
                ctx.lineWidth = 3 * avgStrength;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.moveTo(x1 - 0.8, y1 - 0.8);
                ctx.lineTo(x2 - 0.8, y2 - 0.8);
                ctx.stroke();

                // For dark depth shadow
                ctx.beginPath();
                ctx.strokeStyle = GROOVE_SHADOW;
                ctx.lineWidth = 2.5 * avgStrength;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.moveTo(x1 + 0.8, y1 + 0.8);
                ctx.lineTo(x2 + 0.8, y2 + 0.8);
                ctx.stroke();

                // For deep center trough
                ctx.beginPath();
                ctx.strokeStyle = GROOVE_DEEP;
                ctx.lineWidth = 1.2 * avgStrength;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();

                ctx.restore();
            });
        }
    }

    // Get Mouse/Touch coordinates relative to the canvas scale
    function getEventCoordinates(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    // Handling the Smoothing Stone (Eraser) action
    function applySmoothingStone(pos) {
        const radius = 35; // flattening stone size
        let madeChanges = false;

        strokes.forEach(stroke => {
            stroke.points.forEach(pt => {
                const dx = pt.x - pos.x;
                const dy = pt.y - pos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < radius) {
                    // Reduce strength dynamically to flatten sand
                    const factor = (dist / radius) * 0.45 + 0.5; // smoother falloff towards center
                    pt.strength *= factor;
                    if (pt.strength < 0.05) pt.strength = 0;
                    madeChanges = true;
                }
            });
        });

        // Filter out strokes that have been completely smoothed flat
        strokes = strokes.filter(stroke => {
            return stroke.points.some(pt => pt.strength > 0.05);
        });

        if (madeChanges) {
            lastInteraction = {
                who: 'you',
                time: new Date(virtualTime),
                type: 'flattened'
            };
            draw();
        }
    }

    // Drawing input lifecycle events
    function startDrawing(e) {
        isDrawing = true;
        const pos = getEventCoordinates(e);
        lastMousePos = pos;

        if (activeTool === 'stone') {
            applySmoothingStone(pos);
            return;
        }

        // Start structured stroke
        currentStroke = {
            id: Date.now() + Math.random(),
            tool: activeTool,
            points: [{ x: pos.x, y: pos.y, strength: 1.0 }],
            timestamp: new Date(virtualTime)
        };

        strokes.push(currentStroke);
        
        lastInteraction = {
            who: 'you',
            time: new Date(virtualTime),
            type: activeTool === 'rake' ? 'raked' : 'sketched'
        };

        draw();
    }

    function moveDrawing(e) {
        if (!isDrawing) return;
        e.preventDefault(); // Stop scrolling on touch screen
        const pos = getEventCoordinates(e);
        lastMousePos = pos;

        if (activeTool === 'stone') {
            applySmoothingStone(pos);
            return;
        }

        if (currentStroke) {
            // Distance check to avoid redundant, overlapping coordinates
            const lastPt = currentStroke.points[currentStroke.points.length - 1];
            const dist = Math.sqrt((pos.x - lastPt.x) ** 2 + (pos.y - lastPt.y) ** 2);
            
            if (dist > 3) {
                currentStroke.points.push({ x: pos.x, y: pos.y, strength: 1.0 });
                draw();
            }
        }
    }

    function stopDrawing() {
        isDrawing = false;
        currentStroke = null;
        updateStatusMessage();
    }

    // Attach Event Listeners to Sand Bed
    sandBed.addEventListener('mousedown', startDrawing);
    window.addEventListener('mousemove', moveDrawing);
    window.addEventListener('mouseup', stopDrawing);

    sandBed.addEventListener('touchstart', startDrawing, { passive: false });
    window.addEventListener('touchmove', moveDrawing, { passive: false });
    window.addEventListener('touchend', stopDrawing);

    // Bottom Navigation Tool Palette
    const toolButtons = [toolStylusBtn, toolRakeBtn, toolStoneBtn];
    toolButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            toolButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeTool = btn.dataset.tool;
        });
    });

    // Side Tester Panel Toggle Controls
    testerToggle.addEventListener('click', () => {
        testerPanel.classList.toggle('collapsed');
    });

    // "Simulate Time Passage" Functionality
    document.querySelectorAll('.btn-time').forEach(btn => {
        btn.addEventListener('click', () => {
            const hours = parseInt(btn.dataset.hours, 10);
            
            // Advance virtual time by added hours
            virtualTime.setHours(virtualTime.getHours() + hours);
            updateClockDisplay();
            draw();

            // Give a soft button visual click feed
            btn.classList.add('clicked');
            setTimeout(() => btn.classList.remove('clicked'), 200);
        });
    });

    // "Simulate Partner Activity (Rake Path 3 Hrs Ago)"
    btnSimulatePartner.addEventListener('click', () => {
        const rect = canvas.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;

        // Generate coordinates for a beautifully raked horizontal S-curve
        const points = [];
        const steps = 30;
        const startX = w * 0.15;
        const endX = w * 0.85;
        const centerY = h * 0.5;
        const amplitude = h * 0.18;

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = startX + (endX - startX) * t;
            const y = centerY + Math.sin(t * Math.PI * 2) * amplitude;
            points.push({ x, y, strength: 1.0 });
        }

        // Timestamp is set to exactly 3 hours ago relative to current virtual time
        const strokeTime = new Date(virtualTime);
        strokeTime.setHours(strokeTime.getHours() - 3);

        strokes.push({
            id: 'partner-rake-' + Date.now(),
            tool: 'rake',
            points: points,
            timestamp: strokeTime
        });

        lastInteraction = {
            who: 'partner',
            time: strokeTime,
            type: 'raked'
        };

        draw();
        updateClockDisplay();
    });

    // "Simulate Partner Note ('Miss u' 1 Hr Ago)"
    btnSimulatePartnerText.addEventListener('click', () => {
        const rect = canvas.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;

        // Pre-recorded parametric glyph coordinates for drawing "Miss u" with heart
        const strokeTime = new Date(virtualTime);
        strokeTime.setHours(strokeTime.getHours() - 1);

        const cx = w * 0.5;
        const cy = h * 0.45;

        // Helper to add letter traces
        function addLetterStroke(pts) {
            strokes.push({
                id: 'partner-note-' + Math.random(),
                tool: 'stylus',
                points: pts.map(p => ({ x: cx + p.dx, y: cy + p.dy, strength: 1.0 })),
                timestamp: strokeTime
            });
        }

        // Letter M
        addLetterStroke([
            { dx: -100, dy: 15 },
            { dx: -100, dy: -25 },
            { dx: -80, dy: 5 },
            { dx: -60, dy: -25 },
            { dx: -60, dy: 15 }
        ]);

        // Letter i (with separate dot)
        addLetterStroke([
            { dx: -45, dy: -5 },
            { dx: -45, dy: 15 }
        ]);
        addLetterStroke([
            { dx: -45, dy: -13 },
            { dx: -45, dy: -14 }
        ]);

        // Letter s
        addLetterStroke([
            { dx: -30, dy: 15 },
            { dx: -20, dy: 10 },
            { dx: -28, dy: 5 },
            { dx: -18, dy: -5 }
        ]);

        // Letter s
        addLetterStroke([
            { dx: -10, dy: 15 },
            { dx: 0, dy: 10 },
            { dx: -8, dy: 5 },
            { dx: 2, dy: -5 }
        ]);

        // Letter u
        addLetterStroke([
            { dx: 25, dy: -5 },
            { dx: 25, dy: 10 },
            { dx: 38, dy: 15 },
            { dx: 45, dy: 5 },
            { dx: 45, dy: 15 }
        ]);

        // Heart Drawing
        const heartPoints = [];
        for (let t = 0; t <= Math.PI * 2; t += 0.15) {
            // Heart math equation
            const hx = 16 * Math.sin(t) ** 3;
            const hy = -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
            // Shift to right side
            heartPoints.push({
                x: cx + 100 + hx * 2,
                y: cy + hy * 2,
                strength: 1.0
            });
        }
        strokes.push({
            id: 'partner-heart-' + Math.random(),
            tool: 'stylus',
            points: heartPoints,
            timestamp: strokeTime
        });

        lastInteraction = {
            who: 'partner',
            time: strokeTime,
            type: 'sketched'
        };

        draw();
        updateClockDisplay();
    });

    // Clear and Flatten Canvas
    btnClearCanvas.addEventListener('click', () => {
        strokes = [];
        lastInteraction = {
            who: null,
            time: null,
            type: null
        };
        draw();
        updateClockDisplay();
    });

    // Start App Cycle
    updateClockDisplay();
    resizeCanvas();
});
