const fs = require('fs');
const https = require('https');
const nodemailer = require('nodemailer');
const Anthropic = require('@anthropic-ai/sdk');

// Networks to display: Peacock, Amazon Prime, ABC, NBC (NOT ESPN, NBA TV)
const WANTED_NETWORKS = ['ABC', 'NBC', 'PEACOCK', 'AMAZON', 'PRIME'];
const EXCLUDED_NETWORKS = ['ESPN', 'NBA TV', 'NBATV'];

// Your favorite team
const FAVORITE_TEAM = 'Pelicans';
const FAVORITE_TEAM_ID = 1610612740; // New Orleans Pelicans team ID

// Team abbreviations
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

// ============ Utility Functions ============

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
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Los_Angeles'
    });
}

function formatDate() {
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
    return name;
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

// ============ Data Functions ============

function getPelicansGames(scheduleData) {
    const now = new Date();
    const allGames = [];

    for (const gameDay of scheduleData.leagueSchedule.gameDates) {
        for (const game of gameDay.games) {
            if (isPelicansGame(game)) {
                allGames.push(game);
            }
        }
    }

    const pastGames = [];
    const futureGames = [];
    let wins = 0;
    let losses = 0;

    for (const game of allGames) {
        const gameDate = new Date(game.gameDateTimeUTC);
        const gameStatus = game.gameStatus;

        if (gameStatus === 3) {
            pastGames.push(game);
            const isPelicansHome = game.homeTeam.teamId === FAVORITE_TEAM_ID;
            const pelicansScore = isPelicansHome ? game.homeTeam.score : game.awayTeam.score;
            const opponentScore = isPelicansHome ? game.awayTeam.score : game.homeTeam.score;
            if (pelicansScore > opponentScore) {
                wins++;
            } else {
                losses++;
            }
        } else if (gameStatus === 1 && gameDate > now) {
            futureGames.push(game);
        }
    }

    pastGames.sort((a, b) => new Date(b.gameDateTimeUTC) - new Date(a.gameDateTimeUTC));
    futureGames.sort((a, b) => new Date(a.gameDateTimeUTC) - new Date(b.gameDateTimeUTC));

    return {
        last3: pastGames.slice(0, 3),
        last5: pastGames.slice(0, 5),
        next3: futureGames.slice(0, 3),
        record: { wins, losses }
    };
}

function getPelicansToday(scheduleData, todayMatch) {
    const gameDay = scheduleData.leagueSchedule.gameDates.find(gd =>
        gd.gameDate.startsWith(todayMatch)
    );
    if (!gameDay) return null;
    return gameDay.games.find(g => isPelicansGame(g)) || null;
}

function didPelicansPlayYesterday(pelicansGames) {
    if (!pelicansGames.last3 || pelicansGames.last3.length === 0) return null;
    const lastGame = pelicansGames.last3[0];
    const gameDate = new Date(lastGame.gameDateTimeUTC);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const gameDatePST = gameDate.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' });
    const yesterdayPST = yesterday.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' });

    if (gameDatePST === yesterdayPST) {
        return lastGame;
    }
    return null;
}

function getTVGames(scheduleData, todayMatch) {
    const gameDay = scheduleData.leagueSchedule.gameDates.find(gd =>
        gd.gameDate.startsWith(todayMatch)
    );

    if (!gameDay || !gameDay.games) return [];

    return gameDay.games.filter(game => {
        if (!game.broadcasters || !game.broadcasters.nationalBroadcasters) return false;
        const networks = game.broadcasters.nationalBroadcasters.map(b =>
            (b.broadcasterDisplay || '')
        );
        return networks.some(n => isWantedNetwork(n));
    });
}

async function fetchBoxScore(gameId) {
    const url = `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${gameId}.json`;
    const data = await fetch(url);
    return data.game;
}

function generateAutoTalkingPointsEmail(boxScore, recentGames) {
    let items = [];

    // Last Game tidbit
    if (boxScore) {
        try {
            const isPelicansHome = boxScore.homeTeam.teamId === FAVORITE_TEAM_ID;
            const pelTeam = isPelicansHome ? boxScore.homeTeam : boxScore.awayTeam;
            const oppTeam = isPelicansHome ? boxScore.awayTeam : boxScore.homeTeam;
            const isWin = pelTeam.score > oppTeam.score;

            const players = pelTeam.players || [];
            const topScorer = players.reduce((best, p) => {
                const pts = p.statistics ? p.statistics.points : (p.points || 0);
                const bestPts = best.statistics ? best.statistics.points : (best.points || 0);
                return pts > bestPts ? p : best;
            }, players[0]);

            const topPts = topScorer?.statistics?.points ?? topScorer?.points ?? 0;
            const topReb = topScorer?.statistics?.reboundsTotal ?? topScorer?.rebounds ?? 0;
            const topAst = topScorer?.statistics?.assists ?? topScorer?.assists ?? 0;
            const topName = topScorer?.name || topScorer?.firstName + ' ' + topScorer?.familyName || 'Unknown';

            const result = isWin ? `${pelTeam.score}-${oppTeam.score} win` : `${pelTeam.score}-${oppTeam.score} loss`;
            const oppName = oppTeam.teamName || 'opponent';
            const prefix = isPelicansHome ? 'vs' : 'at';

            let statLine = `${topPts} pts`;
            if (topReb >= 5) statLine += `, ${topReb} reb`;
            if (topAst >= 5) statLine += `, ${topAst} ast`;

            items.push({ label: 'Last Game', text: `${topName} led with ${statLine} in a ${result} ${prefix} the ${oppName}.` });
        } catch (e) {
            console.log('Error generating last game tidbit:', e.message);
        }
    }

    // Recent stretch tidbit
    if (recentGames && recentGames.length >= 2) {
        try {
            let wins = 0, losses = 0, totalPts = 0;
            for (const game of recentGames) {
                const isPelicansHome = game.homeTeam.teamId === FAVORITE_TEAM_ID;
                const pelScore = isPelicansHome ? game.homeTeam.score : game.awayTeam.score;
                const oppScore = isPelicansHome ? game.awayTeam.score : game.homeTeam.score;
                totalPts += pelScore;
                if (pelScore > oppScore) wins++;
                else losses++;
            }
            const avgPts = (totalPts / recentGames.length).toFixed(1);
            const n = recentGames.length;

            let streakType = null;
            let streakCount = 0;
            for (const game of recentGames) {
                const isPelicansHome = game.homeTeam.teamId === FAVORITE_TEAM_ID;
                const pelScore = isPelicansHome ? game.homeTeam.score : game.awayTeam.score;
                const oppScore = isPelicansHome ? game.awayTeam.score : game.homeTeam.score;
                const isWin = pelScore > oppScore;
                if (streakType === null) {
                    streakType = isWin;
                    streakCount = 1;
                } else if (isWin === streakType) {
                    streakCount++;
                } else {
                    break;
                }
            }

            let streakText = '';
            if (streakCount >= 2) {
                streakText = streakType ? `, currently on a ${streakCount}-game winning streak` : `, on a ${streakCount}-game losing skid`;
            }

            items.push({ label: `Last ${n} Games`, text: `The Pelicans are ${wins}-${losses} over their last ${n}, averaging ${avgPts} PPG${streakText}.` });
        } catch (e) {
            console.log('Error generating recent tidbit:', e.message);
        }
    }

    return items;
}

async function fetchInjuryReport() {
    try {
        const data = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries');
        const pelicansTeam = (data.injuries || []).find(team =>
            (team.displayName || '').toLowerCase().includes('pelicans')
        );
        if (!pelicansTeam || !pelicansTeam.injuries || pelicansTeam.injuries.length === 0) {
            return [];
        }

        return pelicansTeam.injuries.map(inj => {
            const name = inj.athlete?.displayName || 'Unknown';
            const status = inj.status || '';
            const desc = inj.details?.detail || inj.longComment || '';
            const location = inj.details?.location || '';
            const isOut = status.toLowerCase().includes('out');

            let detail = '';
            const side = inj.details?.side || '';
            if (side && location && desc) detail = `${side} ${location} ${desc}`;
            else if (location && desc) detail = `${location} ${desc}`;
            else if (location) detail = location;
            else if (desc) detail = desc;

            let label = status;
            if (detail) label = `${status} - ${detail}`.trim();

            return { name, label, isOut };
        });
    } catch (e) {
        console.log('Error fetching injury report:', e.message);
        return [];
    }
}

// ============ Claude API ============

async function getPelicansRecap(game) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        console.log('No ANTHROPIC_API_KEY set, skipping Pelicans recap');
        return null;
    }

    const isPelicansHome = game.homeTeam.teamId === FAVORITE_TEAM_ID;
    const opponent = isPelicansHome ? game.awayTeam : game.homeTeam;
    const pelicansScore = isPelicansHome ? game.homeTeam.score : game.awayTeam.score;
    const opponentScore = isPelicansHome ? game.awayTeam.score : game.homeTeam.score;
    const isWin = pelicansScore > opponentScore;
    const location = isPelicansHome ? 'at home' : `at ${opponent.teamCity}`;

    const client = new Anthropic();

    try {
        const response = await client.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 1024,
            tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
            messages: [{
                role: 'user',
                content: `Give me a 3-4 sentence recap of last night's NBA game: New Orleans Pelicans ${isWin ? 'defeated' : 'lost to'} the ${opponent.teamCity} ${opponent.teamName} ${pelicansScore}-${opponentScore} ${location}. Focus on key performers, turning points, and any notable storylines. Be concise and conversational. Return ONLY the recap text, no preamble.`
            }]
        });

        const textBlocks = response.content.filter(b => b.type === 'text');
        return textBlocks.map(b => b.text).join(' ').trim();
    } catch (error) {
        console.error('Error getting Pelicans recap:', error.message);
        return null;
    }
}

async function getLeagueContent() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        console.log('No ANTHROPIC_API_KEY set, skipping league content');
        return null;
    }

    const client = new Anthropic();

    try {
        const response = await client.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 4096,
            tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 10 }],
            messages: [{
                role: 'user',
                content: `You are an NBA newsletter writer. Search the web for the latest NBA news from last night and today, then return a JSON object with the following sections. Be concise and engaging.

Return ONLY valid JSON (no markdown, no code fences), with this exact structure:
{
  "scores": [
    { "summary": "Team A 112, Team B 105 — brief note about the game" }
  ],
  "stats": [
    { "text": "Player Name had XX pts, XX reb, XX ast in Team's win over Team" }
  ],
  "highlights": [
    { "text": "Description of a notable play", "url": "URL to video if found, or empty string" }
  ],
  "news": [
    { "text": "Brief news item about trades, injuries, standings, etc." }
  ],
  "pundit_takes": [
    { "text": "What the pundit said", "source": "Pundit Name, Show/Platform" }
  ],
  "top_tweet": {
    "text": "The tweet text",
    "author": "@handle",
    "url": "URL to the tweet or empty string"
  }
}

Guidelines:
- "scores": Include ALL final scores from last night's NBA games. For each game, include the final score and a brief 5-10 word note.
- "stats": 3-4 standout individual performances from last night
- "highlights": 1-2 notable plays with links to NBA YouTube or social media clips if you can find them
- "news": 3-4 current NBA news items (trades, injuries, standings races, etc.)
- "pundit_takes": 3 notable takes from sports media personalities with attribution
- "top_tweet": The most notable/viral NBA tweet from yesterday

Search for: "NBA scores last night", "NBA highlights today", "NBA news today", "NBA trades rumors today"`
            }]
        });

        const textBlocks = response.content.filter(b => b.type === 'text');
        const fullText = textBlocks.map(b => b.text).join(' ').trim();

        const jsonMatch = fullText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        console.error('Could not parse league content JSON');
        return null;
    } catch (error) {
        console.error('Error getting league content:', error.message);
        return null;
    }
}

