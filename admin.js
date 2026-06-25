// ==========================================================================
// CONFIGURACIÓN DE CONEXIÓN A SUPABASE
// ==========================================================================
const SUPABASE_URL = 'https://vzouznekqycalzgswxos.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_Tm-IBIr0gRvjTWFhF5LNuQ_rMsgP3vo'; // Reemplázala por tu clave real

const supabaseAdmin = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
    cargarSelectoresDeTorneos();
    listarTorneosAdmin();
    configurarEscuchadoresFormularios();
});

// ==========================================================================
// CARGA DE SELECTORES E INSTANCIAS INICIALES
// ==========================================================================
async function cargarSelectoresDeTorneos() {
    try {
        const { data: torneos, error } = await supabaseAdmin
            .from('torneos')
            .select('*')
            .order('nombre', { ascending: true });

        if (error) throw error;

        const selectEq = document.getElementById('equipo-torneo-select');
        const selectPt = document.getElementById('partido-torneo-select');
        const filtroEq = document.getElementById('filtro-torneo-equipos');
        const filtroPt = document.getElementById('filtro-torneo-partidos');

        const rellenar = (elemento, textoDefecto) => {
            elemento.innerHTML = `<option value="">${textoDefecto}</option>`;
            torneos.forEach(t => {
                elemento.insertAdjacentHTML('beforeend', `<option value="${t.id}">${t.nombre}</option>`);
            });
        };

        rellenar(selectEq, "Seleccionar Torneo");
        rellenar(selectPt, "Seleccionar Torneo");
        rellenar(filtroEq, "Filtrar por Torneo...");
        rellenar(filtroPt, "Filtrar por Torneo...");

    } catch (err) {
        console.error("Error al inicializar categorías:", err.message);
    }
}

function configurarEscuchadoresFormularios() {
    document.getElementById('form-crear-torneo').addEventListener('submit', guardarNuevoTorneo);
    document.getElementById('form-modal-torneo').addEventListener('submit', actualizarDatosTorneo);
    document.getElementById('form-crear-equipo').addEventListener('submit', guardarEquipoVacio);
    document.getElementById('form-crear-partido').addEventListener('submit', guardarNuevoPartido);
    document.getElementById('form-modal-equipo').addEventListener('submit', actualizarDatosEquipo);
    document.getElementById('form-finalizar-partido').addEventListener('submit', procesarCierreDePartido);

    document.getElementById('partido-torneo-select').addEventListener('change', (e) => {
        if (e.target.value) cargarEquiposParaPartido(e.target.value);
    });
    document.getElementById('filtro-torneo-equipos').addEventListener('change', (e) => {
        if (e.target.value) listarEquiposAdmin(e.target.value);
    });
    document.getElementById('filtro-torneo-partidos').addEventListener('change', (e) => {
        if (e.target.value) listarPartidosAdmin(e.target.value);
    });
}

// ==========================================================================
// GESTIÓN DE TORNEOS (CREACIÓN, EDICIÓN Y ELIMINACIÓN)
// ==========================================================================
async function guardarNuevoTorneo(e) {
    e.preventDefault();
    const nombre = document.getElementById('torneo-nombre').value.trim();

    try {
        const { error } = await supabaseAdmin.from('torneos').insert([{ nombre: nombre, estado: 'activo' }]);
        if (error) throw error;

        alert('🏆 Torneo registrado correctamente.');
        document.getElementById('form-crear-torneo').reset();
        
        cargarSelectoresDeTorneos();
        listarTorneosAdmin(); 
    } catch (err) {
        alert('Error al registrar torneo: ' + err.message);
    }
}

