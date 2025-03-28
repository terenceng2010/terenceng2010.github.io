const canvas = document.getElementById('sceneCanvas');
const ctx = canvas.getContext('2d', { alpha: true }); // Keep alpha for blending
const drawer = document.getElementById('drawer');
const drawerItems = document.querySelectorAll('.drawer-item');
const btnMidnight = document.getElementById('btn-midnight');
const btnDawn = document.getElementById('btn-dawn');
const btnClear = document.getElementById('btn-clear');
const btnFullscreen = document.getElementById('btn-fullscreen');

let canvasWidth, canvasHeight;
let timeOfDay = 'midnight'; // 'midnight' or 'dawn'
let placedLights = [];
let moon = null;

// --- Dynamic Lighting ---
const lightMaskCanvas = document.createElement('canvas');
const lightMaskCtx = lightMaskCanvas.getContext('2d');

// --- Scene Movement ---
let starOffset = 0;
let treeOffset = 0;
const STAR_SPEED = 0.01; // Much slower drift
const TREE_SPEED = 0.03; // Much slower drift

// === NEW Touch Drag State ===
let isTouchDraggingDrawerItem = false;
let touchDraggedItemType = null;
let touchDragGhostElement = null;
let touchDragStartX = 0;
let touchDragStartY = 0;

// --- Drag and Drop State ---
let isDraggingItem = false;
let draggedItemType = null; // Holds the type ('deskLamp', 'moon', 'stripLightPlaceholder', etc.)
let dragOffsetX = 0;
let dragOffsetY = 0;

// --- Strip Light Drawing State ---
let isDrawingStripMode = false; // True when placeholder is dropped, waiting for drawing
let isActivelyDrawingStrip = false; // True while pointer is down and moving to draw
let currentStripPoints = [];
let stripPlaceholderPos = null; // Stores {x, y} where placeholder was dropped

// --- Campfire Interaction State ---
let isInteractingCampfire = false;
let interactingCampfire = null; // Reference to the specific campfire object
let interactionStartPos = null; // Stores {x, y} of pointer down for flick calc
let interactionStartTime = 0;

// --- Animation State ---
let frameCount = 0;
let animationFrameId = null; // To cancel animation loop if needed

// --- Initialization ---
function setupCanvas() {
    const isFs = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    const container = isFs ? document.documentElement : document.body;
    const availableWidth = container.clientWidth;

    let reservedHeight = 0;
    if (!isFs) {
        const h1 = document.querySelector('h1');
        const controls = document.querySelector('.controls');
        const drawerEl = document.getElementById('drawer');
        if (h1) reservedHeight += h1.offsetHeight;
        if (controls) reservedHeight += controls.offsetHeight;
        if (drawerEl) reservedHeight += drawerEl.offsetHeight;
        reservedHeight += 40; // Some extra margin/padding allowance
    }
    const availableHeight = isFs ? container.clientHeight : window.innerHeight - reservedHeight;

    const aspectRatio = 16 / 9;
    let targetWidth = availableWidth * 0.98; // Use slightly more width
    let targetHeight = targetWidth / aspectRatio;

    // Adjust if height limited
    if (targetHeight > availableHeight * 0.98) {
        targetHeight = availableHeight * 0.98; // Use most of available height
        targetWidth = targetHeight * aspectRatio;
    }
     // Ensure width doesn't exceed container (can happen if aspect ratio forced it wide)
    if (targetWidth > availableWidth * 0.98) {
       targetWidth = availableWidth * 0.98;
       targetHeight = targetWidth / aspectRatio;
    }

    canvasWidth = Math.max(300, Math.floor(targetWidth)); // Use floor for integer pixels
    canvasHeight = Math.max(200, Math.floor(targetHeight));

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvas.style.width = `${canvasWidth}px`; // Set CSS size too for consistency
    canvas.style.height = `${canvasHeight}px`;


    lightMaskCanvas.width = canvasWidth;
    lightMaskCanvas.height = canvasHeight;

    console.log(`Canvas resized to: ${canvasWidth}x${canvasHeight}`);
    redrawScene(); // Trigger immediate redraw after resize
}

// --- Scene Drawing ---

function drawBackground() {
    // Base clear (useful for transparent gradients/effects)
    // ctx.clearRect(0, 0, canvasWidth, canvasHeight); // Usually background fills everything anyway

    if (timeOfDay === 'midnight') {
        // Dark Sky Gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight * 0.7);
        gradient.addColorStop(0, '#00001a'); // Deep blue/black
        gradient.addColorStop(1, '#1a1a4d'); // Dark blue towards horizon
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight * 0.85); // Extend gradient lower

        // Dark Ground
        ctx.fillStyle = '#1a1a00'; // Very dark green/brown
        ctx.fillRect(0, canvasHeight * 0.8, canvasWidth, canvasHeight * 0.2);

        // Stars (Subtle and moving slowly)
        //ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        //const starDrawWidth = canvasWidth * 1.5; // Draw across a wider area for smooth wrapping
        //for (let i = 0; i < 120; i++) {
        //    const xBase = Math.random() * starDrawWidth;
        //     // Wrap position within the extended draw width
        //    const xWrapped = (xBase + starOffset + starDrawWidth) % starDrawWidth;
        //     // Translate back to be relative to canvas left edge
        //    const x = xWrapped - (starDrawWidth - canvasWidth) / 2;
		//
        //     // Only draw if potentially visible
        //     if (x > -10 && x < canvasWidth + 10) {
        //        const y = Math.random() * canvasHeight * 0.75; // Slightly lower possible position
        //        ctx.beginPath();
        //        ctx.arc(x, y, Math.random() * 1.2, 0, Math.PI * 2);
        //        ctx.fill();
        //    }
        //}

    } else { // Dawn
        // Lighter Sky Gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight * 0.8);
        gradient.addColorStop(0, '#4d4dff'); // Blueish top
        gradient.addColorStop(0.5, '#ffa500'); // Orange horizon
        gradient.addColorStop(1, '#ffcc66'); // Lighter orange near bottom
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight * 0.85);

        // Lighter Ground
        ctx.fillStyle = '#556B2F'; // Dark Olive Green
        ctx.fillRect(0, canvasHeight * 0.8, canvasWidth, canvasHeight * 0.2);
        // No stars drawn at dawn
    }
}

