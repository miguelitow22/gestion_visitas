const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
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
    origin: 'https://gestion-visitasfr.vercel.app/', // ⚠️ RESTRINGE en producción (ejemplo: 'https://tudominio.com')
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// ✅ Middleware para parsear JSON y formularios
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()); // Asegura el soporte para JSON

// ✅ Manejo de errores de JSON inválido
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: "JSON inválido en la solicitud" });
    }
    next();
});

// ✅ Rutas
app.use('/api/casos', casosRoutes);
app.use('/api/comunicaciones', comunicacionesRoutes);
app.use('/api/evaluaciones', evaluacionesRoutes);
app.use('/api/envios', enviosRoutes);

app.get('/', (req, res) => {
    res.send('API funcionando correctamente');
});

// ✅ Registro de rutas
console.log("📌 Rutas cargadas correctamente:");
console.log("➡️ /api/casos");
console.log("➡️ /api/comunicaciones");
console.log("➡️ /api/evaluaciones");
console.log("➡️ /api/envios");

// ✅ Manejo global de errores
app.use((err, req, res, next) => {
    console.error("❌ Error en el servidor:", err);
    res.status(500).json({ error: "Error interno del servidor" });
});

// ✅ Iniciar servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en el puerto ${PORT}`);
});
