// ============================================================
// surah-detail.js — v4.0
// All features: sidebar search, para tab, goto, main tabs,
// transliteration, settings, full-surah audio, তিলাওয়াত panel
// ============================================================

'use strict';

// -------------------------------------------------------
// State
// -------------------------------------------------------
let currentSurahId  = 1;
let surahData       = null;     // getSurahAllDataFull result
let currentLang     = 'bn';
let arabicFontSize  = 'md';
let currentMainTab  = 'translation';

// Audio
let audioElement    = null;
let playingGlobal   = null;
let playingBtn      = null;
let fullSurahMode   = false;
let fullSurahIdx    = 0;

// Sidebar search cache
let allSurahsCache  = [];

// Settings (persisted in localStorage)
let settings = {
    translationEdition:  'bn',   // 'bn' | 'en.sahih' | 'en.pickthall'
    showTransliteration: false,
    autoExpandTafsir:    false,
};

// -------------------------------------------------------
// Init
// -------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    currentSurahId = Math.min(114, Math.max(1, parseInt(params.get('id'), 10) || 1));
    const jumpAyah = parseInt(params.get('ayah'), 10) || null;

    currentLang    = localStorage.getItem('quran_lang')      || 'bn';
    arabicFontSize = localStorage.getItem('quran_font_size') || 'md';
    loadSettings();

    audioElement = document.getElementById('quran-audio');
    audioElement.addEventListener('ended', onAudioEnded);
    audioElement.addEventListener('error', onAudioError);

    initTheme();
    applyLanguage();
    updateNavButtons();
    applySettingsUI();

    // Header controls
    document.getElementById('lang-toggle').addEventListener('click', toggleLanguage);
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('font-decrease').addEventListener('click', () => changeFontSize(-1));
    document.getElementById('font-increase').addEventListener('click', () => changeFontSize(1));

    // Settings btn
    document.getElementById('settings-btn').addEventListener('click', toggleSettingsPanel);
    document.addEventListener('click', e => {
        const panel = document.getElementById('settings-panel');
        const btn   = document.getElementById('settings-btn');
        if (!panel || panel.classList.contains('hidden')) return;
        if (!panel.contains(e.target) && !btn.contains(e.target)) {
            panel.classList.add('hidden');
            btn.classList.remove('active');
        }
    });

    // Settings controls
    document.getElementById('translation-select').addEventListener('change', e => {
        settings.translationEdition = e.target.value;
        saveSettings();
        if (surahData) renderAyahs();
    });
    document.getElementById('toggle-transliteration').addEventListener('change', e => {
        settings.showTransliteration = e.target.checked;
        saveSettings();
        document.getElementById('ayah-list')
            ?.classList.toggle('show-transliteration', settings.showTransliteration);
    });
    document.getElementById('toggle-tafsir-auto').addEventListener('change', e => {
        settings.autoExpandTafsir = e.target.checked;
        saveSettings();
        if (surahData) renderAyahs();
    });

    // Prev / next surah
    document.getElementById('prev-surah').addEventListener('click', () => navigate(-1));
    document.getElementById('next-surah').addEventListener('click', () => navigate(1));

    // Sidebar toggle (mobile)
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
        overlay.setAttribute('aria-hidden', sidebar.classList.contains('open') ? 'false' : 'true');
    });
    overlay.addEventListener('click', closeSidebar);

    // Sidebar tabs
    document.getElementById('stab-surah').addEventListener('click', () => switchSidebarTab('surah'));
    document.getElementById('stab-para').addEventListener('click',  () => switchSidebarTab('para'));

    // Sidebar search
    document.getElementById('sidebar-search').addEventListener('input', onSidebarSearch);

    // Sidebar goto
    document.getElementById('goto-btn').addEventListener('click', onGotoClick);
    document.getElementById('goto-ayah').addEventListener('keydown', e => {
        if (e.key === 'Enter') onGotoClick();
    });

    // Main tabs
    document.getElementById('mtab-translation').addEventListener('click', () => switchMainTab('translation'));
    document.getElementById('mtab-tilawat').addEventListener('click',     () => switchMainTab('tilawat'));

    // Load everything
    loadSidebar(jumpAyah);
    loadSurah(jumpAyah);
});