function drawForestSilhouette() {
    const treeBaseY = canvasHeight * 0.8;
    const numTrees = 15; // Number roughly visible at once
    const treeDrawWidth = canvasWidth * 1.5; // Draw over 1.5x width for wrapping

    ctx.fillStyle = (timeOfDay === 'midnight') ? '#0d0d0d' : '#2F4F4F';

    for (let i = 0; i < Math.floor(numTrees * 1.5); i++) { // Iterate enough times to cover draw width
        // Base position within the wider drawing area
        let treeXBase = (treeDrawWidth / (numTrees * 1.5)) * i;

        // Apply offset and wrap within the WIDER draw area
        treeXBase = (treeXBase + treeOffset + treeDrawWidth) % treeDrawWidth;

        // Translate the wrapped position back relative to canvas origin
        const treeXDraw = treeXBase - (treeDrawWidth - canvasWidth) / 2;

        // Use modulo on index `i` related to VISIBLE number for consistent variation
        const treeSeed = i % numTrees;
        const randomFactor = ((treeSeed * 37) % 13) / 13; // Pseudo-random based on index

        const treeHeight = 50 + randomFactor * 50;
        const treeWidth = 20 + randomFactor * 15;
        // Final X position with small random horizontal variation
        const treeXFinal = treeXDraw + (randomFactor - 0.5) * 10;

         // Culling: Only draw if potentially within or near canvas bounds
         if (treeXFinal > -treeWidth && treeXFinal < canvasWidth + treeWidth) {
            ctx.beginPath();
            ctx.moveTo(treeXFinal - treeWidth / 2, treeBaseY + 5); // Start slightly below horizon
            ctx.lineTo(treeXFinal, treeBaseY - treeHeight);
            ctx.lineTo(treeXFinal + treeWidth / 2, treeBaseY + 5);
            ctx.closePath();
            ctx.fill();
        }
    }
}

// --- Light OBJECT Drawing Functions (Physical representation) ---

function drawDeskLampObject(light) {
    const { x, y } = light;
    ctx.fillStyle = '#808080'; // Base color
    ctx.fillRect(x - 10, y - 5, 20, 5); // Base rectangle
    ctx.fillRect(x - 2, y - 25, 4, 20); // Stand
    ctx.beginPath();
    ctx.arc(x, y - 25, 8, Math.PI, 0); // Lamp head top (semicircle)
    ctx.fillStyle = '#606060'; // Head color
    ctx.fill();
}

function drawPenguinLedObject(light) {
     const { x, y } = light;
    // Body (black)
    ctx.fillStyle = 'black';
    ctx.beginPath(); ctx.ellipse(x, y - 15, 12, 18, 0, 0, Math.PI * 2); ctx.fill();
    // Belly (white)
    ctx.fillStyle = 'white';
    ctx.beginPath(); ctx.ellipse(x, y - 10, 8, 12, 0, 0, Math.PI * 2); ctx.fill();
    // Beak (orange)
    ctx.fillStyle = 'orange';
    ctx.beginPath(); ctx.moveTo(x - 2, y - 22); ctx.lineTo(x + 2, y - 22); ctx.lineTo(x, y - 18); ctx.closePath(); ctx.fill();
    // Physical LED part (light blue circle)
    ctx.fillStyle = 'lightblue';
    ctx.beginPath(); ctx.arc(x, y - 8, 4, 0, Math.PI * 2); ctx.fill();
}

function drawStripLightObject(light) {
    // Draws the wire connecting the bells
    if (light.points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = '#444'; // Dark grey wire
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(light.points[0].x, light.points[0].y);
    for (let i = 1; i < light.points.length; i++) {
        ctx.lineTo(light.points[i].x, light.points[i].y);
    }
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    ctx.stroke();
    ctx.restore(); // Resets shadow, lineWidth
}

function drawCampingLightObject(light) {
    const { x, y } = light;
    // Base
    ctx.fillStyle = '#a0522d'; // Sienna brown
    ctx.fillRect(x - 15, y - 5, 30, 5);
    // Body (glass - opaque when 'off')
    ctx.fillStyle = '#CCCCCC'; // Light gray for glass simulation
    ctx.fillRect(x - 12, y - 30, 24, 25);
    // Top
    ctx.fillStyle = '#a0522d';
    ctx.fillRect(x - 15, y - 35, 30, 5);
    // Handle
    ctx.strokeStyle = '#505050'; // Dark gray handle
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y - 35, 10, Math.PI, 0); ctx.stroke(); // Semicircle handle
    ctx.lineWidth = 1; // Reset
}

function drawTorchObject(light) {
     const { x, y } = light;
    // Handle
    ctx.fillStyle = '#404040'; // Dark Gray
    ctx.fillRect(x - 5, y - 30, 10, 30);
    // Head
    ctx.fillStyle = '#606060'; // Slightly lighter gray
    ctx.fillRect(x - 7, y - 35, 14, 5);
}

function drawFireStickObject(light) {
     const { x, y } = light;
    // Stick
    ctx.strokeStyle = '#8B4513'; // Saddle Brown
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2, y - 30); ctx.stroke();
    // Ember base (small dark red dot)
    ctx.fillStyle = '#A52A2A'; // Brownish Red for unlit ember tip
    ctx.beginPath(); ctx.arc(x + 2, y - 30, 3, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 1;
}

function drawCampfireObject(light) {
    const { x, y, state } = light;
    const logY = y - 5; // Base y for logs slightly higher than interaction point
    ctx.fillStyle = '#654321'; // Darker brown for logs
    ctx.save();
    ctx.translate(x, logY); // Translate for easier rotation/placement

    // Bottom logs (overlapping)
    ctx.rotate(-0.2); ctx.fillRect(-20, 0, 40, 8);
    ctx.rotate(0.4); ctx.fillRect(-18, -5, 36, 7);
    ctx.rotate(-0.2); // Reset angle to base

    // Top logs (criss-cross)
    ctx.rotate(0.8); ctx.fillRect(-15, -20, 30, 6);
    ctx.rotate(-1.6); ctx.fillRect(-14, -22, 28, 5);

    ctx.restore(); // Restore position and rotation

    // Display "Flick me!" text if campfire is unlit
    if (state === 'unlit') {
         ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
         ctx.font = '12px sans-serif';
         ctx.textAlign = 'center';
         ctx.fillText('Flick me!', x, y + 15); // Position below logs
    }
    // Actual flames/embers are drawn by the light influence function
}

function drawMoonObject(moonData) {
    if (!moonData) return;
    const { x, y } = moonData;
    const radius = 30;
    // Moon Body (creamy white)
    ctx.fillStyle = '#DDDBC6'; // Less bright color for the object itself
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    // Subtle Craters
    ctx.fillStyle = 'rgba(150, 150, 150, 0.5)'; // Grey craters
    ctx.beginPath(); ctx.arc(x - 10, y - 5, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 8, y + 10, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 5, y - 12, 4, 0, Math.PI * 2); ctx.fill();
}

// --- Light MASK Drawing Functions (Glows, lighting effects) ---

