const fs = require('fs');
const https = require('https');

// Networks to display: Peacock, Amazon Prime, ABC, NBC (NOT ESPN, NBA TV)
const WANTED_NETWORKS = ['ABC', 'NBC', 'PEACOCK', 'AMAZON', 'PRIME'];
const EXCLUDED_NETWORKS = ['ESPN', 'NBA TV', 'NBATV'];

// Your favorite team
const FAVORITE_TEAM = 'Pelicans';
const FAVORITE_TEAM_ID = 1610612740; // New Orleans Pelicans team ID

// Team abbreviations for retro logos
const TEAM_ABBREVS = {
    'Atlanta Hawks': 'ATL', 'Boston Celtics': 'BOS', 'Brooklyn Nets': 'BKN',
    'Charlotte Hornets': 'CHA', 'Chicago Bulls': 'CHI', 'Cleveland Cavaliers': 'CLE',
    'Dallas Mavericks': 'DAL', 'Denver Nuggets': 'DEN', 'Detroit Pistons': 'DET',
    'Golden State Warriors': 'GSW', 'Houston Rockets': 'HOU', 'Indiana Pacers': 'IND',
    'Los Angeles Clippers': 'LAC', 'Los Angeles Lakers': 'LAL', 'Memphis Grizzlies': 'MEM',
    'Miami Heat': 'MIA', 'Milwaukee Bucks': 'MIL', 'Minnesota Timberwolves': 'MIN',
    'New Orleans Pelicans': 'NOP', 'New York Knicks': 'NYK', 'Oklahoma City Thunder': 'OKC',
    'Orlando Magic': 'ORL', 'Philadelphia 76ers': 'PHI', 'Phoenix Suns': 'PHX',
    'Portland Trail Blazers': 'POR', 'Sacramento Kings': 'SAC', 'San Antonio Spurs': 'SAS',
    'Toronto Raptors': 'TOR', 'Utah Jazz': 'UTA', 'Washington Wizards': 'WAS'
};

// Team primary colors for retro logos
const TEAM_COLORS = {
    'ATL': '#E03A3E', 'BOS': '#007A33', 'BKN': '#000000', 'CHA': '#1D1160',
    'CHI': '#CE1141', 'CLE': '#860038', 'DAL': '#00538C', 'DEN': '#0E2240',
    'DET': '#C8102E', 'GSW': '#1D428A', 'HOU': '#CE1141', 'IND': '#002D62',
    'LAC': '#C8102E', 'LAL': '#552583', 'MEM': '#5D76A9', 'MIA': '#98002E',
    'MIL': '#00471B', 'MIN': '#0C2340', 'NOP': '#0C2340', 'NYK': '#006BB6',
    'OKC': '#007AC1', 'ORL': '#0077C0', 'PHI': '#006BB6', 'PHX': '#1D1160',
    'POR': '#E03A3E', 'SAC': '#5A2D81', 'SAS': '#C4CED4', 'TOR': '#CE1141',
    'UTA': '#002B5C', 'WAS': '#002B5C'
};

function fetch(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

function formatTime(dateStr) {
    const date = new Date(dateStr);
    const pstTime = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Los_Angeles'
    });
    return pstTime;
}

function formatDate() {
    // Format current date in PST timezone
    return new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/Los_Angeles'
    });
}

function formatShortDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'numeric',
        day: 'numeric',
        timeZone: 'America/Los_Angeles'
    });
}

function formatGameDateTime(dateStr) {
    const date = new Date(dateStr);
    const dayPart = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'numeric',
        day: 'numeric',
        timeZone: 'America/Los_Angeles'
    });
    const timePart = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Los_Angeles'
    });
    return `${dayPart} - ${timePart}`;
}

function getTodayDateString() {
    // Get today's date in PST timezone to match display (format: MM/DD/YYYY)
    const now = new Date();
    const options = { timeZone: 'America/Los_Angeles' };
    const month = String(now.toLocaleString('en-US', { ...options, month: 'numeric' })).padStart(2, '0');
    const day = String(now.toLocaleString('en-US', { ...options, day: 'numeric' })).padStart(2, '0');
    const year = now.toLocaleString('en-US', { ...options, year: 'numeric' });
    return `${month}/${day}/${year}`;
}

