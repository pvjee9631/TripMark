const map = L.map('map').setView([47.918873, 106.917701], 6); // UB төв

// OpenStreetMap суурь зураг
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let tempLatLng = null; // Түр координат хадгалах

// Газрын зураг дээр дарахад popup form нээх
map.on('click', function(e) {
  tempLatLng = e.latlng;
  document.getElementById("popup-form").classList.remove("hidden");
});

// Popup form-оор газар хадгалах
function submitPlace() {
  const name = document.getElementById("place-name").value.trim();
  const comment = document.getElementById("place-comment").value.trim(); // ✏ comment авах
  const fileInput = document.getElementById("place-image");
  const file = fileInput.files[0];

  if (!name || !tempLatLng) return alert("Газрын нэрээ оруулна уу");

  const placeData = {
    name,
    lat: tempLatLng.lat,
    lon: tempLatLng.lng,
    image: null,
    comment
  };

  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      placeData.image = e.target.result;
      saveSearchHistory(placeData);
      resetForm();
    };
    reader.readAsDataURL(file);
  } else {
    saveSearchHistory(placeData);
    resetForm();
  }
}


// Form цэвэрлэх
function resetForm() {
  document.getElementById("popup-form").classList.add("hidden");
  document.getElementById("place-name").value = "";
  document.getElementById("place-image").value = "";
  document.getElementById("place-comment").value = "";
  tempLatLng = null;
}

function searchLocation() {
  const query = document.getElementById("search-input").value.trim();
  if (!query) return;

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&accept-language=mn`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (data && data.length > 0) {
        const place = data[0];
        const lat = parseFloat(place.lat);
        const lon = parseFloat(place.lon);

        map.setView([lat, lon], 10);

        // 🌟 Хадгалахгүй, харин форм гаргаж өгнө
        tempLatLng = { lat, lng: lon }; // дараа хадгалах үед ашиглана
        document.getElementById("popup-form").classList.remove("hidden");

        // Хайсан нэрийг урьдчилан оруулж өгч болно
        document.getElementById("place-name").value = place.display_name;
      } else {
        alert("Газрыг олсонгүй.");
      }
    })
    .catch(err => {
      console.error("Алдаа гарлаа:", err);
      alert("Хайлт хийхэд алдаа гарлаа.");
    });
}


document.getElementById("close-form").addEventListener("click", () => {
  document.getElementById("popup-form").classList.add("hidden");
  resetForm(); // input-уудыг цэвэрлэнэ
});

// Хайлтын түүх хадгалах
function saveSearchHistory(place) {
  let history = JSON.parse(localStorage.getItem("searchHistory")) || [];

  const alreadyExists = history.some(p =>
    p.name === place.name && p.lat === place.lat && p.lon === place.lon
  );

  if (!alreadyExists) {
    history.push(place);
    localStorage.setItem("searchHistory", JSON.stringify(history));
    renderSearchHistory();
    drawMarker(place); // Marker зурна
  }
}

// Marker зурна
function drawMarker(place) {
  let popupContent = `<b style="font-size: 16px; color: #222;">${place.name}</b>`;

  if (place.comment) {
    popupContent += `
      <div style="margin-top: 8px; padding: 6px 8px; background: #f9f9f9; border-left: 3px solid #0077cc; font-style: italic; font-size: 13px; color: #333;">
        ${place.comment}
      </div>`;
  }

  if (place.image) {
    popupContent += `<br><img src="${place.image}" width="150" style="margin-top: 10px; border-radius: 4px; box-shadow: 0 1px 5px rgba(0,0,0,0.2);">`;
  }

  const marker = L.marker([place.lat, place.lon])
    .addTo(map)
    .bindPopup(popupContent);

  allMarkers.push({ marker, lat: place.lat, lon: place.lon });
}



// UI дээр түүхийг харуулах ба marker-уудыг сэргээх
function renderSearchHistory() {
  const history = JSON.parse(localStorage.getItem("searchHistory")) || [];
  const listEl = document.getElementById("search-history");
  listEl.innerHTML = "";

  history.forEach(place => {
    const li = document.createElement("li");
    // li.textContent = place.name;
    // li.title = `${place.lat.toFixed(4)}, ${place.lon.toFixed(4)}`;
    // li.onclick = () => {
    //   map.setView([place.lat, place.lon], 10);
    // };
    li.innerHTML = `
  <span class="place-name">${place.name}</span>
  <button class="delete-btn">❌</button>
`;
li.title = `${place.lat.toFixed(4)}, ${place.lon.toFixed(4)}`;

// Газрыг дарж төвлөрөх
li.querySelector(".place-name").onclick = () => {
  map.setView([place.lat, place.lon], 10);
};

// Устгах товч
li.querySelector(".delete-btn").onclick = (e) => {
  e.stopPropagation(); // Газрын төвлөрөл идэвхжихээс сэргийлнэ
  deletePlace(place);
};

    listEl.appendChild(li);

    drawMarker(place); // Marker сэргээх
  });
}

// Газрын түүхийг устгах
function deletePlace(placeToDelete) {
  let history = JSON.parse(localStorage.getItem("searchHistory")) || [];
  history = history.filter(p =>
    !(p.name === placeToDelete.name && p.lat === placeToDelete.lat && p.lon === placeToDelete.lon)
  );
  localStorage.setItem("searchHistory", JSON.stringify(history));
  renderSearchHistory(); // UI дахин зурах
}

let allMarkers = []; // 🔸 бүх marker-уудыг хадгалах

function renderSearchHistory() {
  // 🔴 Газрын зураг дээрх marker-уудыг эхлээд устгана
  allMarkers.forEach(m => map.removeLayer(m.marker));
  allMarkers = [];

  const history = JSON.parse(localStorage.getItem("searchHistory")) || [];
  const listEl = document.getElementById("search-history");
  listEl.innerHTML = "";

  history.forEach(place => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="place-name">${place.name}</span>
      <button class="delete-btn">❌</button>
    `;
    li.title = `${place.lat.toFixed(4)}, ${place.lon.toFixed(4)}`;

    li.querySelector(".place-name").onclick = () => {
      map.setView([place.lat, place.lon], 10);
    };
    li.querySelector(".delete-btn").onclick = (e) => {
      e.stopPropagation();
      deletePlace(place);
    };
    listEl.appendChild(li);

    drawMarker(place);
  });
}


// Хуудас ачаалахад marker-уудаа сэргээх
renderSearchHistory();
