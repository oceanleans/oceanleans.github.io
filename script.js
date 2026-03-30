const carousel = document.getElementById("album-grid");
const musicFilterButtons = Array.from(document.querySelectorAll(".music-filter-button"));

const navToggle = document.querySelector(".nav-toggle");
const navMenu = document.querySelector(".nav-dropdown-menu");
const navDropdown = document.querySelector(".nav-dropdown");
const logoLink = document.querySelector(".logo-link");
const diveInLink = document.querySelector(".hero-cta");

const subscribeToggle = document.querySelector(".subscribe-toggle");
const subscribeMenu = document.querySelector(".subscribe-dropdown");
const subscribeWrapper = document.querySelector(".subscribe-wrapper");

const backToTop = document.getElementById("back-to-top");
const prevAlbumButton = document.getElementById("album-nav-prev");
const nextAlbumButton = document.getElementById("album-nav-next");
const header = document.querySelector("header");
const musicSection = document.getElementById("music-section");
const albumViewer = document.querySelector(".album-viewer");
const musicFilterBar = document.querySelector(".music-filter-buttons");
const albumCarouselControls = document.querySelector(".album-carousel-controls");

let releases = [];
let filteredReleases = [];
let currentAlbumIndex = 0;
let previewAudio = null;
let activePreviewButton = null;
let mobileAlbumCenterFrame = 0;
const prefetchedAlbumCoverRequests = new Map();

function cloneReleaseData(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map(release => ({
    ...release,
    streamingLinks:
      release && typeof release.streamingLinks === "object" && release.streamingLinks !== null
        ? { ...release.streamingLinks }
        : {}
  }));
}

function sortReleasesByDate(items) {
  items.sort((a, b) => new Date(b.date) - new Date(a.date));
  return items;
}

function prefetchAlbumCover(src, highPriority = false) {
  if (typeof src !== "string" || !src.trim() || prefetchedAlbumCoverRequests.has(src)) {
    return;
  }

  const image = new Image();
  image.decoding = "async";

  if ("fetchPriority" in image) {
    image.fetchPriority = highPriority ? "high" : "low";
  }

  image.src = src;
  prefetchedAlbumCoverRequests.set(src, image);
}

function prefetchAllAlbumCovers(items) {
  if (!Array.isArray(items) || !items.length) {
    return;
  }

  items.forEach((release, index) => {
    if (!release || typeof release.cover !== "string") {
      return;
    }

    prefetchAlbumCover(release.cover, index < 3);
  });
}

function isExternalLink(href) {
  return /^https?:\/\//i.test(href);
}

const STREAMING_ICON_CONFIG = [
  {
    key: "spotify",
    modifier: "spotify",
    label: "Spotify",
    iconMarkup: `<i class="fa-brands fa-spotify fa-fw" aria-hidden="true"></i>`
  },
  {
    key: "youtube",
    modifier: "youtube",
    label: "YouTube",
    iconMarkup: `<i class="fa-brands fa-youtube fa-fw" aria-hidden="true"></i>`
  },
  {
    key: "appleMusic",
    modifier: "apple-music",
    label: "Apple Music",
    iconMarkup: `<i class="fa-brands fa-itunes-note fa-fw" aria-hidden="true"></i>`
  },
  {
    key: "amazonMusic",
    modifier: "amazon",
    label: "Amazon Music",
    iconMarkup: `<i class="fa-brands fa-amazon fa-fw" aria-hidden="true"></i>`
  },
  {
    key: "deezer",
    modifier: "deezer",
    label: "Deezer",
    iconMarkup: `<i class="fa-brands fa-deezer fa-fw" aria-hidden="true"></i>`
  },
  {
    key: "pandora",
    modifier: "pandora",
    label: "Pandora",
    iconMarkup: `<img src="assets/icons/pandora.svg" alt="" class="streaming-icon-image streaming-icon-image--pandora">`
  }
];

