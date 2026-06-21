// ============================================================
// surah-detail.js — v2.0
// Surah detail page (surah.html)
// New in v2: Bengali numerals in badges, bracket ref after
//            each Bengali translation, updated UI strings
// ============================================================

'use strict';

// -------------------------------------------------------
// State
// -------------------------------------------------------
let currentSurahId = 1;
let surahData      = null;
let currentLang    = 'bn';
let showEnglish    = false;
let arabicFontSize = 'md';

let audioElement  = null;
let playingGlobal = null;   // global ayah number currently playing
let playingBtn    = null;

// -------------------------------------------------------
// Init
// -------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    currentSurahId = Math.min(114, Math.max(1, parseInt(params.get('id'), 10) || 1));

    currentLang    = localStorage.getItem('quran_lang')      || 'bn';
    arabicFontSize = localStorage.getItem('quran_font_size') || 'md';
    showEnglish    = localStorage.getItem('quran_show_en')   === 'true';

    audioElement = document.getElementById('quran-audio');
    audioElement.addEventListener('ended', onAudioEnded);
    audioElement.addEventListener('error', onAudioError);

    initTheme();
    applyLanguage();
    applyFontSize();
    syncEnglishBtn();
    updateNavButtons();
    loadSurah();

    // Wire controls
    document.getElementById('lang-toggle').addEventListener('click',       toggleLanguage);
    document.getElementById('theme-toggle').addEventListener('click',      toggleTheme);
    document.getElementById('prev-surah').addEventListener('click',        () => navigate(-1));
    document.getElementById('next-surah').addEventListener('click',        () => navigate(1));
    document.getElementById('font-decrease').addEventListener('click',     () => changeFontSize(-1));
    document.getElementById('font-increase').addEventListener('click',     () => changeFontSize(1));
    document.getElementById('btn-english-toggle').addEventListener('click',toggleEnglish);
});

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
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.querySelector('.theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
}
function toggleTheme() {
    const cur  = document.documentElement.getAttribute('data-theme') || 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('quran_theme', next);
}

// -------------------------------------------------------
// Language
// -------------------------------------------------------
function applyLanguage() {
    const btn = document.getElementById('lang-toggle');
    if (btn) btn.textContent = currentLang === 'bn' ? 'EN' : 'বাং';
    document.querySelectorAll('[data-bn]').forEach(el => {
        el.textContent = currentLang === 'bn'
            ? el.getAttribute('data-bn')
            : el.getAttribute('data-en');
    });
    syncEnglishBtn();
}
function toggleLanguage() {
    currentLang = currentLang === 'bn' ? 'en' : 'bn';
    localStorage.setItem('quran_lang', currentLang);
    applyLanguage();
    if (surahData) updateHeaderInfo();
}

// -------------------------------------------------------
// Arabic font size
// -------------------------------------------------------
const SIZES = ['sm', 'md', 'lg'];

function applyFontSize() {
    const list = document.getElementById('ayah-list');
    if (!list) return;
    list.classList.remove('arabic-font-sm', 'arabic-font-md', 'arabic-font-lg');
    if (arabicFontSize !== 'md') list.classList.add(`arabic-font-${arabicFontSize}`);
    document.getElementById('font-decrease').disabled = arabicFontSize === 'sm';
    document.getElementById('font-increase').disabled = arabicFontSize === 'lg';
}
function changeFontSize(dir) {
    const idx  = SIZES.indexOf(arabicFontSize);
    const next = SIZES[Math.max(0, Math.min(SIZES.length - 1, idx + dir))];
    if (next === arabicFontSize) return;
    arabicFontSize = next;
    localStorage.setItem('quran_font_size', arabicFontSize);
    applyFontSize();
}

