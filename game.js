document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('pongCanvas');
    const ctx = canvas.getContext('2d');

    // Set canvas dimensions
    canvas.width = 1000;
    canvas.height = 600;
    
    // Load game sounds
    const sounds = {
        paddle: new Howl({
            src: ['https://assets.codepen.io/21542/howler-paddle.mp3'],
            volume: 0.5
        }),
        score: new Howl({
            src: ['https://assets.codepen.io/21542/howler-score.mp3'],
            volume: 0.7
        }),
        laser: new Howl({
            src: ['https://assets.codepen.io/21542/howler-laser.mp3'],
            volume: 0.5
        }),
        hit: new Howl({
            src: ['https://assets.codepen.io/21542/howler-hit.mp3'],
            volume: 0.6
        }),
        destroy: new Howl({
            src: ['https://assets.codepen.io/21542/howler-explosion.mp3'],
            volume: 0.6
        })
    };
    
    // Create background with stars
    const stars = [];
    const numStars = 100;
    
    for (let i = 0; i < numStars; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: Math.random() * 2,
            opacity: Math.random(),
            speed: Math.random() * 0.5
        });
    }
    
    // Create particle systems
    const particles = [];
    
    function createParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            particles.push({
                x,
                y,
                vx: (Math.random() - 0.5) * 5,
                vy: (Math.random() - 0.5) * 5,
                radius: Math.random() * 3 + 1,
                color,
                life: Math.random() * 30 + 10
            });
        }
    }

    // Game variables
    const paddleWidth = 10;
    const leftPaddleHeight = 150;  // Both paddles same size now
    const rightPaddleHeight = 150; // Player 2 paddle size
    const paddleSegments = 4; // Reduced number of segments for destructible paddle
    const leftSegmentHeight = leftPaddleHeight / paddleSegments;
    const rightSegmentHeight = rightPaddleHeight / paddleSegments;
    const ballSize = 10;
    const paddleMaxSpeed = 12;
    const paddleAcceleration = 0.5;
    const paddleDeceleration = 0.3;
    const laserWidth = 30;
    const laserHeight = 10;
    const laserSpeed = 6;  // Slower laser speed
    const rechargeTime = 1200; // 20 seconds at 60fps
    const laserManaCost = rechargeTime / 4; // Lasers cost 1/4 of full mana
    let flashTimer = 0;
    let flashColor = "";
    let messageTimer = 0;
    let messageText = "";
    let messageColor = "";

    // Game objects
    const gameState = {
        leftPaddle: {
            x: 20,
            y: canvas.height / 2 - leftPaddleHeight / 2,
            width: paddleWidth,
            height: leftPaddleHeight,
            score: 0,
            moveUp: false,
            moveDown: false,
            velocity: 0,
            laser: null,
            laserCooldown: 0, // Cooldown for firing laser
            healCooldown: 0,  // Cooldown for healing
            upgradeCooldown: 0, // Cooldown for upgrading
            chargeLevel: rechargeTime,  // Start with full mana
            segments: Array(paddleSegments).fill(true), // Array of active segments
            attackType: 'destroy', // Type of attack: 'destroy' to break segments
            laserLevel: 1, // Current laser level (starts at 1)
            laserWidth: laserWidth, // Current laser width
            laserHeight: laserHeight // Current laser height
        },
        rightPaddle: {
            x: canvas.width - paddleWidth - 20,
            y: canvas.height / 2 - rightPaddleHeight / 2,
            width: paddleWidth,
            height: rightPaddleHeight,
            score: 0,
            moveUp: false,
            moveDown: false,
            velocity: 0,
            laser: null,
            laserCooldown: 0, // Cooldown for firing laser
            healCooldown: 0,  // Cooldown for healing
            upgradeCooldown: 0, // Cooldown for upgrading
            chargeLevel: rechargeTime,  // Start with full mana
            segments: Array(paddleSegments).fill(true), // Array of active segments
            attackType: 'destroy', // Type of attack: 'destroy' to break segments
            laserLevel: 1, // Current laser level (starts at 1)
            laserWidth: laserWidth, // Current laser width
            laserHeight: laserHeight // Current laser height
        },
        ball: {
            x: canvas.width / 2,
            y: canvas.height / 2,
            size: ballSize,
            speedX: 3,
            speedY: 3
        },
        lasers: []
    };

    // Key controls
    const keys = {
        q: false,  // Left paddle up
        z: false,  // Left paddle down
        a: false,  // Left paddle shoot
        s: false,  // Left paddle regenerate segment
        d: false,  // Left paddle upgrade laser
        
        p: false,  // Right paddle up
        l: false,  // Right paddle down
        b: false,  // Right paddle shoot
        n: false,  // Right paddle regenerate segment
        m: false,  // Right paddle upgrade laser
        
        k: false   // Debug key
    };

    // Event listeners for keyboard input
    window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() in keys) {
            keys[e.key.toLowerCase()] = true;
            e.preventDefault(); // Prevent scrolling with keys
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key.toLowerCase() in keys) {
            keys[e.key.toLowerCase()] = false;
        }
    });

    function updatePaddles() {
        // Update charge levels for both paddles - cap at rechargeTime
        if (gameState.leftPaddle.chargeLevel < rechargeTime) {
            gameState.leftPaddle.chargeLevel++;
        }
        
        if (gameState.rightPaddle.chargeLevel < rechargeTime) {
            gameState.rightPaddle.chargeLevel++;
        }
        
        // Debug mana system
        if (keys.k) {
            console.log("Left paddle mana:", gameState.leftPaddle.chargeLevel, 
                        "Right paddle mana:", gameState.rightPaddle.chargeLevel,
                        "Laser cost:", laserManaCost,
                        "Full mana:", rechargeTime);
        }
        
        // Update cooldowns
        if (gameState.leftPaddle.healCooldown > 0) {
            gameState.leftPaddle.healCooldown--;
        }
        
        if (gameState.rightPaddle.healCooldown > 0) {
            gameState.rightPaddle.healCooldown--;
        }
        
        if (gameState.leftPaddle.upgradeCooldown > 0) {
            gameState.leftPaddle.upgradeCooldown--;
        }
        
        if (gameState.rightPaddle.upgradeCooldown > 0) {
            gameState.rightPaddle.upgradeCooldown--;
        }
        
        // Left paddle (Player 1)
        // Apply acceleration/deceleration
        if (keys.q) {
            // Accelerate upward (negative velocity)
            gameState.leftPaddle.velocity -= paddleAcceleration;
            // Cap at max speed
            if (gameState.leftPaddle.velocity < -paddleMaxSpeed) {
                gameState.leftPaddle.velocity = -paddleMaxSpeed;
            }
        } else if (keys.z) {
            // Accelerate downward (positive velocity)
            gameState.leftPaddle.velocity += paddleAcceleration;
            // Cap at max speed
            if (gameState.leftPaddle.velocity > paddleMaxSpeed) {
                gameState.leftPaddle.velocity = paddleMaxSpeed;
            }
        } else {
            // Decelerate when no keys are pressed
            if (gameState.leftPaddle.velocity > 0) {
                gameState.leftPaddle.velocity -= paddleDeceleration;
                if (gameState.leftPaddle.velocity < 0) gameState.leftPaddle.velocity = 0;
            } else if (gameState.leftPaddle.velocity < 0) {
                gameState.leftPaddle.velocity += paddleDeceleration;
                if (gameState.leftPaddle.velocity > 0) gameState.leftPaddle.velocity = 0;
            }
        }
        
        // Update paddle position based on velocity
        gameState.leftPaddle.y += gameState.leftPaddle.velocity;
        
        // Keep paddle in bounds
        if (gameState.leftPaddle.y < 0) {
            gameState.leftPaddle.y = 0;
            gameState.leftPaddle.velocity = 0;
        } else if (gameState.leftPaddle.y > canvas.height - gameState.leftPaddle.height) {
            gameState.leftPaddle.y = canvas.height - gameState.leftPaddle.height;
            gameState.leftPaddle.velocity = 0;
        }
        
        // Fire laser from left paddle - only needs 1/4 mana
        if (keys.a && gameState.leftPaddle.chargeLevel >= laserManaCost && gameState.leftPaddle.laserCooldown <= 0) {
            gameState.lasers.push({
                x: gameState.leftPaddle.x + paddleWidth,
                y: gameState.leftPaddle.y + (leftPaddleHeight / 2) - (gameState.leftPaddle.laserHeight / 2),
                width: gameState.leftPaddle.laserWidth,
                height: gameState.leftPaddle.laserHeight,
                speed: laserSpeed,
                fromLeft: true,
                type: gameState.leftPaddle.attackType, // 'destroy' type
                age: 0,
                maxAge: 200 // Increased lifetime to reach across the board
            });
            // Reduce charge by laser cost
            gameState.leftPaddle.chargeLevel -= laserManaCost;
            
            // Set a longer cooldown to prevent accidental double-firing
            gameState.leftPaddle.laserCooldown = 30;
            
            // Play sound and create particles
            sounds.laser.play();
            createParticles(
                gameState.leftPaddle.x + paddleWidth,
                gameState.leftPaddle.y + (leftPaddleHeight / 2),
                '#ff00ff',
                15
            );
        }
        
        // Decrease laser cooldown
        if (gameState.leftPaddle.laserCooldown > 0) {
            gameState.leftPaddle.laserCooldown--;
        }
        
        // Upgrade laser - only if fully charged
        if (keys.d && gameState.leftPaddle.chargeLevel >= rechargeTime && gameState.leftPaddle.upgradeCooldown <= 0) {
            // Increase laser width and height by 20%
            gameState.leftPaddle.laserWidth *= 1.2;
            gameState.leftPaddle.laserHeight *= 1.2;
            gameState.leftPaddle.laserLevel++;
            
            // Reset charge after upgrading
            gameState.leftPaddle.chargeLevel = 0;
            
            // Set a cooldown for upgrading
            gameState.leftPaddle.upgradeCooldown = 20;
            
            // Play sound and create particles for upgrade
            sounds.hit.play();
            createParticles(
                gameState.leftPaddle.x + paddleWidth/2,
                gameState.leftPaddle.y + (leftPaddleHeight/2),
                '#ffff00',
                30
            );
        }
        
        // Regenerate a paddle segment - only if fully charged
        if (keys.s && gameState.leftPaddle.chargeLevel >= rechargeTime && gameState.leftPaddle.healCooldown <= 0) {
            // Find the first destroyed segment
            let regenerated = false;
            for (let i = 0; i < paddleSegments; i++) {
                if (!gameState.leftPaddle.segments[i]) {
                    // Regenerate this segment
                    gameState.leftPaddle.segments[i] = true;
                    regenerated = true;
                    
                    // Create healing particles
                    createParticles(
                        gameState.leftPaddle.x + paddleWidth/2,
                        gameState.leftPaddle.y + (i * leftSegmentHeight) + (leftSegmentHeight/2),
                        '#00ff99',
                        20
                    );
                    
                    // Play healing sound
                    sounds.hit.play();
                    
                    break;
                }
            }
            
            // Only use mana if something was actually regenerated
            if (regenerated) {
                // Reset charge after regenerating
                gameState.leftPaddle.chargeLevel = 0;
                
                // Set a cooldown for healing spell
                gameState.leftPaddle.healCooldown = 20;
            }
        }

        // Right paddle (Player 2)
        // Apply acceleration/deceleration
        if (keys.p) {
            // Accelerate upward (negative velocity)
            gameState.rightPaddle.velocity -= paddleAcceleration;
            // Cap at max speed
            if (gameState.rightPaddle.velocity < -paddleMaxSpeed) {
                gameState.rightPaddle.velocity = -paddleMaxSpeed;
            }
        } else if (keys.l) {
            // Accelerate downward (positive velocity)
            gameState.rightPaddle.velocity += paddleAcceleration;
            // Cap at max speed
            if (gameState.rightPaddle.velocity > paddleMaxSpeed) {
                gameState.rightPaddle.velocity = paddleMaxSpeed;
            }
        } else {
            // Decelerate when no keys are pressed
            if (gameState.rightPaddle.velocity > 0) {
                gameState.rightPaddle.velocity -= paddleDeceleration;
                if (gameState.rightPaddle.velocity < 0) gameState.rightPaddle.velocity = 0;
            } else if (gameState.rightPaddle.velocity < 0) {
                gameState.rightPaddle.velocity += paddleDeceleration;
                if (gameState.rightPaddle.velocity > 0) gameState.rightPaddle.velocity = 0;
            }
        }
        
        // Update paddle position based on velocity
        gameState.rightPaddle.y += gameState.rightPaddle.velocity;
        
        // Keep paddle in bounds
        if (gameState.rightPaddle.y < 0) {
            gameState.rightPaddle.y = 0;
            gameState.rightPaddle.velocity = 0;
        } else if (gameState.rightPaddle.y > canvas.height - gameState.rightPaddle.height) {
            gameState.rightPaddle.y = canvas.height - gameState.rightPaddle.height;
            gameState.rightPaddle.velocity = 0;
        }
        
        // Fire laser from right paddle - only needs 1/4 mana
        if (keys.b && gameState.rightPaddle.chargeLevel >= laserManaCost && gameState.rightPaddle.laserCooldown <= 0) {
            gameState.lasers.push({
                x: gameState.rightPaddle.x - gameState.rightPaddle.laserWidth,
                y: gameState.rightPaddle.y + (rightPaddleHeight / 2) - (gameState.rightPaddle.laserHeight / 2),
                width: gameState.rightPaddle.laserWidth,
                height: gameState.rightPaddle.laserHeight,
                speed: -laserSpeed,
                fromLeft: false,
                type: gameState.rightPaddle.attackType, // 'destroy' type
                age: 0,
                maxAge: 200 // Increased lifetime to reach across the board
            });
            // Reduce charge by laser cost
            gameState.rightPaddle.chargeLevel -= laserManaCost;
            
            // Set a longer cooldown to prevent accidental double-firing
            gameState.rightPaddle.laserCooldown = 30;
            
            // Play sound and create particles
            sounds.laser.play();
            createParticles(
                gameState.rightPaddle.x,
                gameState.rightPaddle.y + (rightPaddleHeight / 2),
                '#ff00ff',
                15
            );
        }
        
        // Decrease laser cooldown
        if (gameState.rightPaddle.laserCooldown > 0) {
            gameState.rightPaddle.laserCooldown--;
        }
        
        // Upgrade laser - only if fully charged
        if (keys.m && gameState.rightPaddle.chargeLevel >= rechargeTime && gameState.rightPaddle.upgradeCooldown <= 0) {
            // Increase laser width and height by 20%
            gameState.rightPaddle.laserWidth *= 1.2;
            gameState.rightPaddle.laserHeight *= 1.2;
            gameState.rightPaddle.laserLevel++;
            
            // Reset charge after upgrading
            gameState.rightPaddle.chargeLevel = 0;
            
            // Set a cooldown for upgrading
            gameState.rightPaddle.upgradeCooldown = 20;
            
            // Play sound and create particles for upgrade
            sounds.hit.play();
            createParticles(
                gameState.rightPaddle.x + paddleWidth/2,
                gameState.rightPaddle.y + (rightPaddleHeight/2),
                '#ffff00',
                30
            );
        }
        
        // Regenerate a paddle segment - only if fully charged
        if (keys.n && gameState.rightPaddle.chargeLevel >= rechargeTime && gameState.rightPaddle.healCooldown <= 0) {
            // Find the first destroyed segment
            let regenerated = false;
            for (let i = 0; i < paddleSegments; i++) {
                if (!gameState.rightPaddle.segments[i]) {
                    // Regenerate this segment
                    gameState.rightPaddle.segments[i] = true;
                    regenerated = true;
                    
                    // Create healing particles
                    createParticles(
                        gameState.rightPaddle.x + paddleWidth/2,
                        gameState.rightPaddle.y + (i * rightSegmentHeight) + (rightSegmentHeight/2),
                        '#00ffcc',
                        20
                    );
                    
                    // Play healing sound
                    sounds.hit.play();
                    
                    break;
                }
            }
            
            // Only use mana if something was actually regenerated
            if (regenerated) {
                // Reset charge after regenerating
                gameState.rightPaddle.chargeLevel = 0;
                
                // Set a cooldown for healing spell
                gameState.rightPaddle.healCooldown = 20;
            }
        }
    }
    
    function updateLasers() {
        // Update laser positions
        for (let i = 0; i < gameState.lasers.length; i++) {
            const laser = gameState.lasers[i];
            laser.x += laser.speed;
            
            // Update laser age
            if (laser.age !== undefined) {
                laser.age++;
                if (laser.age > laser.maxAge) {
                    gameState.lasers.splice(i, 1);
                    i--;
                    continue;
                }
            }
            
            // Check collision with paddles
            if (laser.fromLeft) {
                // Check collision with right paddle
                if (
                    laser.x + laser.width >= gameState.rightPaddle.x &&
                    laser.x <= gameState.rightPaddle.x + gameState.rightPaddle.width &&
                    laser.y + laser.height >= gameState.rightPaddle.y &&
                    laser.y <= gameState.rightPaddle.y + gameState.rightPaddle.height
                ) {
                    if (laser.type === 'destroy') {
                        // Calculate which segments the laser covers
                        const laserTop = laser.y;
                        const laserBottom = laser.y + laser.height;
                        
                        // Track if we destroyed at least one segment
                        let destroyedSegments = 0;
                        
                        // Check each segment that overlaps with the laser's height
                        for (let segIndex = 0; segIndex < paddleSegments; segIndex++) {
                            // Calculate segment boundaries
                            const segmentTop = gameState.rightPaddle.y + (segIndex * rightSegmentHeight);
                            const segmentBottom = segmentTop + rightSegmentHeight;
                            
                            // Check if this segment overlaps with the laser
                            if (
                                ((laserTop <= segmentTop && laserBottom >= segmentTop) || // Laser overlaps top of segment
                                (laserTop <= segmentBottom && laserBottom >= segmentBottom) || // Laser overlaps bottom of segment
                                (laserTop >= segmentTop && laserBottom <= segmentBottom)) && // Laser is entirely within segment
                                gameState.rightPaddle.segments[segIndex] // Segment exists
                            ) {
                                // Destroy the segment
                                gameState.rightPaddle.segments[segIndex] = false;
                                destroyedSegments++;
                                
                                // Play sound and create particles
                                if (destroyedSegments === 1) { // Only play sound once
                                    sounds.destroy.play();
                                }
                                
                                createParticles(
                                    gameState.rightPaddle.x,
                                    gameState.rightPaddle.y + (segIndex * rightSegmentHeight) + (rightSegmentHeight / 2),
                                    '#ff00ff',
                                    20
                                );
                                
                                // Add score for each destroyed segment
                                gameState.leftPaddle.score += 2;
                            }
                        }
                        
                        // Check if all segments are destroyed
                        const allDestroyed = gameState.rightPaddle.segments.every(segment => !segment);
                        if (allDestroyed) {
                            // All segments destroyed - huge bonus score
                            gameState.leftPaddle.score += 50;
                            flashTimer = 30;
                            flashColor = "blue";
                            messageTimer = 120; // Display for 2 seconds
                            messageText = "DESTROY +50!";
                            messageColor = "#3399ff";
                            // Reset segments but keep track of destruction
                            gameState.rightPaddle.segments = Array(paddleSegments).fill(true);
                            createParticles(
                                gameState.rightPaddle.x,
                                gameState.rightPaddle.y + (rightPaddleHeight / 2),
                                '#0066ff',
                                50
                            );
                        }
                    } else {
                        // Standard laser - add score
                        gameState.leftPaddle.score++;
                    }
                    
                    // Remove laser in any case
                    gameState.lasers.splice(i, 1);
                    i--;
                }
            } else {
                // Check collision with left paddle
                if (
                    laser.x <= gameState.leftPaddle.x + gameState.leftPaddle.width &&
                    laser.x + laser.width >= gameState.leftPaddle.x &&
                    laser.y + laser.height >= gameState.leftPaddle.y &&
                    laser.y <= gameState.leftPaddle.y + gameState.leftPaddle.height
                ) {
                    if (laser.type === 'destroy') {
                        // Calculate which segments the laser covers
                        const laserTop = laser.y;
                        const laserBottom = laser.y + laser.height;
                        
                        // Track if we destroyed at least one segment
                        let destroyedSegments = 0;
                        
                        // Check each segment that overlaps with the laser's height
                        for (let segIndex = 0; segIndex < paddleSegments; segIndex++) {
                            // Calculate segment boundaries
                            const segmentTop = gameState.leftPaddle.y + (segIndex * leftSegmentHeight);
                            const segmentBottom = segmentTop + leftSegmentHeight;
                            
                            // Check if this segment overlaps with the laser
                            if (
                                ((laserTop <= segmentTop && laserBottom >= segmentTop) || // Laser overlaps top of segment
                                (laserTop <= segmentBottom && laserBottom >= segmentBottom) || // Laser overlaps bottom of segment
                                (laserTop >= segmentTop && laserBottom <= segmentBottom)) && // Laser is entirely within segment
                                gameState.leftPaddle.segments[segIndex] // Segment exists
                            ) {
                                // Destroy the segment
                                gameState.leftPaddle.segments[segIndex] = false;
                                destroyedSegments++;
                                
                                // Play sound and create particles
                                if (destroyedSegments === 1) { // Only play sound once
                                    sounds.destroy.play();
                                }
                                
                                createParticles(
                                    gameState.leftPaddle.x + paddleWidth,
                                    gameState.leftPaddle.y + (segIndex * leftSegmentHeight) + (leftSegmentHeight / 2),
                                    '#ff00ff',
                                    20
                                );
                                
                                // Add score for each destroyed segment
                                gameState.rightPaddle.score += 2;
                            }
                        }
                        
                        // Check if all segments are destroyed
                        const allDestroyed = gameState.leftPaddle.segments.every(segment => !segment);
                        if (allDestroyed) {
                            // All segments destroyed - huge bonus score
                            gameState.rightPaddle.score += 50;
                            flashTimer = 30;
                            flashColor = "purple";
                            messageTimer = 120; // Display for 2 seconds
                            messageText = "DESTROY +50!";
                            messageColor = "#cc33ff";
                            // Reset segments but keep track of destruction
                            gameState.leftPaddle.segments = Array(paddleSegments).fill(true);
                            createParticles(
                                gameState.leftPaddle.x,
                                gameState.leftPaddle.y + (leftPaddleHeight / 2),
                                '#aa00ff',
                                50
                            );
                        }
                    } else {
                        // Standard laser - add score
                        gameState.rightPaddle.score++;
                    }
                    
                    // Remove laser in any case
                    gameState.lasers.splice(i, 1);
                    i--;
                }
            }
            
            // Remove lasers that go off screen
            if (laser.x < 0 || laser.x > canvas.width) {
                gameState.lasers.splice(i, 1);
                i--;
            }
        }
    }

    function updateBall() {
        // Move the ball
        gameState.ball.x += gameState.ball.speedX;
        gameState.ball.y += gameState.ball.speedY;

        // Ball collision with top and bottom walls
        if (gameState.ball.y <= 0 || gameState.ball.y >= canvas.height - gameState.ball.size) {
            gameState.ball.speedY *= -1;
            sounds.paddle.play();
            createParticles(
                gameState.ball.x,
                gameState.ball.y <= 0 ? 0 : canvas.height,
                '#66ccff',
                10
            );
        }

        // Ball collision with paddles
        // Left paddle collision - check segments
        const ballYLeft = gameState.ball.y + (gameState.ball.size / 2);
        if (
            gameState.ball.x <= gameState.leftPaddle.x + gameState.leftPaddle.width &&
            gameState.ball.x >= gameState.leftPaddle.x &&
            ballYLeft >= gameState.leftPaddle.y &&
            ballYLeft <= gameState.leftPaddle.y + gameState.leftPaddle.height
        ) {
            // Find which segment the ball is hitting
            const relativeY = ballYLeft - gameState.leftPaddle.y;
            const segmentIndex = Math.floor(relativeY / leftSegmentHeight);
            
            // Only bounce if the segment exists
            if (segmentIndex >= 0 && segmentIndex < paddleSegments && 
                gameState.leftPaddle.segments[segmentIndex]) {
                gameState.ball.speedX *= -1;
                // Add a slight angle change based on where the ball hits the paddle
                const hitPosition = (gameState.ball.y - gameState.leftPaddle.y) / gameState.leftPaddle.height;
                gameState.ball.speedY = hitPosition * 10 - 5;
                
                // Play sound and create particles
                sounds.paddle.play();
                createParticles(
                    gameState.ball.x,
                    gameState.ball.y,
                    '#ff66cc',
                    15
                );
            }
        }

        // Right paddle collision - check segments
        const ballYRight = gameState.ball.y + (gameState.ball.size / 2);
        if (
            gameState.ball.x + gameState.ball.size >= gameState.rightPaddle.x &&
            gameState.ball.x + gameState.ball.size <= gameState.rightPaddle.x + gameState.rightPaddle.width &&
            ballYRight >= gameState.rightPaddle.y &&
            ballYRight <= gameState.rightPaddle.y + gameState.rightPaddle.height
        ) {
            // Find which segment the ball is hitting
            const relativeY = ballYRight - gameState.rightPaddle.y;
            const segmentIndex = Math.floor(relativeY / rightSegmentHeight);
            
            // Only bounce if the segment exists
            if (segmentIndex >= 0 && segmentIndex < paddleSegments && 
                gameState.rightPaddle.segments[segmentIndex]) {
                gameState.ball.speedX *= -1;
                // Add a slight angle change based on where the ball hits the paddle
                const hitPosition = (gameState.ball.y - gameState.rightPaddle.y) / gameState.rightPaddle.height;
                gameState.ball.speedY = hitPosition * 10 - 5;
                
                // Play sound and create particles
                sounds.paddle.play();
                createParticles(
                    gameState.ball.x,
                    gameState.ball.y,
                    '#66ffcc',
                    15
                );
            }
        }

        // Ball goes out of bounds - Score and reset
        if (gameState.ball.x <= 0) {
            // Right player scores
            gameState.rightPaddle.score += 10;
            flashTimer = 30;
            flashColor = "red";
            resetBall();
            sounds.score.play();
            createParticles(0, gameState.ball.y, '#ff5500', 30);
        } else if (gameState.ball.x + gameState.ball.size >= canvas.width) {
            // Left player scores
            gameState.leftPaddle.score += 10;
            flashTimer = 30;
            flashColor = "green";
            resetBall();
            sounds.score.play();
            createParticles(canvas.width, gameState.ball.y, '#00ff55', 30);
        }
    }

    function resetBall() {
        gameState.ball.x = canvas.width / 2;
        gameState.ball.y = canvas.height / 2;
        // Randomize direction slightly
        gameState.ball.speedX = Math.random() > 0.5 ? 3 : -3;
        gameState.ball.speedY = Math.random() * 4 - 2;
    }

    function drawGame() {
        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw flash if active
        if (flashTimer > 0) {
            ctx.fillStyle = flashColor;
            ctx.globalAlpha = flashTimer / 30;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 1;
            flashTimer--;
        }

        // Draw the net (dashed line in the middle)
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.strokeStyle = 'white';
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw stars background
        for (const star of stars) {
            ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Move stars
            star.x -= star.speed;
            if (star.x < 0) {
                star.x = canvas.width;
                star.y = Math.random() * canvas.height;
            }
        }
        
        // Draw left paddle with segments
        for (let i = 0; i < paddleSegments; i++) {
            if (gameState.leftPaddle.segments[i]) {
                const gradient = ctx.createLinearGradient(
                    gameState.leftPaddle.x, 0, 
                    gameState.leftPaddle.x + gameState.leftPaddle.width, 0
                );
                gradient.addColorStop(0, '#ff3366');
                gradient.addColorStop(1, '#ff66cc');
                
                ctx.fillStyle = gradient;
                ctx.fillRect(
                    gameState.leftPaddle.x,
                    gameState.leftPaddle.y + (i * leftSegmentHeight),
                    gameState.leftPaddle.width,
                    leftSegmentHeight - 1 // Small gap between segments
                );
                
                // Add glow effect
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#ff3366';
            }
        }
        ctx.shadowBlur = 0;
        
        // Draw right paddle with segments
        for (let i = 0; i < paddleSegments; i++) {
            if (gameState.rightPaddle.segments[i]) {
                const gradient = ctx.createLinearGradient(
                    gameState.rightPaddle.x, 0, 
                    gameState.rightPaddle.x + gameState.rightPaddle.width, 0
                );
                gradient.addColorStop(0, '#33ccff');
                gradient.addColorStop(1, '#3366ff');
                
                ctx.fillStyle = gradient;
                ctx.fillRect(
                    gameState.rightPaddle.x,
                    gameState.rightPaddle.y + (i * rightSegmentHeight),
                    gameState.rightPaddle.width,
                    rightSegmentHeight - 1 // Small gap between segments
                );
                
                // Add glow effect
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#33ccff';
            }
        }
        ctx.shadowBlur = 0;
        
        // Draw charge meters with fancy effects
        // Left player charge meter
        const meterWidth = 80;
        const meterHeight = 25;
        
        const leftGradient = ctx.createLinearGradient(20, 0, 20 + meterWidth, 0);
        leftGradient.addColorStop(0, '#ff0066');
        leftGradient.addColorStop(1, '#ff00ff');
        
        ctx.fillStyle = leftGradient;
        const leftChargeWidth = (gameState.leftPaddle.chargeLevel / rechargeTime) * meterWidth;
        ctx.fillRect(20, 20, leftChargeWidth, meterHeight);
        
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 20, meterWidth, meterHeight);
        
        // Center the text in the meter
        ctx.fillStyle = 'white';
        ctx.font = '16px MedievalSharp';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('MANA', 20 + meterWidth/2, 20 + meterHeight/2);
        ctx.textAlign = 'left'; // Reset alignment
        ctx.textBaseline = 'alphabetic'; // Reset baseline
        
        // Add glow effect if fully charged for healing
        if (gameState.leftPaddle.chargeLevel >= rechargeTime) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ff00ff';
            ctx.strokeRect(20, 20, meterWidth, meterHeight);
            ctx.shadowBlur = 0;
        }
        
        // Right player charge meter
        const rightGradient = ctx.createLinearGradient(canvas.width - 20 - meterWidth, 0, canvas.width - 20, 0);
        rightGradient.addColorStop(0, '#0066ff');
        rightGradient.addColorStop(1, '#00ccff');
        
        ctx.fillStyle = rightGradient;
        const rightChargeWidth = (gameState.rightPaddle.chargeLevel / rechargeTime) * meterWidth;
        ctx.fillRect(canvas.width - 20 - meterWidth, 20, rightChargeWidth, meterHeight);
        
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(canvas.width - 20 - meterWidth, 20, meterWidth, meterHeight);
        
        // Center the text in the meter
        ctx.fillStyle = 'white';
        ctx.font = '16px MedievalSharp';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('MANA', canvas.width - 20 - meterWidth/2, 20 + meterHeight/2);
        ctx.textAlign = 'left'; // Reset alignment
        ctx.textBaseline = 'alphabetic'; // Reset baseline
        
        // Add glow effect if fully charged for healing
        if (gameState.rightPaddle.chargeLevel >= rechargeTime) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00ffff';
            ctx.strokeRect(canvas.width - 20 - meterWidth, 20, meterWidth, meterHeight);
            ctx.shadowBlur = 0;
        }

        // Draw lasers with glow effects
        for (const laser of gameState.lasers) {
            // Apply glow effect and gradient for lasers
            ctx.shadowBlur = 15;
            
            if (laser.type === 'destroy') {
                // Gradient for destructive lasers
                const gradientLaser = ctx.createLinearGradient(
                    laser.x, 0, 
                    laser.x + laser.width, 0
                );
                
                if (laser.fromLeft) {
                    gradientLaser.addColorStop(0, '#ff00cc');
                    gradientLaser.addColorStop(1, '#ff00ff');
                    ctx.shadowColor = '#ff00ff';
                } else {
                    gradientLaser.addColorStop(0, '#00ccff');
                    gradientLaser.addColorStop(1, '#0066ff');
                    ctx.shadowColor = '#00ccff';
                }
                
                ctx.fillStyle = gradientLaser;
            } else {
                ctx.fillStyle = '#ff3333';
                ctx.shadowColor = '#ff0000';
            }
            
            // Draw the laser with glow
            ctx.fillRect(laser.x, laser.y, laser.width, laser.height);
            
            // Add pulsing effect based on age if available
            if (laser.age !== undefined) {
                const pulseOpacity = 0.7 - (0.5 * Math.sin(laser.age * 0.2));
                ctx.fillStyle = `rgba(255, 255, 255, ${pulseOpacity})`;
                ctx.fillRect(laser.x + laser.width * 0.25, laser.y + laser.height * 0.25, 
                            laser.width * 0.5, laser.height * 0.5);
            }
            
            // Reset shadow
            ctx.shadowBlur = 0;
        }
        
        // Update and draw particles
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            
            if (p.life <= 0) {
                particles.splice(i, 1);
                i--;
                continue;
            }
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life / 40;
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // Draw ball with magical effects
        // Create gradient for the ball
        const ballGradient = ctx.createRadialGradient(
            gameState.ball.x, gameState.ball.y, 0,
            gameState.ball.x, gameState.ball.y, gameState.ball.size
        );
        ballGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        ballGradient.addColorStop(0.7, 'rgba(210, 210, 255, 0.9)');
        ballGradient.addColorStop(1, 'rgba(150, 150, 255, 0.5)');
        
        // Add glow to the ball
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#aaccff';
        
        // Draw the ball
        ctx.fillStyle = ballGradient;
        ctx.beginPath();
        ctx.arc(gameState.ball.x, gameState.ball.y, gameState.ball.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Add a highlight
        ctx.beginPath();
        ctx.arc(gameState.ball.x - gameState.ball.size/3, 
                gameState.ball.y - gameState.ball.size/3, 
                gameState.ball.size/4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fill();
        
        // Reset shadow
        ctx.shadowBlur = 0;

        // Draw scores with fancy styling
        ctx.textAlign = 'center';
        
        // Left player score
        ctx.font = '42px MedievalSharp';
        ctx.fillStyle = '#ff3366';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff0066';
        ctx.fillText(gameState.leftPaddle.score, canvas.width / 4, 60);
        
        // Right player score
        ctx.fillStyle = '#33ccff';
        ctx.shadowColor = '#0066ff';
        ctx.fillText(gameState.rightPaddle.score, (canvas.width / 4) * 3, 60);
        
        // Reset shadow
        ctx.shadowBlur = 0;
        
        // Draw message if active
        if (messageTimer > 0) {
            // Calculate animation values
            let alpha = Math.min(1, messageTimer / 60); // Fade in/out
            let scale = 1 + Math.sin(messageTimer * 0.1) * 0.1; // Pulse effect
            let y = canvas.height / 3 - Math.abs(Math.sin(messageTimer * 0.05) * 20); // Float up and down
            
            // Save context state
            ctx.save();
            
            // Apply text effects
            ctx.globalAlpha = alpha;
            ctx.translate(canvas.width / 2, y);
            ctx.scale(scale, scale);
            
            // Draw message text with outline
            ctx.font = 'bold 48px MedievalSharp';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Draw glow effect
            ctx.shadowBlur = 20;
            ctx.shadowColor = messageColor;
            
            // Draw text
            ctx.fillStyle = 'white';
            ctx.fillText(messageText, 0, 0);
            
            // Draw outline
            ctx.lineWidth = 2;
            ctx.strokeStyle = messageColor;
            ctx.strokeText(messageText, 0, 0);
            
            // Restore context state
            ctx.restore();
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
            
            // Decrease timer
            messageTimer--;
        }
    }

    function gameLoop() {
        updatePaddles();
        updateLasers();
        updateBall();
        drawGame();
        requestAnimationFrame(gameLoop);
    }

    // Start the game
    gameLoop();
});
