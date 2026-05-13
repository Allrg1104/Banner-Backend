require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { initDB } = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────
const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // En desarrollo, permitir todo para evitar problemas con IPs locales
        if (process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('No permitido por CORS'));
        }
    },
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
console.log('🚀 Registrando rutas...');
app.use('/api/auth', require('./routes/auth.routes'));
console.log('✅ Rutas de Auth registradas');
app.use('/api/students', require('./routes/students.routes'));
console.log('✅ Rutas de Students registradas');
app.use('/api/teachers', require('./routes/teachers.routes'));
app.use('/api/directors', require('./routes/directors.routes'));
app.use('/api/financial', require('./routes/financial.routes'));
app.use('/api/registro', require('./routes/registro.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/risk', require('./routes/risk.routes'));
console.log('✨ Todas las rutas registradas correctamente');

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
