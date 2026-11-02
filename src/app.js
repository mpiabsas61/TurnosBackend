require('dotenv').config();

const express = require('express');
const cors = require('cors');

const loggerMiddleware = require('./middlewares/loggerMiddleware');
const errorMiddleware = require('./middlewares/errorMiddleware');
 
const serviciosRoutes = require('./routes/serviciosRoutes');
const profesionalRoutes = require('./routes/profesionalRoutes');
const profesionalServicioRoutes = require('./routes/profesionalServicioRoutes');
const turnoRoutes = require('./routes/turnoRoutes');
const reservaRoutes = require('./routes/reservaRoutes');

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

app.use('/api/reservas', reservaRoutes);

// Manejo de errores (siempre al final)
app.use(errorMiddleware);

module.exports = app;