function getStreamingLink(release, key) {
  if (!release || typeof release.streamingLinks !== "object" || release.streamingLinks === null) {
    return "";
  }

  const url = release.streamingLinks[key];
  return typeof url === "string" ? url.trim() : "";
}

function createStreamingIconsMarkup(release) {
  return STREAMING_ICON_CONFIG.map(platform => {
    const url = getStreamingLink(release, platform.key);
    const className = `streaming-icon-badge streaming-icon-badge--${platform.modifier}`;

    if (url) {
      return `
        <a
          href="${url}"
          target="_blank"
          rel="noopener noreferrer"
          class="${className}"
          aria-label="Listen to ${release.title} on ${platform.label}"
        >
          ${platform.iconMarkup}
        </a>
      `;
    }

    return `
      <span class="${className} is-disabled" aria-hidden="true">
        ${platform.iconMarkup}
      </span>
    `;
  }).join("");
}

function createReleaseActionsMarkup(release, className) {
  if (release.category === "songs") {
    const lyricsHref = typeof release.lyricsLink === "string" ? release.lyricsLink.trim() : "";
    const lyricsMarkup = lyricsHref
      ? `<a href="${lyricsHref}"${isExternalLink(lyricsHref) ? ` target="_blank" rel="noopener noreferrer"` : ``} class="lyrics-btn">Lyrics</a>`
      : ``;

    return `
      <div class="${className}">
        ${release.preview ? `<button type="button" class="preview-btn">Preview</button>` : ``}
        ${release.preview && lyricsMarkup ? `<span class="overlay-divider" aria-hidden="true">|</span>` : ``}
        ${lyricsMarkup}
      </div>
    `;
  }

  if (release.category === "instrumentals" && release.preview) {
    return `
      <div class="${className}">
        <button type="button" class="preview-btn">Preview</button>
      </div>
    `;
  }

  return "";
}

function resetPreviewButton(button) {
  if (!button) {
    return;
  }

  button.textContent = "Preview";
  button.classList.remove("is-playing", "is-error");
  button.setAttribute("aria-pressed", "false");
}

function stopActivePreview() {
  if (previewAudio) {
    previewAudio.pause();
    previewAudio.currentTime = 0;
    previewAudio = null;
  }

  resetPreviewButton(activePreviewButton);
  activePreviewButton = null;
}

function handlePreviewEnded(audioInstance) {
  if (previewAudio !== audioInstance) {
    return;
  }

  stopActivePreview();
}

function handlePreviewError(audioInstance) {
  if (previewAudio !== audioInstance) {
    return;
  }

  if (activePreviewButton) {
    activePreviewButton.textContent = "Unavailable";
    activePreviewButton.classList.remove("is-playing");
    activePreviewButton.classList.add("is-error");
    activePreviewButton.setAttribute("aria-pressed", "false");
  }

  if (previewAudio) {
    previewAudio.pause();
    previewAudio = null;
  }

  activePreviewButton = null;
}

async function togglePreview(button) {
  if (!button) {
    return;
  }

  const previewSrc = button.dataset.previewSrc;

  if (!previewSrc) {
    return;
  }

  if (button === activePreviewButton && previewAudio) {
    stopActivePreview();
    return;
  }

  stopActivePreview();

  const audio = new Audio(previewSrc);
  previewAudio = audio;
  activePreviewButton = button;

  button.textContent = "Playing";
  button.classList.remove("is-error");
  button.classList.add("is-playing");
  button.setAttribute("aria-pressed", "true");

  audio.addEventListener("ended", () => {
    handlePreviewEnded(audio);
  });

  audio.addEventListener("error", () => {
    handlePreviewError(audio);
  });

  try {
    await audio.play();
  } catch (error) {
    console.error("Preview playback error:", error);
    handlePreviewError(audio);
  }
}

