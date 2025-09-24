// Datos en memoria y persistencia local
const STORAGE_KEY = 'eco_heroes_db_v1';
const state = {
  equipos: [], // {id, equipo, institucion, grado, contactoNombre, contactoTelefono, contactoEmail}
  puntajes: {}, // idEquipo -> { 'Ronda 1': n, 'Ronda 2': n, 'Ronda 3': n }
  participantes: {}, // idEquipo -> [{nombre, cel, mail}, {..}, {..}]
};
// Autenticación simple de jurados
const JUROR_PASSWORD = 'ecoingms*';
const JUROR_AUTH_KEY = 'eco_heroes_juror_auth_v1';
const JUROR_SESSION_MINUTES = 60; // caducidad de sesión
let jurorAuth = { 'Jurado 1': false, 'Jurado 2': false, 'Jurado 3': false };
function loadJurorAuth(){
  try{
    const raw = localStorage.getItem(JUROR_AUTH_KEY);
    if(raw){
      const stored = JSON.parse(raw);
      const now = Date.now();
      if(stored._until && now > stored._until){
        // expiró la sesión
        localStorage.removeItem(JUROR_AUTH_KEY);
      } else {
        jurorAuth = { ...jurorAuth, ...stored };
      }
    }
  }catch(e){ console.warn('Auth jurado inválido'); }
}
function saveJurorAuth(){
  const until = Date.now() + JUROR_SESSION_MINUTES*60*1000;
  localStorage.setItem(JUROR_AUTH_KEY, JSON.stringify({ ...jurorAuth, _until: until }));
}

function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    try{
      const parsed = JSON.parse(raw);
      state.equipos = parsed.equipos || [];
      state.puntajes = parsed.puntajes || {};
      state.participantes = parsed.participantes || {};
    }catch(e){ console.error('Error leyendo storage', e); }
  }
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ equipos: state.equipos, puntajes: state.puntajes, participantes: state.participantes }));
}

function uuid(){ return 'xxxxxx'.replace(/x/g,()=>((Math.random()*36)|0).toString(36)); }

// UI helpers
function qs(sel, el=document){ return el.querySelector(sel); }
function qsa(sel, el=document){ return Array.from(el.querySelectorAll(sel)); }

// Poblado de select y tabla
function refreshEquipoSelect(){
  const sel = qs('#equipoScore');
  sel.innerHTML = '';
  // Opción placeholder vacía
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = '— Selecciona equipo —';
  sel.appendChild(ph);
  state.equipos.forEach(eq=>{
    const opt = document.createElement('option');
    opt.value = eq.id; opt.textContent = `${eq.equipo}`;
    sel.appendChild(opt);
  });
}

function computeTotal(scores){
  // Soporta etiquetas antiguas (Ronda) y nuevas (Jurado)
  return (scores['Jurado 1']||scores['Ronda 1']||0)
       + (scores['Jurado 2']||scores['Ronda 2']||0)
       + (scores['Jurado 3']||scores['Ronda 3']||0);
}

function refreshTablaPuntajes(){
  const tbody = qs('#tablaPuntajes tbody');
  tbody.innerHTML = '';
  state.equipos.forEach(eq=>{
    const tr = document.createElement('tr');
    const scores = state.puntajes[eq.id] || {};
    tr.innerHTML = `
      <td>${eq.equipo}</td>
      <td>${eq.institucion}</td>
      <td>${(scores['Jurado 1']??scores['Ronda 1']) ?? '-'}</td>
      <td>${(scores['Jurado 2']??scores['Ronda 2']) ?? '-'}</td>
      <td>${(scores['Jurado 3']??scores['Ronda 3']) ?? '-'}</td>
      <td><strong>${computeTotal(scores)}</strong></td>
    `;
    tbody.appendChild(tr);
  });
}

function calcularPodio(){
  const resultados = state.equipos.map(eq=>{
    const total = computeTotal(state.puntajes[eq.id]||{});
    return { equipo: eq.equipo, total };
  }).sort((a,b)=> b.total - a.total);
  qs('#ganador1').textContent = resultados[0]?.equipo || '—';
  qs('#ganador2').textContent = resultados[1]?.equipo || '—';
  qs('#ganador3').textContent = resultados[2]?.equipo || '—';
}

