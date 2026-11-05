const profesionalService = require('../services/profesionalService');

// Los errores inesperados los maneja errorMiddleware (Express 5 propaga los rechazos)

// Profesionales activos con sus servicios. Filtro opcional: servicio_id
const obtenerProfesionales = async (req, res) => {
    const { servicio_id } = req.query;

    const profesionales = await profesionalService.obtenerProfesionales({
        servicio_id: servicio_id ? Number(servicio_id) : undefined
    });

    res.status(200).json(profesionales);
};

const crearProfesional = async (req, res) => {
    const { usuario_id, especialidad } = req.body;

    const { resultado, profesional } = await profesionalService.altaProfesional({
        usuario_id,
        especialidad
    });

    if (resultado === 'ya_existe') {
        return res.status(409).json({
            mensaje: 'El profesional ya está dado de alta'
        });
    }

    if (resultado === 'usuario_no_encontrado') {
        return res.status(404).json({
            mensaje: 'No se encontró el usuario'
        });
    }

    if (resultado === 'usuario_no_valido') {
        return res.status(422).json({
            mensaje: 'El usuario no tiene rol profesional o no está activo'
        });
    }

    res.status(201).json(profesional);
};

module.exports = {
    obtenerProfesionales,
    crearProfesional
};