function drawRadialGlow(maskCtx, x, y, radius, color, intensity) {
    maskCtx.save();
    const gradient = maskCtx.createRadialGradient(x, y, radius * 0.05, x, y, radius); // Start gradient slightly out for smoother center
    // Extract base alpha from color string (e.g., "rgba(r,g,b,a)")
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    let r = 0, g = 0, b = 0, baseAlpha = 1.0;
    if (match) {
        r = parseInt(match[1]); g = parseInt(match[2]); b = parseInt(match[3]);
        if (match[4] !== undefined) baseAlpha = parseFloat(match[4]);
    }
    const effectiveAlpha = Math.min(1, Math.max(0, baseAlpha * intensity)); // Clamp alpha between 0 and 1

    const centerColor = `rgba(${r},${g},${b},${effectiveAlpha})`;
    const edgeColor = `rgba(${r},${g},${b},0)`; // Always fade to zero alpha

    gradient.addColorStop(0, centerColor); // Brightest at center (scaled by intensity)
    gradient.addColorStop(0.7, `rgba(${r},${g},${b},${effectiveAlpha * 0.3})`); // Midpoint fade
    gradient.addColorStop(1, edgeColor); // Fully transparent at edge

    maskCtx.globalCompositeOperation = 'lighter'; // Additive blending for light
    maskCtx.fillStyle = gradient;
    maskCtx.beginPath();
    maskCtx.arc(x, y, radius, 0, Math.PI * 2);
    maskCtx.fill();
    maskCtx.restore();
}

function drawConeLight(maskCtx, x, y, angleStart, angleEnd, radius, color, intensity) {
    // Ensure angles are correctly ordered
    while (angleEnd < angleStart) angleEnd += Math.PI * 2;

    maskCtx.save();
    // Create radial gradient centered at the cone's origin (x, y)
    const gradient = maskCtx.createRadialGradient(x, y, radius * 0.02, x, y, radius);

    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    let r = 0, g = 0, b = 0, baseAlpha = 1.0;
    if (match) {
        r = parseInt(match[1]); g = parseInt(match[2]); b = parseInt(match[3]);
        if (match[4] !== undefined) baseAlpha = parseFloat(match[4]);
    }
    const effectiveAlpha = Math.min(1, Math.max(0, baseAlpha * intensity));

    const centerColor = `rgba(${r},${g},${b},${effectiveAlpha})`;
    const edgeColor = `rgba(${r},${g},${b},0)`;

    gradient.addColorStop(0, centerColor);
    gradient.addColorStop(0.8, `rgba(${r},${g},${b},${effectiveAlpha * 0.2})`); // Faster falloff
    gradient.addColorStop(1, edgeColor);

    maskCtx.globalCompositeOperation = 'lighter';
    maskCtx.fillStyle = gradient;
    maskCtx.beginPath();
    maskCtx.moveTo(x, y); // Start at cone origin
    maskCtx.arc(x, y, radius, angleStart, angleEnd); // Define the arc segment
    maskCtx.closePath(); // Line back to origin to form wedge
    maskCtx.fill();
    maskCtx.restore();
}


// --- Add Light Influence (Calculates & draws light effects to mask) ---

