// 1. 先定義密碼與基礎變數
const ACCESS_PASSWORD = "skyTechQaTkQoo233"; // 請填入您的密碼
const STORAGE_KEY = 'mqa_tracker_v2'; 
const CLOUD_URL = 'https://script.google.com/macros/s/AKfycbycvp4p0SCQfjHDsa6H0s38yUCfIiKDoR4rQMAx2z1UvtmkcEb8Kklc17vsw-hHJpCW/exec';

const COLOR_MATRIX = [
  ['#dbeafe', '#f0f0f0', '#cffafe', '#d1fae5', '#fef3c7', '#fee2e2', '#f3e8ff'],
  ['#3b82f6', '#666666', '#0891b2', '#10b981', '#fbbf24', '#ef4444', '#a855f7'],
  ['#2b5876', '#333333', '#1a5e63', '#2d6a4f', '#d97706', '#b91c1c', '#6d28d9']
];

let state = {
  statuses: [{ id: 's1', name: '待處理', color: '#dbeafe' }],
  cards: [],
  globalTags: []
};
let selectedColor = COLOR_MATRIX[1][0]; 
window.selectedStatusColor = '#dbeafe'; 
let editingCardId = null;

// --- 2. 核心工具 ---
window.saveLocalOnly = function() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); };
window.showModal = function(id) { document.getElementById(id).style.display = 'flex'; };
window.closeModal = function(id) { document.getElementById(id).style.display = 'none'; };

window.triggerCloudSync = async function(isSilent = true) {
  try {
    saveLocalOnly();
    await fetch(CLOUD_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(state)
    });
    if (!isSilent) alert("同步成功！");
  } catch (e) { console.error("同步失敗", e); }
};

window.getContrastColor = function(hex) {
  if (!hex) return '#000';
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (((r * 299) + (g * 587) + (b * 114)) / 1000 >= 128) ? '#000000' : '#ffffff';
};

// --- 3. 排序與渲染 ---
window.updateStatusOrder = function() {
  const currentIds = [...document.querySelectorAll('.status')].map(el => el.dataset.id);
  state.statuses.sort((a, b) => currentIds.indexOf(a.id) - currentIds.indexOf(b.id));
  window.triggerCloudSync(true);
};

