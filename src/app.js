require('dotenv').config();

const express = require('express');
const cors = require('cors');

const loggerMiddleware = require('./middlewares/loggerMiddleware');
 
const serviciosRoutes = require('./routes/serviciosRoutes');
const profesionalRoutes = require('./routes/profesionalRoutes');
const profesionalServicioRoutes = require('./routes/ProfesionalServicioRoutes');
const turnoRoutes = require('./routes/turnoRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Middleware
app.use(loggerMiddleware);

 
// Ruta de prueba
app.get('/', (req, res) => {
    res.send('API de Turnos de Estética funcionando correctamente');
});

// Rutas
app.use('/api/servicios', serviciosRoutes);

app.use('/api/profesionales', profesionalRoutes);

app.use('/api/profesionalServicio', profesionalServicioRoutes);

app.use('/api/turnos', turnoRoutes);

module.exports = app;