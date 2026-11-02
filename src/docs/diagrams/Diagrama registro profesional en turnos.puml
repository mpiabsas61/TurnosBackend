@startuml

title Diagrama de secuencia - Alta de profesional en Turnos

actor Administrador as a
participant Web as w
participant "API de turnos" as apit
participant "API de usuarios" as apiu
database "DB turnos" as dbt
database "DB usuarios" as dbu

autoactivate on

a -> w: dar de alta profesional {usuario_id, especialidad}
w -> apit: POST /profesionales -h Authorization: {JWT admin} {usuario_id, especialidad}
apit -> apit: verificarJWT({JWT admin})
apit --> apit: {usuario_id: admin_id, rol} / error
note right apit
  decodifica, valida firma
  y expiración localmente
end note

alt JWT inválido
  apit --> w: HTTP 401 unauthorized {error}
else rol del JWT != 'administrador'
  apit --> w: HTTP 403 forbidden {error}
else autorizado

  apit -> apit: validarFormato({usuario_id, especialidad})
  apit --> apit: ok / error

  alt datos con formato incorrecto
    apit --> w: HTTP 400 bad request {error}
  else datos correctos

    apit -> dbt: SELECT id from profesional where usuario_id={usuario_id}
    dbt --> apit: {profesional} / null

    alt el profesional ya está dado de alta
      apit --> w: HTTP 409 conflict {error}
    else no está dado de alta

      apit -[#blue]> apiu: GET /interno/usuarios/{usuario_id} -h X-API-Key: {API_KEY_INTERNA}
      note right apiu
        autenticación entre servicios:
        no se reenvía el JWT del usuario
      end note
      apiu -[#red]> dbu: findOne usuario {_id: usuario_id}
      dbu --> apiu: {usuario} / null
      apiu --> apit: HTTP 200 {nombre, apellido, rol, activo} / HTTP 404

      alt usuario no encontrado
        apit --> w: HTTP 404 not found {error}
      else rol != 'profesional' o activo=false
        apit --> w: HTTP 422 unprocessable entity {error}
      else usuario válido

        apit -> dbt: INSERT INTO profesional (usuario_id, nombre, apellido, especialidad) \nVALUES ({usuario_id}, {nombre}, {apellido}, {especialidad})
        dbt --> apit: {profesional}
        apit --> w: HTTP 201 created {profesional}
        w --> a: mostrar confirmación de alta

      end
    end
  end
end

@enduml