// Formulario de registro
function setupForm(){
  const form = qs('#formRegistro');
  const limpiar = qs('#btnLimpiar');
  const enableParticipantFields = (enable)=>{
    ['#p1Nombre','#p1Cel','#p1Mail','#p2Nombre','#p2Cel','#p2Mail','#p3Nombre','#p3Cel','#p3Mail']
      .forEach(id=>{ const el = qs(id); if(el){ el.disabled = !enable; }});
  };
  ['#equipo','#institucion','#grado','#contactoNombre','#contactoTelefono','#contactoEmail']
    .forEach(id=>{ const el = qs(id); if(el){ el.addEventListener('input', ()=> enableParticipantFields(true)); }});
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    if(!form.checkValidity()){
      form.reportValidity();
      return;
    }
    if(!qs('#politicaDatos').checked){
      alert('Debes aceptar la Política de Tratamiento de la Información Personal.');
      return;
    }
    const data = {
      id: uuid(),
      equipo: qs('#equipo').value.trim(),
      institucion: qs('#institucion').value.trim(),
      grado: qs('#grado').value,
      contactoNombre: qs('#contactoNombre').value.trim(),
      contactoTelefono: qs('#contactoTelefono').value.trim(),
      contactoEmail: qs('#contactoEmail').value.trim(),
    };
    state.equipos.push(data);
    const participantesRaw = [
      { nombre: qs('#p1Nombre').value.trim(), cel: qs('#p1Cel').value.trim(), mail: qs('#p1Mail').value.trim() },
      { nombre: qs('#p2Nombre').value.trim(), cel: qs('#p2Cel').value.trim(), mail: qs('#p2Mail').value.trim() },
      { nombre: qs('#p3Nombre').value.trim(), cel: qs('#p3Cel').value.trim(), mail: qs('#p3Mail').value.trim() },
    ];
    // participantes: opcionales por campo, pero mínimo 1 participante total;
    // si nombre o cel tiene algo, ambos deben ser válidos
    const participantes = [];
    for(const p of participantesRaw){
      const anyField = p.nombre || p.cel || p.mail;
      if(!anyField) continue;
      if(!p.nombre || !/^\d{7,12}$/.test(p.cel)){
        alert('Si agregas un participante, nombre y celular (7-12 dígitos) son obligatorios.');
        return;
      }
      participantes.push(p);
    }
    const anyFlags = participantesRaw.map(p => (p.nombre || p.cel || p.mail) ? 1 : 0);
    if(participantes.length === 1 && !anyFlags[0]){
      alert('Si el equipo tiene un único participante, debe registrarse como Participante 1.');
      return;
    }
    if(participantes.length === 0){
      alert('Debes registrar al menos 1 participante.');
      return;
    }
    state.participantes[data.id] = participantes; // puede ser [] si no se agregan participantes
    saveState();
    refreshEquipoSelect();
    refreshTablaPuntajes();
    form.reset();
    enableParticipantFields(false);
    ['#p1Nombre','#p1Cel','#p1Mail','#p2Nombre','#p2Cel','#p2Mail','#p3Nombre','#p3Cel','#p3Mail']
      .forEach(id=>{ const el = qs(id); if(el){ el.value=''; }});
    alert('Equipo y participantes registrados correctamente');
  });
  limpiar.addEventListener('click', ()=> form.reset());
}

// Formulario participantes (3)
function setupParticipantes(){ /* participantes gestionados al registrar el equipo */ }

