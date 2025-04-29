// Import Matter.js modules
// @ts-ignore
const Engine = Matter.Engine;
// @ts-ignore
const Render = Matter.Render;
// @ts-ignore
const World = Matter.World;
// @ts-ignore
const Bodies = Matter.Bodies;
// @ts-ignore
const Constraint = Matter.Constraint;
// @ts-ignore
const Mouse = Matter.Mouse;
// @ts-ignore
const MouseConstraint = Matter.MouseConstraint;
// @ts-ignore
const Events = Matter.Events;
// @ts-ignore
const Body = Matter.Body;

// Create engine and world
const engine = Engine.create();
engine.world.gravity.y = 0; // Disable gravity

// Create renderer
const render = Render.create({
    // @ts-ignore
    element: document.body,
    engine: engine,
    options: {
        // @ts-ignore
        width: window.innerWidth,
        // @ts-ignore
        height: window.innerHeight,
        wireframes: false,
        background: 'white'
    }
});

// Define the center of the circular motion
// @ts-ignore
const centerX = window.innerWidth / 2;
// @ts-ignore
const centerY = window.innerHeight / 2;
const radius = 150; // Radius of the circular path

// Create the object (representing egg whites)
const eggWhite = Bodies.rectangle(centerX + radius, centerY, 50, 50, {
    render: { fillStyle: 'black' },
    frictionAir: 0.01, // Start with low friction for high momentum
    restitution: 0.5
});
eggWhite.originalFrictionAir = eggWhite.frictionAir; // Store initial friction
World.add(engine.world, eggWhite);

// Create a static center point and constrain the egg white to it
const centerPoint = Bodies.circle(centerX, centerY, 5, { isStatic: true, render: { fillStyle: 'white' } });
const orbitConstraint = Constraint.create({
    bodyA: centerPoint,
    bodyB: eggWhite,
    length: radius,
    stiffness: 0,
    render: { visible: false }
});
World.add(engine.world, [centerPoint, orbitConstraint]);

// Add mouse constraint for dragging with adjustable stiffness
const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
        stiffness: 0.005, // Initial stiffness (runny)
        render: { visible: false }
    }
});
mouseConstraint.constraint.originalStiffness = mouseConstraint.constraint.stiffness; // Store initial stiffness
World.add(engine.world, mouseConstraint);

// Track dragging and texture transition
let whiskingProgress = 0;
const maxWhisking = 100;
let lastAngle = null;
let isDragging = false;
let cursorTrackData = [];
let lastMouseX = null;
let lastMouseY = null;
let lastMouseTime = null;

// NEW: Variables for silent logging and secret gesture
let logs = []; // Array to store logs
let touchEvents = []; // Track touch events for the secret gesture
const doubleTapThreshold = 300; // 300ms between taps for a double-tap
const swipeThreshold = 100; // Minimum vertical distance for a swipe down

// NEW: Log function to store in localStorage
function log(message) {
    logs.push(message);
    localStorage.setItem('speedLogs', logs.join('\n')); // Save to localStorage
}

// NEW: Add touch event listeners for the secret gesture (double-tap + swipe down)
const canvas = document.querySelector('canvas');
canvas.addEventListener('touchstart', (event) => {
    if (event.touches.length === 1) { // Only handle single-touch
        const touch = event.touches[0];
        touchEvents.push({
            time: Date.now(),
            x: touch.clientX,
            y: touch.clientY,
            type: 'start'
        });
        event.preventDefault(); // Prevent scrolling
    }
});

canvas.addEventListener('touchmove', (event) => {
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        touchEvents.push({
            time: Date.now(),
            x: touch.clientX,
            y: touch.clientY,
            type: 'move'
        });
        event.preventDefault(); // Prevent scrolling during single-touch
    }
});

