// MOCKED DATABASE.JS because better-sqlite3 failed to build
const moment = require('moment');

function initializeDatabase() {
  console.log('MOCK DB: Database initialized successfully');
}

function saveSnapshot(tracks) {
  console.log('MOCK DB: saveSnapshot called with', tracks.length, 'tracks');
  // Return a fake snapshot object
  return {
    snapshotId: 1,
    date: moment().format('YYYY-MM-DD'),
    totalTracks: tracks.length
  };
}

function getAllSnapshots() {
  console.log('MOCK DB: getAllSnapshots called');
  return [];
}

function getTracksForSnapshot(snapshotId) {
  console.log('MOCK DB: getTracksForSnapshot called for', snapshotId);
  return [];
}

function getLatestSnapshot() {
  console.log('MOCK DB: getLatestSnapshot called');
  return null;
}

function wasSnapshotTakenToday() {
  // Return true so it doesn't try to save a snapshot on every load
  return true;
}

function isMoreThan24HoursSinceLastSnapshot() {
  return false;
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