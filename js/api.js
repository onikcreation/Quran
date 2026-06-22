// ============================================================
// api.js — v1.0
// AlQuran Cloud API wrapper with localStorage caching
// API: https://alquran.cloud/api  (free, no key needed)
// ============================================================

'use strict';

const API_BASE = 'https://api.alquran.cloud/v1';

// Cache prefix & TTL (7 days) — avoids hammering the API on every visit
const CACHE_PREFIX = 'quran_v1_';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// -------------------------------------------------------
// Bengali surah names (static — not returned by the API)
// Index 0 = Surah 1 (Al-Fatiha), Index 113 = Surah 114 (An-Nas)
// -------------------------------------------------------
const BENGALI_SURAH_NAMES = [
    'আল-ফাতিহা', 'আল-বাকারা', 'আলি ইমরান', 'আন-নিসা', 'আল-মায়িদা',
    'আল-আনআম', 'আল-আরাফ', 'আল-আনফাল', 'আত-তাওবা', 'ইউনুস',
    'হুদ', 'ইউসুফ', 'আর-রাদ', 'ইবরাহীম', 'আল-হিজর',
    'আন-নাহল', 'আল-ইসরা', 'আল-কাহফ', 'মারইয়াম', 'ত্বহা',
    'আল-আম্বিয়া', 'আল-হাজ্জ', 'আল-মুমিনুন', 'আন-নূর', 'আল-ফুরকান',
    'আশ-শুআরা', 'আন-নামল', 'আল-কাসাস', 'আল-আনকাবুত', 'আর-রুম',
    'লুকমান', 'আস-সাজদা', 'আল-আহযাব', 'সাবা', 'ফাতির',
    'ইয়াসীন', 'আস-সাফফাত', 'সাদ', 'আয-যুমার', 'গাফির',
    'ফুসসিলাত', 'আশ-শুরা', 'আয-যুখরুফ', 'আদ-দুখান', 'আল-জাসিয়া',
    'আল-আহকাফ', 'মুহাম্মাদ', 'আল-ফাতহ', 'আল-হুজুরাত', 'ক্বাফ',
    'আয-যারিয়াত', 'আত-তূর', 'আন-নাজম', 'আল-কামার', 'আর-রাহমান',
    'আল-ওয়াকিআ', 'আল-হাদীদ', 'আল-মুজাদালা', 'আল-হাশর', 'আল-মুমতাহিনা',
    'আস-সাফ', 'আল-জুমুআ', 'আল-মুনাফিকুন', 'আত-তাগাবুন', 'আত-তালাক',
    'আত-তাহরীম', 'আল-মুলক', 'আল-কালাম', 'আল-হাক্কা', 'আল-মাআরিজ',
    'নূহ', 'আল-জিন্ন', 'আল-মুযযাম্মিল', 'আল-মুদ্দাস্সির', 'আল-কিয়ামা',
    'আল-ইনসান', 'আল-মুরসালাত', 'আন-নাবা', 'আন-নাযিআত', 'আবাসা',
    'আত-তাকবীর', 'আল-ইনফিতার', 'আল-মুতাফফিফীন', 'আল-ইনশিকাক', 'আল-বুরুজ',
    'আত-তারিক', 'আল-আলা', 'আল-গাশিয়া', 'আল-ফাজর', 'আল-বালাদ',
    'আশ-শামস', 'আল-লাইল', 'আদ-দুহা', 'আশ-শারহ', 'আত-তীন',
    'আল-আলাক', 'আল-কদর', 'আল-বাইয়িনা', 'আয-যালযালা', 'আল-আদিয়াত',
    'আল-কারিআ', 'আত-তাকাসুর', 'আল-আসর', 'আল-হুমাযা', 'আল-ফীল',
    'কুরাইশ', 'আল-মাউন', 'আল-কাওসার', 'আল-কাফিরুন', 'আন-নাসর',
    'আল-মাসাদ', 'আল-ইখলাস', 'আল-ফালাক', 'আন-নাস'
];

// -------------------------------------------------------
// localStorage helpers
// -------------------------------------------------------

function cacheSet(key, data) {
    try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
            data,
            ts: Date.now()
        }));
    } catch {
        // Storage full — skip caching, app still works
    }
}

