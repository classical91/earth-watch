const STORE_KEYS = {
  collapsed: "ew_collapsed",
  favoritesOnly: "ew_favorites_only"
};

const state = {
  query: "",
  favoritesOnly: JSON.parse(localStorage.getItem(STORE_KEYS.favoritesOnly) || "false")
};

const sources = window.EARTHWATCH_SOURCES || [];

const root = document.getElementById("sectionsRoot");
const navPills = document.getElementById("navPills");
const searchInput = document.getElementById("searchInput");
const toggleAllBtn = document.getElementById("toggleAllBtn");
const favoritesOnlyBtn = document.getElementById("favoritesOnlyBtn");

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function getCollapsedSections() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEYS.collapsed) || "[]");
  } catch {
    return [];
  }
}

function saveCollapsedSections(ids) {
  localStorage.setItem(STORE_KEYS.collapsed, JSON.stringify(ids));
}

function groupSources(items) {
  return items.reduce((acc, item) => {
    const key = item.section;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function filterSources(items) {
  return items.filter((item) => {
    const matchesQuery =
      !state.query ||
      [item.title, item.source, item.section, item.badge]
        .join(" ")
        .toLowerCase()
        .includes(state.query.toLowerCase());

    const matchesFavorites = !state.favoritesOnly || item.favorite;

    return matchesQuery && matchesFavorites;
  });
}

function renderNav(sectionNames) {
  navPills.innerHTML = sectionNames
    .map((section) => {
      const id = slugify(section);
      return `<a href="#${id}" class="nav-pill">${section}</a>`;
    })
    .join("");
}

function createCard(item) {
  return `
    <a class="card" href="${item.url}" target="_blank" rel="noopener noreferrer">
      <div class="card-top">
        <span class="badge badge-${item.tone}">${item.badge}</span>
        <span class="arrow">↗</span>
      </div>
      <div class="card-title">${item.title}</div>
      <div class="card-src">${item.source}</div>
    </a>
  `;
}

function createSection(section, items, isCollapsed) {
  const id = slugify(section);

  return `
    <section class="section-block" id="${id}">
      <button
        class="section-header ${isCollapsed ? "collapsed" : ""}"
        type="button"
        data-section="${id}"
        aria-expanded="${!isCollapsed}"
        aria-controls="${id}-cards"
      >
        <span class="section-label">${section}</span>
        <span class="section-meta">${items.length} sources</span>
        <span class="section-chevron">▾</span>
      </button>
      <div class="cards ${isCollapsed ? "collapsed" : ""}" id="${id}-cards">
        ${items.map(createCard).join("")}
      </div>
    </section>
  `;
}

function renderSections() {
  const filtered = filterSources(sources);
  const grouped = groupSources(filtered);
  const sectionNames = Object.keys(grouped);
  const collapsed = getCollapsedSections();

  renderNav(sectionNames);

  root.innerHTML = sectionNames.length
    ? sectionNames
        .map((section) => {
          const id = slugify(section);
          return createSection(section, grouped[section], collapsed.includes(id));
        })
        .join("")
    : `<div class="empty-state">No matching sources.</div>`;

  bindSectionEvents();
  updateControls();
}

function bindSectionEvents() {
  document.querySelectorAll(".section-header").forEach((button) => {
    button.addEventListener("click", () => {
      const sectionId = button.dataset.section;
      const cards = document.getElementById(`${sectionId}-cards`);
      const collapsed = getCollapsedSections();
      const isCollapsed = cards.classList.toggle("collapsed");

      button.classList.toggle("collapsed", isCollapsed);
      button.setAttribute("aria-expanded", String(!isCollapsed));

      if (isCollapsed) {
        if (!collapsed.includes(sectionId)) collapsed.push(sectionId);
        saveCollapsedSections(collapsed);
      } else {
        saveCollapsedSections(collapsed.filter((id) => id !== sectionId));
      }

      updateControls();
    });
  });
}

function updateControls() {
  favoritesOnlyBtn.textContent = state.favoritesOnly ? "All sources" : "Favorites only";

  const sectionButtons = [...document.querySelectorAll(".section-header")];
  const allCollapsed =
    sectionButtons.length > 0 &&
    sectionButtons.every((button) => button.classList.contains("collapsed"));

  toggleAllBtn.textContent = allCollapsed ? "Expand all" : "Collapse all";
}

function toggleAllSections() {
  const sectionButtons = [...document.querySelectorAll(".section-header")];
  const allCollapsed =
    sectionButtons.length > 0 &&
    sectionButtons.every((button) => button.classList.contains("collapsed"));

  saveCollapsedSections(
    allCollapsed ? [] : sectionButtons.map((button) => button.dataset.section)
  );
  renderSections();
}

function setTimestamp() {
  const now = new Date();
  document.getElementById("ts").textContent =
    now.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" }) +
    " · " +
    now.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" });
}

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value.trim();
  renderSections();
});

toggleAllBtn.addEventListener("click", toggleAllSections);

favoritesOnlyBtn.addEventListener("click", () => {
  state.favoritesOnly = !state.favoritesOnly;
  localStorage.setItem(STORE_KEYS.favoritesOnly, JSON.stringify(state.favoritesOnly));
  renderSections();
});

setTimestamp();
setInterval(setTimestamp, 60000);
renderSections();