// -------------------------------------------------------
// Settings persistence
// -------------------------------------------------------
function loadSettings() {
    try {
        const saved = localStorage.getItem('quran_settings');
        if (saved) Object.assign(settings, JSON.parse(saved));
    } catch { /* ignore */ }
}
function saveSettings() {
    try { localStorage.setItem('quran_settings', JSON.stringify(settings)); } catch { /* ignore */ }
}
function applySettingsUI() {
    const sel = document.getElementById('translation-select');
    if (sel) sel.value = settings.translationEdition;
    const trEl = document.getElementById('toggle-transliteration');
    if (trEl) trEl.checked = settings.showTransliteration;
    const taEl = document.getElementById('toggle-tafsir-auto');
    if (taEl) taEl.checked = settings.autoExpandTafsir;
}

function toggleSettingsPanel() {
    const panel = document.getElementById('settings-panel');
    const btn   = document.getElementById('settings-btn');
    if (!panel) return;
    const opening = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !opening);
    btn.classList.toggle('active', opening);
}

// -------------------------------------------------------
// Theme
// -------------------------------------------------------
function initTheme() {
    const saved = localStorage.getItem('quran_theme');
    const sys   = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(saved || (sys ? 'dark' : 'light'));
}
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.querySelector('#theme-toggle .theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}
function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('quran_theme', next);
}

// -------------------------------------------------------
// Language
// -------------------------------------------------------
function applyLanguage() {
    const btn = document.getElementById('lang-toggle');
    if (btn) btn.textContent = currentLang === 'bn' ? 'EN' : 'বাং';
}
function toggleLanguage() {
    currentLang = currentLang === 'bn' ? 'en' : 'bn';
    localStorage.setItem('quran_lang', currentLang);
    applyLanguage();
    if (surahData) { updateHeaderInfo(); checkBookmark(); }
}

// -------------------------------------------------------
// Arabic font size
// -------------------------------------------------------
const FONT_SIZES = ['sm', 'md', 'lg'];

function applyFontSize() {
    const list = document.getElementById('ayah-list');
    if (!list) return;
    list.classList.remove('arabic-font-sm', 'arabic-font-md', 'arabic-font-lg');
    if (arabicFontSize !== 'md') list.classList.add(`arabic-font-${arabicFontSize}`);
    document.getElementById('font-decrease').disabled = arabicFontSize === 'sm';
    document.getElementById('font-increase').disabled = arabicFontSize === 'lg';
}
function changeFontSize(dir) {
    const idx  = FONT_SIZES.indexOf(arabicFontSize);
    const next = FONT_SIZES[Math.max(0, Math.min(FONT_SIZES.length - 1, idx + dir))];
    if (next === arabicFontSize) return;
    arabicFontSize = next;
    localStorage.setItem('quran_font_size', arabicFontSize);
    applyFontSize();
}

// -------------------------------------------------------
// Navigation
// -------------------------------------------------------
function navigate(dir) {
    const next = currentSurahId + dir;
    if (next < 1 || next > 114) return;
    window.location.href = `surah.html?id=${next}`;
}
function updateNavButtons() {
    document.getElementById('prev-surah').disabled = currentSurahId <= 1;
    document.getElementById('next-surah').disabled = currentSurahId >= 114;
}

// -------------------------------------------------------
// Sidebar helpers
// -------------------------------------------------------
function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
}

function switchSidebarTab(which) {
    const isSurah = which === 'surah';
    document.getElementById('stab-surah').classList.toggle('active',  isSurah);
    document.getElementById('stab-para').classList.toggle('active',  !isSurah);
    document.getElementById('sidebar-surah-list').classList.toggle('hidden', !isSurah);
    document.getElementById('sidebar-para-list').classList.toggle('hidden',  isSurah);
}

