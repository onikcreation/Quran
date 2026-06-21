// ============================================================
// surah-list.js — v2.0
// Surah list page (index.html) — redesigned Islamic green UI
// ============================================================

'use strict';

// -------------------------------------------------------
// State
// -------------------------------------------------------
let allSurahs     = [];
let filteredSurahs= [];
let currentLang   = 'bn';
let searchTimer   = null;

// -------------------------------------------------------
// DOM refs
// -------------------------------------------------------
let surahGrid, loadingState, errorState, noResults;
let searchInput, searchClear, searchCount;
let langToggle, themeToggle, retryBtn, errorMsg;

// -------------------------------------------------------
// Boot
// -------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    surahGrid    = document.getElementById('surah-grid');
    loadingState = document.getElementById('loading-state');
    errorState   = document.getElementById('error-state');
    noResults    = document.getElementById('no-results');
    searchInput  = document.getElementById('search-input');
    searchClear  = document.getElementById('search-clear');
    searchCount  = document.getElementById('search-count');
    langToggle   = document.getElementById('lang-toggle');
    themeToggle  = document.getElementById('theme-toggle');
    retryBtn     = document.getElementById('retry-btn');
    errorMsg     = document.getElementById('error-msg');
    initTheme();
    currentLang = localStorage.getItem('quran_lang') || 'bn';
    applyLanguage();
    renderSkeletons(12);
    loadSurahs();

    // Events
    searchInput.addEventListener('input',  onSearchInput);
    searchClear.addEventListener('click',  clearSearch);
    langToggle.addEventListener('click',   toggleLanguage);
    themeToggle.addEventListener('click',  toggleTheme);
    retryBtn.addEventListener('click',     loadSurahs);
});

// -------------------------------------------------------
// Theme
// -------------------------------------------------------
function initTheme() {
    const saved = localStorage.getItem('quran_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(saved || (prefersDark ? 'dark' : 'light'));
}
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeToggle) {
        themeToggle.querySelector('.theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
    }
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
    langToggle.textContent = currentLang === 'bn' ? 'EN' : 'বাং';
    langToggle.title       = currentLang === 'bn' ? 'Switch to English' : 'বাংলায় পরিবর্তন';

    // Swap all [data-bn] / [data-en] elements
    document.querySelectorAll('[data-bn]').forEach(el => {
        el.textContent = currentLang === 'bn'
            ? el.getAttribute('data-bn')
            : el.getAttribute('data-en');
    });

    // Update search placeholder
    searchInput.placeholder = currentLang === 'bn'
        ? 'সূরার নাম বা নম্বর লিখুন...'
        : 'Search by name or number...';

    if (filteredSurahs.length > 0) renderCards(filteredSurahs);
}
function toggleLanguage() {
    currentLang = currentLang === 'bn' ? 'en' : 'bn';
    localStorage.setItem('quran_lang', currentLang);
    applyLanguage();
}

// -------------------------------------------------------
// Skeleton (shown while API loads)
// -------------------------------------------------------
function renderSkeletons(n) {
    loadingState.innerHTML = Array.from({ length: n }, () => `
        <div class="skeleton-card">
            <div class="surah-num-wrap">
                <div class="skeleton sk-diamond"></div>
            </div>
            <div class="surah-card-body">
                <div class="sk-body">
                    <div class="skeleton sk-line" style="width:70%;height:14px"></div>
                    <div class="skeleton sk-line" style="width:50%;height:11px;margin-top:4px"></div>
                    <div class="skeleton sk-line" style="width:38%;height:10px;margin-top:6px;border-radius:999px"></div>
                </div>
                <div class="sk-body" style="align-items:flex-end">
                    <div class="skeleton sk-line" style="width:80px;height:22px"></div>
                    <div class="skeleton sk-line" style="width:50px;height:10px;margin-top:4px"></div>
                </div>
            </div>
        </div>
    `).join('');

    loadingState.classList.remove('hidden');
    surahGrid.classList.add('hidden');
    errorState.classList.add('hidden');
    noResults.classList.add('hidden');
}

