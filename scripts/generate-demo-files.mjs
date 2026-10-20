// Archivos ficticios de cada formato para los recursos del seed (`seed-ckan.mjs`).
//
// El catálogo sembrado mostraba enlaces a `data.umss.edu.bo` con un formato inventado
// (odd/tasks/demo-honest-data.md, S4): el chip decía «XLSX» y la ficha, «enlace». Acá se genera
// el **archivo real** de cada formato —CSV, XLSX, PDF, JSON, GeoJSON, PNG, JPG y TXT—, para que el seed lo suba
// y el portal muestre un archivo con su vista previa sin conexión.
//
// Todo se genera **en memoria** en el momento de sembrar: no hay archivos versionados. Cada
// perfil (`PROFILES`) describe las columnas plausibles de un conjunto; los valores salen de un
// PRNG con semilla derivada de `dataset|formato|recurso`, así que el mismo recurso da siempre los
// mismos bytes. Ningún dato es oficial de la UMSS: el XLSX (hoja «Nota»), el PDF y el GeoJSON
// (campo `nota`) lo dicen; el CSV y el JSON no tienen dónde, y lo dice la descripción del recurso.
//
// Uso (desde el seed):
//   generateFile({ datasetName, resourceName, title, description, profile, format })

import { createHash } from "node:crypto";

import { formatCsv, isoDate, makeRandom, round2 } from "./generate-csv-common.mjs";
import { FICTITIOUS_NOTE } from "./generate-informe-pdf.mjs";
import { drawChart, encodeJpeg, encodePng } from "./image-writer.mjs";
import { buildPdf, MARGIN, PAGE_WIDTH, Page, textWidth } from "./pdf-writer.mjs";
import { buildXlsx } from "./xlsx-writer.mjs";

/** Tipo MIME y extensión de cada formato que el seed sube. */
export const FORMAT_INFO = {
	CSV: { mime: "text/csv", ext: "csv" },
	XLSX: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx" },
	PDF: { mime: "application/pdf", ext: "pdf" },
	JSON: { mime: "application/json", ext: "json" },
	GeoJSON: { mime: "application/geo+json", ext: "geojson" },
	// S18 de odd/tasks/v0.1.1-polish.md: las vistas previas de imagen y de texto del portal.
	PNG: { mime: "image/png", ext: "png" },
	JPG: { mime: "image/jpeg", ext: "jpg" },
	TXT: { mime: "text/plain", ext: "txt" },
};

// ── Vocabulario inventado ──

const FACULTADES = [
	"Ciencias y Tecnología",
	"Ciencias de la Salud",
	"Ciencias Agrícolas",
	"Ciencias Económicas",
	"Humanidades",
	"Arquitectura",
	"Derecho",
	"Odontología",
];
const CARRERAS = [
	"Ingeniería Civil",
	"Ingeniería de Sistemas",
	"Medicina",
	"Enfermería",
	"Agronomía",
	"Economía",
	"Psicología",
	"Arquitectura",
	"Derecho",
	"Odontología",
	"Biología",
	"Química",
];
const DEPARTAMENTOS = [
	"Física",
	"Matemáticas",
	"Biología",
	"Química",
	"Informática",
	"Civil",
	"Salud Pública",
	"Agronomía",
	"Economía",
	"Lingüística",
];
const AREAS = [
	"Ciencias exactas",
	"Ciencias de la vida",
	"Ingeniería",
	"Ciencias sociales",
	"Salud",
];
const DISTRITOS = Array.from({ length: 12 }, (_, i) => `Distrito ${i + 1}`);
const TEMAS = [
	"calidad del agua",
	"energías renovables",
	"nutrición infantil",
	"semillas nativas",
	"movilidad urbana",
	"aprendizaje de la lectura",
	"residuos sólidos",
	"salud mental",
	"riego tecnificado",
	"patrimonio cultural",
];

// ── Constructores de columnas ──
//
// Una columna es `[nombre, (rnd, i, fila) => valor]`; `fila` tiene las columnas anteriores, para
// los valores que dependen de otros (lo ejecutado nunca pasa de lo presupuestado).

const pick = (list) => (r) => r.pick(list);
const int = (min, max) => (r) => r.int(min, max);
const dec = (min, max) => (r) => round2(r.float(min, max));
const seq =
	(prefix, width = 4) =>
	(_r, i) =>
		`${prefix}-${String(i + 1).padStart(width, "0")}`;
const date = (y1, y2) => (r) => isoDate(r.int(y1, y2), r.int(1, 12), r.int(1, 28));
const semester = () => (r) => `${r.int(2022, 2025)}-${r.pick(["I", "II"])}`;

