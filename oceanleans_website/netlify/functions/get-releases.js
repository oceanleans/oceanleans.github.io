const axios = require('axios');
const qs = require('qs');

exports.handler = async function(event, context) {
    // 1. Get your secrets from Netlify Environment Variables
    const client_id = process.env.SPOTIFY_CLIENT_ID;
    const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
    const artist_id = process.env.SPOTIFY_ARTIST_ID;

    try {
        // 2. Ask Spotify for an Access Token (Logging In)
        const tokenResponse = await axios({
            method: 'post',
            url: 'https://accounts.spotify.com/api/token',
            data: qs.stringify({ grant_type: 'client_credentials' }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64')
            }
        });

        const accessToken = tokenResponse.data.access_token;

        // 3. Use that Token to get your Albums
        const artistResponse = await axios({
            method: 'get',
            url: `https://api.spotify.com/v1/artists/${artist_id}/albums?include_groups=album,single&market=AU&limit=10`,
            headers: { 'Authorization': 'Bearer ' + accessToken }
        });

        // 4. Send the list of albums back to your website
        return {
            statusCode: 200,
            body: JSON.stringify(artistResponse.data.items)
        };

    } catch (error) {
        console.error('Spotify API Error:', error.response ? error.response.data : error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch from Spotify' })
        };
    }
};