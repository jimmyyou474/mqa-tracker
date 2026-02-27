// 1. 先定義密碼與基礎變數
const ACCESS_PASSWORD = "Qdd-38fne56Jfs"; // 請填入您的密碼
const STORAGE_KEY = 'mqa_tracker_v2'; 
const CLOUD_URL = 'https://script.google.com/macros/s/AKfycbycvp4p0SCQfjHDsa6H0s38yUCfIiKDoR4rQMAx2z1UvtmkcEb8Kklc17vsw-hHJpCW/exec';

const COLOR_MATRIX = [
  ['#333333', '#2b5876', '#1a5e63', '#2d6a4f', '#d97706', '#b91c1c', '#6d28d9'],
  ['#666666', '#3b82f6', '#0891b2', '#10b981', '#fbbf24', '#ef4444', '#a855f7'],
  ['#f0f0f0', '#dbeafe', '#cffafe', '#d1fae5', '#fef3c7', '#fee2e2', '#f3e8ff']
];

// --- 2. 全域狀態 ---
let state = {
  statuses: [{ id: 's1', name: '待處理', color: '#dbeafe' }],
  cards: [],
  globalTags: []
};
let selectedColor = COLOR_MATRIX[1][1];
let editingCardId = null;

// --- 3. 核心工具函數 (全域定義) ---

function getContrastColor(hex) {
  if (!hex) return '#000';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#ffffff';
}

function render() {
  const board = document.getElementById('board');
  if (!board) return;
  board.innerHTML = '';
  
  state.statuses.forEach(st => {
    const section = document.createElement('div');
    section.className = 'status';
    section.draggable = true;
    section.dataset.id = st.id;
    section.style.backgroundColor = st.color;
    
    section.addEventListener('dragstart', (e) => {
      if(e.target.className === 'status') section.classList.add('dragging');
    });
    section.addEventListener('dragend', () => {
      section.classList.remove('dragging');
      updateStatusOrder();
    });

    section.addEventListener('dragover', e => {
      e.preventDefault();
      const draggingCard = document.querySelector('.card.dragging-card');
      if (draggingCard) {
        const container = section.querySelector('.cards');
        container.appendChild(draggingCard);
      }
    });

    section.addEventListener('drop', e => {
      const draggingCard = document.querySelector('.card.dragging-card');
      if (draggingCard) {
        const cardId = draggingCard.dataset.id;
        const cardData = state.cards.find(c => c.id === cardId);
        if (cardData) {
          cardData.statusId = st.id;
          saveLocalOnly(); 
        }
      }
    });

    const hColor = getContrastColor(st.color);
    section.innerHTML = `
      <div class="status-header">
        <span style="color:${hColor}">${st.name}</span>
        <button class="delete-btn" style="opacity:1; position:static; background:rgba(0,0,0,0.05); color:${hColor}" onclick="deleteStatus('${st.id}')">×</button>
      </div>
      <div class="cards" id="cards-${st.id}"></div>
    `;
    board.appendChild(section);
    
    const container = document.getElementById(`cards-${st.id}`);
    const filteredCards = state.cards.filter(c => c.statusId === st.id);
    
    filteredCards.forEach(card => {
      const cardEl = document.createElement('div');
      cardEl.className = 'card';
      cardEl.draggable = true;
      cardEl.dataset.id = card.id;
      cardEl.onclick = () => openCard(card.id);
      
      cardEl.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        cardEl.classList.add('dragging-card');
      });
      cardEl.addEventListener('dragend', () => {
        cardEl.classList.remove('dragging-card');
        render(); 
      });

      const tagsHtml = (card.tags || []).map(t => 
        `<span class="badge" style="background:${t.color}; color:${getContrastColor(t.color)}">${t.text}</span>`
      ).join('');

      const formatD = (d) => d ? d.replace(/^\d{4}-/, '') : '--';
      const dateHtml = (card.startDate || card.endDate) 
        ? `<div class="card-date"><span>📅</span> ${formatD(card.startDate)} ~ ${formatD(card.endDate)}</div>` 
        : `<div class="card-date"></div>`;

      const linkHtml = card.link 
        ? `<a href="${card.link}" target="_blank" class="card-link" onclick="event.stopPropagation()" title="開啟連結">↗</a>` 
        : '';

      cardEl.innerHTML = `
        <button class="delete-btn" onclick="event.stopPropagation(); deleteCard('${card.id}')">×</button>
        <div class="card-title">${card.title}</div>
        <div class="card-id-tag">${card.number ? '#' + card.number : ''}</div>
        <div class="card-meta-row">${dateHtml} ${linkHtml}</div>
        <div class="card-owner-info">${card.owner ? '<span>👤</span> ' + card.owner : ''}</div>
        <div class="tag-container">${tagsHtml}</div>
      `;
      container.appendChild(cardEl);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'ghost'; addBtn.textContent = '+ 新增任務';
    addBtn.onclick = () => {
      const id = 'c' + Date.now();
      state.cards.push({ id, title: '新任務', statusId: st.id, tags: [], startDate: '', endDate: '', owner: '', number: '', link: '' });
      render(); saveLocalOnly(); openCard(id);
    };
    section.appendChild(addBtn);
  });
}