// ── Perfiles: un conjunto del seed → columnas plausibles ──

const BASE_PROFILES = {
	"presupuesto-anual-ejecutado-por-facultad": {
		rows: 96,
		columns: [
			["gestion", int(2018, 2025)],
			["facultad", pick(FACULTADES)],
			["partida", pick(["Gastos corrientes", "Inversión", "Proyectos"])],
			["presupuesto_bs", int(200_000, 9_000_000)],
			["ejecutado_bs", (r, _i, row) => Math.round(row.presupuesto_bs * r.float(0.55, 1))],
		],
	},
	"matricula-estudiantil-por-carrera-y-gestion": {
		rows: 180,
		columns: [
			["gestion", int(2015, 2025)],
			["facultad", pick(FACULTADES)],
			["carrera", pick(CARRERAS)],
			["sexo", pick(["Femenino", "Masculino"])],
			["inscritos", int(15, 480)],
		],
	},
	"produccion-cientifica-del-personal-docente": {
		rows: 150,
		columns: [
			["producto_id", seq("PC")],
			["anio", int(2015, 2025)],
			["departamento", pick(DEPARTAMENTOS)],
			["tipo", pick(["Artículo", "Libro", "Capítulo de libro"])],
			["indexacion", pick(["Scopus", "Web of Science", "Latindex", "Sin indexar"])],
			["autores", int(1, 7)],
		],
	},
	"resultados-de-evaluacion-docente-por-semestre": {
		rows: 140,
		columns: [
			["semestre", semester()],
			["facultad", pick(FACULTADES)],
			[
				"asignatura",
				pick([
					"Cálculo I",
					"Programación",
					"Anatomía",
					"Estadística",
					"Microeconomía",
					"Derecho civil",
					"Química general",
				]),
			],
			["evaluaciones", int(8, 120)],
			["puntaje_promedio", dec(3, 4.9)],
		],
	},
	"proyectos-de-investigacion-activos": {
		rows: 80,
		columns: [
			["proyecto_id", seq("PRY")],
			["titulo", (r) => `Estudio sobre ${r.pick(TEMAS)} en el valle central`],
			["departamento", pick(DEPARTAMENTOS)],
			["estado", pick(["En ejecución", "En ejecución", "Por concluir", "Suspendido"])],
			["anio_inicio", int(2020, 2025)],
			["presupuesto_bs", int(30_000, 1_200_000)],
		],
	},
	"indicadores-de-eficiencia-terminal": {
		rows: 120,
		columns: [
			["carrera", pick(CARRERAS)],
			["cohorte", int(2015, 2020)],
			["ingresantes", int(40, 400)],
			["graduados", (r, _i, row) => Math.round(row.ingresantes * r.float(0.3, 0.85))],
			["eficiencia_terminal_pct", (_r, _i, row) => round2((row.graduados / row.ingresantes) * 100)],
			["duracion_promedio_anios", dec(4.5, 8)],
		],
	},
	"distribucion-de-becas-por-facultad": {
		rows: 90,
		columns: [
			["gestion", int(2021, 2025)],
			["facultad", pick(FACULTADES)],
			["tipo_beca", pick(["Trabajo", "Comedor", "Residencia", "Excelencia", "Investigación"])],
			["nivel", pick(["Grado", "Posgrado"])],
			["becarios", int(3, 220)],
			["monto_total_bs", int(5_000, 900_000)],
		],
	},
	"infraestructura-de-laboratorios-y-equipamiento": {
		rows: 70,
		columns: [
			["laboratorio_id", seq("LAB", 3)],
			["facultad", pick(FACULTADES)],
			[
				"nombre",
				pick([
					"Química analítica",
					"Electrónica",
					"Suelos",
					"Microbiología",
					"Redes",
					"Hidráulica",
					"Física general",
				]),
			],
			["area_m2", int(30, 220)],
			["equipos", int(5, 90)],
			["capacidad_estudiantes", int(10, 60)],
			["estado", pick(["Operativo", "Operativo", "En mantenimiento"])],
		],
	},
	"publicaciones-indexadas-por-departamento": {
		rows: 110,
		columns: [
			["anio", int(2015, 2025)],
			["departamento", pick(DEPARTAMENTOS)],
			["area", pick(AREAS)],
			["base_indexacion", pick(["Scopus", "Web of Science", "Latindex", "SciELO"])],
			["publicaciones", int(1, 35)],
		],
	},
	"consumo-energetico-por-edificio": {
		rows: 144,
		columns: [
			[
				"edificio",
				pick([
					"Edificio Central",
					"Biblioteca",
					"Laboratorios",
					"Comedor",
					"Aulas Norte",
					"Aulas Sur",
				]),
			],
			["mes", (r) => `2025-${String(r.int(1, 12)).padStart(2, "0")}`],
			["energia_kwh", int(1_800, 42_000)],
			["agua_m3", int(40, 1_300)],
			["gas_m3", int(0, 400)],
		],
	},
	"tasas-de-graduacion-por-cohorte": {
		rows: 100,
		columns: [
			["cohorte", int(2012, 2020)],
			["carrera", pick(CARRERAS)],
			["ingresantes", int(40, 400)],
			["graduados", (r, _i, row) => Math.round(row.ingresantes * r.float(0.25, 0.75))],
			[
				"desertores",
				(r, _i, row) => Math.round((row.ingresantes - row.graduados) * r.float(0.3, 0.9)),
			],
			["tasa_graduacion_pct", (_r, _i, row) => round2((row.graduados / row.ingresantes) * 100)],
		],
	},
	"convenios-interinstitucionales-activos": {
		rows: 60,
		columns: [
			["convenio_id", seq("CV", 3)],
			[
				"institucion",
				pick([
					"Universidad Andina Ficticia",
					"Instituto Tecnológico del Valle",
					"Fundación Andes Abiertos",
					"Red de Universidades del Sur",
					"Centro de Estudios Altiplánicos",
					"Universidad Ficticia de Lima",
				]),
			],
			["pais", pick(["Bolivia", "Bolivia", "Perú", "Chile", "Argentina", "España"])],
			[
				"objetivo",
				pick(["Movilidad estudiantil", "Investigación conjunta", "Pasantías", "Doble titulación"]),
			],
			["fecha_inicio", date(2018, 2024)],
			["vigencia_anios", int(2, 10)],
		],
	},
	"recursos-bibliograficos-digitales": {
		rows: 120,
		columns: [
			["recurso_id", seq("RB")],
			["tipo", pick(["Libro electrónico", "Revista", "Base de datos", "Tesis digital"])],
			["idioma", pick(["Español", "Español", "Inglés", "Quechua", "Portugués"])],
			["anio_publicacion", int(1998, 2025)],
			["accesos_anuales", int(0, 6_000)],
		],
	},
	"programas-de-posgrado-ofertados": {
		rows: 50,
		columns: [
			["programa_id", seq("PG", 3)],
			["nivel", pick(["Maestría", "Doctorado", "Especialidad", "Diplomado"])],
			["facultad", pick(FACULTADES)],
			["modalidad", pick(["Presencial", "Semipresencial", "Virtual"])],
			["duracion_meses", pick([6, 12, 18, 24, 36])],
			["cupos", int(15, 60)],
		],
	},
	"encuestas-de-satisfaccion-estudiantil": {
		rows: 130,
		columns: [
			["semestre", semester()],
			[
				"servicio",
				pick([
					"Biblioteca",
					"Secretaría",
					"Comedor",
					"Laboratorios",
					"Bienestar estudiantil",
					"Plataforma virtual",
				]),
			],
			["nivel", pick(["Grado", "Posgrado"])],
			["respuestas", int(20, 900)],
			["satisfaccion_pct", dec(45, 96)],
		],
	},

	// Observatorio de Movilidad Urbana (`SHOWCASE` del seed).
	"observatorio-flujos-vehiculares": {
		rows: 240,
		columns: [
			["punto_conteo", (r) => `PC-${String(r.int(1, 47)).padStart(2, "0")}`],
			["fecha", date(2019, 2025)],
			["hora", int(0, 23)],
			["sentido", pick(["Norte-Sur", "Sur-Norte", "Este-Oeste", "Oeste-Este"])],
			["tipo_vehiculo", pick(["Automóvil", "Minibús", "Moto", "Camión", "Bicicleta"])],
			["vehiculos", int(0, 900)],
		],
	},
	"observatorio-encuesta-origen-destino": {
		rows: 200,
		columns: [
			["hogar_id", seq("H", 5)],
			["distrito", pick(DISTRITOS)],
			["modo_principal", pick(["Minibús", "Automóvil", "A pie", "Bicicleta", "Taxi", "Moto"])],
			["motivo", pick(["Trabajo", "Estudio", "Compras", "Salud", "Otro"])],
			["viajes_por_dia", int(1, 6)],
			["tiempo_viaje_min", int(5, 95)],
		],
	},
	"observatorio-transporte-publico": {
		rows: 12,
		geo: "routes",
		columns: [
			["linea", seq("L", 2)],
			["tipo", pick(["Troncal", "Alimentadora", "Interprovincial"])],
			["paradas", int(12, 60)],
			["longitud_km", dec(4, 28)],
			["frecuencia_min", pick([5, 8, 10, 15, 20])],
			["estado", pick(["Operativa", "Operativa", "Suspendida"])],
		],
	},
	"observatorio-accidentalidad-vial": {
		rows: 180,
		columns: [
			["accidente_id", seq("AC", 5)],
			["fecha", date(2019, 2025)],
			["hora", int(0, 23)],
			["tipo", pick(["Choque", "Atropello", "Vuelco", "Colisión múltiple"])],
			["gravedad", pick(["Leve", "Leve", "Grave", "Fatal"])],
			["distrito", pick(DISTRITOS)],
			["latitud", (r) => round6(r.float(LAT_MIN, LAT_MAX))],
			["longitud", (r) => round6(r.float(LON_MIN, LON_MAX))],
		],
	},
	"observatorio-informe-metodologico": {
		rows: 10,
		columns: [
			[
				"variable",
				(_r, i) =>
					[
						"fecha",
						"hora",
						"punto_conteo",
						"sentido",
						"tipo_vehiculo",
						"vehiculos",
						"distrito",
						"gravedad",
						"latitud",
						"longitud",
					][i],
			],
			["tipo", pick(["texto", "entero", "fecha"])],
			[
				"criterio_calidad",
				pick(["Sin vacíos", "Validado en campo", "Rango verificado", "Doble digitación"]),
			],
		],
	},
};

