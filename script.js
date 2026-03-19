const filter = document.getElementById("media-type");
const grid = document.getElementById("album-grid");
const browseDropdown = document.querySelector(".browse-dropdown");
const browseToggle = document.querySelector(".browse-toggle");
const browseToggleText = document.querySelector(".browse-toggle-text");
const browseMenu = document.querySelector(".browse-menu");
const browseOptions = Array.from(document.querySelectorAll(".browse-option"));

const navToggle = document.querySelector(".nav-toggle");
const navMenu = document.querySelector(".nav-dropdown-menu");
const navDropdown = document.querySelector(".nav-dropdown");
const logoLink = document.querySelector(".logo-link");
const listenNowLink = document.querySelector(".btn-listen");

const subscribeToggle = document.querySelector(".subscribe-toggle");
const subscribeMenu = document.querySelector(".subscribe-dropdown");
const subscribeWrapper = document.querySelector(".subscribe-wrapper");

const backToTop = document.getElementById("back-to-top");
const header = document.querySelector("header");
const heroBanner = document.querySelector(".hero-banner");
const musicSection = document.getElementById("music-section");

function setExpandedState(button, isExpanded) {
  button.setAttribute("aria-expanded", String(isExpanded));
  button.classList.toggle("is-open", isExpanded);
}

function closeNavMenu() {
  navMenu.classList.remove("show");
  setExpandedState(navToggle, false);
}

function closeSubscribeMenu() {
  subscribeMenu.classList.remove("show");
  setExpandedState(subscribeToggle, false);
}

function closeBrowseMenu() {
  if (!browseMenu || !browseToggle) {
    return;
  }

  browseMenu.classList.remove("show");
  browseToggle.setAttribute("aria-expanded", "false");
}

function setBrowseSelection(value) {
  if (!filter || !browseToggleText) {
    return;
  }

  filter.value = value;

  browseOptions.forEach(option => {
    const isSelected = option.dataset.value === value;
    option.classList.toggle("is-selected", isSelected);
    option.setAttribute("aria-selected", String(isSelected));

    if (isSelected) {
      browseToggleText.textContent = option.dataset.label || option.textContent.trim();
    }
  });

  browseToggle.classList.toggle("is-featured", value === "featured");
}

function syncHeaderHeight() {
  if (!header) {
    return;
  }

  document.body.style.setProperty("--header-height", `${header.offsetHeight}px`);
}

function scrollToHeroEnd() {
  if (!musicSection) {
    return;
  }

  const headerHeight = header ? header.offsetHeight : 0;
  const targetTop = Math.max(0, musicSection.offsetTop - headerHeight);

  window.scrollTo({
    top: targetTop,
    behavior: "smooth"
  });
}

function updateHeaderHeroState() {
  if (!header || !heroBanner) {
    return;
  }

  const heroBottom = heroBanner.getBoundingClientRect().bottom;
  header.classList.toggle("is-scrolled-past-hero", heroBottom <= header.offsetHeight);
  syncSubscribeTheme();
}

function syncSubscribeTheme() {
  if (!subscribeMenu) {
    return;
  }

  const useHeroTheme = !!heroBanner && header && header.classList.contains("is-scrolled-past-hero");
  subscribeMenu.classList.toggle("is-hero-theme", useHeroTheme);
}

window.addEventListener("scroll", () => {
  if (window.scrollY > 500) {
    backToTop.classList.add("show");
  } else {
    backToTop.classList.remove("show");
  }

  updateHeaderHeroState();
});

listenNowLink.addEventListener("click", event => {
  event.preventDefault();
  scrollToHeroEnd();
});

backToTop.addEventListener("click", () => {
  scrollToHeroEnd();
});

let releases = [];

function positionSubscribeDropdown() {
  subscribeMenu.style.left = "";
  subscribeMenu.style.right = "";
}

if (logoLink) {
  logoLink.addEventListener("click", event => {
    event.preventDefault();
    window.location.assign("index.html");
  });
}

if (browseToggle && browseMenu) {
  browseToggle.addEventListener("click", () => {
    const willOpen = !browseMenu.classList.contains("show");
    browseMenu.classList.toggle("show", willOpen);
    browseToggle.setAttribute("aria-expanded", String(willOpen));
  });

  browseOptions.forEach(option => {
    option.addEventListener("click", () => {
      const selectedValue = option.dataset.value;

      setBrowseSelection(selectedValue);
      closeBrowseMenu();
      renderAlbums(selectedValue);
    });
  });
}

