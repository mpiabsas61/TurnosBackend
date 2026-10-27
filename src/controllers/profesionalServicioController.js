const supabase = require('../config/supabase');

const obtenerProfesionalServicios = async (req, res) => {
    try {
        const { data, error } = await supabase
             .from('PROFESIONAL_SERVICIO')
             .select('*')
             .eq('activo', true);

        if (error) {
            return res.status(500).json({
                mensaje: 'Error al obtener los profesionales- servicios',
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

module.exports = {
    obtenerProfesionalServicios
};