// Puntajes
function setupScores(){
  const juradoSel = qs('#ronda');
  const puntajeInp = qs('#puntaje');
  const addBtn = qs('#btnAgregarPuntaje');

  function updateControls(){
    const jur = juradoSel.value;
    const ok = jur.startsWith('Jurado') && !!jurorAuth[jur];
    puntajeInp.disabled = !ok;
    addBtn.disabled = !ok;
    const st = qs('#jurorStatus');
    if(jur.startsWith('Jurado')){
      if(ok){ st.textContent = `${jur} autenticado`; st.classList.add('ok'); }
      else { st.textContent = `Puntaje bloqueado. Autentique ${jur}`; st.classList.remove('ok'); }
    } else {
      st.textContent = 'Seleccione un jurado para autenticar';
      st.classList.remove('ok');
    }
  }

  function requireJuror(){
    const jur = juradoSel.value;
    if(!jur.startsWith('Jurado')){ updateControls(); return; }
    if(jurorAuth[jur]){ updateControls(); return; }
    openJurorModal(jur, (ok)=>{
      if(ok){
        jurorAuth[jur] = true; saveJurorAuth();
        updateControls();
      }else{ updateControls(); }
    });
  }

  juradoSel.addEventListener('change', requireJuror);
  updateControls();

  addBtn.addEventListener('click', ()=>{
    const jur = juradoSel.value;
    if(!jurorAuth[jur]){ requireJuror(); return; }
    const id = qs('#equipoScore').value;
    if(!id){ alert('Selecciona un equipo'); return; }
    const ronda = juradoSel.value;
    const puntaje = parseInt(qs('#puntaje').value, 10) || 0;
    if(!state.puntajes[id]) state.puntajes[id] = {};
    state.puntajes[id][ronda] = puntaje;
    saveState();
    refreshTablaPuntajes();
  });

  // Limpiar tabla (vista) y podio sin borrar storage
  const btnLimpiar = qs('#btnLimpiarTablas');
  if(btnLimpiar){
    btnLimpiar.addEventListener('click', ()=>{
      const tbody = qs('#tablaPuntajes tbody');
      tbody.innerHTML = '';
      qs('#ganador1').textContent = '—';
      qs('#ganador2').textContent = '—';
      qs('#ganador3').textContent = '—';
    });
  }

  // Limpiar todo: formularios visibles y datos guardados (mantiene equipos si el usuario no confirma)
  const btnResetTodo = qs('#btnResetTodo');
  if(btnResetTodo){
    btnResetTodo.addEventListener('click', ()=>{
      const ok = window.confirm('¿Seguro que deseas limpiar TODO? Se vaciarán formularios, puntuaciones visibles y participantes guardados (se conservan los equipos).');
      if(!ok) return;
      // Limpia storage de puntajes y participantes; mantiene equipos
      state.puntajes = {};
      state.participantes = {};
      saveState();
      // Limpia UI
      const formEq = qs('#formRegistro');
      if(formEq) formEq.reset();
      const ids = ['#p1Nombre','#p1Cel','#p1Mail','#p2Nombre','#p2Cel','#p2Mail','#p3Nombre','#p3Cel','#p3Mail'];
      ids.forEach(id=>{ const el = qs(id); if(el){ el.value=''; el.disabled = true; }});
      qs('#puntaje').value = 0;
      // Limpiar selects de puntuación
      refreshEquipoSelect();
      const equipoSel = qs('#equipoScore');
      if(equipoSel){ equipoSel.value = ''; }
      const jurSel = qs('#ronda');
      if(jurSel){ jurSel.value = 'Elije jurado'; }
      const st = qs('#jurorStatus');
      if(st){ st.textContent = 'Seleccione un jurado para autenticar'; st.classList.remove('ok'); }
      const tbody = qs('#tablaPuntajes tbody');
      tbody.innerHTML = '';
      qs('#ganador1').textContent = '—';
      qs('#ganador2').textContent = '—';
      qs('#ganador3').textContent = '—';
      // Mensaje
      alert('Listo. Se limpiaron formularios, puntajes y participantes. Los equipos registrados se conservaron.');
    });
  }
}

// Modal de jurado
function openJurorModal(jurName, cb){
  const modal = qs('#jurorModal');
  const passInput = qs('#jurorPassword');
  const title = qs('#jurorModalTitle');
  const text = qs('#jurorModalText');
  const okBtn = qs('#jurorOk');
  const cancelBtn = qs('#jurorCancel');
  const closeBtn = qs('#jurorModalClose');
  const backdrop = qs('#jurorModalBackdrop');
  const toggle = qs('#togglePass');
  title.textContent = `Autenticación de ${jurName}`;
  text.textContent = 'Ingrese la clave para continuar.';
  passInput.value = '';
  // Resetear estado del campo y del ícono al abrir
  passInput.type = 'password';
  const eye = qs('.icon-eye');
  const eyeOff = qs('.icon-eye-off');
  if(eye && eyeOff){ eye.style.display='inline'; eyeOff.style.display='none'; }
  modal.classList.add('open');
  passInput.focus();
  function done(ok){
    modal.classList.remove('open');
    okBtn.removeEventListener('click', onOk);
    cancelBtn.removeEventListener('click', onCancel);
    closeBtn.removeEventListener('click', onCancel);
    backdrop.removeEventListener('click', onCancel);
    toggle.removeEventListener('click', onToggle);
    cb && cb(ok);
  }
  function onOk(){
    const pass = (passInput.value || '').trim();
    if(pass === JUROR_PASSWORD || pass === 'ecoingms'){
      done(true);
    } else {
      alert('Clave incorrecta');
      done(false);
    }
  }
  function onCancel(){ done(false); }
  function onToggle(){
    const show = passInput.type === 'password';
    passInput.type = show ? 'text' : 'password';
    if(show){ eye.style.display='none'; eyeOff.style.display='inline'; }
    else { eye.style.display='inline'; eyeOff.style.display='none'; }
  }
  okBtn.addEventListener('click', onOk);
  cancelBtn.addEventListener('click', onCancel);
  closeBtn.addEventListener('click', onCancel);
  backdrop.addEventListener('click', onCancel);
  toggle.addEventListener('click', onToggle);
}

