const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let width, height;

function resize() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    width = canvas.width;
    height = canvas.height;
}
window.addEventListener('resize', resize);
resize();

let player;
let fortress;
let bullets = [];
let particles = [];
let keys = {};
let score = 0;
let level = 1;
let lives = 5;
let state = 'menu'; // menu, playing, dying, level_clear, gameover
let stateTimer = 0;

const mainMenu = document.getElementById('main-menu');
const hud = document.getElementById('hud');
const gameOverScreen = document.getElementById('game-over');
const scoreDisplay = document.getElementById('score-display');
const levelDisplay = document.getElementById('level-display');
const livesDisplay = document.getElementById('lives-display'); // Added back
const finalScore = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const playerNameInput = document.getElementById('player-name');
const submitScoreBtn = document.getElementById('submit-score-btn');
const highscoreEntry = document.getElementById('highscore-entry');

document.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', function () { this.blur(); });
});

window.addEventListener('keydown', e => {
    keys[e.key] = true;
    if ((state === 'playing' || state === 'dying') && (e.key === ' ' || e.key.startsWith('Arrow'))) {
        e.preventDefault();
    }
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

window.addEventListener('keydown', e => {
    if (state === 'playing' && (e.key === ' ' || e.key === 'Shoot')) {
        playerShoot();
    }
});
canvas.addEventListener('mousedown', () => {
    if (state === 'playing') playerShoot();
});

function playerShoot() {
    if (player.cooldown <= 0) {
        bullets.push(new Bullet(player.x + 18, player.y, true, 0, fortress.speedMult));
        player.cooldown = 12;
        audioController.playShoot();
    }
}

function initGame() {
    audioController.init();
    player = new Player(canvas, level);
    fortress = new Fortress(canvas, level);
    bullets = [];
    particles = [];
    score = 0;
    level = 1;
    lives = 5;
    updateHUD();
}

function spawnParticles(x, y, color, count, speedScale = 1) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color, speedScale));
    }
}
function spawnExplosion(x, y, colorPrimary, colorSecondary, count) {
    spawnParticles(x, y, colorPrimary, count, 2);
    spawnParticles(x, y, colorSecondary, count / 2, 1.5);
    spawnParticles(x, y, '#fff', count / 4, 3);
}

function updateGame() {
    if (state === 'dying' || state === 'level_clear') {
        stateTimer--;
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            if (particles[i].life <= 0) particles.splice(i, 1);
        }
        for (let i = bullets.length - 1; i >= 0; i--) {
            bullets[i].update();
            if (bullets[i].x < 0 || bullets[i].x > width + 50 || bullets[i].y < 0 || bullets[i].y > height) {
                bullets.splice(i, 1);
            }
        }

        if (stateTimer <= 0) {
            if (state === 'dying') {
                if (lives <= 0) {
                    state = 'gameover';
                    hud.classList.add('hidden');
                    gameOverScreen.classList.remove('hidden');
                    finalScore.innerText = 'SCORE: ' + score;
                    checkHighscore();
                } else {
                    player.x = 80;
                    player.y = height / 2;
                    player.active = true;
                    fortress.cx = width - 200;
                    bullets = [];
                    state = 'playing';
                }
            } else if (state === 'level_clear') {
                level++;
                updateHUD();
                player.active = true;
                player = new Player(canvas, level);
                fortress = new Fortress(canvas, level);
                bullets = [];
                state = 'playing';
            }
        }
        return;
    }

    if (state !== 'playing') return;

    player.update(keys);
    fortress.update();

    if (fortress.cx - 150 < player.canvas.width / 4) {
        die();
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.update();

        if (b.x < 0 || b.x > width + 50 || b.y < 0 || b.y > height) {
            bullets.splice(i, 1);
            continue;
        }

        if (b.isPlayer) {
            let hit = false;
            for (let wall of fortress.walls) {
                let lx = b.x - fortress.cx;
                let ly = b.y - fortress.cy;

                let onLeftRight = Math.abs(Math.abs(lx) - wall.w / 2) < (wall.thickness / 2 + b.radius) && Math.abs(ly) <= wall.h / 2 + b.radius;
                let onTopBottom = Math.abs(Math.abs(ly) - wall.h / 2) < (wall.thickness / 2 + b.radius) && Math.abs(lx) <= wall.w / 2 + b.radius;

                if (onLeftRight || onTopBottom) {
                    let p_bullet = 0;
                    if (Math.abs(lx) >= Math.abs(ly) * (wall.w / wall.h)) {
                        if (lx > 0) p_bullet = wall.w + (ly + wall.h / 2);
                        else p_bullet = 2 * wall.w + wall.h + (wall.h / 2 - ly);
                    } else {
                        if (ly < 0) p_bullet = lx + wall.w / 2;
                        else p_bullet = wall.w + wall.h + (wall.w / 2 - lx);
                    }

                    let relP = (p_bullet - wall.offset + wall.perimeter * 2) % wall.perimeter;
                    let blockIdx = Math.floor(relP / wall.blockLen) % wall.numBlocks;

                    if (wall.blocks[blockIdx]) {
                        wall.blocks[blockIdx] = false;
                        hit = true;
                        score += 20;
                        spawnParticles(b.x, b.y, wall.color, 15);
                        audioController.playHit();
                        break;
                    }
                }
            }
            if (hit) {
                bullets.splice(i, 1);
                updateHUD();
                continue;
            }

            for (let gun of fortress.guns) {
                if (!gun.active) continue;
                const gx = fortress.cx + gun.xOffset;
                const gy = fortress.cy + gun.yOffset;
                const dist = Math.hypot(b.x - gx, b.y - gy);
                if (dist < 22) {
                    hit = true;
                    score += 5;
                    spawnParticles(b.x, b.y, '#9d00ff', 10);
                    audioController.playHit();
                    break;
                }
            }
            if (hit) {
                bullets.splice(i, 1);
                updateHUD();
                continue;
            }

            const dist = Math.hypot(b.x - fortress.cx, b.y - fortress.cy);
            if (dist < fortress.zorlacRadius + b.radius && fortress.active) {
                bullets.splice(i, 1);
                score += 500;
                levelClear();
                continue;
            }

        } else {
            const dist = Math.hypot(b.x - player.x, b.y - player.y);
            if (dist < player.size && player.active) {
                bullets.splice(i, 1);
                die();
                continue;
            }
        }
    }

    for (let gun of fortress.guns) {
        if (!gun.active) continue;
        gun.cooldown--;
        if (gun.cooldown <= 0) {
            const gx = fortress.cx + gun.xOffset;
            const gy = fortress.cy + gun.yOffset;
            bullets.push(new Bullet(gx - 25, gy, false, Math.PI, fortress.speedMult));

            let baseCooldown = 90 + Math.random() * 80;
            gun.cooldown = baseCooldown / fortress.speedMult;
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].life <= 0) particles.splice(i, 1);
    }

    if (player.active && fortress.active && Math.hypot(player.x - fortress.cx, player.y - fortress.cy) < fortress.zorlacRadius + player.size) {
        die();
    }
    if (player.active) {
        for (let gun of fortress.guns) {
            if (gun.active && Math.hypot(player.x - (fortress.cx + gun.xOffset), player.y - (fortress.cy + gun.yOffset)) < player.size + 15) {
                die();
            }
        }
    }
}