function cacheGet(key) {
    try {
        const raw = localStorage.getItem(CACHE_PREFIX + key);
        if (!raw) return null;
        const { data, ts } = JSON.parse(raw);
        // Return null if cache has expired
        return (Date.now() - ts < CACHE_TTL_MS) ? data : null;
    } catch {
        return null;
    }
}

// -------------------------------------------------------
// Core fetch: checks cache first, then calls the API
// -------------------------------------------------------

async function apiFetch(cacheKey, url) {
    // Return cached data if still fresh
    const hit = cacheGet(cacheKey);
    if (hit !== null) return hit;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`নেটওয়ার্ক এরর (HTTP ${res.status})`);

    const json = await res.json();
    if (json.code !== 200) throw new Error(json.status || 'API থেকে ডেটা পাওয়া যায়নি');

    cacheSet(cacheKey, json.data);
    return json.data;
}

// -------------------------------------------------------
// Bengali meanings for all 114 surahs (static)
// -------------------------------------------------------
const BENGALI_SURAH_MEANINGS = [
    'সূচনা', 'গাভী', 'ইমরান পরিবার', 'নারীগণ', 'খাদ্য পরিবেশিত দস্তরখান',
    'গবাদিপশু', 'উচ্চস্থানসমূহ', 'যুদ্ধলব্ধ সম্পদ', 'অনুতাপ', 'নবী ইউনুস (আঃ)',
    'নবী হুদ (আঃ)', 'নবী ইউসুফ (আঃ)', 'বজ্রপাত', 'নবী ইবরাহীম (আঃ)', 'হিজর প্রদেশ',
    'মৌমাছি', 'রাত্রিকালীন যাত্রা', 'গুহা', 'মারইয়াম (আঃ)', 'ত্বহা',
    'নবীগণ', 'হজ্জ', 'মুমিনগণ', 'আলো', 'মানদণ্ড',
    'কবিগণ', 'পিঁপড়া', 'কাহিনীসমূহ', 'মাকড়সা', 'রোমান সাম্রাজ্য',
    'লুকমান', 'সিজদাহ', 'মিত্রবাহিনী', 'শেবা রাজ্য', 'সৃষ্টিকর্তা',
    'ইয়া-সীন', 'সারিবদ্ধগণ', 'সাদ', 'দলসমূহ', 'ক্ষমাকারী',
    'বিস্তারিত বর্ণিত', 'পরামর্শ', 'সোনার অলংকার', 'ধোঁয়া', 'হাঁটু গেড়ে বসা',
    'বালুর পাহাড়', 'মুহাম্মাদ (সাঃ)', 'বিজয়', 'ঘরের কক্ষসমূহ', 'ক্বাফ',
    'বিক্ষিপ্তকারী বায়ু', 'পর্বত', 'তারা', 'চাঁদ', 'পরম দয়ালু',
    'মহা ঘটনা', 'লোহা', 'বিতর্ককারী নারী', 'পুনর্সমাবেশ', 'পরীক্ষিতা',
    'সারিবদ্ধ যুদ্ধ', 'জুমআ', 'মুনাফিকগণ', 'পারস্পরিক ক্ষতি', 'তালাক',
    'নিষেধ করা', 'রাজত্ব', 'কলম', 'অনিবার্য সত্য', 'উর্ধ্বগামী পথ',
    'নবী নূহ (আঃ)', 'জ্বিন', 'চাদরাবৃত', 'বস্ত্রাবৃত', 'পুনরুত্থান',
    'মানুষ', 'প্রেরিত বায়ু', 'মহাসংবাদ', 'উৎপাটনকারী', 'ভ্রুকুঞ্চন',
    'অন্ধকারাচ্ছন্ন', 'বিদীর্ণ', 'যারা মাপে কম দেয়', 'বিস্ফারিত', 'রাশিচক্র',
    'রাতের তারা', 'সর্বোচ্চ', 'অভিভূতকারী', 'ভোরবেলা', 'শহর',
    'সূর্য', 'রাত', 'পূর্বাহ্ন', 'স্বস্তি', 'ডুমুর',
    'রক্তপিণ্ড', 'মহিমান্বিত রাত', 'স্পষ্ট প্রমাণ', 'ভূমিকম্প', 'দ্রুতধাবমান',
    'মহাপ্রলয়', 'প্রাচুর্যের প্রতিযোগিতা', 'সময়', 'পরনিন্দাকারী', 'হাতি',
    'কুরাইশ গোত্র', 'সামান্য সাহায্য', 'প্রাচুর্য', 'অবিশ্বাসীগণ', 'সাহায্য ও বিজয়',
    'খেজুরের ছাল', 'একনিষ্ঠতা', 'ভোরের আলো', 'মানবজাতি'
];