function setExpandedState(button, isExpanded) {
  if (!button) {
    return;
  }

  button.setAttribute("aria-expanded", String(isExpanded));
  button.classList.toggle("is-open", isExpanded);
}

function closeNavMenu() {
  if (!navMenu || !navToggle) {
    return;
  }

  navMenu.classList.remove("show");
  setExpandedState(navToggle, false);
}

function closeSubscribeMenu() {
  if (!subscribeMenu || !subscribeToggle) {
    return;
  }

  subscribeMenu.classList.remove("show");
  setExpandedState(subscribeToggle, false);
}

function setCategorySelection(value) {
  musicFilterButtons.forEach(button => {
    const isSelected = button.dataset.category === value;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
}

function syncHeaderHeight() {
  if (!header) {
    return;
  }

  document.body.style.setProperty("--header-height", `${header.offsetHeight}px`);
}

function getViewportHeight() {
  if (window.visualViewport && Number.isFinite(window.visualViewport.height)) {
    return window.visualViewport.height;
  }

  return window.innerHeight;
}

function syncViewportHeight() {
  const viewportHeight = getViewportHeight();

  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return;
  }

  document.documentElement.style.setProperty("--app-viewport-height", `${viewportHeight}px`);
}

function clearMobileAlbumViewportCentering() {
  if (!musicSection) {
    return;
  }

  musicSection.style.removeProperty("--album-cover-size");
  musicSection.style.removeProperty("--mobile-album-viewer-offset");
}

function syncMobileAlbumViewportCentering() {
  if (!musicSection || !carousel || !albumViewer || !musicFilterBar || !albumCarouselControls) {
    return;
  }

  if (!window.matchMedia("(max-width: 1100px)").matches) {
    clearMobileAlbumViewportCentering();
    return;
  }

  const activeCard = carousel.querySelector(".album-card");
  const coverWrapper = activeCard ? activeCard.querySelector(".album-cover-wrapper") : null;

  if (!activeCard || !coverWrapper) {
    clearMobileAlbumViewportCentering();
    return;
  }

  const mobileIcons = activeCard.querySelector(".streaming-icons--mobile");
  const mobileActions = activeCard.querySelector(".album-actions--mobile");
  const musicSectionStyles = window.getComputedStyle(musicSection);
  const activeCardStyles = window.getComputedStyle(activeCard);
  const sectionPaddingTop = parseFloat(musicSectionStyles.paddingTop) || 0;
  const sectionPaddingBottom = parseFloat(musicSectionStyles.paddingBottom) || 0;
  const sectionPaddingLeft = parseFloat(musicSectionStyles.paddingLeft) || 0;
  const sectionPaddingRight = parseFloat(musicSectionStyles.paddingRight) || 0;
  const sectionGap = parseFloat(musicSectionStyles.gap) || 0;
  const cardGap = parseFloat(activeCardStyles.gap) || 0;
  const filterHeight = musicFilterBar.offsetHeight;
  const iconsHeight = mobileIcons ? mobileIcons.offsetHeight : 0;
  const actionsHeight = mobileActions ? mobileActions.offsetHeight : 0;
  const navHeight = albumCarouselControls.offsetHeight;
  const sectionHeight = getViewportHeight();
  const maxCoverWidth = Math.max(
    0,
    musicSection.clientWidth - sectionPaddingLeft - sectionPaddingRight
  );
  const topOffsetBeforeCover = sectionPaddingTop + filterHeight + sectionGap + iconsHeight + cardGap;
  const bottomOffsetAfterCover = cardGap + actionsHeight + sectionGap + navHeight + sectionPaddingBottom;
  const availableHalfHeight = Math.min(
    Math.max(0, (sectionHeight / 2) - topOffsetBeforeCover),
    Math.max(0, (sectionHeight / 2) - bottomOffsetAfterCover)
  );
  const coverSize = Math.max(0, Math.min(maxCoverWidth, availableHalfHeight * 2));
  const viewerOffset = (sectionHeight / 2) - (topOffsetBeforeCover + (coverSize / 2));

  musicSection.style.setProperty("--album-cover-size", `${coverSize}px`);
  musicSection.style.setProperty("--mobile-album-viewer-offset", `${viewerOffset}px`);
}

function scheduleMobileAlbumViewportCentering() {
  if (mobileAlbumCenterFrame) {
    cancelAnimationFrame(mobileAlbumCenterFrame);
  }

  mobileAlbumCenterFrame = requestAnimationFrame(() => {
    mobileAlbumCenterFrame = 0;
    syncMobileAlbumViewportCentering();
  });
}

function getMusicSectionTop() {
  if (!musicSection) {
    return 0;
  }

  return Math.max(0, musicSection.getBoundingClientRect().top + window.scrollY);
}

function syncSubscribeTheme() {
  if (!subscribeMenu || !header) {
    return;
  }

  subscribeMenu.classList.toggle("is-hero-theme", header.classList.contains("is-scrolled-past-hero"));
}

function updateHeaderHeroState() {
  if (!header || !musicSection) {
    return;
  }

  const isPastHero = window.scrollY >= getMusicSectionTop() - 2;
  header.classList.toggle("is-scrolled-past-hero", isPastHero);
  document.body.classList.toggle("is-below-surface", isPastHero);
  syncSubscribeTheme();
}

function updateBackToTopVisibility() {
  if (!backToTop) {
    return;
  }

  const showButton = window.scrollY >= getMusicSectionTop() - 2;
  backToTop.classList.toggle("show", Boolean(showButton));
}

function updateCarouselControls() {
  if (!prevAlbumButton || !nextAlbumButton) {
    return;
  }

  const hasAlbums = filteredReleases.length > 0;
  prevAlbumButton.disabled = !hasAlbums || currentAlbumIndex <= 0;
  nextAlbumButton.disabled = !hasAlbums || currentAlbumIndex >= filteredReleases.length - 1;
}

function updatePageUI() {
  updateHeaderHeroState();
  updateBackToTopVisibility();
}

function isPinnedToMusicSection() {
  const musicTop = getMusicSectionTop();
  return Math.abs(window.scrollY - musicTop) <= 2;
}

function scrollToMusicSection(smooth = true) {
  if (!musicSection) {
    return;
  }

  window.scrollTo({
    top: getMusicSectionTop(),
    behavior: smooth ? "smooth" : "auto"
  });
}

function scrollToTop(smooth = true) {
  window.scrollTo({
    top: 0,
    behavior: smooth ? "smooth" : "auto"
  });
}

function resetCarouselToStart(smooth = true) {
  currentAlbumIndex = 0;
  renderCurrentAlbum();
}

function moveCarouselBy(direction) {
  if (!filteredReleases.length) {
    return;
  }

  const nextIndex = Math.min(
    filteredReleases.length - 1,
    Math.max(0, currentAlbumIndex + direction)
  );

  if (nextIndex === currentAlbumIndex) {
    return;
  }

  currentAlbumIndex = nextIndex;
  renderCurrentAlbum();
}

function isInteractionBlocked(target) {
  if (!target) {
    return false;
  }

  return !!target.closest(
    "input, textarea, select, .subscribe-dropdown, .nav-dropdown-menu, .nav-toggle, .subscribe-toggle, .preview-btn, .lyrics-btn, .streaming-icon-badge, .footer-social-link, .footer-policy-link, .music-filter-button"
  );
}

function createAlbumCard(release) {
  const card = document.createElement("div");
  card.className = "album-card";

  card.innerHTML = `
    <div class="streaming-icons streaming-icons--mobile">
      ${createStreamingIconsMarkup(release)}
    </div>

    <div class="album-cover-wrapper">
      <img
        src="${release.cover}"
        alt="${release.alt}"
        class="album-cover"
        loading="eager"
        fetchpriority="high"
        decoding="async"
      >

      <div class="album-overlay">
        <div class="streaming-overlay-content">
          <div class="streaming-icons streaming-icons--overlay">${createStreamingIconsMarkup(release)}</div>
          ${createReleaseActionsMarkup(release, "overlay-buttons album-actions--overlay")}
        </div>
      </div>
    </div>

    ${createReleaseActionsMarkup(release, "album-actions--mobile")}
  `;

  const previewButtons = Array.from(card.querySelectorAll(".preview-btn"));

  previewButtons.forEach(previewButton => {
    if (!release.preview) {
      return;
    }

    previewButton.dataset.previewSrc = release.preview;
    previewButton.setAttribute("aria-label", `Play preview for ${release.title}`);
    previewButton.setAttribute("aria-pressed", "false");

    previewButton.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      togglePreview(previewButton);
    });
  });

  return card;
}

