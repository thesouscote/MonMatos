import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
    import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
    import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, getDocs, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

    const firebaseConfig = {
      apiKey: "AIzaSyDVnreASR57tBfe_i98c5Vf-UCwCCk4xXI",
      authDomain: "monmatos-6b83b.firebaseapp.com",
      databaseURL: "https://monmatos-6b83b-default-rtdb.firebaseio.com",
      projectId: "monmatos-6b83b",
      storageBucket: "monmatos-6b83b.firebasestorage.app",
      messagingSenderId: "490612390863",
      appId: "1:490612390863:web:e7b0da6aa59038e0c7f0ba",
      measurementId: "G-VM5BL6ELF9"
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    // ── STATE ──
    let currentUser = null;
    let userData = { categories: [], items: [], sessions: [] };
    let activePhase = 'arrive';
    let activeParentSessionId = null;
    let currentSavePhase = null;
    let borrowedItems = [];

    const DEFAULT = {
      categories: ["Caméra", "Audio", "Lumière", "Support", "Stockage", "Alimentation", "Divers"],
      items: [
        { id: 1, name: "Caméra principale", cat: "Caméra", qty: 1 },
        { id: 2, name: "Objectifs", cat: "Caméra", qty: 3 },
        { id: 3, name: "Filtres ND", cat: "Caméra", qty: 1 },
        { id: 4, name: "Enregistreur audio", cat: "Audio", qty: 1 },
        { id: 5, name: "Micro perche", cat: "Audio", qty: 1 },
        { id: 6, name: "Micro cravate", cat: "Audio", qty: 2 },
        { id: 7, name: "Casque monitoring", cat: "Audio", qty: 1 },
        { id: 8, name: "Panneau LED", cat: "Lumière", qty: 2 },
        { id: 9, name: "Réflecteurs", cat: "Lumière", qty: 2 },
        { id: 10, name: "Trépied caméra", cat: "Support", qty: 1 },
        { id: 11, name: "Trépied lumière", cat: "Support", qty: 2 },
        { id: 12, name: "Slider / gimbal", cat: "Support", qty: 1 },
        { id: 13, name: "Cartes SD", cat: "Stockage", qty: 4 },
        { id: 14, name: "Disque dur externe", cat: "Stockage", qty: 1 },
        { id: 15, name: "Batteries caméra", cat: "Alimentation", qty: 4 },
        { id: 16, name: "Chargeurs", cat: "Alimentation", qty: 2 },
        { id: 17, name: "Multiprise", cat: "Alimentation", qty: 1 },
        { id: 18, name: "Laptop", cat: "Divers", qty: 1 },
        { id: 19, name: "Câbles HDMI", cat: "Divers", qty: 3 },
      ]
    };

    // ── FIREBASE AUTH ──
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        currentUser = user;
        await loadUserData();
        hideLoader();
        showPage('page-home');
        renderHome();
      } else {
        currentUser = null;
        hideLoader();
        showPage('page-auth');
      }
    });

    async function loadUserData() {
      const ref = doc(db, 'users', currentUser.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        userData = snap.data();
        if (!userData.sessions) userData.sessions = [];
      } else {
        userData = { ...JSON.parse(JSON.stringify(DEFAULT)), sessions: [] };
        await setDoc(ref, userData);
      }
      // Init checked state
      userData.items = (userData.items || []).map(i => ({ ...i, checkedArrive: false, checkedDepart: false }));
    }

    async function saveUserData() {
      const ref = doc(db, 'users', currentUser.uid);
      await setDoc(ref, userData);
    }

    window.doRegister = async () => {
      const prenom = document.getElementById('reg-prenom').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const pwd = document.getElementById('reg-pwd').value;
      const err = document.getElementById('auth-error');
      err.style.display = 'none';
      if (!prenom || !email || !pwd) { showError('Remplis tous les champs !'); return; }
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, pwd);
        await updateProfile(cred.user, { displayName: prenom });
        showToast(`Bienvenue ${prenom} 🎬`);
      } catch (e) {
        showError(firebaseMsg(e.code));
      }
    };

    window.doLogin = async () => {
      const email = document.getElementById('login-email').value.trim();
      const pwd = document.getElementById('login-pwd').value;
      document.getElementById('auth-error').style.display = 'none';
      try {
        await signInWithEmailAndPassword(auth, email, pwd);
      } catch (e) {
        showError(firebaseMsg(e.code));
      }
    };

    window.doLogout = async () => {
      await signOut(auth);
      closeModal('modal-profile');
      userData = { categories: [], items: [], sessions: [] };
    };

    // ── NAVIGATION ──
    window.showPage = (id) => {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById(id).classList.add('active');
      window.scrollTo(0, 0);
    };

    window.setNav = (which) => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      const map = { home: 0, hist: 1, gest: 2 };
      const pages = ['page-home', 'page-historique', 'page-gestion'];
      const activePage = document.querySelector('.page.active');
      if (!activePage) return;
      const navs = activePage.querySelectorAll('.nav-item');
      navs.forEach(n => n.classList.remove('active'));
      if (navs[map[which]]) navs[map[which]].classList.add('active');
    };

    // ── HOME ──
    function renderHome() {
      const prenom = currentUser?.displayName || 'Réalisateur';
      document.getElementById('greeting-name').textContent = prenom;
      document.getElementById('avatar-btn').textContent = prenom[0].toUpperCase();
      document.getElementById('home-date').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

      document.getElementById('stat-items').textContent = (userData.items || []).length;
      document.getElementById('stat-sessions').textContent = (userData.sessions || []).length;
      document.getElementById('stat-cats').textContent = (userData.categories || []).length;

      const recent = (userData.sessions || []).slice(0, 3);
      const cont = document.getElementById('recent-sessions');
      if (!recent.length) {
        cont.innerHTML = `<div class="empty-state"><span class="icon">🎬</span><p>Aucune session encore.<br>Lance ta première checklist !</p></div>`;
        return;
      }
      cont.innerHTML = recent.map(s => {
        const pct = s.total ? Math.round(s.checked / s.total * 100) : 0;
        const badge = pct === 100 ? '<span class="badge badge-ok">Complet</span>' : `<span class="badge badge-partial">${s.checked}/${s.total}</span>`;
        const date = new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        return `<div class="session-item">
      <div class="session-item-top">
        <span class="session-item-name">${s.name}</span>
        ${badge}
      </div>
      <div class="session-item-meta">${date} • ${s.phase === 'depart' ? '📦 Retour' : '🎬 Départ'}</div>
      <div class="session-progress"><div class="session-progress-fill" style="width:${pct}%"></div></div>
    </div>`;
      }).join('');
    }

    // ── CHECKLIST ──
    window.goChecklist = (phase) => {
      activePhase = phase;
      userData.items = (userData.items || []).map(i => ({ ...i, checkedArrive: false, checkedDepart: false }));
      borrowedItems = [];
      if (phase === 'arrive') {
        showPage('page-checklist');
        renderChecklist();
      } else {
        showPage('page-depart');
        renderDepartChecklist();
      }
    };

    function renderChecklist() {
      const items = userData.items || [];
      const cats = userData.categories || [];
      const checked = items.filter(i => i.checkedArrive).length;
      const total = items.length;

      document.getElementById('checklist-progress').textContent = `${checked}/${total}`;
      document.getElementById('arrive-done-banner').style.display = (total > 0 && checked === total) ? 'block' : 'none';

      let html = '';
      cats.forEach(cat => {
        const catItems = items.filter(i => i.cat === cat);
        if (!catItems.length) return;
        html += `<div class="cat-label">${cat}</div>`;
        catItems.forEach(item => {
          html += itemCardHTML(item, 'arrive');
        });
      });

      document.getElementById('checklist-body').innerHTML = html;
    }

    function renderDepartChecklist() {
      let items = userData.items || [];
      const cats = userData.categories || [];
      
      let parentSession = null;
      if (activeParentSessionId) {
          parentSession = (userData.sessions || []).find(s => s.id === activeParentSessionId);
      }
      
      let displayItems = [];
      if (parentSession && parentSession.snapshot) {
          const parentSnaps = parentSession.snapshot.filter(s => {
              const t = s.taken !== undefined ? s.taken : (s.checked ? s.qty : 0);
              return t > 0;
          });
          parentSnaps.forEach(snap => {
              const snapTaken = snap.taken !== undefined ? snap.taken : (snap.checked ? snap.qty : 0);
              const originalItem = items.find(i => i.id === snap.id);
              if (originalItem) {
                  displayItems.push({ ...originalItem, qty: snapTaken });
              } else {
                  const byName = items.find(i => i.name === snap.name);
                  if (byName) displayItems.push({ ...byName, qty: snapTaken });
              }
          });
      } else {
          displayItems = [...items];
      }

      const allItems = [...displayItems, ...borrowedItems];
      const checked = allItems.filter(i => i.checkedDepart).length;
      const total = allItems.length;

      document.getElementById('depart-progress').textContent = `${checked}/${total}`;
      document.getElementById('depart-done-banner').style.display = (total > 0 && checked === total) ? 'block' : 'none';

      let html = '';
      cats.forEach(cat => {
        const catItems = displayItems.filter(i => i.cat === cat);
        if (!catItems.length) return;
        html += `<div class="cat-label">${cat}</div>`;
        catItems.forEach(item => {
          html += itemCardHTML(item, 'depart');
        });
      });

      // Base du depart-body sans écraser le panel emprunt
      const departBody = document.getElementById('depart-body');
      const existingTop = departBody.querySelector('div[style]');
      const existingTopHTML = existingTop ? existingTop.outerHTML : '';

      departBody.innerHTML = existingTopHTML + html;

      renderBorrowedList();
    }

    function itemCardHTML(item, phase) {
      const isArrive = phase === 'arrive';
      const takenField = isArrive ? 'takenArrive' : 'takenDepart';
      const checkedField = isArrive ? 'checkedArrive' : 'checkedDepart';
      
      if (item[takenField] === undefined) {
        item[takenField] = item[checkedField] ? item.qty : 0;
      }
      
      const taken = item[takenField];
      const isChecked = taken === item.qty;
      const isPartial = taken > 0 && taken < item.qty;
      const checkClass = isChecked ? 'checked' : (isPartial ? 'partial' : '');

      const extra = item.borrowedFrom ? `<span style="font-size:11px; color:var(--warn);">→ Rendre à ${item.borrowedFrom}</span>` : '';
      
      let qtyControl = '';
      if (item.qty > 1) {
        qtyControl = `
          <div class="qty-selector" onclick="event.stopPropagation()">
            <button class="qty-btn" onclick="changeItemQty(${item.id || item._bid}, '${phase}', -1)">-</button>
            <span class="qty-val">${taken}/${item.qty}</span>
            <button class="qty-btn" onclick="changeItemQty(${item.id || item._bid}, '${phase}', 1)">+</button>
          </div>
        `;
      } else {
        qtyControl = `<span class="item-qty-badge">×1</span>`;
      }

      return `<div class="item-card ${checkClass}" onclick="toggleItem(${item.id || item._bid}, '${phase}')">
    <div class="check-circle"><div class="check-circle-inner" style="${isPartial ? 'opacity:1; border-left:none; border-right:none; border-top:none; transform:scale(0.8) translateY(-3px); border-color:#1a1000;' : ''}"></div></div>
    <div class="item-info">
      <div class="item-name-text">${item.name}</div>
      ${extra}
    </div>
    ${qtyControl}
  </div>`;
    }

    window.toggleItem = (id, phase) => {
      let item = (userData.items || []).find(i => i.id === id);
      if (!item) item = borrowedItems.find(i => i._bid === id);
      if (!item) return;

      const takenField = phase === 'arrive' ? 'takenArrive' : 'takenDepart';
      if (item[takenField] === undefined) item[takenField] = 0;

      let maxQty = item.qty;
      if (phase === 'depart' && activeParentSessionId) {
          const parentSession = userData.sessions.find(s => s.id === activeParentSessionId);
          if (parentSession) {
              const snap = parentSession.snapshot.find(s => s.id === id || s.name === item.name);
              if (snap) maxQty = snap.taken !== undefined ? snap.taken : (snap.checked ? snap.qty : 0);
          }
      }

      if (item[takenField] === maxQty) {
        item[takenField] = 0;
      } else {
        item[takenField] = maxQty;
      }
      
      if (phase === 'arrive') item.checkedArrive = (item[takenField] === maxQty);
      else item.checkedDepart = (item[takenField] === maxQty);

      if (phase === 'arrive') renderChecklist();
      else renderDepartChecklist();
    };

    window.changeItemQty = (id, phase, delta) => {
      let item = (userData.items || []).find(i => i.id === id);
      if (!item) item = borrowedItems.find(i => i._bid === id);
      if (!item) return;

      const takenField = phase === 'arrive' ? 'takenArrive' : 'takenDepart';
      if (item[takenField] === undefined) item[takenField] = 0;

      let maxQty = item.qty;
      if (phase === 'depart' && activeParentSessionId) {
          const parentSession = userData.sessions.find(s => s.id === activeParentSessionId);
          if (parentSession) {
              const snap = parentSession.snapshot.find(s => s.id === id || s.name === item.name);
              if (snap) maxQty = snap.taken !== undefined ? snap.taken : (snap.checked ? snap.qty : 0);
          }
      }

      let newQty = item[takenField] + delta;
      if (newQty < 0) newQty = 0;
      if (newQty > maxQty) newQty = maxQty;
      
      item[takenField] = newQty;
      if (phase === 'arrive') item.checkedArrive = (item[takenField] === maxQty);
      else item.checkedDepart = (item[takenField] === maxQty);

      if (phase === 'arrive') renderChecklist();
      else renderDepartChecklist();
    };

    window.resetPhase = (phase) => {
      if (phase === 'arrive') {
        userData.items.forEach(i => { i.checkedArrive = false; i.takenArrive = 0; });
        renderChecklist();
      } else {
        userData.items.forEach(i => { i.checkedDepart = false; i.takenDepart = 0; });
        borrowedItems = [];
        renderDepartChecklist();
      }
    };

    // ── BORROWED ITEMS ──
    window.toggleBorrowPanel = () => {
      const panel = document.getElementById('borrow-panel');
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    };

    window.addBorrowedItem = () => {
      const name = document.getElementById('borrow-name').value.trim();
      const from = document.getElementById('borrow-from').value.trim();
      const qty = parseInt(document.getElementById('borrow-qty').value) || 1;
      if (!name) { showToast('Donne un nom au mato emprunté !'); return; }
      borrowedItems.push({ _bid: Date.now(), name, borrowedFrom: from || null, qty, checkedDepart: false });
      document.getElementById('borrow-name').value = '';
      document.getElementById('borrow-from').value = '';
      document.getElementById('borrow-qty').value = '1';
      renderDepartChecklist();
      showToast(`${name} ajouté`);
    };

    function renderBorrowedList() {
      const container = document.getElementById('borrowed-list');
      if (!container) return;
      if (!borrowedItems.length) { container.innerHTML = ''; return; }
      container.innerHTML = borrowedItems.map(b =>
        `<div class="item-card ${b.checkedDepart ? 'checked' : ''}" onclick="toggleItem(${b._bid}, 'depart')">
      <div class="check-circle"><div class="check-circle-inner"></div></div>
      <div class="item-info">
        <div class="item-name-text">${b.name}</div>
        ${b.borrowedFrom ? `<span style="font-size:11px; color:var(--warn);">→ Rendre à ${b.borrowedFrom}</span>` : ''}
      </div>
      ${b.qty > 1 ? `<span class="item-qty-badge">×${b.qty}</span>` : ''}
      <button class="item-delete" onclick="removeBorrowed(${b._bid}, event)">×</button>
    </div>`
      ).join('');
    }

    window.removeBorrowed = (bid, e) => {
      e.stopPropagation();
      borrowedItems = borrowedItems.filter(b => b._bid !== bid);
      renderDepartChecklist();
    };

    // ── SAVE SESSION ──
    window.openSaveModal = (phase) => {
      currentSavePhase = phase;
      let targetItems = [];
      if (phase === 'arrive') {
          targetItems = userData.items;
      } else {
          targetItems = [...userData.items, ...borrowedItems];
          if (activeParentSessionId) {
              const p = userData.sessions.find(s => s.id === activeParentSessionId);
              if (p && p.snapshot) {
                  const snapItems = p.snapshot.filter(s => {
                      const t = s.taken !== undefined ? s.taken : (s.checked ? s.qty : 0);
                      return t > 0;
                  });
                  targetItems = [...borrowedItems];
                  snapItems.forEach(snap => {
                      const orig = userData.items.find(i => i.id === snap.id || i.name === snap.name);
                      if (orig) targetItems.push(orig);
                  });
              }
          }
      }
      const checked = targetItems.filter(i => phase === 'arrive' ? i.checkedArrive : i.checkedDepart).length;
      if (checked === 0) { showToast('Coche au moins un item !'); return; }
      const defaultName = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) + (phase === 'arrive' ? ' – Départ' : ' – Retour');
      document.getElementById('modal-session-name').value = defaultName;
      document.getElementById('modal-save-title').textContent = phase === 'arrive' ? 'Sauver le départ' : 'Sauver le retour';
      document.getElementById('modal-save-desc').textContent = phase === 'arrive' ? 'Donne un nom à ce tournage' : 'Vérifie que tout est rangé avant de sauver';
      const btn = document.getElementById('modal-save-confirm');
      btn.className = phase === 'depart' ? 'btn-confirm-depart' : 'btn-confirm-save';
      openModal('modal-save');
    };

    window.confirmSave = async () => {
      const name = document.getElementById('modal-session-name').value.trim() || 'Session sans nom';
      const phase = currentSavePhase;
      
      let targetItems = [];
      if (phase === 'arrive') {
          targetItems = userData.items;
      } else {
          targetItems = [...userData.items, ...borrowedItems];
          if (activeParentSessionId) {
              const p = userData.sessions.find(s => s.id === activeParentSessionId);
              if (p && p.snapshot) {
                  const snapItems = p.snapshot.filter(s => {
                      const t = s.taken !== undefined ? s.taken : (s.checked ? s.qty : 0);
                      return t > 0;
                  });
                  const newTargetList = [];
                  snapItems.forEach(snap => {
                      const snapTaken = snap.taken !== undefined ? snap.taken : (snap.checked ? snap.qty : 0);
                      const orig = userData.items.find(i => i.id === snap.id || i.name === snap.name);
                      if (orig) newTargetList.push({ ...orig, qty: snapTaken });
                  });
                  targetItems = [...newTargetList, ...borrowedItems];
              }
          }
      }

      const checked = targetItems.filter(i => phase === 'arrive' ? i.checkedArrive : i.checkedDepart).length;

      const session = {
        id: Date.now(),
        name,
        date: new Date().toISOString(),
        phase,
        total: targetItems.length,
        checked,
        snapshot: targetItems.map(i => {
          const taken = phase === 'arrive' ? (i.takenArrive !== undefined ? i.takenArrive : (i.checkedArrive ? i.qty : 0)) : (i.takenDepart !== undefined ? i.takenDepart : (i.checkedDepart ? i.qty : 0));
          return {
            id: i.id || i._bid,
            name: i.name, cat: i.cat || '', qty: i.qty,
            taken: taken,
            checked: phase === 'arrive' ? !!i.checkedArrive : !!i.checkedDepart,
            borrowedFrom: i.borrowedFrom || null
          };
        }),
        linkedToDepartId: phase === 'depart' ? activeParentSessionId : null
      };

      if (!userData.sessions) userData.sessions = [];
      userData.sessions.unshift(session);
      
      if (phase === 'depart' && activeParentSessionId) {
          const parent = userData.sessions.find(s => s.id === activeParentSessionId);
          if (parent) parent.isReturned = true;
      }
      await saveUserData();
      closeModal('modal-save');
      showToast(`Session "${name}" sauvegardée !`);
      showPage('page-home');
      setNav('home');
      renderHome();
    };

    // ── HISTORIQUE ──
    function renderHistorique() {
      const sessions = userData.sessions || [];
      const cont = document.getElementById('hist-list');
      if (!sessions.length) {
        cont.innerHTML = `<div class="empty-state"><span class="icon">📋</span><p>Aucune session.<br>Lance une checklist !</p></div>`;
        return;
      }
      cont.innerHTML = sessions.map(s => {
        const date = new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const ok = s.checked === s.total;
        const phaseLabel = s.phase === 'depart' ? '📦 Retour' : (s.isReturned ? '🎬 Départ (Clôturé)' : '🎬 Départ (En cours)');
        return `<div class="hist-session">
      <div class="hist-header" onclick="toggleHist(${s.id})">
        <div>
          <div class="hist-title">${s.name}</div>
          <div class="hist-date">${date} • ${phaseLabel}</div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="badge ${ok ? 'badge-ok' : 'badge-partial'}">${ok ? 'Complet' : s.checked + '/' + s.total}</span>
        </div>
      </div>
      <div class="hist-body" id="hb-${s.id}">
        <div class="hist-phase-label">${s.phase === 'depart' ? 'Check retour' : 'Check départ'}</div>
        ${(s.snapshot || []).map(item => {
           let qtyStr = item.qty > 1 ? ` (${item.taken !== undefined ? item.taken : (item.checked ? item.qty : 0)}/${item.qty})` : '';
           let isPartialDisplay = item.taken > 0 && item.taken < item.qty;
           return `<div class="hist-item">
            <div class="dot ${item.checked ? 'dot-ok' : (isPartialDisplay ? 'dot-warn' : 'dot-ko')}"></div>
            <span>${item.name}${qtyStr}${item.borrowedFrom ? ` (rendu à ${item.borrowedFrom})` : ''}</span>
          </div>`
        }).join('')}
        <button class="hist-del" onclick="deleteSession(${s.id})">Supprimer cette session</button>
      </div>
    </div>`;
      }).join('');
    }

    window.toggleHist = (id) => {
      const el = document.getElementById('hb-' + id);
      if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
    };

    window.deleteSession = async (id) => {
      if (!confirm('Supprimer cette session ?')) return;
      userData.sessions = userData.sessions.filter(s => s.id !== id);
      await saveUserData();
      renderHistorique();
      renderHome();
      showToast('Session supprimée');
    };

    // ── GESTION ──
    function renderGestion() {
      const cats = userData.categories || [];
      const items = userData.items || [];

      // Catégories
      const chips = document.getElementById('cat-chips-container');
      chips.innerHTML = cats.map(c =>
        `<span class="cat-chip">${c}<button onclick="deleteCat('${c}')">×</button></span>`
      ).join('');

      // Select catégorie
      const sel = document.getElementById('new-item-cat-g');
      sel.innerHTML = '<option value="">-- Catégorie --</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');

      // Liste complète
      const list = document.getElementById('gestion-full-list');
      if (!items.length) {
        list.innerHTML = `<div class="empty-state"><p>Aucun item. Ajoute du mato !</p></div>`;
        return;
      }
      let html = '';
      cats.forEach(cat => {
        const catItems = items.filter(i => i.cat === cat);
        if (!catItems.length) return;
        html += `<div class="cat-label">${cat}</div>`;
        catItems.forEach(item => {
          html += `<div class="item-card" style="cursor:default;">
        <div style="width:24px; height:24px; border-radius:50%; background:var(--surface2); flex-shrink:0;"></div>
        <div class="item-info">
          <div class="item-name-text">${item.name}</div>
        </div>
        ${item.qty > 1 ? `<span class="item-qty-badge">×${item.qty}</span>` : ''}
        <button class="item-delete" onclick="deleteItem(${item.id})">×</button>
      </div>`;
        });
      });
      list.innerHTML = html;
    }

    window.addCategory = async () => {
      const name = document.getElementById('new-cat').value.trim();
      if (!name) return;
      if ((userData.categories || []).includes(name)) { showToast('Catégorie déjà existante'); return; }
      userData.categories = [...(userData.categories || []), name];
      document.getElementById('new-cat').value = '';
      await saveUserData();
      renderGestion();
    };

    window.deleteCat = async (name) => {
      if ((userData.items || []).some(i => i.cat === name)) { showToast('Supprime d\'abord les items de cette catégorie'); return; }
      userData.categories = userData.categories.filter(c => c !== name);
      await saveUserData();
      renderGestion();
    };

    window.addItemFromGestion = async () => {
      const name = document.getElementById('new-item-name-g').value.trim();
      const cat = document.getElementById('new-item-cat-g').value;
      const qty = parseInt(document.getElementById('new-item-qty-g').value) || 1;
      if (!name || !cat) { showToast('Nom et catégorie requis !'); return; }
      const items = userData.items || [];
      const newId = items.length ? Math.max(...items.map(i => i.id)) + 1 : 1;
      userData.items = [...items, { id: newId, name, cat, qty, checkedArrive: false, checkedDepart: false }];
      document.getElementById('new-item-name-g').value = '';
      await saveUserData();
      renderGestion();
      renderHome();
      showToast(`${name} ajouté`);
    };

    window.deleteItem = async (id) => {
      if (!confirm('Supprimer cet item ?')) return;
      userData.items = userData.items.filter(i => i.id !== id);
      await saveUserData();
      renderGestion();
      renderHome();
    };

    // ── PROFILE ──
    window.openProfile = () => {
      const name = currentUser?.displayName || 'Réalisateur';
      const email = currentUser?.email || '';
      document.getElementById('profile-avatar-letter').textContent = name[0].toUpperCase();
      document.getElementById('profile-name-display').textContent = name;
      document.getElementById('profile-email-display').textContent = email;
      openModal('modal-profile');
    };

    // ── AUTH HELPERS ──
    window.setAuthTab = (tab) => {
      document.getElementById('tab-login').classList.toggle('active', tab === 'login');
      document.getElementById('tab-register').classList.toggle('active', tab === 'register');
      document.getElementById('form-login').style.display = tab === 'login' ? 'block' : 'none';
      document.getElementById('form-register').style.display = tab === 'register' ? 'block' : 'none';
      document.getElementById('auth-error').style.display = 'none';
    };

    function showError(msg) {
      const el = document.getElementById('auth-error');
      el.textContent = msg;
      el.style.display = 'block';
    }

    function firebaseMsg(code) {
      const msgs = {
        'auth/email-already-in-use': 'Cet email est déjà utilisé.',
        'auth/invalid-email': 'Email invalide.',
        'auth/weak-password': 'Mot de passe trop court (min. 6 caractères).',
        'auth/user-not-found': 'Aucun compte avec cet email.',
        'auth/wrong-password': 'Mot de passe incorrect.',
        'auth/invalid-credential': 'Email ou mot de passe incorrect.',
        'auth/too-many-requests': 'Trop de tentatives. Réessaie plus tard.',
      };
      return msgs[code] || 'Une erreur est survenue.';
    }

    // ── MODALS ──
    window.openModal = (id) => { document.getElementById(id).classList.add('open'); };
    window.closeModal = (id) => { document.getElementById(id).classList.remove('open'); };

    // ── TOAST ──
    window.showToast = (msg) => {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2500);
    };

    function hideLoader() {
      document.getElementById('loader').style.display = 'none';
    }

    // ── PAGE HOOKS (re-render on nav) ──
    const origShowPage = window.showPage;
    window.showPage = (id) => {
      origShowPage(id);
      if (id === 'page-historique') renderHistorique();
      if (id === 'page-gestion') renderGestion();
    };

    // Click outside modal closes it
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });