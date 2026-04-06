> **Nota:** Esta es una traduccion de README.md. La version original en ingles puede contener informacion mas actualizada que esta version.

# AS Notes (Extension de VS Code para gestion de conocimiento personal)

Sitio web: [asnotes.io](https://www.asnotes.io) | Desarrollador: [App Software Ltd](https://www.appsoftware.com) | [Discord](https://discord.gg/QmwY57ts) | [Reddit](https://www.reddit.com/r/AS_Notes/) | [X](https://x.com/AppSoftwareLtd)

[![VS Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/appsoftwareltd.as-notes?label=VS%20Marketplace&color=blue)](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/appsoftwareltd.as-notes)](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/appsoftwareltd.as-notes)](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/appsoftwareltd.as-notes)](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
[![License](https://img.shields.io/badge/license-Elastic--2.0-lightgrey)](https://github.com/appsoftwareltd/as-notes/blob/main/LICENSE)
[![CI](https://github.com/appsoftwareltd/as-notes/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/appsoftwareltd/as-notes/actions/workflows/ci.yml)

|||
|--|--|
|Instalar | [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes) / [Open VSX](https://open-vsx.org/extension/appsoftwareltd/as-notes)|
|Funciones Pro | [asnotes.io/pricing](https://www.asnotes.io?attr=src_readme)|
|Documentacion | [docs.asnotes.io](https://docs.asnotes.io)|
|Blog | [blog.asnotes.io](https://blog.asnotes.io)|
|Hoja de ruta / Tablero del proyecto| [docs.asnotes.io/development-roadmap](https://docs.asnotes.io/development-roadmap.html) / [github.com](https://github.com/orgs/appsoftwareltd/projects/16)|

## Que es AS Notes?

**AS Notes lleva la edicion de markdown y `[[wikilinks]]` para notas, documentacion, blogs y wikis directamente a [VS Code](https://code.visualstudio.com/) y editores compatibles (por ejemplo, [Antigravity](https://antigravity.google/), [Cursor](https://cursor.com/), [Windsurf](https://windsurf.com/)).**

**Captura ideas, enlaza conceptos, escribe y mantente enfocado, sin salir de tu editor.**

AS Notes proporciona herramientas de productividad que convierten tu IDE favorito en un sistema de gestion de conocimiento personal (PKMS), incluyendo vista de backlinks, gestion de tareas, diarios, tablero kanban, herramientas de edicion markdown, diagramas Mermaid, soporte para matematicas LaTeX y publicacion similar a Jekyll / Hugo.

(Video de introduccion de 1 minuto)

[![Demo de AS Notes](https://img.youtube.com/vi/bwYopQ1Sc5o/maxresdefault.jpg)](https://www.youtube.com/watch?v=bwYopQ1Sc5o)

(Video de demostracion de 1 minuto)

[![Demo de AS Notes](https://img.youtube.com/vi/liRULtb8Rm8/maxresdefault.jpg)](https://youtu.be/liRULtb8Rm8)

## Por que VS Code?

Muchos de nosotros usamos VS Code y editores compatibles a diario, e incluso cuando usamos una herramienta separada para notas y gestion del conocimiento, a menudo seguimos escribiendo documentacion, blogs y wikis en nuestro IDE. AS Notes proporciona las herramientas para hacer todo en tu IDE.

Algunos beneficios clave de gestionar notas en VS Code ademas de los que AS Notes proporciona directamente:

- Compatibilidad multiplataforma + Web (via Workspaces)
- Aceptacion en entornos de trabajo restringidos donde otras herramientas de gestion del conocimiento pueden no estar permitidas
- Enorme biblioteca de extensiones que se puede usar junto con AS Notes para ampliar las capacidades aun mas
- Motor de agente de IA integrado (GitHub CoPilot / Claude, etc.) que puedes usar para trabajar con tus notas
- Funciones de edicion de texto y UI de ultima generacion
- Resaltado de sintaxis
- Y todas las demas funciones que tiene VS Code

## Funciones de AS Notes

### General

- Enfocado en la privacidad: AS Notes no envia tus datos ni telemetria a ningun lugar
- Compatible con control de versiones (Git y GitOps)
- Indexacion ligera de tus notas (sqlite3 WASM local)

- Rendimiento eficiente en bases de conocimiento grandes (aproximadamente 20k archivos markdown)

### Wikilinks

- Estilo Logseq / Roam / Obsidian `[[wikilinks]]` con soporte para enlaces anidados, por ejemplo `[[[[AS Notes]] Page]]`
- Los enlaces se resuelven a la pagina de destino en cualquier lugar de tu workspace. Los wikilinks anidados pueden resolver multiples destinos
- Renombrar un enlace actualiza el archivo de destino y todas las referencias coincidentes
- Seguimiento automatico de wikilinks / renombrado de archivos

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/wikilinks.png" alt="AS Notes backlinks wikilinks" style="max-height:200px; margin-top: 10px">

Consulta la [documentacion de Wikilinks](https://docs.asnotes.io/wikilinks.html) para mas informacion sobre wikilinks.

### Gestion de tareas

Alterna los TODOs de markdown con `Ctrl+Shift+Enter` (Windows/Linux) / `Cmd+Shift+Enter` (macOS):

```
- [ ] Marcador de tarea anadido
- [x] Tarea marcada como hecha
Marcador de tarea eliminado
```

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/task-management-panel.png" alt="AS Notes todo panel" style="max-height:260px; margin-top: 10px; margin-bottom: 10px;">

#### Etiquetas de metadatos de tareas

Anade metadatos estructurados con hashtags en cualquier lugar de una linea de tarea para categorizar y organizar tareas. Las etiquetas se eliminan del texto de tarea mostrado; solo se muestra la descripcion limpia.

| Etiqueta | Descripcion |
|---|---|
| `#P1` | Prioridad 1 - Critica |
| `#P2` | Prioridad 2 - Alta |
| `#P3` | Prioridad 3 - Normal |
| `#W` | En espera - la tarea esta bloqueada o esperando a alguien/algo |
| `#D-YYYY-MM-DD` | Fecha limite - p. ej. `#D-2026-03-15` |
| `#C-YYYY-MM-DD` | Fecha de finalizacion - p. ej. `#C-2026-03-15` |

Ejemplo de uso:

```markdown
- [ ] #P1 Corregir el error critico de produccion
- [ ] #P2 #W Esperando aprobacion de diseno para el nuevo panel
- [x] #D-2026-03-10 Enviar el informe trimestral
```

Se pueden combinar multiples etiquetas. Solo se usa una etiqueta de prioridad; si hay mas de una, gana la primera.

#### Gestion de tareas

El icono de **AS Notes** en la barra de actividad abre la barra lateral de Tareas, que muestra todas las tareas en todo tu workspace.

**Agrupar por** - elige como se agrupan las tareas:

| Vista | Descripcion |
|---|---|
| **Pagina** | Tareas agrupadas alfabeticamente por pagina de origen |
| **Prioridad** | Tareas agrupadas por nivel de prioridad (P1 -> P2 -> P3 -> Sin prioridad), ordenadas por fecha limite dentro de cada grupo |
| **Fecha limite** | Tareas agrupadas por fecha limite |
| **Fecha de finalizacion** | Tareas agrupadas por fecha de finalizacion |

**Filtros:**

- **SOLO TODO** - mostrar solo tareas incompletas (activado por defecto)
- **SOLO EN ESPERA** - mostrar solo tareas con etiqueta `#W`
- **Filtrar por pagina** - escribe para limitar las tareas a paginas cuyo nombre contiene el texto de busqueda (sin distinguir mayusculas)

### Panel de backlinks

El panel de backlinks muestra referencias a la pagina. Las referencias se capturan por mencion de pagina, indentacion estilo outliner bajo otro wikilink o anidamiento en otro wikilink. El seguimiento de backlinks captura el contexto circundante, funciona para referencias futuras (paginas que tienen wikilinks pero aun no se han creado) y se actualiza en tiempo real con los cambios del indice.

Abre la pestana del editor de backlinks junto a tu pestana actual usando: `Ctrl+Alt+B` (Windows/Linux) / `Cmd+Alt+B` (macOS)

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/as-notes-backlink-panel.png" alt="AS Notes backlinks panel" style="max-height:400px; margin-top: 10px">

#### Modos de vista

El panel soporta dos modos de vista, alternables mediante un boton en la cabecera del panel:

- **Plano por pagina** (por defecto) - todas las instancias de backlinks ordenadas alfabeticamente por nombre de pagina de origen. Proporciona una vista de linea temporal lineal donde los archivos de diario se ordenan cronologicamente.
- **Agrupado por cadena** - backlinks agrupados por su patron de cadena (la secuencia de nombres de pagina), con cabeceras plegables. Util para exploracion basada en conceptos.

El modo por defecto se configura via `as-notes.backlinkGroupByChain` (por defecto `false`).

Un control separado alterna la **verbosidad del contexto** - compacto (una linea, truncado) o expandido (texto completo visible). Por defecto configurado via `as-notes.backlinkWrapContext` (por defecto `false`).

#### Visualizacion de cadena primero

- **Agrupacion por patron** - los backlinks se agrupan por su patron de cadena (p. ej. todos los `[[Project]] -> [[Tasks]] -> [[NGINX]]` de diferentes archivos aparecen en un grupo).
- **Menciones independientes** - las referencias directas `[[wikilink]]` aparecen como cadenas de enlace unico, ordenadas primero.
- **Contexto de esquema** - si un wikilink esta indentado debajo de otro wikilink, la jerarquia completa se muestra como una cadena (p. ej. `Page A -> Page B -> Page C`), con cada enlace clicable.
- **Numeros de linea por enlace** - cada enlace de cadena muestra su numero de linea (p. ej. `[L12]`) para navegacion precisa.
- **Contexto de linea** - cada instancia de cadena muestra el texto de la linea circundante con el wikilink resaltado, dando contexto inmediato sin abrir el archivo.
- **Agrupacion sin distinguir mayusculas** - `[[server]]` y `[[Server]]` producen el mismo patron de cadena.

#### Menu contextual - Ver backlinks

Haz clic derecho en cualquier wikilink en el editor para abrir los backlinks de esa pagina especifica:

- Funciona con alias - si el wikilink apunta a un alias, se muestran los backlinks de la pagina canonica.
- Funciona con referencias futuras - las paginas que aun no existen muestran cualquier enlace entrante.

### Tablero Kanban

AS Notes tiene un tablero Kanban integrado respaldado por archivos markdown que se puede usar y editar como cualquier otra pagina en AS Notes.

Usa el tablero Kanban para seguir proyectos de larga duracion. Las tareas estandar se pueden usar en archivos de tarjetas Kanban igual que en cualquier otra nota de AS Notes.

### Diario diario

Pulsa **Ctrl+Alt+J** (Cmd+Alt+J en macOS) para crear o abrir la pagina del diario diario de hoy.

Los archivos de diario se crean como `YYYY-MM-DD.md` en una carpeta dedicada `journals/` (configurable). Las paginas nuevas se generan a partir de la plantilla `Journal.md` en la carpeta de plantillas (por defecto: `templates/`). Edita `Journal.md` para anadir tus propias secciones y sugerencias. Todos los marcadores de posicion de plantilla son compatibles; consulta [Plantillas](#plantillas-pro).

Un panel de **Calendario** en la barra lateral muestra el mes actual con indicadores de diario. Haz clic en cualquier dia para abrir su entrada de diario. Consulta [Calendario](#calendario) para mas detalles.

> **Nota:** El diario diario requiere un workspace inicializado (directorio `.asnotes/`). Consulta [Primeros pasos](#primeros-pasos).

### Compatibilidad con otros PKMS de Markdown

AS Notes puede funcionar junto con bases de conocimiento creadas en Obsidian o Logseq debido a estructuras de archivos similares. Ten en cuenta que hay diferencias de formato y comportamiento.

### Comandos de barra diagonal

Escribe `/` en cualquier archivo markdown para abrir un menu de comandos rapidos. Sigue escribiendo para filtrar la lista, pulsa Enter para ejecutar un comando, o pulsa Escape para cerrar y dejar la `/` en su lugar. Los comandos de barra diagonal se suprimen dentro de bloques de codigo delimitados, tramos de codigo inline y front matter YAML.

#### Comandos estandar

| Comando | Accion |
|---|---|
| **Today** | Inserta un wikilink para la fecha de hoy, p. ej. `[[2026-03-06]]` |
| **Date Picker** | Abre un cuadro de entrada de fecha pre-rellenado con la fecha de hoy. Edita la fecha o pulsa Enter para insertarla como wikilink |
| **Code (inline)** | Inserta `` ` `` `` ` `` con el cursor colocado entre los backticks |
| **Code (multiline)** | Inserta un bloque de codigo delimitado con el cursor despues de la apertura ` ``` ` - escribe el identificador de lenguaje (p. ej. `js`) y pulsa Enter |

#### Comandos de publicacion *(front matter)*

Estos comandos alternan o ciclan campos relacionados con la publicacion en el front matter YAML del archivo. Consulta [Publicar un sitio estatico](#publicar-un-sitio-estatico) para mas detalles.

| Comando | Accion |
|---|---|
| **Public** | Alterna `public: true` / `public: false` en el front matter |
| **Layout** | Cicla `layout` entre `docs`, `blog` y `minimal` en el front matter |
| **Retina** | Alterna `retina: true` / `retina: false` en el front matter |
| **Assets** | Alterna `assets: true` / `assets: false` en el front matter |

#### Comandos de tarjeta Kanban *(solo archivos de tarjeta kanban)*

El siguiente comando solo aparece al editar un archivo de tarjeta kanban (`kanban/card_*.md`).

| Comando | Accion |
|---|---|
| **Card: Entry Date** | Inserta un encabezado `## entry YYYY-MM-DD` en el cursor, pre-rellenado con la fecha de hoy |

#### Comandos de tarea *(solo lineas de tarea)*

Estos comandos solo aparecen cuando el cursor esta en una linea de tarea (`- [ ]` o `- [x]`). Las etiquetas se insertan despues de la casilla de verificacion y despues de cualquier hashtag existente en la linea.

| Comando | Accion |
|---|---|
| **Task: Priority 1** | Inserta `#P1` al inicio del texto de la tarea. Reemplaza cualquier etiqueta de prioridad existente (`#P1`-`#P9`) en la linea |
| **Task: Priority 2** | Inserta `#P2`, reemplazando cualquier etiqueta de prioridad existente |
| **Task: Priority 3** | Inserta `#P3`, reemplazando cualquier etiqueta de prioridad existente |
| **Task: Waiting** | Alterna `#W` al inicio del texto de la tarea (inserta si esta ausente, elimina si esta presente) |
| **Task: Due Date** | Abre una entrada de fecha pre-rellenada con hoy (YYYY-MM-DD). Inserta `#D-YYYY-MM-DD` al inicio del texto de la tarea. Reemplaza cualquier etiqueta de fecha limite existente |
| **Task: Completion Date** | Abre una entrada de fecha pre-rellenada con hoy (YYYY-MM-DD). Inserta `#C-YYYY-MM-DD` al inicio del texto de la tarea. Reemplaza cualquier etiqueta de fecha de finalizacion existente |
| **Convert to Kanban Card** *(Pro)* | Marca la tarea como hecha, crea una tarjeta Kanban en el carril **TODO** con el titulo de la tarea (sin etiquetas), prioridad y fecha limite coincidentes, y la marca **Waiting** establecida. Solo disponible en tareas sin marcar |

Las etiquetas de prioridad y espera se alternan: usar la misma etiqueta de nuevo la elimina. Usar una prioridad diferente reemplaza la existente. Las etiquetas de fecha limite y fecha de finalizacion reemplazan cualquier etiqueta existente del mismo tipo.

#### Comandos Pro

Los comandos Pro estan disponibles con una licencia Pro. Los usuarios gratuitos los ven listados con **(Pro)** anadido en el menu.

| Comando | Accion |
|---|---|
| **Template** | Abre una lista de seleccion rapida de plantillas de la carpeta de plantillas e inserta la plantilla seleccionada en el cursor. Soporta marcadores de posicion (consulta [Plantillas](#plantillas-pro)) |
| **Table** | Solicita el numero de columnas y filas, luego inserta una tabla markdown formateada |
| **Table: Format** | Normaliza todos los anchos de columna en la tabla circundante al contenido de celda mas largo |
| **Table: Add Column(s)** | Solicita el numero, luego anade columnas despues de la columna actual del cursor |
| **Table: Add Row(s)** | Solicita el numero, luego anade filas despues de la fila actual del cursor |
| **Table: Remove Row (Current)** | Elimina la fila en el cursor (rechaza cabecera/separador) |
| **Table: Remove Column (Current)** | Elimina la columna en el cursor (rechaza tablas de una sola columna) |
| **Table: Remove Row(s) Above** | Solicita el numero, luego elimina filas de datos encima del cursor (limitado al disponible) |
| **Table: Remove Row(s) Below** | Solicita el numero, luego elimina filas debajo del cursor (limitado al disponible) |
| **Table: Remove Column(s) Right** | Solicita el numero, luego elimina columnas a la derecha del cursor (limitado al disponible) |
| **Table: Remove Column(s) Left** | Solicita el numero, luego elimina columnas a la izquierda del cursor (limitado al disponible, preserva indentacion) |

### Arrastrar y soltar archivos / Copiar + Pegar

Arrastra archivos desde tu gestor de archivos al editor de markdown, o pega imagenes desde el portapapeles: el editor markdown integrado de VS Code maneja la copia e insercion del enlace automaticamente.

AS Notes configura la opcion de workspace integrada `markdown.copyFiles.destination` para que los archivos arrastrados/pegados se guarden en una carpeta de recursos dedicada en lugar de junto a tu archivo markdown.

| Ajuste | Predeterminado | Descripcion |
|---|---|---|
| `as-notes.assetPath` | `assets/images` | Carpeta relativa al workspace donde se guardan los archivos arrastrados/pegados |

El ajuste se aplica automaticamente cuando AS Notes se inicializa o cuando cambia el valor. La carpeta de destino es creada por VS Code en el primer uso.

**Consejos:**

- **Indicador de posicion de arrastre:** Manten presionado **Shift** mientras arrastras un archivo para ver una guia de posicion del cursor antes de soltar, util para colocar el enlace con precision dentro de tu texto.

### Vista previa de imagen al pasar el raton

Pasa el raton sobre cualquier enlace de imagen en un archivo markdown para ver una vista previa de la imagen en linea. La implementacion estandar es proporcionada por la extension markdown integrada de VS Code y no requiere configuracion: funciona tanto con enlaces estandar `![alt](path)` como con imagenes arrastradas/pegadas. El modo de editor markdown en linea incluye una visualizacion de imagenes mejorada.

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/image-preview.png" alt="AS Notes Image Preview" style="max-height:300px; margin-top: 10px; margin-bottom: 10px;">

#### Autocompletado de bloques de codigo

El autocompletado de bloques de codigo funciona en **todos** los archivos markdown; no se requiere el modo outliner.

Cuando escribes `` ``` `` (con lenguaje opcional, p. ej. `` ```javascript ``) y pulsas **Enter**, AS Notes inserta automaticamente el cierre `` ``` `` y coloca el cursor dentro del bloque. En una linea con vineta, el contenido se indenta para coincidir con la continuacion de la lista markdown.

La extension detecta pares de delimitadores existentes: si los backticks ya estan balanceados (es decir, hay un delimitador de cierre coincidente en la misma indentacion), Enter simplemente inserta una nueva linea en lugar de un segundo esqueleto.

En modo outliner, pulsar Enter en una linea de cierre `` ``` `` que pertenece a un bloque de codigo con vineta inserta una nueva vineta en la indentacion del padre.

## Funciones Pro de AS Notes

Una **licencia Pro** desbloquea funciones premium. Cuando una clave valida esta activa, la barra de estado muestra **AS Notes (Pro)**.

Para obtener una clave de licencia, visita [asnotes.io](https://www.asnotes.io/pricing)

**Introducir tu clave de licencia:**

- Ejecuta **AS Notes: Enter Licence Key** desde la Paleta de Comandos (`Ctrl+Shift+P`), la forma mas rapida.
- O abre Ajustes de VS Code (`Ctrl+,`), busca `as-notes.licenceKey` y pega tu clave alli.

### Estilo Markdown en editor en linea, Mermaid y renderizado LaTeX (Pro)

AS Notes Pro incluye estilo markdown en linea opcional tipo Typora, renderizado de diagramas Mermaid y LaTeX dentro de las pestanas del editor de VS Code (o editor compatible). Los caracteres de sintaxis Markdown estandar (`**`, `##`, `[]()`, etc.) se reemplazan por sus equivalentes visuales mientras escribes.

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/asnotes-inline-editor-markdown-styling-mermaid-andlatex-rendering.png" alt="Inline Editor Markdown Styling, Mermaid and LaTeX Rendering" style="max-height:400px; margin-top: 10px">

Consulta [Estilo Markdown en editor en linea, Mermaid y renderizado LaTeX](https://docs.asnotes.io/inline-markdown-editing-mermaid-and-latex-rendering.html) para mas informacion.

AS Notes incluye un editor Markdown en linea integrado que renderiza el formateo directamente en el editor de texto, similar a Typora.

**Visibilidad de tres estados:**

| Estado | Cuando | Lo que ves |
|---|---|---|
| **Renderizado** | El cursor esta en otro lugar | Texto formateado limpio (sintaxis oculta) |
| **Fantasma** | El cursor esta en la linea | Caracteres de sintaxis con opacidad reducida |
| **Crudo** | El cursor esta dentro del constructo | Codigo fuente Markdown completo |

**Constructos soportados:**

Negrita, cursiva, tachado, encabezados (H1-H6), codigo en linea, enlaces, imagenes, citas de bloque, lineas horizontales, listas desordenadas/de tareas, bloques de codigo (con etiquetas de lenguaje), frontmatter YAML, tablas GFM, codigos cortos de emoji (`:smile:` etc.), diagramas Mermaid (SVG en linea), LaTeX/matematicas (KaTeX/MathJax), menciones de GitHub y referencias a issues.

**Alternar:** Usa el comando **AS Notes: Toggle Inline Editor** o haz clic en el icono del ojo en la barra de titulo del editor. El estado de alternancia se persiste por workspace.

**Consciencia del modo outliner:** Cuando el modo outliner esta activo, los marcadores de vineta y la sintaxis de casillas de verificacion se estilizan en linea (las vinetas se renderizan como vinetas estilizadas, las casillas de verificacion se renderizan con vineta y grafico de casilla de verificacion) junto a la estructura del outliner.

| Ajuste | Predeterminado | Descripcion |
|---|---|---|
| `as-notes.inlineEditor.enabled` | `true` | Activar/desactivar el renderizado en linea |
| `as-notes.inlineEditor.decorations.ghostFaintOpacity` | `0.3` | Opacidad para los caracteres de sintaxis en estado fantasma |
| `as-notes.inlineEditor.links.singleClickOpen` | `false` | Abrir enlaces con un solo clic (en lugar de Ctrl+Clic) |

Consulta [Ajustes](#ajustes) para la lista completa de ajustes del editor en linea.

### Plantillas (Pro)

Crea plantillas de notas reutilizables como archivos markdown en una carpeta de plantillas dedicada (por defecto: `templates/`). Insertalas en cualquier lugar via el comando de barra diagonal `/Template`.

**Configuracion:** Las plantillas se crean automaticamente al inicializar un workspace. Se incluye una plantilla predeterminada `Journal.md` para entradas de diario diarias.

**Crear plantillas:** Anade cualquier archivo `.md` a la carpeta de plantillas. Se soportan subdirectorios; las plantillas en subcarpetas aparecen como `carpeta/nombre` en el selector.

**Insertar una plantilla:** Escribe `/` en cualquier archivo markdown, selecciona **Template**, luego elige de la lista. El contenido de la plantilla se inserta en la posicion del cursor con todos los marcadores de posicion reemplazados.

**Marcadores de posicion:**

| Marcador           | Descripcion                                                    | Ejemplo                               |
|--------------------|----------------------------------------------------------------|---------------------------------------|
| `{{date}}`         | Fecha actual (YYYY-MM-DD)                                      | `2026-03-18`                          |
| `{{time}}`         | Hora actual (HH:mm:ss)                                        | `14:30:45`                            |
| `{{datetime}}`     | Fecha y hora completas (YYYY-MM-DD HH:mm:ss)                   | `2026-03-18 14:30:45`                 |
| `{{filename}}`     | Nombre del archivo actual sin extension                        | `My Page`                             |
| `{{title}}`        | Alias de `{{filename}}`                                        | `My Page`                             |
| `{{cursor}}`       | Posicion del cursor despues de la insercion                    | *(el cursor aterriza aqui)*           |
| Formato de fecha personalizado | Cualquier combinacion de tokens `YYYY`, `MM`, `DD`, `HH`, `mm`, `ss` | `{{DD/MM/YYYY}}` se convierte en `18/03/2026` |

Para mostrar un literal `{{date}}` en la plantilla, escapalo con barra invertida: `\{{date}}`.

**Plantilla de diario:** El archivo `Journal.md` en la carpeta de plantillas se usa como plantilla para nuevas entradas de diario diarias. Editalo para personalizar futuras paginas de diario.

### Comandos de tabla

Todas las operaciones de tabla en el menu de comandos de barra diagonal (`/`) son funciones Pro. Los usuarios gratuitos las ven listadas con **(Pro)** anadido; son visibles pero bloqueadas hasta que se active una licencia.

Consulta [Comandos de barra diagonal](#comandos-de-barra-diagonal) para la lista completa de comandos de tabla.

### Notas cifradas (Pro)

Los usuarios Pro pueden almacenar notas sensibles en archivos cifrados. Cualquier archivo con extension `.enc.md` se trata como una nota cifrada; se excluye del indice de busqueda y la extension nunca lo lee como texto plano.

**Empezar con el cifrado:**

1. Ejecuta **AS Notes: Set Encryption Key** desde la Paleta de Comandos. Tu frase de contrasena se almacena de forma segura en el llavero del SO (VS Code SecretStorage); nunca se escribe en disco ni en archivos de configuracion.
2. Crea una nota cifrada con **AS Notes: Create Encrypted Note** (o **AS Notes: Create Encrypted Journal Note** para una entrada de diario con fecha).
3. Escribe tu nota en el editor. Cuando quieras bloquearla, ejecuta **AS Notes: Encrypt [All|Current] Note(s)**; todos los archivos `.enc.md` en texto plano se cifran en el lugar.
4. Para leer una nota, ejecuta **AS Notes: [All|Current] Note(s)**; los archivos se descifran en el lugar usando tu frase de contrasena almacenada.

**Detalles de cifrado:**

- Algoritmo: AES-256-GCM con un nonce aleatorio de 12 bytes por cifrado
- Derivacion de clave: PBKDF2-SHA256 (100,000 iteraciones) a partir de tu frase de contrasena
- Formato de archivo: marcador de una sola linea `ASNOTES_ENC_V1:<base64url payload>`, usado para ayudar a prevenir commits accidentales via un hook pre-commit de Git.

**Comandos:**

- `AS Notes: Set Encryption Key` - guardar la frase de contrasena en el llavero del SO
- `AS Notes: Clear Encryption Key` - eliminar la frase de contrasena almacenada
- `AS Notes: Create Encrypted Note` - crear un nuevo archivo `.enc.md` nombrado en la carpeta de notas
- `AS Notes: Create Encrypted Journal Note` - crear la entrada de diario de hoy como `.enc.md`
- `AS Notes: Encrypt All Notes` - cifrar todos los archivos `.enc.md` en texto plano
- `AS Notes: Decrypt All Notes` - descifrar todos los archivos `.enc.md` cifrados
- `AS Notes: Encrypt Current Note` - cifrar el archivo `.enc.md` activo (lee el contenido no guardado del editor)
- `AS Notes: Decrypt Current Note` - descifrar el archivo `.enc.md` activo (lee desde disco)

### Modo Outliner

Activa el **Modo Outliner** (ajuste `as-notes.outlinerMode` o el comando **AS Notes: Toggle Outliner Mode**) para convertir el editor en un outliner basado en vinetas. Cada linea comienza con `-` y los atajos de teclado personalizados te mantienen en flujo:

| Tecla | Accion |
|---|---|
| **Enter** | Inserta una nueva vineta con la misma indentacion. Las lineas de tarea (`- [ ]`) continuan como tareas sin marcar. |
| **Tab** | Indenta la vineta un nivel (limitado a un nivel mas profundo que la vineta de arriba). |
| **Shift+Tab** | Reduce la indentacion de la vineta un nivel. |
| **Ctrl+Shift+Enter** | Cicla: vineta simple -> `- [ ]` -> `- [x]` -> vineta simple. |
| **Ctrl+V / Cmd+V** | Pegado multilinea: cada linea del portapapeles se convierte en una vineta separada. |

## Primeros pasos

Para una base de conocimiento de ejemplo, clona <https://github.com/appsoftwareltd/as-notes-demo-notes> y sigue las instrucciones alli para inicializar.

### Inicializar un workspace

AS Notes se activa cuando encuentra un directorio `.asnotes/` en la raiz de tu workspace o en el subdirectorio `rootDirectory` configurado (similar a `.git/` o `.obsidian/`). Sin el, la extension funciona en **modo pasivo**; los comandos muestran una notificacion amigable invitandote a inicializar, y la barra de estado te invita a configurar.

Para inicializar:

1. Abre la Paleta de Comandos (`Ctrl+Shift+P`)
2. Ejecuta **AS Notes: Initialise Workspace**

Esto crea el directorio `.asnotes/`, construye un indice SQLite de todos los archivos markdown y activa todas las funciones. El archivo de indice (`.asnotes/index.db`) se excluye de git mediante un `.gitignore` generado automaticamente.

### Usar AS Notes junto al codigo fuente

AS Notes funciona bien como base de conocimiento dentro de un proyecto de software. Puedes mantener notas, diarios y documentacion en un subdirectorio (p. ej. `docs/` o `notes/`) mientras el resto del repositorio contiene codigo fuente. Cuando se configura un directorio raiz, todas las funciones de AS Notes (resaltado de wikilinks, autocompletado, tooltips al pasar el raton, comandos de barra diagonal) se limitan a ese directorio. Los archivos markdown fuera de el, como un `README.md` en la raiz del workspace, no se ven afectados en absoluto.

Durante la inicializacion, el comando **Initialise Workspace** te pedira que elijas una ubicacion:

- **Raiz del workspace** - la opcion por defecto, usa todo el workspace
- **Elegir un subdirectorio** - abre un selector de carpetas limitado a tu workspace

La ruta elegida se guarda como el ajuste de workspace `as-notes.rootDirectory`. Cuando se establece, todos los datos de AS Notes viven dentro de ese directorio: `.asnotes/`, `.asnotesignore`, diarios, plantillas, notas, tableros kanban y el indice. El escaneado, la vigilancia de archivos y la indexacion se limitan a este directorio, por lo que los archivos fuera de el no se ven afectados.

Si `as-notes.rootDirectory` ya esta configurado antes de ejecutar **Initialise Workspace**, el comando usa la ruta configurada directamente.

> **Advertencia:** Si cambias `rootDirectory` despues de la inicializacion, debes mover manualmente el directorio de notas (incluyendo `.asnotes/`) a la nueva ubicacion y recargar la ventana. La extension mostrara una advertencia cuando el ajuste cambie.

### Reconstruir el indice

Si el indice se vuelve obsoleto o se corrompe, ejecuta **AS Notes: Rebuild Index** desde la Paleta de Comandos. Esto elimina y recrea todo el indice con un indicador de progreso.

### Limpiar workspace

Si la extension esta en mal estado (p. ej. errores WASM persistentes despues de un crash), ejecuta **AS Notes: Clean Workspace** desde la Paleta de Comandos. Esto:

- Elimina el directorio `.asnotes/` (base de datos del indice, logs, configuracion de hook de Git)
- Libera todo el estado en memoria y cambia a modo pasivo

`.asnotesignore` en la raiz de AS Notes se preserva intencionalmente. Ejecuta **AS Notes: Initialise Workspace** despues para empezar de nuevo.

### Excluir archivos del indice

Cuando AS Notes inicializa un workspace, crea un archivo `.asnotesignore` en el directorio raiz de AS Notes. Este archivo usa [sintaxis de patrones `.gitignore`](https://git-scm.com/docs/gitignore) y controla que archivos y directorios se excluyen del indice de AS Notes.

**Contenido por defecto:**

```
# Logseq metadata and backup directories
logseq/

# Obsidian metadata and trash directories
.obsidian/
.trash/
```

Los patrones sin `/` inicial coinciden a cualquier profundidad: `logseq/` excluye `logseq/pages/foo.md` y `vaults/work/logseq/pages/foo.md` por igual. Prefija con `/` para anclar un patron solo a la raiz de AS Notes (p. ej. `/logseq/`).

Edita `.asnotesignore` en cualquier momento. AS Notes observa el archivo y re-escanea el indice automaticamente cuando cambia: los archivos recien ignorados se eliminan del indice y los archivos des-ignorados se anaden.

> **Nota:** `.asnotesignore` es un archivo editable por el usuario y controlado por versiones. AS Notes nunca lo sobreescribira despues de la creacion inicial.

---

## Solucion de problemas

### Bajo rendimiento bajo gestion de herramientas de sincronizacion de archivos

Se ha observado que el editor VS Code puede sentirse mas lento cuando el directorio esta bajo gestion de algunas herramientas de sincronizacion (p. ej. MS OneDrive, Google Drive, Dropbox, etc).

Los directorios de AS Notes se pueden gestionar via sincronizacion, aunque se recomienda Git ya que no vigila archivos como lo hacen las herramientas de sincronizacion y tiene funciones completas de resolucion de conflictos.

### "Este archivo aun no esta indexado"

El panel de backlinks muestra este mensaje cuando el archivo actual no esta en el indice de AS Notes. Causas comunes:

- **Ajustes `files.exclude` / `search.exclude` de VS Code** - AS Notes usa `vscode.workspace.findFiles()` para descubrir archivos markdown, que respeta estos ajustes de VS Code. Los archivos en carpetas excluidas (p. ej. `logseq/version-files/`) se omiten silenciosamente del escaneado y nunca se indexaran. Comprueba **Settings -> Files: Exclude** y **Settings -> Search: Exclude** si falta un archivo que esperas que este indexado.
- **Patrones `.asnotesignore`** - Los archivos que coinciden con patrones en `.asnotesignore` en la raiz de AS Notes se excluyen del indice. Consulta [Excluir archivos del indice](#excluir-archivos-del-indice) arriba.
- **Archivo aun no guardado** - Los archivos nuevos no guardados no se indexan hasta que se guardan en disco por primera vez.

Para resolver, comprueba los ajustes de tu workspace y el archivo `.asnotesignore`. Si el archivo deberia estar indexado, asegurate de que no coincide con ningun patron de exclusion, luego ejecuta **AS Notes: Rebuild Index** desde la Paleta de Comandos.

## Desarrollo

El repositorio esta estructurado como un monorepo con tres paquetes:

| Paquete | Descripcion |
|---|---|
| `common/` | Biblioteca compartida de parsing de wikilinks (`Wikilink`, `WikilinkService`, `MarkdownItWikilinkPlugin`) |
| `vs-code-extension/` | La extension de VS Code |
| `publish/` | Utilidad CLI que convierte un cuaderno de AS Notes (markdown + wikilinks) a HTML estatico |

El codigo fuente de la documentacion reside en `docs-src/` (un workspace de AS Notes). La herramienta `publish` lo convierte a `docs/`.

### Extension de VS Code

```bash
cd vs-code-extension
npm install
npm run build    # Construir la extension
npm run watch    # Modo observacion (reconstruye con cambios)
npm test         # Ejecutar tests unitarios
npm run lint     # Verificacion de tipos
```

### Publicar a HTML desde AS Notes (Conversion HTML)

El convertidor se publica como un paquete npm:

```bash
npx asnotes-publish --config ./asnotes-publish.json
```

Consulta [Publicar un sitio estatico](https://docs.asnotes.io/publishing-a-static-site.html) para la documentacion completa.

### Depuracion

Pulsa **F5** en VS Code para lanzar el Host de Desarrollo de la Extension con la extension cargada.

La version de depuracion tiene precedencia sobre la instalacion del Marketplace, por lo que ambas pueden coexistir.

VS Code recuerda la ultima carpeta abierta en el Host de Desarrollo de la Extension. La [base de conocimiento de demostracion](https://github.com/appsoftwareltd/as-notes-demo-notes) esta disenada para cubrir escenarios de uso comunes.

### Tests

Los tests unitarios usan [vitest](https://vitest.dev/) y cubren el parser de wikilinks, busqueda basada en offset, calculo de segmentos, CRUD del servicio de indice, extraccion de titulos, flujo de datos de deteccion de renombrado e indexacion de enlaces anidados. Ejecuta con `npm test`.

### Publicacion

Las versiones se publican manualmente en el VS Code Marketplace, luego se crea automaticamente un Release de GitHub cuando se empuja una etiqueta de version.

**Paso 1 - incrementar la version**

Actualiza `version` en `package.json` y anade una entrada a `CHANGELOG.md`.

**Paso 2 - publicar en el VS Code Marketplace**

```bash
cd .\vs-code-extension\
npm run build
npx @vscode/vsce package
npx @vscode/vsce login appsoftwareltd   # introduce el token PAT si la autenticacion ha expirado
npx @vscode/vsce publish
```

**Paso 3 - etiquetar y empujar**

```bash
cd ..
git add .
git commit -m "Release v2.3.2"   # cambiar version
git tag v2.3.2                   # cambiar version
git push origin main --tags
```

Empujar la etiqueta activa el [flujo de trabajo de Release](.github/workflows/release.yml), que crea automaticamente un Release de GitHub con notas de release generadas automaticamente y el enlace de instalacion del VS Code Marketplace.

### Publicar el CLI npm (`asnotes-publish`)

**Paso 1 - incrementar la version**

Actualiza `version` en `publish/package.json`.

**Paso 2 - construir y publicar**

```bash
cd publish
npm run build
npm login
npm publish
```

**Paso 3 - verificar**

```bash
npx asnotes-publish --help
```

## Agent Skills

Un [agent skill](https://skills.sh/) esta disponible para AS Notes. Instalalo para dar a tu asistente de IA (GitHub Copilot, Claude, etc.) conocimiento completo de la extension: sintaxis de wikilinks, comandos, ajustes, atajos de teclado y mas.

```bash
npx skills add appsoftwareltd/as-notes/skills/as-notes-agent-use
```

Una vez instalado, tu asistente de IA puede responder preguntas sobre AS Notes, ayudar a configurar ajustes, explicar funciones y asistir con tu flujo de trabajo de notas.

## Aviso legal

Este software se proporciona "tal cual", sin garantia de ningun tipo, expresa o implicita. Los autores y colaboradores no aceptan ninguna responsabilidad por cualquier perdida, corrupcion o dano a datos, archivos o sistemas derivados del uso o mal uso de esta extension, incluyendo pero no limitado a operaciones que crean, renombran, mueven o modifican archivos en tu workspace.

**Eres el unico responsable de mantener copias de seguridad de tus datos.** Se recomienda encarecidamente usar control de versiones (p. ej. git) u otra estrategia de respaldo para cualquier nota o archivo que gestiones con esta extension.

Esta extension esta licenciada bajo la [Licencia Creative Commons Atribucion-NoComercial-CompartirIgual 4.0 Internacional (CC BY-NC-SA 4.0)](LICENSE).

Eres libre de usar, compartir y adaptar esta extension para **propositos no comerciales** con atribucion. El uso comercial requiere una licencia comercial separada. Consulta [LICENSE](LICENSE) para los terminos completos o contactanos en <https://www.appsoftware.com/contact>.