function addLightInfluence(light) {
    const { x, y, type, state, points } = light; // Include points for strip light
    let color, radius, intensity = 1.0; // Base intensity

    // Don't draw light for objects that are off or unlit
    if (state === 'unlit') return;

    switch (type) {
        case 'deskLamp':
            color = 'rgba(255, 255, 190, 0.6)'; // Slightly warmer yellow
            radius = 85;
             // Originates from head (y-25), points down (around PI/2 radians)
             // Correct angles: 0.3 * PI (approx 54 deg) to 0.7 * PI (approx 126 deg)
             drawConeLight(lightMaskCtx, x, y - 25, Math.PI * 0.30, Math.PI * 0.70, radius, color, intensity);
            break;

        case 'penguinLed':
            color = 'rgba(173, 216, 230, 0.75)'; // Slightly brighter blue maybe
            radius = 55;
             drawRadialGlow(lightMaskCtx, x, y - 8, radius, color, intensity); // Glow originates near the LED source
            break;

        case 'stripLight':
            // Draws individual bell glows along the path
            if (points.length < 2) return;

            const bellSpacing = 30; // Pixels between bell centers
            let currentDist = 0; // Distance traveled along path to place next bell
            let pathDist = 0; // Cumulative distance up to the start of the current segment
            let segmentIndex = 0; // Index of the path segment we are currently on
            let remainingSegmentDist = Math.sqrt(Math.pow(points[1].x - points[0].x, 2) + Math.pow(points[1].y - points[0].y, 2));
            let totalBells = 0;

             // Loop while there are path segments left to process
             while (segmentIndex < points.length - 1) {
                 // Have we placed a bell far enough along the total path?
                 if (currentDist >= pathDist + remainingSegmentDist) {
                     // Move to the next segment
                     pathDist += remainingSegmentDist;
                     segmentIndex++;
                     if (segmentIndex >= points.length - 1) break; // No more segments
                     // Calculate length of the new segment
                     remainingSegmentDist = Math.sqrt(Math.pow(points[segmentIndex + 1].x - points[segmentIndex].x, 2) + Math.pow(points[segmentIndex + 1].y - points[segmentIndex].y, 2));
                      if (remainingSegmentDist < 1) { continue; } // Skip zero-length segments
                 }

                  // Calculate bell position on the current segment
                 const distAlongSegment = currentDist - pathDist; // How far into the *current* segment the bell is
                 const fraction = remainingSegmentDist > 1 ? distAlongSegment / remainingSegmentDist : 0; // Proportion along segment

                 const bellX = points[segmentIndex].x + (points[segmentIndex + 1].x - points[segmentIndex].x) * fraction;
                 const bellY = points[segmentIndex].y + (points[segmentIndex + 1].y - points[segmentIndex].y) * fraction;

                 // Calculate HSL color: hue cycles with time and bell position
                 const hue = (frameCount * 1.5 + totalBells * 20) % 360; // Slower time transition, larger offset per bell
                 const bellColor = `hsla(${hue}, 100%, 75%, 0.9)`; // Bright saturation, lightness
                 const glowColor = `hsla(${hue}, 100%, 75%, 0.6)`; // Same color, lower alpha for glow

                 // === Draw Bell OBJECT on MAIN Canvas ===
                 ctx.fillStyle = bellColor;
                 ctx.beginPath();
                 ctx.arc(bellX, bellY, 4, 0, Math.PI * 2); // Bell is a small circle
                 ctx.fill();
                 // Tiny hanger line
                 ctx.strokeStyle = '#AAA';
                 ctx.lineWidth = 0.5;
                 ctx.beginPath(); ctx.moveTo(bellX, bellY - 4); ctx.lineTo(bellX, bellY - 7); ctx.stroke();
                 // =======================================


                 // === Draw Bell GLOW on LIGHT MASK ===
                 drawRadialGlow(lightMaskCtx, bellX, bellY, 18, glowColor, 0.9); // Relatively small glow radius per bell
                 // ===================================

                 // Advance position for the next bell
                 currentDist += bellSpacing;
                 totalBells++;
             }
            break; // End stripLight case

        case 'campingLight':
            color = 'rgba(255, 245, 190, 0.8)'; // Warmer, slightly wider glow
            radius = 95;
            drawRadialGlow(lightMaskCtx, x, y - 18, radius, color, intensity); // Glow originates inside lantern body
            break;

        case 'torch':
            color = 'rgba(255, 255, 230, 0.55)'; // Faint yellowish white
            radius = 80; // More focused beam radius
            // Originates from head (y-32), points down (around PI/2).
             // Narrow cone angles: 0.4 * PI (72 deg) to 0.6 * PI (108 deg) - Centered on down
             drawConeLight(lightMaskCtx, x, y - 32, Math.PI * 0.40 - 15, Math.PI * 0.60 - 15, radius, color, intensity * 1.1); // Slight intensity boost
            break;

        case 'fireStick':
             intensity = 0.6 + Math.sin(frameCount * 0.2) * 0.4; // Pulsating intensity (0.2 to 1.0)
             // Pulsating color - warmer red/orange
             color = `rgba(255, ${60 + Math.sin(frameCount * 0.15) * 50}, 0, 0.8)`;
             radius = 30 + intensity * 10; // Glow radius depends on intensity
             // Glow originates from ember tip (x+2, y-30)
             drawRadialGlow(lightMaskCtx, x + 2, y - 30, radius, color, intensity);
             break;

        case 'campfire':
             if (state !== 'lit') return; // Only add light if lit
             // Base intensity boosted by flick interaction + random flicker
             intensity = 0.9 + (light.flickIntensity || 0) * 0.015 + Math.random() * 0.15;
             intensity = Math.min(intensity, 1.5); // Cap max intensity
             radius = 90 + intensity * 20; // Overall glow radius linked to intensity

             // --- Overall Campfire Glow (Orange) ---
             drawRadialGlow(lightMaskCtx, x, y - 25, radius, 'rgba(255, 160, 0, 0.5)', intensity * 0.8); // Centered slightly above logs

              // --- Flickering Flame Glows (add variability) ---
              lightMaskCtx.save();
              lightMaskCtx.globalCompositeOperation = 'lighter';
              const numFlames = 2 + Math.floor(Math.random() * 3);
              const baseFlameHeight = 25;
              const flickerHeight = 20 * intensity;

               for (let i = 0; i < numFlames; i++) {
                    const flameX = x + (Math.random() - 0.5) * 25; // Wider horizontal spread
                    const flameY = y - 15; // Base of flames near top logs
                    const flameHeight = baseFlameHeight + (Math.random() - 0.5) * flickerHeight;
                    const flameRadius = 12 + Math.random() * 6;
                    // Varying orange/yellow flame color and alpha
                    const flameColor = `rgba(255, ${120 + Math.random() * 100}, 0, ${0.6 + Math.random() * 0.3})`;

                     // Use a radial gradient for each flame's light contribution
                     const flameGrad = lightMaskCtx.createRadialGradient(
                         flameX, flameY - flameHeight * 0.5, flameRadius * 0.1, // Inner center
                         flameX, flameY - flameHeight * 0.5, flameRadius * 1.5 // Outer edge
                     );
                     //flameGrad.addColorStop(0, flameColor.replace(/[\d\.]+\)$/g, `${Math.min(1, (parseFloat(flameColor.match(/[\d\.]+$/)[0]) + 0.2))})`)); // Brighter center
                     flameGrad.addColorStop(1, flameColor.replace(/[\d\.]+\)$/g, '0)')); // Fade out
                     lightMaskCtx.fillStyle = flameGrad;
                     lightMaskCtx.beginPath();
                      // Approximate elliptical glow shape for flames
                     lightMaskCtx.ellipse(flameX, flameY - flameHeight * 0.5, flameRadius, flameHeight * 0.6, 0, 0, Math.PI * 2);
                     lightMaskCtx.fill();
               }
               lightMaskCtx.restore(); // Restore composite operation

               // --- Embers Rising ---
              if (frameCount % 4 === 0 && Math.random() < 0.6 * intensity) { // More embers when brighter
                 light.embers = light.embers || [];
                 light.embers.push({
                     ex: x + (Math.random() - 0.5) * 20, // Originate from wider area
                     ey: y - 25 - Math.random() * 20, // Start slightly higher
                     alpha: 0.8 + Math.random() * 0.2, // Start bright
                     vy: -(0.6 + Math.random() * 0.9), // Faster rise?
                     vx: (Math.random() - 0.5) * 0.4 // Slight sideways drift
                 });
             }

             // Update and draw ember glows on the mask
             if (light.embers) {
                 lightMaskCtx.save();
                 lightMaskCtx.globalCompositeOperation = 'lighter'; // Embers add light
                 for (let i = light.embers.length - 1; i >= 0; i--) {
                     const ember = light.embers[i];
                     ember.ex += ember.vx;
                     ember.ey += ember.vy;
                     ember.vy *= 0.985; // Slow vertical rise slightly
                     ember.alpha -= 0.018; // Faster fade
                     if (ember.alpha <= 0) {
                         light.embers.splice(i, 1); // Remove dead embers
                     } else {
                          // Glowing ember particle
                         lightMaskCtx.fillStyle = `rgba(255, 150, 0, ${ember.alpha * 0.9})`;
                         lightMaskCtx.beginPath();
                         lightMaskCtx.arc(ember.ex, ember.ey, 1.5 + Math.random(), 0, Math.PI * 2);
                         lightMaskCtx.fill();
                     }
                 }
                 lightMaskCtx.restore();
             }
             break; // End campfire case

         case 'moon':
             color = 'rgba(245, 243, 206, 0.35)'; // Soft moonlight color
             radius = 130; // Wide, soft glow radius
             drawRadialGlow(lightMaskCtx, x, y, radius, color, 0.7); // Moon intensity fixed (or could vary phase?)
            break;
    }
}