// ── Perfiles de los conjuntos adicionales del seed (`buildMoreDatasets`, S18) ──
//
// La clave es el `name` del dataset (el título pasado por `slugify`), como en los perfiles de arriba.

const LABORATORIOS = [
	"Redes",
	"Electrónica",
	"Suelos",
	"Microbiología",
	"Física general",
	"Hidráulica",
];
const CENTROS_SALUD = [
	"Hospital Viedma",
	"Hospital Clínico Viedma Norte",
	"Centro de Salud Alalay",
	"Centro de Salud Cala Cala",
	"Policlínico Universitario",
];
const CULTIVOS = ["Papa", "Maíz", "Quinua", "Trigo", "Haba", "Cebada", "Durazno"];
const UNIDADES = [
	"Secretaría General",
	"Dirección Administrativa",
	"Dirección Financiera",
	"Bienestar Estudiantil",
	"Biblioteca Central",
	"Infraestructura",
];
const PAISES = ["Bolivia", "Perú", "Chile", "Argentina", "Brasil", "España", "Alemania", "México"];
const profile = (rows, columns) => ({ rows, columns });

const MORE_PROFILES = {
	"inventario-de-equipos-de-computo-por-laboratorio": profile(90, [
		["equipo_id", seq("EQ")],
		["laboratorio", pick(LABORATORIOS)],
		["tipo", pick(["Computadora de escritorio", "Portátil", "Servidor", "Proyector"])],
		["anio_adquisicion", int(2014, 2025)],
		["estado", pick(["Operativo", "Operativo", "En mantenimiento", "De baja"])],
	]),
	"estaciones-meteorologicas-del-campus": profile(60, [
		["estacion", pick(["Campus Central", "Campus Norte", "Estación Tiquipaya", "Estación Sacaba"])],
		["fecha", date(2023, 2025)],
		["temperatura_c", dec(2, 31)],
		["humedad_pct", dec(25, 95)],
		["precipitacion_mm", dec(0, 42)],
	]),
	"resultados-de-las-olimpiadas-de-matematica-y-fisica": profile(80, [
		["gestion", int(2018, 2025)],
		["disciplina", pick(["Matemática", "Física"])],
		["nivel", pick(["Primaria", "Secundaria", "Universitario"])],
		["participantes", int(20, 600)],
		["puntaje_maximo", int(60, 100)],
	]),
	"uso-de-la-red-inalambrica-del-campus-por-facultad": profile(120, [
		["mes", (r) => `2025-${String(r.int(1, 12)).padStart(2, "0")}`],
		["facultad", pick(FACULTADES)],
		["usuarios_unicos", int(300, 6500)],
		["trafico_gb", int(800, 52_000)],
		["incidencias", int(0, 25)],
	]),
	"proyectos-de-grado-defendidos-en-ingenieria": profile(110, [
		["proyecto_id", seq("PG")],
		[
			"carrera",
			pick([
				"Ingeniería Civil",
				"Ingeniería de Sistemas",
				"Ingeniería Química",
				"Ingeniería Eléctrica",
			]),
		],
		["gestion", int(2015, 2025)],
		["modalidad", pick(["Tesis", "Proyecto de grado", "Trabajo dirigido"])],
		["calificacion", int(61, 100)],
	]),
	"calidad-del-agua-en-puntos-de-muestreo-del-valle": profile(100, [
		["punto_muestreo", seq("PM", 3)],
		["fecha", date(2022, 2025)],
		["ph", dec(6.2, 8.6)],
		["turbidez_ntu", dec(0.3, 18)],
		["coliformes_ufc", int(0, 1200)],
		["apta_consumo", pick(["Sí", "Sí", "No"])],
	]),
	"atenciones-del-policlinico-universitario-por-especialidad": profile(140, [
		["mes", (r) => `2025-${String(r.int(1, 12)).padStart(2, "0")}`],
		[
			"especialidad",
			pick(["Medicina general", "Odontología", "Psicología", "Nutrición", "Enfermería"]),
		],
		["atenciones", int(40, 1400)],
		["poblacion", pick(["Estudiantes", "Docentes", "Administrativos"])],
	]),
	"campanas-de-vacunacion-estudiantil": profile(70, [
		["campana", seq("CV", 3)],
		["gestion", int(2019, 2025)],
		["vacuna", pick(["Influenza", "Hepatitis B", "Tétanos", "COVID-19", "Fiebre amarilla"])],
		["facultad", pick(FACULTADES)],
		["dosis_aplicadas", int(30, 1800)],
	]),
	"practicas-clinicas-por-centro-de-salud": profile(90, [
		["gestion", int(2020, 2025)],
		["centro", pick(CENTROS_SALUD)],
		["carrera", pick(["Medicina", "Enfermería", "Odontología", "Nutrición"])],
		["estudiantes", int(4, 120)],
		["horas_semanales", pick([8, 12, 16, 20, 24])],
	]),
	"estado-nutricional-de-estudiantes-ingresantes": profile(100, [
		["gestion", int(2019, 2025)],
		["facultad", pick(FACULTADES)],
		["clasificacion", pick(["Bajo peso", "Normal", "Normal", "Sobrepeso", "Obesidad"])],
		["sexo", pick(["Femenino", "Masculino"])],
		["estudiantes", int(5, 260)],
	]),
	"cobertura-de-seguro-universitario-de-salud": profile(80, [
		["gestion", int(2018, 2025)],
		["facultad", pick(FACULTADES)],
		["afiliados", int(200, 5200)],
		["atenciones", int(100, 9000)],
		["cobertura_pct", dec(40, 98)],
	]),
	"egresados-de-enfermeria-por-gestion": profile(60, [
		["gestion", int(2010, 2025)],
		["nivel", pick(["Licenciatura", "Técnico superior"])],
		["sexo", pick(["Femenino", "Masculino"])],
		["egresados", int(5, 140)],
		["empleo_primer_anio_pct", dec(35, 92)],
	]),
	"produccion-de-semillas-nativas-en-estaciones-experimentales": profile(90, [
		["gestion", int(2017, 2025)],
		["estacion", pick(["Vinto", "Tiquipaya", "Sacaba", "Mizque", "Cliza"])],
		["especie", pick(["Quinua", "Maíz amiláceo", "Papa nativa", "Haba", "Tarwi"])],
		["produccion_kg", int(50, 9000)],
		["germinacion_pct", dec(60, 99)],
	]),
	"rendimiento-de-cultivos-por-parcela-experimental": profile(120, [
		["parcela", seq("PA", 3)],
		["campana", pick(["2022-2023", "2023-2024", "2024-2025"])],
		["cultivo", pick(CULTIVOS)],
		["superficie_ha", dec(0.2, 6)],
		["rendimiento_t_ha", dec(0.8, 28)],
	]),
	"estaciones-experimentales-y-superficie-cultivada": profile(30, [
		["estacion", seq("EE", 2)],
		["municipio", pick(["Vinto", "Tiquipaya", "Sacaba", "Cliza", "Punata", "Quillacollo"])],
		["superficie_ha", int(2, 180)],
		["altitud_msnm", int(2300, 3400)],
		["personal", int(2, 24)],
	]),
	"registro-de-especies-forestales-del-vivero-universitario": profile(80, [
		["especie_id", seq("EF", 3)],
		[
			"especie",
			pick(["Molle", "Queñua", "Jacarandá", "Algarrobo", "Eucalipto", "Pino radiata", "Tipa"]),
		],
		["origen", pick(["Nativa", "Nativa", "Introducida"])],
		["plantines", int(50, 5000)],
		["uso", pick(["Reforestación", "Ornamental", "Cortina rompevientos", "Investigación"])],
	]),
	"consumo-de-agua-de-riego-en-parcelas": profile(110, [
		["parcela", seq("PA", 3)],
		["mes", (r) => `2025-${String(r.int(1, 12)).padStart(2, "0")}`],
		["sistema", pick(["Goteo", "Aspersión", "Gravedad"])],
		["volumen_m3", int(40, 3800)],
		["eficiencia_pct", dec(35, 92)],
	]),
	"ensayos-de-fertilizacion-organica": profile(75, [
		["ensayo_id", seq("EN", 3)],
		["cultivo", pick(CULTIVOS)],
		["abono", pick(["Guano", "Compost", "Humus de lombriz", "Biol", "Testigo sin abono"])],
		["repeticiones", int(3, 6)],
		["incremento_rendimiento_pct", dec(-3, 38)],
	]),
	"personal-administrativo-por-unidad-y-cargo": profile(100, [
		["unidad", pick(UNIDADES)],
		["cargo", pick(["Jefatura", "Profesional", "Técnico", "Apoyo administrativo"])],
		["gestion", int(2020, 2025)],
		["funcionarios", int(2, 80)],
		["antiguedad_promedio_anios", dec(2, 22)],
	]),
	"ejecucion-del-plan-operativo-anual-por-unidad": profile(90, [
		["gestion", int(2019, 2025)],
		["unidad", pick(UNIDADES)],
		["actividades_programadas", int(8, 90)],
		[
			"actividades_cumplidas",
			(r, _i, row) => Math.round(row.actividades_programadas * r.float(0.5, 1)),
		],
		[
			"cumplimiento_pct",
			(_r, _i, row) => round2((row.actividades_cumplidas / row.actividades_programadas) * 100),
		],
	]),
	"solicitudes-de-informacion-publica-atendidas": profile(130, [
		["solicitud_id", seq("SI", 5)],
		["fecha", date(2022, 2025)],
		["canal", pick(["Presencial", "Correo electrónico", "Portal web"])],
		["tema", pick(["Presupuesto", "Matrícula", "Normativa", "Contrataciones", "Convenios"])],
		["dias_respuesta", int(1, 20)],
	]),
	"ingresos-propios-por-concepto-y-gestion": profile(70, [
		["gestion", int(2018, 2025)],
		[
			"concepto",
			pick(["Matrículas", "Servicios", "Alquileres", "Cursos de extensión", "Laboratorios"]),
		],
		["monto_bs", int(50_000, 4_500_000)],
		["variacion_pct", dec(-12, 25)],
	]),
	"contrataciones-y-adquisiciones-por-modalidad": profile(100, [
		["proceso_id", seq("CP", 4)],
		["gestion", int(2020, 2025)],
		[
			"modalidad",
			pick([
				"Apoyo nacional a la producción",
				"Contratación menor",
				"Licitación pública",
				"Contratación directa",
			]),
		],
		["monto_bs", int(5_000, 3_000_000)],
		["estado", pick(["Adjudicado", "Adjudicado", "Desierto", "En curso"])],
	]),
	"reclamos-y-sugerencias-recibidos-por-canal": profile(110, [
		["mes", (r) => `2025-${String(r.int(1, 12)).padStart(2, "0")}`],
		["canal", pick(["Buzón físico", "Correo electrónico", "Portal web", "Línea telefónica"])],
		["tipo", pick(["Reclamo", "Sugerencia", "Felicitación"])],
		["recibidos", int(1, 140)],
		["resueltos_pct", dec(40, 100)],
	]),
	"convocatorias-de-investigacion-y-proyectos-adjudicados": profile(80, [
		["convocatoria", seq("CI", 3)],
		["gestion", int(2018, 2025)],
		[
			"linea",
			pick(["Salud", "Agua y ambiente", "Tecnología", "Agropecuaria", "Ciencias sociales"]),
		],
		["postulaciones", int(5, 120)],
		["adjudicados", (r, _i, row) => Math.round(row.postulaciones * r.float(0.1, 0.5))],
		["monto_bs", int(60_000, 2_400_000)],
	]),
	"grupos-y-centros-de-investigacion-registrados": profile(45, [
		["grupo_id", seq("GI", 3)],
		["area", pick(AREAS)],
		["facultad", pick(FACULTADES)],
		["investigadores", int(3, 40)],
		["anio_creacion", int(1995, 2024)],
	]),
	"tesis-de-posgrado-defendidas-por-programa": profile(90, [
		["gestion", int(2015, 2025)],
		["nivel", pick(["Maestría", "Doctorado", "Especialidad"])],
		["facultad", pick(FACULTADES)],
		["tesis_defendidas", int(1, 45)],
		["duracion_promedio_meses", int(14, 60)],
	]),
	"eventos-cientificos-organizados-por-gestion": profile(70, [
		["evento_id", seq("EV", 3)],
		["gestion", int(2016, 2025)],
		["tipo", pick(["Congreso", "Seminario", "Taller", "Jornada científica"])],
		["asistentes", int(30, 900)],
		["ponencias", int(5, 140)],
	]),
	"patentes-y-registros-de-propiedad-intelectual": profile(50, [
		["registro_id", seq("PI", 3)],
		["anio", int(2012, 2025)],
		["tipo", pick(["Patente", "Derecho de autor", "Marca", "Modelo de utilidad"])],
		["area", pick(AREAS)],
		["estado", pick(["Concedido", "En trámite", "Concedido", "Abandonado"])],
	]),
	"colaboraciones-internacionales-de-investigacion-por-pais": profile(85, [
		["anio", int(2016, 2025)],
		["pais", pick(PAISES)],
		["area", pick(AREAS)],
		["proyectos_conjuntos", int(1, 14)],
		["publicaciones_conjuntas", int(0, 30)],
	]),
};

