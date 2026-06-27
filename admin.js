const SUPABASE_URL = 'https://vzouznekqycalzgswxos.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_Tm-IBIr0gRvjTWFhF5LNuQ_rMsgP3vo';


const supabaseAdmin = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.addEventListener('load', async () => {
    try {
        const { data: { session }, error } = await supabaseAdmin.auth.getSession();
        if (error || !session) { window.location.replace('login.html'); return; }

        const adminBody = document.getElementById('admin-body');
        if (adminBody) adminBody.style.display = 'block';

        await cargarSelectsTorneos();
    } catch (err) { window.location.replace('login.html'); }
});

async function cargarSelectsTorneos() {
    try {
        const { data: torneos, error } = await supabaseAdmin.from('torneos').select('*'); 
        if (error) throw error;

        const selects = ['equipo-torneo-select', 'partido-torneo-select', 'filtro-torneo-equipos', 'filtro-torneo-partidos'];
        selects.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.innerHTML = '<option value="">-- Seleccione Torneo --</option>';
            if (torneos) {
                torneos.forEach(t => { el.innerHTML += `<option value="${t.id}">${t.nombre}</option>`; });
            }
        });
        listarTorneosLateral(torneos);
    } catch (err) { console.error(err.message); }
}

function listarTorneosLateral(torneos) {
    const ul = document.getElementById('lista-torneos-admin');
    if (!ul) return; ul.innerHTML = '';

    if (!torneos || torneos.length === 0) {
        ul.innerHTML = '<li class="text-slate-400 italic py-1">No hay categorías.</li>';
        return;
    }
    torneos.forEach(t => {
        const li = document.createElement('li');
        li.className = "flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100 shadow-sm mb-1";
        li.innerHTML = `<span class="font-bold text-slate-700 truncate max-w-[180px]">🏆 ${t.nombre}</span>
            <button onclick="eliminarTorneo('${t.id}')" class="text-red-500 hover:text-red-700 font-bold px-1 cursor-pointer">🗑️</button>`;
        ul.appendChild(li);
    });
}

async function actualizarEquiposPartido(torneoId) {
    const localSel = document.getElementById('partido-local-select');
    const visitanteSel = document.getElementById('partido-visitante-select');
    if (!localSel || !visitanteSel) return;

    if (!torneoId) {
        localSel.innerHTML = visitanteSel.innerHTML = '<option value="">-- Primero elige torneo --</option>';
        return;
    }
    try {
        const { data: equipos, error } = await supabaseAdmin.from('equipos').select('*').eq('torneo_id', torneoId);
        if (error) throw error;
        let options = '<option value="">-- Elegir Equipo --</option>';
        equipos.forEach(eq => { options += `<option value="${eq.id}">${eq.nombre}</option>`; });
        localSel.innerHTML = visitanteSel.innerHTML = options;
    } catch (err) { console.error(err.message); }
}

async function guardarTorneo(e) {
    e.preventDefault();
    const nombre = document.getElementById('torneo-nombre').value.trim();
    try {
        const { error } = await supabaseAdmin
            .from("torneos")
            .insert([{ nombre }]);

            if(error) throw error;
        document.getElementById('form-crear-torneo').reset();
        await cargarSelectsTorneos();
    } catch (err) { alert(err.message); }
}

async function guardarEquipoVacio(e) {
    e.preventDefault();
    const torneoId = document.getElementById('equipo-torneo-select').value;
    const nombre = document.getElementById('equipo-nombre').value.trim();
    const logoUrl = document.getElementById('equipo-logo').value.trim() || null;

    try {
        const { error } = await supabaseAdmin
            .from("equipos")
            .insert([{
                torneo_id: torneoId,
                nombre: nombre,
                logo_url: logoUrl
            }]);

            if(error) throw error;
        document.getElementById('form-crear-equipo').reset();
        document.getElementById('filtro-torneo-equipos').value = torneoId;
        listarEquiposAdmin(torneoId);
    } catch (err) { alert(err.message); }
}

async function guardarPartido(e) {
    e.preventDefault();
    const torneoId = document.getElementById('partido-torneo-select').value;
    const localId = document.getElementById('partido-local-select').value;
    const visitanteId = document.getElementById('partido-visitante-select').value;
    const fechaHora = document.getElementById('partido-fecha').value; 
    const cancha = document.getElementById('partido-cancha').value.trim();
    // 🌟 Captura el comentario (ej: Fecha 1, Semifinal)
    const comentario = document.getElementById('partido-comentario').value.trim() || null;

    if (localId === visitanteId) { alert("No puedes emparejar un equipo contra sí mismo."); return; }

    try {
        await supabaseAdmin.from('partidos').insert([{
            torneo_id: torneoId, equipo_local_id: localId, equipo_visitante_id: visitanteId,
            fecha_hora: fechaHora, cancha: cancha, estado: 'programado', comentario: comentario
        }]);
        document.getElementById('form-crear-partido').reset();
        document.getElementById('filtro-torneo-partidos').value = torneoId;
        listarPartidosAdmin(torneoId);
    } catch (err) { alert(err.message); }
}

