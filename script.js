// script.js
const REPO_OWNER = "PlayforgeStudios0";
const REPO_NAME = "PLAYFORGE-Hub";
const BASE_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents`;

let allItems = [];
let activeCategory = "all";
let activeTag = "all";
let pendingDownloadUrl = null;

document.addEventListener("DOMContentLoaded", () => {
  fetchStoreItems();

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      activeCategory = e.target.dataset.category;
      applyFilters();
    });
  });

  document.getElementById("searchBtn").addEventListener("click", applyFilters);
  document.getElementById("searchInput").addEventListener("keyup", (e) => {
    if (e.key === "Enter") applyFilters();
  });

  document.getElementById("ageCancelBtn").addEventListener("click", () => {
    document.getElementById("ageModalOverlay").style.display = "none";
    pendingDownloadUrl = null;
  });

  document.getElementById("ageConfirmBtn").addEventListener("click", () => {
    document.getElementById("ageModalOverlay").style.display = "none";
    if (pendingDownloadUrl) {
      window.open(pendingDownloadUrl, "_blank");
      pendingDownloadUrl = null;
    }
  });
});

async function fetchStoreItems() {
  const grid = document.getElementById("catalogGrid");
  grid.innerHTML = `<div class="loading-state">Loading store catalog...</div>`;
  allItems = [];

  try {
    const categories = ["apps", "games"];
    for (const cat of categories) {
      const response = await fetch(`${BASE_API}/${cat}`);
      if (!response.ok) continue;
      const folders = await response.json();

      for (const folder of folders) {
        if (folder.type === "dir") {
          const manifestRes = await fetch(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${cat}/${folder.name}/manifest.json`);
          if (manifestRes.ok) {
            const manifest = await manifestRes.json();
            manifest._category = cat;
            manifest._folderName = folder.name;
            allItems.push(manifest);
          }
        }
      }
    }

    populateTagPills();
    applyFilters();
  } catch (err) {
    grid.innerHTML = `<p class="error">Failed to load catalog from repository.</p>`;
    console.error(err);
  }
}

function populateTagPills() {
  const tagContainer = document.getElementById("tagPillsContainer");
  const tagSet = new Set();
  allItems.forEach(item => {
    if (Array.isArray(item.tags)) {
      item.tags.forEach(t => tagSet.add(t.trim()));
    }
  });

  let html = `<button class="tag-pill active" onclick="selectTag('all', this)">All</button>`;
  tagSet.forEach(tag => {
    html += `<button class="tag-pill" onclick="selectTag('${tag}', this)">${tag}</button>`;
  });
  tagContainer.innerHTML = html;
}

function selectTag(tag, element) {
  document.querySelectorAll(".tag-pill").forEach(p => p.classList.remove("active"));
  element.classList.add("active");
  activeTag = tag;
  applyFilters();
}

function applyFilters() {
  const searchTerm = document.getElementById("searchInput").value.toLowerCase();

  const filtered = allItems.filter(item => {
    const matchesCat = activeCategory === "all" || item._category === activeCategory;
    const matchesTag = activeTag === "all" || (Array.isArray(item.tags) && item.tags.includes(activeTag));
    const matchesSearch = item.name.toLowerCase().includes(searchTerm) || 
                          (item.description && item.description.toLowerCase().includes(searchTerm)) ||
                          (item.package && item.package.toLowerCase().includes(searchTerm));

    return matchesCat && matchesTag && matchesSearch;
  });

  renderGrid(filtered);
}

function renderGrid(items) {
  const grid = document.getElementById("catalogGrid");
  if (items.length === 0) {
    grid.innerHTML = `<p class="no-results">No applications found matching criteria.</p>`;
    return;
  }

  grid.innerHTML = items.map(item => {
    const iconUrl = item.icon ? `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${item._category}/${item._folderName}/${item.icon}` : "https://via.placeholder.com/64";
    const apkUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${item._category}/${item._folderName}/${item.apk || ''}`;
    const ageClass = `badge-${(item.ageRating || '3+').replace('+', '')}`;

    let priceDisplay = "Free";
    if (item.monetizationType === "subscription") {
      priceDisplay = `$${item.subscription?.price || '0.00'}/${item.subscription?.interval || 'mo'}`;
    } else if (item.monetizationType === "paid") {
      priceDisplay = `$${item.price || '0.00'}`;
    }

    const tagsHtml = (item.tags || []).map(t => `<span class="card-tag">${t}</span>`).join('');

    return `
      <div class="card">
        <div>
          <div class="card-header">
            <img src="${iconUrl}" class="card-icon" alt="${item.name}">
            <div class="card-meta">
              <h4>${item.name}</h4>
              <p>v${item.version || '1.0.0'} • ${item.developer || 'Playforge'}</p>
              <div class="card-badges">
                <span class="badge ${ageClass}">${item.ageRating || '3+'}</span>
                ${item.monetizationType === "subscription" ? `<span class="badge badge-sub">${item.subscription?.tierName || 'SUB'}</span>` : ''}
              </div>
            </div>
          </div>
          <p style="font-size:0.85rem; margin:0.8rem 0; color: var(--text-muted);">${item.shortDescription || item.description || ''}</p>
          <div class="card-tags">${tagsHtml}</div>
        </div>
        <div class="card-footer">
          <span class="price-tag">${priceDisplay}</span>
          <button class="btn btn-primary" onclick="handleDownload('${apkUrl}', '${item.ageRating}')">Download</button>
        </div>
      </div>
    `;
  }).join('');
}

function handleDownload(url, ageRating) {
  if (ageRating === "18+") {
    pendingDownloadUrl = url;
    document.getElementById("ageModalOverlay").style.display = "flex";
  } else {
    window.open(url, "_blank");
  }
}
