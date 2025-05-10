const Engine = Matter.Engine;
const Render = Matter.Render;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Constraint = Matter.Constraint;
const Mouse = Matter.Mouse;
const MouseConstraint = Matter.MouseConstraint;
const Events = Matter.Events;
const Body = Matter.Body;

const engine = Engine.create();
engine.world.gravity.y = 0;

const render = Render.create({
    element: document.body,
    engine: engine,
    options: {
        width: window.innerWidth,
        height: window.innerHeight,
        wireframes: false,
        background: 'white'
    }
});

const centerX = window.innerWidth / 2;
const centerY = window.innerHeight / 2;
const radius = 150;

const eggWhite = Bodies.rectangle(centerX + radius, centerY, 50, 50, {
    render: { fillStyle: 'black' },
    frictionAir: 0.01,
    restitution: 0.5
});
eggWhite.originalFrictionAir = eggWhite.frictionAir;
World.add(engine.world, eggWhite);

const centerPoint = Bodies.circle(centerX, centerY, 5, { isStatic: true, render: { fillStyle: 'white' } });
const orbitConstraint = Constraint.create({
    bodyA: centerPoint,
    bodyB: eggWhite,
    length: radius,
    stiffness: 0,
    render: { visible: false }
});
World.add(engine.world, [centerPoint, orbitConstraint]);

const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
        stiffness: 0.005,
        render: { visible: false }
    }
});
mouseConstraint.constraint.originalStiffness = mouseConstraint.constraint.stiffness;
World.add(engine.world, mouseConstraint);

let whiskingProgress = 0;
const maxWhisking = 100;
let lastAngle = null;
let isDragging = false;
let cursorTrackData = [];
let lastMouseX = null;
let lastMouseY = null;
let lastMouseTime = null;
let dragStartTime = null;
let pauseStartTime = null;
let pauseDurations = [];
let logs = [];
let touchStartTime = null;
const longPressDuration = 1000;
let speedBuckets = {};
let lastLoggedBucket = -1;

let baseProgress = 0;
let waveAmplitude = 20; // Initial amplitude
const baseWaveFrequency = 0.07; // Base frequency of the wave
let timeElapsed = 0;
const amplitudeGrowthRate = 0.35; // Rate at which amplitude grows over time

Events.on(render, 'afterRender', () => {
    const context = render.context;
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    context.strokeStyle = 'rgba(0, 0, 0, 0.02)';
    context.lineWidth = 40;
    context.stroke();
});

const logDiv = document.createElement('div');
logDiv.id = 'metricsLog';
logDiv.style.position = 'absolute';
logDiv.style.top = '0';
logDiv.style.left = '0';
logDiv.style.background = '#f0f0f0';
logDiv.style.color = 'black';
logDiv.style.padding = '10px';
logDiv.style.maxHeight = '200px';
logDiv.style.overflowY = 'scroll';
logDiv.style.display = 'none';
logDiv.style.zIndex = '1000';
logDiv.style.fontSize = '12px';
logDiv.style.border = '1px solid #ccc';
document.body.appendChild(logDiv);

function log(message) {
    logs.push(message);
    localStorage.setItem('metricsLogs', logs.join('\n'));
    logDiv.innerHTML += message + '<br>';
    logDiv.scrollTop = logDiv.scrollHeight;
}

const copyButton = document.createElement('button');
copyButton.innerText = 'Copy Logs';
copyButton.style.position = 'absolute';
copyButton.style.top = '220px';
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

const canvas = document.querySelector('canvas');
canvas.addEventListener('touchstart', (event) => {
    if (event.touches.length === 1) {
        touchStartTime = Date.now();
        event.preventDefault();
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
        event.preventDefault();
    }
});

Events.on(mouseConstraint, 'mousedown', () => {
    if (mouseConstraint.body === eggWhite) {
        dragStartTime = performance.now();
        if (pauseStartTime) {
            const pauseDuration = (performance.now() - pauseStartTime) / 1000;
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
            const dragDuration = (performance.now() - dragStartTime) / 1000;
            const progressPercent = (whiskingProgress / maxWhisking) * 100;
            const currentBucket = Math.floor(progressPercent);
            if (!speedBuckets[currentBucket]) {
                speedBuckets[currentBucket] = { totalDuration: 0, count: 0 };
            }
            speedBuckets[currentBucket].totalDuration += dragDuration;
            speedBuckets[currentBucket].count++;
            // log(`${getTimestamp()} - Drag duration: ${dragDuration.toFixed(2)} s at ${currentBucket}%`);
            dragStartTime = null;
        }
        pauseStartTime = performance.now();
    }
});

