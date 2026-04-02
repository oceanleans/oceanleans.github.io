const fs = require("fs");
const path = require("path");

const rootDir = process.cwd();
const releasesJsonPath = path.join(rootDir, "releases.json");
const releasesDataJsPath = path.join(rootDir, "releases-data.js");
const lyricsHtmlPath = path.join(rootDir, "lyrics.html");

function slugifyTitle(title) {
  return String(title || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeFile(filePath, contents) {
  fs.writeFileSync(filePath, contents, "utf8");
}

function extractExistingLyricsBodies(html) {
  const lyricsBodies = new Map();
  const sectionPattern =
    /<section class="lyrics-song" id="([^"]+)"[\s\S]*?<div class="lyrics-text">\s*([\s\S]*?)\s*<\/div>\s*<\/section>/g;

  let match = sectionPattern.exec(html);

  while (match) {
    lyricsBodies.set(match[1], match[2].trim());
    match = sectionPattern.exec(html);
  }

  return lyricsBodies;
}

function indentMultilineBlock(block, spaces) {
  const indent = " ".repeat(spaces);

  return block
    .split("\n")
    .map(line => `${indent}${line}`.trimEnd())
    .join("\n");
}

function buildLyricsNav(songs) {
  const links = songs
    .map(song => `        <a href="#${slugifyTitle(song.title)}" class="lyrics-jump-link">${escapeHtml(song.title)}</a>`)
    .join("\n");

  return [
    "      <!-- AUTO-LYRICS-NAV:START -->",
    '      <nav class="lyrics-jump-nav" aria-label="Jump to songs">',
    links,
    "      </nav>",
    "      <!-- AUTO-LYRICS-NAV:END -->"
  ].join("\n");
}

function buildLyricsSections(songs, existingLyricsBodies) {
  const sections = songs.map(song => {
    const slug = slugifyTitle(song.title);
    const lyricsBody =
      existingLyricsBodies.get(slug) || '<p class="lyrics-placeholder">Lyrics coming soon.</p>';

    return [
      `      <section class="lyrics-song" id="${slug}" aria-labelledby="${slug}-title">`,
      `        <h2 id="${slug}-title">${escapeHtml(song.title)}</h2>`,
      '        <div class="lyrics-text">',
      indentMultilineBlock(lyricsBody, 10),
      "        </div>",
      "      </section>"
    ].join("\n");
  });

  return [
    "      <!-- AUTO-LYRICS-SECTIONS:START -->",
    sections.join("\n\n"),
    "      <!-- AUTO-LYRICS-SECTIONS:END -->"
  ].join("\n");
}

function replaceAutoBlock(html, startMarker, endMarker, replacement) {
  const escapedStart = startMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedEnd = endMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\n[ \\t]*${escapedStart}[\\s\\S]*?${escapedEnd}`);

  return html.replace(pattern, `\n${replacement}`);
}

function syncLyricsHtml(releases) {
  let html = fs.readFileSync(lyricsHtmlPath, "utf8");
  const songs = releases.filter(release => release.category === "songs");
  const existingLyricsBodies = extractExistingLyricsBodies(html);
  const navBlock = buildLyricsNav(songs);
  const sectionsBlock = buildLyricsSections(songs, existingLyricsBodies);
  const navStartMarker = "<!-- AUTO-LYRICS-NAV:START -->";
  const navEndMarker = "<!-- AUTO-LYRICS-NAV:END -->";
  const sectionsStartMarker = "<!-- AUTO-LYRICS-SECTIONS:START -->";
  const sectionsEndMarker = "<!-- AUTO-LYRICS-SECTIONS:END -->";

  if (html.includes(navStartMarker) && html.includes(navEndMarker)) {
    html = replaceAutoBlock(html, navStartMarker, navEndMarker, navBlock);
  } else {
    html = html.replace(/\n\s*<nav class="lyrics-jump-nav"[\s\S]*?<\/nav>/, `\n${navBlock}`);
  }

  if (html.includes(sectionsStartMarker) && html.includes(sectionsEndMarker)) {
    html = replaceAutoBlock(html, sectionsStartMarker, sectionsEndMarker, sectionsBlock);
  } else {
    html = html.replace(/\n\s*<section class="lyrics-song" id="[^"]+"[\s\S]*?<\/section>\s*/g, "\n");
    html = html.replace(/(\n\s*<\/section>\s*\n\s*<\/main>)/, `\n${sectionsBlock}\n$1`);
  }

  writeFile(lyricsHtmlPath, html);
}

function syncReleases() {
  const releases = readJson(releasesJsonPath).map(release => {
    if (release.category !== "songs") {
      return release;
    }

    return {
      ...release,
      lyricsLink: `lyrics.html#${slugifyTitle(release.title)}`
    };
  });

  writeFile(releasesJsonPath, `${JSON.stringify(releases, null, 2)}\n`);

  const releasesDataFile = [
    "// Local fallback release data for environments where fetching JSON is blocked.",
    "// Keep this file in sync with releases.json.",
    `window.OCEANLEANS_RELEASES = ${JSON.stringify(releases, null, 2)};`,
    ""
  ].join("\n");

  writeFile(releasesDataJsPath, releasesDataFile);
  syncLyricsHtml(releases);
}

syncReleases();
