// Validadores de formato disponibles para los esquemas del body (JSON)
const validadores = {
    enteroPositivo: (valor) => Number.isInteger(valor) && valor > 0,

    texto: (valor) => typeof valor === 'string' && valor.trim().length > 0,

    // Fecha con formato YYYY-MM-DD y que exista en el calendario
    fecha: (valor) => {
        if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
            return false;
        }

        const fecha = new Date(`${valor}T00:00:00Z`);

        return !isNaN(fecha) && fecha.toISOString().startsWith(valor);
    }
};

// Params de la URL y query string siempre llegan como texto
const validadoresTexto = {
    ...validadores,
    enteroPositivo: (valor) => typeof valor === 'string' && /^[1-9]\d*$/.test(valor)
};

const responderInvalidos = (res, invalidos) => res.status(400).json({
    mensaje: 'Datos con formato incorrecto',
    error: `Campos inválidos: ${invalidos.join(', ')}`
});

// Valida que req.body cumpla el esquema { campo: 'tipo' }. Todos los campos son obligatorios
const validarBody = (esquema) => (req, res, next) => {
    const body = req.body || {};

    const invalidos = Object.entries(esquema)
        .filter(([campo, tipo]) => !validadores[tipo](body[campo]))
        .map(([campo]) => campo);

    if (invalidos.length > 0) {
        return responderInvalidos(res, invalidos);
    }

    next();
};

// Valida los parámetros de la ruta (ej. /:id). Todos son obligatorios
const validarParams = (esquema) => (req, res, next) => {
    const invalidos = Object.entries(esquema)
        .filter(([campo, tipo]) => !validadoresTexto[tipo](req.params[campo]))
        .map(([campo]) => campo);

    if (invalidos.length > 0) {
        return responderInvalidos(res, invalidos);
    }

    next();
};

// Valida los filtros del query string. Son opcionales: solo se validan si vienen
const validarQuery = (esquema) => (req, res, next) => {
    const invalidos = Object.entries(esquema)
        .filter(([campo, tipo]) =>
            req.query[campo] !== undefined && !validadoresTexto[tipo](req.query[campo])
        )
        .map(([campo]) => campo);

    if (invalidos.length > 0) {
        return responderInvalidos(res, invalidos);
    }

    next();
};

module.exports = {
    validarBody,
    validarParams,
    validarQuery
};
