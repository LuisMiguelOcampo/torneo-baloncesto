const SUPABASE_URL = 'https://vzouznekqycalzgswxos.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_Tm-IBIr0gRvjTWFhF5LNuQ_rMsgP3vo';


const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.addEventListener('load', async () => {
    await cargarFiltroTorneosPublico();
});

async function cargarFiltroTorneosPublico() {
    try {
        const { data: torneos, error } = await supabaseClient.from('torneos').select('*');
        if (error) throw error;

        const select = document.getElementById('categoria-select'); 
        if (!select) return;

        select.innerHTML = '<option value="">-- Seleccione Categoría --</option>';
        if (torneos && torneos.length > 0) {
            torneos.forEach(t => {
                select.innerHTML += `<option value="${t.id}">${t.nombre}</option>`;
            });
            select.value = torneos[0].id;
            await cargarDashboardPublico(torneos[0].id);
        }

        select.addEventListener('change', (e) => {
            if (e.target.value) cargarDashboardPublico(e.target.value);
        });

    } catch (err) {
        console.error("Error cargando categorías en app.js:", err.message);
    }
}

function formatearFechaTexto(fechaString) {
    if (!fechaString) return "Fecha no asignada";
    
    const partes = fechaString.split('T');
    const fechaPura = partes[0]; 
    const horaPura = partes[1] ? partes[1].substring(0, 5) : "00:00"; 
    
    const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const [anio, mes, dia] = fechaPura.split('-');
    
    return `${dia} ${meses[parseInt(mes, 10) - 1]}, ${horaPura}`;
}

async function cargarDashboardPublico(torneoId) {
    try {
        const [resPartidos, resJugadores, resEstadisticas] = await Promise.all([
            // 🌟 Agregado 'comentario' a la consulta select de partidos
            supabaseClient.from('partidos').select(`
                id, fecha_hora, cancha, estado, puntos_local, puntos_visitante, comentario,
                local:equipos!equipo_local_id(id, nombre, logo_url), 
                visitante:equipos!equipo_visitante_id(id, nombre, logo_url)
            `).eq('torneo_id', torneoId),
            supabaseClient.from('jugadores').select(`
                id, nombre_jugador, equipo_id, equipo:equipos(nombre)
            `),
            supabaseClient.from('estadisticas_partido').select('*')
        ]);

        if (resPartidos.error) throw resPartidos.error;

        const partidos = resPartidos.data || [];
        const jugadores = resJugadores.data || [];
        let estadisticas = resEstadisticas.data || [];

        const partidosIds = partidos.map(p => p.id);
        estadisticas = estadisticas.filter(est => partidosIds.includes(est.partido_id));

        const partidosOrdenados = partidos.sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));

        const proximos = partidosOrdenados.filter(p => p.estado.toLowerCase() === 'programado');
        const jugados = partidosOrdenados.filter(p => p.estado.toLowerCase() === 'finalizado');

        renderProximosEncuentros(proximos);
        renderHistorialResultados(jugados);

        calcularTablaPosiciones(jugados, torneoId);
        calcularLideresIndividuales(estadisticas, jugadores);

    } catch (err) {
        console.error("Error al procesar dashboard en app.js:", err.message);
    }
}

function renderProximosEncuentros(partidos) {
    const contenedor = document.getElementById('contenedor-proximos'); 
    if (!contenedor) return;
    contenedor.innerHTML = '';

    if (partidos.length === 0) {
        contenedor.innerHTML = '<p class="text-sm text-slate-400 italic p-4 text-center">No hay partidos programados.</p>';
        return;
    }

    partidos.forEach(p => {
        const logoLocal = p.local?.logo_url || 'https://placehold.co/30x30/png?text=🏀';
        const logoVisitante = p.visitante?.logo_url || 'https://placehold.co/30x30/png?text=🏀';

        // Renderizado condicional del badge de comentario si existe
        const badgeComentario = p.comentario 
            ? `<span class="bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold px-2 py-0.5 rounded text-[10px] uppercase shadow-sm">${p.comentario}</span>` 
            : '';

        contenedor.innerHTML += `
            <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm mb-3 flex flex-col gap-2 text-xs">
                <div class="flex justify-between items-center border-b border-slate-50 pb-1.5">
                    <div>
                        <span class="text-indigo-600 font-bold block">📅 ${formatearFechaTexto(p.fecha_hora)}</span>
                        <span class="text-slate-400 block">📍 ${p.cancha}</span>
                    </div>
                    ${badgeComentario}
                </div>
                <div class="flex justify-between items-center font-bold text-slate-800 text-sm py-1">
                    <div class="flex items-center gap-1.5 justify-end w-28">
                        <span class="truncate">${p.local?.nombre || 'Equipo'}</span>
                        <img src="${logoLocal}" class="w-5 h-5 rounded-full object-cover border border-slate-100">
                    </div>
                    <span class="text-slate-300 text-xs font-normal">VS</span>
                    <div class="flex items-center gap-1.5 justify-start w-28">
                        <img src="${logoVisitante}" class="w-5 h-5 rounded-full object-cover border border-slate-100">
                        <span class="truncate">${p.visitante?.nombre || 'Equipo'}</span>
                    </div>
                </div>
            </div>
        `;
    });
}

