// ================= SABİTLER VE BAŞLANGIÇ VERİLERİ =================
const days = [
  { id: 'pazartesi', name: 'Pazartesi' },
  { id: 'sali', name: 'Salı' },
  { id: 'carsamba', name: 'Çarşamba' },
  { id: 'persembe', name: 'Perşembe' },
  { id: 'cuma', name: 'Cuma' },
  { id: 'cumartesi', name: 'Cumartesi' },
  { id: 'pazar', name: 'Pazar' }
];

const categoryIcons = {
  ders: '📚',
  odev: '✏️',
  gorev: '✅',
  sinav: '🎯',
  diger: '💡'
};

const categoryLabels = {
  ders: 'Ders',
  odev: 'Ödev',
  gorev: 'Görev',
  sinav: 'Sınav',
  diger: 'Diğer'
};

const storageKeyLessons = 'derslik-plan';
const storageKeyNotes = 'derslik-notes';
const storageKeyPomo = 'derslik-pomo-sessions';

// Başlangıç Ders / Görev Verisi (Varsa eskileri koru)
let lessons = JSON.parse(localStorage.getItem(storageKeyLessons) || 'null') || [
  { id: crypto.randomUUID(), name: 'Matematik', day: 'pazartesi', time: '18:00', category: 'ders', difficulty: 'hard', notes: 'Fonksiyonlar ve denklem tekrarını yap.', completed: false },
  { id: crypto.randomUUID(), name: 'İngilizce Kelime Ezberi', day: 'sali', time: '17:30', category: 'gorev', difficulty: 'easy', notes: '50 yeni kelime tekrarı.', completed: true },
  { id: crypto.randomUUID(), name: 'Fizik Hareket Konusu', day: 'persembe', time: '19:00', category: 'ders', difficulty: 'medium', notes: 'Test 4 ve 5 çözülecek.', completed: false },
  { id: crypto.randomUUID(), name: 'Haftalık Deneme Sınavı', day: 'cumartesi', time: '10:00', category: 'sinav', difficulty: 'hard', notes: 'Süre tutarak çöz.', completed: false }
];

// Başlangıç Serbest Not Defteri Verisi
let notes = JSON.parse(localStorage.getItem(storageKeyNotes) || 'null') || [
  {
    id: crypto.randomUUID(),
    title: 'Haftalık Odak ve Hedefler',
    content: 'Bu hafta özellikle Fizik ve Matematik netlerini artırmaya odaklan. Günde en az 2 Pomodoro seansı yap.',
    color: 'mint',
    pinned: true,
    updatedAt: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
  },
  {
    id: crypto.randomUUID(),
    title: 'Matematik Formül Hatırlatıcı',
    content: 'Türev kuralları ve trigonometri yarım açı formüllerini duvar panosuna as.',
    color: 'yellow',
    pinned: false,
    updatedAt: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
  }
];

let selectedLessonId = null;
let activeDayFilter = 'all';

// ================= DOM ELEMENTLERİ =================
const weekGrid = document.querySelector('#weekGrid');
const lessonDialog = document.querySelector('#lessonDialog');
const detailDialog = document.querySelector('#detailDialog');
const noteDialog = document.querySelector('#noteDialog');
const backupDialog = document.querySelector('#backupDialog');

const lessonForm = document.querySelector('#lessonForm');
const detailForm = document.querySelector('#detailForm');
const noteForm = document.querySelector('#noteForm');

// ================= FIREBASE BULUT SENKRONİZASYONU =================
const firebaseConfig = {
  apiKey: "AIzaSyCTU7HM_pOkt651p40Qf3TXmjYbkh6t6vc",
  authDomain: "lifehub-15540.firebaseapp.com",
  projectId: "lifehub-15540",
  storageBucket: "lifehub-15540.firebasestorage.app",
  messagingSenderId: "990729856057",
  appId: "1:990729856057:web:36846550415331e7bb99e8",
  measurementId: "G-8WEWNLQJR2"
};

let auth = null;
let db = null;
let currentUser = null;
let unsubscribeFirestore = null;

try {
  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
  }
} catch (err) {
  console.warn('Firebase başlatılamadı:', err);
}