// ============ Email HTML Generation ============

function generateTVGamesSection(tvGames, dateStr) {
    if (tvGames.length === 0) {
        return `
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
            <tr><td style="padding:20px 20px 5px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;text-transform:lowercase;letter-spacing:1px;color:#333;">nba tonight</td></tr>
            <tr><td style="padding:0 20px 5px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#888;">${dateStr}</td></tr>
            <tr><td style="padding:15px 20px 20px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#888;">No national TV games today.</td></tr>
        </table>`;
    }

    let rows = '';
    for (const game of tvGames) {
        const time = formatTime(game.gameDateTimeUTC);
        const networks = game.broadcasters.nationalBroadcasters
            .map(b => b.broadcasterDisplay)
            .filter(n => isWantedNetwork(n))
            .join(', ');
        const awayAbbrev = getTeamAbbrev(game.awayTeam.teamCity, game.awayTeam.teamName);
        const homeAbbrev = getTeamAbbrev(game.homeTeam.teamCity, game.homeTeam.teamName);
        const isPelsGame = isPelicansGame(game);
        const rowBg = isPelsGame ? '#FFF8E7' : '#ffffff';
        const leftBorder = isPelsGame ? 'border-left:3px solid #C8A961;' : '';

        rows += `
            <tr style="background:${rowBg};">
                <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#111;${leftBorder}">${awayAbbrev} <span style="color:#999;font-size:11px;">@</span> ${homeAbbrev}</td>
                <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#666;text-align:center;">${time}</td>
                <td style="padding:10px 15px;text-align:right;"><span style="font-family:Arial,Helvetica,sans-serif;font-size:10px;background:#f0f0f0;color:#555;padding:3px 8px;border-radius:3px;text-transform:uppercase;">${networks}</span></td>
            </tr>`;
    }

    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
        <tr><td style="padding:20px 20px 5px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;text-transform:lowercase;letter-spacing:1px;color:#333;">nba tonight</td></tr>
        <tr><td style="padding:0 20px 10px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#888;">${dateStr}</td></tr>
        <tr><td style="padding:0 20px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                ${rows}
            </table>
        </td></tr>
    </table>`;
}

function generatePelicansSection(pelicansGames, todayGame, recap, talkingPointItems, injuries, talkingPointsFallback) {
    const { last3, next3, record } = pelicansGames;
    const recordStr = `${record.wins}-${record.losses}`;

    // Today's game callout
    let todayCallout = '';
    if (todayGame) {
        const isPelicansHome = todayGame.homeTeam.teamId === FAVORITE_TEAM_ID;
        const opponent = isPelicansHome ? todayGame.awayTeam : todayGame.homeTeam;
        const prefix = isPelicansHome ? 'vs' : '@';
        const time = formatTime(todayGame.gameDateTimeUTC);
        todayCallout = `
        <tr><td style="padding:0 20px 15px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#1A3A5C;border:2px solid #C8A961;border-radius:8px;">
                <tr><td style="padding:15px;text-align:center;">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#C8A961;margin-bottom:5px;">Tonight</div>
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:#ffffff;">${prefix} ${opponent.teamCity} ${opponent.teamName}</div>
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6B8299;margin-top:5px;">${time} PST</div>
                </td></tr>
            </table>
        </td></tr>`;
    }

    // Recap
    let recapHtml = '';
    if (recap) {
        recapHtml = `
        <tr><td style="padding:0 20px 15px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#162D4A;border:1px solid rgba(200,169,97,0.2);border-radius:8px;">
                <tr><td style="padding:15px;">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#C8A961;margin-bottom:8px;">Last Night's Recap</div>
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#E8D9A0;line-height:1.6;">${recap}</div>
                </td></tr>
            </table>
        </td></tr>`;
    }

    // Last 3 games
    let last3Rows = '';
    if (last3.length === 0) {
        last3Rows = '<tr><td colspan="3" style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6B8299;">No recent games</td></tr>';
    } else {
        for (const game of last3) {
            const isPelicansHome = game.homeTeam.teamId === FAVORITE_TEAM_ID;
            const opponent = isPelicansHome ? game.awayTeam : game.homeTeam;
            const pelicansScore = isPelicansHome ? game.homeTeam.score : game.awayTeam.score;
            const opponentScore = isPelicansHome ? game.awayTeam.score : game.homeTeam.score;
            const isWin = pelicansScore > opponentScore;
            const prefix = isPelicansHome ? 'vs' : '@';
            const resultColor = isWin ? '#7FBF7F' : '#BF7F7F';
            const resultText = isWin ? 'W' : 'L';
            const dateStr = formatShortDate(game.gameDateTimeUTC);

            last3Rows += `
                <tr>
                    <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:${resultColor};border-bottom:1px solid rgba(200,169,97,0.1);">${prefix} ${getTeamName(opponent.teamCity, opponent.teamName)}</td>
                    <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:#E8D9A0;text-align:right;border-bottom:1px solid rgba(200,169,97,0.1);">${resultText} ${pelicansScore}-${opponentScore}</td>
                    <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#6B8299;text-align:right;border-bottom:1px solid rgba(200,169,97,0.1);padding-left:10px;">${dateStr}</td>
                </tr>`;
        }
    }

    // Next 3 games
    let next3Rows = '';
    if (next3.length === 0) {
        next3Rows = '<tr><td colspan="2" style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6B8299;">No upcoming games</td></tr>';
    } else {
        for (const game of next3) {
            const isPelicansHome = game.homeTeam.teamId === FAVORITE_TEAM_ID;
            const opponent = isPelicansHome ? game.awayTeam : game.homeTeam;
            const prefix = isPelicansHome ? 'vs' : '@';
            const locationColor = isPelicansHome ? '#7FBF7F' : '#BF7F7F';
            const dateTimeStr = formatGameDateTime(game.gameDateTimeUTC);

            next3Rows += `
                <tr>
                    <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:${locationColor};border-bottom:1px solid rgba(200,169,97,0.1);">${prefix} ${getTeamName(opponent.teamCity, opponent.teamName)}</td>
                    <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#6B8299;text-align:right;border-bottom:1px solid rgba(200,169,97,0.1);">${dateTimeStr}</td>
                </tr>`;
        }
    }

    // Sound Like You Know — auto-generated items + fallback
    let talkingPointsHtml = '';
    const allItems = [...talkingPointItems];
    if (talkingPointsFallback && talkingPointsFallback.item) {
        allItems.push(talkingPointsFallback.item);
    }
    if (allItems.length > 0) {
        const itemRows = allItems.map(item => `
            <tr><td style="padding:0;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(200,169,97,0.1);border-left:3px solid #C8A961;border-radius:0 6px 6px 0;margin-bottom:8px;">
                    <tr><td style="padding:10px 12px;">
                        <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#C8A961;margin-bottom:3px;">${item.label}</div>
                        <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#E8D9A0;line-height:1.4;">${item.text}</div>
                    </td></tr>
                </table>
            </td></tr>`).join('');

        talkingPointsHtml = `
        <tr><td style="padding:0 20px 15px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#162D4A;border:1px solid rgba(200,169,97,0.2);border-radius:8px;">
                <tr><td style="padding:15px;">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#C8A961;margin-bottom:10px;">Sound Like You Know</div>
                    <table width="100%" cellpadding="0" cellspacing="0">${itemRows}</table>
                </td></tr>
            </table>
        </td></tr>`;
    }

    // Injury report
    let injuryHtml = '';
    if (injuries && injuries.length > 0) {
        const injuryRows = injuries.map(inj => {
            const statusBg = inj.isOut ? '#5C1F1F' : '#5C4A1F';
            const statusColor = inj.isOut ? '#E87777' : '#E8C777';
            return `
                <tr>
                    <td style="padding:5px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#ccc;">${inj.name}</td>
                    <td style="padding:5px 0;text-align:right;"><span style="font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:bold;text-transform:uppercase;background:${statusBg};color:${statusColor};padding:2px 8px;border-radius:10px;">${inj.label}</span></td>
                </tr>`;
        }).join('');

        injuryHtml = `
        <tr><td style="padding:0 20px 15px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#162D4A;border:1px solid rgba(200,169,97,0.2);border-radius:8px;">
                <tr><td style="padding:15px;">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#C8A961;margin-bottom:10px;">Injury Report</div>
                    <table width="100%" cellpadding="0" cellspacing="0">${injuryRows}</table>
                </td></tr>
            </table>
        </td></tr>`;
    }

    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0C2340;">
        <!-- Gold/red accent bar -->
        <tr><td style="height:4px;background:linear-gradient(90deg,#C8A961,#E31837,#C8A961);font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- Header -->
        <tr><td style="padding:25px 20px 5px;text-align:center;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:bold;color:#C8A961;text-transform:uppercase;letter-spacing:3px;">Pelicans Central</div>
        </td></tr>
        <tr><td style="padding:5px 20px 20px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6B8299;letter-spacing:1px;">${recordStr}</td></tr>

        <!-- Tonight's game -->
        ${todayCallout}

        <!-- Recap -->
        ${recapHtml}

        <!-- Last 3 / Next 3 side by side -->
        <tr><td style="padding:0 20px 15px;">
            <table width="100%" cellpadding="0" cellspacing="0">
                <tr valign="top">
                    <!-- Last 3 -->
                    <td width="48%" style="padding-right:2%;">
                        <table width="100%" cellpadding="0" cellspacing="0" style="background:#162D4A;border:1px solid rgba(200,169,97,0.2);border-radius:8px;">
                            <tr><td style="padding:15px;">
                                <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#C8A961;margin-bottom:10px;">Last 3 Games</div>
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    ${last3Rows}
                                </table>
                            </td></tr>
                        </table>
                    </td>
                    <!-- Next 3 -->
                    <td width="48%" style="padding-left:2%;">
                        <table width="100%" cellpadding="0" cellspacing="0" style="background:#162D4A;border:1px solid rgba(200,169,97,0.2);border-radius:8px;">
                            <tr><td style="padding:15px;">
                                <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#C8A961;margin-bottom:10px;">Next 3 Games</div>
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    ${next3Rows}
                                </table>
                            </td></tr>
                        </table>
                    </td>
                </tr>
            </table>
        </td></tr>

        <!-- Talking Points -->
        ${talkingPointsHtml}

        <!-- Injury Report -->
        ${injuryHtml}
    </table>`;
}

