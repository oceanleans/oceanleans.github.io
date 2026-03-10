/**
 * 1. MODAL CONTROLS
 * Handles opening the streaming modal and dynamically generating search links
 * for Apple Music and YouTube based on the Spotify album title.
 */
function openStreamingModal(title, art, spotify) {
    const modal = document.getElementById('streaming-modal');
    const modalTitle = document.getElementById('modal-album-title');
    const modalArt = document.getElementById('modal-album-art');
    const linkSpotify = document.getElementById('link-spotify');
    const linkApple = document.getElementById('link-apple');
    const linkYoutube = document.getElementById('link-youtube');

    // Set content from Spotify data
    modalTitle.innerText = title;
    modalArt.src = art;
    linkSpotify.href = spotify;
    
    // Generate fallback search links for Apple and YouTube
    const searchQuery = encodeURIComponent(title);
    linkApple.href = `https://music.apple.com/search?term=${searchQuery}`;
    linkYoutube.href = `https://www.youtube.com/results?search_query=${searchQuery}`;
    
    // Show the modal
    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('streaming-modal').style.display = 'none';
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
        // Request data from your secure backend endpoint
        const response = await fetch('/.netlify/functions/get-releases');
        
        if (!response.ok) {
            throw new Error('Could not reach the Spotify gateway');
        }
        
        const albums = await response.json();

        // Clear placeholder/manual HTML
        grid.innerHTML = '';

        // Build a card for every album returned by Spotify
        albums.forEach(album => {
            const card = document.createElement('div');
            card.className = 'album-card';
            
            // Extract specific data points from the Spotify API object
            const art = album.images[0].url; // The high-res cover
            const title = album.name;
            const spotifyUrl = album.external_urls.spotify;

            // Set the click event to trigger our modal
            card.onclick = () => openStreamingModal(title, art, spotifyUrl);

            card.innerHTML = `
                <div class="album-cover-wrapper">
                    <img src="${art}" alt="${title}" class="album-cover">
                </div>
                <div class="album-info">
                    <h3>${title}</h3>
                    <p>Listen Now</p>
                </div>
            `;
            grid.appendChild(card);
        });

        // Hide the loading spinner once the grid is populated
        if (spinner) spinner.style.display = 'none';

    } catch (error) {
        console.error('Deployment Error:', error);
        
        // Friendly error message for the fan
        if (spinner) {
            spinner.innerHTML = `
                <p style="color: #a57c60;">
                    Something went wrong. Tap "Listen Now" in the banner to visit Spotify directly.
                </p>
            `;
        }
    }
}

/**
 * 3. INITIALIZATION
 * Runs the fetch command as soon as the window finishes loading.
 */
window.onload = fetchLatestReleases;

// Close modal if user clicks outside the content box
window.onclick = function(event) {
    const modal = document.getElementById('streaming-modal');
    if (event.target == modal) {
        closeModal();
    }
}