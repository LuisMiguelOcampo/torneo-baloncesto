// ==========================================================================
// 1. CONFIGURACIÓN E INICIALIZACIÓN DE SUPABASE (VERSIÓN ISOLADA)
// ==========================================================================
const SUPABASE_URL = 'https://vzouznekqycalzgswxos.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_Tm-IBIr0gRvjTWFhF5LNuQ_rMsgP3vo'; // Reemplaza con tu llave real

let supabaseClient = null;

// Forzar la detección del objeto global correcto según el CDN usado
try {
    if (typeof window.supabase !== 'undefined') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else if (typeof supabaseServer !== 'undefined') {
        supabaseClient = supabaseServer.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else if (typeof supabase !== 'undefined' && supabase.createClient) {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.error("❌ No se encontró ninguna variable global de Supabase. Revisa el script en tu HTML.");
    }
} catch (error) {
    console.error("❌ Error crítico al inicializar el cliente de Supabase:", error.message);
}

// ==========================================================================
// 2. DETECTOR DE CARGA DE DOCUMENTO
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Si no se pudo inicializar Supabase, mostrar error visual de inmediato
    if (!supabaseClient) {
        const selector = document.getElementById('categoria-select');
        if (selector) selector.innerHTML = '<option value="">Error: Librería no cargada</option>';
        return;
    }
    
    inicializarSelectorTorneos();
    configurarNavegacionPestañas();
});

/**
 * Consulta las categorías de torneos existentes y monta el menú desplegable
 */
async function inicializarSelectorTorneos() {
    const selector = document.getElementById('categoria-select');
    if (!selector) return;

    try {
        // Hacemos la consulta usando el cliente verificado
        const { data: torneos, error } = await supabaseClient
            .from('torneos')
            .select('*')
            .order('nombre', { ascending: true });

        if (error) throw error;

        // Limpiar el estado de "Cargando..."
        selector.innerHTML = '<option value="" class="text-gray-800">-- Selecciona una Categoría --</option>';
        
        if (!torneos || torneos.length === 0) {
            selector.innerHTML = '<option value="">No hay torneos activos</option>';
            return;
        }

        // Inyectar las opciones
        torneos.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.nombre;
            opt.className = "text-gray-800";
            selector.appendChild(opt);
        });

        // Escuchar cambios de categoría
        selector.addEventListener('change', (e) => {
            const torneoId = e.target.value;
            if (torneoId) {
                cargarPanelEstadistico(torneoId);
            } else {
                limpiarContenedores();
            }
        });

    } catch (err) {
        console.error("❌ Error al cargar torneos desde la Base de Datos:", err.message);
        selector.innerHTML = '<option value="">Error al conectar con la BD</option>';
    }
}

// ==========================================================================
// 3. DESPACHADOR CENTRAL DE DATOS
// ==========================================================================
async function cargarPanelEstadistico(torneoId) {
    await Promise.all([
        calcularTablaPosiciones(torneoId),
        calcularLideresIndividuales(torneoId),
        construirCalendariosYResultados(torneoId)
    ]);
}

