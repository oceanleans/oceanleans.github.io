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
const goDeeperButton = document.getElementById("go-deeper");
const goDeeperButtonIcon = goDeeperButton ? goDeeperButton.querySelector(".section-nav-icon") : null;
const goDeeperButtonText = goDeeperButton ? goDeeperButton.querySelector(".section-nav-text") : null;
const prevAlbumButton = document.getElementById("album-nav-prev");
const nextAlbumButton = document.getElementById("album-nav-next");
const header = document.querySelector("header");
const musicSection = document.getElementById("music-section");
const pageFooter = document.getElementById("page-footer");
const albumCarouselControls = document.querySelector(".album-carousel-controls");
const isHomePage = document.body.classList.contains("home-page");
const SECTION_NAVIGATION_LOCK_MS = 140;
const WHEEL_NAVIGATION_THRESHOLD = 24;
const TOUCH_NAVIGATION_THRESHOLD = 64;
const WHEEL_BUFFER_RESET_MS = 180;
const SECTION_SETTLE_TOLERANCE = 3;
const SECTION_TRANSITION_MAX_MS = 1800;
const HERO_SCROLL_HINT_DURATION_MS = 1100;
const DEFAULT_CATEGORY = "featured";

let releases = [];
let filteredReleases = [];
let currentAlbumIndex = 0;
let currentCategory = DEFAULT_CATEGORY;
let previewAudio = null;
let activePreviewButton = null;
let lastSectionNavigationAt = 0;
let touchStartX = null;
let touchStartY = null;
let wheelNavigationDelta = 0;
let lastWheelDirection = 0;
let wheelBufferResetTimer = null;
let sectionTransitionTargetTop = null;
let sectionTransitionStartedAt = 0;
let sectionTransitionReleaseTimer = null;
let heroScrollHintTimer = null;
const prefetchedAlbumCoverRequests = new Map();
const categoryAlbumIndices = {
  [DEFAULT_CATEGORY]: 0
};

document.documentElement.classList.toggle("home-page-scroll-locked", isHomePage);

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

function getFeaturedOrderValue(release) {
  if (!release || typeof release.featuredOrder !== "number" || Number.isNaN(release.featuredOrder)) {
    return Number.POSITIVE_INFINITY;
  }

  return release.featuredOrder;
}

function sortFeaturedReleases(items) {
  return [...items].sort((a, b) => {
    const orderDifference = getFeaturedOrderValue(a) - getFeaturedOrderValue(b);

    if (orderDifference !== 0) {
      return orderDifference;
    }

    return new Date(b.date) - new Date(a.date);
  });
}

