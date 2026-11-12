# Decisiones · Laboratorio 5

## Equipo

Número de equipo: 5

| Código PUCP | Nombre | Rol | Usuario de GitHub |
|---|---|---|---|
| 20211041 | Daniel Marcel Malca Lopez | Moderador | D4rkPatata |
| 20171857 | Christian Sebastian Chira Mallqui | Escriba | Setziret |
| 20202583 | Carlos Vásquez Morales | Abogado del diablo | CaVassM |
| 20206234 | Jorge Josue Chamorro Cayetano | Guardián del tiempo | darkJCdark |
| 20210477 | Kei Shimabukuro Kohatsu | Integrador | Ryoukyougan22 |

## A1 · Postmortem

### Resumen
El 6 de noviembre de 2026 se modificó la configuración de infraestructura del bucket S3 que almacena los comprobantes de Monedero Andino, con el objetivo de habilitar el acceso de un proveedor externo de conciliación.
El cambio permitió el acceso público a los comprobantes. El incidente fue detectado el 9 de noviembre, cuando un cliente publicó un enlace a un comprobante ajeno.
El equipo de guardia bloqueó manualmente el acceso público desde la consola de AWS. Sin embargo, la configuración insegura permaneció en el código Terraform y el proveedor perdió el acceso.


### Impacto

El bucket contenía 41 300 comprobantes potencialmente expuestos.
La exposición pública duró 63 horas y 25 minutos.
No fue posible determinar cuántos comprobantes fueron descargados debido a la ausencia de registros de acceso.
El proveedor de conciliación perdió el acceso tras el bloqueo.
Existe riesgo de exposición de información financiera de los usuarios.


### Línea de tiempo

| Fecha y hora | Hecho |
|---|---|
| Jue 05/11 15:10 | El área comercial informa que el proveedor de conciliación debe leer los comprobantes desde el viernes 06/11. El contrato tiene penalidad por cada día de retraso. |
| Vie 06/11 09:30 | La tarea se asigna a un desarrollador backend. |
| Vie 06/11 16:20 | El desarrollador pide al proveedor el identificador de su cuenta de AWS. No recibe respuesta. |
| Vie 06/11 17:30 | El desarrollador pide revisión por chat. El líder técnico responde desde una reunión: "dale, lo vemos el lunes". |
| Vie 06/11 17:42 | Commit directo a `main` con el cambio en `infra/s3.tf`. |
| Vie 06/11 17:55 | Se ejecuta `terraform apply` desde una laptop. El proveedor confirma que ya puede leer los comprobantes. El bucket queda público. |
| Sáb 07/11 y Dom 08/11 | Sin alertas. No existe monitoreo sobre la configuración del bucket. |
| Lun 09/11 08:15 | Un cliente publica en redes sociales el link de un comprobante ajeno. |
| Lun 09/11 08:50 | Soporte escala a On-call. |
| Lun 09/11 09:20 | On-call activa el bloqueo de acceso público del bucket desde la consola de AWS. El código de `infra/` no se modifica. |
| Lun 09/11 09:25 | El proveedor de conciliación pierde el acceso a los comprobantes. |
| Lun 09/11 11:00 | El equipo busca los registros de acceso al bucket y descubre que no existen. |
| Mar 10/11 10:00 | Gerencia pide un informe del incidente y un plan para que no se repita. |

### Causas