function renderHistorialResultados(partidos) {
    const contenedor = document.getElementById('contenedor-historial'); 
    if (!contenedor) return;
    contenedor.innerHTML = '';

    if (partidos.length === 0) {
        contenedor.innerHTML = '<p class="text-sm text-slate-400 italic p-4 text-center">No se registran partidos jugados.</p>';
        return;
    }

    partidos.forEach(p => {
        const logoLocal = p.local?.logo_url || 'https://placehold.co/40x40/png?text=🏀';
        const logoVisitante = p.visitante?.logo_url || 'https://placehold.co/40x40/png?text=🏀';
        
        const ptsL = p.puntos_local || 0;
        const ptsV = p.puntos_visitante || 0;

        const ganoLocal = ptsL > ptsV;
        const ganoVisitante = ptsV > ptsL;

        // Renderizado condicional del badge de comentario si existe
        const badgeComentario = p.comentario 
            ? `<span class="bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded text-[9px] uppercase tracking-wider shadow-sm border border-amber-200">${p.comentario}</span>` 
            : '';

        contenedor.innerHTML += `
            <div class="bg-gradient-to-r from-slate-50 to-white p-4 rounded-xl border border-slate-200/80 shadow-sm mb-1 flex flex-col gap-2.5">
                <div class="flex justify-between items-center text-[10px] text-slate-400 border-b border-slate-100 pb-1.5 font-medium">
                    <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Finalizado</span>
                    <div class="flex items-center gap-2">
                        ${badgeComentario}
                        <span>Ob🕒 ${formatearFechaTexto(p.fecha_hora)} | 📍 ${p.cancha}</span>
                    </div>
                </div>
                
                <div class="grid grid-cols-7 items-center text-xs">
                    <div class="col-span-3 flex items-center gap-2 justify-end text-right pr-1">
                        <span class="truncate font-bold ${ganoLocal ? 'text-slate-900 font-black' : 'text-slate-500'}">${p.local?.nombre || 'Equipo'}</span>
                        <img src="${logoLocal}" class="w-7 h-7 rounded-full object-cover shadow-sm border border-slate-200 shrink-0">
                    </div>
                    
                    <div class="col-span-1 flex justify-center items-center gap-1 bg-slate-100 py-1 px-2 rounded-lg font-mono font-black text-sm text-slate-800 shadow-inner">
                        <span class="${ganoLocal ? 'text-indigo-600 scale-105' : 'text-slate-600'}">${ptsL}</span>
                        <span class="text-slate-300 font-normal text-xs">:</span>
                        <span class="${ganoVisitante ? 'text-indigo-600 scale-105' : 'text-slate-600'}">${ptsV}</span>
                    </div>
                    
                    <div class="col-span-3 flex items-center gap-2 justify-start text-left pl-1">
                        <img src="${logoVisitante}" class="w-7 h-7 rounded-full object-cover shadow-sm border border-slate-200 shrink-0">
                        <span class="truncate font-bold ${ganoVisitante ? 'text-slate-900 font-black' : 'text-slate-500'}">${p.visitante?.nombre || 'Equipo'}</span>
                    </div>
                </div>
            </div>
        `;
    });
}