// Buluta Değişiklikleri Gönderme (Debounce ile)
let syncDebounceTimer = null;
function syncToCloud() {
  if (!currentUser || !db) return;
  clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    db.collection('users').doc(currentUser.uid).set({
      lessons: lessons,
      notes: notes,
      pomoSessions: pomoSessions,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(err => {
      console.warn('Buluta senkronize edilemedi:', err);
    });
  }, 350);
}

// ================= KAYDETME VE YARDIMCI FONKSİYONLAR =================
function saveLessons() {
  localStorage.setItem(storageKeyLessons, JSON.stringify(lessons));
  syncToCloud();
}

function saveNotes() {
  localStorage.setItem(storageKeyNotes, JSON.stringify(notes));
  syncToCloud();
}

function todayId() {
  return ['pazar', 'pazartesi', 'sali', 'carsamba', 'persembe', 'cuma', 'cumartesi'][new Date().getDay()];
}

function formatDate(dayIndex) {
  const date = new Date();
  const mondayOffset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  date.setDate(date.getDate() + mondayOffset + dayIndex);
  return `${date.getDate()} ${date.toLocaleDateString('tr-TR', { month: 'short' }).replace('.', '')}`;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ================= SEKME GEZİNTİSİ (TABS) =================
function switchTab(tabId) {
  // Pane'leri güncelle
  document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
  const targetPane = document.getElementById(`pane${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
  if (targetPane) targetPane.classList.add('active');

  // Masaüstü ve Mobil Navigasyon Butonlarını güncelle
  document.querySelectorAll('.nav-btn, .bottom-nav-item').forEach(btn => {
    if (btn.dataset.tab === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Pomodoro sekmesine geçildiyse görev listesini güncelle
  if (tabId === 'pomodoro') {
    updatePomoTaskSelect();
  }
}

document.querySelectorAll('.nav-btn, .bottom-nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.tab) {
      switchTab(btn.dataset.tab);
    }
  });
});

// Mobil hızlı yedekleme tetikleyici
document.querySelector('#mobileBackupTrigger')?.addEventListener('click', () => {
  backupDialog.showModal();
});

// ================= 1. BÖLÜM: HAFTALIK VE GÜNLÜK PLANLAYICI =================
function renderPlanner() {
  weekGrid.innerHTML = days.map((day, index) => {
    const dayLessons = lessons
      .filter(l => l.day === day.id)
      .sort((a, b) => a.time.localeCompare(b.time));

    const isHiddenOnMobile = activeDayFilter !== 'all' && activeDayFilter !== day.id;

    return `
      <div class="day-column ${day.id === todayId() ? 'is-today' : ''} ${isHiddenOnMobile ? 'hidden-mobile' : ''}" data-day="${day.id}">
        <div class="day-header">
          <span class="day-name">${day.name}</span>
          <span class="day-date">${formatDate(index)}</span>
        </div>
        <div class="day-content" data-day="${day.id}">
          ${dayLessons.length ? dayLessons.map(lessonCardHtml).join('') : '<div class="empty-state">Henüz görev<br>eklenmedi</div>'}
        </div>
      </div>
    `;
  }).join('');

  // İlerleme ve İstatistikler
  const total = lessons.length;
  const completed = lessons.filter(l => l.completed).length;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  document.querySelector('#lessonCount').textContent = `${total} görev/ders`;
  document.querySelector('#completedCount').textContent = completed;
  document.querySelector('#progressPercent').textContent = `${percent}%`;
  document.querySelector('#progressBar').style.width = `${percent}%`;

  // Kart Tıklamaları ve Checkbox Olayları
  weekGrid.querySelectorAll('.lesson-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Checkbox butonuna tıklandıysa modalı açma, sadece durumu tersine çevir
      if (e.target.closest('.lesson-check-btn')) {
        e.stopPropagation();
        toggleLessonComplete(card.dataset.id);
        return;
      }
      openDetails(card.dataset.id);
    });

    // Masaüstü Drag & Drop Olayları (Madde 2)
    setupCardDrag(card);
  });

  // Gün sütunlarına bırakma (Drop) hedefleri
  setupDropZones();
}

function lessonCardHtml(lesson) {
  const cat = lesson.category || 'ders';
  const icon = categoryIcons[cat] || '✦';
  const diff = lesson.difficulty || 'easy';
  const diffLabel = { easy: 'Kolay', medium: 'Orta', hard: 'Zor' }[diff];

  return `
    <article class="lesson-card ${diff} ${lesson.completed ? 'completed' : ''}" 
             data-id="${lesson.id}" 
             draggable="true" 
             title="${diffLabel} · Tıkla ve detayları gör">
      <div class="card-top">
        <span class="lesson-category-tag">${icon} ${escapeHtml(categoryLabels[cat] || cat)}</span>
        <span class="lesson-time">${lesson.time}</span>
      </div>
      <strong class="lesson-name">${escapeHtml(lesson.name)}</strong>
      ${lesson.notes ? `<div class="lesson-preview-note">📝 ${escapeHtml(lesson.notes)}</div>` : ''}
      <button type="button" class="lesson-check-btn" title="Tamamlandı olarak işaretle" aria-label="Tamamlandı işaretle">
        ✓
      </button>
    </article>
  `;
}

function toggleLessonComplete(id) {
  const lesson = lessons.find(l => l.id === id);
  if (!lesson) return;
  lesson.completed = !lesson.completed;
  saveLessons();
  renderPlanner();
}

// ================= SÜRÜKLE & BIRAK (DRAG AND DROP - MADDE 2) =================
let draggedLessonId = null;

function setupCardDrag(card) {
  card.addEventListener('dragstart', (e) => {
    draggedLessonId = card.dataset.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.dataset.id);
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    document.querySelectorAll('.day-column').forEach(c => c.classList.remove('drag-over'));
  });
}

function setupDropZones() {
  document.querySelectorAll('.day-column').forEach(col => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      col.classList.add('drag-over');
    });

    col.addEventListener('dragleave', (e) => {
      // Yalnızca sütunun tamamen dışına çıkıldığında kaldır
      if (!col.contains(e.relatedTarget)) {
        col.classList.remove('drag-over');
      }
    });

    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const targetDay = col.dataset.day;
      const lessonId = draggedLessonId || e.dataTransfer.getData('text/plain');

      if (lessonId && targetDay) {
        const lesson = lessons.find(l => l.id === lessonId);
        if (lesson && lesson.day !== targetDay) {
          lesson.day = targetDay;
          saveLessons();
          renderPlanner();
        }
      }
      draggedLessonId = null;
    });
  });
}

// ================= MOBİL GÜN SEÇİCİ (CHIP FILTER) =================
document.querySelectorAll('.day-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.day-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeDayFilter = chip.dataset.day;
    renderPlanner();
  });
});

// ================= GÖREV / DERS EKLE & DÜZENLE (MADDE 1) =================
const openAddButton = document.querySelector('#openAddButton');
const closeDialogButton = document.querySelector('#closeDialogButton');

openAddButton.addEventListener('click', () => {
  lessonForm.reset();
  document.querySelector('#editingLessonId').value = '';
  document.querySelector('#formEyebrow').textContent = 'YENİ PLAN';
  document.querySelector('#formTitle').textContent = 'Ders veya Görev Ekle';
  document.querySelector('#submitLessonBtn').innerHTML = 'Programa Ekle <span>→</span>';
  
  // Varsayılan olarak bugünü veya aktif filtreyi seç
  const defaultDay = activeDayFilter !== 'all' ? activeDayFilter : todayId();
  document.querySelector('#lessonDay').value = defaultDay;
  
  lessonDialog.showModal();
  document.querySelector('#lessonName').focus();
});

closeDialogButton.addEventListener('click', () => lessonDialog.close());

lessonForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const editingId = document.querySelector('#editingLessonId').value;
  const name = document.querySelector('#lessonName').value.trim();
  const day = document.querySelector('#lessonDay').value;
  const time = document.querySelector('#lessonTime').value;
  const category = document.querySelector('#lessonCategory').value;
  const difficulty = document.querySelector('input[name="difficulty"]:checked').value;
  const notesText = document.querySelector('#lessonNotesInput').value.trim();

  if (editingId) {
    // Mevcut dersi güncelle (Madde 1)
    const lesson = lessons.find(l => l.id === editingId);
    if (lesson) {
      lesson.name = name;
      lesson.day = day;
      lesson.time = time;
      lesson.category = category;
      lesson.difficulty = difficulty;
      lesson.notes = notesText;
    }
  } else {
    // Yeni ders/görev ekle
    const newLesson = {
      id: crypto.randomUUID(),
      name,
      day,
      time,
      category,
      difficulty,
      notes: notesText,
      completed: false
    };
    lessons.push(newLesson);
  }

  saveLessons();
  renderPlanner();
  lessonDialog.close();
});

// ================= GÖREV DETAY & DÜZENLEME MODALI =================
const closeDetailButton = document.querySelector('#closeDetailButton');
const deleteLessonButton = document.querySelector('#deleteLessonButton');
const editLessonButton = document.querySelector('#editLessonButton');
const detailMoveDay = document.querySelector('#detailMoveDay');
const detailStartPomoBtn = document.querySelector('#detailStartPomoBtn');

closeDetailButton.addEventListener('click', () => detailDialog.close());

function openDetails(id) {
  selectedLessonId = id;
  const lesson = lessons.find(item => item.id === id);
  if (!lesson) return;

  const day = days.find(d => d.id === lesson.day);
  const cat = lesson.category || 'ders';

  document.querySelector('#detailName').textContent = lesson.name;
  document.querySelector('#detailDay').textContent = `${(day ? day.name : '').toUpperCase()} · ${lesson.time}`;
  document.querySelector('#detailCategoryIcon').textContent = categoryIcons[cat] || '✦';

  const badge = document.querySelector('#detailDifficulty');
  const diffLabel = { easy: 'Kolay', medium: 'Orta', hard: 'Zor' }[lesson.difficulty || 'easy'];
  badge.textContent = diffLabel;
  badge.style.background = lesson.difficulty === 'hard' ? '#fff0ed' : lesson.difficulty === 'medium' ? '#fff7e5' : '#eff8f0';
  badge.style.color = lesson.difficulty === 'hard' ? '#cf654e' : lesson.difficulty === 'medium' ? '#ac811c' : 'var(--green)';

  document.querySelector('#detailNotes').value = lesson.notes || '';
  document.querySelector('#detailCompleted').checked = lesson.completed;
  detailMoveDay.value = lesson.day;

  detailDialog.showModal();
}

// Mobilde veya detayda günü doğrudan seçerek taşıma
detailMoveDay.addEventListener('change', () => {
  const lesson = lessons.find(l => l.id === selectedLessonId);
  if (!lesson) return;
  lesson.day = detailMoveDay.value;
  saveLessons();
  renderPlanner();
  const day = days.find(d => d.id === lesson.day);
  document.querySelector('#detailDay').textContent = `${(day ? day.name : '').toUpperCase()} · ${lesson.time}`;
});

// Detay Formunu Kaydet
detailForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const lesson = lessons.find(l => l.id === selectedLessonId);
  if (!lesson) return;
  lesson.notes = document.querySelector('#detailNotes').value.trim();
  lesson.completed = document.querySelector('#detailCompleted').checked;
  saveLessons();
  renderPlanner();
  detailDialog.close();
});

// Detaydan Düzenleme Penceresine Geçiş (Madde 1)
editLessonButton.addEventListener('click', () => {
  const lesson = lessons.find(l => l.id === selectedLessonId);
  if (!lesson) return;

  detailDialog.close();

  document.querySelector('#editingLessonId').value = lesson.id;
  document.querySelector('#lessonName').value = lesson.name;
  document.querySelector('#lessonDay').value = lesson.day;
  document.querySelector('#lessonTime').value = lesson.time;
  document.querySelector('#lessonCategory').value = lesson.category || 'ders';
  document.querySelector('#lessonNotesInput').value = lesson.notes || '';

  const radio = document.querySelector(`input[name="difficulty"][value="${lesson.difficulty || 'easy'}"]`);
  if (radio) radio.checked = true;

  document.querySelector('#formEyebrow').textContent = 'DÜZENLE';
  document.querySelector('#formTitle').textContent = 'Görevi Düzenle';
  document.querySelector('#submitLessonBtn').innerHTML = 'Güncelle <span>✓</span>';

  lessonDialog.showModal();
});

// Detaydan Sil
deleteLessonButton.addEventListener('click', () => {
  if (confirm('Bu dersi/görevi silmek istediğine emin misin?')) {
    lessons = lessons.filter(l => l.id !== selectedLessonId);
    saveLessons();
    renderPlanner();
    detailDialog.close();
  }
});

// Detaydan Pomodoro Başlat
detailStartPomoBtn.addEventListener('click', () => {
  const lesson = lessons.find(l => l.id === selectedLessonId);
  detailDialog.close();
  switchTab('pomodoro');
  if (lesson) {
    pomoTaskSelect.value = lesson.id;
    timerStatusLabel.textContent = `Odak: ${lesson.name}`;
  }
});

// Tüm Planı Temizleme
document.querySelector('#clearAllButton').addEventListener('click', () => {
  if (!lessons.length && !notes.length) return;
  if (confirm('Tüm haftalık planı ve dersleri temizlemek istiyor musun? (Notların korunacaktır)')) {
    lessons = [];
    saveLessons();
    renderPlanner();
  }
});

// ================= 2. BÖLÜM: SERBEST NOT DEFTERİ (NOTEBOOK) =================
const notesGrid = document.querySelector('#notesGrid');
const openAddNoteButton = document.querySelector('#openAddNoteButton');
const closeNoteButton = document.querySelector('#closeNoteButton');
const noteSearchInput = document.querySelector('#noteSearchInput');
const notesBadge = document.querySelector('#notesBadge');
const notesCounter = document.querySelector('#notesCounter');

function renderNotes() {
  const query = (noteSearchInput.value || '').toLowerCase().trim();
  
  // Sabitlenenler en başta, ardından güncellenme sırasına göre
  const filteredNotes = notes.filter(n => {
    return n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query);
  }).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  notesBadge.textContent = notes.length;
  notesCounter.textContent = `${notes.length} not kayıtlı`;

  if (!filteredNotes.length) {
    notesGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px 16px; color: var(--muted);">
        <p style="font-size: 32px; margin: 0 0 10px;">📝</p>
        <p style="font-size: 15px; font-weight: 600; margin: 0;">${query ? 'Aramaya uygun not bulunamadı.' : 'Henüz not eklemedin.'}</p>
        <p style="font-size: 13px; margin: 6px 0 0;">Aklına gelen fikirleri ve önemli bilgileri kaydetmek için yukarıdaki butona tıkla.</p>
      </div>
    `;
    return;
  }

  notesGrid.innerHTML = filteredNotes.map(n => `
    <article class="note-item color-${n.color || 'paper'}" data-id="${n.id}">
      <div>
        <div class="note-header">
          <h3 class="note-title">${escapeHtml(n.title)}</h3>
          ${n.pinned ? '<span class="note-pin-badge" title="Sabitlendi">📌</span>' : ''}
        </div>
        <div class="note-content-text">${escapeHtml(n.content)}</div>
      </div>
      <div class="note-footer">
        <span class="note-date">${n.updatedAt || ''}</span>
        <div class="note-actions">
          <button type="button" class="note-btn toggle-pin" title="${n.pinned ? 'Sabitlemeyi kaldır' : 'Üste sabitle'}">
            ${n.pinned ? '📌 İğneyi Kaldır' : '📌 Sabitle'}
          </button>
          <button type="button" class="note-btn edit-note" title="Notu düzenle">✎</button>
          <button type="button" class="note-btn delete delete-note" title="Notu sil">✕</button>
        </div>
      </div>
    </article>
  `).join('');

  // Not Kartı Olayları
  notesGrid.querySelectorAll('.note-item').forEach(card => {
    const id = card.dataset.id;
    
    card.querySelector('.toggle-pin').addEventListener('click', (e) => {
      e.stopPropagation();
      const note = notes.find(n => n.id === id);
      if (note) {
        note.pinned = !note.pinned;
        saveNotes();
        renderNotes();
      }
    });

    card.querySelector('.edit-note').addEventListener('click', (e) => {
      e.stopPropagation();
      openEditNoteModal(id);
    });

    card.querySelector('.delete-note').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Bu notu silmek istiyor musun?')) {
        notes = notes.filter(n => n.id !== id);
        saveNotes();
        renderNotes();
      }
    });
  });
}

