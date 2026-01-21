const fs = require('fs');
const https = require('https');

// Networks you want: Peacock, Amazon Prime, ABC, NBC (NOT ESPN, NBA TV)
const WANTED_NETWORKS = ['ABC', 'NBC', 'PEACOCK', 'AMAZON', 'PRIME'];
const EXCLUDED_NETWORKS = ['ESPN', 'NBA TV', 'NBATV'];

// Your favorite team
const FAVORITE_TEAM = 'Pelicans';

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
    const estTime = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/New_York'
    });
    const pstTime = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Los_Angeles'
    });
    return `${estTime} ET / ${pstTime} PT`;
}

function formatDate() {
    // Format current date in ET timezone
    return new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/New_York'
    });
}

function getTodayDateString() {
    // Get today's date in ET timezone for NBA API matching (format: MM/DD/YYYY)
    const now = new Date();
    const options = { timeZone: 'America/New_York' };
    const month = String(now.toLocaleString('en-US', { ...options, month: 'numeric' })).padStart(2, '0');
    const day = String(now.toLocaleString('en-US', { ...options, day: 'numeric' })).padStart(2, '0');
    const year = now.toLocaleString('en-US', { ...options, year: 'numeric' });
    return `${month}/${day}/${year}`;
}

function getTeamAbbrev(city, name) {
    const fullName = `${city} ${name}`;
    return TEAM_ABBREVS[fullName] || name.substring(0, 3).toUpperCase();
}

function getTeamColor(abbrev) {
    return TEAM_COLORS[abbrev] || '#f77f00';
}

function isPelicansGame(game) {
    const awayName = `${game.awayTeam.teamCity} ${game.awayTeam.teamName}`;
    const homeName = `${game.homeTeam.teamCity} ${game.homeTeam.teamName}`;
    return awayName.includes(FAVORITE_TEAM) || homeName.includes(FAVORITE_TEAM);
}

function isWantedNetwork(networkName) {
    const upper = (networkName || '').toUpperCase();
    // First check if it's excluded
    if (EXCLUDED_NETWORKS.some(ex => upper.includes(ex.toUpperCase()))) {
        return false;
    }
    // Then check if it's wanted
    return WANTED_NETWORKS.some(w => upper.includes(w));
}

async function fetchInjuries() {
    // Try to fetch injury data - this is a simplified version
    // In production, you'd want to use a proper NBA injuries API
    try {
        // NBA doesn't have a public injury API, so we'll return empty for now
        // You could integrate with a sports data provider like ESPN or SportsReference
        return {};
    } catch (e) {
        console.log('Could not fetch injuries:', e.message);
        return {};
    }
}

async function buildPage() {
    const dateStr = formatDate();
    const todayMatch = getTodayDateString();

    console.log('Building for date:', todayMatch, '(' + dateStr + ')');

    let gamesHtml = '';
    let hasGames = false;

    try {
        const scheduleData = await fetch('https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json');
        const injuries = await fetchInjuries();

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
                    const awayColor = getTeamColor(awayAbbrev);
                    const homeColor = getTeamColor(homeAbbrev);

                    const isPelicans = isPelicansGame(game);
                    const gameClass = isPelicans ? 'game pelicans-game' : 'game';

                    // Get injured top players (placeholder - would need real injury data)
                    const awayInjuries = injuries[awayAbbrev] || [];
                    const homeInjuries = injuries[homeAbbrev] || [];

                    const awayInjuryHtml = awayInjuries.length > 0
                        ? `<div class="injuries">${awayInjuries.map(p => `<span class="injured">${p}</span>`).join('')}</div>`
                        : '';
                    const homeInjuryHtml = homeInjuries.length > 0
                        ? `<div class="injuries">${homeInjuries.map(p => `<span class="injured">${p}</span>`).join('')}</div>`
                        : '';

                    gamesHtml += `
            <div class="${gameClass}">
                ${isPelicans ? '<div class="pelicans-badge">YOUR PELS!</div>' : ''}
                <div class="matchup">
                    <div class="team away">
                        <div class="retro-logo" style="background: ${awayColor}">${awayAbbrev}</div>
                        <div class="team-name">${game.awayTeam.teamCity}<br>${game.awayTeam.teamName}</div>
                        ${awayInjuryHtml}
                    </div>
                    <div class="vs-section">
                        <div class="at-symbol">@</div>
                        <div class="game-time">${time}</div>
                        <div class="network">${networks}</div>
                    </div>
                    <div class="team home">
                        <div class="retro-logo" style="background: ${homeColor}">${homeAbbrev}</div>
                        <div class="team-name">${game.homeTeam.teamCity}<br>${game.homeTeam.teamName}</div>
                        ${homeInjuryHtml}
                    </div>
                </div>
            </div>`;
                });
            }
        }

        if (!hasGames) {
            gamesHtml = `<div class="no-games">No games on your channels today, baby!</div>`;
        }

    } catch (error) {
        console.error('Error fetching games:', error);
        gamesHtml = `<div class="no-games">Couldn't grab the schedule, man. Try again later!</div>`;
    }

    // Generate the full HTML
    const html = generateHTML(dateStr, gamesHtml);
    fs.writeFileSync('index.html', html);
    console.log('Page built successfully for', dateStr);
}

