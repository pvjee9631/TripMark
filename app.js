
// =========================
// TripMark / app.js (MN ⇄ JA i18n 版)
// =========================

// --- Leaflet map init ---
const map = L.map("map").setView([47.918873, 106.917701], 6); // Ulaanbaatar center
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// --- State ---
let tempLatLng = null;     // map дээр дарсан эсвэл хайлтаас ирсэн түр координат
let allMarkers = [];       // Газрын зураг дээрх бүх marker-ууд
const LS_KEY = "searchHistory";

// ========== i18n ==========
const LANG_KEY = "tm_lang";
const languages = ["mn", "ja"];

const I18N = {
  mn: {
    title: "🗺️ Миний Аялах Газрууд",
    searchPlaceholder: "Газрын нэр хайх (ж.н. Тэрэлж)",
    searchBtn: "Хайх",
    historyTitle: "🔁 Хайсан газрууд:",
    formName: "Газрын нэр",
    formComment: "Тайлбар эсвэл сэтгэгдэл бичнэ үү",
    saveBtn: "Хадгалах",
    notFound: "Газрыг олсонгүй.",
    searchError: "Хайлт хийхэд алдаа гарлаа.",
    pickHint: "Газрын нэрээ оруулаад, газрын зураг дээр байршлаа сонгоно уу.",
  },
  ja: {
    title: "🗺️ 旅行スポットメモ",
    searchPlaceholder: "場所名で検索（例：テレルジ / 上野公園）",
    searchBtn: "検索",
    historyTitle: "🔁 検索履歴：",
    formName: "場所名",
    formComment: "メモ・コメントを入力",
    saveBtn: "保存",
    notFound: "場所が見つかりませんでした。",
    searchError: "検索中にエラーが発生しました。",
    pickHint: "場所名を入力して地図上で位置を選んでください。",
  },
};

function getLang() {
  const saved = localStorage.getItem(LANG_KEY);
  return languages.includes(saved) ? saved : "mn";
}
let CURRENT_LANG = getLang();

function t(key) {
  return I18N[CURRENT_LANG][key] || I18N["mn"][key] || key;
}

function applyI18N() {
  const h1 = document.querySelector("h1");
  if (h1) h1.textContent = t("title");

  const input = document.getElementById("search-input");
  if (input) input.placeholder = t("searchPlaceholder");

  const btns = document.querySelectorAll("#search-box button");
  if (btns[0]) btns[0].textContent = t("searchBtn");

  const h3 = document.querySelector("#history-box h3");
  if (h3) h3.textContent = t("historyTitle");

  const nameEl = document.getElementById("place-name");
  if (nameEl) nameEl.placeholder = t("formName");

  const commentEl = document.getElementById("place-comment");
  if (commentEl) commentEl.placeholder = t("formComment");

  const saveBtn =
    document.getElementById("submit-place") ||
    document.querySelector('#popup-form button[onclick="submitPlace()"]');
  if (saveBtn) saveBtn.textContent = t("saveBtn");

  const sel = document.getElementById("lang-select");
  if (sel) sel.value = CURRENT_LANG;
}

function setLang(lang) {
  if (!languages.includes(lang)) return;
  CURRENT_LANG = lang;
  localStorage.setItem(LANG_KEY, lang);
  applyI18N();
}

// --- Utils ---
function hasDOMPurify() {
  return typeof DOMPurify !== "undefined" && DOMPurify.sanitize;
}
function safeHTML(str) {
  const s = String(str ?? "");
  if (hasDOMPurify()) return DOMPurify.sanitize(s);
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function debounce(fn, wait = 600) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

async function resizeImage(file, maxSize = 1024) {
  if (!file) return null;
  const dataURL = await new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = (e) => resolve(e.target.result);
    fr.readAsDataURL(file);
  });

  const img = new Image();
  img.src = dataURL;
  await img.decode();

  const maxSide = Math.max(img.width, img.height);
  const scale = Math.min(1, maxSize / maxSide);
  if (scale >= 1) return dataURL;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

// --- Storage helpers ---
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || [];
  } catch {
    return [];
  }
}
function saveHistory(arr) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
    return true;
  } catch (e) {
    console.error("localStorage error:", e);
    alert(
      CURRENT_LANG === "ja"
        ? "ストレージが一杯です。画像なしで保存するか、いくつか削除してください。"
        : "Санах ой дүүрсэн тул зураггүйгээр хадгална уу эсвэл зарим газраа устгана уу."
    );
    return false;
  }
}

function addPlaceToHistory(place) {
  const history = loadHistory();
  const exists = history.some(
    (p) => p.name === place.name && p.lat === place.lat && p.lon === place.lon
  );
  if (exists) return;
  history.push(place);
  if (saveHistory(history)) {
    renderSearchHistory();
    drawMarker(place);
  }
}
function deletePlace(placeToDelete) {
  let history = loadHistory();
  history = history.filter(
    (p) =>
      !(
        p.name === placeToDelete.name &&
        p.lat === placeToDelete.lat &&
        p.lon === placeToDelete.lon
      )
  );
  saveHistory(history);
  renderSearchHistory();
}

