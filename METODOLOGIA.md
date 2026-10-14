# METODOLOGÍA — cómo se está trabajando (base, 2026-10-10)

> **Qué es este archivo.** La **base** de la metodología que el proyecto aplica **en la práctica**, escrita para
> (a) poder defenderla en `v1` y (b) no perderla entre sesiones. **Es un borrador vivo**: la documentación formal de
> `v1` lo completará y lo ajustará a lo que exija el formato de la defensa.
>
> **Por qué existe.** El autor pidió declararla. Medido el 2026-10-09: **el modelo de tiers no estaba en su PRD
> original** —entró el 2026-09-11 en el commit `304726d`, en una sesión de agente— y su forma de ordenar era por
> **sprints** con el backlog ordenado por importancia; **la palabra «sprint» no aparece hoy en ningún documento del
> repo**. O sea: había una metodología **de hecho** y ninguna **declarada** — que es exactamente el problema cuando hay
> que defender el trabajo.

---

## 1. El nombre, y por qué **no** decimos «Scrum»

**Nombre recomendado: «Desarrollo iterativo e incremental guiado por especificaciones, con compuertas de calidad por
unidad».** Es un nombre feo, y es a propósito: describe lo que se hace, con términos establecidos (iterativo,
incremental, guiado por especificaciones), y no reclama nada que no se cumpla.

**Scrum se puede mencionar, pero no reclamar tal cual.** Lo que Scrum exige y este proyecto **no tiene**:

- **Roles**: no hay *Product Owner* separado del equipo ni *Scrum Master*. Hay **un autor** que decide el producto y
  **un agente** que ejecuta; ninguna de las dos figuras es un rol de Scrum.
- **Ceremonias**: no hay *daily*, ni *sprint review*, ni *retrospective* con el equipo. Hay sesiones de trabajo.
- **Equipo**: un agente de IA **no es un miembro del equipo** en el sentido de Scrum, y decirlo así en una defensa es
  una debilidad, no un adorno: el tribunal va a preguntar por la auto-organización y la estimación en equipo.

**Lo que sí se toma de Scrum** (y por eso «sprints» y «backlog» son vocabulario válido):

- **El backlog priorizado** como fuente única de pendientes (acá: `BACKLOG.md`, ordenado por importancia).
- **La iteración con tiempo acotado** como unidad de entrega (acá: la **sesión de trabajo**, que abre con un plan y
  cierra con un registro).
- **La definición de terminado** explícita (§4).

Si en la defensa conviene decir «Scrum», la forma honesta es: **«Scrum adaptado: se conservan el backlog priorizado y
las iteraciones con tiempo acotado; se omiten roles y ceremonias porque el equipo es un desarrollador asistido por
agentes»**. Esa frase es defendible; fingir los roles no lo es.

---

## 2. El ciclo que se corre de verdad, por unidad de trabajo

Cada unidad (una *user story* o un recorte de ella) recorre esto:

1. **Autorizar.** La petición se clasifica: investigación, propuesta o cambio. Si el pedido es ambiguo, **se pregunta
   antes de empezar** — no se adivina.
2. **Explorar.** Se lee el código y los documentos que existen **antes** de proponer nada. Ninguna afirmación sobre el
   estado actual sin evidencia (`path:line`, comando o URL).
3. **Decidir.** Lo que el agente no puede decidir —producto, alcance, prioridad, estética— se eleva al autor con las
   opciones y sus consecuencias delante.
4. **Planificar.** Si la unidad tiene dos o más pasos reales, se escribe su **expediente** (`odd/tasks/*.md`) y su lista
   de tareas **antes** de la primera línea de código.
5. **Implementar** con **prueba primero** cuando el cambio tiene un resultado observable y una prueba ejecutable: se
   escribe la prueba, se la ve **fallar** (RED), se implementa, se la ve pasar (GREEN).
6. **Verificar** con algo **que no sea el propio autor del cambio**: otro agente que corre la suite completa, typecheck,
   linter y **lee el código para refutar la afirmación del informe**.
7. **Compuerta de revisión**: la unidad pasa por una revisión nativa que emite un veredicto por lentes (riesgo,
   resiliencia, legibilidad, confiabilidad) sobre un candidato **congelado**; sus hallazgos se admiten o se escalan, y
   la autoridad se quema al aprobarla. Los avisos informativos **se verifican contra el código**, no se aceptan por fe.
8. **Cerrar** con **un commit de unidad de trabajo** (Conventional Commits), con la documentación y las pruebas junto
   al comportamiento, y con el registro en el `BACKLOG`/expediente de lo que queda pendiente.