function generateHTML(dateStr, gamesHtml) {
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
    <link href="https://fonts.googleapis.com/css2?family=Righteous&family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Poppins', sans-serif;
            background: linear-gradient(135deg, #1a0a0a 0%, #2d1810 50%, #1a0a0a 100%);
            color: #fff;
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
        }

        /* Groovy wavy header */
        header {
            text-align: center;
            margin-bottom: 40px;
            position: relative;
            padding: 40px 20px;
            background: linear-gradient(180deg, #f77f00 0%, #e85d04 100%);
            border-radius: 0 0 50% 50% / 0 0 30px 30px;
            box-shadow: 0 10px 40px rgba(247, 127, 0, 0.4);
        }

        header::before {
            content: '';
            position: absolute;
            top: -20px;
            left: 50%;
            transform: translateX(-50%);
            width: 80%;
            height: 40px;
            background: #f77f00;
            border-radius: 50%;
        }

        h1 {
            font-family: 'Righteous', cursive;
            font-size: clamp(36px, 10vw, 64px);
            text-transform: uppercase;
            color: #fff;
            text-shadow: 4px 4px 0 #6b2d0a, 6px 6px 20px rgba(0,0,0,0.5);
            letter-spacing: 4px;
        }

        .subtitle {
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 6px;
            color: rgba(255,255,255,0.9);
            margin-top: 10px;
        }

        .date {
            font-family: 'Righteous', cursive;
            font-size: 20px;
            color: #f77f00;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 30px;
            text-align: center;
            padding: 15px;
            background: rgba(247, 127, 0, 0.1);
            border-radius: 50px;
            border: 2px solid #f77f00;
        }

        #games {
            display: flex;
            flex-direction: column;
            gap: 25px;
        }

        .game {
            background: linear-gradient(135deg, #3d2914 0%, #2a1a0a 100%);
            border-radius: 30px;
            padding: 25px;
            position: relative;
            overflow: hidden;
            border: 3px solid #5a3d20;
            box-shadow: 0 10px 30px rgba(0,0,0,0.4);
        }

        /* Curvy decorative elements */
        .game::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -20%;
            width: 200px;
            height: 200px;
            background: radial-gradient(circle, rgba(247, 127, 0, 0.15) 0%, transparent 70%);
            border-radius: 50%;
        }

        .game::after {
            content: '';
            position: absolute;
            bottom: -30%;
            left: -10%;
            width: 150px;
            height: 150px;
            background: radial-gradient(circle, rgba(247, 127, 0, 0.1) 0%, transparent 70%);
            border-radius: 50%;
        }

        /* PELICANS SPECIAL TREATMENT */
        .pelicans-game {
            background: linear-gradient(135deg, #0C2340 0%, #C8A961 50%, #0C2340 100%);
            border: 4px solid #C8A961;
            animation: pelicansGlow 2s ease-in-out infinite;
            position: relative;
        }

        .pelicans-game::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(45deg, transparent 40%, rgba(200, 169, 97, 0.3) 50%, transparent 60%);
            animation: shimmer 3s infinite;
            border-radius: 27px;
        }

        @keyframes pelicansGlow {
            0%, 100% { box-shadow: 0 0 20px rgba(200, 169, 97, 0.5), 0 0 40px rgba(200, 169, 97, 0.3); }
            50% { box-shadow: 0 0 40px rgba(200, 169, 97, 0.8), 0 0 60px rgba(200, 169, 97, 0.5); }
        }

        @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }

        .pelicans-badge {
            position: absolute;
            top: -10px;
            right: 20px;
            background: linear-gradient(135deg, #C8A961 0%, #B4975A 100%);
            color: #0C2340;
            font-family: 'Righteous', cursive;
            font-size: 12px;
            padding: 8px 20px;
            border-radius: 20px;
            text-transform: uppercase;
            letter-spacing: 2px;
            box-shadow: 0 4px 15px rgba(200, 169, 97, 0.5);
            z-index: 10;
            animation: bounce 1s ease-in-out infinite;
        }

        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
        }

        .matchup {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            position: relative;
            z-index: 1;
        }

        .team {
            flex: 1;
            text-align: center;
        }

        /* 70s Style Retro Logo */
        .retro-logo {
            width: 70px;
            height: 70px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Righteous', cursive;
            font-size: 20px;
            color: white;
            text-shadow: 2px 2px 0 rgba(0,0,0,0.5);
            margin: 0 auto 10px;
            border: 4px solid rgba(255,255,255,0.3);
            box-shadow:
                0 4px 15px rgba(0,0,0,0.4),
                inset 0 -3px 10px rgba(0,0,0,0.3),
                inset 0 3px 10px rgba(255,255,255,0.2);
            position: relative;
        }

        .retro-logo::after {
            content: '';
            position: absolute;
            top: 5px;
            left: 10px;
            width: 20px;
            height: 10px;
            background: rgba(255,255,255,0.3);
            border-radius: 50%;
            transform: rotate(-30deg);
        }

        .team-name {
            font-family: 'Righteous', cursive;
            font-size: 16px;
            text-transform: uppercase;
            line-height: 1.3;
            color: #fff;
        }

        .injuries {
            margin-top: 8px;
        }

        .injured {
            display: inline-block;
            background: #c0392b;
            color: white;
            font-size: 11px;
            padding: 3px 10px;
            border-radius: 15px;
            margin: 2px;
            font-weight: 600;
        }

        .vs-section {
            text-align: center;
            padding: 0 10px;
        }

        .at-symbol {
            font-family: 'Righteous', cursive;
            font-size: 28px;
            color: #f77f00;
            text-shadow: 2px 2px 0 rgba(0,0,0,0.3);
        }

        .game-time {
            font-size: 13px;
            color: rgba(255,255,255,0.8);
            margin: 8px 0;
            white-space: nowrap;
        }

        .network {
            font-family: 'Righteous', cursive;
            font-size: 14px;
            color: #f77f00;
            text-transform: uppercase;
            letter-spacing: 1px;
            background: rgba(247, 127, 0, 0.2);
            padding: 5px 15px;
            border-radius: 20px;
        }

        .no-games {
            font-family: 'Righteous', cursive;
            font-size: 24px;
            color: #f77f00;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 2px;
            padding: 60px 20px;
            background: linear-gradient(135deg, #3d2914 0%, #2a1a0a 100%);
            border-radius: 30px;
            border: 3px solid #5a3d20;
        }

        footer {
            margin-top: 40px;
            text-align: center;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 3px;
            color: #5a3d20;
            padding-bottom: 20px;
        }

        /* Decorative curves at bottom */
        .wave-decoration {
            height: 60px;
            margin-top: 40px;
            background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 100'%3E%3Cpath fill='%23f77f00' fill-opacity='0.3' d='M0,50 C360,100 720,0 1080,50 C1260,75 1380,50 1440,50 L1440,100 L0,100 Z'/%3E%3C/svg%3E") repeat-x;
            background-size: 100% 100%;
        }

        /* Mobile responsiveness */
        @media (max-width: 600px) {
            .matchup {
                flex-direction: column;
                gap: 20px;
            }

            .team {
                display: flex;
                align-items: center;
                gap: 15px;
                text-align: left;
            }

            .team.home {
                flex-direction: row-reverse;
                text-align: right;
            }

            .retro-logo {
                margin: 0;
                width: 60px;
                height: 60px;
                font-size: 18px;
            }

            .vs-section {
                padding: 10px 0;
                border-top: 1px solid rgba(247, 127, 0, 0.3);
                border-bottom: 1px solid rgba(247, 127, 0, 0.3);
                width: 100%;
            }

            .at-symbol {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>NBA Tonight</h1>
            <div class="subtitle">Peacock • Prime • ABC • NBC</div>
        </header>
        <div class="date">${dateStr}</div>
        <div id="games">
            ${gamesHtml}
        </div>
        <div class="wave-decoration"></div>
        <footer>Updated Daily • Add to Home Screen for App Experience</footer>
    </div>
</body>
</html>`;
}

buildPage();
