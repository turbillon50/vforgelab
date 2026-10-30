'use strict';

(() => {
  const $ = (id) => document.getElementById(id);
  const apiBase = (document.body.dataset.apiBase || '/mia').replace(/\/$/, '');
  const viewNames = { alix: 'Chat', energia: 'Energía', branches: 'Escáner' };
  const state = {
    connected: false, generation: 0, view: 'alix', history: [], newConversation: false,
    branches: [], branchesConnected: false, branchMessage: '', filter: 'all', sending: false, energyLoading: false,
    branchesLoading: false, chatAbort: null, lastEnergy: null,
  };
  let toastTimer;

  function text(id, value) { $(id).textContent = String(value); }
  function showMessage(id, value) {
    const node = $(id);
    node.textContent = value || '';
    node.hidden = !value;
  }
  function toast(message) {
    clearTimeout(toastTimer);
    showMessage('toast', message);
    toastTimer = setTimeout(() => showMessage('toast', ''), 4500);
  }
  function icon(name) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    node.setAttribute('aria-hidden', 'true');
    use.setAttribute('href', '#i-' + name);
    node.append(use);
    return node;
  }
  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  }
  function finite(value) {
    if (value === null || value === '' || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  function numberLabel(number, digits = 1) {
    return number === null ? '—' : new Intl.NumberFormat('es-MX', {
      maximumFractionDigits: digits,
    }).format(number);
  }
  function openDialog(id) {
    const dialog = $(id);
    if (!dialog.open) dialog.showModal();
  }
  function updateConnection() {
    document.body.classList.toggle('connected', state.connected);
    text('connection-label', state.connected ? 'Conectado' : 'Conectar');
    text('side-status', state.connected ? 'NVIDIA · Nebius conectado' : 'Iniciando conexión…');
    text('side-detail', state.connected ? 'Historial y memoria en Neon' : 'Sesión de demostración');
    $('disconnect').hidden = true;
  }
  function resetChat() {
    state.history = [];
    text('chat-proof', 'Sesión de demostración · historial persistente en Neon.');
    $('conversation').querySelectorAll('.message').forEach((node) => node.remove());
    $('welcome').hidden = false;
    $('message').value = '';
    $('message').style.height = '';
    showMessage('chat-notice', '');
  }
  function clearPrivateData() {
    resetChat();
    state.branches = [];
    state.lastEnergy = null;
    ['disk-pct', 'disk-free', 'ram-value', 'load-value', 'load-five', 'load-fifteen'].forEach((id) => text(id, '—'));
    text('disk-total', 'Esperando lectura del servidor');
    text('disk-state', '—');
    text('ram-total', 'Sin lectura');
    text('process-count', '— procesos');
    text('daemon-status', 'Sin lectura');
    $('daemon-status').className = 'state-chip';
    $('disk-ring').style.setProperty('--used', '0%');
    $('ram-meter').style.width = '0%';
    $('processes').replaceChildren(element('div', 'empty-state', 'Conecta tu espacio para consultar los procesos reales.'));
    $('branch-list').replaceChildren(element('div', 'empty-state', 'Escanea para conocer qué ocupa espacio en tu servidor.'));
    text('branch-count', '—');
    $('branch-space').replaceChildren(document.createTextNode('—'), element('small', '', ' GB'));
    text('energy-updated', 'No se han recibido datos.');
    setEnergyBadge('Sin lectura', false);
    showMessage('energy-error', '');
    showMessage('branch-error', '');
  }
  function disconnect(message) {
    state.generation += 1;
    state.chatAbort?.abort();
    state.connected = false;
    clearPrivateData();
    updateConnection();
    if (message) toast(message);
  }

  class RequestError extends Error {
    constructor(message, status = 0) { super(message); this.status = status; }
  }
  async function request(path, { method = 'GET', body, signal, timeout = 25000 } = {}) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, timeout);
    try {
      const response = await fetch(apiBase + path, {
        method, cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      if (response.status === 401 || response.status === 403) {
        throw new RequestError('La sesión terminó. Pulsa Conectar para continuar.', response.status);
      }
      if (!response.ok) throw new RequestError('El servidor no pudo completar la consulta. Intenta otra vez.', response.status);
      const result = await response.json().catch(() => { throw new RequestError('El servidor devolvió una respuesta que no se pudo leer.'); });
      if (!result || result.ok !== true) throw new RequestError('El servidor no pudo completar la consulta. Intenta otra vez.');
      return result;
    } catch (error) {
      if (error instanceof RequestError) throw error;
      if (error.name === 'AbortError') throw new RequestError('La consulta se interrumpió o tardó demasiado. Puedes volver a intentarlo.');
      throw new RequestError('No hay conexión con tu servidor. Revisa tu conexión e intenta otra vez.');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
  function handleAccessError(error) {
    if ((error.status === 401 || error.status === 403) && state.connected) {
      disconnect('La sesión terminó. Vuelve a conectar tu espacio.');
    }
  }

  function navigate(view, { updateHash = true, load = true } = {}) {
    if (!viewNames[view]) view = 'alix';
    state.view = view;
    window.scrollTo(0, 0);
    document.querySelectorAll('.view').forEach((node) => node.classList.toggle('active', node.id === view));
    document.querySelectorAll('nav [data-view]').forEach((node) => {
      const active = node.dataset.view === view;
      node.classList.toggle('active', active);
      if (active) node.setAttribute('aria-current', 'page');
      else node.removeAttribute('aria-current');
    });
    text('crumb', viewNames[view]);
    if (updateHash && location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
    if (load && state.connected) {
      if (view === 'energia') loadEnergy();
      if (view === 'branches') loadBranches();
    }
  }
  document.querySelectorAll('[data-view]').forEach((node) => node.addEventListener('click', () => navigate(node.dataset.view)));
  window.addEventListener('hashchange', () => navigate(location.hash.slice(1), { updateHash: false }));
  document.querySelectorAll('[data-connect]').forEach((node) => node.addEventListener('click', () => {
    showMessage('connect-error', '');
    openDialog('connect-dialog');
  }));
  document.querySelectorAll('[data-close]').forEach((node) => node.addEventListener('click', () => $(node.dataset.close).close()));
  document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  }));
  $('disconnect').addEventListener('click', () => {
    disconnect('Tu espacio se desconectó de este navegador.');
    $('connect-dialog').close();
  });

  async function bootstrapSession() {
    showMessage('connect-error', 'Conectando con VForgeLab…');
    try {
      const session = await request('/api/session', { method: 'POST', body: {} });
      if (!state.history.length && Array.isArray(session.messages)) {
        for (const item of session.messages) {
          if (item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string') {
            message(item.role, item.content);
            state.history.push({ role: item.role, content: item.content });
          }
        }
      }
      state.connected = true;
      updateConnection();
      showMessage('connect-error', '');
      $('connect-dialog').close();
      loadEnergy();
      if (state.view === 'branches') loadBranches();
    } catch (error) {
      state.connected = false;
      updateConnection();
      showMessage('connect-error', error.message);
      showMessage('chat-notice', error.message);
    }
  }
  $('connect-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = event.currentTarget.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    try { await bootstrapSession(); }
    finally { submit.disabled = false; submit.removeAttribute('aria-busy'); }
  });

  function message(role, content) {
    $('welcome').hidden = true;
    const node = element('div', 'message ' + role, content);
    $('conversation').append(node);
    $('conversation').scrollTop = $('conversation').scrollHeight;
    return node;
  }
  function resizeComposer() {
    $('message').style.height = 'auto';
    $('message').style.height = Math.min($('message').scrollHeight, 140) + 'px';
  }
  $('message').addEventListener('input', resizeComposer);
  $('message').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (!state.sending) $('chat-form').requestSubmit();
    }
  });
  document.querySelectorAll('[data-prompt]').forEach((node) => node.addEventListener('click', () => {
    $('message').value = node.dataset.prompt;
    resizeComposer();
    $('message').focus();
  }));
  $('new-chat').addEventListener('click', () => {
    if (state.sending) return toast('Espera a que termine la respuesta para abrir otro chat.');
    resetChat();
    state.newConversation = true;
    $('message').focus();
  });
  $('chat-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const content = $('message').value.trim();
    if (!content || state.sending) return;
    if (!state.connected) { openDialog('connect-dialog'); return; }
    const generation = state.generation;
    state.sending = true;
    $('send').disabled = true;
    $('chat-form').setAttribute('aria-busy', 'true');
    showMessage('chat-notice', '');
    message('user', content);
    $('message').value = '';
    resizeComposer();
    const pending = message('assistant pending', 'Nemotron está pensando…');
    state.chatAbort = new AbortController();
    try {
      const result = await request('/api/chat', {
        method: 'POST', body: { mensaje: content, ...(state.newConversation ? { new_conversation: true } : {}) },
        timeout: 130000, signal: state.chatAbort.signal,
      });
      if (generation !== state.generation) return;
      if (typeof result.texto !== 'string' || !result.texto.trim()) {
        throw new RequestError('El modelo no devolvió texto. Tu mensaje sigue disponible para volver a intentarlo.');
      }
      pending.classList.remove('pending');
      pending.textContent = result.texto;
      const latency = finite(result.latency_ms);
      text('chat-proof', 'NVIDIA Nemotron' + (latency === null ? '' : ' · ' + numberLabel(latency, 0) + ' ms') + ' · respuesta guardada');
      state.newConversation = false;
      state.history.push({ role: 'user', content }, { role: 'assistant', content: result.texto });
      state.history = state.history.slice(-8);
    } catch (error) {
      if (generation !== state.generation) return;
      pending.remove();
      handleAccessError(error);
      if (generation !== state.generation) return;
      showMessage('chat-notice', error.message);
      if (!$('message').value) { $('message').value = content; resizeComposer(); }
    } finally {
      state.sending = false;
      state.chatAbort = null;
      $('send').disabled = false;
      $('chat-form').removeAttribute('aria-busy');
      $('conversation').scrollTop = $('conversation').scrollHeight;
    }
  });

  function setEnergyBadge(label, good) {
    const dot = element('span', 'status-dot' + (good ? ' good' : ''));
    $('energy-live').replaceChildren(dot, document.createTextNode(label));
  }
  function renderEnergy(data) {
    const pct = finite(String(data.disco?.pct ?? '').replace('%', ''));
    const totalRam = finite(data.ram?.total_mb);
    const freeRam = finite(data.ram?.libre_mb);
    const pctBounded = pct === null ? 0 : Math.min(100, Math.max(0, pct));
    text('disk-pct', pct === null ? '—' : numberLabel(pct, 0) + '%');
    text('disk-free', typeof data.disco?.libre === 'string' ? data.disco.libre : '—');
    text('disk-total', typeof data.disco?.total === 'string' ? 'de ' + data.disco.total + ' en total' : 'Sin lectura de capacidad');
    text('disk-state', pct === null ? 'Sin lectura' : pct >= 90 ? 'ESPACIO LIMITADO' : 'LECTURA RECIBIDA');
    $('disk-ring').style.setProperty('--used', pctBounded + '%');
    $('disk-ring').style.setProperty('--ring-color', pct !== null && pct >= 90 ? '#f0ba8e' : '#8fcaff');
    text('ram-value', freeRam === null ? '—' : numberLabel(freeRam / 1024) + ' GB');
    text('ram-total', totalRam === null ? 'Sin lectura' : 'disponibles de ' + numberLabel(totalRam / 1024) + ' GB');
    $('ram-meter').style.width = totalRam > 0 && freeRam !== null ? Math.min(100, Math.max(0, freeRam / totalRam * 100)) + '%' : '0%';
    text('load-value', numberLabel(finite(data.load?.[0]), 2));
    text('load-five', numberLabel(finite(data.load?.[1]), 2));
    text('load-fifteen', numberLabel(finite(data.load?.[2]), 2));
    const processes = Array.isArray(data.procesos) ? data.procesos.filter((item) => item && typeof item.name === 'string') : [];
    text('process-count', processes.length + ' procesos recibidos');
    const daemon = processes.find((item) => item.name === 'vulcano');
    const daemonOnline = daemon ? daemon.estado === 'online' : data.daemon === 'vivo';
    const hasDaemon = Boolean(daemon) || ['vivo', 'caido', 'caído'].includes(data.daemon);
    text('daemon-status', !hasDaemon ? 'Sin lectura' : daemonOnline ? 'En ejecución' : 'Sin ejecución');
    $('daemon-status').className = 'state-chip' + (hasDaemon ? daemonOnline ? ' good' : ' bad' : '');
    const rows = processes.map((process) => {
      const online = process.estado === 'online';
      const row = element('div', 'process-row');
      row.append(element('span', 'status-dot ' + (online ? 'good' : 'bad')),
        element('strong', '', process.name),
        element('small', '', online ? 'En ejecución' : typeof process.estado === 'string' ? process.estado : 'Sin estado'));
      return row;
    });
    $('processes').replaceChildren(...(rows.length ? rows : [element('div', 'empty-state', 'No se han conectado lecturas de procesos.') ]));
    state.lastEnergy = data.observed_at && Number.isFinite(Date.parse(data.observed_at)) ? new Date(data.observed_at) : null;
    text('energy-updated', state.lastEnergy ? 'Medido: ' + state.lastEnergy.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' }) : 'Fecha de observación no disponible.');
    const fresh = state.lastEnergy && Date.now() - state.lastEnergy.getTime() < 90000;
    setEnergyBadge(fresh ? 'Lectura reciente' : 'Última lectura guardada', Boolean(fresh));
    showMessage('energy-error', '');
  }
  async function loadEnergy() {
    if (state.energyLoading) return;
    if (!state.connected) { openDialog('connect-dialog'); return; }
    const generation = state.generation;
    state.energyLoading = true;
    $('refresh-energy').disabled = true;
    $('energia').setAttribute('aria-busy', 'true');
    setEnergyBadge('Consultando…', false);
    try {
      const result = await request('/api/energia');
      if (generation === state.generation) renderEnergy(result);
    } catch (error) {
      if (generation !== state.generation) return;
      handleAccessError(error);
      if (generation !== state.generation) return;
      showMessage('energy-error', error.message + (state.lastEnergy ? ' Los valores visibles corresponden a la última lectura.' : ''));
      setEnergyBadge(state.lastEnergy ? 'Lectura anterior' : 'Sin lectura', false);
    } finally {
      state.energyLoading = false;
      $('refresh-energy').disabled = false;
      $('energia').removeAttribute('aria-busy');
    }
  }
  $('refresh-energy').addEventListener('click', loadEnergy);

  function renderBranches() {
    if (!state.branchesConnected) {
      text('branch-count', 'Sin conectar');
      $('branch-space').replaceChildren(document.createTextNode('—'), element('small', '', ' GB'));
      $('branch-list').replaceChildren(element('div', 'empty-state', state.branchMessage || 'Escáner de copias de trabajo sin conectar.'));
      return;
    }
    const clean = state.branches.filter((item) => item.limpio === true);
    const cleanMb = clean.reduce((sum, item) => sum + item.mb, 0);
    $('branch-space').replaceChildren(document.createTextNode(numberLabel(cleanMb / 1024, 2)), element('small', '', ' GB'));
    text('branch-count', state.branches.length);
    const items = state.branches.filter((item) => state.filter === 'all' || (state.filter === 'clean' ? item.limpio === true : item.limpio !== true));
    const rows = items.map((item) => {
      const row = element('div', 'branch-row');
      const title = element('div', 'branch-name');
      title.append(element('strong', '', item.worktree), element('small', '', 'Copia de trabajo local'));
      const size = element('span', 'branch-size', item.mb >= 1024 ? numberLabel(item.mb / 1024, 2) + ' GB' : numberLabel(item.mb, 0) + ' MB');
      const clean = item.limpio === true;
      const status = element('span', 'branch-state' + (clean ? '' : ' dirty'), clean ? 'Sin cambios' : 'Con cambios');
      const review = element('button', 'review-button', clean ? 'Revisar' : 'Protegida');
      review.type = 'button';
      review.disabled = !clean;
      if (clean) review.addEventListener('click', () => {
        text('branch-dialog-name', item.worktree);
        text('branch-dialog-size', size.textContent + ' en esta copia de trabajo.');
        openDialog('branch-dialog');
      });
      row.append(icon('branch'), title, size, status, review);
      return row;
    });
    $('branch-list').replaceChildren(...(rows.length ? rows : [element('div', 'empty-state', state.branches.length ? 'No hay copias que coincidan con este filtro.' : 'El escaneo no devolvió copias de trabajo.') ]));
    document.querySelectorAll('[data-filter]').forEach((button) => {
      const selected = button.dataset.filter === state.filter;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }
  async function loadBranches() {
    if (state.branchesLoading) return;
    if (!state.connected) { openDialog('connect-dialog'); return; }
    state.branchesLoading = true;
    const generation = state.generation;
    $('scan-branches').disabled = true;
    $('branches').setAttribute('aria-busy', 'true');
    showMessage('branch-error', '');
    try {
      const result = await request('/api/branches', { timeout: 60000 });
      if (generation !== state.generation) return;
      if (!Array.isArray(result.worktrees)) throw new RequestError('El servidor no devolvió una lista de copias de trabajo.');
      state.branchesConnected = result.connected !== false;
      state.branchMessage = typeof result.message === 'string' ? result.message : '';
      state.branches = result.worktrees.filter((item) => item && typeof item.worktree === 'string' && finite(item.mb) !== null && Number(item.mb) >= 0)
        .map((item) => ({ worktree: item.worktree, mb: Number(item.mb), limpio: item.limpio === true }))
        .sort((a, b) => b.mb - a.mb);
      renderBranches();

    } catch (error) {
      if (generation !== state.generation) return;
      handleAccessError(error);
      if (generation !== state.generation) return;
      showMessage('branch-error', error.message + (state.branches.length ? ' La lista visible corresponde al escaneo anterior.' : ''));
    } finally {
      state.branchesLoading = false;
      $('scan-branches').disabled = false;
      $('branches').removeAttribute('aria-busy');
    }
  }
  $('scan-branches').addEventListener('click', loadBranches);
  document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => {
    state.filter = button.dataset.filter;
    if (state.connected) renderBranches();
  }));

  setInterval(() => {
    if (state.connected && state.view === 'energia' && !document.hidden) loadEnergy();
  }, 15000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.connected && state.view === 'energia') loadEnergy();
  });
  window.addEventListener('offline', () => toast('Sin conexión. Los datos no se están actualizando.'));
  window.addEventListener('online', () => {
    toast('Conexión recuperada.');
    if (state.connected && state.view === 'energia') loadEnergy();
  });

  // Service credentials are never accepted from the public browser.
  const url = new URL(location.href);
  if (url.searchParams.has('tok')) {
    url.searchParams.delete('tok');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  try { sessionStorage.removeItem('mia.session.token.v1'); } catch {}
  navigate(location.hash.slice(1), { updateHash: false, load: false });
  updateConnection();
  bootstrapSession();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
      // The app remains usable online if the host does not serve a service worker.
    });
  }
})();