// --- Animation Loop ---
function gameLoop() {
    frameCount++;
    // Update slow background offsets
    starOffset = (starOffset - STAR_SPEED); // Keep subtracting, wrapping happens in draw function
    treeOffset = (treeOffset - TREE_SPEED);

    // 1. Clear Main Canvas (potentially needed for alpha blending effects)
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 2. Draw Background Scene Layers
    drawBackground(); // Sky, ground, stars
    drawForestSilhouette(); // Trees

    // 3. Draw Physical OBJECTS (except Strip Light bells, which are drawn in step 4)
    placedLights.forEach(light => {
        // Only draw non-strip light objects here
        if (light.type !== 'stripLight') {
             switch (light.type) {
                case 'deskLamp': drawDeskLampObject(light); break;
                case 'penguinLed': drawPenguinLedObject(light); break;
                case 'campingLight': drawCampingLightObject(light); break;
                case 'torch': drawTorchObject(light); break;
                case 'fireStick': drawFireStickObject(light); break;
                case 'campfire': drawCampfireObject(light); break; // Logs + "Flick me" if unlit
            }
        } else {
            // Draw ONLY the wire for strip lights first
            drawStripLightObject(light);
        }
    });
    drawMoonObject(moon); // Draw the moon sphere object

    // 4. Prepare Light Mask and Draw Light Influence
    //    (This now ALSO draws the strip light BELLS onto the main canvas ctx)
    lightMaskCtx.clearRect(0, 0, canvasWidth, canvasHeight); // Clear mask
    lightMaskCtx.fillStyle = 'black'; // Mask base color
    lightMaskCtx.fillRect(0, 0, canvasWidth, canvasHeight);

    if (moon) addLightInfluence(moon); // Draw moon glow onto mask
    placedLights.forEach(light => {
        addLightInfluence(light); // Draws glows to mask + bells to main canvas for strips
    });

    // 5. Blend the completed Light Mask onto Main Canvas
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; // Additive blending
    ctx.drawImage(lightMaskCanvas, 0, 0);
    ctx.restore(); // Back to default 'source-over'

     // 6. Draw Strip Light Drawing Prompt (if in that mode)
     if (isDrawingStripMode && stripPlaceholderPos) {
         ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
         ctx.font = 'bold 14px sans-serif';
         ctx.textAlign = 'center';
          // Draw prompt slightly above placeholder position
         ctx.fillText('Click and drag on canvas to draw strip path', stripPlaceholderPos.x, stripPlaceholderPos.y - 15);
         // Simple crosshair marker at the position
         ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
         ctx.lineWidth = 1;
         ctx.beginPath();
         ctx.moveTo(stripPlaceholderPos.x - 8, stripPlaceholderPos.y); ctx.lineTo(stripPlaceholderPos.x + 8, stripPlaceholderPos.y);
         ctx.moveTo(stripPlaceholderPos.x, stripPlaceholderPos.y - 8); ctx.lineTo(stripPlaceholderPos.x, stripPlaceholderPos.y + 8);
         ctx.stroke();
     }

     // 7. Draw Dashed Line while Actively Drawing Strip Path (on top)
     if (isActivelyDrawingStrip && currentStripPoints.length > 0) {
         ctx.save();
         ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
         ctx.lineWidth = 2;
         ctx.setLineDash([6, 4]); // Dashed line style
         ctx.beginPath();
         ctx.moveTo(currentStripPoints[0].x, currentStripPoints[0].y);
         for (let i = 1; i < currentStripPoints.length; i++) {
             ctx.lineTo(currentStripPoints[i].x, currentStripPoints[i].y);
         }
         ctx.stroke();
         ctx.restore(); // Resets line dash, lineWidth, etc.
     }

    // === NEW: Remove Ghost Element if drag was cancelled unexpectedly ===
    // Defensive cleanup in case touchend didn't fire correctly
    if (!isTouchDraggingDrawerItem && touchDragGhostElement) {
         console.log("Ghost cleanup in game loop (unexpected)");
         document.body.removeChild(touchDragGhostElement);
         touchDragGhostElement = null;
    }
	
    // Request next frame
    animationFrameId = requestAnimationFrame(gameLoop);
}

// --- Event Handling ---

// Get Pointer Position relative to canvas, accounting for canvas scaling
function getPointerPos(event) {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    // Handle touch events (first touch point or changed touch for touchend)
    if (event.touches && event.touches.length > 0) {
        clientX = event.touches[0].clientX; clientY = event.touches[0].clientY;
    } else if (event.changedTouches && event.changedTouches.length > 0) {
        clientX = event.changedTouches[0].clientX; clientY = event.changedTouches[0].clientY;
    } else { // Mouse events
        clientX = event.clientX; clientY = event.clientY;
    }

     // Calculate scaling factor if CSS size differs from render size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

     // Apply scaling and offset
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    return { x, y };
}

// --- Drawer Item Interactions (HTML5 Drag & NEW Touch Drag) ---
drawerItems.forEach(item => {

    // --- HTML5 Drag & Drop (for Mouse) ---
    item.addEventListener('dragstart', (e) => {
        // Standard drag logic remains the same...
        isDrawingStripMode = false; isActivelyDrawingStrip = false; isInteractingCampfire = false; stripPlaceholderPos = null;

        const type = item.getAttribute('data-type');
        isDraggingItem = true; // Flag for standard drag
        draggedItemType = (type === 'stripLight') ? 'stripLightPlaceholder' : type;

        console.log(`Drag Start (Mouse): ${draggedItemType}`);
        canvas.style.cursor = 'grabbing';

        if(e.dataTransfer) {
            e.dataTransfer.setData('text/plain', draggedItemType);
            e.dataTransfer.effectAllowed = 'copy';
        }
    });

    item.addEventListener('dragend', (e) => {
        // Standard drag cleanup...
        if (isDraggingItem) { // Only reset if mouse drag was happening
            console.log("Drag End (Mouse) - Resetting");
             isDraggingItem = false;
             draggedItemType = null;
             // Cursor is reset by drop or pointer events on canvas
              // Reset just in case if no drop occurs:
              if (!isDrawingStripMode && !isInteractingCampfire && !isDraggingItem && !isTouchDraggingDrawerItem){
                  canvas.style.cursor = 'default';
              }
             // Ensure strip placeholder modes reset if drag cancelled
             if (draggedItemType === 'stripLightPlaceholder'){
                  isDrawingStripMode = false;
                  stripPlaceholderPos = null;
             }
        }
    });


    // --- NEW: Touch Event Listeners for Drawer Items ---
    item.addEventListener('touchstart', (e) => {
         // If already dragging with touch, ignore new touch
         if (isTouchDraggingDrawerItem) return;
          // Ignore if mouse drag is somehow active? (Shouldn't happen concurrently)
         if (isDraggingItem) return;

         // Prevent multi-touch drags for simplicity
          if (e.touches.length > 1) { return; }

          e.preventDefault(); // *** Crucial: Prevent page scroll during item drag ***

          const type = item.getAttribute('data-type');
          isTouchDraggingDrawerItem = true; // Set touch drag flag
          touchDraggedItemType = (type === 'stripLight') ? 'stripLightPlaceholder' : type;
          const touch = e.touches[0];
          touchDragStartX = touch.clientX;
          touchDragStartY = touch.clientY;

          console.log(`Touch Start Drag: ${touchDraggedItemType}`);

          // Create the visual ghost element
          touchDragGhostElement = document.createElement('div');
          touchDragGhostElement.className = 'drag-ghost';
          touchDragGhostElement.textContent = item.textContent; // Copy text
           // Special styling if it's the strip light
          if (type === 'stripLight') {
              touchDragGhostElement.style.backgroundColor = 'rgba(255, 204, 255, 0.8)'; // Lighter pink
              touchDragGhostElement.style.borderColor = '#e0a0e0';
          }
          document.body.appendChild(touchDragGhostElement);

           // Initial positioning - slightly offset from finger recommended
          const offsetX = -touchDragGhostElement.offsetWidth / 2; // Center horizontally
          const offsetY = -touchDragGhostElement.offsetHeight -10; // Position above finger
          touchDragGhostElement.style.transform = `translate3d(${touch.clientX + offsetX}px, ${touch.clientY + offsetY}px, 0)`;

          // Add move/end listeners to the *document* to capture events anywhere
          document.addEventListener('touchmove', handleDocumentTouchMove, { passive: false }); // Need preventDefault in move
          document.addEventListener('touchend', handleDocumentTouchEnd);
          document.addEventListener('touchcancel', handleDocumentTouchEnd); // Treat cancel like end

     }, { passive: false }); // Need passive false on start to allow preventDefault

});

