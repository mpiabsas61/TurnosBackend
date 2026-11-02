// Zona horaria del centro. El servidor (Vercel) corre en UTC
const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';

// Fecha de hoy en formato YYYY-MM-DD según la zona horaria del centro
const fechaHoy = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA
}).format(new Date());

module.exports = {
    fechaHoy
};