/* HOME DROPDOWN */

navToggle.addEventListener("click", () => {
  const willOpen = !navMenu.classList.contains("show");

  closeSubscribeMenu();
  navMenu.classList.toggle("show", willOpen);
  setExpandedState(navToggle, willOpen);
});

document.addEventListener("click", (event) => {
  if (!navDropdown.contains(event.target)) {
    closeNavMenu();
  }
});

/* SUBSCRIBE DROPDOWN */

subscribeToggle.addEventListener("click", () => {
  const willOpen = !subscribeMenu.classList.contains("show");

  closeNavMenu();
  syncSubscribeTheme();
  subscribeMenu.classList.toggle("show", willOpen);
  setExpandedState(subscribeToggle, willOpen);

  if (willOpen) {
    positionSubscribeDropdown();
  } 
});

document.addEventListener("click", (event) => {
  if (!subscribeWrapper.contains(event.target)) {
    closeSubscribeMenu();
  }

  if (browseDropdown && !browseDropdown.contains(event.target)) {
    closeBrowseMenu();
  }
});

window.addEventListener("resize", () => {
  syncHeaderHeight();
  updateHeaderHeroState();
  syncSubscribeTheme();

  if (subscribeMenu.classList.contains("show")) {
    positionSubscribeDropdown();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeNavMenu();
    closeSubscribeMenu();
    closeBrowseMenu();
  }
});

/* RELEASES */

function buildAlbums(selectedCategory = "all") {
  grid.innerHTML = "";

  const filtered = releases.filter(release => {
    if (selectedCategory === "featured") {
      return release.featured === true;
    }

    return selectedCategory === "all" || release.category === selectedCategory;
  });

  filtered.forEach(release => {
    const card = document.createElement("a");

    card.href = release.link;
    card.target = "_blank";
    card.rel = "noopener noreferrer";
    card.className = "album-card";

    card.innerHTML = `
      <div class="album-cover-wrapper">
        <img
          src="${release.cover}"
          alt="${release.alt}"
          class="album-cover"
          loading="lazy"
          decoding="async"
        >

        <div class="album-overlay">
          <div class="streaming-overlay-content">
            <div class="streaming-text">Listen on streaming services</div>

            <div class="streaming-icons">
              <i class="fa-brands fa-spotify"></i>
              <i class="fa-brands fa-youtube"></i>
              <i class="fa-brands fa-apple"></i>
              <i class="fa-brands fa-amazon"></i>
              <i class="fa-brands fa-deezer"></i>
              <i class="fa-solid fa-music"></i>
            </div>

            ${
              release.category === "songs"
                ? `
                  <div class="overlay-buttons">
                    ${release.preview ? `<button type="button" class="preview-btn">Preview</button>` : ``}
                    ${release.preview && release.lyricsLink ? `<span class="overlay-divider" aria-hidden="true">|</span>` : ``}
                    ${release.lyricsLink ? `<a href="${release.lyricsLink}" target="_blank" rel="noopener noreferrer" class="lyrics-btn">Lyrics</a>` : ``}
                  </div>
                `
                : release.category === "instrumentals"
                  ? `
                    <div class="overlay-buttons">
                      ${release.preview ? `<button type="button" class="preview-btn">Preview</button>` : ``}
                    </div>
                  `
                  : ``
            }
          </div>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });
}

function renderAlbums(selectedCategory = "all") {
  grid.classList.add("fade");

  setTimeout(() => {
    buildAlbums(selectedCategory);
    grid.classList.remove("fade");
  }, 350);
}

async function loadReleases() {
  try {
    const response = await fetch("releases.json");

    if (!response.ok) {
      throw new Error("Failed to load releases.json");
    }

    releases = await response.json();
    releases.sort((a, b) => new Date(b.date) - new Date(a.date));

    buildAlbums(filter.value);
  } catch (error) {
    console.error("Release loading error:", error);

    grid.innerHTML = `
      <p style="text-align:center;padding:40px;">
        Unable to load releases.
      </p>
    `;
  }
}

syncHeaderHeight();
syncSubscribeTheme();
updateHeaderHeroState();
loadReleases();
