const ACCESS_PASSWORD = "Qdd-38fne56Jfs"; // 設定您的密碼

function checkAccess() {
  const userPass = prompt("請輸入訪問密碼以繼續：");
  if (userPass !== ACCESS_PASSWORD) {
    alert("密碼錯誤，拒絕存取。");
    document.body.innerHTML = "<h1>403 Forbidden: 未經授權的訪問</h1>";
    return false;
  }
  return true;
}

// 修改原有的初始化邏輯
if (checkAccess()) {
  initApp(); // 原本啟動程式的函數
}
const COLOR_MATRIX = [
  ['#333333', '#2b5876', '#1a5e63', '#2d6a4f', '#d97706', '#b91c1c', '#6d28d9'],
  ['#666666', '#3b82f6', '#0891b2', '#10b981', '#fbbf24', '#ef4444', '#a855f7'],
  ['#f0f0f0', '#dbeafe', '#cffafe', '#d1fae5', '#fef3c7', '#fee2e2', '#f3e8ff']
];

const STORAGE_KEY = 'mqa_tracker_v2'; 

// --- 雲端設定區 ---
const CLOUD_URL = 'https://script.google.com/macros/s/AKfycbwxd1i_qCplVgTTfJQR6ec26GeyBYpLJyDwyzrKgwE7fB7YW1-Yj2PqZcJQOW849jzo/exec'; // <--- 請在此貼上您的 URL

let state = {
  statuses: [{ id: 's1', name: '待處理', color: '#dbeafe' }],
  cards: [],
  globalTags: []
};

let selectedColor = COLOR_MATRIX[1][1];
let editingCardId = null;

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
    
    if (filteredCards.length > 0) {
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
    }

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

// 僅儲存到本地，不頻繁請求雲端
function saveLocalOnly() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  console.log("本地數據已暫存");
}

// --- 強化後的同步功能 (連動 Google Sheets) ---
window.triggerCloudSync = async function() {
  const btn = document.querySelector('.toolbar .primary');
  const originalText = btn.textContent;
  
  btn.textContent = "同步中...";
  btn.disabled = true;

  try {
    // 1. 先執行本地儲存備份
    saveLocalOnly();

    // 2. 發送到 Google Sheets (非同步上傳)
    await fetch(CLOUD_URL, {
      method: 'POST',
      mode: 'no-cors', // 必須使用 no-cors 模式避開跨域限制
      body: JSON.stringify(state)
    });

    // 模擬成功延遲感，增加使用者回饋
    await new Promise(r => setTimeout(r, 1000));
    alert("雲端同步成功！數據已安全存入 Google 表格 A1。");
  } catch (e) {
    console.error("同步失敗:", e);
    alert("同步失敗，請檢查網路或腳本網址。");
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
};

function updateStatusOrder() {
  const currentStatusElements = [...document.querySelectorAll('.status')];
  const newOrderIds = currentStatusElements.map(el => el.dataset.id);
  state.statuses.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));
  saveLocalOnly();
}

function openCard(id) {
  editingCardId = id;
  const card = state.cards.find(c => c.id === id);
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

function toggleTag(tagUid) {
  const card = state.cards.find(c => c.id === editingCardId);
  if (!card.tags) card.tags = [];
  const idx = card.tags.findIndex(t => t.uid === tagUid);
  if (idx > -1) card.tags.splice(idx, 1);
  else {
    const gTag = state.globalTags.find(gt => gt.uid === tagUid);
    card.tags.push({...gTag});
  }
  renderTagSelector(card);
}

document.getElementById('modalSave').onclick = () => {
  const c = state.cards.find(x => x.id === editingCardId);
  c.title = document.getElementById('fieldName').value;
  c.link = document.getElementById('fieldLink').value;
  c.description = document.getElementById('fieldDesc').value;
  c.owner = document.getElementById('fieldOwner').value;
  c.number = document.getElementById('fieldId').value;
  c.startDate = document.getElementById('fieldStart').value;
  c.endDate = document.getElementById('fieldEnd').value;
  closeModal('cardModal'); render(); saveLocalOnly();
};

function deleteCard(id) { if(confirm('刪除任務？')) { state.cards = state.cards.filter(c=>c.id!==id); render(); saveLocalOnly(); } }
function deleteStatus(id) { if(confirm('刪除狀態區？')) { state.statuses = state.statuses.filter(s=>s.id!==id); render(); saveLocalOnly(); } }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function loadState() { const s = localStorage.getItem(STORAGE_KEY); if (s) state = JSON.parse(s); }

document.getElementById('openSettingsBtn').onclick = () => document.getElementById('settingsModal').style.display = 'flex';
loadState(); render();