function onSidebarSearch(e) {
    if (!allSurahsCache.length) return;
    const q = e.target.value.trim().toLowerCase();
    const filtered = q
        ? allSurahsCache.filter(s =>
            (s.bengaliName || '').toLowerCase().includes(q) ||
            s.englishName.toLowerCase().includes(q) ||
            String(s.number).includes(q))
        : allSurahsCache;
    renderSidebarSurahs(filtered);
}

async function loadSidebar(jumpAyah) {
    try {
        allSurahsCache = await getAllSurahs();
        renderSidebarSurahs(allSurahsCache);
        renderParaList();
    } catch { /* non-fatal */ }
}

function renderSidebarSurahs(surahs) {
    const list = document.getElementById('sidebar-surah-list');
    if (!list) return;

    if (!surahs.length) {
        list.innerHTML = '<div class="sidebar-para-coming">কোনো ফলাফল নেই</div>';
        return;
    }

    list.innerHTML = surahs.map(s => {
        const isActive = s.number === currentSurahId;
        return `<a class="sbl-item${isActive ? ' active' : ''}"
                   href="surah.html?id=${s.number}"
                   aria-current="${isActive ? 'page' : 'false'}"
                   title="${s.englishName}">
                    <span class="sbl-num">${toBengaliNumber(s.number)}</span>
                    <span class="sbl-name">${s.bengaliName || s.englishName}</span>
                </a>`;
    }).join('');

    const activeEl = list.querySelector('.sbl-item.active');
    if (activeEl) setTimeout(() => activeEl.scrollIntoView({ block: 'center' }), 200);
}

function renderParaList() {
    const list = document.getElementById('sidebar-para-list');
    if (!list) return;
    const paras = getParaList();
    list.innerHTML = paras.map(p => `
        <a class="para-item" href="surah.html?id=${p.surah}&ayah=${p.ayah}">
            <span class="para-num">${toBengaliNumber(p.num)}</span>
            <span class="para-name">${p.name}</span>
        </a>`).join('');
}

function renderAyahStrip(count) {
    const container = document.getElementById('sidebar-ayah-nums');
    if (!container) return;
    let html = '';
    for (let i = 1; i <= count; i++) {
        html += `<button type="button" class="ayah-strip-btn"
                         onclick="jumpToAyah(${i})"
                         aria-label="আয়াত ${i}">${toBengaliNumber(i)}</button>`;
    }
    container.innerHTML = html;
}