async function listarTorneosAdmin() {
    const tbody = document.getElementById('lista-torneos-table');
    tbody.innerHTML = '<tr><td colspan="2" class="p-3 text-center text-slate-400">Cargando...</td></tr>';

    try {
        const { data: torneos, error } = await supabaseAdmin
            .from('torneos')
            .select('*')
            .order('nombre', { ascending: true });

        if (error) throw error;

        tbody.innerHTML = '';
        if (torneos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" class="p-3 text-center text-slate-400">Sin torneos creados.</td></tr>';
            return;
        }

        torneos.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="p-2.5 font-bold text-slate-700 truncate max-w-[120px]">🏆 ${t.nombre}</td>
                <td class="p-2.5 text-right flex justify-end gap-1">
                    <button onclick="abrirModalEdicionTorneo('${t.id}', '${t.nombre}')" class="bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded-md text-xs font-bold cursor-pointer transition-all">Editar</button>
                    <button onclick="eliminarTorneoCompleto('${t.id}')" class="bg-red-600 hover:bg-red-700 text-white px-1.5 py-0.5 rounded-md text-xs font-bold cursor-pointer transition-all">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="2" class="p-3 text-center text-red-500">Error: ${err.message}</td></tr>`;
    }
}

function abrirModalEdicionTorneo(id, nombre) {
    document.getElementById('modal-torneo-id').value = id;
    document.getElementById('modal-torneo-nombre').value = nombre;
    document.getElementById('modal-editar-torneo').classList.remove('hidden');
}

function cerrarModalTorneo() {
    document.getElementById('modal-editar-torneo').classList.add('hidden');
}

async function actualizarDatosTorneo(e) {
    e.preventDefault();
    const id = document.getElementById('modal-torneo-id').value;
    const nombre = document.getElementById('modal-torneo-nombre').value.trim();

    try {
        const { error } = await supabaseAdmin.from('torneos').update({ nombre: nombre }).eq('id', id);
        if (error) throw error;

        alert('📝 Torneo renombrado con éxito.');
        cerrarModalTorneo();
        
        cargarSelectoresDeTorneos();
        listarTorneosAdmin();
    } catch (err) {
        alert('Error al modificar torneo: ' + err.message);
    }
}

async function eliminarTorneoCompleto(torneoId) {
    if (!confirm("🚨 ¿ATENCIÓN! Borrar este torneo eliminará definitivamente TODOS sus equipos, nóminas de jugadores, partidos y estadísticas de forma irreversible. ¿Continuar?")) return;

    try {
        const { data: partidos } = await supabaseAdmin.from('partidos').select('id').eq('torneo_id', torneoId);
        if (partidos && partidos.length > 0) {
            const partidoIds = partidos.map(p => p.id);
            await supabaseAdmin.from('estadisticas_partido').delete().in('partido_id', partidoIds);
        }
        await supabaseAdmin.from('partidos').delete().eq('torneo_id', torneoId);

        const { data: equipos } = await supabaseAdmin.from('equipos').select('id').eq('torneo_id', torneoId);
        if (equipos && equipos.length > 0) {
            const equipoIds = equipos.map(e => e.id);
            await supabaseAdmin.from('jugadores').delete().in('equipo_id', equipoIds);
        }
        await supabaseAdmin.from('equipos').delete().eq('torneo_id', torneoId);

        const { error } = await supabaseAdmin.from('torneos').delete().eq('id', torneoId);
        if (error) throw error;

        alert('🗑️ El torneo y toda su información histórica han sido eliminados.');
        cargarSelectoresDeTorneos();
        listarTorneosAdmin();
    } catch (err) {
        alert('Error en el borrado completo: ' + err.message);
    }
}

// ==========================================================================
// GESTIÓN DE EQUIPOS (CREACIÓN Y ELIMINACIÓN)
// ==========================================================================
async function guardarEquipoVacio(e) {
    e.preventDefault();
    const torneoId = document.getElementById('equipo-torneo-select').value;
    const nombre = document.getElementById('equipo-nombre').value.trim();
    const logoUrl = document.getElementById('equipo-logo').value.trim() || null;

    if (!torneoId) {
        alert("⚠️ Por favor selecciona un torneo válido.");
        return;
    }

    try {
        const { error } = await supabaseAdmin
            .from('equipos')
            .insert([{ torneo_id: torneoId, nombre: nombre, logo_url: logoUrl }]);

        if (error) throw error;

        alert(`🛡️ Equipo "${nombre}" registrado. Usa el botón "Editar" en la tabla para añadir sus jugadores.`);
        document.getElementById('form-crear-equipo').reset();
        
        document.getElementById('filtro-torneo-equipos').value = torneoId;
        listarEquiposAdmin(torneoId);
    } catch (err) {
        alert('Error al agregar equipo: ' + err.message);
    }
}

async function listarEquiposAdmin(torneoId) {
    const tbody = document.getElementById('lista-equipos-table');
    tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-slate-400">Cargando...</td></tr>';

    if (!torneoId) {
        tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-slate-400">Selecciona un torneo para listar sus equipos.</td></tr>';
        return;
    }

    try {
        const { data: equipos, error } = await supabaseAdmin
            .from('equipos')
            .select('*')
            .eq('torneo_id', torneoId)
            .order('nombre', { ascending: true });

        if (error) throw error;

        tbody.innerHTML = '';
        if (equipos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-slate-400">No hay equipos registrados aquí.</td></tr>';
            return;
        }

        equipos.forEach(eq => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="p-3 text-center">${eq.logo_url ? `<img src="${eq.logo_url}" class="w-6 h-6 object-contain inline-block rounded-md">` : '🛡️'}</td>
                <td class="p-3 font-bold text-slate-700">${eq.nombre}</td>
                <td class="p-3 text-right flex justify-end gap-1.5">
                    <button onclick="abrirModalEdicionEquipo('${eq.id}', '${eq.nombre}', '${eq.logo_url || ''}')" class="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all">Editar</button>
                    <button onclick="eliminarEquipoCompleto('${eq.id}', '${torneoId}')" class="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-red-500">Error: ${err.message}</td></tr>`;
    }
}