export const PROFILES = { ...BASE_PROFILES, ...MORE_PROFILES };

// ── Área de Cochabamba (RFC 7946: posición = [longitud, latitud]) ──

const LON_MIN = -66.3;
const LON_MAX = -66.05;
const LAT_MIN = -17.5;
const LAT_MAX = -17.3;

function round6(x) {
	return Math.round(x * 1e6) / 1e6;
}

const clamp = (x, min, max) => Math.min(max, Math.max(min, x));

function point(rnd) {
	return [round6(rnd.float(LON_MIN, LON_MAX)), round6(rnd.float(LAT_MIN, LAT_MAX))];
}

// ── Generación ──

const seedOf = (key) => createHash("sha256").update(key).digest().readUInt32BE(0);

function buildRows(profile, rnd) {
	return Array.from({ length: profile.rows }, (_, i) => {
		const row = {};
		for (const [name, make] of profile.columns) row[name] = make(rnd, i, row);
		return row;
	});
}

function geoFeatures(profile, rows, rnd) {
	if (profile.geo !== "routes") {
		return rows.slice(0, 40).map((properties) => ({
			type: "Feature",
			properties,
			geometry: { type: "Point", coordinates: point(rnd) },
		}));
	}
	// Líneas: caminata aleatoria acotada al área; paradas: puntos sueltos sobre las líneas.
	const lines = rows.map((properties) => {
		let [lon, lat] = point(rnd);
		const coordinates = [[lon, lat]];
		for (let step = 0; step < rnd.int(6, 10); step++) {
			lon = round6(clamp(lon + rnd.float(-0.012, 0.012), LON_MIN, LON_MAX));
			lat = round6(clamp(lat + rnd.float(-0.012, 0.012), LAT_MIN, LAT_MAX));
			coordinates.push([lon, lat]);
		}
		return { type: "Feature", properties, geometry: { type: "LineString", coordinates } };
	});
	const stops = Array.from({ length: 30 }, (_, i) => ({
		type: "Feature",
		properties: { parada: `Parada ${i + 1}`, linea: rnd.pick(rows).linea },
		geometry: { type: "Point", coordinates: point(rnd) },
	}));
	return [...lines, ...stops];
}

