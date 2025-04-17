const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const moment = require('moment');

// Ensure the data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Initialize the database
const db = new Database(path.join(dataDir, 'spotify_tracks.db'));

// Initialize the database schema
function initializeDatabase() {
  // Create snapshots table
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      total_tracks INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create tracks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      snapshot_id INTEGER,
      name TEXT NOT NULL,
      artist TEXT NOT NULL,
      album TEXT NOT NULL,
      album_image TEXT,
      added_at TEXT NOT NULL,
      spotify_url TEXT NOT NULL,
      preview_url TEXT,
      FOREIGN KEY (snapshot_id) REFERENCES snapshots(id)
    )
  `);

  console.log('Database initialized successfully');
}

// Save a new snapshot of tracks
function saveSnapshot(tracks) {
  const date = moment().format('YYYY-MM-DD');
  const totalTracks = tracks.length;
  
  // Begin transaction
  const transaction = db.transaction(() => {
    // Insert snapshot
    const insertSnapshot = db.prepare(`
      INSERT INTO snapshots (date, total_tracks)
      VALUES (?, ?)
    `);
    
    const snapshotResult = insertSnapshot.run(date, totalTracks);
    const snapshotId = snapshotResult.lastInsertRowid;
    
    // Insert tracks
    const insertTrack = db.prepare(`
      INSERT INTO tracks (
        id, snapshot_id, name, artist, album, 
        album_image, added_at, spotify_url, preview_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const track of tracks) {
      const trackItem = track.track;
      const artistNames = trackItem.artists.map(artist => artist.name).join(', ');
      const albumImage = trackItem.album.images.length > 0 ? trackItem.album.images[0].url : null;
      
      insertTrack.run(
        trackItem.id,
        snapshotId,
        trackItem.name,
        artistNames,
        trackItem.album.name,
        albumImage,
        track.added_at,
        trackItem.external_urls.spotify,
        trackItem.preview_url
      );
    }
    
    return { snapshotId, date, totalTracks };
  });
  
  // Execute transaction
  return transaction();
}

// Get all snapshots
function getAllSnapshots() {
  const query = db.prepare(`
    SELECT id, date, total_tracks, created_at
    FROM snapshots
    ORDER BY date DESC
  `);
  
  return query.all();
}

// Get tracks for a specific snapshot
function getTracksForSnapshot(snapshotId) {
  const query = db.prepare(`
    SELECT * FROM tracks
    WHERE snapshot_id = ?
    ORDER BY added_at DESC
  `);
  
  return query.all(snapshotId);
}

// Get the latest snapshot
function getLatestSnapshot() {
  const query = db.prepare(`
    SELECT id, date, total_tracks, created_at
    FROM snapshots
    ORDER BY date DESC
    LIMIT 1
  `);
  
  return query.get();
}

// Check if a snapshot was taken today
function wasSnapshotTakenToday() {
  const today = moment().format('YYYY-MM-DD');
  
  const query = db.prepare(`
    SELECT COUNT(*) as count
    FROM snapshots
    WHERE date = ?
  `);
  
  const result = query.get(today);
  return result.count > 0;
}

// Check if it's been more than 24 hours since the last snapshot
function isMoreThan24HoursSinceLastSnapshot() {
  const latestSnapshot = getLatestSnapshot();
  
  if (!latestSnapshot) {
    return true;
  }
  
  const lastSnapshotDate = moment(latestSnapshot.created_at);
  const now = moment();
  const hoursDiff = now.diff(lastSnapshotDate, 'hours');
  
  return hoursDiff >= 24;
}

module.exports = {
  initializeDatabase,
  saveSnapshot,
  getAllSnapshots,
  getTracksForSnapshot,
  getLatestSnapshot,
  wasSnapshotTakenToday,
  isMoreThan24HoursSinceLastSnapshot
};