// --- Global Touch Handlers (added dynamically during touch drag) ---

function handleDocumentTouchMove(e) {
    if (!isTouchDraggingDrawerItem) return;

    e.preventDefault(); // *** Crucial: Prevent page scroll while dragging item ***

    if (e.touches.length === 1 && touchDragGhostElement) {
        const touch = e.touches[0];
        // Update ghost position (offset same as in start)
        const offsetX = -touchDragGhostElement.offsetWidth / 2;
        const offsetY = -touchDragGhostElement.offsetHeight - 10;
         touchDragGhostElement.style.transform = `translate3d(${touch.clientX + offsetX}px, ${touch.clientY + offsetY}px, 0)`;
    }
}

function handleDocumentTouchEnd(e) {
     if (!isTouchDraggingDrawerItem) return;

     // No preventDefault here needed usually, but won't hurt

     console.log(`Touch End Drag: ${touchDraggedItemType}`);
     const touch = e.changedTouches[0]; // Use changedTouches for end event

     // 1. Check if dropped over the canvas
     const canvasRect = canvas.getBoundingClientRect();
     let droppedOnCanvas = false;
     if (touch) { // Check if touch data exists (might not on cancel sometimes?)
        droppedOnCanvas = (
             touch.clientX >= canvasRect.left &&
             touch.clientX <= canvasRect.right &&
             touch.clientY >= canvasRect.top &&
             touch.clientY <= canvasRect.bottom
         );
     }


     if (droppedOnCanvas) {
         console.log("--> Dropped on Canvas (Touch)");
         // Calculate position relative to canvas
         const pos = getPointerPos(e); // Use existing function, works for touch end event

          // Reuse the drop logic (same as mouse drop)
         // Handle STRIP LIGHT Placeholder Drop
         if (touchDraggedItemType === 'stripLightPlaceholder') {
             isDrawingStripMode = true; // Activate mode
             stripPlaceholderPos = pos; // Store pos
             canvas.style.cursor = 'crosshair'; // Show draw cursor (less relevant on touch but consistent)
             console.log("    Strip Light Placeholder set up.");
         }
         // Handle MOON Drop
         else if (touchDraggedItemType === 'moon') {
             const newItem = { type: 'moon', x: pos.x, y: Math.min(pos.y, canvasHeight * 0.7), state: 'on' };
             if (!moon) moon = newItem; else { moon.x = pos.x; moon.y = Math.min(pos.y, canvasHeight * 0.7); }
              console.log("    Moon position updated.");
         }
         // Handle REGULAR Light Drops
         else {
             const newItem = {
                 type: touchDraggedItemType, x: pos.x, y: pos.y,
                 state: (touchDraggedItemType === 'campfire') ? 'unlit' : 'on',
                 flickIntensity: 0, points: [], embers: []
             };
             placedLights.push(newItem);
              console.log(`    Light '${touchDraggedItemType}' added.`);
         }
         redrawScene(); // Update canvas
     } else {
          console.log("--> Dropped outside Canvas (Touch)");
           // Drag cancelled if dropped elsewhere
           if (touchDraggedItemType === 'stripLightPlaceholder'){
                 isDrawingStripMode = false;
                 stripPlaceholderPos = null;
           }
      }

     // 2. Cleanup
     if (touchDragGhostElement) {
         document.body.removeChild(touchDragGhostElement);
     }
     touchDragGhostElement = null;
     isTouchDraggingDrawerItem = false;
     touchDraggedItemType = null;
     document.removeEventListener('touchmove', handleDocumentTouchMove);
     document.removeEventListener('touchend', handleDocumentTouchEnd);
     document.removeEventListener('touchcancel', handleDocumentTouchEnd);

      // Reset cursor only if strip draw mode wasn't just activated
      if (!isDrawingStripMode){
          canvas.style.cursor = 'default';
      }
}

// --- Canvas Drag Over (Allow Drop) ---
canvas.addEventListener('dragover', (e) => {
    e.preventDefault(); // Necessary to allow dropping
    if (isDraggingItem) {
        if(e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; // Show copy cursor
    }
});

// --- Canvas Drop (Mouse - remains largely the same, checks correct flags) ---
canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    const pos = getPointerPos(e); // Works for drop events too

    // Make sure this drop is from a *mouse* drag
    if (!isDraggingItem) { // If not a mouse drag, ignore. Touch handled by touchend.
         console.log("Drop event ignored - not a mouse drag.");
         return;
     }

    const droppedType = e.dataTransfer ? e.dataTransfer.getData('text/plain') : draggedItemType; // Fallback needed?

    console.log(`Drop Event (Mouse). Type: ${droppedType}, Pos: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}`);

    if (isDraggingItem && droppedType) { // Double check flag just in case
         // === Handle STRIP LIGHT Placeholder Drop ===
         if (droppedType === 'stripLightPlaceholder') {
             isDrawingStripMode = true; // Activate strip drawing mode
             stripPlaceholderPos = pos;
             canvas.style.cursor = 'crosshair';
             console.log("--> Strip Light Placeholder Dropped (Mouse).");
         }
         // === Handle MOON Drop ===
         else if (droppedType === 'moon') {
             const newItem = { type: 'moon', x: pos.x, y: Math.min(pos.y, canvasHeight * 0.7), state: 'on' };
             if (!moon) moon = newItem; else { moon.x = pos.x; moon.y = Math.min(pos.y, canvasHeight * 0.7); }
             console.log("--> Moon Dropped/Moved (Mouse).");
         }
         // === Handle Other REGULAR Light Drops ===
         else {
              const newItem = {
                 type: droppedType, x: pos.x, y: pos.y,
                 state: (droppedType === 'campfire') ? 'unlit' : 'on',
                 flickIntensity: 0, points: [], embers: []
             };
             placedLights.push(newItem);
             console.log(`--> Regular light '${droppedType}' added (Mouse).`);
         }
         redrawScene(); // Update canvas immediately after drop
    } else {
        console.warn("Drop event occurred but not in valid mouse dragging state or type was lost.");
    }

     // --- Reset states AFTER mouse drop processing ---
     isDraggingItem = false;
     draggedItemType = null;
     isInteractingCampfire = false;

     // Set cursor based on whether strip mode was just activated
     if (!isDrawingStripMode) {
         canvas.style.cursor = 'default';
     } else {
          canvas.style.cursor = 'crosshair';
      }
});