async function eliminarEquipoCompleto(equipoId, torneoId) {
    if (!confirm("⚠️ ¿Deseas borrar este equipo y a todos sus jugadores?")) return;

    try {
        await supabaseAdmin.from('jugadores').delete().eq('equipo_id', equipoId);
        const { error } = await supabaseAdmin.from('equipos').delete().eq('id', equipoId);
        if (error) throw error;

        alert('🗑️ Equipo eliminado con éxito.');
        listarEquiposAdmin(torneoId);
    } catch (err) {
        alert('No se pudo eliminar (Verifica si tiene encuentros agendados): ' + err.message);
    }
}

// ==========================================================================
// EDICIÓN EN MODAL (EQUIPO Y FICHAJE INDIVIDUAL DE JUGADORES)
// ==========================================================================
async function abrirModalEdicionEquipo(id, nombre, logo) {
    document.getElementById('modal-equipo-id').value = id;
    document.getElementById('modal-equipo-nombre').value = nombre;
    document.getElementById('modal-equipo-logo').value = logo;
    
    document.getElementById('modal-editar-equipo').classList.remove('hidden');
    cargarJugadoresEnModal(id);
}

function cerrarModalEquipo() {
    document.getElementById('modal-editar-equipo').classList.add('hidden');
    document.getElementById('add-jugador-dorsal').value = '';
    document.getElementById('add-jugador-nombre').value = '';
}

async function cargarJugadoresEnModal(equipoId) {
    const contenedor = document.getElementById('modal-lista-jugadores');
    contenedor.innerHTML = '<p class="p-3 text-center text-slate-400 text-xs">Actualizando lista de jugadores...</p>';

    try {
        const { data: jugadores, error } = await supabaseAdmin
            .from('jugadores')
            .select('*')
            .eq('equipo_id', equipoId)
            .order('numero_camiseta', { ascending: true });

        if (error) throw error;

        if (jugadores.length === 0) {
            contenedor.innerHTML = '<p class="p-3 text-center text-slate-400 text-xs">Este equipo no tiene jugadores asignados.</p>';
            return;
        }

        contenedor.innerHTML = '';
        jugadores.forEach(j => {
            const div = document.createElement('div');
            div.className = "flex justify-between items-center p-2 text-xs hover:bg-slate-50 transition-all";
            div.innerHTML = `
                <span class="font-medium text-slate-700">
                    <b class="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded-sm font-mono mr-2">N° ${j.numero_camiseta}</b> 
                    ${j.nombre_jugador}
                </span>
                <button onclick="eliminarJugadorIndividual('${j.id}', '${equipoId}')" class="text-red-500 hover:text-red-700 font-bold px-2 py-0.5 transition-all cursor-pointer">Eliminar</button>
            `;
            contenedor.appendChild(div);
        });
    } catch (err) {
        contenedor.innerHTML = `<p class="p-3 text-center text-red-500 text-xs">Error: ${err.message}</p>`;
    }
}