noteSearchInput.addEventListener('input', renderNotes);

openAddNoteButton.addEventListener('click', () => {
  noteForm.reset();
  document.querySelector('#editingNoteId').value = '';
  document.querySelector('#noteModalEyebrow').textContent = 'NOT DEFTERİM';
  document.querySelector('#noteModalTitle').textContent = 'Yeni Not Yaz';
  document.querySelector('#submitNoteBtn').innerHTML = 'Notu Kaydet <span>→</span>';
  noteDialog.showModal();
  document.querySelector('#noteTitle').focus();
});

closeNoteButton.addEventListener('click', () => noteDialog.close());

function openEditNoteModal(id) {
  const note = notes.find(n => n.id === id);
  if (!note) return;

  document.querySelector('#editingNoteId').value = note.id;
  document.querySelector('#noteTitle').value = note.title;
  document.querySelector('#noteContent').value = note.content;
  document.querySelector('#notePinned').checked = note.pinned || false;

  const colorRadio = document.querySelector(`input[name="noteColor"][value="${note.color || 'paper'}"]`);
  if (colorRadio) colorRadio.checked = true;

  document.querySelector('#noteModalEyebrow').textContent = 'DÜZENLE';
  document.querySelector('#noteModalTitle').textContent = 'Notu Düzenle';
  document.querySelector('#submitNoteBtn').innerHTML = 'Güncelle <span>✓</span>';

  noteDialog.showModal();
}

noteForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const editingId = document.querySelector('#editingNoteId').value;
  const title = document.querySelector('#noteTitle').value.trim();
  const content = document.querySelector('#noteContent').value.trim();
  const color = document.querySelector('input[name="noteColor"]:checked').value;
  const pinned = document.querySelector('#notePinned').checked;
  const updatedAt = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

  if (editingId) {
    const note = notes.find(n => n.id === editingId);
    if (note) {
      note.title = title;
      note.content = content;
      note.color = color;
      note.pinned = pinned;
      note.updatedAt = updatedAt;
    }
  } else {
    notes.unshift({
      id: crypto.randomUUID(),
      title,
      content,
      color,
      pinned,
      updatedAt
    });
  }

  saveNotes();
  renderNotes();
  noteDialog.close();
});

// ================= 3. BÖLÜM: POMODORO ODAK SAYACI (MADDE 3) =================
let pomoMode = 'work'; // 'work', 'short', 'long'
let pomoMinutes = 25;
let pomoSecondsLeft = pomoMinutes * 60;
let pomoInterval = null;
let pomoSessions = parseInt(localStorage.getItem(storageKeyPomo) || '0', 10);

const timerDigits = document.querySelector('#timerDigits');
const timerProgress = document.querySelector('#timerProgress');
const timerToggleBtn = document.querySelector('#timerToggleBtn');
const timerResetBtn = document.querySelector('#timerResetBtn');
const timerStatusLabel = document.querySelector('#timerStatusLabel');
const pomoSessionsCount = document.querySelector('#pomoSessionsCount');
const pomoTaskSelect = document.querySelector('#pomoTaskSelect');

