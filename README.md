# Don't Drop My Songs

A Napster-era inspired web application that displays a list of your liked tracks from Spotify using the Spotify Web API. The application keeps track of your song collection over time by taking snapshots and allowing you to view historical data.

## Features

- OAuth 2.0 authentication with Spotify
- Display of all your liked tracks from Spotify
- Napster-era inspired UI design
- Search and sort functionality
- Audio preview playback
- Historical snapshots of your library
- Automatic daily snapshots to track your collection over time
- SQLite database for persistent storage
- Responsive design for all devices
- Direct links to tracks on Spotify

## Prerequisites

- Node.js and npm installed
- A Spotify account
- Spotify Developer account and registered application

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory with the following variables:
   ```
   CLIENT_ID=your_spotify_client_id
   CLIENT_SECRET=your_spotify_client_secret
   REDIRECT_URI=http://localhost:51912/callback
   PORT=51912
   ```

## Getting Spotify API Credentials

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/)
2. Log in with your Spotify account
3. Click "Create an App"
4. Fill in the app name and description
5. Once created, you'll see your Client ID
6. Click "Show Client Secret" to reveal your Client Secret
7. Click "Edit Settings" and add `http://localhost:51912/callback` to the Redirect URIs
8. Save the settings

## Running the Application

1. Start the server:
   ```
   npm start
   ```
2. Open your browser and navigate to `http://localhost:51912`
3. Click "Login with Spotify" to authenticate
4. View your liked tracks!

## Technologies Used

- Node.js
- Express.js
- SQLite (via better-sqlite3)
- Spotify Web API
- HTML/CSS/JavaScript
- Font Awesome icons
- node-schedule for automated tasks
- axios for API requests
- moment.js for date formatting

## License

ISC