async function agregarJugadorIndividual() {
    const equipoId = document.getElementById('modal-equipo-id').value;
    const dorsalInput = document.getElementById('add-jugador-dorsal');
    const nombreInput = document.getElementById('add-jugador-nombre');

    const dorsal = parseInt(dorsalInput.value.trim(), 10);
    const nombre = nombreInput.value.trim();

    if (!dorsal || !nombre) {
        alert("⚠️ Por favor ingresa el número de camiseta y el nombre completo.");
        return;
    }

    try {
        const { error } = await supabaseAdmin
            .from('jugadores')
            .insert([{ equipo_id: equipoId, numero_camiseta: dorsal, font_name: null, nombre_jugador: nombre }]);

        if (error) throw error;

        dorsalInput.value = '';
        nombreInput.value = '';
        cargarJugadoresEnModal(equipoId);
    } catch (err) {
        alert("Error al añadir jugador: " + err.message);
    }
}

async function eliminarJugadorIndividual(jugadorId, equipoId) {
    if (!confirm("¿Deseas remover a este jugador de la plantilla?")) return;

    try {
        const { error } = await supabaseAdmin.from('jugadores').delete().eq('id', jugadorId);
        if (error) throw error;

        cargarJugadoresEnModal(equipoId);
    } catch (err) {
        alert("No se pudo remover el jugador: " + err.message);
    }
}

async function actualizarDatosEquipo(e) {
    e.preventDefault();
    const id = document.getElementById('modal-equipo-id').value;
    const nombre = document.getElementById('modal-equipo-nombre').value.trim();
    const logoUrl = document.getElementById('modal-equipo-logo').value.trim() || null;

    try {
        const { error } = await supabaseAdmin.from('equipos').update({ nombre, logo_url: logoUrl }).eq('id', id);
        if (error) throw error;

        alert('📝 Datos del equipo guardados.');
        cerrarModalEquipo();
        listarEquiposAdmin(document.getElementById('filtro-torneo-equipos').value);
    } catch (err) {
        alert(err.message);
    }
}

// ==========================================================================
// GESTIÓN DE PARTIDOS
// ==========================================================================
async function cargarEquiposParaPartido(torneoId) {
    const local = document.getElementById('partido-local-select');
    const visitante = document.getElementById('partido-visitante-select');
    local.innerHTML = '<option value="">Cargando...</option>';
    visitante.innerHTML = '<option value="">Cargando...</option>';

    try {
        const { data: equipos, error } = await supabaseAdmin
            .from('equipos')
            .select('id, nombre')
            .eq('torneo_id', torneoId)
            .order('nombre', { ascending: true });

        if (error) throw error;

        local.innerHTML = '<option value="">Seleccione...</option>';
        visitante.innerHTML = '<option value="">Seleccione...</option>';

        equipos.forEach(eq => {
            local.insertAdjacentHTML('beforeend', `<option value="${eq.id}">${eq.nombre}</option>`);
            visitante.insertAdjacentHTML('beforeend', `<option value="${eq.id}">${eq.nombre}</option>`);
        });
    } catch (err) {
        console.error(err.message);
    }
}