1. **De proceso — un cambio de infraestructura llegó a producción sin revisión.** `main` no tiene branch protection y permitió un commit directo. La revisión se pidió por chat y se pospuso para el lunes, con el cambio ya publicado. El mensaje del commit dice "Aprobado por chat. Se revisa el lunes". El único revisor disponible estaba en reuniones de planificación todas las tardes.
2. **De proceso — presión de plazo sin camino alternativo.** El plazo de entrega (penalidad contractual por cada día de retraso) no tenía un procedimiento para pedir ayuda cuando faltaba un dato (el ID de la cuenta del proveedor) ni para escalar el cambio a alguien con experiencia en Terraform. El único integrante con experiencia en Terraform estaba de vacaciones y ningún desarrollador había modificado `infra/` antes. La misma presión reaparece hoy: el proveedor exige acceso y cobra S/ 15 000 por día, y el riesgo es repetir el atajo.
3. **De pipeline — ningún control automático revisa `infra/`.** El pipeline `ci` solo ejecuta las pruebas unitarias y no analiza `infra/` ni las dependencias. Un escáner de infraestructura como código habría detenido un bucket público antes del `apply`.
4. **De plataforma — el despliegue de infraestructura es manual.** `terraform apply` se ejecuta a mano desde la laptop de quien hace el cambio, sin pasar por el pipeline ni por una revisión previa.
5. **De detección — no hay monitoreo de la configuración del bucket ni registros de acceso.** Por eso la exposición no generó alertas durante 63 h 25 min, y hoy no hay forma de saber qué se descargó.
6. **De diseño — las claves de los comprobantes son predecibles.** Un número correlativo en la ruta del objeto convirtió un bucket abierto en un recorrido trivial por enumeración (cambiar el número). Ni el pipeline ni Checkov detectan este riesgo.
7. **De respuesta — la mitigación quedó fuera del código.** Se bloqueó desde la consola sin modificar `infra/` (drift entre lo declarado y lo real), y esa acción cortó el acceso del proveedor sin una alternativa preparada.


### Qué funcionó y qué no funcionó

Qué funcionó:

- Soporte escaló a On-call a los 35 min de recibir el reporte, y On-call mitigó 30 min después. Desde el aviso hasta la mitigación pasó 1 h 05 min.
- El bloqueo de acceso público desde la consola cerró la exposición de forma efectiva.
- El historial de commits conserva el cambio, su fecha y su mensaje, lo que permitió reconstruir esta línea de tiempo.

Qué no funcionó:

- No hubo ninguna alerta ni registro de acceso en 63 h 25 min de exposición; la detección dependió de un cliente.
- La revisión del cambio se pidió pero no se hizo antes de publicarlo.
- La mitigación manual no quedó reflejada en el código, y el proveedor perdió el acceso sin un plan.
- No se pudo medir el alcance del incidente por falta de registros.


### Acciones

| Acción | Rol responsable | Fecha límite |
|---|---|---|
| El equipo agrega a `ci.yml` el job `iac` con Checkov sobre `infra/`, que bloquea los hallazgos de exposición pública y de identidad definidos en la Decisión 1. | Desarrolladores backend | 12/11 |
| El equipo agrega a `ci.yml` el job `sca` con Trivy sobre `package-lock.json`, aplicando las Decisiones 1 y 2. | Desarrolladores backend | 12/11 |
| El equipo corrige `infra/s3.tf` hoy, antes de las 18:00, mediante pull request revisado: bloqueo de acceso público activado y lectura otorgada solo al rol `conciliacion-lectura` de la cuenta 111122223333, de modo que el proveedor recupere el acceso sin abrir el bucket y el código coincida con la consola. | Desarrolladores backend | 12/11 |
| El equipo activa la protección de `main`: sin commits directos, pull request obligatorio y al menos una aprobación antes de fusionar. | Líder técnico | 13/11 |
| El equipo define un revisor suplente para los cambios de `infra/` cuando el líder técnico no esté disponible, y deja escrito el procedimiento de escalamiento. | Líder técnico | 19/11 |
| El equipo mueve el `terraform apply` a un pipeline con aprobación, de modo que nadie lo ejecute desde una laptop. | Ingeniera de plataforma | 26/11 |
| El equipo activa el registro de acceso del bucket de comprobantes y una alerta cuando cambie su configuración de acceso público. | Ingeniera de plataforma | 20/11 |
| El equipo capacita a al menos un desarrollador adicional en Terraform y documenta el flujo de cambios en `infra/`. | Ingeniera de plataforma | 03/12 |
| El equipo reemplaza las claves correlativas por identificadores no predecibles y evalúa entregar los comprobantes con enlaces temporales firmados. | Desarrolladores backend | 27/11 |
| El equipo define con el proveedor de conciliación un canal de contacto y un procedimiento para obtener los datos de su cuenta antes de una fecha de entrega comprometida. | Líder técnico | 19/11 |
| El equipo documenta un procedimiento de respuesta para exposición de datos: quién decide, cómo se registra el cambio hecho en la consola en el código y cómo se informa a Soporte y a Gerencia. | On-call | 19/11 |
| El equipo presenta a Gerencia un informe del incidente que describe condiciones del sistema y roles, y acuerda con Gerencia una regla de revisión de incidentes sin atribución personal. | Líder técnico | 13/11 |