window.render = function() {
  const board = document.getElementById('board');
  if (!board) return; board.innerHTML = '';
  
  state.statuses.forEach(st => {
    const section = document.createElement('div');
    section.className = 'status';
    section.draggable = true;
    section.dataset.id = st.id;
    section.style.backgroundColor = st.color;
    
    section.addEventListener('dragstart', e => { if(e.target.className === 'status') section.classList.add('dragging'); });
    section.addEventListener('dragend', () => { section.classList.remove('dragging'); window.updateStatusOrder(); });
    section.addEventListener('dragover', e => {
      e.preventDefault();
      const draggingStatus = document.querySelector('.status.dragging');
      if (draggingStatus && draggingStatus !== section) {
        const allStatuses = [...document.querySelectorAll('.status')];
        const draggingIdx = allStatuses.indexOf(draggingStatus);
        const targetIdx = allStatuses.indexOf(section);
        if (draggingIdx < targetIdx) section.after(draggingStatus);
        else section.before(draggingStatus);
      }
      const dragCard = document.querySelector('.card.dragging-card');
if (dragCard) {
  section.querySelector('.cards').appendChild(dragCard);

  // ⭐ 更新卡片所屬 status
  const cardId = dragCard.dataset.id;
  const card = state.cards.find(c => c.id === cardId);
  if (card) card.statusId = st.id;
}
    });

    const hColor = getContrastColor(st.color);
    section.innerHTML = `
      <div class="status-header">
        <span style="color:${hColor}">${st.name}</span>
        <button class="delete-btn" style="color:${hColor}" onclick="window.deleteStatus('${st.id}')">×</button>
      </div>
      <div class="cards" id="cards-${st.id}"></div>
    `;
    board.appendChild(section);
    
    const container = document.getElementById(`cards-${st.id}`);
    state.cards.filter(c => c.statusId === st.id).forEach(card => {
      const cardEl = document.createElement('div');
      cardEl.className = 'card';
      cardEl.draggable = true;
      cardEl.dataset.id = card.id;
      cardEl.onclick = () => window.openCard(card.id);
      
      cardEl.addEventListener('dragstart', e => { e.stopPropagation(); cardEl.classList.add('dragging-card'); });
      cardEl.addEventListener('dragend', () => { cardEl.classList.remove('dragging-card'); render(); });

      const tagsHtml = (card.tags || []).map(t => `<span class="badge" style="background:${t.color}; color:${getContrastColor(t.color)}">${t.text}</span>`).join('');
      const formatD = (d) => d ? d.replace(/^\d{4}-/, '') : '--';

      cardEl.innerHTML = `
        <button class="delete-btn" onclick="event.stopPropagation(); window.deleteCard('${card.id}')">×</button>
        <div class="card-id-tag">${card.number || '--'}</div>
        <div class="card-title">${card.title}</div>
        <div class="card-owner-info">👤 ${card.owner || '--'}</div>
        <div class="card-meta-row">
          <div class="card-date">📅 ${formatD(card.startDate)} ~ ${formatD(card.endDate)}</div>
        </div>
        <div class="tag-container">${tagsHtml}</div>
      `;
      container.appendChild(cardEl);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'ghost'; addBtn.textContent = '+ 新增任務';
    addBtn.onclick = () => {
      const id = 'c' + Date.now();
      state.cards.push({ id, title: '新任務', statusId: st.id, tags: [], startDate: '', endDate: '', owner: '', number: '', link: '', description: '' });
      render(); window.openCard(id); window.triggerCloudSync(true);
    };
    section.appendChild(addBtn);
  });
};

// --- 4. 狀態區管理 ---
window.openStatusModal = function() {
  const container = document.getElementById('statusColorPicker');
  container.innerHTML = COLOR_MATRIX[0].map(c => `
    <div onclick="window.selectedStatusColor='${c}'; this.parentElement.querySelectorAll('div').forEach(d=>d.style.boxShadow='none'); this.style.boxShadow='0 0 0 3px white, 0 0 0 5px ${c}';" 
         style="width:28px; height:28px; background:${c}; cursor:pointer; border-radius:50%; transition:0.2s; ${c==='#dbeafe' ? 'box-shadow:0 0 0 3px white, 0 0 0 5px #dbeafe;' : ''}">
    </div>`).join('');
  window.showModal('statusModal');
};

window.addNewStatus = function() {
  const inputEl = document.getElementById('newStatusName');
  const name = inputEl.value.trim();
  if (name) {
    state.statuses.push({ id: 's' + Date.now(), name: name, color: window.selectedStatusColor });
    inputEl.value = ''; 
    window.closeModal('statusModal'); 
    render(); 
    window.triggerCloudSync(true);
  }
};

// --- 5. 標籤管理 (修正：已存在標籤變小) ---
window.openTagManager = function() {
  const ui = document.getElementById('tagManagerUI');
  const tagList = state.globalTags.map(gt => `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; background:rgba(0,0,0,0.05); padding:6px 10px; border-radius:8px; font-size:13px;">
      <div style="width:12px; height:12px; border-radius:3px; background:${gt.color}"></div>
      <span style="flex:1; font-weight:600;">${gt.text}</span>
      <button onclick="window.deleteGlobalTag('${gt.uid}')" style="border:none; background:none; cursor:pointer; color:#ff4d4f; padding:0; font-size:16px;">×</button>
    </div>`).join('');

  ui.innerHTML = `
    <div class="modal-header">標籤庫管理</div>
    <div style="max-height:180px; overflow-y:auto; padding-right:5px;">${tagList || '尚無標籤'}</div>
    <div class="grid" style="margin-top:20px; border-top:1px solid rgba(0,0,0,0.1); padding-top:20px;">
      <label>新增標籤</label>
      <input id="newTagName" placeholder="標籤名稱...">
      <div id="tagColorPicker" style="display:flex; gap:8px; margin-bottom:10px;"></div>
      <button class="ghost" onclick="window.addGlobalTag()">+ 加入標籤庫</button>
    </div>`;
  renderTagColorPicker();
  window.showModal('tagManagerModal');
};

function renderTagColorPicker() {
  const container = document.getElementById('tagColorPicker');
  if(!container) return;
  container.innerHTML = COLOR_MATRIX[1].map(c => `
    <div onclick="window.selectedColor='${c}'; renderTagColorPicker();" 
         style="width:20px; height:20px; background:${c}; cursor:pointer; border-radius:4px; transition:0.2s; transform:${window.selectedColor === c ? 'scale(1.3)' : 'scale(1)'}">
    </div>`).join('');
}

window.addGlobalTag = function() {
  const name = document.getElementById('newTagName').value.trim();
  if (name) {
    state.globalTags.push({ uid: 'tag-' + Date.now(), text: name, color: window.selectedColor || '#3b82f6' });
    window.openTagManager(); window.triggerCloudSync(true); 
  }
};

window.deleteGlobalTag = function(uid) {
  if (confirm('確定刪除標籤？這將會從所有任務中移除此標籤。')) {
    state.globalTags = state.globalTags.filter(t => t.uid !== uid);
    state.cards.forEach(card => { if (card.tags) card.tags = card.tags.filter(t => t.uid !== uid); });
    window.openTagManager(); render(); window.triggerCloudSync(true);
  }
};

// --- 6. 卡片細節 ---
window.openCard = function(id) {
  editingCardId = id;
  const card = state.cards.find(c => c.id === id);
  if (!card) return;
  document.getElementById('fieldName').value = card.title || '';
  document.getElementById('fieldLink').value = card.link || '';
  document.getElementById('fieldDesc').value = card.description || '';
  document.getElementById('fieldOwner').value = card.owner || '';
  document.getElementById('fieldId').value = card.number || '';
  document.getElementById('fieldStart').value = card.startDate || '';
  document.getElementById('fieldEnd').value = card.endDate || '';
  window.renderTagSelector(card);
  window.showModal('cardModal');
};

window.renderTagSelector = function(card) {
  const container = document.getElementById('cardTagSelector');
  container.innerHTML = state.globalTags.map(gt => {
    const isSelected = card.tags && card.tags.some(t => t.uid === gt.uid);
    return `<span class="badge"
  style="
    background:${gt.color};
    color:${getContrastColor(gt.color)};
    cursor:pointer;
    opacity:${isSelected ? '1' : '0.35'};
    transition:opacity 0.15s ease;
  "
  onclick="window.toggleTag('${gt.uid}')">
  ${gt.text}
</span>`;
  }).join('');
};

window.toggleTag = function(tagUid) {
  const card = state.cards.find(c => c.id === editingCardId);
  if (!card.tags) card.tags = [];
  const idx = card.tags.findIndex(t => t.uid === tagUid);
  if (idx > -1) card.tags.splice(idx, 1);
  else { const gt = state.globalTags.find(t => t.uid === tagUid); if (gt) card.tags.push({...gt}); }
  window.renderTagSelector(card);
};

window.deleteCard = function(id) { if(confirm('刪除任務？')) { state.cards = state.cards.filter(c=>c.id!==id); render(); window.triggerCloudSync(true); } };
window.deleteStatus = function(id) { if(confirm('刪除狀態區？')) { state.statuses = state.statuses.filter(s => s.id !== id); state.cards = state.cards.filter(c => c.statusId !== id); render(); window.triggerCloudSync(true); } };

// --- 7. 初始化 ---
async function initApp() {
  document.getElementById('modalSaveBtn').onclick = () => {
    const c = state.cards.find(x => x.id === editingCardId);
    if (c) {
      c.title = document.getElementById('fieldName').value;
      c.link = document.getElementById('fieldLink').value;
      c.description = document.getElementById('fieldDesc').value;
      c.owner = document.getElementById('fieldOwner').value;
      c.number = document.getElementById('fieldId').value;
      c.startDate = document.getElementById('fieldStart').value;
      c.endDate = document.getElementById('fieldEnd').value;
    }
    window.closeModal('cardModal'); render(); window.triggerCloudSync(true); 
  };
  const local = localStorage.getItem(STORAGE_KEY);
  if (local) state = JSON.parse(local);
  render();
  try {
    const res = await fetch(CLOUD_URL);
    if (res.ok) { const data = await res.json(); if (data && data.statuses) { state = data; render(); saveLocalOnly(); } }
  } catch (e) { console.log("Offline mode"); }
}

const pass = prompt("請輸入密碼：");
if (pass === ACCESS_PASSWORD) initApp();