// -------------------------------------------------------
// Fetch surahs
// -------------------------------------------------------
async function loadSurahs() {
    renderSkeletons(12);
    try {
        allSurahs      = await getAllSurahs();   // api.js
        filteredSurahs = allSurahs;
        loadingState.classList.add('hidden');
        renderCards(allSurahs);
    } catch (err) {
        loadingState.classList.add('hidden');
        showError(err.message);
    }
}

// -------------------------------------------------------
// Render cards with new layout
// -------------------------------------------------------
function renderCards(surahs) {
    if (surahs.length === 0) {
        surahGrid.classList.add('hidden');
        noResults.classList.remove('hidden');
        return;
    }
    noResults.classList.add('hidden');

    surahGrid.innerHTML = surahs.map(s => {
        const isMekki   = s.revelationType === 'Meccan';
        const tagClass  = isMekki ? 'tag-mekki' : 'tag-madani';
        const tagLabel  = currentLang === 'bn'
            ? (isMekki ? '🕌 মক্কী' : '🕌 মাদানী')
            : (isMekki ? '🕌 Meccan' : '🕌 Medinan');

        // getBengaliMeaning & toBengaliNumber come from api.js
        const meaning   = getBengaliMeaning(s.number);
        const bnNum     = toBengaliNumber(s.number);
        const bnAyahs   = currentLang === 'bn'
            ? `${toBengaliNumber(s.numberOfAyahs)} আয়াত`
            : `${s.numberOfAyahs} ayahs`;

        const primaryName   = currentLang === 'bn' ? s.bengaliName : s.englishName;
        const secondaryName = currentLang === 'bn' ? meaning       : s.englishNameTranslation;

        return `
            <a class="surah-card"
               href="surah.html?id=${s.number}"
               aria-label="সূরা ${s.number}: ${s.englishName}">

                <!-- Diamond number badge -->
                <div class="surah-num-wrap" aria-hidden="true">
                    <div class="surah-num-diamond">
                        <span>${bnNum}</span>
                    </div>
                </div>

                <!-- Card body -->
                <div class="surah-card-body">
                    <!-- Left: Bengali name + meaning + tag -->
                    <div class="surah-card-left">
                        <div class="surah-bn-name">${primaryName}</div>
                        <div class="surah-meaning">${secondaryName}</div>
                        <div class="surah-meta-row">
                            <span class="tag ${tagClass}">${tagLabel}</span>
                        </div>
                    </div>

                    <!-- Right: Arabic + ayah count -->
                    <div class="surah-card-right">
                        <div class="surah-arabic-name">${s.name}</div>
                        <div class="surah-ayah-count">${bnAyahs}</div>
                    </div>
                </div>
            </a>
        `;
    }).join('');

    surahGrid.classList.remove('hidden');
}

// -------------------------------------------------------
// Search
// -------------------------------------------------------
function onSearchInput() {
    const q = searchInput.value.trim();
    searchClear.classList.toggle('hidden', q === '');
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => filterSurahs(q), 220);
}

function filterSurahs(query) {
    if (!query) {
        filteredSurahs = allSurahs;
        searchCount.classList.add('hidden');
        renderCards(allSurahs);
        return;
    }
    const q = query.toLowerCase();
    filteredSurahs = allSurahs.filter(s =>
        String(s.number).includes(q)                          ||
        s.englishName.toLowerCase().includes(q)               ||
        s.englishNameTranslation.toLowerCase().includes(q)    ||
        s.bengaliName.includes(query)                         ||
        getBengaliMeaning(s.number).includes(query)           ||
        s.name.includes(query)
    );

    const label = currentLang === 'bn'
        ? `${toBengaliNumber(filteredSurahs.length)}টি সূরা পাওয়া গেছে`
        : `${filteredSurahs.length} surah(s) found`;
    searchCount.textContent = label;
    searchCount.classList.remove('hidden');

    renderCards(filteredSurahs);
}

function clearSearch() {
    searchInput.value = '';
    searchClear.classList.add('hidden');
    searchCount.classList.add('hidden');
    filteredSurahs = allSurahs;
    renderCards(allSurahs);
    searchInput.focus();
}

// -------------------------------------------------------
// Error
// -------------------------------------------------------
function showError(message) {
    errorMsg.textContent = message || 'ইন্টারনেট সংযোগ পরীক্ষা করুন।';
    errorState.classList.remove('hidden');
    surahGrid.classList.add('hidden');
}