function wrap(text, maxChars) {
	const lines = [];
	let current = "";
	for (const word of text.split(" ")) {
		if (current && `${current} ${word}`.length > maxChars) {
			lines.push(current);
			current = word;
		} else current = current ? `${current} ${word}` : word;
	}
	if (current) lines.push(current);
	return lines;
}

function pdfDocument({ title, description, profile }, rows) {
	const page = new Page();
	page.text(MARGIN, 40, "UMSS · Portal de Datos Abiertos", { size: 9, gray: 0.35 });
	page.line(MARGIN, 48, PAGE_WIDTH - MARGIN, 48, { gray: 0.6 });

	let y = 100;
	for (const line of wrap(title, 40)) {
		page.text(MARGIN, y, line, { size: 20, bold: true });
		y += 26;
	}
	page.text(MARGIN, y, "Datos ficticios para demostración", { size: 13, gray: 0.35 });
	y += 22;
	page.fillRect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, 30, 0.93);
	page.text(MARGIN + 10, y + 19, FICTITIOUS_NOTE, { size: 10, bold: true });
	y += 64;

	page.text(MARGIN, y, "Descripción", { size: 14, bold: true });
	y = page.paragraph(
		MARGIN,
		y + 24,
		`Documento de muestra generado para probar la vista previa de PDF del portal sin conexión a internet. ${description}`,
	);

	const names = profile.columns.map(([name]) => name);
	page.text(MARGIN, y + 20, "Variables", { size: 14, bold: true });
	y = page.paragraph(MARGIN, y + 44, `${names.join(", ")}.`);

	// Muestra: las primeras filas y las primeras cuatro columnas, recortadas al ancho de la celda.
	const shown = names.slice(0, 4);
	const colWidth = (PAGE_WIDTH - 2 * MARGIN - 16) / shown.length;
	const maxChars = Math.floor(colWidth / 5.6);
	const cut = (value) => String(value).slice(0, maxChars);
	page.text(MARGIN, y + 20, "Muestra de registros", { size: 14, bold: true });
	const end = page.table(
		y + 36,
		shown.map((header, c) => ({ header: cut(header), x: MARGIN + 8 + c * colWidth })),
		rows.slice(0, 6).map((row) => shown.map((name) => cut(row[name]))),
		{ rowHeight: 20 },
	);
	page.text(MARGIN, end + 18, "Primeros 6 registros. Datos ficticios.", { size: 8.5, gray: 0.35 });

	page.line(MARGIN, 790, PAGE_WIDTH - MARGIN, 790, { gray: 0.6 });
	page.text(MARGIN, 804, "Datos ficticios para demostración · no son datos oficiales de la UMSS", {
		size: 8.5,
		gray: 0.35,
	});
	const label = "Página 1 de 1";
	page.text(PAGE_WIDTH - MARGIN - textWidth(label, 8.5), 804, label, { size: 8.5, gray: 0.35 });
	return page;
}