function shouldHideFeaturedReleaseFromCategory(selectedCategory, release) {
  if (!release || release.featured !== true) {
    return false;
  }

  return selectedCategory === "songs" || selectedCategory === "instrumentals";
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
      ? `<a href="${lyricsHref}" target="_blank" rel="noopener noreferrer" class="lyrics-btn">Lyrics</a>`
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

function getMusicSectionTop() {
  if (!musicSection) {
    return 0;
  }

  return Math.max(0, musicSection.getBoundingClientRect().top + window.scrollY);
}

function getFooterTop() {
  if (!pageFooter) {
    return getMusicSectionTop();
  }

  return Math.max(0, pageFooter.getBoundingClientRect().top + window.scrollY);
}

function getSectionStops() {
  const stops = [0];

  if (musicSection) {
    stops.push(getMusicSectionTop());
  }

  if (pageFooter) {
    stops.push(getFooterTop());
  }

  return stops.filter((stop, index, values) => index === 0 || stop > values[index - 1] + 2);
}

function getActiveSectionIndex() {
  const sectionStops = getSectionStops();
  const scrollPosition = window.scrollY;
  let activeIndex = 0;

  for (let index = 0; index < sectionStops.length - 1; index += 1) {
    const boundary = (sectionStops[index] + sectionStops[index + 1]) / 2;

    if (scrollPosition >= boundary) {
      activeIndex = index + 1;
    }
  }

  return activeIndex;
}

function isSectionNavigationLocked() {
  return sectionTransitionTargetTop !== null || Date.now() - lastSectionNavigationAt < SECTION_NAVIGATION_LOCK_MS;
}

function lockSectionNavigation() {
  lastSectionNavigationAt = Date.now();
}

function clearSectionTransitionReleaseTimer() {
  if (sectionTransitionReleaseTimer) {
    window.clearTimeout(sectionTransitionReleaseTimer);
    sectionTransitionReleaseTimer = null;
  }
}

function clearSectionTransitionState() {
  sectionTransitionTargetTop = null;
  sectionTransitionStartedAt = 0;
  clearSectionTransitionReleaseTimer();
}

function checkSectionTransitionRelease() {
  if (sectionTransitionTargetTop === null) {
    return;
  }

  const now = Date.now();
  const hasReachedTarget = Math.abs(window.scrollY - sectionTransitionTargetTop) <= SECTION_SETTLE_TOLERANCE;
  const hasExceededMaxDuration = now - sectionTransitionStartedAt >= SECTION_TRANSITION_MAX_MS;

  if (hasReachedTarget || hasExceededMaxDuration) {
    clearSectionTransitionState();
    return;
  }
}

function scheduleSectionTransitionReleaseCheck(delay = SECTION_TRANSITION_MAX_MS) {
  clearSectionTransitionReleaseTimer();
  sectionTransitionReleaseTimer = window.setTimeout(() => {
    checkSectionTransitionRelease();
  }, delay);
}

function resetWheelNavigationBuffer() {
  wheelNavigationDelta = 0;
  lastWheelDirection = 0;

  if (wheelBufferResetTimer) {
    window.clearTimeout(wheelBufferResetTimer);
    wheelBufferResetTimer = null;
  }
}

function scheduleWheelBufferReset() {
  if (wheelBufferResetTimer) {
    window.clearTimeout(wheelBufferResetTimer);
  }

  wheelBufferResetTimer = window.setTimeout(() => {
    resetWheelNavigationBuffer();
  }, WHEEL_BUFFER_RESET_MS);
}

function normalizeWheelDelta(event) {
  if (!event) {
    return 0;
  }

  if (event.deltaMode === 1) {
    return event.deltaY * 16;
  }

  if (event.deltaMode === 2) {
    return event.deltaY * window.innerHeight;
  }

  return event.deltaY;
}

function jumpToSectionIndex(index, smooth = true) {
  const sectionStops = getSectionStops();

  if (!sectionStops.length) {
    return false;
  }

  const targetIndex = Math.max(0, Math.min(index, sectionStops.length - 1));
  const targetTop = sectionStops[targetIndex];

  resetWheelNavigationBuffer();
  sectionTransitionTargetTop = targetTop;
  sectionTransitionStartedAt = Date.now();
  lockSectionNavigation();
  scheduleSectionTransitionReleaseCheck();
  window.scrollTo({
    top: targetTop,
    behavior: smooth ? "smooth" : "auto"
  });

  return true;
}

function moveSectionLevel(direction, smooth = true) {
  const sectionStops = getSectionStops();
  const currentIndex = getActiveSectionIndex();
  const targetIndex = Math.max(0, Math.min(currentIndex + direction, sectionStops.length - 1));

  if (targetIndex === currentIndex) {
    return false;
  }

  return jumpToSectionIndex(targetIndex, smooth);
}

function isTextInputTarget(target) {
  return Boolean(target && target.closest("input, textarea, select, option, [contenteditable=\"true\"]"));
}

function isKeyboardControlTarget(target) {
  return Boolean(target && target.closest("button, a, input, textarea, select, option, [contenteditable=\"true\"]"));
}

function isOverlayNavigationOpen() {
  return Boolean(
    (navMenu && navMenu.classList.contains("show")) ||
    (subscribeMenu && subscribeMenu.classList.contains("show"))
  );
}

function canUseSectionNavigation(target) {
  return isHomePage && getSectionStops().length > 1 && !isOverlayNavigationOpen() && !isTextInputTarget(target);
}

function handleSectionWheel(event) {
  if (!canUseSectionNavigation(event.target)) {
    return;
  }

  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
    return;
  }

  event.preventDefault();
  triggerHeroScrollHint();
}

