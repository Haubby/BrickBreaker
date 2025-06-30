
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const startButton = document.getElementById('startButton');
const gameOverScreen = document.getElementById('gameOverScreen');
const playAgainButton = document.getElementById('playAgainButton');
const finalScoreElement = document.getElementById('finalScore');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let gameOver = false;
let gameStarted = false;
let ballReleased = false;
let score = 0;
let lives = 3;

// AudioContext for Web Audio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Function to play a simple sound
function playSound (frequency, duration, type = 'sine', gain = 0.1) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

    gainNode.gain.setValueAtTime(gain, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + duration);
}

// Game objects
const paddle = {
    x: canvas.width / 2 - 50,
    y: canvas.height - 30,
    width: 100,
    height: 10,
    color: '#00ff00',
    dx: 0
};

const ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 10,
    color: '#ff00ff',
    dx: 0,
    dy: 0,
    speed: 6 // Initial speed of the ball
};

const bricks = [];
const brickInfo = {
    width: 75,
    height: 20,
    padding: 10,
    offsetX: 30,
    offsetY: 50,
    colors: ['#ff00ff', '#00ffff', '#ffff00', '#ff0099', '#33cc33', '#ff6600', '#66ff66', '#ff33cc'],
    dx: 5 // Increased speed for continuous movement
};

const brickColumnCount = Math.floor((canvas.width - 2 * brickInfo.offsetX) / (brickInfo.width + brickInfo.padding));
const totalBrickFormationWidth = brickColumnCount * (brickInfo.width + brickInfo.padding);
const brickRowCount = 5;

for (let c = 0; c < brickColumnCount; c++) {
    bricks[c] = [];
    for (let r = 0; r < brickRowCount; r++) {
        bricks[c][r] = { status: 1 };
    }
}

const particles = [];

// Particle class
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = Math.random() * 2 + 1;
        this.dx = (Math.random() - 0.5) * 5;
        this.dy = (Math.random() - 0.5) * 5;
        this.alpha = 1;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }

    update(speedMultiplier) {
        this.x += this.dx * speedMultiplier;
        this.y += this.dy * speedMultiplier;
        this.alpha -= 0.02 * speedMultiplier;
        this.draw();
    }
}

// Draw functions
function drawPaddle() {
    ctx.beginPath();
    ctx.rect(paddle.x, paddle.y, paddle.width, paddle.height);
    ctx.fillStyle = paddle.color;
    ctx.shadowColor = paddle.color;
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.closePath();
    ctx.shadowBlur = 0; // Reset shadow
}

function drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = ball.color;
    ctx.shadowColor = ball.color;
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.closePath();
    ctx.shadowBlur = 0; // Reset shadow
}

function drawBricks() {
    let allBricksBroken = true;
    const totalBrickFormationWidth = brickColumnCount * (brickInfo.width + brickInfo.padding);

    for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
            if (bricks[c][r].status === 1) {
                allBricksBroken = false;
                let brickX = (c * (brickInfo.width + brickInfo.padding)) + brickInfo.offsetX;
                const brickY = (r * (brickInfo.height + brickInfo.padding)) + brickInfo.offsetY;
                const color = brickInfo.colors[r % brickInfo.colors.length];

                // Draw the brick at its current position
                ctx.beginPath();
                ctx.rect(brickX, brickY, brickInfo.width, brickInfo.height);
                ctx.fillStyle = color;
                ctx.shadowColor = color;
                const pulse = Math.sin(brickAnimationTime / 200 + r) * 5;
                ctx.shadowBlur = 10 + pulse;
                ctx.fill();
                ctx.closePath();
                ctx.shadowBlur = 0;

                // Draw duplicate brick for seamless looping
                // Since dx is positive, bricks move right. Duplicate should appear on the left.
                let duplicateBrickX = brickX - totalBrickFormationWidth;

                ctx.beginPath();
                ctx.rect(duplicateBrickX, brickY, brickInfo.width, brickInfo.height);
                ctx.fillStyle = color;
                ctx.shadowColor = color;
                ctx.shadowBlur = 10 + pulse;
                ctx.fill();
                ctx.closePath();
                ctx.shadowBlur = 0;
            }
        }
    }
    if (allBricksBroken) {
        showGameOverScreen("YOU WIN!", score + 100);
        gameOver = true;
    }
}

