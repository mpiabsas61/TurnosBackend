const supabase = require('../config/supabase');

const obtenerTurnos = async (req, res) => {
    try {
        const { data, error } = await supabase
             .from('TURNO')
             .select('*')
             .eq('estado', null);

        if (error) {
            return res.status(500).json({
                mensaje: 'Error al obtener los turnos',
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
    obtenerTurnos
};