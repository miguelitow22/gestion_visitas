const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const casosRoutes = require('./routes/casos');
const comunicacionesRoutes = require('./routes/comunicaciones');
const evaluacionesRoutes = require('./routes/evaluaciones');
const enviosRoutes = require('./routes/envios');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 8080;

// ✅ Middleware de registro de solicitudes
app.use((req, res, next) => {
    console.log(`📢 [${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// ✅ Middleware de CORS mejorado
app.use(cors({
    origin: '*', // Permitir todas las solicitudes (puedes cambiarlo por una lista segura)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Agrega OPTIONS para preflight
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
    credentials: true // Permitir cookies y autenticación si las usas
}));


// ✅ Middleware para parsear JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Soporte para formularios

// ✅ Manejo de errores de JSON inválido
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: "JSON inválido en la solicitud" });
    }
    next();
});
app.options('*', cors()); // Permitir solicitudes preflight en todas las rutas

// ✅ Rutas
app.use('/api/casos', casosRoutes);
app.use('/api/comunicaciones', comunicacionesRoutes);
app.use('/api/evaluaciones', evaluacionesRoutes);
app.use('/api/envios', enviosRoutes);

app.get('/', (req, res) => {
    res.send('API funcionando correctamente');
});

// ✅ Manejo global de errores
app.use((err, req, res, next) => {
    console.error("❌ Error en el servidor:", err);
    res.status(500).json({ error: "Error interno del servidor" });
});

// ✅ Iniciar servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en el puerto ${PORT}`);
});
