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
        background: 'black'
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
    render: { fillStyle: 'hsl(200, 0%, 100%)' },
    frictionAir: 0.01, // Start with low friction for high momentum
    restitution: 0.5
});
eggWhite.originalFrictionAir = eggWhite.frictionAir; // Store initial friction
World.add(engine.world, eggWhite);

// Create a static center point and constrain the egg white to it
const centerPoint = Bodies.circle(centerX, centerY, 5, { isStatic: true, render: { fillStyle: 'black' } });
const orbitConstraint = Constraint.create({
    bodyA: centerPoint,
    bodyB: eggWhite,
    length: radius,
    stiffness:0,
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


Events.on(engine, 'afterUpdate', () => {
    // Calculate the current angle of the eggWhite relative to the center
    const dx = eggWhite.position.x - centerX;
    const dy = eggWhite.position.y - centerY;
    const currentAngle = Math.atan2(dy, dx);

    if (mouseConstraint.body === eggWhite) { // If dragging the egg white
        isDragging = true;
        if (lastAngle !== null) {
            // Calculate the angular difference (in radians)
            let angleDiff = currentAngle - lastAngle;
            if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            whiskingProgress += Math.abs(angleDiff) * 0.01; // Sensitivity remains at 2
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

        // Optional: Change color to indicate texture change
        eggWhite.render.fillStyle = `hsl(200, 0%, 100%)`; // Blue to lighter blue

        let speed = 0;

        // @ts-ignore
        const now = performance.now();

        if (lastMouseX !== null && lastMouseY !== null && lastMouseTime !== null) {
            const dx = mouse.position.x - lastMouseX;
            const dy = mouse.position.y - lastMouseY;
            const dt = (now - lastMouseTime) / 1000; // Convert ms to seconds

            if (dt > 0) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                speed = distance / dt; // pixels per second
            }
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
        eggWhite.frictionAir = 0.01 + 0.99 * progressRatio; // Gradually decrease to 0.01
        mouseConstraint.constraint.stiffness = 0.05 - 0.099 * progressRatio; // Gradually increase to 0.05
        eggWhite.render.fillStyle = `hsl(200, 0%, ${50 + 30 * progressRatio}%)`; // Gradually revert to blue

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

const getTimestamp = () => new Date().toISOString();


function calculateAverageSpeedByProgress(cursorTrackData) {
    const buckets = {}; // Object to store speed sums and counts per bucket

    // 1. Fill buckets
    cursorTrackData.forEach(entry => {
        const progressPercent = (entry.whiskingProgress / 100) * 100;
        const bucket = Math.floor(progressPercent / 5) * 5; // Group into 0-9%, 10-19%, etc.

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
        case 'd': // Dump all collected cursor tracking data
            const avgSpeeds = calculateAverageSpeedByProgress(cursorTrackData);
            // @ts-ignore
            console.log('Average mouse speeds by 10% progress:', avgSpeeds);
            break;
    }

});

// Run the renderer and engine
Render.run(render);
Engine.run(engine);