Events.on(mouseConstraint, 'enddrag', () => {
    if (isDragging) {
        isDragging = false;
        lastAngle = null;
        if (dragStartTime) {
            const dragDuration = (performance.now() - dragStartTime) / 1000;
            const progressPercent = (whiskingProgress / maxWhisking) * 100;
            const currentBucket = Math.floor(progressPercent);
            if (!speedBuckets[currentBucket]) {
                speedBuckets[currentBucket] = { totalDuration: 0, count: 0 };
            }
            speedBuckets[currentBucket].totalDuration += dragDuration;
            speedBuckets[currentBucket].count++;
            log(`${getTimestamp()} - Drag duration: ${dragDuration.toFixed(2)} s at ${currentBucket}%`);
            dragStartTime = null;
        }
        pauseStartTime = performance.now();
    }
});

let lastLoggedProgressBucket = -1;
let progressBuckets = {};

Events.on(engine, 'afterUpdate', () => {
    const dx = eggWhite.position.x - centerX;
    const dy = eggWhite.position.y - centerY;
    const currentAngle = Math.atan2(dy, dx);

    let speed = 0;
    const now = performance.now();

    timeElapsed += 1 / 60;

    // Increase wave amplitude over time to create growing waves
    waveAmplitude = 15 + amplitudeGrowthRate * timeElapsed; // Linear growth
    // Alternatively, for exponential growth: waveAmplitude = 15 * Math.exp(amplitudeGrowthRate * timeElapsed);

    if (mouseConstraint.body === eggWhite) {
        isDragging = true;
        if (lastAngle !== null) {
            let angleDiff = currentAngle - lastAngle;
            if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            baseProgress += Math.abs(angleDiff) * 0.1;
            if (baseProgress > maxWhisking) baseProgress = maxWhisking;
            // Calculate dynamic amplitude that grows and oscillates
            const dynamicAmplitude = waveAmplitude * (0.5 + 0.5 * Math.sin(0.02 * timeElapsed * 2 * Math.PI));
            const waveOffset = dynamicAmplitude * Math.sin(baseWaveFrequency * timeElapsed * 2 * Math.PI);
            whiskingProgress = Math.max(0, Math.min(maxWhisking, baseProgress + waveOffset));
            const baseProgressPercent = (baseProgress / maxWhisking) * 100;
            if (lastMouseX !== null && lastMouseY !== null && lastMouseTime !== null) {
                const dx = mouse.position.x - lastMouseX;
                const dy = mouse.position.y - lastMouseY;
                const dt = (now - lastMouseTime) / 1000;
                if (dt > 0) {
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    speed = distance / dt;
                }
            }
            // Aggregate metrics for baseProgress-based buckets
            const currentProgressBucket = Math.floor(baseProgressPercent);
            if (!progressBuckets[currentProgressBucket]) {
                progressBuckets[currentProgressBucket] = {
                    totalTime: 0,
                    totalBaseProgress: 0,
                    totalSpeed: 0,
                    totalWaveOffset: 0,
                    totalWhiskingProgress: 0,
                    count: 0
                };
            }
            progressBuckets[currentProgressBucket].totalTime += timeElapsed;
            progressBuckets[currentProgressBucket].totalBaseProgress += baseProgress;
            progressBuckets[currentProgressBucket].totalSpeed += speed;
            progressBuckets[currentProgressBucket].totalWaveOffset += waveOffset;
            progressBuckets[currentProgressBucket].totalWhiskingProgress += whiskingProgress;
            progressBuckets[currentProgressBucket].count++;

            // Log averages for the previous baseProgress bucket
            const previousProgressBucket = currentProgressBucket - 1;
            if (previousProgressBucket >= 0 && previousProgressBucket > lastLoggedProgressBucket && progressBuckets[previousProgressBucket]) {
                const avgTime = progressBuckets[previousProgressBucket].totalTime / progressBuckets[previousProgressBucket].count;
                const avgBaseProgress = progressBuckets[previousProgressBucket].totalBaseProgress / progressBuckets[previousProgressBucket].count;
                const avgSpeed = progressBuckets[previousProgressBucket].totalSpeed / progressBuckets[previousProgressBucket].count;
                const avgWaveOffset = progressBuckets[previousProgressBucket].totalWaveOffset / progressBuckets[previousProgressBucket].count
                const avgWhiskingProgress = progressBuckets[previousProgressBucket].totalWhiskingProgress / progressBuckets[previousProgressBucket].count;
                log(`${getTimestamp()} - Time: ${avgTime.toFixed(2)}s - Base Progress: ${avgBaseProgress.toFixed(2)} (${previousProgressBucket}%), Cursor Speed: ${avgSpeed.toFixed(2)} px/s, Wave Offset: ${avgWaveOffset.toFixed(2)}, Whisking Progress: ${avgWhiskingProgress.toFixed(2)}`);
                lastLoggedProgressBucket = previousProgressBucket;
            }
        }
        lastAngle = currentAngle;

        const progressRatio = whiskingProgress / maxWhisking;
        eggWhite.frictionAir = 0.01 + 0.99 * progressRatio;

        const angularDamping = 0.3;
        Body.setAngularVelocity(eggWhite, eggWhite.angularVelocity * angularDamping);

        if (whiskingProgress >= maxWhisking) {
            Body.setAngularVelocity(eggWhite, 0);
            eggWhite.frictionAir = 0.5;
        }

        mouseConstraint.constraint.stiffness = 0.05 - 0.049 * progressRatio;

        if (lastMouseX !== null && lastMouseY !== null && lastMouseTime !== null) {
            const dx = mouse.position.x - lastMouseX;
            const dy = mouse.position.y - lastMouseY;
            const dt = (now - lastMouseTime) / 1000;
            if (dt > 0) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                speed = distance / dt;
            }
        }

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

        const progressPercent = (whiskingProgress / maxWhisking) * 100;
        const currentBucket = Math.floor(progressPercent);

        lastMouseX = mouse.position.x;
        lastMouseY = mouse.position.y;
        lastMouseTime = now;

        cursorTrackData.push({
            timestamp: performance.now(),
            whiskingProgress: whiskingProgress,
            mouseSpeed: speed,
            angularVelocity: angularVelocity,
            deviation: deviation,
            effort: effort
        });
    } else if (isDragging) {
        // Calculate dynamic amplitude that grows and oscillates
        const dynamicAmplitude = waveAmplitude * (0.5 + 0.5 * Math.sin(0.02 * timeElapsed * 2 * Math.PI));
        const waveOffset = dynamicAmplitude * Math.sin(baseWaveFrequency * timeElapsed * 2 * Math.PI);
        whiskingProgress = Math.max(0, Math.min(maxWhisking, baseProgress + waveOffset));
        if (whiskingProgress < 0) whiskingProgress = 0;

        const progressRatio = whiskingProgress / maxWhisking;
        eggWhite.frictionAir = 0.01 + 0.49 * progressRatio;
        mouseConstraint.constraint.stiffness = 0.05 - 0.049 * progressRatio;

        if (whiskingProgress >= maxWhisking) {
            Body.setAngularVelocity(eggWhite, 0);
        }

        const baseProgressPercent = (baseProgress / maxWhisking) * 100;
        const currentProgressBucket = Math.floor(baseProgressPercent);
        if (!progressBuckets[currentProgressBucket]) {
            progressBuckets[currentProgressBucket] = {
                totalTime: 0,
                totalBaseProgress: 0,
                totalSpeed: 0,
                totalWaveOffset: 0,
                totalWhiskingProgress: 0,
                count: 0
            };
        }
        progressBuckets[currentProgressBucket].totalTime += timeElapsed;
        progressBuckets[currentProgressBucket].totalBaseProgress += baseProgress;
        progressBuckets[currentProgressBucket].totalSpeed += speed;
        progressBuckets[currentProgressBucket].totalWaveOffset += waveOffset;
        progressBuckets[currentProgressBucket].totalWhiskingProgress += whiskingProgress;
        progressBuckets[currentProgressBucket].count++;

        // Log averages for the previous baseProgress bucket
        const previousProgressBucket = currentProgressBucket - 1;
        if (previousProgressBucket >= 0 && previousProgressBucket > lastLoggedProgressBucket && progressBuckets[previousProgressBucket]) {
            const avgTime = progressBuckets[previousProgressBucket].totalTime / progressBuckets[previousProgressBucket].count;
            const avgBaseProgress = progressBuckets[previousProgressBucket].totalBaseProgress / progressBuckets[previousProgressBucket].count;
            const avgSpeed = progressBuckets[previousProgressBucket].totalSpeed / progressBuckets[previousProgressBucket].count;
            const avgWaveOffset = progressBuckets[previousProgressBucket].totalWaveOffset / progressBuckets[previousProgressBucket].count;
            const avgWhiskingProgress = progressBuckets[previousProgressBucket].totalWhiskingProgress / progressBuckets[previousProgressBucket].count;
            log(`${getTimestamp()} - Time: ${avgTime.toFixed(2)}s - Base Progress: ${avgBaseProgress.toFixed(2)} (${previousProgressBucket}%), Cursor Speed: ${avgSpeed.toFixed(2)} px/s, Wave Offset: ${avgWaveOffset.toFixed(2)}, Whisking Progress: ${avgWhiskingProgress.toFixed(2)}`);
            lastLoggedProgressBucket = previousProgressBucket;
        }

        const progressPercent = (whiskingProgress / maxWhisking) * 100;
        const currentBucket = Math.floor(progressPercent);
        if (!speedBuckets[currentBucket]) {
            speedBuckets[currentBucket] = { totalSpeed: 0, totalAngularVelocity: 0, totalDeviation: 0, totalEffort: 0, count: 0 };
        }
        speedBuckets[currentBucket].totalSpeed += speed;
        speedBuckets[currentBucket].totalAngularVelocity += angularVelocity || 0;
        speedBuckets[currentBucket].totalDeviation += deviation || 0;
        speedBuckets[currentBucket].totalEffort += effort || 0;
        speedBuckets[currentBucket].count++;

        const previousBucket = currentBucket - 1;
        if (previousBucket >= 0 && previousBucket > lastLoggedBucket && speedBuckets[previousBucket]) {
            const avgSpeed = speedBuckets[previousBucket].totalSpeed / speedBuckets[previousBucket].count;
            const avgAngularVelocity = speedBuckets[previousBucket].totalAngularVelocity / speedBuckets[previousBucket].count;
            const avgDeviation = speedBuckets[previousBucket].totalDeviation / speedBuckets[previousBucket].count;
            const avgEffort = speedBuckets[previousBucket].totalEffort / speedBuckets[previousBucket].count;
            log(`${getTimestamp()} - at ${previousBucket}%: Speed: ${avgSpeed.toFixed(2)} px/s, Angular Velocity: ${avgAngularVelocity.toFixed(4)} rad/s, Deviation: ${avgDeviation.toFixed(2)} px, Effort: ${avgEffort.toFixed(2)}`);
            lastLoggedBucket = previousBucket;
        }
    }
});