function jumpToAyah(n) {
    document.getElementById(`ayah-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    closeSidebar();
}

function highlightStripBtn(n) {
    document.querySelectorAll('.ayah-strip-btn').forEach((btn, i) =>
        btn.classList.toggle('active', i + 1 === n));
}

// -------------------------------------------------------
// Goto surah:ayah
// -------------------------------------------------------
function onGotoClick() {
    const surahVal = parseInt(document.getElementById('goto-surah').value, 10);
    const ayahVal  = parseInt(document.getElementById('goto-ayah').value, 10);

    if (!surahVal || surahVal < 1 || surahVal > 114) {
        showToast('সূরা নম্বর ১–১১৪ এর মধ্যে হতে হবে।');
        return;
    }

    if (surahVal === currentSurahId) {
        // Same surah — scroll to ayah
        if (ayahVal >= 1) jumpToAyah(ayahVal);
        closeSidebar();
    } else {
        const url = `surah.html?id=${surahVal}${ayahVal >= 1 ? '&ayah=' + ayahVal : ''}`;
        window.location.href = url;
    }
}

// -------------------------------------------------------
// Main content tab switcher
// -------------------------------------------------------
function switchMainTab(tab) {
    currentMainTab = tab;
    const isTrans = tab === 'translation';
    document.getElementById('mtab-translation').classList.toggle('active',  isTrans);
    document.getElementById('mtab-tilawat').classList.toggle('active',     !isTrans);
    document.getElementById('mtab-translation').setAttribute('aria-selected', isTrans);
    document.getElementById('mtab-tilawat').setAttribute('aria-selected',    !isTrans);
    document.getElementById('panel-translation').classList.toggle('hidden', !isTrans);
    document.getElementById('panel-tilawat').classList.toggle('hidden',      isTrans);

    if (!isTrans && surahData) renderTilawatPanel();
}

// -------------------------------------------------------
// Load surah data
// -------------------------------------------------------
async function loadSurah(jumpAyah) {
    showLoadingState();
    try {
        surahData = await getSurahAllDataFull(currentSurahId);
        updateHeaderInfo();
        renderAyahs();
        checkBookmark();
        if (jumpAyah) setTimeout(() => jumpToAyah(jumpAyah), 400);
    } catch (err) {
        showErrorState(err.message);
    }
}

// -------------------------------------------------------
// Surah info header (with full audio button)
// -------------------------------------------------------
function updateHeaderInfo() {
    const s = surahData.arabic;
    const bnName    = getBengaliName(s.number)    || s.englishName;
    const bnMeaning = getBengaliMeaning(s.number) || s.englishNameTranslation;
    const isMekki   = s.revelationType === 'Meccan';

    const displayName    = currentLang === 'bn' ? bnName    : s.englishName;
    const displayMeaning = currentLang === 'bn' ? bnMeaning : s.englishNameTranslation;
    const revLabel       = currentLang === 'bn' ? (isMekki ? 'মক্কী' : 'মাদানী') : s.revelationType;
    const ayahLabel      = currentLang === 'bn'
        ? `মোট আয়াতঃ ${toBengaliNumber(s.numberOfAyahs)}`
        : `${s.numberOfAyahs} Ayahs`;

    document.title = `সূরা ${displayName} | পবিত্র কুরআন`;
    const nameEl = document.getElementById('page-surah-name');
    if (nameEl) nameEl.textContent = displayName;

    const header = document.getElementById('surah-info-header');
    if (!header) return;

    header.innerHTML = `
        <div class="sih-inner">
            <div class="sih-left">
                <div class="sih-title">
                    সূরা ${escapeHtml(displayName)}
                    <span class="sih-arabic-inline">${s.name}</span>
                </div>
                <div class="sih-meaning">${escapeHtml(displayMeaning)}</div>
                <div class="sih-tags">
                    <span class="sih-tag">${revLabel}</span>
                    <span class="sih-tag">${ayahLabel}</span>
                    <span class="sih-tag">${toBengaliNumber(s.number)} / ${toBengaliNumber(114)}</span>
                </div>
            </div>
            <div class="sih-right">
                <button type="button" class="full-audio-btn" id="full-audio-btn"
                        aria-label="পুরো সূরা তিলাওয়াত">▶ পুরো সূরা</button>
                <div class="full-audio-progress" id="full-audio-progress"></div>
            </div>
        </div>`;

    document.getElementById('full-audio-btn').addEventListener('click', toggleFullSurahAudio);
}

// -------------------------------------------------------
// Render ayah cards (translation + transliteration)
// -------------------------------------------------------
function getTranslationText(i) {
    if (settings.translationEdition === 'en.pickthall') {
        return surahData.englishPickthall?.ayahs[i]?.text || '';
    }
    if (settings.translationEdition === 'en.sahih') {
        return surahData.englishSahih?.ayahs[i]?.text || '';
    }
    return surahData.bengali?.ayahs[i]?.text || '';
}

function getEnglishText(i) {
    return surahData.englishSahih?.ayahs[i]?.text || '';
}

function renderAyahs() {
    const list    = document.getElementById('ayah-list');
    const arAyahs = surahData.arabic.ayahs;
    const surahBnName = getBengaliName(currentSurahId);

    // Show bismillah (not for surah 1 or 9)
    if (currentSurahId !== 1 && currentSurahId !== 9) {
        document.getElementById('bismillah-block')?.classList.remove('hidden');
    }

    list.innerHTML = arAyahs.map((ayah, i) => {
        const transText = getTranslationText(i);
        const trText    = surahData.transliteration?.ayahs[i]?.text || '';
        const enText    = getEnglishText(i);
        const bnNum     = toBengaliNumber(ayah.numberInSurah);
        const bracketRef = `[${surahBnName}: ${bnNum}]`;

        const isBn = settings.translationEdition === 'bn';

        return `
        <div class="ayah-card" id="ayah-${ayah.numberInSurah}"
             data-ayah="${ayah.numberInSurah}" data-global="${ayah.number}">

            <div class="ayah-top">
                <div class="ayah-num-circle" aria-label="আয়াত ${ayah.numberInSurah}">${bnNum}</div>
                <div class="ayah-arabic" lang="ar">${ayah.text}</div>
            </div>

            ${trText ? `<div class="ayah-transliteration">${escapeHtml(trText)}</div>` : ''}

            ${transText ? `<div class="ayah-bn-text">
                ${escapeHtml(transText)}${isBn ? `<span class="ayah-ref"> ${bracketRef}</span>` : ''}
            </div>` : ''}

            <div class="ayah-action-bar" role="toolbar" aria-label="আয়াত ${ayah.numberInSurah} অ্যাকশন">
                <button type="button" class="ayah-action-btn tafsir-toggle-btn${settings.autoExpandTafsir ? ' active' : ''}"
                        data-ayah="${ayah.numberInSurah}" title="তাফসীর দেখুন">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                    </svg>
                    তাফসীর
                </button>
                <button type="button" class="ayah-action-btn share-ayah-btn"
                        data-ayah="${ayah.numberInSurah}" title="শেয়ার করুন">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <circle cx="18" cy="5"  r="3"/>
                        <circle cx="6"  cy="12" r="3"/>
                        <circle cx="18" cy="19" r="3"/>
                        <line x1="8.59"  y1="13.51" x2="15.42" y2="17.49"/>
                        <line x1="15.41" y1="6.51"  x2="8.59"  y2="10.49"/>
                    </svg>
                </button>
                <div class="ayah-num-badge-action" aria-hidden="true">${bnNum}</div>
                <button type="button" class="ayah-action-btn bookmark-ayah-btn"
                        data-ayah="${ayah.numberInSurah}" title="বুকমার্ক করুন">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                </button>
                <button type="button" class="ayah-action-btn play-btn"
                        data-global="${ayah.number}" data-local="${ayah.numberInSurah}"
                        aria-label="আয়াত ${ayah.numberInSurah} অডিও" title="তিলাওয়াত শুনুন">
                    ${playIcon()}
                    <span class="audio-label">অডিও</span>
                </button>
            </div>

            ${enText ? `
            <div class="tafsir-panel${settings.autoExpandTafsir ? '' : ' hidden'}" id="tafsir-${ayah.numberInSurah}">
                <div class="tafsir-heading">তাফসীরঃ (Sahih International)</div>
                <p class="tafsir-text">${escapeHtml(enText)}</p>
            </div>` : ''}
        </div>`;
    }).join('');

    // Apply persisted preferences
    list.classList.toggle('show-transliteration', settings.showTransliteration);
    applyFontSize();

    // Wire per-card events
    list.querySelectorAll('.tafsir-toggle-btn').forEach(btn =>
        btn.addEventListener('click', onTafsirClick));
    list.querySelectorAll('.share-ayah-btn').forEach(btn =>
        btn.addEventListener('click', onShareClick));
    list.querySelectorAll('.bookmark-ayah-btn').forEach(btn =>
        btn.addEventListener('click', onBookmarkClick));
    list.querySelectorAll('.play-btn').forEach(btn =>
        btn.addEventListener('click', onPlayClick));

    document.getElementById('loading-state').classList.add('hidden');
    list.classList.remove('hidden');

    renderAyahStrip(arAyahs.length);
    setupBookmarkObserver();
}

// -------------------------------------------------------
// তিলাওয়াত panel — mushaf style continuous Arabic
// -------------------------------------------------------
function toArabicNumeral(n) {
    const map = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    return String(n).replace(/[0-9]/g, d => map[parseInt(d)]);
}

function renderTilawatPanel() {
    const panel = document.getElementById('tilawat-content');
    if (!panel || !surahData) return;

    const arAyahs  = surahData.arabic.ayahs;
    const surahName = getBengaliName(currentSurahId) || surahData.arabic.englishName;

    // Bismillah (not surah 1 or 9)
    const bismillahHtml = (currentSurahId !== 1 && currentSurahId !== 9)
        ? `<div class="bismillah-arabic" style="text-align:center;margin-bottom:1rem">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>`
        : '';

    const ayahsHtml = arAyahs.map(ayah =>
        `${ayah.text}<span class="ayah-end-mark" title="আয়াত ${ayah.numberInSurah}"> ۝${toArabicNumeral(ayah.numberInSurah)} </span>`
    ).join(' ');

    panel.innerHTML = `
        <div class="tilawat-container">
            <div class="tilawat-heading">সূরা ${escapeHtml(surahName)} — সম্পূর্ণ তিলাওয়াত</div>
            ${bismillahHtml}
            <div class="tilawat-arabic" dir="rtl" lang="ar">${ayahsHtml}</div>
        </div>`;
}

// -------------------------------------------------------
// Tafsir toggle
// -------------------------------------------------------
function onTafsirClick(e) {
    const btn     = e.currentTarget;
    const ayahNum = btn.dataset.ayah;
    const panel   = document.getElementById(`tafsir-${ayahNum}`);
    if (!panel) { showToast('এই আয়াতের তাফসীর পাওয়া যায়নি।'); return; }
    const opening = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !opening);
    btn.classList.toggle('active', opening);
}

// -------------------------------------------------------
// Share ayah
// -------------------------------------------------------
function onShareClick(e) {
    const ayahNum   = parseInt(e.currentTarget.dataset.ayah, 10);
    const card      = document.getElementById(`ayah-${ayahNum}`);
    const arabicTxt = card?.querySelector('.ayah-arabic')?.textContent?.trim() || '';
    const transTxt  = card?.querySelector('.ayah-bn-text')?.textContent?.trim() || '';
    const surahName = getBengaliName(currentSurahId);
    const bnNum     = toBengaliNumber(ayahNum);
    const text      = [arabicTxt, transTxt].filter(Boolean).join('\n\n');
    const full      = `${text}\n\n[${surahName}: ${bnNum}]`;

    if (navigator.share) {
        navigator.share({ title: `কুরআন — ${surahName} আয়াত ${bnNum}`, text: full }).catch(() => {});
    } else {
        navigator.clipboard?.writeText(full)
            .then(() => showToast('আয়াত কপি হয়েছে! ✓'))
            .catch(() => showToast('কপি করা যায়নি।'));
    }
}

// -------------------------------------------------------
// Bookmark (manual click)
// -------------------------------------------------------
function onBookmarkClick(e) {
    const ayahNum = parseInt(e.currentTarget.dataset.ayah, 10);
    saveBookmark(currentSurahId, ayahNum);
    showToast(currentLang === 'bn'
        ? `আয়াত ${toBengaliNumber(ayahNum)} বুকমার্ক করা হয়েছে।`
        : `Ayah ${ayahNum} bookmarked.`);
}

// -------------------------------------------------------
// Per-ayah audio
// -------------------------------------------------------
function onPlayClick(e) {
    const btn       = e.currentTarget;
    const globalNum = parseInt(btn.dataset.global, 10);
    const localNum  = parseInt(btn.dataset.local,  10);

    if (fullSurahMode) { stopFullSurahAudio(); }

    if (playingGlobal === globalNum && !audioElement.paused) {
        audioElement.pause();
        resetPlayingState();
        return;
    }

    stopCurrent();

    audioElement.src = buildAudioUrl(globalNum);
    btn.classList.add('loading');
    btn.querySelector('svg')?.remove();

    audioElement.play()
        .then(() => {
            btn.classList.remove('loading');
            btn.insertAdjacentHTML('afterbegin', pauseIcon());
            btn.classList.add('playing');
            playingGlobal = globalNum;
            playingBtn    = btn;
            document.getElementById(`ayah-${localNum}`)?.classList.add('playing');
            highlightStripBtn(localNum);
        })
        .catch(() => {
            btn.classList.remove('loading');
            btn.insertAdjacentHTML('afterbegin', playIcon());
            showToast(currentLang === 'bn'
                ? 'অডিও চালানো যায়নি। নেটওয়ার্ক পরীক্ষা করুন।'
                : 'Could not play audio.');
        });
}

function stopCurrent() {
    if (!audioElement.paused) audioElement.pause();
    if (playingBtn) resetBtn(playingBtn);
    if (playingGlobal !== null) {
        const local = getLocalNum(playingGlobal);
        if (local) document.getElementById(`ayah-${local}`)?.classList.remove('playing');
    }
    playingGlobal = null;
    playingBtn    = null;
}

function resetPlayingState() {
    if (playingBtn) resetBtn(playingBtn);
    if (playingGlobal !== null) {
        const local = getLocalNum(playingGlobal);
        if (local) document.getElementById(`ayah-${local}`)?.classList.remove('playing');
    }
    playingGlobal = null;
    playingBtn    = null;
}

function onAudioEnded() {
    if (fullSurahMode) {
        fullSurahIdx++;
        advanceFullSurah();
    } else {
        resetPlayingState();
    }
}
function onAudioError() {
    if (fullSurahMode) {
        stopFullSurahAudio();
    } else {
        resetPlayingState();
        showToast(currentLang === 'bn' ? 'অডিও লোড হয়নি।' : 'Audio failed to load.');
    }
}

function resetBtn(btn) {
    btn.classList.remove('playing', 'loading');
    btn.querySelector('svg')?.remove();
    btn.insertAdjacentHTML('afterbegin', playIcon());
}
function getLocalNum(globalNum) {
    return surahData?.arabic.ayahs.find(a => a.number === globalNum)?.numberInSurah ?? null;
}

function playIcon() {
    return `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <polygon points="5,3 19,12 5,21"/>
    </svg>`;
}
function pauseIcon() {
    return `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="6" y="4" width="4" height="16"/>
        <rect x="14" y="4" width="4" height="16"/>
    </svg>`;
}
function stopIcon() {
    return `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
    </svg>`;
}

// -------------------------------------------------------
// Full surah sequential audio
// -------------------------------------------------------
function toggleFullSurahAudio() {
    if (fullSurahMode) {
        stopFullSurahAudio();
    } else {
        startFullSurahAudio();
    }
}

function startFullSurahAudio() {
    stopCurrent();
    fullSurahMode = true;
    fullSurahIdx  = 0;
    advanceFullSurah();
}

function stopFullSurahAudio() {
    fullSurahMode = false;
    fullSurahIdx  = 0;
    if (!audioElement.paused) audioElement.pause();
    updateFullAudioBtn();
    // Remove playing class from all cards
    document.querySelectorAll('.ayah-card.playing').forEach(c => c.classList.remove('playing'));
    highlightStripBtn(-1);
}

function advanceFullSurah() {
    if (!fullSurahMode || !surahData) return;
    const ayahs = surahData.arabic.ayahs;
    if (fullSurahIdx >= ayahs.length) {
        stopFullSurahAudio();
        showToast('তিলাওয়াত সম্পন্ন হয়েছে।');
        return;
    }

    const ayah = ayahs[fullSurahIdx];
    audioElement.src = buildAudioUrl(ayah.number);
    audioElement.play().catch(() => stopFullSurahAudio());

    // Highlight current ayah
    document.querySelectorAll('.ayah-card.playing').forEach(c => c.classList.remove('playing'));
    document.getElementById(`ayah-${ayah.numberInSurah}`)?.classList.add('playing');
    document.getElementById(`ayah-${ayah.numberInSurah}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    highlightStripBtn(ayah.numberInSurah);

    updateFullAudioBtn();
}

function updateFullAudioBtn() {
    const btn      = document.getElementById('full-audio-btn');
    const progress = document.getElementById('full-audio-progress');
    if (!btn) return;

    if (fullSurahMode) {
        const total = surahData?.arabic.ayahs.length || 0;
        btn.innerHTML = `${stopIcon()} থামাও`;
        btn.classList.add('playing');
        if (progress) {
            progress.textContent = `${toBengaliNumber(fullSurahIdx + 1)} / ${toBengaliNumber(total)} আয়াত`;
        }
    } else {
        btn.innerHTML = '▶ পুরো সূরা';
        btn.classList.remove('playing');
        if (progress) progress.textContent = '';
    }
}

// -------------------------------------------------------
// Bookmark (IntersectionObserver — auto-save)
// -------------------------------------------------------
function setupBookmarkObserver() {
    if (!('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                const n = parseInt(e.target.dataset.ayah, 10);
                saveBookmark(currentSurahId, n);
                highlightStripBtn(n);
            }
        });
    }, { threshold: 0.4 });
    document.querySelectorAll('.ayah-card').forEach(c => obs.observe(c));
}

