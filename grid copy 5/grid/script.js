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

// Create engine and world
const engine = Engine.create();
const world = engine.world;
world.gravity.y = 0; // Disable gravity for material simulation

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
        background: '#000000'
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

// Create 10x10 grid
const rows = 10;
const cols = 10;
const squareSize = 10;
const spacing = 5;
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
            friction: 0.1,
            restitution: 1
        });
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
                damping: 0.1,
                render: { visible: false } // Hide the constraint line
            });
            World.add(world, constraint);
        }
        // Vertical constraints
        if (j < rows - 1) {
            const constraint = Constraint.create({
                bodyA: grid[i][j],
                bodyB: grid[i][j + 1],
                length: squareSize + spacing,
                stiffness: 0.5,
                damping: 0.1,
                render: { visible: false } // Hide the constraint line
            });
            World.add(world, constraint);
        }
    }
}

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