function createAlbumSlide(release) {
  const slide = document.createElement("article");
  slide.className = "album-slide";

  if (release) {
    slide.appendChild(createAlbumCard(release));
    return slide;
  }

  const emptyState = document.createElement("div");
  emptyState.className = "album-empty-state";
  emptyState.textContent = "No releases found in this category.";
  slide.appendChild(emptyState);

  return slide;
}

function getFilteredReleases(selectedCategory = "all") {
  return releases.filter(release => {
    if (selectedCategory === "featured") {
      return release.featured === true;
    }

    return selectedCategory === "all" || release.category === selectedCategory;
  });
}

function renderCurrentAlbum() {
  if (!carousel) {
    return;
  }

  stopActivePreview();
  carousel.innerHTML = "";

  if (filteredReleases.length === 0) {
    carousel.appendChild(createAlbumSlide(null));
    updateCarouselControls();
    updatePageUI();
    return;
  }

  const activeRelease = filteredReleases[currentAlbumIndex];

  if (activeRelease) {
    carousel.appendChild(createAlbumSlide(activeRelease));
  }

  updateCarouselControls();
  updatePageUI();
  scheduleMobileAlbumViewportCentering();
}

function buildAlbums(selectedCategory = "all") {
  if (!carousel) {
    return;
  }

  filteredReleases = getFilteredReleases(selectedCategory);
  currentAlbumIndex = 0;
  renderCurrentAlbum();
}