pomoSessionsCount.textContent = pomoSessions;

function updatePomoDisplay() {
  const mins = Math.floor(pomoSecondsLeft / 60);
  const secs = pomoSecondsLeft % 60;
  timerDigits.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  // Halka İlerlemesi (628 tam dairedir)
  const totalSecs = pomoMinutes * 60;
  const progressRatio = pomoSecondsLeft / totalSecs;
  const offset = 628 * (1 - progressRatio);
  timerProgress.style.strokeDashoffset = offset;
}

function updatePomoTaskSelect() {
  const currentVal = pomoTaskSelect.value;
  const unfinishedLessons = lessons.filter(l => !l.completed);

  pomoTaskSelect.innerHTML = `
    <option value="">-- Serbest Odaklanma --</option>
    ${unfinishedLessons.map(l => `
      <option value="${l.id}">${escapeHtml(l.name)} (${l.time} - ${l.day.toUpperCase()})</option>
    `).join('')}
  `;

  if (currentVal && unfinishedLessons.some(l => l.id === currentVal)) {
    pomoTaskSelect.value = currentVal;
  }
}

pomoTaskSelect.addEventListener('change', () => {
  const selected = lessons.find(l => l.id === pomoTaskSelect.value);
  if (selected) {
    timerStatusLabel.textContent = `Odak: ${selected.name}`;
  } else {
    timerStatusLabel.textContent = pomoMode === 'work' ? 'Odak Seansı' : 'Mola Zamanı';
  }
});