**Unidades de trabajo**: no existe `v0`/`v1` como metodología — son **la agrupación por entrega** (§6). La unidad de
trabajo es el **commit revisable**: un cambio con un propósito, con su prueba y su registro.

---

## 3. Los artefactos, y para qué sirve cada uno

| Artefacto | Dónde vive | Para qué | Quién decide |
|---|---|---|---|
| **Especificaciones** | `openspec/specs/` (formato GIVEN/WHEN/THEN) | El contrato de comportamiento de cada capacidad | Autor (producto); el agente propone |
| **Cambios en curso** | `openspec/changes/` (y `archive/` al cerrar) | El delta de una capacidad, con su diseño y tareas | Autor aprueba; el agente redacta |
| **Pendientes priorizados** | `BACKLOG.md` | Fuente única de lo que falta, con su tier y su motivo | **El autor** |
| **Requisitos** | `PRD.md` | El concepto y el alcance del producto; **no es la fuente de la verdad** de lo construido | Autor; el agente anota las divergencias |
| **Expedientes** | `odd/tasks/*.md` | La narrativa de una unidad: decisiones, mediciones, hallazgos, deudas | El agente, revisado por el autor |
| **Bitácora** | `BITACORA.md` | **Índice** de cuándo se hizo qué, con punteros | El agente |
| **Hojas de revisión de UI** | `src/routes/dev/*` (efímeras) | Proponer una interfaz concreta para que el autor la **mire** antes de promoverla | El agente propone; **el autor aprueba mirando** |
| **Historial de revisión** | `.git/gentle-ai/review-transactions/` | Los linajes de las compuertas: qué se revisó, qué se halló, qué se aprobó | El sistema de revisión |

**Regla transversal:** un archivo canónico por tema. Los cambios se hacen **en el archivo que ya existe**, no en
copias por sesión; el historial de git es el registro de qué cambió y cuándo.

---

## 4. Definición de terminado (una unidad)

Una unidad está terminada cuando:

1. El comportamiento pedido existe y **se puede mostrar**.
2. Tiene **prueba** que falla si el comportamiento se rompe (y esa falla se observó al menos una vez).
3. La **suite completa** pasa, el *typecheck* no agrega errores y el linter está limpio.
4. La **verificación independiente** corrió (no la del autor del cambio).
5. Pasó la **compuerta de revisión** y su autoridad quedó quemada, o se declaró por qué no aplica.
6. El **registro está actualizado**: `BACKLOG` (lo que queda), expediente (lo que pasó), y el commit con su mensaje.
7. Nada quedó «a medias en silencio»: lo que falta **está anotado con su motivo**.

---

## 5. Lo que hace distinta a esta metodología

Vale escribirlo, porque es lo que la defensa puede mostrar como aporte y no como carencia:

- **El agente no tiene autoridad de entrega.** Implementa, verifica y documenta; **no** decide el producto, no
  aprueba su propio trabajo y no publica (`push`, PR, merge y despliegue son del autor).
- **La revisión es adversarial y separada de la autoría**: otra instancia revisa un candidato congelado, y sus
  hallazgos tienen que ser corroborados contra el código antes de actuar sobre ellos.
- **La UI se aprueba mirándola**, no describiéndola: se construye una hoja `/dev/...` que duplica la página real, el
  autor la recorre, y recién entonces se promueve.
- **Todo límite y toda afirmación se mide.** «No se pudo medir» es una respuesta aceptada; «debería funcionar» no.

---

## 6. Los tiers **no** son la metodología

`v0 / v1 / v1+ / v2 / v2+` (definidos en `PRD.md` §3) son **dónde se agrupa cada cosa con respecto a la
documentación y a las entregas** —demo, entrega final, detalles que entran en la entrega, requerimientos que no
alcanzaron y se registran—. **No** son fases de un proceso ni un orden de ejecución, y **no** reemplazan al backlog
priorizado: un requerimiento de `v1` puede hacerse antes que uno de `v0` si conviene.

---

## 7. Pendiente para `v1`

- **Completar este documento** con el formato que exija la defensa: en particular, si el tribunal pide una metodología
  con nombre propio, decidir entre declarar **Scrum adaptado** (con las omisiones de §1 escritas) o el nombre
  descriptivo recomendado.
- **Registrar el proceso con su evidencia**: la `BITACORA.md` es el índice; los expedientes y las compuertas son la
  evidencia.