async function calcularTablaPosiciones(partidosJugados, torneoId) {
    const tbody = document.getElementById('tabla-posiciones-body'); 
    if (!tbody) return;
    tbody.innerHTML = '';

    try {
        const { data: equipos } = await supabaseClient.from('equipos').select('*').eq('torneo_id', torneoId);
        if (!equipos) return;

        const tabla = {};
        equipos.forEach(eq => {
            tabla[eq.id] = { nombre: eq.nombre, logo: eq.logo_url, pj: 0, pg: 0, pp: 0, pf: 0, pc: 0, pts: 0 };
        });

        partidosJugados.forEach(p => {
            const idL = p.local?.id;
            const idV = p.visitante?.id;
            const ptsL = p.puntos_local || 0;
            const ptsV = p.puntos_visitante || 0;

            if (tabla[idL] && tabla[idV]) {
                tabla[idL].pj++; tabla[idV].pj++;
                tabla[idL].pf += ptsL; tabla[idL].pc += ptsV;
                tabla[idV].pf += ptsV; tabla[idV].pc += ptsL;

                if (ptsL > ptsV) {
                    tabla[idL].pg++; tabla[idL].pts += 2; 
                    tabla[idV].pp++; tabla[idV].pts += 1; 
                } else {
                    tabla[idV].pg++; tabla[idV].pts += 2;
                    tabla[idL].pp++; tabla[idL].pts += 1;
                }
            }
        });

        const ordenados = Object.values(tabla).sort((a, b) => b.pts - a.pts || (b.pf - b.pc) - (a.pf - a.pc));

        ordenados.forEach((eq, index) => {
            tbody.innerHTML += `
                <tr class="border-b border-slate-100 text-xs font-semibold text-slate-700">
                    <td class="p-3 text-center text-slate-400 font-bold">${index + 1}</td>
                    <td class="p-3 flex items-center gap-2">
                        <img src="${eq.logo || 'https://placehold.co/30x30/png?text=🏀'}" class="w-6 h-6 rounded-full object-cover border">
                        <span>${eq.nombre}</span>
                    </td>
                    <td class="p-3 text-center">${eq.pj}</td>
                    <td class="p-3 text-center text-emerald-600">${eq.pg}</td>
                    <td class="p-3 text-center text-red-500">${eq.pp}</td>
                    <td class="p-3 text-center">${eq.pf}</td>
                    <td class="p-3 text-center">${eq.pc}</td>
                    <td class="p-3 text-center font-black text-slate-900 bg-slate-50/50">${eq.pts}</td>
                </tr>
            `;
        });
    } catch (err) { console.error(err); }
}

function calcularLideresIndividuales(estadisticas, jugadores) {
    const totales = {};
    
    estadisticas.forEach(est => {
        if (!totales[est.jugador_id]) totales[est.jugador_id] = { pts: 0, tri: 0, ast: 0 };
        totales[est.jugador_id].pts += est.puntos || 0;
        totales[est.jugador_id].tri += est.triples || 0;
        totales[est.jugador_id].ast += est.asistencias || 0;
    });

    const mapeoJugadores = {};
    jugadores.forEach(j => { mapeoJugadores[j.id] = { nombre: j.nombre_jugador, equipo: j.equipo?.nombre || 'Club' }; });

    renderLiderEstructural('lista-lideres-puntos', totales, mapeoJugadores, 'pts', 'PTS');
    renderLiderEstructural('lista-lideres-triples', totales, mapeoJugadores, 'tri', 'TRIPLES');
    renderLiderEstructural('lista-lideres-asistencias', totales, mapeoJugadores, 'ast', 'ASIST');
}

function renderLiderEstructural(idContenedor, totales, mapeo, campo, sufijo) {
    const el = document.getElementById(idContenedor);
    if (!el) return; 
    el.innerHTML = ''; 

    const ordenados = Object.keys(totales)
        .map(jId => ({ id: jId, valor: totales[jId][campo], ...mapeo[jId] }))
        .filter(j => j.nombre && j.valor > 0)
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 5); // Renderiza el Top 5 perfectamente

    if (ordenados.length === 0) {
        el.innerHTML = '<p class="text-xs text-slate-400 italic p-2 text-center">Sin registros en este torneo</p>';
        return;
    }

    ordenados.forEach((jug, idx) => {
        el.innerHTML += `
            <div class="flex justify-between items-center text-xs border-b border-slate-50 py-1.5 font-medium">
                <div>
                    <span class="text-slate-400 font-bold mr-1">#${idx+1}</span>
                    <span class="text-slate-800 font-bold">${jug.nombre}</span>
                    <span class="text-[10px] text-slate-400 block">${jug.equipo}</span>
                </div>
                <span class="bg-amber-50 text-amber-700 font-black px-2 py-0.5 rounded-md text-[10px]">${jug.valor} ${sufijo}</span>
            </div>
        `;
    });
}