function renderAlbums(selectedCategory = "all") {
  buildAlbums(selectedCategory);
}

function warmAlbumCoverCache(items) {
  const startWarmup = () => {
    prefetchAllAlbumCovers(items);
  };

  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(startWarmup);
    return;
  }

  window.setTimeout(startWarmup, 0);
}

async function loadReleases() {
  if (!carousel) {
    return;
  }

  const embeddedReleases = cloneReleaseData(window.OCEANLEANS_RELEASES);
  const shouldPreferEmbeddedReleases = window.location.protocol === "file:";

  // Render immediately from embedded data so the first album cover can appear
  // without waiting for an extra network round-trip to releases.json.
  if (embeddedReleases.length) {
    releases = sortReleasesByDate(embeddedReleases);
    buildAlbums("all");
    warmAlbumCoverCache(releases);
  }

  try {
    if (shouldPreferEmbeddedReleases && embeddedReleases.length) {
      return;
    }

    const response = await fetch("releases.json");

    if (!response.ok) {
      throw new Error("Failed to load releases.json");
    }

    releases = await response.json();
    sortReleasesByDate(releases);
  } catch (error) {
    console.error("Release loading error:", error);

    if (!embeddedReleases.length) {
      releases = [];
      buildAlbums("all");
    }
    return;
  }

  buildAlbums("all");
  warmAlbumCoverCache(releases);
}

function positionSubscribeDropdown() {
  if (!subscribeMenu) {
    return;
  }

  subscribeMenu.style.left = "";
  subscribeMenu.style.right = "";
}

