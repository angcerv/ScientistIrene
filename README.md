# Brújula Empleo

Buscador personal de empleo con React, TypeScript, Vite, Express y SQLite. Funciona en el equipo local.

## Inicio

Con Node.js 22.13 o posterior:

```sh
npm install
npm run dev
```

Abre http://127.0.0.1:5173. Desde **Mi perfil** puedes importar un PDF con texto seleccionable o escribir los datos manualmente. Guarda el perfil y pulsa **Buscar ofertas**. Puedes buscar antes de completar el perfil.

Los datos se guardan en `data/brujula.sqlite`. El PDF se procesa en memoria y el texto completo se muestra durante la importación para que puedas corregir los campos antes de guardar. La extracción reconoce encabezados comunes en español e inglés y lee hasta 25 páginas. Los PDF escaneados requieren una versión con texto o introducir los datos manualmente.

## Fuentes de empleo

| Fuente | Acceso | Decisión para esta versión |
| --- | --- | --- |
| [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html) | Lectura pública por bolsa, sin clave | Integrada con Cabify, Wallapop, Typeform y Celonis. Consulta en directo con descripción completa y enlace de cada anuncio. |
| [Lever Postings API](https://github.com/lever/postings-api) | Lectura pública por bolsa | Candidata para ampliar el catálogo de empresas. |
| [InfoJobs](https://developer.infojobs.net/documentation/app-auth/index.xhtml) | Client ID y secreto de aplicación | Conector opcional de búsqueda y detalle de solo lectura. Requiere credenciales de desarrollador. |
| [Jooble](https://help.jooble.org/en/support/solutions/articles/60001448238) | Clave regional. Cuota gratuita documentada de 100 peticiones diarias | Los resultados incluyen extractos. Se necesitaría acceso autorizado a cada texto completo. |
| [Adzuna](https://developer.adzuna.com/docs/terms_of_service) | Registro y clave. Cuotas según plan y atribución obligatoria al mostrar anuncios | Acceso de evaluación para búsqueda personal. La descripción disponible debe verificarse antes de integrar y las condiciones comerciales requieren licencia. |
| [Remotive](https://remotive.com/remote-jobs/api) | API pública de remoto con atribución y 24 horas de demora. API privada de pago | Candidata para remoto si se acepta la demora y se verifica elegibilidad para España. |

El botón de búsqueda consulta cada bolsa en el momento. Las bolsas pueden devolver datos parciales. La pantalla muestra cuáles respondieron y cuáles fallaron. Para cambiar las bolsas, copia `.env.example` a `.env` y configura `GREENHOUSE_BOARDS` con sus identificadores públicos. Las variables sensibles deben definirse solo en el backend.

### Activar InfoJobs

[Registra la aplicación en InfoJobs Developers](https://developer.infojobs.net/documentation/quick-start/index.xhtml) y copia el Client ID y el Client Secret en un archivo privado con estas variables:

```dotenv
INFOJOBS_CLIENT_ID=
INFOJOBS_CLIENT_SECRET=
```

- En la versión web local, usa `.env` en la raíz del proyecto.
- En Tauri, usa `fuentes.env` junto a `brujula.sqlite` en la carpeta de datos de la app. En Windows se encuentra normalmente en `%LOCALAPPDATA%\es.brujula.empleo`. En macOS se encuentra normalmente en `~/Library/Application Support/es.brujula.empleo`.
- Reinicia la aplicación. InfoJobs aparecerá en **Fuentes** cuando se consulte una búsqueda. Respeta las [condiciones de uso de InfoJobs](https://developer.infojobs.net/legal/legal/terms-of-use.xhtml) aplicables al registro.

Brújula consulta hasta cinco resultados por área técnica y recupera por separado la descripción y los requisitos. Usa autenticación de aplicación e ignora los resultados sin descripción completa. Las credenciales quedan en el archivo local. La consulta envía a InfoJobs los términos técnicos y la provincia si corresponde.

## Compatibilidad y profesiones

La clasificación examina el texto completo de cada anuncio. Cruza habilidades y sinónimos en español e inglés, intereses, requisitos detectables, modalidad, ubicación y tareas a evitar. El rango de salario bruto anual es opcional. Se compara con el importe publicado y queda fuera de la puntuación, el orden y los descartes. Presenta evidencia textual y una estimación de encaje de 0 a 100. La puntuación da hasta 65 puntos a las habilidades técnicas, 15 a las habilidades blandas y 20 a los intereses. Los requisitos por verificar y los conflictos identificados con las preferencias reducen el resultado. Sin un perfil o una descripción evaluable, la puntuación queda sin calcular. Los requisitos por contrastar pueden requerir comprobar años, titulaciones o niveles de idioma. Para ayudar a detectar preferencias adicionales, escribe términos concretos separados por comas o líneas. Usa expresiones como «sin viajes» para indicar algo que prefieres evitar.

**Profesiones compatibles** usa un catálogo de competencias transferibles desde el primer arranque. Para activar las propuestas generativas, instala [Ollama](https://ollama.com/), descarga un modelo local con `ollama pull qwen2.5:3b` y configura `OLLAMA_MODEL=qwen2.5:3b` en `.env`. Reinicia la app con Ollama disponible en el puerto 11434. El perfil se procesa en ese servicio local y las sugerencias muestran el método utilizado. Si el modelo falla, la pantalla muestra el aviso y las sugerencias por competencias disponibles.

El buscador deduplica por enlace y por empresa, puesto y ubicación normalizados. Las ofertas guardadas y las marcadas como «No me interesa» se conservan en SQLite. En **Mi lista → No me interesan** se puede quitar esa marca. La lista de descartes automáticos tiene su propio apartado. **Ya he aplicado** registra la fecha y notas de la candidatura en SQLite y retira esa oferta de los resultados. Los datos se consultan y editan en **Mi lista → Candidaturas**. Las candidaturas afinan el encaje de ofertas nuevas con tareas técnicas y actividades similares. El ajuste puede sumar hasta 10 puntos y el detalle indica qué candidatura y qué actividades lo justifican. El análisis usa los anuncios guardados localmente y excluye las notas.

## Verificación

```sh
npm run check
npm run build
npm start
```

`npm start` sirve la compilación de producción y la API en el mismo puerto. Solo escucha en la interfaz local.

## Perfil personalizado y escritorio

En **Mi perfil → Exportar perfil guardado** puedes descargar una copia JSON de tus datos y preferencias. Para recuperarla en otro equipo, usa **Importar archivo**, aplica el contenido al borrador y pulsa **Guardar perfil**.

El perfil preparado para esta instalación está en `data/Perfil-Irene.json`. La carpeta `data` se excluye del repositorio. Cuando el archivo está presente al compilar, la versión de escritorio personalizada incluye ese JSON e inicializa SQLite en el primer arranque. El PDF original y la base de datos del equipo de compilación se quedan fuera del instalador. Si compilaste sin el archivo de perfil, también puedes importarlo desde la misma pantalla.

La clasificación da peso a la I+D experimental, la fotónica, la instrumentación, los ensayos, la fabricación avanzada y las competencias transferibles. Reconoce municipios de la Comunidad de Madrid, conserva oportunidades en otras zonas de España y señala cuándo hay que confirmar la elegibilidad para trabajar en remoto desde España. Las condiciones de ubicación, viajes y reubicación se contrastan con el anuncio cuando hay evidencia textual. Los años de experiencia y las tecnologías especializadas se muestran como requisitos por revisar cuando se detectan.

La búsqueda también consulta los RSS públicos de [ARQUIMEA](https://careers.arquimea.com/jobs.rss), [Sener](https://www.engineering-jobs.sener/jobs.rss) y [RDT](https://careers.rdt.com/jobs.rss), los anuncios estructurados publicados en el [índice de KD](https://www.kd.tech/sitemap.xml) y la [API pública de SmartRecruiters](https://developers.smartrecruiters.com/docs/posting-api) para AFRY, Eurofins y SGS. RDT aporta vacantes de ingeniería aplicada y SGS publica puestos de inspección y ensayos industriales. SmartRecruiters consulta hasta 40 anuncios de cada bolsa en España por búsqueda y recupera sus descripciones. La interfaz indica la cobertura parcial de una fuente cuando corresponda.

[Westinghouse](https://careers.westinghousenuclear.com/search/?locationsearch=Spain) se consulta sin credenciales. El conector lee las dos primeras páginas de resultados en España y el marcado de las fichas públicas para obtener la descripción, la localidad y la fecha de publicación.

### Abrir la ventana de escritorio desde el proyecto

Desde la raíz del proyecto, con los requisitos de Tauri instalados:

```sh
npm ci
npm run tauri dev
```

Tauri prepara el motor y abre la ventana de Brújula Empleo. El comando usa el servidor local de la aplicación y desactiva los reinicios por cambios de archivos. Para aplicar cambios de código, cierra la ventana y vuelve a ejecutar el comando. En macOS usa Xcode desde `/Applications/Xcode.app` si está disponible y no has indicado otro `DEVELOPER_DIR`.

La versión web se abre con `npm run dev` en http://127.0.0.1:5173. La ventana de escritorio usa su propia base de datos. En el primer arranque con el perfil inicial, completa solo los campos vacíos y conserva los valores ya guardados. Después se puede editar el perfil desde **Mi perfil**.

### Compilar para Windows x64

En Windows x64 con [los requisitos de Tauri](https://v2.tauri.app/start/prerequisites/), Node.js 22 x64 y Rust MSVC:

```sh
npm ci
npm run check
npm run desktop:build
```

El instalador NSIS aparece en `src-tauri/target/release/bundle/nsis/`. El workflow manual **Instalador Windows** prepara el mismo ejecutable en un runner Windows y lo guarda como artefacto. El instalador incluye el runtime de Node.js y las dependencias del motor, e instala la aplicación para el usuario actual. El usuario final no necesita instalar Node.js ni Rust. Tauri utiliza WebView2. La aplicación se conecta a internet para consultar las fuentes.

En escritorio, SQLite se guarda en la carpeta local de datos de Brújula Empleo del usuario. La ventana Tauri inicia el motor en un puerto local propio. Para generar el instalador personalizado en un equipo Windows, coloca primero el JSON de perfil en `data/Perfil-Irene.json`. El workflow del repositorio compila la variante genérica cuando se ejecuta sin ese archivo. Las ofertas originales se abren en el navegador predeterminado.