function saveLocalOnly() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// --- 4. 雲端同步功能 ---
window.triggerCloudSync = async function() {
  const btn = document.querySelector('.toolbar .primary');
  const originalText = btn.textContent;
  btn.textContent = "同步中...";
  btn.disabled = true;

  try {
    saveLocalOnly();
    await fetch(CLOUD_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(state)
    });
    await new Promise(r => setTimeout(r, 1200));
    alert("雲端同步指令已發送！請檢查 Google 表格。");
  } catch (e) {
    console.error("同步失敗:", e);
    alert("同步出錯，請檢查網路。");
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
};

// --- 5. 新增狀態與標籤管理邏輯 ---

// 新增狀態
function setupStatusLogic() {
  const addBtn = document.getElementById('addStatusBtn');
  if (addBtn) {
    addBtn.onclick = () => {
      const nameInput = document.getElementById('newStatusName');
      const name = nameInput.value.trim();
      if (name) {
        state.statuses.push({ id: 's' + Date.now(), name: name, color: '#dbeafe' });
        nameInput.value = '';
        closeModal('statusModal');
        render();
        saveLocalOnly();
      }
    };
  }
}

// 標籤管理介面渲染
window.openTagManager = function() {
  const tagListContainer = document.getElementById('tagManagerModal').querySelector('.modal-content');
  const tagListHtml = state.globalTags.map(gt => `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px; background:rgba(255,255,255,0.5); padding:10px; border-radius:12px;">
      <div style="width:20px; height:20px; border-radius:4px; background:${gt.color}"></div>
      <span style="flex:1; font-weight:bold;">${gt.text}</span>
      <button class="delete-btn" style="opacity:1; position:static;" onclick="deleteGlobalTag('${gt.uid}')">×</button>
    </div>
  `).join('');

  tagListContainer.innerHTML = `
    <div class="modal-header">標籤庫管理</div>
    <div style="max-height:250px; overflow-y:auto; margin-bottom:20px;">
      ${tagListHtml || '<div style="text-align:center; color:#999; padding:20px;">目前尚無標籤</div>'}
    </div>
    <div class="grid" style="border-top:1px solid rgba(0,0,0,0.1); padding-top:20px;">
      <label>新增標籤</label>
      <input id="newTagName" placeholder="標籤名稱..." style="margin-bottom:10px;">
      <div style="display:flex; gap:8px; margin-bottom:15px;">
        ${COLOR_MATRIX[1].map(c => `<div onclick="selectedColor='${c}'" style="width:24px; height:24px; background:${c}; cursor:pointer; border-radius:50%; border:2px solid #fff; box-shadow:0 0 0 1px #ddd;"></div>`).join('')}
      </div>
      <button class="ghost" onclick="addGlobalTag()">+ 加入標籤庫</button>
    </div>
    <div class="modal-footer">
      <button onclick="closeModal('tagManagerModal')">完成</button>
    </div>
  `;
};

