const supabase = require('../config/supabase');
const { fechaHoy } = require('../utils/fechas');

// Turnos disponibles desde hoy. Filtros opcionales: fecha, profesional_id, servicio_id
const obtenerTurnos = async (req, res) => {
    try {
        const { fecha, profesional_id, servicio_id } = req.query;

        let consulta = supabase
             .from('TURNO')
             .select('*')
             .eq('estado', 'disponible')
             .gte('fecha', fechaHoy());

        if (fecha) {
            consulta = consulta.eq('fecha', fecha);
        }

        if (profesional_id) {
            consulta = consulta.eq('profesional_id', profesional_id);
        }

        // Las franjas disponibles no tienen servicio: se filtra por los
        // profesionales que lo ofrecen
        if (servicio_id) {
            const { data: relaciones, error: errorRelaciones } = await supabase
                .from('PROFESIONAL_SERVICIO')
                .select('profesional_id')
                .eq('servicio_id', servicio_id)
                .eq('activo', true);

            if (errorRelaciones) {
                throw errorRelaciones;
            }

            if (relaciones.length === 0) {
                return res.status(200).json([]);
            }

            consulta = consulta.in('profesional_id', relaciones.map(item => item.profesional_id));
        }

        const { data, error } = await consulta
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

        // Consultar turnos ya existentes de esos profesionales en la fecha,
        // sin importar el servicio, para no superponer franjas
        const { data: existentes, error: errorExistentes } = await supabase
            .from('TURNO')
            .select('profesional_id, hora_inicio, hora_fin')
            .eq('fecha', fecha)
            .in('profesional_id', profesionales);

        if (errorExistentes) {
            throw errorExistentes;
        }

        const nuevosTurnos = [];

        // Horario: lunes a viernes de 09:00 a 18:00
        for (const profesionalId of profesionales) {

            let minutos = 9 * 60;
            const finJornada = 18 * 60;

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

                // servicio_id y usuario_id quedan en null hasta que se reserve
                if (!ocupado) {
                    nuevosTurnos.push({
                        usuario_id: null,
                        profesional_id: profesionalId,
                        servicio_id: null,
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