const supabase = require('../config/supabase');

const obtenerTurnos = async (req, res) => {
    try {
        const { data, error } = await supabase
             .from('TURNO')
             .select('*')
             .eq('estado', 'disponible')
             .order('fecha', { ascending: true })
             .order('hora_inicio', { ascending: true });



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

// Generar turnos disponibles para una fecha y un servicio
const generarTurnos = async (req, res) => {
    try {
        const { fecha, servicio_id } = req.body;

        if (!fecha || !servicio_id) {
            return res.status(400).json({
                mensaje: 'Debe indicar la fecha y el servicio'
            });
        }

        // Evitar sábados y domingos
        const dia = new Date(`${fecha}T12:00:00`).getDay();

        if (dia === 0 || dia === 6) {
            return res.status(400).json({
                mensaje: 'Los turnos se generan únicamente de lunes a viernes'
            });
        }

        // Obtener el servicio y su duración
        const { data: servicio, error: errorServicio } = await supabase
            .from('SERVICIO')
            .select('id, duracion')
            .eq('id', servicio_id)
            .eq('activo', true)
            .single();

        if (errorServicio || !servicio) {
            return res.status(404).json({
                mensaje: 'No se encontró el servicio'
            });
        }

        const duracion = servicio.duracion;

        if (!duracion || duracion <= 0 || duracion > 480) {
            return res.status(400).json({
                mensaje: 'La duración del servicio no es válida'
            });
        }

        // Obtener profesionales habilitados para el servicio
        const { data: relaciones, error: errorRelaciones } = await supabase
            .from('PROFESIONAL_SERVICIO')
            .select('profesional_id')
            .eq('servicio_id', servicio_id)
            .eq('activo', true);

        if (errorRelaciones) {
            throw errorRelaciones;
        }

        if (!relaciones || relaciones.length === 0) {
            return res.status(200).json({
                mensaje: 'No hay profesionales habilitados para este servicio'
            });
        }

        const profesionales = [
            ...new Set(relaciones.map(item => item.profesional_id))
        ];

        // Consultar turnos ya existentes para esa fecha y servicio
        const { data: existentes, error: errorExistentes } = await supabase
            .from('TURNO')
            .select('profesional_id, hora_inicio, hora_fin')
            .eq('fecha', fecha)
            .eq('servicio_id', servicio_id);

        if (errorExistentes) {
            throw errorExistentes;
        }

        const nuevosTurnos = [];

        // Horario: lunes a viernes de 09:00 a 17:00
        for (const profesionalId of profesionales) {

            let minutos = 9 * 60;
            const finJornada = 17 * 60;

            while (minutos + duracion <= finJornada) {
                const horaInicio = minutos;
                const horaFin = minutos + duracion;

                const convertirHora = (valor) => {
                    const horas = Math.floor(valor / 60);
                    const mins = valor % 60;

                    return `${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
                };

                const inicio = convertirHora(horaInicio);
                const fin = convertirHora(horaFin);

                // Comprobar si el horario ya existe
                const ocupado = existentes.some(turno =>
                    turno.profesional_id === profesionalId &&
                    turno.hora_inicio < fin &&
                    turno.hora_fin > inicio
                );

                if (!ocupado) {
                    nuevosTurnos.push({
                        usuario_id: null,
                        profesional_id: profesionalId,
                        servicio_id: servicio_id,
                        fecha: fecha,
                        hora_inicio: inicio,
                        hora_fin: fin,
                        estado: 'disponible'
                    });
                }

                minutos += duracion;
            }
        }

        if (nuevosTurnos.length === 0) {
            return res.status(200).json({
                mensaje: 'No hay nuevos horarios para generar'
            });
        }

        const { data, error } = await supabase
            .from('TURNO')
            .insert(nuevosTurnos)
            .select();

        if (error) {
            throw error;
        }

        res.status(201).json({
            mensaje: 'Turnos disponibles generados correctamente',
            turnos: data
        });

    } catch (error) {
        res.status(500).json({
            mensaje: 'Error al generar los turnos',
            error: error.message
        });
    }
};


module.exports = {
    obtenerTurnos,
    generarTurnos
};