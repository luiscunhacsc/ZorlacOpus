// helpers
function getPointOnRect(w, h, p) {
    p = p % (2 * w + 2 * h);
    if (p < 0) p += 2 * w + 2 * h;
    if (p <= w) return { x: -w / 2 + p, y: -h / 2 };
    p -= w;
    if (p <= h) return { x: w / 2, y: -h / 2 + p };
    p -= h;
    if (p <= w) return { x: w / 2 - p, y: h / 2 };
    p -= w;
    return { x: -w / 2, y: h / 2 - p };
}

function drawRectPath(ctx, w, h, pStart, pEnd) {
    const P = 2 * w + 2 * h;
    pStart = (pStart % P + P) % P;
    pEnd = (pEnd % P + P) % P;

    let pt = getPointOnRect(w, h, pStart);
    ctx.moveTo(pt.x, pt.y);

    let corners = [
        { p: w, x: w / 2, y: -h / 2 },
        { p: w + h, x: w / 2, y: h / 2 },
        { p: 2 * w + h, x: -w / 2, y: h / 2 },
        { p: 0, x: -w / 2, y: -h / 2 }
    ];

    let drawDist = (pEnd - pStart + P) % P;
    if (drawDist === 0) drawDist = P;

    let lenLeft = drawDist;
    let currentP = pStart;
    let fallback = 10;
    while (lenLeft > 0.05 && fallback-- > 0) {
        let nextCorner = null;
        let distToNextCorner = P;

        for (let c of corners) {
            let dist = (c.p - currentP + P) % P;
            if (dist > 0.05 && dist < distToNextCorner) {
                distToNextCorner = dist;
                nextCorner = c;
            }
        }

        if (distToNextCorner <= lenLeft + 0.05 && nextCorner) {
            ctx.lineTo(nextCorner.x, nextCorner.y);
            currentP = nextCorner.p;
            lenLeft -= distToNextCorner;
        } else {
            let endP = (currentP + lenLeft) % P;
            let endPt = getPointOnRect(w, h, endP);
            ctx.lineTo(endPt.x, endPt.y);
            lenLeft = 0;
        }
    }
}

class Player {
    constructor(canvas, level) {
        this.canvas = canvas;
        this.size = 20;
        this.x = 80;
        this.y = canvas.height / 2;
        // Adjust speed slightly by level
        let speedMult = Math.min(2.0, 0.33 + ((level - 1) * 0.074));
        this.speed = 5 * Math.max(0.7, Math.min(1.2, speedMult));
        this.color = '#00f3ff';
        this.cooldown = 0;
        this.active = true;
    }

    update(keys) {
        if (!this.active) return;

        if (keys['w'] || keys['ArrowUp']) this.y -= this.speed;
        if (keys['s'] || keys['ArrowDown']) this.y += this.speed;
        if (keys['a'] || keys['ArrowLeft']) this.x -= this.speed;
        if (keys['d'] || keys['ArrowRight']) this.x += this.speed;

        this.x = Math.max(this.size, Math.min(this.canvas.width / 4, this.x));
        this.y = Math.max(this.size, Math.min(this.canvas.height - this.size, this.y));

        if (this.cooldown > 0) this.cooldown--;
    }

    draw(ctx, lives) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x, this.y);

        ctx.shadowBlur = 15 + Math.random() * 5;
        ctx.shadowColor = this.color;

        ctx.fillStyle = 'rgba(0, 30, 50, 0.8)';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.roundRect(-18, -20, 10, 40, 4);
        ctx.fill(); ctx.stroke();

        ctx.beginPath();
        ctx.roundRect(8, -20, 10, 40, 4);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = 'rgba(0, 100, 150, 0.8)';
        ctx.beginPath();
        ctx.roundRect(-10, -12, 20, 24, 3);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.lineTo(15, -3);
        ctx.lineTo(15, 3);
        ctx.lineTo(0, 3);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px "Orbitron"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(lives.toString(), 0, -20);

        ctx.restore();
    }
}

