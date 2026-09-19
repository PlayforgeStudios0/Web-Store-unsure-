// admin.js
const REPO_OWNER = "PlayforgeStudios0";
const REPO_NAME = "PLAYFORGE-Hub";

let isEditMode = false;
let editCategory = null;
let editFolder = null;
let originalManifest = null;
let manifestSha = null;

document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  editCategory = urlParams.get("category");
  editFolder = urlParams.get("folder");

  if (editCategory && editFolder) {
    isEditMode = true;
    setupEditMode();
  }

  document.getElementById("itemType").addEventListener("change", handlePackageNamePrefix);
  document.getElementById("appName").addEventListener("input", handlePackageNamePrefix);
  document.getElementById("monetizationType").addEventListener("change", handleMonetizationToggle);
  document.getElementById("bumpType").addEventListener("change", handleVersionBump);
  document.getElementById("publishForm").addEventListener("submit", handleSubmit);
});

function handlePackageNamePrefix() {
  if (isEditMode) return;
  const type = document.getElementById("itemType").value;
  const name = document.getElementById("appName").value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const prefix = type === "apps" ? "com.playforge.breeze" : "com.playforge.cube";
  document.getElementById("packageIdentity").value = `${prefix}.${name || "app"}`;
}

function handleMonetizationToggle() {
  const type = document.getElementById("monetizationType").value;
  const subFields = document.getElementById("subscriptionFields");
  const priceGroup = document.getElementById("priceGroup");

  if (type === "subscription") {
    subFields.style.display = "grid";
    priceGroup.style.display = "block";
  } else if (type === "paid") {
    subFields.style.display = "none";
    priceGroup.style.display = "block";
  } else {
    subFields.style.display = "none";
    priceGroup.style.display = "none";
  }
}

async function setupEditMode() {
  document.getElementById("formTitle").innerText = `Edit Package: ${editFolder}`;
  document.getElementById("versionBumpSection").style.display = "grid";
  document.getElementById("initialVersionSection").style.display = "none";

  try {
    const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${editCategory}/${editFolder}/manifest.json`;
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error("Failed to fetch target manifest.");
    
    const data = await res.json();
    manifestSha = data.sha;
    originalManifest = JSON.parse(atob(data.content));

    // Populate form
    document.getElementById("itemType").value = editCategory;
    document.getElementById("itemType").disabled = true;
    document.getElementById("appName").value = originalManifest.name || "";
    document.getElementById("packageIdentity").value = originalManifest.package || "";
    document.getElementById("packageIdentity").readOnly = true;
    document.getElementById("appVersion").value = originalManifest.version || "1.0.0";
    
    document.getElementById("monetizationType").value = originalManifest.monetizationType || "free";
    handleMonetizationToggle();

    if (originalManifest.monetizationType === "subscription") {
      document.getElementById("appPrice").value = originalManifest.subscription?.price || 0;
      document.getElementById("subInterval").value = originalManifest.subscription?.interval || "monthly";
      document.getElementById("subTierName").value = originalManifest.subscription?.tierName || "";
    } else {
      document.getElementById("appPrice").value = originalManifest.price || 0;
    }

    document.getElementById("ageRating").value = originalManifest.ageRating || "3+";
    document.getElementById("appTags").value = (originalManifest.tags || []).join(", ");
    document.getElementById("shortDescription").value = originalManifest.shortDescription || "";
    document.getElementById("fullDescription").value = originalManifest.description || "";
    document.getElementById("updateNotes").value = originalManifest.updateNotes || "";

  } catch (err) {
    alert("Error loading package data: " + err.message);
  }
}

function handleVersionBump() {
  if (!originalManifest) return;
  const bump = document.getElementById("bumpType").value;
  const currentVersion = originalManifest.version || "1.0.0";
  
  let parts = currentVersion.split(".").map(n => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);

  let [major, minor, patch] = parts;

  if (bump === "bugfix") {
    patch += 1;
  } else if (bump === "minor") {
    minor += 1;
    patch = 0;
  } else if (bump === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  }

  document.getElementById("appVersion").value = `${major}.${minor}.${patch}`;
}

async function handleSubmit(e) {
  e.preventDefault();
  const token = document.getElementById("githubToken").value.trim();
  if (!token) {
    alert("GitHub token is required to submit changes.");
    return;
  }

  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;
  submitBtn.innerText = "Pushing to Repository...";

  const category = document.getElementById("itemType").value;
  const title = document.getElementById("appName").value;
  const folderName = isEditMode ? editFolder : title.replace(/[^a-zA-Z0-9]/g, "");
  const version = isEditMode ? document.getElementById("appVersion").value : document.getElementById("appVersionInitial").value;
  
  const monetization = document.getElementById("monetizationType").value;
  const price = parseFloat(document.getElementById("appPrice").value) || 0;

  const manifestData = {
    name: title,
    package: document.getElementById("packageIdentity").value,
    version: version,
    monetizationType: monetization,
    price: monetization === "paid" ? price : 0,
    subscription: monetization === "subscription" ? {
      price: price,
      interval: document.getElementById("subInterval").value,
      tierName: document.getElementById("subTierName").value
    } : null,
    ageRating: document.getElementById("ageRating").value,
    tags: document.getElementById("appTags").value.split(",").map(t => t.trim()).filter(Boolean),
    shortDescription: document.getElementById("shortDescription").value,
    description: document.getElementById("fullDescription").value,
    updateNotes: document.getElementById("updateNotes").value,
    developer: "Playforge",
    updated: new Date().toISOString().split('T')[0],
    icon: originalManifest?.icon || "icon.png",
    apk: originalManifest?.apk || `${folderName.toLowerCase()}.apk`
  };

  const path = `${category}/${folderName}/manifest.json`;
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;

  const payload = {
    message: isEditMode ? `Update package ${folderName} to v${version}` : `Publish ${folderName} v${version}`,
    content: btoa(unescape(encodeURIComponent(JSON.stringify(manifestData, null, 2)))),
    sha: isEditMode ? manifestSha : undefined
  };

  try {
    const res = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        "Authorization": `token ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      alert(`Package successfully ${isEditMode ? 'updated' : 'published'}!`);
      window.location.href = "dashboard.html";
    } else {
      const errData = await res.json();
      throw new Error(errData.message || "GitHub API update failed.");
    }
  } catch (err) {
    alert("Error saving release: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = "Submit Release";
  }
}