// -------------------------------------------------------
// English toggle
// -------------------------------------------------------
function toggleEnglish() {
    showEnglish = !showEnglish;
    localStorage.setItem('quran_show_en', showEnglish);
    syncEnglishBtn();
    document.getElementById('ayah-list')
        ?.classList.toggle('english-hidden', !showEnglish);
}
function syncEnglishBtn() {
    const btn = document.getElementById('btn-english-toggle');
    if (!btn) return;
    btn.classList.toggle('active', showEnglish);
    btn.textContent = showEnglish
        ? (currentLang === 'bn' ? 'EN লুকান' : 'Hide EN')
        : (currentLang === 'bn' ? 'EN দেখুন'  : 'Show EN');
    btn.setAttribute('aria-pressed', showEnglish);
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
// Load surah
// -------------------------------------------------------
async function loadSurah() {
    showLoadingState();
    try {
        surahData = await getSurahAllData(currentSurahId);  // api.js
        updateHeaderInfo();
        renderAyahs();
        checkBookmark();
    } catch (err) {
        showErrorState(err.message);
    }
}

// -------------------------------------------------------
// Header / info card
// -------------------------------------------------------
function updateHeaderInfo() {
    const s           = surahData.arabic;
    const bnName      = getBengaliName(s.number)    || s.englishName;    // api.js
    const bnMeaning   = getBengaliMeaning(s.number) || '';               // api.js
    const displayName = currentLang === 'bn' ? bnName : s.englishName;
    const isMekki     = s.revelationType === 'Meccan';
    const revLabel    = currentLang === 'bn' ? (isMekki ? 'মক্কী' : 'মাদানী') : s.revelationType;
    const ayahLabel   = currentLang === 'bn'
        ? `${toBengaliNumber(s.numberOfAyahs)} আয়াত`   // api.js
        : `${s.numberOfAyahs} ayahs`;

    document.title = `সূরা ${toBengaliNumber(s.number)}: ${displayName} | পবিত্র কুরআন`;

    const nameEl = document.getElementById('page-surah-name');
    const metaEl = document.getElementById('page-surah-meta');
    if (nameEl) nameEl.textContent = `${toBengaliNumber(s.number)}. ${displayName}`;
    if (metaEl) metaEl.textContent = `${ayahLabel} · ${revLabel}`;

    const card = document.getElementById('surah-info-card');
    if (card) {
        card.innerHTML = `
            <div class="surah-info-arabic">${s.name}</div>
            <div class="surah-info-names">${displayName}${bnMeaning ? ' — ' + bnMeaning : ''}</div>
            <div class="surah-info-meta">
                <span>${toBengaliNumber(s.number)} / ${toBengaliNumber(114)}</span>
                <span class="dot">·</span>
                <span>${ayahLabel}</span>
                <span class="dot">·</span>
                <span>${revLabel}</span>
            </div>
        `;
    }
}

// -------------------------------------------------------
// Render ayah cards
// -------------------------------------------------------
function renderAyahs() {
    const list   = document.getElementById('ayah-list');
    const arAyahs = surahData.arabic.ayahs;
    const bnAyahs = surahData.bengali ? surahData.bengali.ayahs : [];
    const enAyahs = surahData.english ? surahData.english.ayahs : [];

    const surahBnName = getBengaliName(currentSurahId); // for bracket ref

    // Bismillah header (shown for all surahs except 1 and 9)
    let html = '';
    const showBism = currentSurahId !== 1 && currentSurahId !== 9;
    if (showBism) {
        html += `
            <div class="bismillah-header">
                <div class="bismillah-text">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
            </div>
        `;
    }

    // Build ayah cards
    arAyahs.forEach((ayah, i) => {
        const bnText = bnAyahs[i] ? bnAyahs[i].text : '';
        const enText = enAyahs[i] ? enAyahs[i].text : '';

        // Bengali number badge
        const bnNum = toBengaliNumber(ayah.numberInSurah);

        // Bracket reference appended after Bengali translation
        // e.g. [আল-ফাতিহা: ১]
        const bracketRef = `[${surahBnName}: ${bnNum}]`;

        const bnBlock = bnText ? `
            <div class="translation-block">
                <div class="translation-label">বাংলা</div>
                <div class="bengali-translation">
                    ${escapeHtml(bnText)}<span class="ayah-ref">${bracketRef}</span>
                </div>
            </div>
        ` : '';

        const enBlock = enText ? `
            <div class="translation-block english-block">
                <div class="translation-label">English</div>
                <div class="english-translation">${escapeHtml(enText)}</div>
            </div>
        ` : '';

        html += `
            <div class="ayah-card" id="ayah-${ayah.numberInSurah}" data-ayah="${ayah.numberInSurah}">
                <div class="ayah-header">
                    <div class="ayah-badge" title="আয়াত ${bnNum}" aria-label="আয়াত ${ayah.numberInSurah}">
                        ${bnNum}
                    </div>
                    <button type="button"
                        class="play-btn"
                        data-global="${ayah.number}"
                        data-local="${ayah.numberInSurah}"
                        aria-label="আয়াত ${ayah.numberInSurah} তিলাওয়াত শুনুন"
                        title="তিলাওয়াত শুনুন"
                    >${playIcon()}</button>
                </div>
                <div class="arabic-text">${ayah.text}</div>
                ${bnBlock}
                ${enBlock}
            </div>
        `;
    });

    list.innerHTML = html;

    applyFontSize();
    list.classList.toggle('english-hidden', !showEnglish);
    list.querySelectorAll('.play-btn').forEach(btn =>
        btn.addEventListener('click', onPlayClick));

    document.getElementById('loading-state').classList.add('hidden');
    list.classList.remove('hidden');

    setupBookmarkObserver();
}

// -------------------------------------------------------
// Audio
// -------------------------------------------------------
function onPlayClick(e) {
    const btn       = e.currentTarget;
    const globalNum = parseInt(btn.dataset.global, 10);
    const localNum  = parseInt(btn.dataset.local,  10);

    // Tap same playing ayah → pause
    if (playingGlobal === globalNum && !audioElement.paused) {
        audioElement.pause();
        resetPlayingState();
        return;
    }

    // Stop whatever is currently playing
    stopCurrent();

    // Play new ayah
    audioElement.src = buildAudioUrl(globalNum);  // api.js
    btn.classList.add('loading');
    btn.innerHTML = '';

    audioElement.play()
        .then(() => {
            btn.classList.remove('loading');
            btn.innerHTML = pauseIcon();
            btn.classList.add('playing');
            playingGlobal = globalNum;
            playingBtn    = btn;
            document.getElementById(`ayah-${localNum}`)?.classList.add('playing');
        })
        .catch(err => {
            btn.classList.remove('loading');
            btn.innerHTML = playIcon();
            showToast(currentLang === 'bn'
                ? 'অডিও চালানো যায়নি। নেটওয়ার্ক পরীক্ষা করুন।'
                : 'Could not play audio. Check your connection.');
            console.error('Audio error:', err);
        });
}

function stopCurrent() {
    if (!audioElement.paused) audioElement.pause();
    if (playingBtn) resetBtn(playingBtn);
    if (playingGlobal !== null) {
        const localNum = getLocalNum(playingGlobal);
        if (localNum) document.getElementById(`ayah-${localNum}`)?.classList.remove('playing');
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

function onAudioEnded() { resetPlayingState(); }
function onAudioError() {
    resetPlayingState();
    showToast(currentLang === 'bn' ? 'অডিও লোড হয়নি।' : 'Audio failed to load.');
}

function resetBtn(btn) {
    btn.classList.remove('playing', 'loading');
    btn.innerHTML = playIcon();
}
function getLocalNum(globalNum) {
    if (!surahData) return null;
    return surahData.arabic.ayahs.find(a => a.number === globalNum)?.numberInSurah ?? null;
}

function playIcon() {
    return `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <polygon points="5,3 19,12 5,21"/>
    </svg>`;
}
function pauseIcon() {
    return `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="6" y="4" width="4" height="16"/>
        <rect x="14" y="4" width="4" height="16"/>
    </svg>`;
}

// -------------------------------------------------------
// Bookmark
// -------------------------------------------------------
function setupBookmarkObserver() {
    if (!('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                saveBookmark(currentSurahId, parseInt(e.target.dataset.ayah, 10));
            }
        });
    }, { threshold: 0.5 });
    document.querySelectorAll('.ayah-card').forEach(c => obs.observe(c));
}