function getTeamAbbrev(city, name) {
    const fullName = `${city} ${name}`;
    return TEAM_ABBREVS[fullName] || name.substring(0, 3).toUpperCase();
}

function getTeamName(city, name) {
    return name; // Just return the team name (e.g., "Rockets", "Pelicans")
}

function isWantedNetwork(networkName) {
    const upper = (networkName || '').toUpperCase();
    if (EXCLUDED_NETWORKS.some(ex => upper.includes(ex.toUpperCase()))) {
        return false;
    }
    return WANTED_NETWORKS.some(w => upper.includes(w));
}

function loadJsonFile(path) {
    try {
        return JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch (e) {
        console.log(`Could not load ${path}:`, e.message);
        return null;
    }
}

function isPelicansGame(game) {
    return game.homeTeam.teamId === FAVORITE_TEAM_ID || game.awayTeam.teamId === FAVORITE_TEAM_ID;
}

function getPelicansGames(scheduleData) {
    const now = new Date();
    const allGames = [];

    // Collect all Pelicans games from all game dates
    for (const gameDay of scheduleData.leagueSchedule.gameDates) {
        for (const game of gameDay.games) {
            if (isPelicansGame(game)) {
                allGames.push(game);
            }
        }
    }

    // Separate into past and future games
    const pastGames = [];
    const futureGames = [];
    let wins = 0;
    let losses = 0;

    for (const game of allGames) {
        const gameDate = new Date(game.gameDateTimeUTC);
        const gameStatus = game.gameStatus; // 1 = scheduled, 2 = in progress, 3 = final

        if (gameStatus === 3) {
            // Game is final - it's a past game
            pastGames.push(game);
            // Calculate record
            const isPelicansHome = game.homeTeam.teamId === FAVORITE_TEAM_ID;
            const pelicansScore = isPelicansHome ? game.homeTeam.score : game.awayTeam.score;
            const opponentScore = isPelicansHome ? game.awayTeam.score : game.homeTeam.score;
            if (pelicansScore > opponentScore) {
                wins++;
            } else {
                losses++;
            }
        } else if (gameStatus === 1 && gameDate > now) {
            // Game is scheduled and in the future
            futureGames.push(game);
        }
    }

    // Sort past games by date descending (most recent first)
    pastGames.sort((a, b) => new Date(b.gameDateTimeUTC) - new Date(a.gameDateTimeUTC));

    // Sort future games by date ascending (soonest first)
    futureGames.sort((a, b) => new Date(a.gameDateTimeUTC) - new Date(b.gameDateTimeUTC));

    return {
        last3: pastGames.slice(0, 3),
        next3: futureGames.slice(0, 3),
        record: { wins, losses }
    };
}

function generateLast3GamesHtml(games) {
    if (!games || games.length === 0) {
        return '<div class="game-result"><span class="game-result-opponent">No recent games</span></div>';
    }

    return games.map(game => {
        const isPelicansHome = game.homeTeam.teamId === FAVORITE_TEAM_ID;
        const opponent = isPelicansHome ? game.awayTeam : game.homeTeam;
        const pelicansScore = isPelicansHome ? game.homeTeam.score : game.awayTeam.score;
        const opponentScore = isPelicansHome ? game.awayTeam.score : game.homeTeam.score;
        const isWin = pelicansScore > opponentScore;
        const prefix = isPelicansHome ? 'vs' : '@';
        const resultClass = isWin ? 'game-result-win' : 'game-result-loss';
        const resultText = isWin ? 'W' : 'L';
        const dateStr = formatShortDate(game.gameDateTimeUTC);

        return `
                <div class="game-result">
                    <span class="game-result-opponent ${resultClass}">${prefix} ${getTeamName(opponent.teamCity, opponent.teamName)}</span>
                    <div class="game-result-info">
                        <div class="game-result-score">${resultText} ${pelicansScore}-${opponentScore}</div>
                        <div class="game-result-date">${dateStr}</div>
                    </div>
                </div>`;
    }).join('');
}

function generateNext3GamesHtml(games) {
    if (!games || games.length === 0) {
        return '<div class="next-game"><span class="next-game-opponent">No upcoming games</span></div>';
    }

    return games.map(game => {
        const isPelicansHome = game.homeTeam.teamId === FAVORITE_TEAM_ID;
        const opponent = isPelicansHome ? game.awayTeam : game.homeTeam;
        const prefix = isPelicansHome ? 'vs' : '@';
        const locationClass = isPelicansHome ? 'next-game-home' : 'next-game-away';
        const dateTimeStr = formatGameDateTime(game.gameDateTimeUTC);

        return `
                <div class="next-game">
                    <span class="next-game-opponent ${locationClass}">${prefix} ${getTeamName(opponent.teamCity, opponent.teamName)}</span>
                    <span class="next-game-info">${dateTimeStr}</span>
                </div>`;
    }).join('');
}

async function buildPage() {
    const dateStr = formatDate();
    const todayMatch = getTodayDateString();

    console.log('Building for date:', todayMatch, '(' + dateStr + ')');

    // Load data files
    const talkingPoints = loadJsonFile('./data/talking-points.json');
    const draftCapital = loadJsonFile('./data/draft-capital.json');

    let tvGamesHtml = '';
    let hasGames = false;
    let last3GamesHtml = '';
    let next3GamesHtml = '';
    let recordStr = '';

    try {
        const scheduleData = await fetch('https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json');

        // Get Pelicans games
        const pelicansGames = getPelicansGames(scheduleData);
        last3GamesHtml = generateLast3GamesHtml(pelicansGames.last3);
        next3GamesHtml = generateNext3GamesHtml(pelicansGames.next3);
        recordStr = `${pelicansGames.record.wins}-${pelicansGames.record.losses}`;

        console.log(`Found ${pelicansGames.last3.length} past games and ${pelicansGames.next3.length} upcoming games for Pelicans`);
        console.log(`Pelicans record: ${recordStr}`);

        // Get today's TV games
        const gameDay = scheduleData.leagueSchedule.gameDates.find(gd =>
            gd.gameDate.startsWith(todayMatch)
        );

        if (gameDay && gameDay.games) {
            const filteredGames = gameDay.games.filter(game => {
                if (!game.broadcasters || !game.broadcasters.nationalBroadcasters) return false;
                const networks = game.broadcasters.nationalBroadcasters.map(b =>
                    (b.broadcasterDisplay || '')
                );
                return networks.some(n => isWantedNetwork(n));
            });

            if (filteredGames.length > 0) {
                hasGames = true;
                filteredGames.forEach(game => {
                    const time = formatTime(game.gameDateTimeUTC);
                    const networks = game.broadcasters.nationalBroadcasters
                        .map(b => b.broadcasterDisplay)
                        .filter(n => isWantedNetwork(n))
                        .join(', ');

                    const awayAbbrev = getTeamAbbrev(game.awayTeam.teamCity, game.awayTeam.teamName);
                    const homeAbbrev = getTeamAbbrev(game.homeTeam.teamCity, game.homeTeam.teamName);

                    tvGamesHtml += `
            <div class="tv-game">
                <span class="tv-teams">${awayAbbrev} <span class="tv-at">@</span> ${homeAbbrev}</span>
                <span class="tv-time">${time}</span>
                <span class="tv-network">${networks}</span>
            </div>`;
                });
            }
        }

        if (!hasGames) {
            tvGamesHtml = `<div class="tv-no-games">There are no national TV games today.</div>`;
        }

    } catch (error) {
        console.error('Error fetching games:', error);
        tvGamesHtml = `<div class="tv-no-games">Couldn't load schedule</div>`;
        last3GamesHtml = '<div class="game-result"><span class="game-result-opponent">Couldn\'t load games</span></div>';
        next3GamesHtml = '<div class="next-game"><span class="next-game-opponent">Couldn\'t load games</span></div>';
    }

    // Generate talking points HTML (only one item)
    let talkingPointsHtml = '';
    if (talkingPoints && talkingPoints.item) {
        talkingPointsHtml = `
            <div class="fun-fact">
                <div class="fun-fact-label">${talkingPoints.item.label}</div>
                <div class="fun-fact-text">${talkingPoints.item.text}</div>
            </div>`;
    }

    // Generate draft capital HTML
    let draftCapitalHtml = '';
    if (draftCapital) {
        draftCapitalHtml = draftCapital.picks.map(pick => `
            <div class="cap-item">
                <span class="cap-label">${pick.year} ${pick.round}</span>
                <span class="cap-value ${pick.statusClass}">${pick.status}</span>
            </div>`).join('');

        if (draftCapital.intel) {
            draftCapitalHtml += `
            <div class="fun-fact">
                <div class="fun-fact-label">${draftCapital.intel.label}</div>
                <div class="fun-fact-text">${draftCapital.intel.text}</div>
            </div>`;
        }
    }

    // Generate the full HTML
    const html = generateHTML(dateStr, tvGamesHtml, last3GamesHtml, next3GamesHtml, talkingPointsHtml, recordStr);
    fs.writeFileSync('index.html', html);
    console.log('Page built successfully for', dateStr);
}

function generateHTML(dateStr, tvGamesHtml, last3GamesHtml, next3GamesHtml, talkingPointsHtml, recordStr) {
    // YouTube search URL for Pelicans sorted by most recent uploads
    const youtubeUrl = 'https://www.youtube.com/@NBA/search?query=pelicans';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="NBA Tonight">
    <link rel="apple-touch-icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%23f77f00' width='100' height='100' rx='20'/><text x='50' y='65' text-anchor='middle' font-size='50' fill='white'>🏀</text></svg>">
    <title>NBA Tonight</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Righteous&family=Poppins:wght@400;600;700;900&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Poppins', sans-serif;
            background: #111;
            color: #fff;
            min-height: 100vh;
        }

        /* ===== TOP SECTION - MINIMAL TV SCHEDULE ===== */
        .tv-section {
            background: #ffffff;
            padding: 15px 20px 20px;
            border-bottom: 1px solid #e0e0e0;
        }

        .tv-header {
            font-family: 'Poppins', sans-serif;
            font-size: 14px;
            font-weight: 600;
            text-transform: lowercase;
            letter-spacing: 1px;
            color: #333;
            text-align: center;
            margin-bottom: 12px;
        }

        .tv-date {
            font-size: 11px;
            color: #888;
            text-align: center;
            margin-bottom: 15px;
        }

        .tv-games {
            display: flex;
            justify-content: center;
            gap: 30px;
            flex-wrap: wrap;
        }

        .tv-game {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #666;
        }

        .tv-teams {
            font-weight: 600;
            color: #111;
        }

        .tv-at {
            color: #999;
            font-size: 11px;
        }

        .tv-time {
            color: #666;
            font-size: 11px;
        }

        .tv-network {
            background: #f0f0f0;
            color: #555;
            font-size: 10px;
            padding: 2px 8px;
            border-radius: 3px;
            text-transform: uppercase;
        }

        .tv-no-games {
            text-align: center;
            color: #888;
            font-size: 13px;
        }

        /* ===== PELICANS SECTION ===== */
        .pelicans-section {
            background: linear-gradient(180deg, #0C2340 0%, #071428 50%, #0C2340 100%);
            padding: 25px 20px 30px;
            position: relative;
            overflow: hidden;
        }

        .pelicans-section::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #C8A961, #E31837, #C8A961);
        }

        .pelicans-section::after {
            content: '';
            position: absolute;
            top: -100px;
            right: -100px;
            width: 300px;
            height: 300px;
            background: radial-gradient(circle, rgba(200, 169, 97, 0.1) 0%, transparent 70%);
            border-radius: 50%;
        }

        .pels-header {
            text-align: center;
            margin-bottom: 20px;
            position: relative;
            z-index: 1;
        }

        .pels-title-row {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
        }

        .pels-title {
            font-family: 'Righteous', cursive;
            font-size: 28px;
            background: linear-gradient(135deg, #C8A961 0%, #E8D9A0 50%, #C8A961 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-transform: uppercase;
            letter-spacing: 3px;
            text-shadow: 0 0 30px rgba(200, 169, 97, 0.5);
        }

        .refresh-btn {
            background: rgba(200, 169, 97, 0.2);
            border: 1px solid rgba(200, 169, 97, 0.4);
            border-radius: 50%;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .refresh-btn:hover {
            background: rgba(200, 169, 97, 0.4);
            transform: scale(1.1);
        }

        .refresh-btn:active {
            transform: scale(0.95);
        }

        .refresh-btn.spinning svg {
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        .refresh-btn svg {
            width: 18px;
            height: 18px;
            fill: #C8A961;
        }

        .pels-record {
            font-size: 12px;
            color: #6B8299;
            margin-top: 5px;
            letter-spacing: 1px;
        }

        .pels-streak {
            display: inline-block;
            background: linear-gradient(135deg, #2D5A27 0%, #1E3D1A 100%);
            color: #7FBF7F;
            font-size: 10px;
            padding: 3px 10px;
            border-radius: 10px;
            margin-left: 8px;
            font-weight: 600;
        }

        .pels-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 15px;
            position: relative;
            z-index: 1;
        }

        .pels-card {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(200, 169, 97, 0.2);
            border-radius: 12px;
            padding: 15px;
            backdrop-filter: blur(10px);
        }

        .pels-card-title {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: #C8A961;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .pels-card-title::before {
            content: '';
            width: 3px;
            height: 12px;
            background: #E31837;
            border-radius: 2px;
        }

        /* Next Games */
        .next-game {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid rgba(200, 169, 97, 0.1);
        }

        .next-game:last-child {
            border-bottom: none;
        }

        .next-game-opponent {
            font-weight: 600;
            font-size: 13px;
        }

        .next-game-home {
            color: #7FBF7F;
        }

        .next-game-away {
            color: #BF7F7F;
        }

        .next-game-info {
            text-align: right;
            font-size: 11px;
            color: #6B8299;
        }

        /* Hot Players */
        .hot-player {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 0;
            border-bottom: 1px solid rgba(200, 169, 97, 0.1);
        }

        .hot-player:last-child {
            border-bottom: none;
        }

        .hot-player-name {
            font-weight: 600;
            font-size: 12px;
            color: #E8D9A0;
        }

        .hot-player-stat {
            font-size: 11px;
            color: #C8A961;
        }

        .hot-player-value {
            font-weight: 700;
            color: #fff;
        }

        /* Injury Report */
        .injury-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 5px 0;
            font-size: 11px;
        }

        .injury-name {
            color: #ccc;
        }

        .injury-status {
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 9px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .injury-out {
            background: #5C1F1F;
            color: #E87777;
        }

        .injury-questionable {
            background: #5C4A1F;
            color: #E8C777;
        }

        /* Game Results */
        .game-result {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid rgba(200, 169, 97, 0.1);
        }

        .game-result:last-child {
            border-bottom: none;
        }

        .game-result-opponent {
            font-weight: 600;
            font-size: 13px;
        }

        .game-result-win {
            color: #7FBF7F;
        }

        .game-result-loss {
            color: #BF7F7F;
        }

        .game-result-info {
            text-align: right;
            font-size: 11px;
        }

        .game-result-score {
            font-weight: 700;
            color: #E8D9A0;
        }

        .game-result-date {
            color: #6B8299;
            font-size: 10px;
        }

        /* Draft picks */
        .cap-item {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            font-size: 11px;
            border-bottom: 1px solid rgba(200, 169, 97, 0.1);
        }

        .cap-item:last-child {
            border-bottom: none;
        }

        .cap-label {
            color: #6B8299;
        }

        .cap-value {
            color: #C8A961;
            font-weight: 600;
        }

        .cap-warning {
            color: #E87777;
        }

        .cap-good {
            color: #7FBF7F;
        }

        /* YouTube Link */
        .youtube-link {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            background: linear-gradient(135deg, #E31837 0%, #B31530 100%);
            color: white;
            text-decoration: none;
            padding: 12px 20px;
            border-radius: 25px;
            font-weight: 600;
            font-size: 13px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(227, 24, 55, 0.4);
        }

        .youtube-link:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(227, 24, 55, 0.6);
        }

        .youtube-icon {
            width: 24px;
            height: 24px;
        }

        /* Fun Facts */
        .fun-fact {
            background: linear-gradient(135deg, rgba(200, 169, 97, 0.15) 0%, rgba(200, 169, 97, 0.05) 100%);
            border-left: 3px solid #C8A961;
            padding: 10px 12px;
            margin-top: 10px;
            border-radius: 0 8px 8px 0;
        }

        .fun-fact-label {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #C8A961;
            margin-bottom: 3px;
        }

        .fun-fact-text {
            font-size: 12px;
            color: #E8D9A0;
            line-height: 1.4;
        }

        /* Full Width Cards */
        .pels-card-full {
            grid-column: 1 / -1;
        }

        .pels-youtube-section {
            text-align: center;
            padding: 15px 0 5px;
        }

        @media (max-width: 600px) {
            .tv-games {
                flex-direction: column;
                gap: 12px;
                align-items: center;
            }

            .pels-grid {
                grid-template-columns: 1fr;
            }

            .pels-title {
                font-size: 22px;
            }
        }
    </style>
</head>
<body>
    <!-- MINIMAL TV SCHEDULE -->
    <section class="tv-section">
        <div class="tv-header">nba tonight</div>
        <div class="tv-date">${dateStr}</div>
        <div class="tv-games">
            ${tvGamesHtml}
        </div>
    </section>

    <!-- PELICANS CELEBRATION -->
    <section class="pelicans-section">
        <div class="pels-header">
            <div class="pels-title-row">
                <div class="pels-title">Pelicans Central</div>
                <button class="refresh-btn" id="refresh-btn" title="Refresh page">
                    <svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                </button>
            </div>
            <div class="pels-record">${recordStr}</div>
        </div>

        <div class="pels-grid">
            <!-- Last 3 Games -->
            <div class="pels-card">
                <div class="pels-card-title">Last 3 Games</div>
                ${last3GamesHtml}
            </div>

            <!-- Next 3 Games -->
            <div class="pels-card">
                <div class="pels-card-title">Next 3 Games</div>
                ${next3GamesHtml}
            </div>

            <!-- YouTube Section - Right after Next 3 Games -->
            <div class="pels-card pels-card-full pels-youtube-section">
                <a href="${youtubeUrl}" target="_blank" class="youtube-link">
                    <svg class="youtube-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    Search Pelicans on NBA YouTube
                </a>
            </div>

            <!-- Sound Like You Know -->
            <div class="pels-card pels-card-full">
                <div class="pels-card-title">Sound Like You Know</div>
                ${talkingPointsHtml}
            </div>

            <!-- Injury Report -->
            <div class="pels-card">
                <div class="pels-card-title">Injury Report</div>
                <div class="injury-item">
                    <span class="injury-name">Herb Jones</span>
                    <span class="injury-status injury-out">Out - Ankle</span>
                </div>
                <div class="injury-item">
                    <span class="injury-name">Dejounte Murray</span>
                    <span class="injury-status injury-out">Out</span>
                </div>
                <div class="injury-item">
                    <span class="injury-name">Jose Alvarado</span>
                    <span class="injury-status injury-out">Out</span>
                </div>
                <div class="injury-item">
                    <span class="injury-name">Trey Murphy III</span>
                    <span class="injury-status injury-questionable">GTD - Back</span>
                </div>
            </div>

        </div>
    </section>

    <script>
        document.getElementById('refresh-btn').addEventListener('click', function() {
            this.classList.add('spinning');
            location.reload(true);
        });
    </script>
</body>
</html>`;
}

buildPage();
