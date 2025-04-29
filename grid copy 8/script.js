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

// NEW: Variables for touch speed logging and averaging
let touchStartTime = null;
const longPressDuration = 1000; // 1 second for long press to toggle logs
let logs = []; // Array to store logs for localStorage
let speedBuckets = {}; // Object to store speed sums and counts per bucket
let lastLoggedBucket = -1; // Track the last bucket we logged

// NEW: Create a hidden div for logging average speeds
const logDiv = document.createElement('div');
logDiv.id = 'speedLog';
logDiv.style.position = 'absolute';
logDiv.style.top = '0';
logDiv.style.left = '0';
logDiv.style.background = '#f0f0f0'; // Light gray for better visibility
logDiv.style.color = 'black';
logDiv.style.padding = '10px';
logDiv.style.maxHeight = '200px';
logDiv.style.overflowY = 'scroll';
logDiv.style.display = 'none'; // Hidden by default
logDiv.style.zIndex = '1000'; // Ensure it’s on top
logDiv.style.fontSize = '12px';
logDiv.style.border = '1px solid #ccc'; // Add a border for clarity
document.body.appendChild(logDiv);

// NEW: Log function to append to the div and localStorage
function log(message) {
    logs.push(message);
    localStorage.setItem('speedLogs', logs.join('\n')); // Save to localStorage
    logDiv.innerHTML += message + '<br>';
    logDiv.scrollTop = logDiv.scrollHeight; // Auto-scroll to the bottom
}

// NEW: Add a button to copy logs to clipboard
const copyButton = document.createElement('button');
copyButton.innerText = 'Copy Logs';
copyButton.style.position = 'absolute';
copyButton.style.top = '600px'; // Below the log div
copyButton.style.left = '0';
copyButton.style.padding = '5px';
copyButton.style.fontSize = '12px';
document.body.appendChild(copyButton);

copyButton.addEventListener('click', () => {
    const logText = logs.join('\n');
    navigator.clipboard.writeText(logText).then(() => {
        alert('Logs copied to clipboard!');
    }).catch(err => {
        alert('Failed to copy logs: ' + err);
    });
});

// NEW: Add touch event listeners to the canvas for long-press toggle
const canvas = document.querySelector('canvas');
canvas.addEventListener('touchstart', (event) => {
    if (event.touches.length === 1) { // Only handle single-touch
        touchStartTime = Date.now();
        event.preventDefault(); // Prevent scrolling
    }
});

canvas.addEventListener('touchend', (event) => {
    if (touchStartTime) {
        const touchEndTime = Date.now();
        if (touchEndTime - touchStartTime >= longPressDuration) {
            // Long press detected, toggle log visibility
            logDiv.style.display = logDiv.style.display === 'none' ? 'block' : 'none';
        }
        touchStartTime = null;
    }
});

canvas.addEventListener('touchmove', (event) => {
    if (event.touches.length === 1) {
        event.preventDefault(); // Prevent scrolling during single-touch
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

        // NEW: Add speed to the appropriate bucket
        const progressPercent = (whiskingProgress / maxWhisking) * 100;
        const currentBucket = Math.floor(progressPercent / 5) * 5; // Bucket: 0, 5, 10, ..., 95

        if (!speedBuckets[currentBucket]) {
            speedBuckets[currentBucket] = { totalSpeed: 0, count: 0 };
        }
        speedBuckets[currentBucket].totalSpeed += speed;
        speedBuckets[currentBucket].count++;

        // NEW: Log the average for the previous bucket when we move to a new bucket
        const previousBucket = currentBucket - 5;
        if (previousBucket >= 0 && previousBucket > lastLoggedBucket && speedBuckets[previousBucket]) {
            const avgSpeed = speedBuckets[previousBucket].totalSpeed / speedBuckets[previousBucket].count;
            log(`${getTimestamp()} - for ${previousBucket}% to ${previousBucket + 5}%: ${avgSpeed.toFixed(2)} px/s`);
            lastLoggedBucket = previousBucket;
        }

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

        // NEW: Log the average for the last bucket when dragging stops
        const progressPercent = (whiskingProgress / maxWhisking) * 100;
        const currentBucket = Math.floor(progressPercent / 5) * 5;
        const previousBucket = currentBucket - 5;
        if (previousBucket >= 0 && previousBucket > lastLoggedBucket && speedBuckets[previousBucket]) {
            const avgSpeed = speedBuckets[previousBucket].totalSpeed / speedBuckets[previousBucket].count;
            log(`${getTimestamp()} - for ${previousBucket}% to ${previousBucket + 1}%: ${avgSpeed.toFixed(2)} px/s`);
            lastLoggedBucket = previousBucket;
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
        const bucket = Math.floor(progressPercent / 10) * 10; // Group into by 5 percent

        if (!buckets[bucket]) {
            buckets[bucket] = { totalSpeed: 0, count: 0 };
        }

        buckets[bucket].totalSpeed += entry.mouseSpeed;
        buckets[bucket].count++;
    });

    // 2. Calculate averages
    const averages = {};
    for (const bucket in buckets) {
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