function textDocument({ title, description, profile }, rows) {
	const names = profile.columns.map(([name]) => name);
	return [
		"UMSS · Portal de Datos Abiertos",
		"",
		title,
		"=".repeat(Math.min(title.length, 72)),
		"",
		FICTITIOUS_NOTE,
		"",
		"Descripción",
		...wrap(description, 78),
		"",
		"Variables",
		...names.map((name) => `  - ${name}`),
		"",
		`Registros de muestra (${Math.min(rows.length, 5)} de ${rows.length}):`,
		...rows.slice(0, 5).map((row) => `  ${names.map((n) => row[n]).join(" | ")}`),
		"",
	].join("\n");
}

/**
 * Bytes del archivo ficticio de un recurso del seed.
 * `spec`: `{ datasetName, resourceName, title, description, profile, format }`, con `profile` una
 * clave de `PROFILES` y `format` una de `FORMAT_INFO`.
 */
export function generateFile(spec) {
	const profile = PROFILES[spec.profile];
	if (!profile) throw new Error(`Perfil desconocido: ${spec.profile}`);
	if (!FORMAT_INFO[spec.format]) throw new Error(`Formato no soportado: ${spec.format}`);
	const rnd = makeRandom(seedOf(`${spec.datasetName}|${spec.format}|${spec.resourceName}`));
	const rows = buildRows(profile, rnd);
	const names = profile.columns.map(([name]) => name);

	switch (spec.format) {
		case "CSV": {
			const text = rows.map((row) => Object.fromEntries(names.map((n) => [n, String(row[n])])));
			return Buffer.from(formatCsv(text, names), "utf8");
		}
		case "JSON":
			return Buffer.from(`${JSON.stringify(rows, null, 2)}\n`, "utf8");
		case "GeoJSON": {
			const collection = {
				type: "FeatureCollection",
				name: spec.title,
				nota: FICTITIOUS_NOTE,
				features: geoFeatures(profile, rows, rnd),
			};
			return Buffer.from(`${JSON.stringify(collection, null, 1)}\n`, "utf8");
		}
		case "XLSX":
			return buildXlsx([
				{ name: "Datos", header: names, rows: rows.map((row) => names.map((n) => row[n])) },
				{ name: "Nota", header: ["Nota"], rows: [[FICTITIOUS_NOTE], [spec.title]] },
			]);
		case "TXT":
			return Buffer.from(textDocument({ ...spec, profile }, rows), "utf8");
		case "PNG":
			return encodePng(drawChart(rnd));
		case "JPG":
			return encodeJpeg(drawChart(rnd));
		case "PDF":
			return buildPdf([pdfDocument({ ...spec, profile }, rows)], {
				title: `${spec.title} - Datos ficticios para demostración`,
				author: "Equipo ODP (datos sintéticos)",
				subject: FICTITIOUS_NOTE,
				producer: "scripts/generate-demo-files.mjs",
			});
	}
}
