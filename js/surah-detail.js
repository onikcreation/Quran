// ============================================================
// surah-detail.js — v5.0
// Sidebar dropdowns, audio player bar, tafsir toggle,
// copy button, transliteration fix, Arabic font picker
// ============================================================

'use strict';

// -------------------------------------------------------
// State
// -------------------------------------------------------
let currentSurahId  = 1;
let surahData       = null;
let currentLang     = 'bn';
let arabicFontSize  = 30;
let currentMainTab  = 'translation';

let audioElement    = null;
let playingGlobal   = null;
let playingLocal    = null;
let playingBtn      = null;
let fullSurahMode   = false;
let fullSurahIdx    = 0;

let settings = {
    translationEdition:  'en.sahih',
    showTransliteration: false,
    autoExpandTafsir:    false,
    arabicFont:          'Amiri Quran',
};

let translationLang = 'bn'; // 'bn' | 'en' — controlled by inline toggle per ayah row

// -------------------------------------------------------
// Init
// -------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    const params  = new URLSearchParams(window.location.search);
    currentSurahId = Math.min(114, Math.max(1, parseInt(params.get('id'), 10) || 1));
    const jumpAyah = parseInt(params.get('ayah'), 10) || null;

    currentLang    = localStorage.getItem('quran_lang')      || 'bn';
    arabicFontSize  = parseInt(localStorage.getItem('quran_font_size'), 10)    || 30;
    bengaliFontSize = parseInt(localStorage.getItem('quran_bn_font_size'), 10) || 15;
    loadSettings();

    audioElement = document.getElementById('quran-audio');
    audioElement.addEventListener('ended',         onAudioEnded);
    audioElement.addEventListener('error',         onAudioError);
    audioElement.addEventListener('timeupdate',    updateAudioPlayerProgress);
    audioElement.addEventListener('loadedmetadata', onAudioMetadata);
    audioElement.addEventListener('pause',         updateAudioPlayerUI);
    audioElement.addEventListener('play',          updateAudioPlayerUI);

    initTheme();
    applyLanguage();
    updateNavButtons();
    applySettingsUI();
    applyArabicFont();
    applyBnFontSize();

    // Header controls
    document.getElementById('lang-toggle').addEventListener('click', toggleLanguage);
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('font-decrease').addEventListener('click', () => changeFontSize(-1));
    document.getElementById('font-increase').addEventListener('click', () => changeFontSize(1));
    document.getElementById('bn-font-decrease').addEventListener('click', () => changeBnFontSize(-1));
    document.getElementById('bn-font-increase').addEventListener('click', () => changeBnFontSize(1));

    // Settings panel
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

    // Global inline translation lang toggle (event delegation)
    document.addEventListener('click', e => {
        const btn = e.target.closest('.ltg-btn');
        if (btn) setTranslationLang(btn.dataset.lang);
    });
    setTranslationLang('bn');

    // Settings controls
    document.getElementById('translation-select').addEventListener('change', e => {
        settings.translationEdition = e.target.value;
        saveSettings();
        if (surahData) renderAyahs();
    });
    document.getElementById('arabic-font-select').addEventListener('change', e => {
        settings.arabicFont = e.target.value;
        saveSettings();
        applyArabicFont();
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

    // Nav
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

    // Sidebar dropdowns
    document.getElementById('sd-surah').addEventListener('change', onSurahDropChange);
    document.getElementById('sd-para').addEventListener('change',  onParaDropChange);
    document.getElementById('sd-ayah').addEventListener('change',  onAyahDropChange);

    // Main content tabs
    document.getElementById('mtab-translation').addEventListener('click', () => switchMainTab('translation'));
    document.getElementById('mtab-tilawat').addEventListener('click',     () => switchMainTab('tilawat'));

    // Audio player bar
    initAudioPlayerBar();

    // Load data
    populateParaDropdown();
    loadSurahsForDropdown();
    loadSurah(jumpAyah);
});

