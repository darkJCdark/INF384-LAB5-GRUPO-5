# Decisiones · Laboratorio 5

## Equipo

Número de equipo:

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
5. **De detección — no hay monitoreo de la configuración del bucket ni registros de acceso.** Por eso la exposición no generó alertas durante 62 h 20 min, y hoy no hay forma de saber qué se descargó.
6. **De diseño — las claves de los comprobantes son predecibles.** Un número correlativo en la ruta del objeto convirtió un bucket abierto en un recorrido trivial por enumeración (cambiar el número). Ni el pipeline ni Checkov detectan este riesgo.
7. **De respuesta — la mitigación quedó fuera del código.** Se bloqueó desde la consola sin modificar `infra/` (drift entre lo declarado y lo real), y esa acción cortó el acceso del proveedor sin una alternativa preparada.


### Qué funcionó y qué no funcionó

Qué funcionó:

- Soporte escaló a On-call a los 35 min de recibir el reporte, y On-call mitigó 30 min después. Desde el aviso hasta la mitigación pasó 1 h 05 min.
- El bloqueo de acceso público desde la consola cerró la exposición de forma efectiva.
- El historial de commits conserva el cambio, su fecha y su mensaje, lo que permitió reconstruir esta línea de tiempo.

Qué no funcionó:

- No hubo ninguna alerta ni registro de acceso en 62 h 20 min de exposición; la detección dependió de un cliente.
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

- Decisión:
- Dato del repositorio que la sustenta:
- Alternativa descartada y por qué:
- Posición en minoría:

### Decisión 2 · La vulnerabilidad sin versión corregida

- Decisión:
- Dato del repositorio que la sustenta:
- Alternativa descartada y por qué:
- Posición en minoría:

### Decisión 3 · La Function URL sin autenticación

- Decisión:
- Dato del repositorio que la sustenta:
- Alternativa descartada y por qué:
- Posición en minoría:

## A3 · Dato nuevo

- Qué cambia en el postmortem:
- Qué cambia en las decisiones:
- Respuesta del equipo al pedido recibido:

## Parte B · Evidencia

| Evidencia | Link |
|---|---|
| Run fallido: el gate detiene el bucket público | |
| Run en verde en `main` después de las correcciones | |
| Pull requests del equipo | |

## Declaración de uso de IA

Herramientas usadas y para qué se usó cada una:
