document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const loginSection = document.getElementById('login-section');
  const tracksSection = document.getElementById('tracks-section');
  const tracksContainer = document.getElementById('tracks-container');
  const userProfile = document.getElementById('user-profile');
  const userInfo = document.getElementById('user-info');
  const loadingIndicator = document.getElementById('loading');
  const totalTracksElement = document.getElementById('total-tracks').querySelector('span');
  const lastUpdatedElement = document.getElementById('last-updated').querySelector('span');
  const snapshotsTabContainer = document.getElementById('snapshots-tab-container');
  const snapshotTabsContent = document.getElementById('snapshot-tabs-content');
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const sortSelect = document.getElementById('sort-select');
  const audioPlayer = document.getElementById('audio-player');
  const audioElement = document.getElementById('audio-element');
  const playerImg = document.getElementById('player-img');
  const playerTrackName = document.getElementById('player-track-name');
  const playerArtistName = document.getElementById('player-artist-name');

  // State
  let currentTracks = [];
  let filteredTracks = [];
  let currentSort = 'date-desc';
  let currentSearchTerm = '';
  let snapshots = [];
  let activeTab = 'current';

  // Parse hash from URL
  const getHashParams = () => {
    const hashParams = {};
    let e, r = /([^&;=]+)=?([^&;]*)/g,
        q = window.location.hash.substring(1);
    
    while (e = r.exec(q)) {
      hashParams[e[1]] = decodeURIComponent(e[2]);
    }
    
    return hashParams;
  };
  
  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get tokens from URL hash
  const params = getHashParams();
  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;
  const error = params.error;
  
  console.log('URL hash params:', params);
  console.log('Access token:', accessToken ? 'Present (not shown for security)' : 'Missing');
  console.log('Refresh token:', refreshToken ? 'Present (not shown for security)' : 'Missing');
  console.log('Error:', error || 'None');

  // Handle errors
  if (error) {
    let errorMessage = 'There was an error during the authentication';
    
    if (error === 'access_denied') {
      errorMessage = 'You denied access to Spotify. Please try again and approve the permissions.';
    } else if (error === 'invalid_token') {
      errorMessage = 'Failed to get access token. Please try again.';
    } else if (error === 'state_mismatch') {
      errorMessage = 'State verification failed. Please try again.';
    } else {
      errorMessage = `Authentication error: ${error}`;
    }
    
    alert(errorMessage);
    console.error('Authentication error:', error);
    
    // Add error message to the page
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = errorMessage;
    loginSection.prepend(errorDiv);
  }

  // If we have an access token, fetch user data and liked tracks
  if (accessToken) {
    // Show tracks section and hide login section
    loginSection.classList.add('hidden');
    tracksSection.classList.remove('hidden');
    userProfile.classList.remove('hidden');
    
    // Store refresh token for scheduled updates
    if (refreshToken) {
      storeRefreshToken(refreshToken);
    }
    
    // Fetch user profile
    fetchUserProfile(accessToken);
    
    // Fetch snapshots
    fetchSnapshots();
    
    // Fetch liked tracks
    fetchLikedTracks(accessToken);
  }
  
  // Store refresh token for scheduled updates
  async function storeRefreshToken(token) {
    try {
      await fetch('/api/store-refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: token })
      });
      console.log('Refresh token stored for scheduled updates');
    } catch (error) {
      console.error('Error storing refresh token:', error);
    }
  }

  // Fetch user profile from Spotify API
  async function fetchUserProfile(token) {
    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }
      
      const data = await response.json();
      displayUserProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  }

  // Display user profile
  function displayUserProfile(user) {
    const profileImage = user.images && user.images.length > 0 ? user.images[0].url : 'https://via.placeholder.com/40';
    const displayName = user.display_name || 'Spotify User';
    
    userInfo.innerHTML = `
      <img src="${profileImage}" alt="Profile" class="user-image">
      <span class="user-name">${displayName}</span>
    `;
  }
  
  // Fetch snapshots from our server
  async function fetchSnapshots() {
    try {
      const response = await fetch('/api/snapshots');
      
      if (!response.ok) {
        throw new Error('Failed to fetch snapshots');
      }
      
      snapshots = await response.json();
      displaySnapshots(snapshots);
    } catch (error) {
      console.error('Error fetching snapshots:', error);
    }
  }

  // Display snapshots as tabs
  function displaySnapshots(snapshots) {
    if (!snapshots || snapshots.length === 0) {
      return;
    }
    
    // Update last updated date
    const latestSnapshot = snapshots[0];
    lastUpdatedElement.textContent = formatDate(latestSnapshot.created_at);
    
    // Create tabs for each snapshot
    snapshotsTabContainer.innerHTML = '';
    snapshotTabsContent.innerHTML = '';
    
    snapshots.forEach(snapshot => {
      // Create tab
      const tab = document.createElement('div');
      tab.className = 'tab';
      tab.dataset.tab = `snapshot-${snapshot.id}`;
      tab.dataset.snapshotId = snapshot.id;
      tab.textContent = `${formatDate(snapshot.date)} (${snapshot.total_tracks})`;
      
      // Create tab content
      const tabContent = document.createElement('div');
      tabContent.className = 'tab-content';
      tabContent.id = `snapshot-${snapshot.id}-tab`;
      tabContent.innerHTML = `
        <div class="snapshot-info">
          <h3>Library Snapshot: ${formatDate(snapshot.date)}</h3>
          <p>Total tracks: ${snapshot.total_tracks}</p>
        </div>
        <div class="tracks-list-header">
          <div class="track-number">#</div>
          <div class="track-info-header">TRACK</div>
          <div class="track-album">ALBUM</div>
          <div class="track-date-added">DATE ADDED</div>
          <div class="track-actions"></div>
        </div>
        <div id="snapshot-${snapshot.id}-tracks" class="snapshot-tracks-container"></div>
        <div id="snapshot-${snapshot.id}-loading" class="loading hidden">
          <div class="spinner"></div>
          <p>Loading snapshot tracks...</p>
        </div>
      `;
      
      // Add event listener to tab
      tab.addEventListener('click', () => {
        // Remove active class from all tabs and tab contents
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        // Add active class to clicked tab and its content
        tab.classList.add('active');
        tabContent.classList.add('active');
        
        // Set active tab
        activeTab = `snapshot-${snapshot.id}`;
        
        // Fetch tracks for this snapshot if not already loaded
        const tracksContainer = document.getElementById(`snapshot-${snapshot.id}-tracks`);
        if (tracksContainer.children.length === 0) {
          fetchSnapshotTracks(snapshot.id);
        }
      });
      
      // Add tab and tab content to DOM
      snapshotsTabContainer.appendChild(tab);
      snapshotTabsContent.appendChild(tabContent);
    });
  }

  // Fetch tracks for a specific snapshot
  async function fetchSnapshotTracks(snapshotId) {
    const loadingIndicator = document.getElementById(`snapshot-${snapshotId}-loading`);
    const tracksContainer = document.getElementById(`snapshot-${snapshotId}-tracks`);
    
    try {
      loadingIndicator.classList.remove('hidden');
      
      const response = await fetch(`/api/liked-tracks?snapshot_id=${snapshotId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch snapshot tracks');
      }
      
      const data = await response.json();
      displaySnapshotTracks(snapshotId, data.items);
    } catch (error) {
      console.error(`Error fetching tracks for snapshot ${snapshotId}:`, error);
      tracksContainer.innerHTML = `
        <div class="error-message">
          <p>Failed to load tracks for this snapshot: ${error.message}</p>
          <p>Please try again later.</p>
        </div>
      `;
    } finally {
      loadingIndicator.classList.add('hidden');
    }
  }

  // Display tracks for a specific snapshot
  function displaySnapshotTracks(snapshotId, tracks) {
    const tracksContainer = document.getElementById(`snapshot-${snapshotId}-tracks`);
    
    if (!tracks || tracks.length === 0) {
      tracksContainer.innerHTML = '<p class="no-tracks">No tracks found in this snapshot.</p>';
      return;
    }
    
    const tracksHTML = tracks.map((track, index) => {
      return `
        <div class="track-item">
          <div class="track-number">${index + 1}</div>
          <div class="track-info">
            <img src="${track.album_image || 'https://via.placeholder.com/40'}" alt="${track.album}" class="track-image">
            <div class="track-details">
              <div class="track-name">${track.name}</div>
              <div class="track-artist">${track.artist}</div>
            </div>
          </div>
          <div class="track-album">${track.album}</div>
          <div class="track-date-added">${formatDate(track.added_at)}</div>
          <div class="track-actions">
            <a href="${track.spotify_url}" target="_blank" class="track-action-btn" title="Open in Spotify">
              <i class="fab fa-spotify"></i>
            </a>
            ${track.preview_url ? `
              <button class="track-action-btn play-preview" title="Play Preview" data-preview-url="${track.preview_url}" data-track-name="${track.name}" data-artist-name="${track.artist}" data-image-url="${track.album_image || 'https://via.placeholder.com/40'}">
                <i class="fas fa-play"></i>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
    
    tracksContainer.innerHTML = tracksHTML;
    
    // Add event listeners to play preview buttons
    tracksContainer.querySelectorAll('.play-preview').forEach(button => {
      button.addEventListener('click', playPreview);
    });
  }

  // Fetch liked tracks from our server endpoint
  async function fetchLikedTracks(token) {
    try {
      console.log('Fetching liked tracks with token...');
      loadingIndicator.classList.remove('hidden');
      
      const response = await fetch(`/api/liked-tracks?access_token=${token}`);
      console.log('API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`Failed to fetch liked tracks: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Received liked tracks data:', data.items ? `${data.items.length} tracks` : 'No items found');
      
      // Store tracks in state
      currentTracks = data.items;
      filteredTracks = [...currentTracks];
      
      // Update total tracks count
      totalTracksElement.textContent = currentTracks.length;
      
      // Sort tracks
      sortTracks();
      
      // Display tracks
      displayTracks();
    } catch (error) {
      console.error('Error fetching liked tracks:', error);
      tracksContainer.innerHTML = `
        <div class="error-message">
          <p>Failed to load your liked tracks: ${error.message}</p>
          <p>Please try again later or check the console for more details.</p>
        </div>
      `;
    } finally {
      loadingIndicator.classList.add('hidden');
    }
  }

  // Sort tracks based on current sort option
  function sortTracks() {
    switch (currentSort) {
      case 'date-desc':
        filteredTracks.sort((a, b) => new Date(b.added_at) - new Date(a.added_at));
        break;
      case 'date-asc':
        filteredTracks.sort((a, b) => new Date(a.added_at) - new Date(b.added_at));
        break;
      case 'name-asc':
        filteredTracks.sort((a, b) => a.track.name.localeCompare(b.track.name));
        break;
      case 'name-desc':
        filteredTracks.sort((a, b) => b.track.name.localeCompare(a.track.name));
        break;
      case 'artist-asc':
        filteredTracks.sort((a, b) => {
          const artistA = a.track.artists[0].name;
          const artistB = b.track.artists[0].name;
          return artistA.localeCompare(artistB);
        });
        break;
      case 'artist-desc':
        filteredTracks.sort((a, b) => {
          const artistA = a.track.artists[0].name;
          const artistB = b.track.artists[0].name;
          return artistB.localeCompare(artistA);
        });
        break;
    }
  }

  // Filter tracks based on search term
  function filterTracks() {
    if (!currentSearchTerm) {
      filteredTracks = [...currentTracks];
    } else {
      const term = currentSearchTerm.toLowerCase();
      filteredTracks = currentTracks.filter(item => {
        const track = item.track;
        const trackName = track.name.toLowerCase();
        const artistNames = track.artists.map(artist => artist.name.toLowerCase()).join(' ');
        const albumName = track.album.name.toLowerCase();
        
        return trackName.includes(term) || artistNames.includes(term) || albumName.includes(term);
      });
    }
    
    // Sort filtered tracks
    sortTracks();
    
    // Display filtered tracks
    displayTracks();
  }

  // Display tracks in the UI
  function displayTracks() {
    if (!filteredTracks || filteredTracks.length === 0) {
      tracksContainer.innerHTML = '<p class="no-tracks">No tracks found matching your search.</p>';
      return;
    }
    
    const tracksHTML = filteredTracks.map((item, index) => {
      const track = item.track;
      const albumImage = track.album.images.length > 0 ? track.album.images[0].url : 'https://via.placeholder.com/40';
      const artistNames = track.artists.map(artist => artist.name).join(', ');
      
      return `
        <div class="track-item">
          <div class="track-number">${index + 1}</div>
          <div class="track-info">
            <img src="${albumImage}" alt="${track.album.name}" class="track-image">
            <div class="track-details">
              <div class="track-name">${track.name}</div>
              <div class="track-artist">${artistNames}</div>
            </div>
          </div>
          <div class="track-album">${track.album.name}</div>
          <div class="track-date-added">${formatDate(item.added_at)}</div>
          <div class="track-actions">
            <a href="${track.external_urls.spotify}" target="_blank" class="track-action-btn" title="Open in Spotify">
              <i class="fab fa-spotify"></i>
            </a>
            ${track.preview_url ? `
              <button class="track-action-btn play-preview" title="Play Preview" data-preview-url="${track.preview_url}" data-track-name="${track.name}" data-artist-name="${artistNames}" data-image-url="${albumImage}">
                <i class="fas fa-play"></i>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
    
    tracksContainer.innerHTML = tracksHTML;
    
    // Add event listeners to play preview buttons
    tracksContainer.querySelectorAll('.play-preview').forEach(button => {
      button.addEventListener('click', playPreview);
    });
  }

  // Play audio preview
  function playPreview(e) {
    const button = e.currentTarget;
    const previewUrl = button.dataset.previewUrl;
    const trackName = button.dataset.trackName;
    const artistName = button.dataset.artistName;
    const imageUrl = button.dataset.imageUrl;
    
    // Update audio player
    audioElement.src = previewUrl;
    playerImg.src = imageUrl;
    playerTrackName.textContent = trackName;
    playerArtistName.textContent = artistName;
    
    // Show audio player
    audioPlayer.classList.remove('hidden');
    
    // Play audio
    audioElement.play();
    
    // Update button icon
    document.querySelectorAll('.play-preview').forEach(btn => {
      btn.innerHTML = '<i class="fas fa-play"></i>';
    });
    button.innerHTML = '<i class="fas fa-pause"></i>';
    
    // Add event listener to audio element
    audioElement.addEventListener('ended', () => {
      button.innerHTML = '<i class="fas fa-play"></i>';
    });
    
    // Add event listener to audio element for pause
    audioElement.addEventListener('pause', () => {
      document.querySelectorAll('.play-preview').forEach(btn => {
        btn.innerHTML = '<i class="fas fa-play"></i>';
      });
    });
  }

  // Event Listeners
  
  // Search input
  searchInput.addEventListener('input', (e) => {
    currentSearchTerm = e.target.value.trim();
    filterTracks();
  });
  
  // Search button
  searchBtn.addEventListener('click', () => {
    currentSearchTerm = searchInput.value.trim();
    filterTracks();
  });
  
  // Sort select
  sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    sortTracks();
    displayTracks();
  });
  
  // Current tab
  document.querySelector('.tab[data-tab="current"]').addEventListener('click', () => {
    // Remove active class from all tabs and tab contents
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    // Add active class to current tab and its content
    document.querySelector('.tab[data-tab="current"]').classList.add('active');
    document.getElementById('current-tab').classList.add('active');
    
    // Set active tab
    activeTab = 'current';
  });
});