if (diveInLink) {
  diveInLink.addEventListener("click", event => {
    event.preventDefault();
    closeNavMenu();
    closeSubscribeMenu();
    scrollToMusicSection(true);
  });
}

if (backToTop) {
  backToTop.addEventListener("click", () => {
    scrollToTop(true);
  });
}

if (prevAlbumButton) {
  prevAlbumButton.addEventListener("click", () => {
    moveCarouselBy(-1);
  });
}

if (nextAlbumButton) {
  nextAlbumButton.addEventListener("click", () => {
    moveCarouselBy(1);
  });
}

if (logoLink) {
  logoLink.addEventListener("click", event => {
    event.preventDefault();

    const path = window.location.pathname;
    const onHomePage = path.endsWith("/index.html") || path === "/" || path === "";

    if (onHomePage) {
      scrollToTop(true);
      return;
    }

    window.location.assign("index.html");
  });
}

if (musicFilterButtons.length) {
  musicFilterButtons.forEach(button => {
    button.addEventListener("click", () => {
      const selectedValue = button.dataset.category || "all";
      setCategorySelection(selectedValue);
      renderAlbums(selectedValue);
    });
  });
}

if (navToggle && navMenu) {
  navToggle.addEventListener("click", () => {
    const willOpen = !navMenu.classList.contains("show");
    closeSubscribeMenu();
    navMenu.classList.toggle("show", willOpen);
    setExpandedState(navToggle, willOpen);
  });
}

document.addEventListener("click", event => {
  if (navDropdown && !navDropdown.contains(event.target)) {
    closeNavMenu();
  }

  if (subscribeWrapper && !subscribeWrapper.contains(event.target)) {
    closeSubscribeMenu();
  }
});

if (subscribeToggle && subscribeMenu) {
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
}

window.addEventListener("resize", () => {
  const shouldPinMusicPage = isPinnedToMusicSection();

  syncViewportHeight();
  syncHeaderHeight();
  updateCarouselControls();
  updatePageUI();
  scheduleMobileAlbumViewportCentering();

  if (subscribeMenu && subscribeMenu.classList.contains("show")) {
    positionSubscribeDropdown();
  }

  if (shouldPinMusicPage) {
    requestAnimationFrame(() => {
      scrollToMusicSection(false);
    });
  }
});

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => {
    const shouldPinMusicPage = isPinnedToMusicSection();

    syncViewportHeight();
    syncHeaderHeight();
    updateCarouselControls();
    updatePageUI();
    scheduleMobileAlbumViewportCentering();

    if (shouldPinMusicPage) {
      requestAnimationFrame(() => {
        scrollToMusicSection(false);
      });
    }
  });
}

window.addEventListener("scroll", () => {
  updatePageUI();
}, { passive: true });

document.addEventListener("keydown", event => {
  const targetTag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : "";

  if (event.key === "Escape") {
    closeNavMenu();
    closeSubscribeMenu();
    return;
  }

  if (["input", "textarea", "select"].includes(targetTag) || isInteractionBlocked(event.target)) {
    return;
  }

  if (window.scrollY < getMusicSectionTop() - 2 && ["ArrowDown", "PageDown", " "].includes(event.key)) {
    event.preventDefault();
    scrollToMusicSection(true);
    return;
  }

  if (event.key === "Home") {
    event.preventDefault();
    resetCarouselToStart(false);
    scrollToTop(true);
  }
});

if (window.ResizeObserver && header) {
  const headerObserver = new ResizeObserver(() => {
    syncHeaderHeight();
    updatePageUI();
    scheduleMobileAlbumViewportCentering();
  });

  headerObserver.observe(header);
}

window.addEventListener("load", () => {
  syncViewportHeight();
  syncHeaderHeight();
  updatePageUI();
  scheduleMobileAlbumViewportCentering();
});

syncViewportHeight();
syncHeaderHeight();
setCategorySelection("all");
updatePageUI();
scheduleMobileAlbumViewportCentering();
loadReleases();