// --- Canvas Pointer Event Handlers (Combined Mouse/Touch) ---

function handlePointerDown(e) {
     // Prevent default only if an interaction is initiated
    // e.preventDefault(); // <-- Moved preventDefault inside specific interaction blocks

    const pos = getPointerPos(e);
    console.log(`Pointer Down at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}), Strip Mode: ${isDrawingStripMode}, Active Draw: ${isActivelyDrawingStrip}`);

    // --- 1. Try to START Drawing Strip ---
    if (isDrawingStripMode && !isActivelyDrawingStrip) {
        e.preventDefault(); // Prevent text select/etc. during drawing
        isActivelyDrawingStrip = true;
        currentStripPoints = [pos]; // Initialize points array
        stripPlaceholderPos = null; // Remove the prompt text trigger
        console.log("--> Started ACTUALLY drawing strip line.");
        canvas.style.cursor = 'crosshair'; // Maintain crosshair during draw
        return; // Prioritize this action
    }

    // If not starting strip draw, check other interactions (only if not currently drawing)
    if (!isActivelyDrawingStrip) {
         // --- 2. Try to Start Campfire Interaction ---
         interactingCampfire = null; // Reset before check
          for (let i = placedLights.length - 1; i >= 0; i--) {
             const light = placedLights[i];
             if (light.type === 'campfire' && light.state === 'unlit') {
                 const dist = Math.sqrt(Math.pow(pos.x - light.x, 2) + Math.pow(pos.y - (light.y - 10), 2)); // Check near center
                 if (dist < 25) {
                     e.preventDefault(); // Prevent scrolling during flick attempt
                     isInteractingCampfire = true;
                     interactingCampfire = light;
                     interactionStartPos = pos;
                     interactionStartTime = Date.now();
                     console.log("--> Started interacting with campfire.");
                     canvas.style.cursor = 'pointer'; // Indicate interactive object
                     return; // Found interactive object
                 }
             }
         }

         // --- 3. Try to Start Moon Dragging ---
         if (moon) {
              const dist = Math.sqrt(Math.pow(pos.x - moon.x, 2) + Math.pow(pos.y - moon.y, 2));
              if (dist < 30) { // Within moon radius
                   e.preventDefault(); // Prevent page scroll during drag
                   isDraggingItem = true; // Use general drag flag
                   draggedItemType = 'moon'; // Specifically identify moon drag
                   dragOffsetX = pos.x - moon.x;
                   dragOffsetY = pos.y - moon.y;
                   console.log("--> Started dragging moon.");
                   canvas.style.cursor = 'grabbing'; // Indicate dragging action
                   return; // Found interactive object
              }
         }
    } // End check for other interactions

     // If no interaction was started... do nothing specific on down.
     // Don't cancel strip mode here - user might just mis-click.
}

function handlePointerMove(e) {
    // Only process moves if an interaction is active
     if (!isActivelyDrawingStrip && !isInteractingCampfire && !isDraggingItem) {
         return;
     }

    const pos = getPointerPos(e);

    // --- 1. Continue Drawing Strip Line ---
    if (isActivelyDrawingStrip) {
        e.preventDefault(); // Prevent unwanted actions during line draw
        const lastPoint = currentStripPoints[currentStripPoints.length - 1];
        const distSq = Math.pow(pos.x - lastPoint.x, 2) + Math.pow(pos.y - lastPoint.y, 2);
        // Only add point if moved a minimum distance to avoid dense points
        if (distSq > 5 * 5) { // Square of min distance (e.g., 5 pixels)
            currentStripPoints.push(pos);
            // Redraw handled by animation loop
        }
        return;
    }

    // --- 2. Continue Dragging Moon ---
    if (isDraggingItem && draggedItemType === 'moon') {
        e.preventDefault(); // Prevent scroll etc. during moon drag
        moon.x = pos.x - dragOffsetX;
         // Constrain moon Y position to upper part of canvas
        moon.y = Math.min(pos.y - dragOffsetY, canvasHeight * 0.75);
        // Redraw handled by animation loop
        return;
    }

    // --- 3. Moving During Campfire Interaction (for flick calc later) ---
    if (isInteractingCampfire) {
        e.preventDefault(); // Prevent scroll during flick gesture
        // Position tracked implicitly by interactionStartPos and final pos on PointerUp
        return;
    }
}

function handlePointerUp(e) {
    const pos = getPointerPos(e); // Get position at end of interaction

    let wasInteracting = isActivelyDrawingStrip || isInteractingCampfire || (isDraggingItem && draggedItemType === 'moon');
     console.log(`Pointer Up at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}), Was Interacting: ${wasInteracting}`);


     if (wasInteracting) {
         // Use preventDefault if finishing a specific interaction to maybe stop a 'click' event firing
         // Be cautious as it might block intended behavior sometimes. Test needed.
          e.preventDefault();
      }


    // --- 1. Finalize Strip Light Drawing ---
    if (isActivelyDrawingStrip) {
        console.log("--> Finalizing strip light draw.");
        if (currentStripPoints.length > 1) {
            const newStrip = {
                type: 'stripLight',
                points: [...currentStripPoints], // Copy points
                state: 'on', // Bells handle their own visuals, state is just 'on'
            };
            placedLights.push(newStrip);
            console.log(`    Strip added with ${newStrip.points.length} points.`);
        } else {
            console.log("    Strip too short, cancelled.");
        }
        // Reset ALL strip-related states
        isActivelyDrawingStrip = false;
        isDrawingStripMode = false;
        currentStripPoints = [];
        stripPlaceholderPos = null;
        canvas.style.cursor = 'default'; // Reset cursor
        redrawScene(); // Force immediate redraw to show final strip
        return; // Action completed
    }

    // --- 2. Finalize Campfire Interaction ---
    if (isInteractingCampfire && interactingCampfire && interactionStartPos) {
        console.log("--> Finalizing campfire interaction.");
        const interactionEndTime = Date.now();
        const deltaX = pos.x - interactionStartPos.x;
        const deltaY = interactionStartPos.y - pos.y; // Upward is positive Y difference
        const deltaTime = interactionEndTime - interactionStartTime;
        const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        console.log(`    Flick check: dY=${deltaY.toFixed(1)}, dist=${dist.toFixed(1)}, dT=${deltaTime}ms`);

        // Check for a reasonably quick, upward flick
        if (deltaY > 25 && dist > 30 && deltaTime < 450) { // Adjust thresholds as needed
            interactingCampfire.state = 'lit';
            interactingCampfire.flickIntensity = 10; // Give initial burst
            console.log("    Campfire flick SUCCESS -> Lit!");
            redrawScene(); // Update visually
        } else {
            console.log("    Campfire flick FAILED (thresholds not met).");
        }
        // Reset campfire interaction states
        isInteractingCampfire = false;
        interactingCampfire = null;
        interactionStartPos = null;
        canvas.style.cursor = 'default';
        return; // Action completed
    }

    // --- 3. Finalize Moon Drag ---
    if (isDraggingItem && draggedItemType === 'moon') {
        console.log("--> Finalizing moon drag.");
        // Reset moon dragging states
        isDraggingItem = false;
        draggedItemType = null;
        canvas.style.cursor = 'default';
        // Position already updated in move, redraw handled by loop or next interaction
        return; // Action completed
    }


     // --- Cleanup: If user just clicks while in strip mode without drawing ---
      if (!wasInteracting && isDrawingStripMode) {
          console.log("Pointer Up clicked while in strip mode but not drawing. Cancelling mode.");
          isDrawingStripMode = false;
          stripPlaceholderPos = null;
          canvas.style.cursor = 'default';
           redrawScene(); // Redraw to remove prompt if it was visible
       }
      // General cursor reset if no other state requires a specific cursor
     if (!isDrawingStripMode && !isInteractingCampfire && !isDraggingItem) {
         canvas.style.cursor = 'default';
     }
}