### Datos del repositorio

- SHA del commit que introdujo el cambio: `bd600fe3307d5aa35bb3acbff8df91e0e02fcf35`
- Fecha y hora de ese commit: 06/11/2026 17:42 (-05:00)
- Checks de Checkov que fallan sobre el bucket de comprobantes:  CKV_AWS_53, CKV_AWS_54, CKV_AWS_55, CKV_AWS_56 (cada parámetro del bloqueo de acceso público en `false`, recurso `aws_s3_bucket_public_access_block.comprobantes`, `infra/s3.tf` líneas 8–11) y CKV_AWS_70 (política con `Principal = "*"`, recurso `aws_s3_bucket_policy.conciliacion`, `infra/s3.tf` línea 22).

## A2 · Decisiones

### Decisión 1 · Qué bloquea y qué informa

- Decisión: Se establece una política de seguridad diferenciada. Checkov bloqueará los hallazgos que permitan el acceso público al bucket de comprobantes S3, especialmente `CKV_AWS_53`, `CKV_AWS_54`, `CKV_AWS_55`, `CKV_AWS_56` y `CKV_AWS_70`. Los demás hallazgos se informarán, salvo aquellos que el equipo incorpore expresamente a la política bloqueante. Trivy bloqueará vulnerabilidades HIGH y CRITICAL con versión corregida disponible. Las vulnerabilidades sin parche se reportarán y recibirán el tratamiento establecido en la Decisión 2.
- Dato del repositorio que la sustenta: Se ejecutó Checkov 3.4.5 sobre `infra/`, obteniéndose 20 checks aprobados, 28 fallidos y 0 omitidos. Entre los hallazgos bloqueantes detectados se encuentran `CKV_AWS_55`, por la desactivación de `ignore_public_acls`, y `CKV_AWS_70`, por una política S3 con `Principal = "*"`. El job `iac` terminó con exit code 1, demostrando que la política bloqueante funciona. Trivy sobre `package-lock.json` reportó.
- Alternativa descartada y por qué: Se descarta bloquear todos los hallazgos de Checkov, debido a que algunos corresponden a mejoras de seguridad no directamente relacionadas con el incidente y requieren evaluación adicional. También se descarta tratar todos los hallazgos como informativos, porque permitiría que una configuración pública de S3 pase el pipeline sin detenerse.
- Posición en minoría: El abogado del diablo sostiene que bloquear solo el acceso público es insuficiente. Entre los 28 hallazgos informativos hay controles directamente ligados al incidente, como el registro de acceso del bucket (cuya ausencia impidió medir cuántos comprobantes se descargaron, causa 5 del postmortem). Al quedar como informativos, la misma situación podría repetirse sin que el pipeline la detenga. Propone ampliar la lista bloqueante a esos controles.

### Decisión 2 · La vulnerabilidad sin versión corregida