function checkBookmark() {
    const saved = loadBookmark(currentSurahId);
    if (!saved || saved <= 1) return;

    const banner     = document.getElementById('bookmark-banner');
    const textEl     = document.getElementById('bookmark-text');
    const contBtn    = document.getElementById('bookmark-continue');
    const dismissBtn = document.getElementById('bookmark-dismiss');
    if (!banner) return;

    textEl.textContent = currentLang === 'bn'
        ? `আপনি আয়াত ${toBengaliNumber(saved)} পর্যন্ত পড়েছিলেন`
        : `You read up to ayah ${saved}`;
    banner.classList.remove('hidden');

    contBtn.onclick = () => {
        banner.classList.add('hidden');
        document.getElementById(`ayah-${saved}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    dismissBtn.onclick = () => {
        banner.classList.add('hidden');
        clearBookmark(currentSurahId);
    };
}

// -------------------------------------------------------
// Loading / error states
// -------------------------------------------------------
function showLoadingState() {
    const loading  = document.getElementById('loading-state');
    const ayahList = document.getElementById('ayah-list');
    const errDiv   = document.getElementById('error-state');

    loading.innerHTML = Array.from({ length: 5 }, (_, i) => `
        <div class="skeleton-ayah">
            <div class="ayah-top">
                <div class="skeleton" style="width:31px;height:31px;border-radius:50%;flex-shrink:0"></div>
                <div style="flex:1">
                    <div class="skeleton" style="height:26px;width:${i % 2 === 0 ? '80%' : '65%'};margin-left:auto;border-radius:5px"></div>
                    <div class="skeleton" style="height:22px;width:${i % 2 === 0 ? '55%' : '72%'};margin-left:auto;border-radius:5px;margin-top:7px"></div>
                </div>
            </div>
            <div class="skeleton" style="height:12px;width:100%;border-radius:4px"></div>
            <div class="skeleton" style="height:12px;width:70%;border-radius:4px;margin-top:5px"></div>
        </div>`).join('');

    loading.classList.remove('hidden');
    ayahList.classList.add('hidden');
    errDiv.classList.add('hidden');
}

function showErrorState(message) {
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('ayah-list').classList.add('hidden');
    const errDiv = document.getElementById('error-state');
    const msgEl  = document.getElementById('error-detail-msg');
    if (msgEl) msgEl.textContent = message || 'ইন্টারনেট সংযোগ পরীক্ষা করুন।';
    errDiv.classList.remove('hidden');
    document.getElementById('retry-btn-detail')
        ?.addEventListener('click', () => loadSurah(), { once: true });
}

// -------------------------------------------------------
// Toast
// -------------------------------------------------------
function showToast(msg, ms = 3000) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), ms);
}

// -------------------------------------------------------
// XSS protection
// -------------------------------------------------------
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