function handleSectionTouchStart(event) {
  if (!canUseSectionNavigation(event.target) || event.touches.length !== 1) {
    touchStartX = null;
    touchStartY = null;
    return;
  }

  touchStartX = event.touches[0].clientX;
  touchStartY = event.touches[0].clientY;
}

function handleSectionTouchMove(event) {
  if (!canUseSectionNavigation(event.target)) {
    return;
  }

  if (event.touches.length !== 1 || touchStartX === null || touchStartY === null) {
    return;
  }

  const touch = event.touches[0];
  const deltaX = touch.clientX - touchStartX;
  const deltaY = touch.clientY - touchStartY;

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    return;
  }

  event.preventDefault();
  triggerHeroScrollHint();
}

function clearSectionTouchState() {
  touchStartX = null;
  touchStartY = null;
}

function triggerHeroScrollHint() {
  if (!diveInLink) {
    return;
  }

  if (heroScrollHintTimer) {
    return;
  }

  diveInLink.classList.add("is-scroll-hint");

  heroScrollHintTimer = window.setTimeout(() => {
    diveInLink.classList.remove("is-scroll-hint");
    heroScrollHintTimer = null;
  }, HERO_SCROLL_HINT_DURATION_MS);
}

function handleSectionKeydown(event) {
  if (
    event.defaultPrevented ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    !canUseSectionNavigation(event.target) ||
    isKeyboardControlTarget(event.target)
  ) {
    return;
  }

  const isForwardKey =
    event.key === "ArrowDown" ||
    event.key === "PageDown" ||
    (event.key === " " && !event.shiftKey);
  const isBackwardKey =
    event.key === "ArrowUp" ||
    event.key === "PageUp" ||
    (event.key === " " && event.shiftKey);
  const isHomeKey = event.key === "Home";
  const isEndKey = event.key === "End";

  if (!isForwardKey && !isBackwardKey && !isHomeKey && !isEndKey) {
    return;
  }

  event.preventDefault();
  triggerHeroScrollHint();
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

function updateSectionNavigationVisibility() {
  if (!backToTop && !goDeeperButton) {
    return;
  }

  const sectionStops = getSectionStops();
  const activeSectionIndex = getActiveSectionIndex();
  const lastSectionIndex = Math.max(0, sectionStops.length - 1);
  const isAtBottomSection = activeSectionIndex >= lastSectionIndex && lastSectionIndex > 0;

  if (backToTop) {
    backToTop.classList.toggle("show", activeSectionIndex > 0);
  }

  if (goDeeperButton) {
    goDeeperButton.classList.toggle("show", activeSectionIndex > 0 && !isAtBottomSection);
    goDeeperButton.setAttribute("aria-label", "Go Deeper");
  }

  if (goDeeperButtonText) {
    goDeeperButtonText.textContent = "Go Deeper";
  }

  if (goDeeperButtonIcon) {
    goDeeperButtonIcon.hidden = false;
  }
}

function updateCarouselControls() {
  if (!prevAlbumButton || !nextAlbumButton || !albumCarouselControls) {
    return;
  }

  const hasAlbums = filteredReleases.length > 0;
  const shouldHideControls = filteredReleases.length === 1;

  albumCarouselControls.hidden = shouldHideControls;
  albumCarouselControls.setAttribute("aria-hidden", shouldHideControls ? "true" : "false");
  prevAlbumButton.disabled = !hasAlbums || currentAlbumIndex <= 0;
  nextAlbumButton.disabled = !hasAlbums || currentAlbumIndex >= filteredReleases.length - 1;
}

function updatePageUI() {
  updateHeaderHeroState();
  updateSectionNavigationVisibility();
}

function scrollToMusicSection(smooth = true) {
  return jumpToSectionIndex(1, smooth);
}

function scrollToTop(smooth = true) {
  return jumpToSectionIndex(0, smooth);
}

function scrollToFooter(smooth = true) {
  const sectionStops = getSectionStops();
  return jumpToSectionIndex(sectionStops.length - 1, smooth);
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
  categoryAlbumIndices[currentCategory] = currentAlbumIndex;
  renderCurrentAlbum();
}

function getStoredAlbumIndex(category, totalItems) {
  const savedIndex = categoryAlbumIndices[category];

  if (!Number.isInteger(savedIndex) || savedIndex < 0) {
    return 0;
  }

  if (!Number.isInteger(totalItems) || totalItems <= 0) {
    return 0;
  }

  return Math.min(savedIndex, totalItems - 1);
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

function getFilteredReleases(selectedCategory = DEFAULT_CATEGORY) {
  if (selectedCategory === "featured") {
    return sortFeaturedReleases(releases.filter(release => release.featured === true));
  }

  return releases.filter(release => {
    if (release.category !== selectedCategory) {
      return false;
    }

    return !shouldHideFeaturedReleaseFromCategory(selectedCategory, release);
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
}

function buildAlbums(selectedCategory = DEFAULT_CATEGORY) {
  if (!carousel) {
    return;
  }

  categoryAlbumIndices[currentCategory] = currentAlbumIndex;
  currentCategory = selectedCategory;
  filteredReleases = getFilteredReleases(selectedCategory);
  currentAlbumIndex = getStoredAlbumIndex(selectedCategory, filteredReleases.length);
  renderCurrentAlbum();
}

function renderAlbums(selectedCategory = DEFAULT_CATEGORY) {
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
    buildAlbums(DEFAULT_CATEGORY);
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
      buildAlbums(DEFAULT_CATEGORY);
    }
    return;
  }

  buildAlbums(DEFAULT_CATEGORY);
  warmAlbumCoverCache(releases);
}

function positionSubscribeDropdown() {
  if (!subscribeMenu) {
    return;
  }

  subscribeMenu.style.left = "";
  subscribeMenu.style.right = "";
}

function handleViewportResize() {
  syncViewportHeight();
  syncHeaderHeight();
  updateCarouselControls();
  updatePageUI();

  if (subscribeMenu && subscribeMenu.classList.contains("show")) {
    positionSubscribeDropdown();
  }
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
    moveSectionLevel(-1, true);
  });
}