function generateLeagueSection(leagueContent) {
    if (!leagueContent) {
        return '';
    }

    // Scores
    let scoresHtml = '';
    if (leagueContent.scores && leagueContent.scores.length > 0) {
        const scoreRows = leagueContent.scores.map(s =>
            `<tr><td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#E0E0E0;border-bottom:1px solid #444;">&#8226; ${s.summary}</td></tr>`
        ).join('');
        scoresHtml = `
        <tr><td style="padding:0 20px 15px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#3A3A3A;border-radius:8px;">
                <tr><td style="padding:15px;">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#FFD700;margin-bottom:10px;">Last Night's Scores</div>
                    <table width="100%" cellpadding="0" cellspacing="0">${scoreRows}</table>
                </td></tr>
            </table>
        </td></tr>`;
    }

    // Stats
    let statsHtml = '';
    if (leagueContent.stats && leagueContent.stats.length > 0) {
        const statRows = leagueContent.stats.map(s =>
            `<tr><td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#E0E0E0;border-bottom:1px solid #444;">&#8226; ${s.text}</td></tr>`
        ).join('');
        statsHtml = `
        <tr><td style="padding:0 20px 15px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#3A3A3A;border-radius:8px;">
                <tr><td style="padding:15px;">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#FFD700;margin-bottom:10px;">Notable Stats</div>
                    <table width="100%" cellpadding="0" cellspacing="0">${statRows}</table>
                </td></tr>
            </table>
        </td></tr>`;
    }

    // Highlights
    let highlightsHtml = '';
    if (leagueContent.highlights && leagueContent.highlights.length > 0) {
        const highlightRows = leagueContent.highlights.map(h => {
            const link = h.url ? ` <a href="${h.url}" style="color:#64B5F6;text-decoration:underline;">Watch</a>` : '';
            return `<tr><td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#E0E0E0;border-bottom:1px solid #444;">&#8226; ${h.text}${link}</td></tr>`;
        }).join('');
        highlightsHtml = `
        <tr><td style="padding:0 20px 15px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#3A3A3A;border-radius:8px;">
                <tr><td style="padding:15px;">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#FFD700;margin-bottom:10px;">Highlights</div>
                    <table width="100%" cellpadding="0" cellspacing="0">${highlightRows}</table>
                </td></tr>
            </table>
        </td></tr>`;
    }

    // News
    let newsHtml = '';
    if (leagueContent.news && leagueContent.news.length > 0) {
        const newsRows = leagueContent.news.map(n =>
            `<tr><td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#E0E0E0;border-bottom:1px solid #444;">&#8226; ${n.text}</td></tr>`
        ).join('');
        newsHtml = `
        <tr><td style="padding:0 20px 15px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#3A3A3A;border-radius:8px;">
                <tr><td style="padding:15px;">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#FFD700;margin-bottom:10px;">League News</div>
                    <table width="100%" cellpadding="0" cellspacing="0">${newsRows}</table>
                </td></tr>
            </table>
        </td></tr>`;
    }

    // Pundit takes
    let punditHtml = '';
    if (leagueContent.pundit_takes && leagueContent.pundit_takes.length > 0) {
        const punditRows = leagueContent.pundit_takes.map(p =>
            `<tr><td style="padding:8px 0;border-bottom:1px solid #444;">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#E0E0E0;font-style:italic;">"${p.text}"</div>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#999;margin-top:3px;">— ${p.source}</div>
            </td></tr>`
        ).join('');
        punditHtml = `
        <tr><td style="padding:0 20px 15px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#3A3A3A;border-radius:8px;">
                <tr><td style="padding:15px;">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#FFD700;margin-bottom:10px;">Pundit Takes</div>
                    <table width="100%" cellpadding="0" cellspacing="0">${punditRows}</table>
                </td></tr>
            </table>
        </td></tr>`;
    }

    // Top tweet
    let tweetHtml = '';
    if (leagueContent.top_tweet && leagueContent.top_tweet.text) {
        const tweetLink = leagueContent.top_tweet.url ? ` <a href="${leagueContent.top_tweet.url}" style="color:#64B5F6;text-decoration:underline;">View</a>` : '';
        tweetHtml = `
        <tr><td style="padding:0 20px 15px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#3A3A3A;border-radius:8px;">
                <tr><td style="padding:15px;">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#FFD700;margin-bottom:10px;">Top Tweet</div>
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#E0E0E0;font-style:italic;border-left:3px solid #64B5F6;padding-left:10px;">"${leagueContent.top_tweet.text}"</div>
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#999;margin-top:5px;">${leagueContent.top_tweet.author}${tweetLink}</div>
                </td></tr>
            </table>
        </td></tr>`;
    }

    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#2D2D2D;">
        <tr><td style="padding:25px 20px 5px;text-align:center;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:#FFD700;text-transform:uppercase;letter-spacing:3px;">Around the League</div>
        </td></tr>
        <tr><td style="padding:5px 20px 20px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#999;">Powered by Claude AI with web search</td></tr>
        ${scoresHtml}
        ${statsHtml}
        ${highlightsHtml}
        ${newsHtml}
        ${punditHtml}
        ${tweetHtml}
    </table>`;
}

function generateFullEmail(dateStr, tvSection, pelicansSection, leagueSection) {
    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NBA Today - ${dateStr}</title>
</head>
<body style="margin:0;padding:0;background:#111111;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#111111;">
        <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;">
                <!-- TV Games -->
                <tr><td>${tvSection}</td></tr>
                <!-- Pelicans -->
                <tr><td>${pelicansSection}</td></tr>
                <!-- League -->
                <tr><td>${leagueSection}</td></tr>
                <!-- Footer -->
                <tr><td style="background:#111111;padding:20px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#666;">
                    NBA Today Newsletter &bull; Generated ${dateStr}
                </td></tr>
            </table>
        </td></tr>
    </table>
</body>
</html>`;
}