// -------------------------------------------------------
// Settings
// -------------------------------------------------------
function loadSettings() {
    try {
        const s = JSON.parse(localStorage.getItem('quran_settings') || '{}');
        Object.assign(settings, s);
    } catch { /* ignore */ }
}
function saveSettings() {
    try { localStorage.setItem('quran_settings', JSON.stringify(settings)); } catch { /* ignore */ }
}
function applySettingsUI() {
    const sel   = document.getElementById('translation-select');
    const fsel  = document.getElementById('arabic-font-select');
    const trEl  = document.getElementById('toggle-transliteration');
    const taEl  = document.getElementById('toggle-tafsir-auto');
    // Normalise: old 'bn' setting → en.sahih (Bengali now via inline toggle)
    if (settings.translationEdition === 'bn') settings.translationEdition = 'en.sahih';
    if (sel)   sel.value    = settings.translationEdition;
    if (fsel)  fsel.value   = settings.arabicFont;
    if (trEl)  trEl.checked = settings.showTransliteration;
    if (taEl)  taEl.checked = settings.autoExpandTafsir;
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
// Translation language (inline per-ayah toggle, global state)
// -------------------------------------------------------
function setTranslationLang(lang) {
    translationLang = lang;
    document.body.classList.toggle('trans-lang-bn', lang === 'bn');
    document.body.classList.toggle('trans-lang-en', lang === 'en');
}

// -------------------------------------------------------
// Bismillah stripping
// AlQuran Cloud prepends "bsm allaah alrhmn alrhym" (4 words) to ayah 1
// of surahs 2-8 and 10-114. Split on whitespace and skip those 4 words.
// -------------------------------------------------------
function stripLeadingBismillah(text) {
    var words = text.trim().split(/\s+/);
    if (words.length <= 4) return text;
    // Remove diacritics from first word and verify it starts with Arabic ba (U+0628)
    var firstBase = words[0].replace(/[ؐ-ؚـً-ٰٟۖ-ۭ]/g, '');
    if (firstBase.charCodeAt(0) !== 0x0628) return text; // U+0628 = ba
    return words.slice(4).join(' ');
}


// -------------------------------------------------------
// Strip Uthmanic-only marks for standard Arabic display
// -------------------------------------------------------
function normalizeArabicDisplay(text) {
    return text
        .replace(/ـٰ/g, '')   // tatweel + dagger alef -> remove
        .replace(/ٰ/g, '')          // standalone dagger alef -> remove
        .replace(/ٱ/g, 'ا');   // alef wasla -> regular alef
}
// -------------------------------------------------------
// Arabic font
// -------------------------------------------------------
function applyArabicFont() {
    const font = settings.arabicFont || 'Amiri';
    document.documentElement.style.setProperty(
        '--arabic-font-family',
        `'${font}', 'Amiri', 'Scheherazade New', serif`
    );
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
const FONT_SIZES = [22, 26, 30, 34, 38, 42, 48];
function applyFontSize() {
    document.documentElement.style.setProperty('--arabic-size', arabicFontSize + 'px');
    const display = document.getElementById('font-size-display');
    if (display) display.textContent = arabicFontSize + 'px';
    const minSize = FONT_SIZES[0];
    const maxSize = FONT_SIZES[FONT_SIZES.length - 1];
    const decBtn = document.getElementById('font-decrease');
    const incBtn = document.getElementById('font-increase');
    if (decBtn) decBtn.disabled = arabicFontSize <= minSize;
    if (incBtn) incBtn.disabled = arabicFontSize >= maxSize;
}
function changeFontSize(dir) {
    const idx  = FONT_SIZES.indexOf(arabicFontSize);
    const cur  = idx === -1 ? 2 : idx;
    const next = FONT_SIZES[Math.max(0, Math.min(FONT_SIZES.length - 1, cur + dir))];
    if (next === arabicFontSize) return;
    arabicFontSize = next;
    localStorage.setItem('quran_font_size', arabicFontSize);
    applyFontSize();
}

const BENGALI_FONT_SIZES = [13, 14, 15, 16, 17, 18, 20];
function applyBnFontSize() {
    document.documentElement.style.setProperty('--trans-size', bengaliFontSize + 'px');
    const display = document.getElementById('bn-font-size-display');
    if (display) display.textContent = bengaliFontSize + 'px';
    const minSize = BENGALI_FONT_SIZES[0];
    const maxSize = BENGALI_FONT_SIZES[BENGALI_FONT_SIZES.length - 1];
    const decBtn = document.getElementById('bn-font-decrease');
    const incBtn = document.getElementById('bn-font-increase');
    if (decBtn) decBtn.disabled = bengaliFontSize <= minSize;
    if (incBtn) incBtn.disabled = bengaliFontSize >= maxSize;
}
function changeBnFontSize(dir) {
    const idx  = BENGALI_FONT_SIZES.indexOf(bengaliFontSize);
    const cur  = idx === -1 ? 2 : idx;
    const next = BENGALI_FONT_SIZES[Math.max(0, Math.min(BENGALI_FONT_SIZES.length - 1, cur + dir))];
    if (next === bengaliFontSize) return;
    bengaliFontSize = next;
    localStorage.setItem('quran_bn_font_size', bengaliFontSize);
    applyBnFontSize();
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
// Sidebar
// -------------------------------------------------------
function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar?.classList.remove('open');
    overlay?.classList.remove('show');
    overlay?.setAttribute('aria-hidden', 'true');
}

async function loadSurahsForDropdown() {
    try {
        const surahs = await getAllSurahs();
        const sel    = document.getElementById('sd-surah');
        if (!sel) return;
        sel.innerHTML = surahs.map(s =>
            `<option value="${s.number}"${s.number === currentSurahId ? ' selected' : ''}>
                ${toBengaliNumber(s.number)}. ${s.bengaliName || s.englishName}
            </option>`
        ).join('');
    } catch { /* non-fatal */ }
}

function populateParaDropdown() {
    const paras = getParaList();
    const sel   = document.getElementById('sd-para');
    if (!sel) return;
    sel.innerHTML = '<option value="">— পারা নির্বাচন করুন —</option>' +
        paras.map(p =>
            `<option value="${p.surah}:${p.ayah}">${toBengaliNumber(p.num)}. ${p.name}</option>`
        ).join('');
}

function populateAyahDropdown(count) {
    const sel = document.getElementById('sd-ayah');
    if (!sel) return;
    let html = '';
    for (let i = 1; i <= count; i++) {
        html += `<option value="${i}">আয়াত ${toBengaliNumber(i)}</option>`;
    }
    sel.innerHTML = html;
}

function onSurahDropChange(e) {
    const id = parseInt(e.target.value, 10);
    if (id && id !== currentSurahId) window.location.href = `surah.html?id=${id}`;
}

function onParaDropChange(e) {
    const val = e.target.value;
    e.target.value = ''; // Reset to placeholder after selection
    if (!val) return;
    const [surahNum, ayahNum] = val.split(':').map(Number);
    if (surahNum === currentSurahId) {
        jumpToAyah(ayahNum);
    } else {
        window.location.href = `surah.html?id=${surahNum}&ayah=${ayahNum}`;
    }
}

function onAyahDropChange(e) {
    const n = parseInt(e.target.value, 10);
    if (n >= 1) jumpToAyah(n);
}

function jumpToAyah(n) {
    document.getElementById(`ayah-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const sel = document.getElementById('sd-ayah');
    if (sel) sel.value = String(n);
    closeSidebar();
}

// -------------------------------------------------------
// Main content tab switcher
// -------------------------------------------------------
function switchMainTab(tab) {
    currentMainTab = tab;
    const isTrans  = tab === 'translation';
    document.getElementById('mtab-translation').classList.toggle('active',  isTrans);
    document.getElementById('mtab-tilawat').classList.toggle('active',     !isTrans);
    document.getElementById('mtab-translation').setAttribute('aria-selected',  isTrans);
    document.getElementById('mtab-tilawat').setAttribute('aria-selected',     !isTrans);
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
// Surah info header (with full-surah audio button)
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
// Render ayah cards
// -------------------------------------------------------
function getEnglishTransText(i) {
    if (settings.translationEdition === 'en.pickthall')
        return surahData.englishPickthall?.ayahs[i]?.text || surahData.englishSahih?.ayahs[i]?.text || '';
    return surahData.englishSahih?.ayahs[i]?.text || '';
}

function renderAyahs() {
    const list        = document.getElementById('ayah-list');
    const arAyahs     = surahData.arabic.ayahs;
    const surahBnName = getBengaliName(currentSurahId);
    const enName      = surahData.arabic.englishName;

    if (currentSurahId !== 1 && currentSurahId !== 9) {
        document.getElementById('bismillah-block')?.classList.remove('hidden');
    }

    list.innerHTML = arAyahs.map((ayah, i) => {
        const bnText    = surahData.bengali?.ayahs[i]?.text || '';
        const enText    = getEnglishTransText(i);
        const trText    = surahData.transliteration?.ayahs[i]?.text || '';
        // Tafsir: Johrul Hoque Bengali translation shown in tafsir panel
        const tafsirTxt = surahData.tafsirHoque?.ayahs[i]?.text || '';
        const bnNum    = toBengaliNumber(ayah.numberInSurah);
        const tafsirOpen = settings.autoExpandTafsir;

        // Strip Bismillah prepended by API to first ayah (all surahs except 1 and 9)
        const arabicText = (ayah.numberInSurah === 1 && currentSurahId !== 1 && currentSurahId !== 9)
            ? normalizeArabicDisplay(stripLeadingBismillah(ayah.text)) : normalizeArabicDisplay(ayah.text);

        const hasTafsir = Boolean(tafsirTxt);

        return `
        <div class="ayah-card" id="ayah-${ayah.numberInSurah}"
             data-ayah="${ayah.numberInSurah}" data-global="${ayah.number}">

            <div class="ayah-top">
                <div class="ayah-num-circle" aria-label="আয়াত ${ayah.numberInSurah}">${bnNum}</div>
                <div class="ayah-arabic" lang="ar">${arabicText}</div>
            </div>

            ${trText ? `<div class="ayah-transliteration">${escapeHtml(trText)}</div>` : ''}

            ${(bnText || enText) ? `
            <div class="ayah-trans-row">
                <div class="ayah-trans-texts">
                    ${bnText ? `<p class="ayah-trans-text trans-lang-bn-text">${escapeHtml(bnText)}<span class="ayah-ref"> [${escapeHtml(surahBnName)}: ${bnNum}]</span></p>` : ''}
                    ${enText ? `<p class="ayah-trans-text trans-lang-en-text">${escapeHtml(enText)}<span class="ayah-ref"> [${enName}: ${ayah.numberInSurah}]</span></p>` : ''}
                </div>
                <div class="ayah-lang-toggle" role="group" aria-label="অনুবাদের ভাষা">
                    <button type="button" class="ltg-btn" data-lang="bn">বাং</button>
                    <button type="button" class="ltg-btn" data-lang="en">EN</button>
                </div>
            </div>` : ''}

            <div class="ayah-action-bar" role="toolbar" aria-label="আয়াত ${ayah.numberInSurah} অ্যাকশন">

                ${hasTafsir ? `
                <button type="button" class="ayah-action-btn tafsir-toggle-btn${tafsirOpen ? ' active' : ''}"
                        data-ayah="${ayah.numberInSurah}" title="তাফসীর দেখুন">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                    </svg>
                    তাফসীর
                </button>` : ''}

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

                <button type="button" class="ayah-action-btn copy-ayah-btn"
                        data-ayah="${ayah.numberInSurah}" title="কপি করুন">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
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

            ${hasTafsir ? `
            <div class="tafsir-panel${tafsirOpen ? '' : ' hidden'}" id="tafsir-${ayah.numberInSurah}">
                <div class="tafsir-source-label">তাফসীর — জহুরুল হক</div>
                <p class="tafsir-text">${escapeHtml(tafsirTxt)}</p>
            </div>` : ''}

        </div>`;
    }).join('');

    list.classList.toggle('show-transliteration', settings.showTransliteration);
    applyFontSize();
    applyBnFontSize();

    // Wire events (no .tlt-btn here — ltg-btn is handled globally via delegation)
    list.querySelectorAll('.tafsir-toggle-btn').forEach(btn =>
        btn.addEventListener('click', onTafsirClick));
    list.querySelectorAll('.share-ayah-btn').forEach(btn =>
        btn.addEventListener('click', onShareClick));
    list.querySelectorAll('.copy-ayah-btn').forEach(btn =>
        btn.addEventListener('click', onCopyClick));
    list.querySelectorAll('.bookmark-ayah-btn').forEach(btn =>
        btn.addEventListener('click', onBookmarkClick));
    list.querySelectorAll('.play-btn').forEach(btn =>
        btn.addEventListener('click', onPlayClick));

    document.getElementById('loading-state').classList.add('hidden');
    list.classList.remove('hidden');

    populateAyahDropdown(arAyahs.length);
    setupBookmarkObserver();
}

// -------------------------------------------------------
// তিলাওয়াত panel
// -------------------------------------------------------
function toArabicNumeral(n) {
    const m = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    return String(n).replace(/[0-9]/g, d => m[parseInt(d)]);
}

function renderTilawatPanel() {
    const panel = document.getElementById('tilawat-content');
    if (!panel || !surahData) return;
    const arAyahs   = surahData.arabic.ayahs;
    const surahName = getBengaliName(currentSurahId) || surahData.arabic.englishName;
    const bismillah = (currentSurahId !== 1 && currentSurahId !== 9)
        ? `<div class="bismillah-arabic" style="text-align:center;margin-bottom:1.1rem">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>`
        : '';
    const stripBis = currentSurahId !== 1 && currentSurahId !== 9;
    const ayahsHtml = arAyahs.map(ayah => {
        const txt = normalizeArabicDisplay((ayah.numberInSurah === 1 && stripBis) ? stripLeadingBismillah(ayah.text) : ayah.text);
        return `${txt}<span class="ayah-end-mark" title="আয়াত ${ayah.numberInSurah}"> ۝${toArabicNumeral(ayah.numberInSurah)} </span>`;
    }).join(' ');
    panel.innerHTML = `
        <div class="tilawat-container">
            <div class="tilawat-heading">সূরা ${escapeHtml(surahName)} — সম্পূর্ণ তিলাওয়াত</div>
            ${bismillah}
            <div class="tilawat-arabic" dir="rtl" lang="ar">${ayahsHtml}</div>
        </div>`;
}

// -------------------------------------------------------
// Tafsir open/close
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
function buildAyahText(ayahNum) {
    const card      = document.getElementById(`ayah-${ayahNum}`);
    const arabicTxt = card?.querySelector('.ayah-arabic')?.textContent?.trim() || '';
    // Pick visible translation based on current translationLang
    const transEl  = translationLang === 'bn'
        ? card?.querySelector('.trans-lang-bn-text')
        : card?.querySelector('.trans-lang-en-text');
    const transTxt  = transEl?.textContent?.trim() || '';
    const surahName = getBengaliName(currentSurahId);
    const bnNum     = toBengaliNumber(ayahNum);
    const body      = [arabicTxt, transTxt].filter(Boolean).join('\n\n');
    return `${body}\n\n[${surahName}: ${bnNum}]`;
}

function onShareClick(e) {
    const ayahNum = parseInt(e.currentTarget.dataset.ayah, 10);
    const full    = buildAyahText(ayahNum);
    const surahName = getBengaliName(currentSurahId);
    if (navigator.share) {
        navigator.share({
            title: `কুরআন — ${surahName} আয়াত ${toBengaliNumber(ayahNum)}`,
            text: full
        }).catch(() => {});
    } else {
        navigator.clipboard?.writeText(full)
            .then(() => showToast('আয়াত কপি হয়েছে! ✓'))
            .catch(() => showToast('কপি করা যায়নি।'));
    }
}

function onCopyClick(e) {
    const btn     = e.currentTarget;
    const ayahNum = parseInt(btn.dataset.ayah, 10);
    const full    = buildAyahText(ayahNum);
    navigator.clipboard?.writeText(full)
        .then(() => {
            btn.classList.add('copied');
            showToast('আয়াত কপি হয়েছে! ✓');
            setTimeout(() => btn.classList.remove('copied'), 2000);
        })
        .catch(() => showToast('কপি করা যায়নি।'));
}

// -------------------------------------------------------
// Bookmark
// -------------------------------------------------------
function onBookmarkClick(e) {
    const ayahNum = parseInt(e.currentTarget.dataset.ayah, 10);
    saveBookmark(currentSurahId, ayahNum);
    showToast(currentLang === 'bn'
        ? `আয়াত ${toBengaliNumber(ayahNum)} বুকমার্ক করা হয়েছে।`
        : `Ayah ${ayahNum} bookmarked.`);
}

function formatBookmarkAge(ts) {
    if (!ts) return '';
    const diff  = Date.now() - ts;
    const days  = Math.floor(diff / 86400000);
    const hours = Math.floor(diff / 3600000);
    const mins  = Math.floor(diff / 60000);
    if (days  > 0) return ` (${toBengaliNumber(days)} দিন আগে)`;
    if (hours > 0) return ` (${toBengaliNumber(hours)} ঘন্টা আগে)`;
    if (mins  > 0) return ` (${toBengaliNumber(mins)} মিনিট আগে)`;
    return ' (এইমাত্র)';
}

function setupBookmarkObserver() {
    if (!('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                const n = parseInt(e.target.dataset.ayah, 10);
                saveBookmark(currentSurahId, n);
                const sel = document.getElementById('sd-ayah');
                if (sel) sel.value = String(n);
            }
        });
    }, { threshold: 0.4 });
    document.querySelectorAll('.ayah-card').forEach(c => obs.observe(c));
}

function checkBookmark() {
    const bm = loadBookmark(currentSurahId);
    if (!bm || bm.ayah <= 1) return;

    const banner     = document.getElementById('bookmark-banner');
    const textEl     = document.getElementById('bookmark-text');
    const contBtn    = document.getElementById('bookmark-continue');
    const dismissBtn = document.getElementById('bookmark-dismiss');
    if (!banner) return;

    const age    = formatBookmarkAge(bm.ts);
    textEl.textContent = currentLang === 'bn'
        ? `আপনি আয়াত ${toBengaliNumber(bm.ayah)} পর্যন্ত পড়েছিলেন${age}`
        : `You read up to ayah ${bm.ayah}${age}`;
    banner.classList.remove('hidden');

    contBtn.onclick = () => {
        banner.classList.add('hidden');
        document.getElementById(`ayah-${bm.ayah}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    dismissBtn.onclick = () => {
        banner.classList.add('hidden');
        clearBookmark(currentSurahId);
    };
}

// -------------------------------------------------------
// Per-ayah audio
// -------------------------------------------------------
function onPlayClick(e) {
    const btn       = e.currentTarget;
    const globalNum = parseInt(btn.dataset.global, 10);
    const localNum  = parseInt(btn.dataset.local,  10);

    if (fullSurahMode) stopFullSurahAudio();

    if (playingGlobal === globalNum && !audioElement.paused) {
        audioElement.pause();
        resetPlayingState();
        hideAudioPlayerBar();
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
            playingLocal  = localNum;
            playingBtn    = btn;
            document.getElementById(`ayah-${localNum}`)?.classList.add('playing');
            const sel = document.getElementById('sd-ayah');
            if (sel) sel.value = String(localNum);
            showAudioPlayerBar();
            updateAudioPlayerInfo(surahData.arabic.ayahs.find(a => a.numberInSurah === localNum));
        })
        .catch(() => {
            btn.classList.remove('loading');
            btn.insertAdjacentHTML('afterbegin', playIcon());
            showToast(currentLang === 'bn' ? 'অডিও চালানো যায়নি।' : 'Could not play audio.');
        });
}

// Navigate to a specific ayah index (for player bar prev/next)
function playAyahAtIdx(idx) {
    if (!surahData) return;
    const ayah = surahData.arabic.ayahs[idx];
    if (!ayah) return;

    if (fullSurahMode) {
        fullSurahIdx = idx;
        advanceFullSurah();
        return;
    }

    stopCurrent();
    audioElement.src = buildAudioUrl(ayah.number);
    audioElement.play()
        .then(() => {
            playingGlobal = ayah.number;
            playingLocal  = ayah.numberInSurah;
            document.getElementById(`ayah-${ayah.numberInSurah}`)?.classList.add('playing');
            document.getElementById(`ayah-${ayah.numberInSurah}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            const btn = document.querySelector(`.play-btn[data-local="${ayah.numberInSurah}"]`);
            if (btn) {
                btn.querySelector('svg')?.remove();
                btn.insertAdjacentHTML('afterbegin', pauseIcon());
                btn.classList.add('playing');
                playingBtn = btn;
            }
            const sel = document.getElementById('sd-ayah');
            if (sel) sel.value = String(ayah.numberInSurah);
            showAudioPlayerBar();
            updateAudioPlayerInfo(ayah);
        })
        .catch(() => showToast('অডিও চালানো যায়নি।'));
}

function stopCurrent() {
    if (!audioElement.paused) audioElement.pause();
    if (playingBtn) resetBtn(playingBtn);
    if (playingGlobal !== null) {
        const local = getLocalNum(playingGlobal);
        if (local) document.getElementById(`ayah-${local}`)?.classList.remove('playing');
    }
    playingGlobal = null;
    playingLocal  = null;
    playingBtn    = null;
}

function resetPlayingState() {
    if (playingBtn) resetBtn(playingBtn);
    if (playingGlobal !== null) {
        const local = getLocalNum(playingGlobal);
        if (local) document.getElementById(`ayah-${local}`)?.classList.remove('playing');
    }
    playingGlobal = null;
    playingLocal  = null;
    playingBtn    = null;
}

function onAudioEnded() {
    if (fullSurahMode) {
        fullSurahIdx++;
        advanceFullSurah();
    } else {
        resetPlayingState();
        // Keep player bar visible but show paused state
        updateAudioPlayerUI();
    }
}
function onAudioError() {
    if (fullSurahMode) {
        stopFullSurahAudio();
    } else {
        resetPlayingState();
        hideAudioPlayerBar();
        showToast(currentLang === 'bn' ? 'অডিও লোড হয়নি।' : 'Audio failed.');
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
    return `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5,3 19,12 5,21"/></svg>`;
}
function pauseIcon() {
    return `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
}
function stopIcon() {
    return `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
}

// -------------------------------------------------------
// Full-surah sequential audio
// -------------------------------------------------------
function toggleFullSurahAudio() {
    if (fullSurahMode) stopFullSurahAudio();
    else startFullSurahAudio();
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
    document.querySelectorAll('.ayah-card.playing').forEach(c => c.classList.remove('playing'));
    updateFullAudioBtn();
    hideAudioPlayerBar();
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

    document.querySelectorAll('.ayah-card.playing').forEach(c => c.classList.remove('playing'));
    document.getElementById(`ayah-${ayah.numberInSurah}`)?.classList.add('playing');
    document.getElementById(`ayah-${ayah.numberInSurah}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const sel = document.getElementById('sd-ayah');
    if (sel) sel.value = String(ayah.numberInSurah);

    playingGlobal = ayah.number;
    playingLocal  = ayah.numberInSurah;
    showAudioPlayerBar();
    updateAudioPlayerInfo(ayah);
    updateFullAudioBtn();
}
function updateFullAudioBtn() {
    const btn  = document.getElementById('full-audio-btn');
    const prog = document.getElementById('full-audio-progress');
    if (!btn) return;
    if (fullSurahMode) {
        const total = surahData?.arabic.ayahs.length || 0;
        btn.innerHTML = `${stopIcon()} থামাও`;
        btn.classList.add('playing');
        if (prog) prog.textContent =
            `${toBengaliNumber(fullSurahIdx + 1)} / ${toBengaliNumber(total)} আয়াত`;
    } else {
        btn.innerHTML = '▶ পুরো সূরা';
        btn.classList.remove('playing');
        if (prog) prog.textContent = '';
    }
}

// -------------------------------------------------------
// Audio player bar
// -------------------------------------------------------
function initAudioPlayerBar() {
    document.getElementById('apb-play-pause').addEventListener('click', () => {
        if (audioElement.paused) {
            audioElement.play().catch(() => {});
        } else {
            audioElement.pause();
        }
    });

    document.getElementById('apb-prev').addEventListener('click', () => {
        if (!surahData) return;
        const ayahs = surahData.arabic.ayahs;
        const idx   = ayahs.findIndex(a => a.number === playingGlobal);
        if (idx > 0) playAyahAtIdx(idx - 1);
    });

    document.getElementById('apb-next').addEventListener('click', () => {
        if (!surahData) return;
        const ayahs = surahData.arabic.ayahs;
        const idx   = ayahs.findIndex(a => a.number === playingGlobal);
        if (idx >= 0 && idx < ayahs.length - 1) playAyahAtIdx(idx + 1);
    });

    document.getElementById('apb-close').addEventListener('click', () => {
        stopCurrent();
        if (fullSurahMode) stopFullSurahAudio();
        hideAudioPlayerBar();
    });

    document.getElementById('apb-seek').addEventListener('input', e => {
        const dur = audioElement.duration;
        if (dur && !isNaN(dur)) {
            audioElement.currentTime = (e.target.value / 100) * dur;
        }
    });
}

function showAudioPlayerBar() {
    const bar = document.getElementById('audio-player-bar');
    if (!bar) return;
    bar.classList.remove('hidden');
    document.body.classList.add('audio-playing');
}
function hideAudioPlayerBar() {
    const bar = document.getElementById('audio-player-bar');
    if (!bar) return;
    bar.classList.add('hidden');
    document.body.classList.remove('audio-playing');
    // Reset progress
    document.getElementById('apb-fill').style.width  = '0%';
    document.getElementById('apb-seek').value        = 0;
    document.getElementById('apb-time-curr').textContent = '0:00';
    document.getElementById('apb-time-dur').textContent  = '0:00';
}

function updateAudioPlayerInfo(ayah) {
    if (!ayah) return;
    const surahName = getBengaliName(currentSurahId);
    const titleEl   = document.getElementById('apb-title');
    if (titleEl) titleEl.textContent =
        `সূরা ${surahName} — আয়াত ${toBengaliNumber(ayah.numberInSurah)}`;
}

function updateAudioPlayerProgress() {
    const curr = audioElement.currentTime;
    const dur  = audioElement.duration;
    const currEl = document.getElementById('apb-time-curr');
    const fillEl = document.getElementById('apb-fill');
    const seekEl = document.getElementById('apb-seek');
    if (currEl) currEl.textContent = formatTime(curr);
    if (dur && !isNaN(dur)) {
        const pct = (curr / dur) * 100;
        if (fillEl) fillEl.style.width  = pct + '%';
        if (seekEl) seekEl.value        = pct;
    }
}

function onAudioMetadata() {
    const dur    = audioElement.duration;
    const durEl  = document.getElementById('apb-time-dur');
    const fillEl = document.getElementById('apb-fill');
    const seekEl = document.getElementById('apb-seek');
    if (durEl)  durEl.textContent  = formatTime(dur);
    if (fillEl) fillEl.style.width = '0%';
    if (seekEl) seekEl.value       = 0;
}

function updateAudioPlayerUI() {
    const iconEl = document.getElementById('apb-play-icon');
    if (!iconEl) return;
    if (audioElement.paused) {
        iconEl.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
    } else {
        iconEl.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    }
}

function formatTime(secs) {
    if (!isFinite(secs) || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
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
                    <div class="skeleton" style="height:26px;width:${i%2===0?'80%':'65%'};margin-left:auto;border-radius:5px"></div>
                    <div class="skeleton" style="height:22px;width:${i%2===0?'55%':'72%'};margin-left:auto;border-radius:5px;margin-top:7px"></div>
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
