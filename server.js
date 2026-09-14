/**
 * server.js - OmniQuiz PRO Full-Stack Production Server
 * Serving both Frontend Client (SPA) and Backend RESTful APIs with zero hassle.
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRouter = require('./server/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Parsing Middlewares
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'x-gemini-key']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Mount RESTful API Router
app.use('/api', apiRouter);

// Serve Frontend Static Files
app.use(express.static(path.join(__dirname), {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

// Fallback to Single Page Application (SPA) index.html
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, error: 'Endpoint API không tồn tại!' });
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('[Server Error]', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Lỗi xử lý nội bộ máy chủ!'
    });
});

// Start listening if run directly
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`
================================================================
   🛡️  OmniQuiz PRO — Full-Stack CBT Platform Server Ready!
================================================================
   🌐 Web Application : http://localhost:${PORT}
   📡 RESTful API     : http://localhost:${PORT}/api
   🏥 Health Monitor  : http://localhost:${PORT}/api/health
   📚 Demo Teacher    : teacher@omniquiz.edu.vn / admin123
   🎓 Demo Student    : student@omniquiz.edu.vn / student123
================================================================
        `);
    });
}

module.exports = app;
