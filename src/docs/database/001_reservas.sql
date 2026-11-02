-- =====================================================================
-- 001 - Ajustes de esquema, limpieza de datos de prueba, restricciones
--       y función para reservas
--
-- Ejecutar en Supabase: SQL Editor > New query > Run
-- Corre en una transacción: si algún paso falla, no se aplica nada.
-- Se puede volver a ejecutar sin efectos duplicados.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Vista previa (opcional): qué se va a borrar en el paso 2
-- ---------------------------------------------------------------------
-- select id, nombre, duracion from "SERVICIO" where duracion <> 60;
-- select * from "PROFESIONAL_SERVICIO"
--  where servicio_id in (select id from "SERVICIO" where duracion <> 60);
-- select * from "TURNO"
--  where servicio_id in (select id from "SERVICIO" where duracion <> 60);

begin;

-- ---------------------------------------------------------------------
-- 1. Ajustes de esquema
-- ---------------------------------------------------------------------

-- Corrige el nombre de la columna (estaba como "aespecialidad")
do $$
begin
    if exists (
        select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name = 'PROFESIONAL'
           and column_name = 'aespecialidad'
    ) then
        alter table "PROFESIONAL" rename column aespecialidad to especialidad;
    end if;
end $$;

-- Los ids de la API de usuarios son ObjectId de MongoDB (texto)
alter table "TURNO"
    alter column usuario_id type text using usuario_id::text;

-- Referencia lógica al usuario de la API de usuarios
alter table "PROFESIONAL"
    add column if not exists usuario_id text;


-- ---------------------------------------------------------------------
-- 2. Limpieza de datos de prueba
-- ---------------------------------------------------------------------

-- Servicios de prueba: todos los servicios reales duran 60 minutos
delete from "PROFESIONAL_SERVICIO"
 where servicio_id in (select id from "SERVICIO" where duracion <> 60);

delete from "TURNO"
 where servicio_id in (select id from "SERVICIO" where duracion <> 60);

delete from "SERVICIO"
 where duracion <> 60;

-- Las franjas disponibles no llevan servicio: se asigna al reservar
update "TURNO"
   set servicio_id = null
 where estado = 'disponible'
   and servicio_id is not null;


-- ---------------------------------------------------------------------
-- 3. Restricciones
-- ---------------------------------------------------------------------

-- Un turno solo puede estar disponible o reservado
alter table "TURNO" drop constraint if exists turno_estado_check;
alter table "TURNO"
    add constraint turno_estado_check
    check (estado in ('disponible', 'reservado'));

-- Un profesional no puede tener dos franjas que empiecen a la misma hora
create unique index if not exists turno_profesional_fecha_hora_unq
    on "TURNO" (profesional_id, fecha, hora_inicio);

-- Un usuario se da de alta como profesional una sola vez
-- (los profesionales cargados antes quedan con usuario_id null, que no choca)
alter table "PROFESIONAL" drop constraint if exists profesional_usuario_id_unq;
alter table "PROFESIONAL"
    add constraint profesional_usuario_id_unq
    unique (usuario_id);


-- ---------------------------------------------------------------------
-- 4. Modificación de reserva en una sola transacción
--    Ver docs/diagrams/Diagrama modificacion turno.puml
--
--    Reserva la nueva franja (mismo profesional, disponible, no pasada)
--    y libera la anterior. Si algo falla, no se aplica ningún cambio.
--
--    Devuelve:
--      { "resultado": "no_encontrado" }  la reserva no existe o no es del usuario
--      { "resultado": "ocupado" }        la nueva franja no está disponible
--      { "resultado": "ok", "reserva": {...} }
-- ---------------------------------------------------------------------

create or replace function public.modificar_reserva(
    p_turno_id       bigint,
    p_nuevo_turno_id bigint,
    p_usuario_id     text,
    p_fecha_minima   date
)
returns jsonb
language plpgsql
as $$
declare
    v_actual "TURNO"%rowtype;
    v_nuevo  "TURNO"%rowtype;
begin
    -- Bloquea la reserva actual para que no se cancele en paralelo
    select * into v_actual
      from "TURNO"
     where id = p_turno_id
       and usuario_id = p_usuario_id
       and estado = 'reservado'
       for update;

    if not found then
        return jsonb_build_object('resultado', 'no_encontrado');
    end if;

    update "TURNO"
       set estado = 'reservado',
           usuario_id = p_usuario_id,
           servicio_id = v_actual.servicio_id
     where id = p_nuevo_turno_id
       and profesional_id = v_actual.profesional_id
       and estado = 'disponible'
       and fecha >= p_fecha_minima
    returning * into v_nuevo;

    if not found then
        return jsonb_build_object('resultado', 'ocupado');
    end if;

    update "TURNO"
       set estado = 'disponible',
           usuario_id = null,
           servicio_id = null
     where id = p_turno_id;

    return jsonb_build_object('resultado', 'ok', 'reserva', to_jsonb(v_nuevo));
end;
$$;

commit;

-- Que PostgREST (la API de Supabase) vea la función nueva sin esperar
notify pgrst, 'reload schema';