async function listarEquiposAdmin(torneoId) {
    const tbody = document.getElementById('tabla-equipos-admin');
    if (!tbody || !torneoId) return; tbody.innerHTML = '';

    try {
        const { data: equipos } = await supabaseAdmin.from('equipos').select('*').eq('torneo_id', torneoId);
        equipos.forEach(eq => {
            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-100 text-xs";
            tr.innerHTML = `
                <td class="p-3"><img src="${eq.logo_url || 'https://placehold.co/40x40/png?text=🏀'}" class="w-8 h-8 rounded-full object-cover"></td>
                <td class="p-3 font-bold text-slate-700">${eq.nombre}</td>
                <td class="p-3 text-right flex justify-end gap-2">
                    <button onclick="abrirModalEquipo('${eq.id}', '${eq.nombre}', '${eq.logo_url || ''}')" class="bg-blue-50 text-blue-600 font-bold px-2 py-1 rounded-lg">📝 Nómina</button>
                    <button onclick="eliminarEquipo('${eq.id}', '${torneoId}')" class="bg-red-50 text-red-600 px-2 py-1 rounded-lg">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) { console.error(err.message); }
}

async function listarPartidosAdmin(torneoId) {
    const tbody = document.getElementById('tabla-partidos-admin');
    if (!tbody || !torneoId) return; tbody.innerHTML = '';

    try {
        // Se añade comentario al select administrativo
        const { data: partidos } = await supabaseAdmin.from('partidos').select(`
                id, fecha_hora, cancha, estado, puntos_local, puntos_visitante, comentario,
                local:equipos!equipo_local_id(nombre), visitante:equipos!equipo_visitante_id(nombre)
            `).eq('torneo_id', torneoId);

        const partidosOrdenados = (partidos || []).sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));

        partidosOrdenados.forEach(p => {
            const loc = p.local?.nombre || 'Rival A';
            const vis = p.visitante?.nombre || 'Rival B';
            const esFinalizado = p.estado.toLowerCase() === 'finalizado';
            
            // Texto para mostrar el comentario de forma clara en el listado del panel
            const textoComentario = p.comentario ? ` <span class="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded ml-1 font-normal border">${p.comentario}</span>` : '';

            const botonEliminar = esFinalizado
                ? `<button class="bg-slate-200 text-slate-400 font-bold px-2 py-1.5 rounded-lg cursor-not-allowed opacity-60" disabled>🗑️</button>`
                : `<button onclick="eliminarPartido('${p.id}', '${torneoId}')" class="bg-red-600 text-white font-bold px-2 py-1.5 rounded-lg">🗑️</button>`;

            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-100 text-xs";
            tr.innerHTML = `
                <td class="p-3 font-bold text-slate-800">
                    <div class="flex items-center flex-wrap gap-1">
                        <span>${loc} vs ${vis}</span>
                        ${textoComentario}
                    </div>
                    <span class="${esFinalizado ? 'text-emerald-600' : 'text-orange-500'} font-bold block mt-0.5">[${p.puntos_local || 0} - ${p.puntos_visitante || 0}] (${p.estado.toLowerCase()})</span>
                </td>
                <td class="p-3 text-slate-400 font-medium">${p.cancha}<br>${p.fecha_hora.replace('T', ' ')}</td>
                <td class="p-3 text-center flex justify-center gap-1.5 mt-2">
                    <button onclick="abrirModalPartido('${p.id}', '${loc}', '${vis}', ${p.puntos_local || 0}, ${p.puntos_visitante || 0})" class="${esFinalizado ? 'bg-amber-500' : 'bg-emerald-600'} text-white px-2 py-1.5 rounded-lg font-bold">${esFinalizado ? '✏️ Corregir' : '⚙️ Mesa Técnica'}</button>
                    ${botonEliminar}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) { console.error(err.message); }
}

async function abrirModalEquipo(equipoId, nombre, logoUrl) {
    document.getElementById('edit-equipo-id').value = equipoId;
    document.getElementById('edit-equipo-nombre').value = nombre;
    document.getElementById('edit-equipo-logo').value = logoUrl;
    document.getElementById('modal-editar-equipo').classList.remove('hidden');
    await refreshJugadoresModal(equipoId);
}

function cerrarModalEquipo() { document.getElementById('modal-editar-equipo').classList.add('hidden'); }

async function refreshJugadoresModal(equipoId) {
    const tbody = document.getElementById('modal-tabla-jugadores');
    if (!tbody) return; tbody.innerHTML = '';
    try {
        const { data: jugadores, error } = await supabaseAdmin
            .from("jugadores")
            .select("*")
            .eq("equipo_id", equipoId);

            if(error) throw error;

            (jugadores || []).forEach(j => {

            const tr = document.createElement('tr');
            tr.className = "border-b text-xs";
            tr.innerHTML = `<td class="p-2 text-center font-bold">#${j.numero_camiseta}</td><td class="p-2">${j.nombre_jugador}</td><td class="p-2 text-right"><button onclick="eliminarJugadorModal('${j.id}', '${equipoId}')" class="text-red-500 font-bold">❌</button></td>`;
            tbody.appendChild(tr);
        });
    } catch (err) { console.error(err); }
}

async function agregarJugadorModal(e) {
    e.preventDefault();

    const equipoId = Number(document.getElementById('edit-equipo-id').value);
    const numero = parseInt(document.getElementById('new-jugador-numero').value, 10);
    const nombre = document.getElementById('new-jugador-nombre').value.trim();

    try {

        // Validar dorsal repetido
        const { data: existeNumero } = await supabaseAdmin
            .from("jugadores")
            .select("id")
            .eq("equipo_id", equipoId)
            .eq("numero_camiseta", numero);

        if (existeNumero && existeNumero.length > 0) {
            alert("Ese número de camiseta ya existe.");
            return;
        }

        // Validar nombre repetido
        const { data: existeNombre } = await supabaseAdmin
            .from("jugadores")
            .select("id")
            .eq("equipo_id", equipoId)
            .eq("nombre_jugador", nombre);

        if (existeNombre && existeNombre.length > 0) {
            alert("Ese jugador ya está inscrito.");
            return;
        }

        const { error } = await supabaseAdmin
            .from("jugadores")
            .insert([{
                equipo_id: equipoId,
                numero_camiseta: numero,
                nombre_jugador: nombre
            }]);

        if (error) throw error;

        document.getElementById("form-add-jugador").reset();

        await refreshJugadoresModal(equipoId);

    } catch (err) {

        console.error(err);

        alert("Error al agregar jugador:\n" + err.message);

    }
}

async function eliminarJugadorModal(jugadorId, equipoId) {
    if (!confirm("¿Remover jugador?")) return;
    try {
        await supabaseAdmin.from('jugadores').delete().eq('id', jugadorId);
        await refreshJugadoresModal(equipoId);
    } catch (err) { console.error(err); }
}

async function actualizarDatosEquipo(e) {
    e.preventDefault();
    const equipoId = document.getElementById('edit-equipo-id').value;
    const nuevoNombre = document.getElementById('edit-equipo-nombre').value.trim();
    const nuevoLogo = document.getElementById('edit-equipo-logo').value.trim() || null;
    try {
        await supabaseAdmin.from('equipos').update({ nombre: nuevoNombre, logo_url: nuevoLogo }).eq('id', equipoId);
        alert("Datos del club actualizados.");
        listarEquiposAdmin(document.getElementById('filtro-torneo-equipos').value);
    } catch (err) { alert(err.message); }
}

async function abrirModalPartido(partidoId, localNombre, visitanteNombre, puntosL, puntosV) {
    document.getElementById('modal-partido-id').value = partidoId;
    document.getElementById('modal-titulo-partido').innerText = `${localNombre} VS ${visitanteNombre}`;
    document.getElementById('modal-lbl-local').innerText = localNombre;
    document.getElementById('modal-lbl-visitante').innerText = visitanteNombre;
    
    document.getElementById('final-puntos-local').value = puntosL;
    document.getElementById('final-puntos-visitante').value = puntosV;

    const divLocal = document.getElementById('contenedor-jugadores-local');
    const divVisitante = document.getElementById('contenedor-jugadores-visitante');
    divLocal.innerHTML = divVisitante.innerHTML = '<p class="text-xs text-slate-400">Consultando planillas...</p>';

    document.getElementById('modal-cerrar-partido').classList.remove('hidden');

    try {
        const { data: partido } = await supabaseAdmin.from('partidos').select('equipo_local_id, equipo_visitante_id').eq('id', partidoId).single();

        const [resLocal, resVisitante, resEstadisticas] = await Promise.all([
            supabaseAdmin.from('jugadores').select('*').eq('equipo_id', partido.equipo_local_id),
            supabaseAdmin.from('jugadores').select('*').eq('equipo_id', partido.equipo_visitante_id),
            supabaseAdmin.from('estadisticas_partido').select('*').eq('partido_id', partidoId)
        ]);

        const mapaEst = {};
        if (resEstadisticas.data) { resEstadisticas.data.forEach(est => { mapaEst[est.jugador_id] = est; }); }

        renderListaPlanilla(divLocal, resLocal.data, 'local', mapaEst);
        renderListaPlanilla(divVisitante, resVisitante.data, 'visitante', mapaEst);
    } catch (err) { alert("Error al abrir mesa técnica: " + err.message); }
}

function renderListaPlanilla(contenedor, jugadores, bando, mapaEst) {
    contenedor.innerHTML = '';
    if (!jugadores || jugadores.length === 0) {
        contenedor.innerHTML = '<p class="text-xs text-slate-400 italic p-2">Sin deportistas inscritos.</p>';
        return;
    }

    jugadores.forEach(j => {
        const d = mapaEst[j.id] || { puntos: 0, triples: 0, asistencias: 0 };
        const item = document.createElement('div');
        item.className = "flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100 text-xs mb-1";
        item.innerHTML = `
            <span class="font-bold text-slate-700 truncate max-w-[150px]">#${j.numero_camiseta} - ${j.nombre_jugador}</span>
            <div class="flex gap-1 items-center data-jugador" data-id="${j.id}">
                <input type="number" min="0" value="${d.puntos}" class="w-10 border rounded text-center pts font-bold" title="Puntos">
                <input type="number" min="0" value="${d.triples}" class="w-10 border rounded text-center tri font-bold" title="Triples">
                <input type="number" min="0" value="${d.asistencias}" class="w-10 border rounded text-center ast font-bold" title="Asistencias">
            </div>
        `;
        contenedor.appendChild(item);
    });
}

async function procesarCierrePartido(e) {
    e.preventDefault();
    const partidoId = document.getElementById('modal-partido-id').value;
    const ptsLocalGlobal = parseInt(document.getElementById('final-puntos-local').value, 10) || 0;
    const ptsVisitanteGlobal = parseInt(document.getElementById('final-puntos-visitante').value, 10) || 0;

    const inputsJugadores = document.querySelectorAll('.data-jugador');
    const estadisticasPayload = [];

    inputsJugadores.forEach(div => {
        const jugadorId = div.getAttribute('data-id');
        const puntos = parseInt(div.querySelector('.pts').value, 10) || 0;
        const triples = parseInt(div.querySelector('.tri').value, 10) || 0;
        const asistencias = parseInt(div.querySelector('.ast').value, 10) || 0;

        if (puntos > 0 || triples > 0 || asistencias > 0) {
            estadisticasPayload.push({ partido_id: partidoId, jugador_id: jugadorId, puntos, triples, asistencias });
        }
    });

    try {
        await supabaseAdmin.from('estadisticas_partido').delete().eq('partido_id', partidoId);

        if (estadisticasPayload.length > 0) {
            const { error: errEst } = await supabaseAdmin.from('estadisticas_partido').insert(estadisticasPayload);
            if (errEst) throw errEst;
        }

        const { error: errPart } = await supabaseAdmin
            .from('partidos')
            .update({ puntos_local: ptsLocalGlobal, puntos_visitante: ptsVisitanteGlobal, estado: 'finalizado' })
            .eq('id', partidoId);

        if (errPart) throw errPart;

        alert("🏀 Partido guardado con éxito.");
        cerrarModal();
        
        const tId = document.getElementById('filtro-torneo-partidos').value;
        if (tId) listarPartidosAdmin(tId);
    } catch (err) { alert("Error al cerrar: " + err.message); }
}

function cerrarModal() { document.getElementById('modal-cerrar-partido').classList.add('hidden'); }

async function eliminarPartido(id, torneoId) {
    try {
        const { data: partido } = await supabaseAdmin.from('partidos').select('estado').eq('id', id).single();

        if (partido && partido.estado.toLowerCase() === 'finalizado') {
            alert("⚠️ Acción Denegada: No se permiten eliminar partidos finalizados.");
            return; 
        }

        if (!confirm("¿Deseas remover este encuentro programado?")) return;
        await supabaseAdmin.from('partidos').delete().eq('id', id);
        listarPartidosAdmin(torneoId);
    } catch (err) { alert(err.message); }
}

async function eliminarEquipo(id, torneoId) {
    if (!confirm("¿Deseas remover el club?")) return;
    try {
        await supabaseAdmin.from('equipos').delete().eq('id', id);
        listarEquiposAdmin(torneoId);
    } catch (err) { alert("Error al borrar: " + err.message); }
}

async function eliminarTorneo(id) {
    if (!confirm("¿Deseas borrar esta categoría por completo?")) return;
    try {
        await supabaseAdmin.from('torneos').delete().eq('id', id);
        await cargarSelectsTorneos();
    } catch (err) { alert(err.message); }
}

async function cerrarSesion() {
    await supabaseAdmin.auth.signOut();
    window.location.replace('login.html');
}