function die() {
    player.active = false;
    spawnExplosion(player.x, player.y, '#00f3ff', '#fff', 80);
    audioController.playExplosion();
    lives--;
    updateHUD();

    state = 'dying';
    stateTimer = 90; // Wait 1.5 seconds
}

function levelClear() {
    fortress.active = false;
    spawnExplosion(fortress.cx, fortress.cy, '#ff0055', '#9d00ff', 150);
    audioController.playLevelUp();
    updateHUD();

    state = 'level_clear';
    stateTimer = 90; // Wait 1.5 seconds
}

function updateHUD() {
    scoreDisplay.innerText = 'SCORE: ' + score;
    levelDisplay.innerText = 'LEVEL: ' + level;
    if (livesDisplay) livesDisplay.innerText = 'LIVES: ' + lives;
}

function drawGame() {
    ctx.clearRect(0, 0, width, height);
    if (state !== 'menu') {
        player.draw(ctx, lives);
        fortress.draw(ctx);
        bullets.forEach(b => b.draw(ctx));
        particles.forEach(p => p.draw(ctx));
    }
}

function loop() {
    updateGame();
    drawGame();
    requestAnimationFrame(loop);
}

let leaderboard = JSON.parse(localStorage.getItem('zorlacLeaderboard')) || [];

function saveScore(name, newScore) {
    leaderboard.push({ name: name || 'CMD', score: newScore });
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 5);
    localStorage.setItem('zorlacLeaderboard', JSON.stringify(leaderboard));
    renderLeaderboards();
}

function renderLeaderboards() {
    const ml = document.getElementById('menu-leaderboard-list');
    const fl = document.getElementById('full-leaderboard-list');
    ml.innerHTML = '';
    fl.innerHTML = '';

    leaderboard.forEach((entry, i) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${i + 1}. ${entry.name}</span><span>${entry.score}</span>`;
        ml.appendChild(li.cloneNode(true));
        fl.appendChild(li.cloneNode(true));
    });
}

function checkHighscore() {
    if (leaderboard.length < 5 || score > leaderboard[leaderboard.length - 1].score) {
        highscoreEntry.classList.remove('hidden');
    } else {
        highscoreEntry.classList.add('hidden');
    }
}

startBtn.addEventListener('click', () => {
    mainMenu.classList.add('hidden');
    hud.classList.remove('hidden');
    initGame();
    state = 'playing';
});

restartBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    initGame();
    state = 'playing';
});

submitScoreBtn.addEventListener('click', () => {
    const name = playerNameInput.value.toUpperCase();
    saveScore(name, score);
    highscoreEntry.classList.add('hidden');
    playerNameInput.value = '';
});

// Init
renderLeaderboards();
requestAnimationFrame(loop);
