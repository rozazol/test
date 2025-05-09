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

// Variables for additional metrics
let dragStartTime = null;
let pauseStartTime = null;
let pauseDurations = [];
let logs = [];
let touchStartTime = null;
const longPressDuration = 1000; // 1 second for long press to toggle logs
let speedBuckets = {}; // Store metrics by 1% buckets
let lastLoggedBucket = -1; // Track the last bucket logged
let lastProgressLogBucket = -1; // Track the last 1% bucket for progress logging

// Variables for freezing displayed progress
let displayedProgress = 0; // Progress shown to the user and used for physics
let isProgressFrozen = false; // Is the displayed progress currently frozen?
let freezeStartTime = null; // When the freeze started
let freezeDuration = 0; // Duration of the current freeze
let lastCheckedBucket = -1; // Track the last progress bucket checked for freezing
let lastUnfrozenTime = null; // Track when progress was last unfrozen to prevent rapid re-freezing
let frozenProgressValue = 0; // Store the displayedProgress value when frozen
let frozenWhiskingProgress = 0; // Store the whiskingProgress value when frozen

// Create a hidden div for logging
const logDiv = document.createElement('div');
logDiv.id = 'metricsLog';
logDiv.style.position = 'absolute';
logDiv.style.top = '0';
logDiv.style.left = '0';
logDiv.style.background = '#f0f0f0'; // Light gray for better visibility
logDiv.style.color = 'black';
logDiv.style.padding = '10px';
logDiv.style.maxHeight = '200px';
logDiv.style.overflowY = 'scroll';
logDiv.style.display = 'none'; // Hidden by default
logDiv.style.zIndex = '1000'; // Ensure it's on top
logDiv.style.fontSize = '12px';
logDiv.style.border = '1px solid #ccc'; // Add a border for clarity
document.body.appendChild(logDiv);

// Create a div to display the progress
//const progressDisplay = document.createElement('div');
// progressDisplay.id = 'progressDisplay';
// progressDisplay.style.position = 'absolute';
// progressDisplay.style.top = '10px';
// progressDisplay.style.left = '10px';
// progressDisplay.style.background = '#f0f0f0';
// progressDisplay.style.padding = '5px';
// progressDisplay.style.fontSize = '16px';
// progressDisplay.style.zIndex = '1000';
// progressDisplay.innerText = 'Progress: 0%';
// document.body.appendChild(progressDisplay);

// Add a button to copy logs to clipboard
const copyButton = document.createElement('button');
copyButton.innerText = 'Copy Logs';
copyButton.style.position = 'absolute';
copyButton.style.top = '220px'; // Below the log div
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

// Add touch event listeners for long-press toggle
const canvas = document.querySelector('canvas');
canvas.addEventListener('touchstart', (event) => {
    if (event.touches.length === 1) {
        touchStartTime = Date.now();
        event.preventDefault(); // Prevent scrolling
    }
});

