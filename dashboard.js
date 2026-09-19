// dashboard.js
const REPO_OWNER = "PlayforgeStudios0";
const REPO_NAME = "PLAYFORGE-Hub";
const BASE_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents`;

document.addEventListener("DOMContentLoaded", () => {
  loadDashboardData();
});

async function loadDashboardData() {
  const tbody = document.getElementById("dashboardTableBody");
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Fetching published releases...</td></tr>`;

  let totalCount = 0;
  let totalDownloads = 0;
  let publishedItems = [];

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
            publishedItems.push(manifest);
            
            totalCount++;
            totalDownloads += (manifest.downloads || 0);
          }
        }
      }
    }

    document.getElementById("statTotalCount").innerText = totalCount;
    document.getElementById("statTotalDownloads").innerText = totalDownloads.toLocaleString();
    document.getElementById("statSubscriptions").innerText = publishedItems.filter(i => i.monetizationType === "subscription").length;
    document.getElementById("statPackages").innerText = totalCount;

    renderTable(publishedItems);
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--badge-red);">Error loading dashboard packages.</td></tr>`;
  }
}

function renderTable(items) {
  const tbody = document.getElementById("dashboardTableBody");
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No published packages found.</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(item => {
    let priceInfo = "Free";
    if (item.monetizationType === "subscription") {
      priceInfo = `Sub ($${item.subscription?.price || 0}/${item.subscription?.interval || 'mo'})`;
    } else if (item.monetizationType === "paid") {
      priceInfo = `Paid ($${item.price || 0})`;
    }

    return `
      <tr>
        <td><strong>${item.name}</strong></td>
        <td><code>${item.package}</code></td>
        <td>v${item.version || '1.0.0'}</td>
        <td>${priceInfo}</td>
        <td><span class="badge badge-${(item.ageRating || '3+').replace('+', '')}">${item.ageRating || '3+'}</span></td>
        <td>
          <button class="btn btn-secondary" onclick="editPackage('${item._category}', '${item._folderName}')">Edit & Bump</button>
        </td>
      </tr>
    `;
  }).join('');
}

function editPackage(category, folder) {
  window.location.href = `admin.html?category=${category}&folder=${folder}`;
}
