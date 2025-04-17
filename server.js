require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const querystring = require('querystring');
const schedule = require('node-schedule');
const moment = require('moment');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 51912;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Generate a random string for state parameter
const generateRandomString = (length) => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Login route to initiate Spotify authorization
app.get('/login', (req, res) => {
  const state = generateRandomString(16);
  const scope = 'user-library-read user-read-private user-read-email';

  console.log('Redirecting to Spotify authorization with:');
  console.log('Client ID:', CLIENT_ID);
  console.log('Redirect URI:', REDIRECT_URI);
  
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: CLIENT_ID,
      scope: scope,
      redirect_uri: REDIRECT_URI,
      state: state,
      show_dialog: true
    }));
});

// Callback route after Spotify authorization
app.get('/callback', async (req, res) => {
  console.log('Received callback from Spotify');
  const code = req.query.code || null;
  const state = req.query.state || null;
  const error = req.query.error || null;

  if (error) {
    console.error('Error returned from Spotify:', error);
    res.redirect('/#' +
      querystring.stringify({
        error: error
      }));
    return;
  }

  if (state === null) {
    console.error('State mismatch in callback');
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
    return;
  }

  try {
    console.log('Received code from Spotify, attempting to exchange for token');
    console.log('Redirect URI being used:', REDIRECT_URI);
    
    // Exchange authorization code for access token
    const tokenResponse = await axios({
      method: 'post',
      url: 'https://accounts.spotify.com/api/token',
      data: querystring.stringify({
        code: code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      }),
      headers: {
        'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log('Successfully obtained token from Spotify');
    const { access_token, refresh_token } = tokenResponse.data;
    
    // Redirect to the frontend with tokens as URL parameters
    res.redirect('/#' +
      querystring.stringify({
        access_token: access_token,
        refresh_token: refresh_token
      }));
  } catch (error) {
    console.error('Error exchanging code for token:', error.message);
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
    }
    res.redirect('/#' +
      querystring.stringify({
        error: 'invalid_token'
      }));
  }
});

// Helper function to fetch all liked tracks with pagination
async function fetchAllLikedTracks(access_token) {
  let allTracks = [];
  let nextUrl = 'https://api.spotify.com/v1/me/tracks?limit=50';
  
  while (nextUrl) {
    try {
      const response = await axios.get(nextUrl, {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      });
      
      allTracks = [...allTracks, ...response.data.items];
      console.log(`Fetched ${response.data.items.length} tracks, total so far: ${allTracks.length}`);
      
      // Check if there are more tracks to fetch
      nextUrl = response.data.next;
    } catch (error) {
      console.error('Error fetching tracks:', error.message);
      throw error;
    }
  }
  
  return allTracks;
}

// API endpoint to get user's liked tracks
app.get('/api/liked-tracks', async (req, res) => {
  console.log('Received request to /api/liked-tracks');
  const { access_token, snapshot_id } = req.query;
  
  if (!access_token && !snapshot_id) {
    console.error('No access token or snapshot ID provided');
    return res.status(401).json({ error: 'Access token or snapshot ID is required' });
  }

  // If snapshot_id is provided, return tracks from the database
  if (snapshot_id) {
    try {
      const tracks = db.getTracksForSnapshot(snapshot_id);
      return res.json({ items: tracks, total: tracks.length });
    } catch (error) {
      console.error('Error fetching tracks from database:', error.message);
      return res.status(500).json({ error: 'Failed to fetch tracks from database' });
    }
  }

  // Otherwise, fetch tracks from Spotify API
  try {
    console.log('Fetching all liked tracks from Spotify API');
    const allTracks = await fetchAllLikedTracks(access_token);
    
    console.log(`Successfully fetched all liked tracks: ${allTracks.length} tracks`);
    
    // Check if we should save a snapshot
    const shouldSaveSnapshot = db.isMoreThan24HoursSinceLastSnapshot() || !db.wasSnapshotTakenToday();
    
    if (shouldSaveSnapshot) {
      console.log('Saving new snapshot of tracks');
      const snapshot = db.saveSnapshot(allTracks);
      console.log(`Saved snapshot #${snapshot.snapshotId} with ${snapshot.totalTracks} tracks`);
    } else {
      console.log('Skipping snapshot, already taken today or less than 24 hours since last one');
    }
    
    res.json({ items: allTracks, total: allTracks.length });
  } catch (error) {
    console.error('Error fetching liked tracks:', error.message);
    
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', JSON.stringify(error.response.data));
      
      // Return the actual error from Spotify
      return res.status(error.response.status).json({
        error: 'Failed to fetch liked tracks',
        spotify_error: error.response.data
      });
    }
    
    res.status(500).json({ error: 'Failed to fetch liked tracks' });
  }
});

// API endpoint to get all snapshots
app.get('/api/snapshots', (req, res) => {
  try {
    const snapshots = db.getAllSnapshots();
    res.json(snapshots);
  } catch (error) {
    console.error('Error fetching snapshots:', error.message);
    res.status(500).json({ error: 'Failed to fetch snapshots' });
  }
});

// Initialize the database
db.initializeDatabase();

// Function to refresh token using refresh token
async function refreshAccessToken(refresh_token) {
  try {
    const response = await axios({
      method: 'post',
      url: 'https://accounts.spotify.com/api/token',
      data: querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token: refresh_token
      }),
      headers: {
        'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    return response.data.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error.message);
    return null;
  }
}

// Store the latest refresh token
let latestRefreshToken = null;

// Function to capture refresh token
app.post('/api/store-refresh-token', (req, res) => {
  const { refresh_token } = req.body;
  
  if (!refresh_token) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }
  
  latestRefreshToken = refresh_token;
  console.log('Stored refresh token for scheduled updates');
  res.json({ success: true });
});

// Schedule a job to run every 24 hours to update the snapshot
const scheduledJob = schedule.scheduleJob('0 0 * * *', async () => {
  console.log('Running scheduled snapshot update');
  
  if (!latestRefreshToken) {
    console.log('No refresh token available, skipping scheduled update');
    return;
  }
  
  try {
    // Refresh the access token
    const access_token = await refreshAccessToken(latestRefreshToken);
    
    if (!access_token) {
      console.log('Failed to refresh access token, skipping scheduled update');
      return;
    }
    
    // Fetch all tracks
    const allTracks = await fetchAllLikedTracks(access_token);
    console.log(`Scheduled update: Fetched ${allTracks.length} tracks`);
    
    // Save a new snapshot
    const snapshot = db.saveSnapshot(allTracks);
    console.log(`Scheduled update: Saved snapshot #${snapshot.snapshotId} with ${snapshot.totalTracks} tracks`);
  } catch (error) {
    console.error('Error in scheduled update:', error.message);
  }
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Scheduled job will run at midnight every day`);
});