// ==========================================================================
// 4. TABLA DE POSICIONES
// ==========================================================================
async function calcularTablaPosiciones(torneoId) {
    const tbody = document.getElementById('tabla-posiciones-body');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="8" class="text-center p-8 text-gray-400 font-medium">Cargando datos...</td></tr>`;

    try {
        const { data: equipos, error: errEq } = await supabaseClient
            .from('equipos')
            .select('*')
            .eq('torneo_id', torneoId);

        const { data: partidos, error: errPt } = await supabaseClient
            .from('partidos')
            .select('*')
            .eq('torneo_id', torneoId)
            .eq('estado', 'finalizado');

        if (errEq || errPt) throw new Error(errEq?.message || errPt?.message);

        const registros = {};
        equipos.forEach(e => {
            registros[e.id] = {
                nombre: e.nombre, logo: e.logo_url,
                pj: 0, pg: 0, pp: 0, pf: 0, pc: 0, pts: 0
            };
        });

        partidos.forEach(p => {
            const loc = registros[p.equipo_local_id];
            const vis = registros[p.equipo_visitante_id];

            if (loc && vis) {
                const scL = p.puntos_local || 0;
                const scV = p.puntos_visitante || 0;

                loc.pj += 1; vis.pj += 1;
                loc.pf += scL; loc.pc += scV;
                vis.pf += scV; vis.pc += scL;

                if (scL > scV) {
                    loc.pg += 1; loc.pts += 2;
                    vis.pp += 1; vis.pts += 1;
                } else if (scV > scL) {
                    vis.pg += 1; vis.pts += 2;
                    loc.pp += 1; loc.pts += 1;
                }
            }
        });

        const clasificacion = Object.values(registros).sort((a, b) => {
            if (b.pts !== a.pts) return b.pts - a.pts;
            return (b.pf - b.pc) - (a.pf - a.pc);
        });

        tbody.innerHTML = '';
        if (clasificacion.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center p-8 text-gray-400">No hay equipos registrados en esta categoría.</td></tr>`;
            return;
        }

        clasificacion.forEach((eq, idx) => {
            const tr = document.createElement('tr');
            tr.className = "border-b border-gray-100 hover:bg-gray-50/50 transition-colors";
            tr.innerHTML = `
                <td class="p-4 text-center font-bold text-gray-500">${idx + 1}</td>
                <td class="p-4 font-bold text-gray-800 flex items-center gap-3">
                    ${eq.logo ? `<img src="${eq.logo}" class="w-6 h-6 object-contain rounded">` : '🛡️'}
                    <span>${eq.nombre}</span>
                </td>
                <td class="p-4 text-center text-gray-600">${eq.pj}</td>
                <td class="p-4 text-center text-emerald-600 font-bold">${eq.pg}</td>
                <td class="p-4 text-center text-red-600 font-bold">${eq.pp}</td>
                <td class="p-4 text-center text-gray-600">${eq.pf}</td>
                <td class="p-4 text-center text-gray-600">${eq.pc}</td>
                <td class="p-4 text-center font-extrabold bg-amber-50/70 text-amber-900 rounded-lg">${eq.pts}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="8" class="text-center p-8 text-red-500 font-semibold">❌ Error de conexión: ${err.message}</td></tr>`;
    }
}

// ==========================================================================
// 5. LÍDERES INDIVIDUALES
// ==========================================================================
async function calcularLideresIndividuales(torneoId) {
    try {
        const { data: stats, error } = await supabaseClient
            .from('estadisticas_partido')
            .select(`
                puntos, triples, asistencias,
                jugadores (nombre_jugador, equipos (nombre, torneo_id))
            `);

        if (error) throw error;

        const registrosTorneo = stats.filter(s => s.jugadores?.equipos?.torneo_id == torneoId);
        const acumuladoJugadores = {};

        registrosTorneo.forEach(s => {
            const nombre = s.jugadores.nombre_jugador;
            const equipoNom = s.jugadores.equipos.nombre;

            if (!acumuladoJugadores[nombre]) {
                acumuladoJugadores[nombre] = { nombre, equipo: equipoNom, puntos: 0, triples: 0, asistencias: 0 };
            }
            acumuladoJugadores[nombre].puntos += s.puntos || 0;
            acumuladoJugadores[nombre].triples += s.triples || 0;
            acumuladoJugadores[nombre].asistencias += s.asistencias || 0;
        });

        const listado = Object.values(acumuladoJugadores);

        inyectarFilasTop(listado, 'puntos', 'contenedor-lideres-puntos', 'Pts');
        inyectarFilasTop(listado, 'triples', 'contenedor-lideres-triples', 'Triples');
        inyectarFilasTop(listado, 'asistencias', 'contenedor-lideres-asistencias', 'Asist');

    } catch (err) {
        console.error("Error al procesar líderes:", err);
    }
}

function inyectarFilasTop(lista, metrica, idContenedor, tag) {
    const contenedor = document.getElementById(idContenedor);
    if (!contenedor) return;

    const top3 = lista.filter(j => j[metrica] > 0).sort((a, b) => b[metrica] - a[metrica]).slice(0, 3);

    contenedor.innerHTML = '';
    if (top3.length === 0) {
        contenedor.innerHTML = `<p class="text-xs text-center text-gray-400 py-4">Sin registros</p>`;
        return;
    }

    top3.forEach((j, i) => {
        const div = document.createElement('div');
        div.className = "flex justify-between items-center text-xs py-2 border-b border-gray-50 last:border-0";
        div.innerHTML = `
            <div class="truncate pr-2">
                <span class="font-bold text-gray-400 mr-1">#${i + 1}</span>
                <span class="font-bold text-gray-700">${j.nombre}</span>
                <span class="text-[10px] text-gray-400 block truncate font-medium">${j.equipo}</span>
            </div>
            <div class="font-black text-amber-700 bg-amber-50 border border-amber-200/40 px-2 py-1 rounded-md shrink-0">
                ${j[metrica]} <span class="text-[9px] font-bold text-amber-500 uppercase">${tag}</span>
            </div>
        `;
        contenedor.appendChild(div);
    });
}

