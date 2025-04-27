// Import Matter.js modules
// @ts-ignore
const Engine = Matter.Engine;
// @ts-ignore
const Render = Matter.Render;
// @ts-ignore
const Bodies = Matter.Bodies;
// @ts-ignore
const World = Matter.World;
// @ts-ignore
const Mouse = Matter.Mouse;
// @ts-ignore
const MouseConstraint = Matter.MouseConstraint;
// @ts-ignore
const Constraint = Matter.Constraint;
// @ts-ignore
const Events = Matter.Events;
// @ts-ignore
const Body = Matter.Body;
// @ts-ignore
const Vector = Matter.Vector;

const engine = Engine.create();
const world = engine.world;
world.gravity.y = 0; 

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

// Add static walls
const walls = [
    // @ts-ignore
    Bodies.rectangle(0, window.innerHeight / 2, 10, window.innerHeight, { isStatic: true, render: { fillStyle: 'black' } }),
    // @ts-ignore
    Bodies.rectangle(window.innerWidth, window.innerHeight / 2, 10, window.innerHeight, { isStatic: true, render: { fillStyle: 'black' } }),
    // @ts-ignore
    Bodies.rectangle(window.innerWidth / 2, 0, window.innerWidth, 10, { isStatic: true, render: { fillStyle: 'black' } }),
    // @ts-ignore
    Bodies.rectangle(window.innerWidth / 2, window.innerHeight, window.innerWidth, 10, { isStatic: true, render: { fillStyle: 'black' } })
];
World.add(world, walls);

// Add five vertical lines (bumps)
const lineWidth = 10;
const numLines = 15;
// @ts-ignore
const lineSpacing = window.innerWidth / (numLines + 1);
const verticalLines = [];
for (let i = 1; i <= numLines; i++) {
    const lineX = lineSpacing * i;
    // @ts-ignore
    const line = Bodies.rectangle(lineX, window.innerHeight / 2, lineWidth, window.innerHeight, {
        isStatic: true,
        isSensor: true,
        render: { fillStyle: 'black' }
    });
    verticalLines.push({ body: line, x: lineX });
    World.add(world, line);
}

// Create 10x10 grid
const rows = 10;
const cols = 10;
const squareSize = 10;
const spacing = 7;
const totalWidth = cols * squareSize + (cols - 1) * spacing;
const totalHeight = rows * squareSize + (rows - 1) * spacing;
// @ts-ignore
const startX = (window.innerWidth - totalWidth) / 2;
// @ts-ignore
const startY = (window.innerHeight - totalHeight) / 2;

// Initialize grid array
const grid = Array.from({ length: cols }, () => Array(rows).fill(null));

// Create squares and add to world
for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
        const x = startX + i * (squareSize + spacing) + squareSize / 2;
        const y = startY + j * (squareSize + spacing) + squareSize / 2;
        const body = Bodies.rectangle(x, y, squareSize, squareSize, {
            render: { fillStyle: 'white' },
            friction: 0,
            frictionAir: 0,
            restitution: 0
        });
        body.isScaled = false; // Track scaling state
        body.hasResistance = false; // Track resistance state
        body.originalFrictionAir = body.frictionAir; // Store original frictionAir
        grid[i][j] = body;
        World.add(world, body);
    }
}

// Add constraints to connect squares with hidden lines
for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
        // Horizontal constraints
        if (i < cols - 1) {
            const constraint = Constraint.create({
                bodyA: grid[i][j],
                bodyB: grid[i + 1][j],
                length: squareSize + spacing,
                stiffness: 0.5,
                damping: 0.5,
                render: { visible: false }
            });
            World.add(world, constraint);
        }
        if (j < rows - 1) {
            const constraint = Constraint.create({
                bodyA: grid[i][j],
                bodyB: grid[i][j + 1],
                length: squareSize + spacing,
                stiffness: 0.5,
                damping: 0.5,
                render: { visible: false }
            });
            World.add(world, constraint);
        }
    }
}

// Scale squares and add resistance when they pass through any vertical line
Events.on(engine, 'afterUpdate', () => {
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            const square = grid[i][j];
            const squareX = square.position.x;

            let isOnLine = false;
            for (const line of verticalLines) {
                const lineLeft = line.x - lineWidth / 2;
                const lineRight = line.x + lineWidth / 2;
                if (squareX >= lineLeft && squareX <= lineRight) {
                    isOnLine = true;
                    break;
                }
            }

            if (isOnLine && !square.isScaled) {
                Body.scale(square, 1.1, 1.1);
                square.isScaled = true;
            } else if (!isOnLine && square.isScaled) {
                Body.scale(square, 1 / 1.1, 1 / 1.1);
                square.isScaled = false;
            }

            if (isOnLine && !square.hasResistance) {
                square.frictionAir = 1.5; 
                square.hasResistance = true;
            } else if (!isOnLine && square.hasResistance) {
                square.frictionAir = square.originalFrictionAir;
                square.hasResistance = false;
            }

            // Additional velocity damping when on the line
            if (isOnLine) {
                // Reduce velocity by 5% each frame to enhance slowing effect
                Body.setVelocity(square, Vector.mult(square.velocity, 0.95));
            }
        }
    }
});

// Add mouse constraint for dragging
const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
        stiffness: 0.2,
        render: { visible: false }
    }
});
World.add(world, mouseConstraint);

// Run the renderer and engine
Render.run(render);
Engine.run(engine);