// Mod Butonları
document.querySelectorAll('.pomo-mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pomo-mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    pomoMode = btn.dataset.mode;
    pomoMinutes = parseInt(btn.dataset.time, 10);
    clearInterval(pomoInterval);
    pomoInterval = null;
    timerToggleBtn.textContent = 'Başlat';
    pomoSecondsLeft = pomoMinutes * 60;

    const selected = lessons.find(l => l.id === pomoTaskSelect.value);
    if (selected && pomoMode === 'work') {
      timerStatusLabel.textContent = `Odak: ${selected.name}`;
    } else {
      timerStatusLabel.textContent = pomoMode === 'work' ? 'Odak Seansı' : (pomoMode === 'short' ? 'Kısa Mola' : 'Uzun Mola');
    }

    updatePomoDisplay();
  });
});

timerToggleBtn.addEventListener('click', () => {
  if (pomoInterval) {
    // Duraklat
    clearInterval(pomoInterval);
    pomoInterval = null;
    timerToggleBtn.textContent = 'Devam Et';
  } else {
    // Başlat
    timerToggleBtn.textContent = 'Duraklat';
    pomoInterval = setInterval(() => {
      if (pomoSecondsLeft > 0) {
        pomoSecondsLeft--;
        updatePomoDisplay();
      } else {
        // Süre Doldu!
        clearInterval(pomoInterval);
        pomoInterval = null;
        timerToggleBtn.textContent = 'Başlat';
        playNotificationTone();

        if (pomoMode === 'work') {
          pomoSessions++;
          localStorage.setItem(storageKeyPomo, pomoSessions.toString());
          pomoSessionsCount.textContent = pomoSessions;
          syncToCloud();
          alert('Tebrikler! 25 dakikalık odak seansını başarıyla tamamladın! 🍅 Şimdi kısa bir mola ver.');
        } else {
          alert('Mola bitti! Yeni bir odak seansına hazır mısın? 🚀');
        }

        pomoSecondsLeft = pomoMinutes * 60;
        updatePomoDisplay();
      }
    }, 1000);
  }
});