class Bullet {
    constructor(x, y, isPlayer, angle, speedMult) {
        this.x = x;
        this.y = y;
        this.isPlayer = isPlayer;
        let baseSpeed = isPlayer ? 14 : 9;
        this.speed = baseSpeed * (isPlayer ? 1 : speedMult);
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
        this.radius = isPlayer ? 4 : 5;
        this.color = isPlayer ? '#00f3ff' : '#ff0055';
        this.coreColor = isPlayer ? '#ffffff' : '#ffffaa';
        this.active = true;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;

        if (this.isPlayer) {
            ctx.fillStyle = this.coreColor;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.strokeStyle = this.color;
            ctx.lineCap = 'round';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(this.x + 12, this.y);
            ctx.lineTo(this.x - 6, this.y);
            ctx.stroke();

            ctx.strokeStyle = this.coreColor;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color, speedScale = 1) {
        this.x = x;
        this.y = y;
        let angle = Math.random() * Math.PI * 2;
        let vel = (Math.random() * 12 + 2) * speedScale;
        this.vx = Math.cos(angle) * vel;
        this.vy = Math.sin(angle) * vel;
        this.life = 1.0;
        this.decay = Math.random() * 0.015 + 0.01;
        this.color = color;
        this.size = Math.random() * 5 + 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.95; // friction
        this.vy *= 0.95;
        this.life -= this.decay;
        this.size *= 0.96;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class BlockWall {
    constructor(w, h, speed, thickness, color, isDotted) {
        this.w = w;
        this.h = h;
        this.speed = speed;
        this.thickness = thickness;
        this.color = color;
        this.isDotted = isDotted;
        this.perimeter = 2 * w + 2 * h;
        this.blockLen = 15;
        this.numBlocks = Math.ceil(this.perimeter / this.blockLen);
        this.blocks = new Array(this.numBlocks).fill(true);
        let gapBlocks = Math.floor(this.numBlocks * 0.15);
        for (let i = 0; i < gapBlocks; i++) this.blocks[i] = false;
        this.offset = Math.random() * this.perimeter;
    }

    update() {
        this.offset = (this.offset + this.speed + this.perimeter) % this.perimeter;
    }

    draw(ctx, cx, cy) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.lineWidth = this.thickness;
        ctx.lineCap = 'round';

        if (this.isDotted) {
            ctx.setLineDash([15, 15]);
        }

        let starts = [];
        let ends = [];
        let inSolid = false;
        let allSolid = true;
        for (let i = 0; i < this.numBlocks; i++) {
            if (!this.blocks[i]) allSolid = false;

            if (this.blocks[i] && !inSolid) {
                inSolid = true;
                starts.push(i);
            } else if (!this.blocks[i] && inSolid) {
                inSolid = false;
                ends.push(i);
            }
        }
        if (inSolid) ends.push(this.numBlocks);

        if (allSolid) {
            ctx.beginPath();
            drawRectPath(ctx, this.w, this.h, 0, this.perimeter);
            ctx.stroke();
        } else if (starts.length > 0) {
            if (starts[0] === 0 && ends[ends.length - 1] === this.numBlocks) {
                starts[0] = starts[starts.length - 1];
                starts.pop();
                ends.pop();
            }
            ctx.beginPath();
            for (let i = 0; i < starts.length; i++) {
                let pStart = this.offset + starts[i] * this.blockLen;
                let pEnd = this.offset + ends[i] * this.blockLen;
                drawRectPath(ctx, this.w, this.h, pStart, pEnd);
            }
            ctx.stroke();

            ctx.strokeStyle = '#fff';
            ctx.lineWidth = this.thickness / 3;
            ctx.shadowBlur = 0;
            ctx.stroke();
        }
        ctx.restore();
    }
}

class Gun {
    constructor(xOffset, yOffset) {
        this.xOffset = xOffset;
        this.yOffset = yOffset;
        this.cooldown = Math.random() * 60;
        this.active = true;
    }

    draw(ctx, cx, cy) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(cx + this.xOffset, cy + this.yOffset);

        ctx.fillStyle = '#112';
        ctx.strokeStyle = '#335';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-12, -12, 24, 24, 4);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = '#111';
        ctx.strokeStyle = '#ff0055';
        ctx.beginPath();
        ctx.fillRect(-28, -5, 16, 10);
        ctx.strokeRect(-28, -5, 16, 10);

        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff0055';
        ctx.fillStyle = '#ff0055';
        ctx.beginPath();
        ctx.arc(-26, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

class Fortress {
    constructor(canvas, level) {
        this.canvas = canvas;
        this.cx = canvas.width - 200;
        this.cy = canvas.height / 2;
        this.zorlacRadius = 25;
        this.walls = [];
        this.guns = [];

        // Speed scaling! Reaches 1.0 multiplier at level 10
        this.speedMult = Math.min(3.0, 0.33 + ((level - 1) * 0.074));

        // The fortress now approaches at half the previous base speed
        this.speedX = -0.325 * this.speedMult;
        this.moveTime = 0;
        this.active = true;

        const baseW = 90, baseH = 200;
        const stepW = 50, stepH = 60;
        const colors = ['#00f3ff', '#9d00ff', '#ff0055'];
        const baseSpeeds = [1.5, -1.0, 1.8];
        const isDotted = [false, true, false];

        for (let i = 0; i < 3; i++) {
            let w = baseW + i * stepW * 2;
            let h = baseH + i * stepH * 2;
            this.walls.push(new BlockWall(w, h, baseSpeeds[i] * this.speedMult, 12, colors[i], isDotted[i]));
        }

        const outerW = baseW + 2 * stepW * 2;
        const outerH = baseH + 2 * stepH * 2;

        const gunX = -outerW / 2 - 25;
        const gunSpace = (outerH - 60) / 3;
        const startY = -outerH / 2 + 30;
        for (let i = 0; i < 4; i++) {
            this.guns.push(new Gun(gunX, startY + i * gunSpace));
        }
    }

    update() {
        if (!this.active) return;
        this.cx += this.speedX;
        this.cy += Math.sin(this.moveTime += 0.02 * this.speedMult) * 1.5 * this.speedMult;

        for (let wall of this.walls) {
            wall.update();
        }
    }

    drawZorlac(ctx, cx, cy, time) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(cx, cy);
        let pulse = Math.sin(time * 5 * this.speedMult) * 0.1 + 1.0;
        ctx.scale(pulse, pulse);

        ctx.shadowBlur = 25 + Math.sin(time * 10 * this.speedMult) * 10;
        ctx.shadowColor = '#ff0055';
        ctx.fillStyle = '#200';
        ctx.strokeStyle = '#ff0055';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(-18, -12); ctx.lineTo(18, -12);
        ctx.lineTo(25, -20); ctx.lineTo(-25, -20);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.ellipse(-10, -16, 5, 2, Math.PI / 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(10, -16, 5, 2, -Math.PI / 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-8, -6);
        ctx.lineTo(-4, -2); ctx.lineTo(0, -6);
        ctx.lineTo(4, -2); ctx.lineTo(8, -6);
        ctx.stroke();

        ctx.shadowColor = '#ff0055';

        ctx.fillStyle = '#401';
        ctx.beginPath();
        ctx.moveTo(-12, -4); ctx.lineTo(12, -4);
        ctx.lineTo(8, 20); ctx.lineTo(-8, 20);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-12, 2); ctx.lineTo(-22, 10); ctx.lineTo(-26, 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(12, 2); ctx.lineTo(22, 10); ctx.lineTo(26, 4);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-6, 20); ctx.lineTo(-12, 32); ctx.lineTo(-16, 32);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(6, 20); ctx.lineTo(12, 32); ctx.lineTo(16, 32);
        ctx.stroke();

        ctx.fillStyle = '#ff0055';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(0, 8, 4 + Math.sin(time * 15 * this.speedMult) * 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    draw(ctx) {
        if (!this.active) return;
        for (let gun of this.guns) {
            gun.draw(ctx, this.cx, this.cy);
        }
        for (let wall of this.walls) {
            wall.draw(ctx, this.cx, this.cy);
        }
        this.drawZorlac(ctx, this.cx, this.cy, Date.now() / 1000);
    }
}