const getTimestamp = () => new Date().toISOString();

function calculateAverageSpeedByProgress(cursorTrackData) {
    const buckets = {};

    cursorTrackData.forEach(entry => {
        const progressPercent = (entry.whiskingProgress / 100) * 100;
        const bucket = Math.floor(progressPercent);

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
        const bucket = Math.floor(progressPercent);

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
            console.log(`${getTimestamp()} - User noticed change at whiskingProgress: ${whiskingProgress.toFixed(2)} (${(whiskingProgress / maxWhisking * 100).toFixed(2)}%), frictionAir: ${eggWhite.frictionAir.toFixed(3)}, stiffness: ${mouseConstraint.constraint.stiffness.toFixed(4)}`);
            break;
        case 'd':
            const avgSpeeds = calculateAverageSpeedByProgress(cursorTrackData);
            const avgAngularVelocities = calculateAveragesByProgress(cursorTrackData, 'angularVelocity');
            const avgDeviations = calculateAveragesByProgress(cursorTrackData, 'deviation');
            const avgEfforts = calculateAveragesByProgress(cursorTrackData, 'effort');
            console.log('Average mouse speeds by 1% progress:', avgSpeeds);
            console.log('Average angular velocities by 1% progress:', avgAngularVelocities);
            console.log('Average deviations by 1% progress:', avgDeviations);
            console.log('Average efforts by 1% progress:', avgEfforts);
            console.log('Pause durations:', pauseDurations);
            break;
    }
});

Render.run(render);
Engine.run(engine);