// Podio
function setupPodio(){
  qs('#btnCalcularPodio').addEventListener('click', ()=>{
    calcularPodio();
    window.scrollTo({ top: qs('#podio').offsetTop - 60, behavior:'smooth' });
  });
}

// Exportación a Excel
function exportarExcel(){
  const RESPONSABLE_KEY = 'eco_heroes_export_responsable';
  const prev = (localStorage.getItem(RESPONSABLE_KEY) || '').trim();
  const responsable = (window.prompt('Nombre del responsable de la exportación:', prev) || (prev || 'Organizador')).trim();
  localStorage.setItem(RESPONSABLE_KEY, responsable);
  const fecha = new Date();
  const fechaTexto = fecha.toLocaleString();
  const rows = state.equipos.map(eq=>{
    const scores = state.puntajes[eq.id]||{};
    return {
      Equipo: eq.equipo,
      Institucion: eq.institucion,
      Grado: eq.grado,
      Contacto: eq.contactoNombre,
      Telefono: eq.contactoTelefono,
      Email: eq.contactoEmail,
      J1: scores['Jurado 1']||scores['Ronda 1']||0,
      J2: scores['Jurado 2']||scores['Ronda 2']||0,
      J3: scores['Jurado 3']||scores['Ronda 3']||0,
      Total: computeTotal(scores)
    };
  });
  const wsEquipos = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  // Resumen con metadatos
  const wsResumen = XLSX.utils.aoa_to_sheet([
    ['ECO-HÉROES — Exportación de datos'],
    ['Responsable', responsable],
    ['Fecha y hora', fechaTexto]
  ]);
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
  XLSX.utils.book_append_sheet(wb, wsEquipos, 'Equipos');

  // Segunda hoja: integrantes/participantes por equipo
  const rowsIntegrantes = [];
  state.equipos.forEach(eq=>{
    const lista = state.participantes[eq.id] || [];
    lista.forEach((p, idx)=>{
      rowsIntegrantes.push({
        Equipo: eq.equipo,
        Institucion: eq.institucion,
        Participante: idx+1,
        Nombre: p.nombre || '',
        Celular: p.cel || '',
        Email: p.mail || ''
      });
    });
  });
  const wsIntegrantes = XLSX.utils.json_to_sheet(rowsIntegrantes);
  XLSX.utils.book_append_sheet(wb, wsIntegrantes, 'Integrantes');

  // Nombre de archivo recordado
  const FILE_NAME_KEY = 'eco_heroes_export_filename';
  const prevName = (localStorage.getItem(FILE_NAME_KEY) || 'eco_heroes_datos.xlsx').trim();
  let fileName = (window.prompt('Nombre de archivo (.xlsx):', prevName) || prevName).trim() || 'eco_heroes_datos.xlsx';
  if(!/\.(xlsx)$/i.test(fileName)) fileName += '.xlsx';
  localStorage.setItem(FILE_NAME_KEY, fileName);
  try{
    XLSX.writeFile(wb, fileName);
  }catch(e){
    console.error('Excel export error', e);
    alert('No se pudo generar el archivo. Verifica permisos del navegador y vuelve a intentar.');
  }
}