window.addGlobalTag = function() {
  const name = document.getElementById('newTagName').value.trim();
  if (name) {
    state.globalTags.push({ uid: 't' + Date.now(), text: name, color: selectedColor });
    openTagManager();
    saveLocalOnly();
  }
};

window.deleteGlobalTag = function(uid) {
  if (confirm('刪除此標籤？')) {
    state.globalTags = state.globalTags.filter(t => t.uid !== uid);
    openTagManager();
    saveLocalOnly();
  }
};

// --- 6. 彈窗與卡片基本操作 ---

function updateStatusOrder() {
  const currentStatusElements = [...document.querySelectorAll('.status')];
  const newOrderIds = currentStatusElements.map(el => el.dataset.id);
  state.statuses.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));
  saveLocalOnly();
}

function openCard(id) {
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
  renderTagSelector(card);
  document.getElementById('cardModal').style.display = 'flex';
}

function renderTagSelector(card) {
  const container = document.getElementById('cardTagSelector');
  container.innerHTML = state.globalTags.map(gt => {
    const isSelected = card.tags && card.tags.some(t => t.uid === gt.uid);
    return `<span class="badge ${isSelected ? '' : 'inactive'}" 
                  style="background:${gt.color}; color:${getContrastColor(gt.color)}; cursor:pointer" 
                  onclick="toggleTag('${gt.uid}')">${gt.text}</span>`;
  }).join('');
}

window.toggleTag = function(tagUid) {
  const card = state.cards.find(c => c.id === editingCardId);
  if (!card.tags) card.tags = [];
  const idx = card.tags.findIndex(t => t.uid === tagUid);
  if (idx > -1) card.tags.splice(idx, 1);
  else {
    const gTag = state.globalTags.find(gt => gt.uid === tagUid);
    if (gTag) card.tags.push({...gTag});
  }
  renderTagSelector(card);
};

document.getElementById('modalSave').onclick = () => {
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
  closeModal('cardModal'); render(); saveLocalOnly();
};

window.deleteCard = function(id) { if(confirm('刪除任務？')) { state.cards = state.cards.filter(c=>c.id!==id); render(); saveLocalOnly(); } };
window.deleteStatus = function(id) { if(confirm('刪除狀態區？')) { state.statuses = state.statuses.filter(s=>s.id!==id); render(); saveLocalOnly(); } };
window.closeModal = function(id) { document.getElementById(id).style.display = 'none'; };
function loadState() { const s = localStorage.getItem(STORAGE_KEY); if (s) state = JSON.parse(s); }

// --- 7. 初始化與啟動 ---

async function initApp() {
  document.getElementById('openSettingsBtn').onclick = () => document.getElementById('settingsModal').style.display = 'flex';
  document.getElementById('openTagManagerBtn').onclick = () => { openTagManager(); document.getElementById('tagManagerModal').style.display = 'flex'; };
  
  setupStatusLogic();
  loadState();
  render();

  try {
    const response = await fetch(CLOUD_URL);
    if (response.ok) {
      const cloudData = await response.json();
      if (cloudData && cloudData.statuses) {
        state = cloudData;
        saveLocalOnly();
        render();
      }
    }
  } catch (e) { console.warn("離線運作中"); }
}

function checkAccess() {
  const userPass = prompt("請輸入訪問密碼：");
  if (userPass !== ACCESS_PASSWORD) {
    alert("密碼錯誤");
    document.body.innerHTML = "<h1 style='text-align:center; margin-top:100px;'>403 Forbidden</h1>";
    return false;
  }
  return true;
}

if (checkAccess()) { initApp(); }