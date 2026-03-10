// 1. This is your "Database". When you have a new song, just add it here.
const releases = [
    {
        title: "Song Title",
        art: "images/album1.jpg",
        spotify: "https://open.spotify.com/...",
        apple: "https://music.apple.com/...",
        youtube: "https://youtube.com/..."
    },
    {
        title: "Project Name",
        art: "images/album2.jpg",
        spotify: "https://open.spotify.com/...",
        apple: "https://music.apple.com/...",
        youtube: "https://youtube.com/..."
    }
];

// 2. This function automatically builds your HTML grid
function displayReleases() {
    const grid = document.getElementById('dynamic-album-grid');
    grid.innerHTML = ''; // Clear existing content

    releases.forEach(release => {
        const card = document.createElement('div');
        card.className = 'album-card';
        
        // When clicked, it passes the data to your modal function
        card.onclick = () => openStreamingModal(
            release.title, 
            release.art, 
            release.spotify, 
            release.apple,
            release.youtube
        );

        card.innerHTML = `
            <div class="album-cover-wrapper">
                <img src="${release.art}" alt="${release.title}" class="album-cover">
            </div>
            <div class="album-info">
                <h3>${release.title}</h3>
                <p>Listen Now</p>
            </div>
        `;
        grid.appendChild(card);
    });
}

// 3. Updated Modal Function to include YouTube
function openStreamingModal(title, art, spotify, apple, youtube) {
    document.getElementById('modal-album-title').innerText = title;
    document.getElementById('modal-album-art').src = art;
    document.getElementById('link-spotify').href = spotify || '#';
    document.getElementById('link-apple').href = apple || '#';
    document.getElementById('link-youtube').href = youtube || '#';
    document.getElementById('streaming-modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('streaming-modal').style.display = 'none';
}

// Run the grid builder when the page loads
window.onload = displayReleases;