if (goDeeperButton) {
  goDeeperButton.addEventListener("click", () => {
    moveSectionLevel(1, true);
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
      const selectedValue = button.dataset.category || DEFAULT_CATEGORY;
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

window.addEventListener("resize", handleViewportResize);

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", handleViewportResize);
}

window.addEventListener("scroll", () => {
  if (sectionTransitionTargetTop !== null) {
    checkSectionTransitionRelease();
  }

  updatePageUI();
}, { passive: true });

window.addEventListener("wheel", handleSectionWheel, { passive: false });
window.addEventListener("touchstart", handleSectionTouchStart, { passive: true });
window.addEventListener("touchmove", handleSectionTouchMove, { passive: false });
window.addEventListener("touchend", clearSectionTouchState, { passive: true });
window.addEventListener("touchcancel", clearSectionTouchState, { passive: true });

document.addEventListener("keydown", event => {
  handleSectionKeydown(event);

  if (event.key === "Escape") {
    closeNavMenu();
    closeSubscribeMenu();
  }
});

if (window.ResizeObserver && header) {
  const headerObserver = new ResizeObserver(() => {
    syncHeaderHeight();
    updatePageUI();
  });

  headerObserver.observe(header);
}

window.addEventListener("load", () => {
  syncViewportHeight();
  syncHeaderHeight();
  updatePageUI();
});

syncViewportHeight();
syncHeaderHeight();
setCategorySelection(DEFAULT_CATEGORY);
updatePageUI();
loadReleases();