// -------------------------------------------------------
// Public API functions
// -------------------------------------------------------

// Public accessors — const vars aren't cross-script, functions are
function getBengaliName(surahNumber) {
    return BENGALI_SURAH_NAMES[surahNumber - 1] || '';
}
function getBengaliMeaning(surahNumber) {
    return BENGALI_SURAH_MEANINGS[surahNumber - 1] || '';
}

// Converts Western digits to Bengali numerals  e.g. 114 → ১১৪
function toBengaliNumber(num) {
    const map = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
    return String(num).replace(/[0-9]/g, d => map[parseInt(d)]);
}

// Returns all 114 surahs with bengaliName added
async function getAllSurahs() {
    const list = await apiFetch('surah_list', `${API_BASE}/surah`);
    return list.map(s => ({
        ...s,
        bengaliName: BENGALI_SURAH_NAMES[s.number - 1] || s.englishName
    }));
}

// Arabic text only
async function getSurahArabic(id) {
    return apiFetch(`ar_${id}`, `${API_BASE}/surah/${id}`);
}

// Bengali translation — Muhiuddin Khan edition
async function getSurahBengali(id) {
    return apiFetch(`bn_${id}`, `${API_BASE}/surah/${id}/bn.bengali`);
}

// English translation — Saheeh International edition
async function getSurahEnglish(id) {
    return apiFetch(`en_${id}`, `${API_BASE}/surah/${id}/en.sahih`);
}

// Fetch all three editions in parallel — Arabic failure is fatal,
// translation failures degrade gracefully (we still show the Arabic)
async function getSurahAllData(id) {
    const [arabic, bengali, english] = await Promise.allSettled([
        getSurahArabic(id),
        getSurahBengali(id),
        getSurahEnglish(id)
    ]);

    if (arabic.status === 'rejected') {
        throw new Error('সূরা লোড করা যায়নি: ' + arabic.reason.message);
    }

    return {
        arabic: arabic.value,
        bengali: bengali.status === 'fulfilled' ? bengali.value : null,
        english: english.status === 'fulfilled' ? english.value : null
    };
}

// Build audio URL directly from the global ayah number (1–6236).
// This avoids making a separate API call for every single ayah.
// CDN pattern: https://cdn.islamic.network/quran/audio/{bitrate}/{edition}/{globalNum}.mp3
function buildAudioUrl(globalAyahNumber) {
    return `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${globalAyahNumber}.mp3`;
}

// -------------------------------------------------------
// Bookmark helpers — saves last-read ayah per surah
// -------------------------------------------------------

function saveBookmark(surahId, ayahNumberInSurah) {
    try {
        localStorage.setItem(`quran_bm_${surahId}`, String(ayahNumberInSurah));
    } catch { /* ignore */ }
}

function loadBookmark(surahId) {
    const v = localStorage.getItem(`quran_bm_${surahId}`);
    return v ? parseInt(v, 10) : null;
}

function clearBookmark(surahId) {
    localStorage.removeItem(`quran_bm_${surahId}`);
}

// -------------------------------------------------------
// Extended edition fetchers
// -------------------------------------------------------

async function getSurahTransliteration(id) {
    try {
        return await apiFetch(`tr_${id}`, `${API_BASE}/surah/${id}/bn.transliteration`);
    } catch {
        return null; // Optional — gracefully skip if edition doesn't exist
    }
}

async function getSurahPickthall(id) {
    try {
        return await apiFetch(`pk_${id}`, `${API_BASE}/surah/${id}/en.pickthall`);
    } catch {
        return null;
    }
}

