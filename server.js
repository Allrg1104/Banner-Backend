require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { initDB } = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting global
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { error: 'Demasiadas solicitudes, intenta en 15 minutos.' }
});
app.use('/api/', limiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/students', require('./routes/students.routes'));
app.use('/api/teachers', require('./routes/teachers.routes'));
app.use('/api/directors', require('./routes/directors.routes'));
app.use('/api/financial', require('./routes/financial.routes'));
app.use('/api/registro', require('./routes/registro.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/risk', require('./routes/risk.routes'));

// ─── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Plataforma Académica API',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// ─── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint no encontrado' });
});

// ─── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

// ─── Init ──────────────────────────────────────────────────────────────────────
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`\n🎓 Plataforma Académica API corriendo en http://localhost:${PORT}`);
        console.log(`📋 Documentación: http://localhost:${PORT}/api/health\n`);
    });
}).catch(err => {
    console.error('Error iniciando base de datos:', err);
    process.exit(1);
});
