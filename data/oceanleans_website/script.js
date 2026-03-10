const STREAMING_LINK_LABELS = {
    spotify: 'Spotify',
    appleMusic: 'Apple Music',
    youtube: 'YouTube',
    youtubeMusic: 'YouTube Music',
    soundcloud: 'SoundCloud',
    tidal: 'TIDAL',
    deezer: 'Deezer',
    amazonStore: 'Amazon Music',
    pandora: 'Pandora',
    napster: 'Napster'
};

function closeModal() {
    document.getElementById('streaming-modal').style.display = 'none';
}

function buildFallbackLinks(albumTitle, spotifyUrl) {
    const searchQuery = encodeURIComponent(albumTitle);
    return [
        { label: 'Spotify', url: spotifyUrl },
        { label: 'Apple Music', url: `https://music.apple.com/search?term=${searchQuery}` },
        { label: 'YouTube', url: `https://www.youtube.com/results?search_query=${searchQuery}` }
    ];
}

function renderStreamingLinks(links) {
    const linksContainer = document.getElementById('modal-streaming-links');
    linksContainer.innerHTML = '';

    links.forEach(link => {
        const anchor = document.createElement('a');
        anchor.href = link.url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.className = 'stream-link';
        anchor.innerText = link.label;
        linksContainer.appendChild(anchor);
    });
}

async function fetchStreamingLinks(spotifyUrl, albumTitle) {
    if (!spotifyUrl || spotifyUrl === '#') {
        return buildFallbackLinks(albumTitle, spotifyUrl);
    }

    try {
        const response = await fetch(`https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(spotifyUrl)}`);
        if (!response.ok) {
            throw new Error('Could not load streaming links');
        }

        const data = await response.json();
        const linksByPlatform = data.linksByPlatform || {};

        const dynamicLinks = Object.entries(linksByPlatform)
            .map(([platform, details]) => ({
                label: STREAMING_LINK_LABELS[platform] || platform,
                url: details?.url
            }))
            .filter(link => link.url);

        return dynamicLinks.length > 0 ? dynamicLinks : buildFallbackLinks(albumTitle, spotifyUrl);
    } catch (error) {
        console.warn('Could not fetch streaming links:', error);
        return buildFallbackLinks(albumTitle, spotifyUrl);
    }
}

/**
 * 1. MODAL CONTROLS
 * Opens the streaming modal and fetches platform links for the selected release.
 */
async function openStreamingModal(title, art, spotify) {
    const modal = document.getElementById('streaming-modal');
    const modalTitle = document.getElementById('modal-album-title');
    const modalArt = document.getElementById('modal-album-art');
    const linksContainer = document.getElementById('modal-streaming-links');

    modalTitle.innerText = title;
    modalArt.src = art;

    linksContainer.innerHTML = '<p>Loading platforms...</p>';
    modal.style.display = 'flex';

    const links = await fetchStreamingLinks(spotify, title);
    renderStreamingLinks(links);
}

/**
 * 2. DATA FETCHING ENGINE (The "Brain")
 * Connects to your Netlify serverless function to get Spotify data
 * without exposing your Client Secret to the browser.
 */
async function fetchLatestReleases() {
    const grid = document.getElementById('dynamic-album-grid');
    const spinner = document.getElementById('loading-spinner');

    try {
        const response = await fetch('/.netlify/functions/get-releases');

        if (!response.ok) {
            throw new Error('Could not reach the Spotify gateway');
        }

        const albums = await response.json();
        grid.innerHTML = '';

        albums.forEach(album => {
            const card = document.createElement('div');
            card.className = 'album-card';

            const art = album.images && album.images[0] ? album.images[0].url : '/images/fallback-cover.jpg';
            const title = album.name || 'Untitled';
            const spotifyUrl = album.external_urls?.spotify || '#';

            card.onclick = () => openStreamingModal(title, art, spotifyUrl);

            card.innerHTML = `
                <div class="album-cover-wrapper">
                    <img src="${art}" alt="${title}" class="album-cover">
                </div>
                <div class="album-info">
                    <h3>${title}</h3>
                    <p>Tap cover for all streaming platforms</p>
                </div>
            `;
            grid.appendChild(card);
        });

        if (spinner) spinner.style.display = 'none';
    } catch (error) {
        console.error('Deployment Error:', error);

        if (spinner) {
            spinner.innerHTML = `
                <p style="color: #a57c60;">
                    Something went wrong. Tap "Listen Now" in the banner to visit Spotify directly.
                </p>
            `;
        }
    }
}

window.onload = () => {
    fetchLatestReleases();
    setInterval(fetchLatestReleases, 10 * 60 * 1000);
};

window.onclick = function(event) {
    const modal = document.getElementById('streaming-modal');
    if (event.target == modal) {
        closeModal();
    }
};