// ============ Email Sending ============

async function sendEmail(html, dateStr) {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    const to = process.env.EMAIL_TO;

    if (!user || !pass || !to) {
        console.log('Missing email env vars (GMAIL_USER, GMAIL_APP_PASSWORD, EMAIL_TO). Writing to output.html instead.');
        fs.writeFileSync('output.html', html);
        console.log('Email HTML written to output.html');
        return;
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
    });

    await transporter.sendMail({
        from: `"NBA Today" <${user}>`,
        to,
        subject: `NBA Today - ${dateStr}`,
        html
    });

    console.log(`Email sent to ${to}`);
}

// ============ Main ============

async function main() {
    const dateStr = formatDate();
    const todayMatch = getTodayDateString();

    console.log('Building NBA Today email for:', todayMatch, '(' + dateStr + ')');

    // Load data files
    const talkingPointsFallback = loadJsonFile('./data/talking-points.json');

    let tvGames = [];
    let pelicansGames = { last3: [], last5: [], next3: [], record: { wins: 0, losses: 0 } };
    let todayGame = null;
    let boxScore = null;

    try {
        const scheduleData = await fetch('https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json');

        pelicansGames = getPelicansGames(scheduleData);
        todayGame = getPelicansToday(scheduleData, todayMatch);
        tvGames = getTVGames(scheduleData, todayMatch);

        console.log(`Pelicans record: ${pelicansGames.record.wins}-${pelicansGames.record.losses}`);
        console.log(`TV games today: ${tvGames.length}`);
        console.log(`Pelicans play today: ${todayGame ? 'Yes' : 'No'}`);

        // Fetch box score for last game (for Sound Like You Know)
        if (pelicansGames.last3.length > 0 && pelicansGames.last3[0].gameId) {
            try {
                boxScore = await fetchBoxScore(pelicansGames.last3[0].gameId);
                console.log('Fetched box score for game:', pelicansGames.last3[0].gameId);
            } catch (e) {
                console.log('Could not fetch box score:', e.message);
            }
        }
    } catch (error) {
        console.error('Error fetching schedule:', error);
    }

    // Generate auto talking points from box score
    const talkingPointItems = generateAutoTalkingPointsEmail(boxScore, pelicansGames.last5);

    // Fetch injury report
    const injuries = await fetchInjuryReport();
    console.log(`Injury report: ${injuries.length} entries`);

    // Check if Pelicans played yesterday and get recap
    const yesterdayGame = didPelicansPlayYesterday(pelicansGames);
    let recap = null;
    if (yesterdayGame) {
        console.log('Pelicans played yesterday, getting recap...');
        recap = await getPelicansRecap(yesterdayGame);
    }

    // Get league content from Claude
    console.log('Fetching league content from Claude...');
    const leagueContent = await getLeagueContent();

    // Generate email sections
    const tvSection = generateTVGamesSection(tvGames, dateStr);
    const pelicansSection = generatePelicansSection(pelicansGames, todayGame, recap, talkingPointItems, injuries, talkingPointsFallback);
    const leagueSection = generateLeagueSection(leagueContent);

    // Generate full email
    const emailHtml = generateFullEmail(dateStr, tvSection, pelicansSection, leagueSection);

    // Send email
    await sendEmail(emailHtml, dateStr);

    console.log('Done!');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