// Handle Pointer Leaving Canvas Area
canvas.addEventListener('pointerleave', (e) => {
    console.log("Pointer Left Canvas Area");

     // If an interaction was actively happening, treat it like pointer up to finalize/cancel
     if (isActivelyDrawingStrip || isInteractingCampfire || (isDraggingItem && draggedItemType === 'moon')) {
        console.log("--- Finalizing active interaction due to pointerleave");
        handlePointerUp(e); // Simulate pointer up to properly clean up states
     } else if (isDrawingStripMode) {
         // If just the placeholder prompt was showing, cancel the mode
         console.log("--- Cancelling strip drawing mode due to pointerleave");
         isDrawingStripMode = false;
         stripPlaceholderPos = null;
         canvas.style.cursor = 'default';
         redrawScene(); // Redraw to remove prompt
     }
      // Also reset generic drag state if item dragged off canvas
      if (isDraggingItem) {
         console.log("--- Resetting generic dragging state due to pointerleave")
         isDraggingItem = false;
         draggedItemType = null;
         canvas.style.cursor = 'default';
      }
});

// Attach unified pointer event listeners
canvas.addEventListener('pointerdown', handlePointerDown);
canvas.addEventListener('pointermove', handlePointerMove);
canvas.addEventListener('pointerup', handlePointerUp);


// --- Control Button Listeners ---
btnMidnight.addEventListener('click', () => { timeOfDay = 'midnight'; redrawScene(); });
btnDawn.addEventListener('click', () => { timeOfDay = 'dawn'; redrawScene(); });
btnClear.addEventListener('click', () => {
    placedLights = [];
    moon = null;
     // Stop interaction states if clearing
    isActivelyDrawingStrip = false;
    isDrawingStripMode = false;
    isInteractingCampfire = false;
    isDraggingItem = false;
    stripPlaceholderPos = null;
    currentStripPoints = [];
    canvas.style.cursor = 'default';
    console.log("Scene Cleared.");
    redrawScene();
});

// --- Fullscreen Functionality ---
function toggleFullScreen() {
    const docEl = document.documentElement;
    const requestFS = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
    const exitFS = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
    const isFs = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;

    if (!isFs && requestFS) {
        console.log("Requesting Fullscreen");
         requestFS.call(docEl).catch(err => console.error(`Error requesting fullscreen: ${err.message}`, err));
    } else if (isFs && exitFS) {
        console.log("Exiting Fullscreen");
        exitFS.call(document).catch(err => console.error(`Error exiting fullscreen: ${err.message}`, err));
    } else {
         console.warn("Fullscreen API not fully supported or action failed.");
     }
     // Canvas resize is handled by the 'fullscreenchange' event listener
}

btnFullscreen.addEventListener('click', toggleFullScreen);

// Function to handle resize when fullscreen status changes
function onFullscreenChange() {
     const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
     console.log(`Fullscreen change detected. Is Fullscreen: ${isFs}`);
     // Delay resize slightly to allow browser layout adjustments
     setTimeout(setupCanvas, 100);
}

// Listen for fullscreen change events (vendor prefixes)
document.addEventListener('fullscreenchange', onFullscreenChange);
document.addEventListener('webkitfullscreenchange', onFullscreenChange);
document.addEventListener('mozfullscreenchange', onFullscreenChange);
document.addEventListener('MSFullscreenChange', onFullscreenChange);


// --- Redraw Scene Function (Force immediate update) ---
function redrawScene() {
    // Ensures canvas is redrawn instantly after state changes (like drops, button clicks)
    // instead of waiting for the next animation frame.
    console.log("Redraw Scene Called");
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId); // Stop current loop
        animationFrameId = null;
    }
     // Manually execute one render cycle immediately:
    frameCount++; // Keep frame consistent

    // Clear, Draw Background, Draw Objects, Prep Mask, Draw Influence, Blend Mask, Draw UI
     ctx.clearRect(0, 0, canvasWidth, canvasHeight);
     drawBackground();
     drawForestSilhouette();
     placedLights.forEach(light => { /* ... draw objects / wire ... */ });
     drawMoonObject(moon);
     lightMaskCtx.clearRect(0, 0, canvasWidth, canvasHeight); lightMaskCtx.fillStyle = 'black'; lightMaskCtx.fillRect(0, 0, canvasWidth, canvasHeight);
     if (moon) addLightInfluence(moon);
     placedLights.forEach(light => addLightInfluence(light));
     ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(lightMaskCanvas, 0, 0); ctx.restore();
     if (isDrawingStripMode && stripPlaceholderPos) { /* ... draw prompt ... */ }
     if (isActivelyDrawingStrip && currentStripPoints.length > 0) { /* ... draw dashed line ... */ }

    // Restart the animation loop
    gameLoop();
}

// --- Window Resize Handler (Debounced) ---
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        console.log("Window resized event - running setupCanvas");
        setupCanvas();
        // No need to call redrawScene here, setupCanvas includes it
    }, 150); // Delay processing resize events
});

// --- Initial Setup & Start ---
console.log("Initializing Forest of Lights...");
setupCanvas(); // Set initial canvas size and draw
gameLoop();    // Start the animation loop