canvas.addEventListener('touchend', (event) => {
    if (touchStartTime) {
        const touchEndTime = Date.now();
        if (touchEndTime - touchStartTime >= longPressDuration) {
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

// Log function to append to the div and localStorage
function log(message) {
    logs.push(message);
    localStorage.setItem('metricsLogs', logs.join('\n')); // Save to localStorage
    logDiv.innerHTML += message + '<br>';
    logDiv.scrollTop = logDiv.scrollHeight; // Auto-scroll to the bottom
}

// Track drag start and end for drag duration
Events.on(mouseConstraint, 'mousedown', () => {
    if (mouseConstraint.body === eggWhite) {
        dragStartTime = performance.now();
        if (pauseStartTime) {
            const pauseDuration = (performance.now() - pauseStartTime) / 1000; // in seconds
            pauseDurations.push(pauseDuration);
            pauseStartTime = null;
        }
    }
});

Events.on(mouseConstraint, 'mouseup', () => {
    if (isDragging) {
        isDragging = false;
        lastAngle = null;
        if (dragStartTime) {
            const dragDuration = (performance.now() - dragStartTime) / 1000; // in seconds
            const progressPercent = (whiskingProgress / maxWhisking) * 100;
            const currentBucket = Math.floor(progressPercent);
            if (!speedBuckets[currentBucket]) {
                speedBuckets[currentBucket] = { totalDuration: 0, count: 0 };
            }
            speedBuckets[currentBucket].totalDuration += dragDuration;
            speedBuckets[currentBucket].count++;
            log(`${getTimestamp()} - Drag duration: ${dragDuration.toFixed(2)} s at whiskingProgress: ${progressPercent.toFixed(2)}%, displayedProgress: ${displayedProgress.toFixed(2)}%`);
            dragStartTime = null;
        }
        pauseStartTime = performance.now();
    }
});

// Also handle touchend to reset dragging state
Events.on(mouseConstraint, 'enddrag', () => {
    if (isDragging) {
        isDragging = false;
        lastAngle = null;
        if (dragStartTime) {
            const dragDuration = (performance.now() - dragStartTime) / 1000; // in seconds
            const progressPercent = (whiskingProgress / maxWhisking) * 100;
            const currentBucket = Math.floor(progressPercent);
            if (!speedBuckets[currentBucket]) {
                speedBuckets[currentBucket] = { totalDuration: 0, count: 0 };
            }
            speedBuckets[currentBucket].totalDuration += dragDuration;
            speedBuckets[currentBucket].count++;
            log(`${getTimestamp()} - Drag duration: ${dragDuration.toFixed(2)} s at whiskingProgress: ${progressPercent.toFixed(2)}%, displayedProgress: ${displayedProgress.toFixed(2)}%`);
            dragStartTime = null;
        }
        pauseStartTime = performance.now();
    }
});

// Function to calculate recent progress rate (progress per second)
function calculateProgressRate() {
    const now = performance.now();
    const timeWindow = 1000; // 1-second window
    const recentData = cursorTrackData.filter(entry => now - entry.timestamp <= timeWindow);

    if (recentData.length < 2) {
        return null; // Not enough data to calculate rate
    }

    const firstEntry = recentData[0];
    const lastEntry = recentData[recentData.length - 1];
    const progressDiff = lastEntry.whiskingProgress - firstEntry.whiskingProgress;
    const timeDiff = (lastEntry.timestamp - firstEntry.timestamp) / 1000; // in seconds

    if (timeDiff === 0) {
        return null; // Avoid division by zero
    }

    return progressDiff / timeDiff; // Progress per second
}

Events.on(engine, 'afterUpdate', () => {
    // Calculate the current angle of the eggWhite relative to the center
    const dx = eggWhite.position.x - centerX;
    const dy = eggWhite.position.y - centerY;
    const currentAngle = Math.atan2(dy, dx);

    let speed = 0;
    const now = performance.now();

    if (mouseConstraint.body === eggWhite) { // If dragging the egg white
        isDragging = true;
        if (lastAngle !== null) {
            let angleDiff = currentAngle - lastAngle;
            if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            whiskingProgress += Math.abs(angleDiff) * 0.1;
            if (whiskingProgress > maxWhisking) whiskingProgress = maxWhisking;
        }
        lastAngle = currentAngle;

        // Use displayedProgress for physics calculations
        const progressRatio = displayedProgress / 100; // displayedProgress is in percentage (0-100)
        eggWhite.frictionAir = 0.01 + 0.99 * progressRatio;

        const angularDamping = 0.3;
        Body.setAngularVelocity(eggWhite, eggWhite.angularVelocity * angularDamping);

        // Use whiskingProgress to check for completion
        if (whiskingProgress >= maxWhisking) {
            Body.setAngularVelocity(eggWhite, 0);
            eggWhite.frictionAir = 0.5;
            displayedProgress = 100; // Force displayedProgress to 100 at completion
            frozenProgressValue = 100; // Update frozen value
            frozenWhiskingProgress = maxWhisking; // Update frozen whisking progress
        }

        mouseConstraint.constraint.stiffness = 0.05 - 0.049 * progressRatio;

        // Calculate cursor speed
        if (lastMouseX !== null && lastMouseY !== null && lastMouseTime !== null) {
            const dx = mouse.position.x - lastMouseX;
            const dy = mouse.position.y - lastMouseY;
            const dt = (now - lastMouseTime) / 1000;

            if (dt > 0) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                speed = distance / dt;
            }
        }

        // Calculate additional metrics
        const angularVelocity = eggWhite.angularVelocity;

        const distanceFromCenter = Math.sqrt(
            Math.pow(eggWhite.position.x - centerX, 2) +
            Math.pow(eggWhite.position.y - centerY, 2)
        );
        const deviation = Math.abs(distanceFromCenter - radius);

        const mouseDistance = Math.sqrt(
            Math.pow(mouse.position.x - eggWhite.position.x, 2) +
            Math.pow(mouse.position.y - eggWhite.position.y, 2)
        );
        const effort = mouseDistance * mouseConstraint.constraint.stiffness;

        // Add metrics to 1% buckets
        const progressPercent = (whiskingProgress / maxWhisking) * 100;
        const currentBucket = Math.floor(progressPercent);

        if (!speedBuckets[currentBucket]) {
            speedBuckets[currentBucket] = { totalSpeed: 0, totalAngularVelocity: 0, totalDeviation: 0, totalEffort: 0, count: 0 };
        }
        speedBuckets[currentBucket].totalSpeed += speed;
        speedBuckets[currentBucket].totalAngularVelocity += angularVelocity;
        speedBuckets[currentBucket].totalDeviation += deviation;
        speedBuckets[currentBucket].totalEffort += effort;
        speedBuckets[currentBucket].count++;

        // Log progress at 1% increments of whiskingProgress
        if (currentBucket > lastProgressLogBucket) {
            const offset = (progressPercent - displayedProgress).toFixed(2);
            log(`${getTimestamp()} - Progress update: whiskingProgress: ${progressPercent.toFixed(2)}%, displayedProgress: ${displayedProgress.toFixed(2)}%, offset: ${offset}%`);
            lastProgressLogBucket = currentBucket;
        }

        // Log averages for the previous bucket when we move to a new bucket
        const previousBucket = currentBucket - 1;
        if (previousBucket >= 0 && previousBucket > lastLoggedBucket && speedBuckets[previousBucket]) {
            const avgSpeed = speedBuckets[previousBucket].totalSpeed / speedBuckets[previousBucket].count;
            const avgAngularVelocity = speedBuckets[previousBucket].totalAngularVelocity / speedBuckets[previousBucket].count;
            const avgDeviation = speedBuckets[previousBucket].totalDeviation / speedBuckets[previousBucket].count;
            const avgEffort = speedBuckets[previousBucket].totalEffort / speedBuckets[previousBucket].count;
            log(`${getTimestamp()} - at whiskingProgress: ${previousBucket}%, displayedProgress: ${displayedProgress.toFixed(2)}%: Speed: ${avgSpeed.toFixed(2)} px/s, Angular Velocity: ${avgAngularVelocity.toFixed(4)} rad/s, Deviation: ${avgDeviation.toFixed(2)} px, Effort: ${avgEffort.toFixed(2)}`);
            lastLoggedBucket = previousBucket;
        }

        // Handle freezing logic
        const freezeBucket = Math.floor(progressPercent / 10) * 10; // Check every 10%
        if (!isProgressFrozen && freezeBucket > lastCheckedBucket && freezeBucket < 100 && (!lastUnfrozenTime || now - lastUnfrozenTime > 2000)) {
            // Randomly decide to freeze (50% chance)
            if (Math.random() < 0.6) {
                isProgressFrozen = true;
                freezeStartTime = now;
                frozenProgressValue = displayedProgress; // Store current displayedProgress
                frozenWhiskingProgress = whiskingProgress; // Store current whiskingProgress

                // Calculate freeze duration based on progress rate
                const progressRate = calculateProgressRate();
                let targetProgressIncrease = 0.10 + Math.random() * 0.10; // Random between 15% and 25%
                targetProgressIncrease *= maxWhisking; // Convert to whiskingProgress units

                if (progressRate && progressRate > 0) {
                    freezeDuration = (targetProgressIncrease / progressRate) * 1000; // Convert to milliseconds
                    freezeDuration = Math.min(Math.max(freezeDuration, 1000), 10000); // Clamp between 1-10 seconds
                } else {
                    freezeDuration = 2000; // Default 2 seconds if rate is unavailable
                }

                const offset = (progressPercent - displayedProgress).toFixed(2);
                log(`${getTimestamp()} - Progress frozen at whiskingProgress: ${progressPercent.toFixed(2)}%, displayedProgress: ${displayedProgress.toFixed(2)}% for ${freezeDuration.toFixed(0)} ms (target ${targetProgressIncrease.toFixed(2)} progress, offset ${offset}%)`);
            }
            lastCheckedBucket = freezeBucket;
        }

        // Update displayed progress
        if (isProgressFrozen) {
            displayedProgress = frozenProgressValue; // Hold at frozen value
            if (now - freezeStartTime >= freezeDuration) {
                isProgressFrozen = false;
                lastUnfrozenTime = now; // Record unfreeze time
                freezeStartTime = null;
                
                // IMPORTANT FIX: Don't jump to catch up with whisking progress on unfreeze
                // Just continue from where the displayed progress was frozen
                // We're keeping the displayed progress at frozenProgressValue without adding the accumulated difference
                displayedProgress = frozenProgressValue;
                
                // Reset the reference point for future progress calculations
                frozenWhiskingProgress = whiskingProgress;
                
                const offset = (progressPercent - displayedProgress).toFixed(2);
                log(`${getTimestamp()} - Progress unfrozen at whiskingProgress: ${progressPercent.toFixed(2)}%, displayedProgress: ${displayedProgress.toFixed(2)}% with offset ${offset}%`);
            }
        } else {
            // Normal progress update when not frozen
            // Calculate increment based on whisking progress since last reference point
            const progressIncrement = (whiskingProgress - frozenWhiskingProgress) / maxWhisking * 100;
            displayedProgress = frozenProgressValue + progressIncrement;
            
            if (displayedProgress < 0) displayedProgress = 0; // Prevent negative progress
            if (whiskingProgress >= maxWhisking) displayedProgress = 100; // Force to 100 at completion
            
            // Update reference values for next calculation
            frozenProgressValue = displayedProgress;
            frozenWhiskingProgress = whiskingProgress;
        }

        // Update the progress display
        progressDisplay.innerText = `Progress: ${Math.floor(displayedProgress)}%`;

        // Save current for next frame
        lastMouseX = mouse.position.x;
        lastMouseY = mouse.position.y;
        lastMouseTime = now;

        // Store all metrics in cursorTrackData
        cursorTrackData.push({
            timestamp: performance.now(),
            whiskingProgress: whiskingProgress,
            mouseSpeed: speed,
            angularVelocity: angularVelocity,
            deviation: deviation,
            effort: effort,
            displayedProgress: displayedProgress,
            offset: progressPercent - displayedProgress // Track offset for analysis
        });
    } else if (isDragging) {
        whiskingProgress -= 0.9;
        if (whiskingProgress < 0) whiskingProgress = 0;

        // Use displayedProgress for physics calculations
        const progressRatio = displayedProgress / 100; // displayedProgress is in percentage (0-100)
        eggWhite.frictionAir = 0.01 + 0.49 * progressRatio;
        mouseConstraint.constraint.stiffness = 0.05 - 0.049 * progressRatio;

        // Use whiskingProgress to check for completion
        if (whiskingProgress >= maxWhisking) {
            Body.setAngularVelocity(eggWhite, 0);
            displayedProgress = 100; // Force displayedProgress to 100
            frozenProgressValue = 100; // Update frozen value
            frozenWhiskingProgress = maxWhisking; // Update frozen whisking progress
        }

        // Update displayed progress when not dragging
        if (!isProgressFrozen) {
            // Calculate increment based on whisking progress since last reference point
            const progressIncrement = (whiskingProgress - frozenWhiskingProgress) / maxWhisking * 100;
            displayedProgress = frozenProgressValue + progressIncrement;
            
            if (displayedProgress < 0) displayedProgress = 0; // Prevent negative progress
            if (whiskingProgress >= maxWhisking) displayedProgress = 100; // Force to 100
            
            // Update reference values
            frozenProgressValue = displayedProgress;
            frozenWhiskingProgress = whiskingProgress;
        }
        progressDisplay.innerText = `Progress: ${Math.floor(displayedProgress)}%`;

        // Log progress at 1% increments of whiskingProgress
        const progressPercent = (whiskingProgress / maxWhisking) * 100;
        const currentBucket = Math.floor(progressPercent);
        if (currentBucket > lastProgressLogBucket) {
            const offset = (progressPercent - displayedProgress).toFixed(2);
            log(`${getTimestamp()} - Progress update: whiskingProgress: ${progressPercent.toFixed(2)}%, displayedProgress: ${displayedProgress.toFixed(2)}%, offset: ${offset}%`);
            lastProgressLogBucket = currentBucket;
        }

        // Log averages for the current bucket when dragging stops
        if (!speedBuckets[currentBucket]) {
            speedBuckets[currentBucket] = { totalSpeed: 0, totalAngularVelocity: 0, totalDeviation: 0, totalEffort: 0, count: 0 };
        }
        speedBuckets[currentBucket].totalSpeed += speed;
        speedBuckets[currentBucket].totalAngularVelocity += angularVelocity;
        speedBuckets[currentBucket].totalDeviation += deviation;
        speedBuckets[currentBucket].totalEffort += effort;
        speedBuckets[currentBucket].count++;

        const previousBucket = currentBucket - 1;
        if (previousBucket >= 0 && previousBucket > lastLoggedBucket && speedBuckets[previousBucket]) {
            const avgSpeed = speedBuckets[previousBucket].totalSpeed / speedBuckets[previousBucket].count;
            const avgAngularVelocity = speedBuckets[previousBucket].totalAngularVelocity / speedBuckets[previousBucket].count;
            const avgDeviation = speedBuckets[previousBucket].totalDeviation / speedBuckets[previousBucket].count;
            const avgEffort = speedBuckets[previousBucket].totalEffort / speedBuckets[previousBucket].count;
            log(`${getTimestamp()} - at whiskingProgress: ${previousBucket}%, displayedProgress: ${displayedProgress.toFixed(2)}%: Speed: ${avgSpeed.toFixed(2)} px/s, Angular Velocity: ${avgAngularVelocity.toFixed(4)} rad/s, Deviation: ${avgDeviation.toFixed(2)} px, Effort: ${avgEffort.toFixed(2)}`);
            lastLoggedBucket = previousBucket;
        }
    }
});

const getTimestamp = () => new Date().toISOString();

function calculateAverageSpeedByProgress(cursorTrackData) {
    const buckets = {};

    cursorTrackData.forEach(entry => {
        const progressPercent = (entry.whiskingProgress / 100) * 100;
        const bucket = Math.floor(progressPercent); // 1% intervals (0, 1, 2, ..., 100)

        if (!buckets[bucket]) {
            buckets[bucket] = { totalSpeed: 0, count: 0 };
        }

        buckets[bucket].totalSpeed += entry.mouseSpeed;
        buckets[bucket].count++;
    });

    const averages = {};
    for (const bucket in buckets) {
        averages[bucket] = buckets[bucket].totalSpeed / buckets[bucket].count;
    }

    return averages;
}

function calculateAveragesByProgress(cursorTrackData, metric) {
    const buckets = {};

    cursorTrackData.forEach(entry => {
        const progressPercent = (entry.whiskingProgress / 100) * 100;
        const bucket = Math.floor(progressPercent); // 1% intervals (0, 1, 2, ..., 100)

        if (!buckets[bucket]) {
            buckets[bucket] = { total: 0, count: 0 };
        }

        buckets[bucket].total += entry[metric];
        buckets[bucket].count++;
    });

    const averages = {};
    for (const bucket in buckets) {
        averages[bucket] = buckets[bucket].total / buckets[bucket].count;
    }

    return averages;
}

document.addEventListener('keydown', (event) => {
    switch (event.key) {
        case 'c':
            console.log(`${getTimestamp()} - User noticed change: whiskingProgress: ${whiskingProgress.toFixed(2)} (${(whiskingProgress / maxWhisking * 100).toFixed(2)}%), displayedProgress: ${displayedProgress.toFixed(2)}%, frozenProgressOffset: ${frozenProgressOffset.toFixed(2)}%, frictionAir: ${eggWhite.frictionAir.toFixed(3)}, stiffness: ${mouseConstraint.constraint.stiffness.toFixed(4)}`);
            break;
        case 'd':
            const avgSpeeds = calculateAverageSpeedByProgress(cursorTrackData);
            const avgAngularVelocities = calculateAveragesByProgress(cursorTrackData, 'angularVelocity');
            const avgDeviations = calculateAveragesByProgress(cursorTrackData, 'deviation');
            const avgEfforts = calculateAveragesByProgress(cursorTrackData, 'effort');
            const avgDisplayedProgress = calculateAveragesByProgress(cursorTrackData, 'displayedProgress');
            const avgFrozenProgressOffset = calculateAveragesByProgress(cursorTrackData, 'frozenProgressOffset');
            console.log('Average mouse speeds by 1% progress:', avgSpeeds);
            console.log('Average angular velocities by 1% progress:', avgAngularVelocities);
            console.log('Average deviations by 1% progress:', avgDeviations);
            console.log('Average efforts by 1% progress:', avgEfforts);
            console.log('Average displayed progress by 1% progress:', avgDisplayedProgress);
            console.log('Average frozen progress offset by 1% progress:', avgFrozenProgressOffset);
            console.log('Pause durations:', pauseDurations);
            break;
    }
});

// Run the renderer and engine
Render.run(render);
Engine.run(engine);