- Decisión: Dejamos de usar la librería `ip` y la reemplazamos por la función que ya trae Node (`net.BlockList`). El pipeline sigue bloqueando las vulnerabilidades HIGH y CRITICAL que tienen versión corregida; las que no tienen parche se informan.
- Dato del repositorio que la sustenta: Trivy encontró la vulnerabilidad CVE-2024-29415 en `ip` versión 2.0.1, y no existe una versión que la corrija. La usamos en `src/notificaciones.js`, en la función `validarUrlNotificacion` (línea 20). Esa función revisa que la URL que registra un comercio no apunte a nuestra red interna. Con este fallo, un atacante podría saltarse esa revisión.
- Alternativa descartada y por qué: Bloquear los despliegues hasta que salga un parche no sirve, porque no sabemos si alguna vez saldrá, y la API quedaría congelada. Abrir una excepción tampoco, porque la falla seguiría en el único filtro que protege esa función. Reemplazar la librería es lo más simple: solo se usa en un lugar.
- Posición en minoría: Abrir una excepción de 30 días con control compensatorio, para no tocar `src/` bajo la presión de tiempo del laboratorio. Se descarta porque el reemplazo afecta una sola función y las pruebas de `test/notificaciones.test.js` permiten verificar que el comportamiento se mantiene.

### Decisión 3 · La Function URL sin autenticación

- Decisión: Abrir una excepción de duración limitada para la Function URL sin autenticación y no corregir en esta sesión. `CKV_AWS_258` se incorpora expresamente a la política bloqueante de la Decisión 1, por lo que la excepción se escribe en `infra/lambda.tf` con `#checkov:skip=CKV_AWS_258` y los cuatro datos: responsable (Líder técnico), vencimiento (12/12/2026), control compensatorio (autenticación de usuarios en el servicio externo al repositorio, a confirmar, más monitoreo de invocaciones) y riesgo aceptado (cualquier persona con la URL puede invocar los endpoints de la API sin autenticación de AWS).
- Dato del repositorio que la sustenta: `CKV_AWS_258` sobre el recurso `aws_lambda_function_url.api` (`infra/lambda.tf`, líneas 27-30; `authorization_type = "NONE"` en la línea 29).
- Alternativa descartada y por qué: Corregir cambiando a `AWS_IAM`. Con `AWS_IAM` los llamadores deben ser principales IAM autenticados, y la app móvil consume la URL directamente sin credenciales de AWS, por lo que el cambio la dejaría sin servicio mientras se resuelve el incidente del proveedor. La app no está en este repositorio y no se puede modificar en la sesión.
- Posición en minoría: Corregir hoy con `AWS_IAM` y coordinar la actualización de la app móvil, porque `src/handler.js` no valida identidad en `/saldo`, `/historial` ni `/transferir` y el control compensatorio externo no se puede verificar desde el repositorio. Se descarta por el riesgo de dejar la app sin servicio, y se mitiga con el vencimiento corto y la revisión de la excepción.

## A3 · Dato nuevo

Dato recibido a las 16:40: el proveedor de conciliación exige acceso hoy y cobra S/ 15 000 por cada día sin acceso. Gerencia pide el nombre de quien hizo el cambio para sancionarlo.

 - **Impacto:** se agrega la penalidad de S/ 15 000 por día sin acceso. Contando desde el corte del 09/11 a las 09:25, serían S/ 45 000 (3 días completos) o S/ 60 000 (4 días calendario) al 12/11; la forma de contar se confirma en el contrato. El incidente deja de ser solo de confidencialidad y pasa a tener un costo económico que crece cada día.
  - **Causas:** la causa de presión de plazo sin camino alternativo gana peso. La penalidad contractual que empujó el atajo del viernes vuelve a actuar hoy con una cifra mayor. No se agrega ninguna causa atribuida a una persona.
  - **Línea de tiempo:** se agrega el hecho del 12/11 a las 16:40 y el intervalo de restauración sigue abierto hasta que el proveedor recupere el acceso por una vía segura.
  - **Acciones:** la corrección de `infra/s3.tf` pasa a ser una acción de hoy, con plazo antes de las 18:00 y revisión por pull request. Se agrega la acción de presentar a Gerencia un informe sin atribución personal y acordar con ella una regla de revisión de incidentes.

