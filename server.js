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

// Middleware
app.use(cors());
app.use(express.json());  // ✅ Reemplaza bodyParser.json()
app.use(express.urlencoded({ extended: true }));  // ✅ Reemplaza bodyParser.urlencoded()

// Manejo de errores de JSON inválido
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: "JSON inválido en la solicitud" });
    }
    next();
});

// Rutas
app.use('/api/casos', casosRoutes);
app.use('/api/comunicaciones', comunicacionesRoutes);
app.use('/api/evaluaciones', evaluacionesRoutes);
app.use('/api/envios', enviosRoutes);

console.log("📌 Rutas cargadas correctamente:");
console.log("➡️ /api/casos");
console.log("➡️ /api/comunicaciones");
console.log("➡️ /api/evaluaciones");
console.log("➡️ /api/envios");

// ✅ Ruta de prueba única (Evita definir `/` dos veces)
app.get('/', (req, res) => {
    res.send('✅ Backend funcionando correctamente en Railway.');
});

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error("❌ Error en el servidor:", err);
    res.status(500).json({ error: "Error interno del servidor" });
});

app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en el puerto ${PORT}`);
});
