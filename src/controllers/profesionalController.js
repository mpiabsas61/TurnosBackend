const supabase = require('../config/supabase');
const profesionalService = require('../services/profesionalService');

const obtenerProfesionales = async (req, res) => {
    try {
        const { data, error } = await supabase
             .from('PROFESIONAL')
             .select('*')
             .eq('activo', true);

        if (error) {
            return res.status(500).json({
                mensaje: 'Error al obtener los profesionales',
                error: error.message
            });
        }

        res.status(200).json(data);

    } catch (error) {
        res.status(500).json({
            mensaje: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Los errores inesperados los maneja errorMiddleware (Express 5 propaga los rechazos)
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

    res.status(201).json({
        mensaje: 'Profesional dado de alta correctamente',
        profesional
    });
};

module.exports = {
    obtenerProfesionales,
    crearProfesional
};
