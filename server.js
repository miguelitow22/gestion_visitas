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

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

app.get('/', (req, res) => {
    res.send('API funcionando correctamente');
});

console.log("📌 Rutas cargadas correctamente:");
console.log("➡️ /api/casos");
console.log("➡️ /api/comunicaciones");
console.log("➡️ /api/evaluaciones");
console.log("➡️ /api/envios");

// Prueba de que el backend está corriendo
app.get('/', (req, res) => {
    res.send('✅ Backend funcionando correctamente en Railway.');
});


app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en el puerto ${PORT}`);
});