async function guardarNuevoPartido(e) {
    e.preventDefault();
    const torneoId = document.getElementById('partido-torneo-select').value;
    const localId = document.getElementById('partido-local-select').value;
    const visitanteId = document.getElementById('partido-visitante-select').value;
    const fecha = document.getElementById('partido-fecha').value;
    const cancha = document.getElementById('partido-cancha').value.trim() || 'Coliseo Principal';

    if (localId === visitanteId) {
        alert("⚠️ El equipo local y visitante no pueden coincidir.");
        return;
    }

    try {
        const { error } = await supabaseAdmin
            .from('partidos')
            .insert([{
                torneo_id: torneoId,
                equipo_local_id: localId,
                equipo_visitante_id: visitanteId,
                fecha_hora: fecha,
                cancha: cancha,
                estado: 'programado'
            }]);

        if (error) throw error;

        alert('📅 Partido programado con éxito.');
        document.getElementById('form-crear-partido').reset();
        if (document.getElementById('filtro-torneo-partidos').value === torneoId) listarPartidosAdmin(torneoId);
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// ORDENADO: DE LA FECHA MÁS NUEVA A LA MÁS VIEJA (.order('fecha_hora', { ascending: false }))
async function listarPartidosAdmin(torneoId) {
    const tbody = document.getElementById('lista-partidos-admin-table');
    tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-slate-400">Buscando...</td></tr>';

    try {
        const [resP, resE] = await Promise.all([
            supabaseAdmin.from('partidos').select('*').eq('torneo_id', torneoId).order('fecha_hora', { ascending: false }),
            supabaseAdmin.from('equipos').select('id, nombre').eq('torneo_id', torneoId)
        ]);

        if (resP.error || resE.error) throw new Error("Error al obtener encuentros.");

        const nombresMap = {};
        resE.data.forEach(e => nombresMap[e.id] = e.nombre);

        tbody.innerHTML = '';
        if (resP.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-slate-400">No hay partidos registrados.</td></tr>';
            return;
        }

        resP.data.forEach(p => {
            const loc = nombresMap[p.equipo_local_id] || 'Desconocido';
            const vis = nombresMap[p.equipo_visitante_id] || 'Desconocido';
            const esFinalizado = p.estado === 'finalizado';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="p-3 font-bold text-slate-800">
                    ${loc} vs ${vis} 
                    <span class="text-xs ${esFinalizado ? 'text-emerald-600' : 'text-orange-500'} font-medium">
                        ${esFinalizado ? `[${p.puntos_local} - ${p.puntos_visitante}]` : '(Pendiente)'}
                    </span>
                </td>
                <td class="p-3 text-slate-500 font-medium">${p.cancha}<br><span class="text-[10px]">${new Date(p.fecha_hora).toLocaleString()}</span></td>
                <td class="p-3 text-center flex justify-center items-center gap-2">
                    <button onclick="abrirModalPartido('${p.id}', '${loc}', '${vis}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer">⚙️ Cerrar Partido</button>
                    ${esFinalizado 
                        ? `<button disabled class="bg-slate-200 text-slate-400 px-2 py-1 rounded-lg text-xs font-bold cursor-not-allowed border border-slate-300">🔒</button>`
                        : `<button onclick="eliminarPartido('${p.id}', '${torneoId}')" class="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer">🗑️</button>`
                    }
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-red-500">Error: ${err.message}</td></tr>`;
    }
}

async function eliminarPartido(id, torneoId) {
    if (!confirm("🚨 ¿Seguro que quieres borrar este partido?")) return;

    try {
        await supabaseAdmin.from('estadisticas_partido').delete().eq('partido_id', id);
        const { error } = await supabaseAdmin.from('partidos').delete().eq('id', id);
        if (error) throw error;

        alert('🗑 Partido eliminado.');
        listarPartidosAdmin(torneoId);
    } catch (err) {
        alert(err.message);
    }
}

// ==========================================================================
// REGISTRO DE MARCADORES Y ESTADÍSTICAS INDIVIDUALES
// ==========================================================================
async function abrirModalPartido(partidoId, nombreLocal, nombreVisitante) {
    document.getElementById('cerrar-partido-id').value = partidoId;
    document.getElementById('label-equipo-local').innerText = `🏠 ${nombreLocal}`;
    document.getElementById('label-equipo-visitante').innerText = `🚀 ${nombreVisitante}`;
    
    const tbody = document.getElementById('tabla-planilla-jugadores');
    tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-400 text-xs">Cargando nómina de ambos equipos...</td></tr>';

    document.getElementById('modal-cerrar-partido').classList.remove('hidden');

    try {
        const { data: partido, error: errP } = await supabaseAdmin
            .from('partidos')
            .select('equipo_local_id, equipo_visitante_id, puntos_local, puntos_visitante')
            .eq('id', partidoId)
            .single();

        if (errP) throw errP;

        document.getElementById('goles-local').value = partido.puntos_local || 0;
        document.getElementById('goles-visitante').value = partido.puntos_visitante || 0;

        const { data: jugadores, error: errJ } = await supabaseAdmin
            .from('jugadores')
            .select('*')
            .in('equipo_id', [partido.equipo_local_id, partido.equipo_visitante_id])
            .order('numero_camiseta', { ascending: true });

        if (errJ) throw errJ;

        const { data: statsPrevia } = await supabaseAdmin
            .from('estadisticas_partido')
            .select('*')
            .eq('partido_id', partidoId);

        const statsMap = {};
        if (statsPrevia) {
            statsPrevia.forEach(s => { statsMap[s.jugador_id] = s; });
        }

        tbody.innerHTML = '';
        if (jugadores.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-400 text-xs">No hay jugadores registrados en los equipos. Agrega jugadores primero.</td></tr>';
            return;
        }

        jugadores.forEach(j => {
            const esLocal = j.equipo_id === partido.equipo_local_id;
            const prefix = esLocal ? '🟢 (L)' : '🔵 (V)';
            const s = statsMap[j.id] || { puntos: 0, triples: 0, asistencias: 0 };

            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 transition-all text-slate-700 font-medium text-xs";
            tr.innerHTML = `
                <td class="p-2.5">
                    <span class="text-[10px] text-slate-400 block font-bold">${prefix}</span>
                    <b>N° ${j.numero_camiseta}</b> - ${j.nombre_jugador}
                </td>
                <td class="p-2 text-center">
                    <input type="number" data-jugador="${j.id}" data-stat="puntos" min="0" value="${s.puntos}" class="w-12 bg-slate-50 border border-slate-300 rounded text-center py-1 text-xs">
                </td>
                <td class="p-2 text-center">
                    <input type="number" data-jugador="${j.id}" data-stat="triples" min="0" value="${s.triples}" class="w-12 bg-slate-50 border border-slate-300 rounded text-center py-1 text-xs">
                </td>
                <td class="p-2 text-center">
                    <input type="number" data-jugador="${j.id}" data-stat="asistencias" min="0" value="${s.asistencias}" class="w-12 bg-slate-50 border border-slate-300 rounded text-center py-1 text-xs">
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500 text-xs">Error: ${err.message}</td></tr>`;
    }
}

function cerrarModalPartido() {
    document.getElementById('modal-cerrar-partido').classList.add('hidden');
    document.getElementById('form-finalizar-partido').reset();
}

async function procesarCierreDePartido(e) {
    e.preventDefault();
    const partidoId = document.getElementById('cerrar-partido-id').value;
    const ptsLocal = parseInt(document.getElementById('goles-local').value, 10);
    const ptsVisitante = parseInt(document.getElementById('goles-visitante').value, 10);

    try {
        await supabaseAdmin.from('estadisticas_partido').delete().eq('partido_id', partidoId);

        const inputs = document.querySelectorAll('#tabla-planilla-jugadores input[data-jugador]');
        const datosJugadores = {};

        inputs.forEach(input => {
            const jugadorId = input.getAttribute('data-jugador');
            const tipoStat = input.getAttribute('data-stat');
            const valor = parseInt(input.value, 10) || 0;

            if (!datosJugadores[jugadorId]) {
                datosJugadores[jugadorId] = { partido_id: partidoId, jugador_id: jugadorId, puntos: 0, triples: 0, asistencias: 0 };
            }
            datosJugadores[jugadorId][tipoStat] = valor;
        });

        const listaPayload = Object.values(datosJugadores);

        if (listaPayload.length > 0) {
            const { error: errSt } = await supabaseAdmin.from('estadisticas_partido').insert(listaPayload);
            if (errSt) throw errSt;
        }

        const { error: errPt } = await supabaseAdmin
            .from('partidos')
            .update({
                puntos_local: ptsLocal,
                puntos_visitante: ptsVisitante,
                estado: 'finalizado'
            })
            .eq('id', partidoId);

        if (errPt) throw errPt;

        alert('💾 Marcadores globales y estadísticas guardadas con éxito.');
        cerrarModalPartido();
        
        const torneoFiltro = document.getElementById('filtro-torneo-partidos').value;
        if (torneoFiltro) listarPartidosAdmin(torneoFiltro);

    } catch (err) {
        alert('Error guardando el cierre de partido: ' + err.message);
    }
}

function cerrarSesion() {
    alert("Sesión cerrada.");
    window.location.href = "login.html";
}