canvas.addEventListener('touchend', (event) => {
    touchEvents.push({
        time: Date.now(),
        type: 'end'
    });

    // Check for double-tap (two 'end' events within 300ms)
    const recentEnds = touchEvents.filter(e => e.type === 'end').slice(-2);
    const recentStarts = touchEvents.filter(e => e.type === 'start').slice(-2);
    let isDoubleTap = false;
    if (recentEnds.length >= 2 && recentStarts.length >= 2) {
        const timeDiff = recentEnds[1].time - recentEnds[0].time;
        if (timeDiff <= doubleTapThreshold && timeDiff > 0) {
            isDoubleTap = true;
        }
    }

    // Check for swipe down after double-tap
    if (isDoubleTap) {
        const lastStart = recentStarts[recentStarts.length - 1];
        const moves = touchEvents.filter(e => e.type === 'move' && e.time > lastStart.time);
        if (moves.length > 0) {
            const firstY = lastStart.y;
            const lastY = moves[moves.length - 1].y;
            const deltaY = lastY - firstY;
            if (deltaY > swipeThreshold) { // Swipe down detected
                // Save logs to a downloadable file
                const logText = localStorage.getItem('speedLogs') || '';
                const blob = new Blob([logText], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `speed_logs_${getTimestamp().replace(/:/g, '-')}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                // Clear touch events to prevent multiple triggers
                touchEvents = [];
            }
        }
    }

    // Clean up old touch events (keep only the last 10 to avoid memory buildup)
    if (touchEvents.length > 10) {
        touchEvents = touchEvents.slice(-10);
    }
});

Events.on(engine, 'afterUpdate', () => {
    // Calculate the current angle of the eggWhite relative to the center
    const dx = eggWhite.position.x - centerX;
    const dy = eggWhite.position.y - centerY;
    const currentAngle = Math.atan2(dy, dx);

    let speed = 0;
    // @ts-ignore
    const now = performance.now();

    if (mouseConstraint.body === eggWhite) { // If dragging the egg white (works for both mouse and touch)
        isDragging = true;
        if (lastAngle !== null) {
            // Calculate the angular difference (in radians)
            let angleDiff = currentAngle - lastAngle;
            if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            whiskingProgress += Math.abs(angleDiff) * 0.1; // Sensitivity remains at 2
            if (whiskingProgress > maxWhisking) whiskingProgress = maxWhisking;
        }
        lastAngle = currentAngle;

        // Update texture (increase friction to reduce momentum)
        const progressRatio = whiskingProgress / maxWhisking;
        eggWhite.frictionAir = 0.01 + 0.99 * progressRatio; // 0.01 to 1.0 (increased from 0.8)

        // Dampen angular velocity to enhance slowing effect
        const angularDamping = 0.3; // More aggressive damping (reduced from 0.5)
        Body.setAngularVelocity(eggWhite, eggWhite.angularVelocity * angularDamping);

        // Stop the object completely if whiskingProgress is at maximum
        if (whiskingProgress >= maxWhisking) {
            Body.setAngularVelocity(eggWhite, 0);
            eggWhite.frictionAir = 0.5; // Ensure no residual motion
        }

        // Make the square lag behind the cursor by reducing mouse constraint stiffness
        mouseConstraint.constraint.stiffness = 0.05 - 0.049 * progressRatio; // 0.05 to 0.001 (reduced from 0.005)

        // Calculate speed (same for mouse and touch, as Matter.Mouse handles both)
        if (lastMouseX !== null && lastMouseY !== null && lastMouseTime !== null) {
            const dx = mouse.position.x - lastMouseX;
            const dy = mouse.position.y - lastMouseY;
            const dt = (now - lastMouseTime) / 1000; // Convert ms to seconds

            if (dt > 0) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                speed = distance / dt; // pixels per second
            }
        }

        // Log the speed to localStorage (no visible UI)
        log(`${getTimestamp()} - Speed: ${speed.toFixed(2)} px/s, whiskingProgress: ${whiskingProgress.toFixed(2)}`);

        // Save current for next frame
        lastMouseX = mouse.position.x;
        lastMouseY = mouse.position.y;
        lastMouseTime = now;

        cursorTrackData.push({
            // @ts-ignore
            timestamp: performance.now(), // High-resolution time
            whiskingProgress: whiskingProgress,
            mouseSpeed: speed
        });
    } else if (isDragging) {
        // Gradually decrease whiskingProgress when not dragging
        whiskingProgress -= 0.9; // Adjust this value to control the speed of the transition
        if (whiskingProgress < 0) whiskingProgress = 0;

        // Update properties based on the new whiskingProgress
        const progressRatio = whiskingProgress / maxWhisking;
        eggWhite.frictionAir = 0.01 + 0.49 * progressRatio; // Gradually decrease to 0.01
        mouseConstraint.constraint.stiffness = 0.05 - 0.049 * progressRatio; // Gradually increase to 0.05

        // Apply stopping logic if whiskingProgress is still at maximum
        if (whiskingProgress >= maxWhisking) {
            Body.setAngularVelocity(eggWhite, 0);
        }
    }
});

Events.on(mouseConstraint, 'mouseup', () => {
    if (isDragging) {
        isDragging = false;
        lastAngle = null;
    }
});

// NEW: Also handle touchend to reset dragging state
Events.on(mouseConstraint, 'enddrag', () => {
    if (isDragging) {
        isDragging = false;
        lastAngle = null;
    }
});

const getTimestamp = () => new Date().toISOString();

function calculateAverageSpeedByProgress(cursorTrackData) {
    const buckets = {}; // Object to store speed sums and counts per bucket

    cursorTrackData.forEach(entry => {
        const progressPercent = (entry.whiskingProgress / 100) * 100;
        const bucket = Math.floor(progressPercent / 5) * 5; // Group into by 5 percent

        if (!buckets[bucket]) {
            buckets[bucket] = { totalSpeed: 0, count: 0 };
        }

        buckets[bucket].totalSpeed += entry.mouseSpeed;
        buckets[bucket].count++;
    });

    // 2. Calculate averages
    const averages = {};
    for (the bucket in buckets) {
        averages[bucket] = buckets[bucket].totalSpeed / buckets[bucket].count;
    }

    return averages;
}

// @ts-ignore
document.addEventListener('keydown', (event) => {
    switch (event.key) {
        case 'c': // User noticed texture change
            // @ts-ignore
            console.log(`${getTimestamp()} - User noticed change at whiskingProgress: ${whiskingProgress.toFixed(2)} (${(whiskingProgress / maxWhisking * 100).toFixed(2)}%), frictionAir: ${eggWhite.frictionAir.toFixed(3)}, stiffness: ${mouseConstraint.constraint.stiffness.toFixed(4)}`);
            break;
        case 'd': // tracking data
            const avgSpeeds = calculateAverageSpeedByProgress(cursorTrackData);
            // @ts-ignore
            console.log('Average mouse speeds by 5% progress:', avgSpeeds);
            break;
    }
});

// Run the renderer and engine
Render.run(render);
Engine.run(engine);