// ==========================================================================
// 6. PRÓXIMOS ENCUENTROS E HISTORIAL
// ==========================================================================
async function construirCalendariosYResultados(torneoId) {
    try {
        const { data: partidos, error: errP } = await supabaseClient
            .from('partidos')
            .select('*')
            .eq('torneo_id', torneoId)
            .order('fecha_hora', { ascending: true });

        const { data: equipos, error: errE } = await supabaseClient
            .from('equipos')
            .select('id, nombre, logo_url')
            .eq('torneo_id', torneoId);

        if (errP || errE) throw new Error("Error trayendo encuentros");

        const mapaEquipos = {};
        equipos.forEach(e => { mapaEquipos[e.id] = e; });

        const contProximos = document.getElementById('contenedor-proximos');
        const contHistorial = document.getElementById('contenedor-historial');

        contProximos.innerHTML = '';
        contHistorial.innerHTML = '';

        let flagProx = false, flagHist = false;

        partidos.forEach(p => {
            const loc = mapaEquipos[p.equipo_local_id] || { nombre: 'Por definir', logo_url: '' };
            const vis = mapaEquipos[p.equipo_visitante_id] || { nombre: 'Por definir', logo_url: '' };
            
            const fecha = new Date(p.fecha_hora).toLocaleString('es-ES', { 
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
            });

            const cardHTML = `
                <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-3">
                    <div class="flex justify-between items-center text-[10px] text-gray-400 font-bold border-b border-gray-50 pb-2">
                        <span>📅 ${fecha}</span>
                        <span class="truncate max-w-[180px]">📍 ${p.cancha || 'Gimnasio Municipal'}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-2 w-5/12 overflow-hidden">
                            ${loc.logo_url ? `<img src="${loc.logo_url}" class="w-5 h-5 object-contain shrink-0">` : '🛡️'}
                            <span class="font-bold text-xs text-gray-700 truncate">${loc.nombre}</span>
                        </div>
                        <div class="w-2/12 text-center shrink-0">
                            ${p.estado === 'finalizado'
                                ? `<span class="bg-slate-900 text-white font-black text-xs px-2 py-1 rounded-md">${p.puntos_local}-${p.puntos_visitante}</span>`
                                : `<span class="text-gray-300 font-extrabold text-xs tracking-wider">VS</span>`
                            }
                        </div>
                        <div class="flex items-center gap-2 w-5/12 justify-end text-right overflow-hidden">
                            <span class="font-bold text-xs text-gray-700 truncate">${vis.nombre}</span>
                            ${vis.logo_url ? `<img src="${vis.logo_url}" class="w-5 h-5 object-contain shrink-0">` : '🛡️'}
                        </div>
                    </div>
                </div>
            `;

            if (p.estado === 'finalizado') {
                contHistorial.insertAdjacentHTML('beforeend', cardHTML);
                flagHist = true;
            } else {
                contProximos.insertAdjacentHTML('beforeend', cardHTML);
                flagProx = true;
            }
        });

        if (!flagProx) contProximos.innerHTML = `<p class="text-xs text-gray-400 text-center py-6 bg-white rounded-xl border border-dashed border-gray-200">No hay partidos programados</p>`;
        if (!flagHist) contHistorial.innerHTML = `<p class="text-xs text-gray-400 text-center py-6 bg-white rounded-xl border border-dashed border-gray-200">No se registran partidos jugados</p>`;

    } catch (err) {
        console.error(err);
    }
}

// ==========================================================================
// 7. COMPONENTES AUXILIARES / INTERFAZ
// ==========================================================================
function configurarNavegacionPestañas() {
    const links = document.querySelectorAll('nav a');
    links.forEach(link => {
        link.addEventListener('click', function() {
            links.forEach(l => l.classList.remove('tab-active'));
            this.classList.add('tab-active');
        });
    });
    if (links.length > 0) links[0].classList.add('tab-active');
}

function limpiarContenedores() {
    document.getElementById('tabla-posiciones-body').innerHTML = `<tr><td colspan="8" class="text-center p-8 text-gray-400">Selecciona una categoría arriba.</td></tr>`;
    ['contenedor-lideres-puntos', 'contenedor-lideres-triples', 'contenedor-lideres-asistencias'].forEach(id => {
        document.getElementById(id).innerHTML = `<p class="text-xs text-gray-400 text-center py-4">Selecciona una categoría</p>`;
    });
    document.getElementById('contenedor-proximos').innerHTML = `<p class="text-xs text-gray-400 py-4">Selecciona una categoría</p>`;
    document.getElementById('contenedor-historial').innerHTML = `<p class="text-xs text-gray-400 py-4">Selecciona una categoría</p>`;
}