function checkBookmark() {
    const saved = loadBookmark(currentSurahId);   // api.js
    if (!saved || saved <= 1) return;

    const banner  = document.getElementById('bookmark-banner');
    const textEl  = document.getElementById('bookmark-text');
    const contBtn = document.getElementById('bookmark-continue');
    const dismissBtn = document.getElementById('bookmark-dismiss');

    textEl.textContent = currentLang === 'bn'
        ? `আপনি আয়াত ${toBengaliNumber(saved)} পর্যন্ত পড়েছিলেন`
        : `You read up to ayah ${saved}`;
    contBtn.textContent = currentLang === 'bn' ? 'সেখান থেকে যান' : 'Jump there';
    banner.classList.remove('hidden');

    contBtn.onclick = () => {
        banner.classList.add('hidden');
        document.getElementById(`ayah-${saved}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    dismissBtn.onclick = () => {
        banner.classList.add('hidden');
        clearBookmark(currentSurahId);   // api.js
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
            <div class="ayah-header">
                <div class="skeleton" style="width:34px;height:34px;border-radius:50%"></div>
                <div class="skeleton" style="width:34px;height:34px;border-radius:50%"></div>
            </div>
            <div class="skeleton" style="height:32px;width:${i%2===0?'80%':'65%'};margin-left:auto;border-radius:6px"></div>
            <div class="skeleton" style="height:32px;width:${i%2===0?'55%':'72%'};margin-left:auto;border-radius:6px;margin-top:6px"></div>
            <div style="height:8px"></div>
            <div class="skeleton" style="height:13px;width:100%;border-radius:4px"></div>
            <div class="skeleton" style="height:13px;width:70%;border-radius:4px;margin-top:5px"></div>
        </div>
    `).join('');

    loading.classList.remove('hidden');
    ayahList.classList.add('hidden');
    errDiv.classList.add('hidden');
}

function showErrorState(message) {
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('ayah-list').classList.add('hidden');
    const errDiv  = document.getElementById('error-state');
    const msgEl   = document.getElementById('error-detail-msg');
    if (msgEl) msgEl.textContent = message || 'ইন্টারনেট সংযোগ পরীক্ষা করুন।';
    errDiv.classList.remove('hidden');
    document.getElementById('retry-btn-detail')
        ?.addEventListener('click', loadSurah, { once: true });
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
// XSS protection: escape user-facing API text
// -------------------------------------------------------
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
