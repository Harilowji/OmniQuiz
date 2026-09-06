/**
 * confetti.js - High-performance HTML5 Canvas Confetti Engine
 */
const Confetti = (() => {
    let animationFrame = null;

    function launch() {
        const canvas = document.getElementById('confetti-canvas');
        if (!canvas) return;

        canvas.style.display = 'block';
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
        const particles = [];

        for (let i = 0; i < 150; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * -canvas.height,
                size: Math.random() * 8 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                speedY: Math.random() * 4 + 3.5,
                speedX: Math.random() * 2.5 - 1.25,
                rotation: Math.random() * 360,
                rotationSpeed: Math.random() * 6 - 3
            });
        }

        let elapsed = 0;

        function step() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.y += p.speedY;
                p.x += p.speedX;
                p.rotation += p.rotationSpeed;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            });

            elapsed++;
            if (elapsed < 200) {
                animationFrame = requestAnimationFrame(step);
            } else {
                canvas.style.display = 'none';
                if (animationFrame) cancelAnimationFrame(animationFrame);
            }
        }

        if (animationFrame) cancelAnimationFrame(animationFrame);
        step();
    }

    return { launch };
})();