timerResetBtn.addEventListener('click', () => {
  clearInterval(pomoInterval);
  pomoInterval = null;
  timerToggleBtn.textContent = 'Başlat';
  pomoSecondsLeft = pomoMinutes * 60;
  updatePomoDisplay();
});

// Zarif Melodik Web Audio Zil Sesi
function playNotificationTone() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880, now + 0.15); // A5
    osc.frequency.setValueAtTime(1174.66, now + 0.35); // D6

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc.start(now);
    osc.stop(now + 1.2);
  } catch (err) {
    console.warn('AudioContext ses çalınamadı:', err);
  }
}

// ================= 5. BÖLÜM: YEDEKLE & CİHAZLAR ARASI AKTAR (EXPORT / IMPORT) =================
const openBackupButton = document.querySelector('#openBackupButton');
const closeBackupButton = document.querySelector('#closeBackupButton');
const exportJsonBtn = document.querySelector('#exportJsonBtn');
const importJsonFileInput = document.querySelector('#importJsonFileInput');
const copyDataBtn = document.querySelector('#copyDataBtn');
const pasteDataBtn = document.querySelector('#pasteDataBtn');
const rawJsonTextarea = document.querySelector('#rawJsonTextarea');

openBackupButton.addEventListener('click', () => backupDialog.showModal());
closeBackupButton.addEventListener('click', () => backupDialog.close());