- Qué cambia en las decisiones:
  - **Decisión 1 (qué bloquea y qué informa):** no cambia la lista. Se refuerza que la urgencia no autoriza saltarse el pipeline: el job `iac` sigue bloqueando el bucket público y el acceso del proveedor se resuelve con un principal específico, no con una excepción.
  - **Decisión 2 (vulnerabilidad sin versión corregida):** no cambia. La presión de tiempo no justifica reemplazar la librería `ip` sin pasar las pruebas unitarias; si no pasan a tiempo, se cambia a excepción antes de las 17:20.
  - **Decisión 3 (Function URL):** no cambia. Corregir a `AWS_IAM` hoy dejaría sin servicio a la app móvil mientras ya hay una crisis abierta con el proveedor, y duplicaría el riesgo. Sigue la excepción con vencimiento.
  - **Decisión operativa nueva:** restablecer hoy el acceso del proveedor con un cambio en `infra/s3.tf` que activa el bloqueo de acceso público y otorga lectura solo al rol `conciliacion-lectura` de la cuenta 111122223333. Se hace por pull request y con `unit`, `iac` y `sca` en verde. Alternativa descartada: reabrir el bucket temporalmente o aplicar directo a `main` para cumplir el plazo, porque repetiría la causa del incidente. Posición en minoría: aplicar el cambio de inmediato para frenar la penalidad, descartada por el mismo motivo.

- Respuesta del equipo al pedido recibido:
  - **Acceso del proveedor:** el equipo restablece el acceso hoy por una vía segura, sin abrir el bucket, con el rol `conciliacion-lectura`. Se informa a Gerencia el plan y la hora estimada de restablecimiento.
  - **Nombre de quien hizo el cambio:** el equipo no entrega un nombre. En este postmortem las personas se mencionan por su rol. El cambio llegó a producción por una cadena de condiciones del sistema: `main` sin protección, revisión por chat diferida al lunes, `terraform apply` manual desde una laptop, CI sin análisis de `infra/` y ausencia de monitoreo del bucket. Sancionar a una persona no corrige ninguna de esas condiciones, y la siguiente persona bajo la misma presión repetiría el cambio. Además, castigar por el nombre desalienta reportar problemas a tiempo. Lo que el equipo ofrece a Gerencia es el informe con las condiciones del sistema, los roles que intervinieron, las acciones con responsable y fecha, y el avance de cada una. Si Gerencia necesita revisar responsabilidades individuales, es un asunto aparte del postmortem que debe tratarse con el contexto completo, incluida la aprobación por chat del líder técnico.

## Parte B · Evidencia

| Evidencia | Link |
|---|---|
| Run fallido: el gate detiene el bucket público | https://github.com/darkJCdark/INF384-LAB5-GRUPO-5/actions/runs/43319297535 |
| Run en verde en `main` después de las correcciones | https://github.com/darkJCdark/INF384-LAB5-GRUPO-5/actions/runs/43324197376 |
| Pull requests del equipo | [#2](https://github.com/darkJCdark/INF384-LAB5-GRUPO-5/pull/2), [#3](https://github.com/darkJCdark/INF384-LAB5-GRUPO-5/pull/3), [#4](https://github.com/darkJCdark/INF384-LAB5-GRUPO-5/pull/4), [#5](https://github.com/darkJCdark/INF384-LAB5-GRUPO-5/pull/5), [#6](https://github.com/darkJCdark/INF384-LAB5-GRUPO-5/pull/6), [#7](https://github.com/darkJCdark/INF384-LAB5-GRUPO-5/pull/7) |

## Declaración de uso de IA

Herramientas usadas y para qué se usó cada una:
Claude (asistente de IA): extracción de datos verificables del repositorio base (SHA de commits, resultados de un escaneo con Checkov, resultados de un escaneo de dependencias equivalente a Trivy); redacción de un borrador de este documento (postmortem, decisiones y acciones), que el equipo revisó, discutió y ajustó antes de la entrega. 