function drawScore() {
    ctx.fillStyle = '#00ffea';
    ctx.font = '20px "Press Start 2P"';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 20, 30);
}

function drawLives() {
    ctx.fillStyle = '#ff00ff';
    ctx.font = '20px "Press Start 2P"';
    ctx.textAlign = 'right';
    ctx.fillText(`Lives: ${lives}`, canvas.width - 20, 30);
}

// Move ball
function moveBall(speedMultiplier) {
    ball.x += ball.dx * speedMultiplier;
    ball.y += ball.dy * speedMultiplier;

    // Wall collision (left/right)
    if (ball.x + ball.radius > canvas.width || ball.x - ball.radius < 0) {
        ball.dx *= -1;
        playSound(440, 0.1); // Wall bounce sound
    }

    // Wall collision (top)
    if (ball.y - ball.radius < 0) {
        ball.dy *= -1;
        playSound(440, 0.1); // Wall bounce sound
    }

    // Paddle collision
    if (
        ball.y + ball.radius > paddle.y &&
        ball.y - ball.radius < paddle.y + paddle.height && // Check top and bottom of paddle
        ball.x + ball.radius > paddle.x &&
        ball.x - ball.radius < paddle.x + paddle.width
    ) {
        // Determine where the ball hit the paddle for varied bounce angle
        const hitPoint = ball.x - (paddle.x + paddle.width / 2);
        const normalizeHit = hitPoint / (paddle.width / 2); // -1 to 1
        const bounceAngle = normalizeHit * (Math.PI / 3); // Max 60 degrees

        ball.dx = ball.speed * Math.sin(bounceAngle);
        ball.dy = -ball.speed * Math.cos(bounceAngle); // Always bounce up

        playSound(660, 0.1); // Paddle bounce sound
    }

    // Brick collision
    for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
            const b = bricks[c][r];
            if (b.status === 1) {
                // Calculate current brick position based on its column, row, and the global offsetX
                const currentBrickX = ((c * (brickInfo.width + brickInfo.padding)) + brickInfo.offsetX);
                const normalizedBrickX = (currentBrickX % canvas.width + canvas.width) % canvas.width;
                const currentBrickY = (r * (brickInfo.height + brickInfo.padding)) + brickInfo.offsetY;

                // Check for collision with the current brick (considering ball radius)
                if (
                    ball.x + ball.radius > normalizedBrickX &&
                    ball.x - ball.radius < normalizedBrickX + brickInfo.width &&
                    ball.y + ball.radius > currentBrickY &&
                    ball.y - ball.radius < currentBrickY + brickInfo.height
                ) {
                    ball.dy *= -1; // Reverse ball direction
                    b.status = 0; // Mark brick as broken
                    score += 10; // Add score for hitting brick
                    playSound(880, 0.05); // Brick hit sound

                    // Create particles
                    for (let i = 0; i < 10; i++) {
                        particles.push(new Particle(ball.x, ball.y, brickInfo.colors[r % brickInfo.colors.length]));
                    }

                    // Check for win
                    let allBricksBroken = true;
                    for (let col = 0; col < brickColumnCount; col++) {
                        for (let row = 0; row < brickRowCount; row++) {
                            if (bricks[col][row].status === 1) {
                                allBricksBroken = false;
                                break;
                            }
                        }
                        if (!allBricksBroken) break;
                    }

                    if (allBricksBroken) {
                        showGameOverScreen("YOU WIN!", score + 100); // Bonus for winning
                        gameOver = true;
                        return;
                    }
                }
            }
        }
    }

    // Reset ball if it hits the bottom
    if (ball.y + ball.radius > canvas.height) {
        lives -= 1; // Lose a life
        playSound(220, 0.5, 'sawtooth'); // Game over sound

        if (lives <= 0) {
            // Game over - no more lives
            showGameOverScreen("GAME OVER", score);
            gameOver = true;
            return;
        } else {
            // Reset ball position but keep playing
            ballReleased = false;
            ball.x = paddle.x + paddle.width / 2;
            ball.y = paddle.y - ball.radius;
            ball.dx = 0;
            ball.dy = 0;
            // Reset paddle position
            paddle.x = canvas.width / 2 - 50;
        }
    }
}