// --- Map markers / UI ---
function clearAllMarkers() {
  allMarkers.forEach((m) => map.removeLayer(m.marker));
  allMarkers = [];
}

function drawMarker(place) {
  const parts = [];
  parts.push(
    `<b style="font-size:16px;color:#222;">${safeHTML(place.name)}</b>`
  );
  if (place.comment) {
    parts.push(
      `<div style="margin-top:8px;padding:6px 8px;background:#f9f9f9;border-left:3px solid #0077cc;font-style:italic;font-size:13px;color:#333;">${safeHTML(
        place.comment
      )}</div>`
    );
  }
  if (place.image) {
    parts.push(
      `<br><img src="${place.image}" width="150" style="margin-top:10px;border-radius:4px;box-shadow:0 1px 5px rgba(0,0,0,.2);">`
    );
  }
  const popupContent = parts.join("");

  const marker = L.marker([place.lat, place.lon])
    .addTo(map)
    .bindPopup(popupContent);
  allMarkers.push({ marker, lat: place.lat, lon: place.lon });
}

function renderSearchHistory() {
  clearAllMarkers();
  const history = loadHistory();
  const listEl = document.getElementById("search-history");
  if (!listEl) return;
  listEl.innerHTML = "";

  history.forEach((place) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="place-name">${safeHTML(place.name)}</span>
      <button class="delete-btn" aria-label="Delete">❌</button>
    `;
    li.title = `${place.lat.toFixed(4)}, ${place.lon.toFixed(4)}`;

    li.querySelector(".place-name").onclick = () =>
      map.setView([place.lat, place.lon], 10);

    li.querySelector(".delete-btn").onclick = (e) => {
      e.stopPropagation();
      deletePlace(place);
    };

    listEl.appendChild(li);
    drawMarker(place);
  });
}

// --- Form helpers ---
function resetForm() {
  const form = document.getElementById("popup-form");
  if (form) form.classList.add("hidden");

  const name = document.getElementById("place-name");
  const img = document.getElementById("place-image");
  const comment = document.getElementById("place-comment");

  if (name) name.value = "";
  if (img) img.value = "";
  if (comment) comment.value = "";
  tempLatLng = null;
}

// --- Actions ---
async function submitPlace() {
  const nameEl = document.getElementById("place-name");
  const commentEl = document.getElementById("place-comment");
  const fileInput = document.getElementById("place-image");

  const name = (nameEl?.value || "").trim();
  const comment = (commentEl?.value || "").trim();
  const file = fileInput?.files?.[0];

  if (!name || !tempLatLng) {
    alert(t("pickHint"));
    return;
  }

  const placeData = {
    name,
    lat: tempLatLng.lat,
    lon: tempLatLng.lng,
    image: null,
    comment,
  };

  try {
    if (file) {
      placeData.image = await resizeImage(file, 1024);
    }
    addPlaceToHistory(placeData);
  } catch (e) {
    console.error(e);
    alert(CURRENT_LANG === "ja" ? "保存時にエラーが発生しました。" : "Хадгалах явцад алдаа гарлаа.");
  } finally {
    resetForm();
  }
}

function searchLocationFactory() {
  const fn = async () => {
    const input = document.getElementById("search-input");
    const q = (input?.value || "").trim();
    if (!q) return;

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      q
    )}&accept-language=${CURRENT_LANG}`;

    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const place = data[0];
        const lat = parseFloat(place.lat);
        const lon = parseFloat(place.lon);
        map.setView([lat, lon], 10);

        tempLatLng = { lat, lng: lon };
        const form = document.getElementById("popup-form");
        if (form) form.classList.remove("hidden");
        const nameEl = document.getElementById("place-name");
        if (nameEl) nameEl.value = place.display_name || q;
      } else {
        alert(t("notFound"));
      }
    } catch (e) {
      console.error("Search error:", e);
      alert(t("searchError"));
    }
  };
  return debounce(fn, 600);
}
const doSearch = searchLocationFactory();

// --- Event bindings ---
document.addEventListener("DOMContentLoaded", () => {
  // i18n 初期化
  const sel = document.getElementById("lang-select");
  if (sel) {
    sel.value = CURRENT_LANG;
    sel.addEventListener("change", (e) => setLang(e.target.value));
  }
  applyI18N();

  renderSearchHistory();

  map.on("click", (e) => {
    tempLatLng = e.latlng;
    const form = document.getElementById("popup-form");
    if (form) form.classList.remove("hidden");
  });

  const closeBtn = document.getElementById("close-form");
  if (closeBtn) closeBtn.addEventListener("click", resetForm);

  const submit = document.getElementById("submit-place");
  if (submit) submit.addEventListener("click", submitPlace);

  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", doSearch);
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSearch();
      if (e.key === "Escape") resetForm();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") resetForm();
  });
});
// --- Expose to global ---
window.submitPlace = submitPlace;
window.searchLocation = () => doSearch();