// Full parallel fetch: Arabic + Bengali + English(sahih) + English(pickthall) + Transliteration
async function getSurahAllDataFull(id) {
    const [arabic, bengali, englishSahih, englishPickthall, transliteration] =
        await Promise.allSettled([
            getSurahArabic(id),
            getSurahBengali(id),
            getSurahEnglish(id),
            getSurahPickthall(id),
            getSurahTransliteration(id),
        ]);

    if (arabic.status === 'rejected') {
        throw new Error('সূরা লোড করা যায়নি: ' + arabic.reason.message);
    }

    return {
        arabic:           arabic.value,
        bengali:          bengali.status === 'fulfilled'          ? bengali.value          : null,
        englishSahih:     englishSahih.status === 'fulfilled'     ? englishSahih.value     : null,
        englishPickthall: englishPickthall.status === 'fulfilled' ? englishPickthall.value : null,
        transliteration:  transliteration.status === 'fulfilled'  ? transliteration.value  : null,
    };
}

// -------------------------------------------------------
// 30 Para (Juz) static data
// -------------------------------------------------------
const PARA_DATA = [
    { num: 1,  name: 'আলিফ লাম মীম',            surah: 1,  ayah: 1   },
    { num: 2,  name: 'সায়াকুল',                 surah: 2,  ayah: 142 },
    { num: 3,  name: 'তিলকার রুসুল',             surah: 2,  ayah: 253 },
    { num: 4,  name: 'লান তানালু',               surah: 3,  ayah: 93  },
    { num: 5,  name: 'ওয়াল মুহসানাত',            surah: 4,  ayah: 24  },
    { num: 6,  name: 'লা ইউহিব্বুল্লাহ',          surah: 4,  ayah: 148 },
    { num: 7,  name: 'ওয়া ইযা সামিউ',            surah: 5,  ayah: 82  },
    { num: 8,  name: 'ওয়া লাও আন্নানা',           surah: 6,  ayah: 111 },
    { num: 9,  name: 'ক্বালাল মালাউ',             surah: 7,  ayah: 88  },
    { num: 10, name: 'ওয়া\'লামু',               surah: 8,  ayah: 41  },
    { num: 11, name: 'ইয়া\'তাযিরুন',             surah: 9,  ayah: 93  },
    { num: 12, name: 'ওয়ামা মিন দাব্বা',          surah: 11, ayah: 6   },
    { num: 13, name: 'ওয়ামা উবাররিউ',            surah: 12, ayah: 53  },
    { num: 14, name: 'রুবামা',                   surah: 15, ayah: 1   },
    { num: 15, name: 'সুবহানাল্লাযি',             surah: 17, ayah: 1   },
    { num: 16, name: 'ক্বালা আলাম',              surah: 18, ayah: 75  },
    { num: 17, name: 'ইকতারাবা',                surah: 21, ayah: 1   },
    { num: 18, name: 'ক্বাদ আফলাহা',             surah: 23, ayah: 1   },
    { num: 19, name: 'ওয়া ক্বালাল্লাযিনা',        surah: 25, ayah: 21  },
    { num: 20, name: 'আম্মান খালাক্বা',            surah: 27, ayah: 56  },
    { num: 21, name: 'উতলু মা উহিয়া',            surah: 29, ayah: 46  },
    { num: 22, name: 'ওয়ামাইয়াকনুত',            surah: 33, ayah: 31  },
    { num: 23, name: 'ওয়ামা লি',                surah: 36, ayah: 28  },
    { num: 24, name: 'ফামান আযলামু',             surah: 39, ayah: 32  },
    { num: 25, name: 'ইলাইহি ইউরাদ্দু',           surah: 41, ayah: 47  },
    { num: 26, name: 'হা-মীম',                  surah: 46, ayah: 1   },
    { num: 27, name: 'ক্বালা ফামা খাতবুকুম',      surah: 51, ayah: 31  },
    { num: 28, name: 'ক্বাদ সামিআল্লাহ',          surah: 58, ayah: 1   },
    { num: 29, name: 'তাবারাকাল্লাযি',            surah: 67, ayah: 1   },
    { num: 30, name: 'আম্মা',                   surah: 78, ayah: 1   },
];

function getParaList() { return PARA_DATA; }