// JSON Olarak Dışa Aktar (Dosya İndir)
exportJsonBtn.addEventListener('click', () => {
  const exportData = {
    appName: 'Derslik',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    lessons,
    notes,
    pomoSessions
  };

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
  const downloadAnchor = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `derslik-yedek-${dateStr}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
});

// JSON Dosyası Yükle (İçe Aktar)
importJsonFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const imported = JSON.parse(event.target.result);
      applyImportedData(imported);
      alert('Yedek başarıyla yüklendi! Planın ve notların güncellendi.');
      backupDialog.close();
    } catch (err) {
      alert('Hata: Geçerli bir Derslik JSON yedek dosyası seçmelisiniz.');
    }
  };
  reader.readAsText(file);
});

// Metin Olarak Panoya Kopyala
copyDataBtn.addEventListener('click', () => {
  const exportData = {
    appName: 'Derslik',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    lessons,
    notes,
    pomoSessions
  };
  const jsonStr = JSON.stringify(exportData);
  navigator.clipboard.writeText(jsonStr).then(() => {
    alert('Tüm verilerin panoya kopyalandı! Şimdi WhatsApp veya e-posta ile telefonuna gönderip orada yapıştırabilirsin.');
  }).catch(() => {
    rawJsonTextarea.value = jsonStr;
    alert('Veri aşağıdaki metin kutusuna yazıldı. Kopyalayabilirsin.');
  });
});

// Metinden Geri Yükle
pasteDataBtn.addEventListener('click', () => {
  const text = rawJsonTextarea.value.trim();
  if (!text) {
    alert('Lütfen önce metin kutusuna kopyaladığınız veriyi yapıştırın.');
    return;
  }
  try {
    const imported = JSON.parse(text);
    applyImportedData(imported);
    alert('Veriler metinden başarıyla geri yüklendi!');
    rawJsonTextarea.value = '';
    backupDialog.close();
  } catch (e) {
    alert('Hata: Metin geçerli bir JSON verisi değil.');
  }
});

function applyImportedData(data) {
  if (data.lessons && Array.isArray(data.lessons)) {
    lessons = data.lessons;
    saveLessons();
  }
  if (data.notes && Array.isArray(data.notes)) {
    notes = data.notes;
    saveNotes();
  }
  if (typeof data.pomoSessions === 'number') {
    pomoSessions = data.pomoSessions;
    localStorage.setItem(storageKeyPomo, pomoSessions.toString());
    pomoSessionsCount.textContent = pomoSessions;
  }
  renderPlanner();
  renderNotes();
}

// ================= GOOGLE GİRİŞİ VE CANLI SENKRONİZASYON =================
const loginBtn = document.querySelector('#loginBtn');
const userPill = document.querySelector('#userPill');
const userAvatar = document.querySelector('#userAvatar');
const userName = document.querySelector('#userName');
const logoutBtn = document.querySelector('#logoutBtn');

if (auth && loginBtn) {
  loginBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch((error) => {
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
        auth.signInWithRedirect(provider);
      } else {
        alert('Giriş yapılamadı: ' + error.message);
      }
    });
  });

  logoutBtn.addEventListener('click', () => {
    if (confirm('Google hesabından çıkış yapmak istiyor musun?')) {
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }
      auth.signOut().then(() => {
        currentUser = null;
      });
    }
  });

  auth.onAuthStateChanged((user) => {
    currentUser = user;
    if (user) {
      loginBtn.style.display = 'none';
      userPill.style.display = 'inline-flex';
      userName.textContent = user.displayName ? user.displayName.split(' ')[0] : 'Kullanıcı';
      if (user.photoURL) {
        userAvatar.src = user.photoURL;
      }

      // Canlı Bulut Dinleyicisi (Realtime sync)
      if (unsubscribeFirestore) unsubscribeFirestore();

      unsubscribeFirestore = db.collection('users').doc(user.uid).onSnapshot((doc) => {
        if (doc.exists) {
          const data = doc.data();
          let needsReRender = false;
          if (data.lessons && Array.isArray(data.lessons)) {
            lessons = data.lessons;
            localStorage.setItem(storageKeyLessons, JSON.stringify(lessons));
            needsReRender = true;
          }
          if (data.notes && Array.isArray(data.notes)) {
            notes = data.notes;
            localStorage.setItem(storageKeyNotes, JSON.stringify(notes));
            needsReRender = true;
          }
          if (typeof data.pomoSessions === 'number') {
            pomoSessions = data.pomoSessions;
            localStorage.setItem(storageKeyPomo, pomoSessions.toString());
            pomoSessionsCount.textContent = pomoSessions;
          }
          if (needsReRender) {
            renderPlanner();
            renderNotes();
            updatePomoTaskSelect();
          }
        } else {
          // İlk kez giriş yapılıyorsa cihazdaki mevcut veriyi buluta ilk yedek olarak gönder
          syncToCloud();
        }
      }, (err) => {
        console.warn('Firestore dinleme hatası:', err);
      });
    } else {
      loginBtn.style.display = 'inline-flex';
      userPill.style.display = 'none';
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }
    }
  });
}

// ================= SERVICE WORKER KAYDI (PWA / MOBİL) =================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Derslik Service Worker kayıtlı:', reg.scope))
      .catch(err => console.log('Service Worker kaydı yapılamadı:', err));
  });
}

// ================= İLK YÜKLEME =================
renderPlanner();
renderNotes();
updatePomoDisplay();