// Chatbot simple basado en reglas
const FAQ = [
  { q: /(hora|horario|cuando|fecha)/i, a: 'El evento es el 30 de octubre de 7:30 a. m. a 12:00 m.' },
  { q: /(quien|quién|puede participar|grado|requisitos)/i, a: 'Participan estudiantes de grado 10 u 11 y SENA, en equipos.' },
  { q: /(lugar|donde|ubicaci[oó]n)/i, a: 'Sede: Universidad Simón Bolívar (Cúcuta). Ver afiche o confirmación.' },
  { q: /(inscrip|registro|formulario)/i, a: 'Inscríbete en la sección "Inscripción" o escaneando el QR.' },
  { q: /(reglas|puntaje|criterios|jurado)/i, a: 'Los jurados califican y la plataforma calcula automáticamente el podio.' },
  { q: /(qu[ié]n organiza|organiz(a|an)|organizadores|responsable)/i, a: 'Organiza la Universidad Simón Bolívar, con los programas de Ingeniería de Sistemas e Ingeniería Mecánica.' },
  { q: /(contacto|tel[eé]fono|correo|email)/i, a: 'Contacto: 3125508421 · leydi.martinezb@unisimon.edu.co' },
];

function chatbotAnswer(text){
  // No limitar a palabra clave estricta para mejorar cobertura
  const f = FAQ.find(f=> f.q.test(text));
  return f ? f.a : 'Puedo ayudarte con horario, inscripción, requisitos, jurados y podio. ¿Qué deseas saber?';
}

function pushMessage(who, text){
  const wrap = document.createElement('div');
  wrap.className = `chatbot-bubble ${who}`;
  wrap.textContent = text;
  qs('#chatMessages').appendChild(wrap);
  qs('#chatMessages').scrollTop = qs('#chatMessages').scrollHeight;
}

function setupChatbot(){
  const toggle = qs('#chatbotToggle');
  const panel = qs('#chatbot');
  const closeBtn = qs('#chatbotClose');
  toggle.addEventListener('click', ()=> panel.classList.add('open'));
  closeBtn.addEventListener('click', ()=> panel.classList.remove('open'));
  const form = qs('#chatForm');
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const text = qs('#chatText').value.trim();
    if(!text) return;
    pushMessage('user', text);
    setTimeout(()=> pushMessage('bot', chatbotAnswer(text)), 200);
    qs('#chatText').value = '';
  });
}

// Avatar flotante eliminado (ya no se necesita JS)
function setupAvatar(){ /* no-op */ }

// Export button injection
function setupExport(){
  const bar = document.createElement('div');
  bar.style.textAlign = 'center';
  bar.style.marginTop = '10px';
  const btn = document.createElement('button');
  btn.className = 'btn btn-ghost btn-pulse';
  btn.textContent = 'Descargar Excel participantes';
  btn.addEventListener('click', exportarExcel);
  qs('#puntajes .container').appendChild(bar).appendChild(btn);
}

// Inicialización
window.addEventListener('DOMContentLoaded', ()=>{
  loadState();
  loadJurorAuth();
  setupForm();
  setupScores();
  setupPodio();
  setupChatbot();
  setupAvatar();
  setupExport();
  setupParticipantes();
  refreshEquipoSelect();
  refreshTablaPuntajes();
  calcularPodio();
  setupReveals();
  setupParallaxCards();
  highlightCTAs();
});

// Scroll reveal simple
function setupReveals(){
  const els = qsa('.reveal');
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        e.target.classList.add('revealed');
        io.unobserve(e.target);
      }
    });
  },{threshold:0.12});
  els.forEach(el=> io.observe(el));
  // pulso flash a los CTA del hero
  const heroCta = qsa('.hero-cta .btn.btn-primary');
  heroCta.forEach(b=> b.classList.add('flash'));
}

// Parallax sutil en tarjetas al mover el mouse
function setupParallaxCards(){
  const cards = qsa('.card');
  cards.forEach(card=>{
    card.classList.add('parallax');
    card.addEventListener('mousemove', (e)=>{
      const r = card.getBoundingClientRect();
      const cx = e.clientX - r.left; const cy = e.clientY - r.top;
      const rx = ((cy/r.height)-0.5)*-6; // inclinación
      const ry = ((cx/r.width)-0.5)*6;
      card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    });
    card.addEventListener('mouseleave', ()=>{
      card.style.transform = 'rotateX(0deg) rotateY(0deg)';
    });
  });
}

// Pulso en CTAs principales
function highlightCTAs(){
  qsa('.hero-cta .btn').forEach(btn=> btn.classList.add('btn-pulse'));
  const calc = qs('#btnCalcularPodio');
  if(calc) calc.classList.add('btn-pulse');
  // también el botón de exportar si ya existe
  qsa('#puntajes .container .btn').forEach(b=>{
    if(b.textContent && b.textContent.toLowerCase().includes('excel')){
      b.classList.add('btn-pulse');
    }
  });
}