function showGameOverScreen(message, finalScore) {
    canvas.style.display = 'none';
    gameOverScreen.style.display = 'flex';
    gameOverScreen.querySelector('h1').textContent = message;
    finalScoreElement.textContent = `Score: ${finalScore}`;
}

function resetGame() {
    gameOver = false;
    score = 0; // Reset score
    lives = 3; // Reset lives
    ballReleased = false;

    // Reset paddle position
    paddle.x = canvas.width / 2 - 50;
    
    // Reset bricks
    brickInfo.offsetX = 30;
    for (let c = 0; c < brickColumnCount; c++) {
        bricks[c] = []; // Re-initialize inner array
        for (let r = 0; r < brickRowCount; r++) {
            bricks[c][r] = { status: 1 };
        }
    }
    
    // Clear particles
    particles.length = 0;
    
    // Hide game over screen and show canvas
    gameOverScreen.style.display = 'none';
    canvas.style.display = 'block';

    // Set ball dx and dy to 0 so it doesn't move until released
    ball.dx = 0;
    ball.dy = 0;
}

let lastTime = 0;
let brickAnimationTime = 0;
// Game loop
function update(timestamp = 0) {
    if (!lastTime) {
        lastTime = timestamp;
    }
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    if (gameOver) {
        requestAnimationFrame(update);
        return;
    }

    const speedMultiplier = deltaTime > 0 ? deltaTime / (1000 / 60) : 1;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawPaddle();
    drawBall();
    drawBricks();
    drawScore(); // Add score display
    drawLives(); // Add lives display

    // Update and draw particles
    particles.forEach((particle, index) => {
        if (particle.alpha <= 0) {
            particles.splice(index, 1);
        } else {
            particle.update(speedMultiplier);
        }
    });

    if (gameStarted && !ballReleased) {
        ball.x = paddle.x + paddle.width / 2;
        ball.y = paddle.y - ball.radius;
    } else if (gameStarted && ballReleased) {
        moveBall(speedMultiplier);
    }

    brickAnimationTime += deltaTime;

    // Update brickInfo.offsetX for continuous movement
    brickInfo.offsetX += brickInfo.dx * speedMultiplier;
    // Wrap offsetX around the total width of the brick formation
    const totalBrickFormationWidth = brickColumnCount * (brickInfo.width + brickInfo.padding);
    brickInfo.offsetX = (brickInfo.offsetX % totalBrickFormationWidth + totalBrickFormationWidth) % totalBrickFormationWidth;

    requestAnimationFrame(update);
}

// Function to start the game
function startGame() {
    if (!gameStarted) {
        gameStarted = true;
        ballReleased = false;
        gameOver = false; // Ensure game is not over
        score = 0; // Reset score
        lives = 3; // Reset lives

        resetGame(); // Reset game elements and start the loop

        startScreen.style.display = 'none';
        canvas.style.display = 'block';
        gameOverScreen.style.display = 'none'; // Hide game over screen if it was visible

        audioCtx.resume(); // Resume audio context on user interaction
    }
}

// Initial setup: show start screen
startScreen.style.display = 'flex';
canvas.style.display = 'none';
gameOverScreen.style.display = 'none';

// Event listeners
canvas.addEventListener('click', () => {
    if (gameStarted && !ballReleased) {
        ballReleased = true;
        ball.dx = ball.speed;
        ball.dy = -ball.speed;
    }
});
startButton.addEventListener('click', startGame);
playAgainButton.addEventListener('click', () => {
    gameStarted = false;
    startGame();
}); // Play again button also starts a new game

// Mouse event handler
document.addEventListener('mousemove', (e) => {
    const relativeX = e.clientX - canvas.offsetLeft;
    if (relativeX > 0 && relativeX < canvas.width) {
        paddle.x = relativeX - paddle.width / 2;
    }
});

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // We might need to recalculate brick positions and other things here
    // For now, we'll just reload the game on resize for simplicity
    document.location.reload();
});

// Touch event handlers
canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const relativeX = touch.clientX - canvas.offsetLeft;
    if (relativeX > 0 && relativeX < canvas.width) {
        paddle.x = relativeX - paddle.width / 2;
    }
}, { passive: false });

canvas.addEventListener('touchstart', (e) => {
    // On touch start, if game is over, restart it
    if (gameOver) {
        startGame();
    }
});

// Initial call to update to set up the canvas and draw initial state (before game starts)
requestAnimationFrame(update);
