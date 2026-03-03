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

// Team primary colors (dark enough to read on white)
const TEAM_COLORS = {
    'Atlanta Hawks': '#C8102E', 'Boston Celtics': '#007A33', 'Brooklyn Nets': '#000000',
    'Charlotte Hornets': '#1D1160', 'Chicago Bulls': '#CE1141', 'Cleveland Cavaliers': '#6F263D',
    'Dallas Mavericks': '#00538C', 'Denver Nuggets': '#0E2240', 'Detroit Pistons': '#C8102E',
    'Golden State Warriors': '#1D428A', 'Houston Rockets': '#CE1141', 'Indiana Pacers': '#002D62',
    'Los Angeles Clippers': '#C8102E', 'Los Angeles Lakers': '#552583', 'Memphis Grizzlies': '#5D76A9',
    'Miami Heat': '#98002E', 'Milwaukee Bucks': '#00471B', 'Minnesota Timberwolves': '#0C2340',
    'New Orleans Pelicans': '#C8A961', 'New York Knicks': '#006BB6', 'Oklahoma City Thunder': '#007AC1',
    'Orlando Magic': '#0077C0', 'Philadelphia 76ers': '#006BB6', 'Phoenix Suns': '#1D1160',
    'Portland Trail Blazers': '#E03A3E', 'Sacramento Kings': '#5A2D81', 'San Antonio Spurs': '#000000',
    'Toronto Raptors': '#CE1141', 'Utah Jazz': '#002B5C', 'Washington Wizards': '#002B5C'
};

function getTeamColor(city, name) {
    return TEAM_COLORS[`${city} ${name}`] || '#333';
}

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

// Track API usage across calls
const apiUsage = { inputTokens: 0, outputTokens: 0 };

// Claude Sonnet 4.5 pricing per million tokens
const PRICING = { input: 3.0, output: 15.0 };

function trackUsage(response) {
    if (response.usage) {
        apiUsage.inputTokens += response.usage.input_tokens || 0;
        apiUsage.outputTokens += response.usage.output_tokens || 0;
    }
}

function getApiCost() {
    const inputCost = (apiUsage.inputTokens / 1_000_000) * PRICING.input;
    const outputCost = (apiUsage.outputTokens / 1_000_000) * PRICING.output;
    return (inputCost + outputCost).toFixed(4);
}

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

        trackUsage(response);
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
  ]
}

Guidelines:
- "scores": Only the 2-3 most notable/exciting games from last night. Include the final score and a brief 5-10 word note. Skip blowouts and uneventful games.
- "stats": 2-3 standout individual performances from last night
- "highlights": 1-2 notable plays with links to NBA YouTube or social media clips if you can find them
- "news": 2-3 current NBA news items (trades, injuries, standings races, etc.)

Search for: "NBA scores last night", "NBA highlights today", "NBA news today", "NBA trades rumors today"`
            }]
        });

        trackUsage(response);
        const textBlocks = response.content.filter(b => b.type === 'text');
        const fullText = textBlocks.map(b => b.text).join(' ').trim();

        // Strip markdown code fences before parsing
        let cleaned = fullText.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

        // Try direct parse first
        try {
            return JSON.parse(cleaned);
        } catch (e) {
            // Fall back to regex extraction
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                } catch (e2) {
                    console.error('Could not parse league content JSON:', e2.message);
                    console.error('Raw text (first 500 chars):', fullText.substring(0, 500));
                    return null;
                }
            }
            console.error('No JSON object found in league content');
            console.error('Raw text (first 500 chars):', fullText.substring(0, 500));
            return null;
        }
    } catch (error) {
        console.error('Error getting league content:', error.message);
        return null;
    }
}

// ============ Email HTML Generation ============

const S = {
    font: 'font-family:Arial,Helvetica,sans-serif;',
    body: 'font-size:14px;color:#333;line-height:22px;',
    header: 'font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;color:#333;',
    subheader: 'font-size:14px;font-weight:bold;color:#555;',
    divider: 'border-top:1px solid #ddd;',
    pad: 'padding:0 20px;',
    winColor: '#2d8a4e',
    lossColor: '#c0392b',
    gold: '#C8A961',
};

function row(content, style = '') {
    return `<tr><td style="${S.font}${S.body}${S.pad}${style}">${content}</td></tr>`;
}

function dividerRow() {
    return `<tr><td style="padding:15px 20px;"><div style="${S.divider}"></div></td></tr>`;
}

function sectionHeader(text) {
    return row(text, `${S.header}padding-top:20px;padding-bottom:10px;`);
}

function generateEmail(dateStr, tvGames, pelicansGames, todayGame, recap, talkingPointItems, injuries, talkingPointsFallback, leagueContent, cost) {
    const { last3, next3, record } = pelicansGames;
    const rows = [];

    // ── Title ──
    rows.push(`<tr><td style="${S.font}padding:30px 20px 2px;font-size:28px;font-weight:bold;color:#111;">NBA Today</td></tr>`);
    rows.push(`<tr><td style="${S.font}padding:0 20px 5px;font-size:13px;color:#999;">${dateStr}</td></tr>`);
    rows.push(dividerRow());

    // ── TONIGHT ON TV ──
    rows.push(`<tr><td style="${S.font}${S.pad}padding-top:20px;padding-bottom:10px;font-size:22px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;color:${S.gold};">Tonight on TV</td></tr>`);
    if (tvGames.length === 0) {
        rows.push(row('No national TV games today.', 'color:#999;padding-bottom:10px;'));
    } else {
        for (const game of tvGames) {
            const time = formatTime(game.gameDateTimeUTC);
            const networks = game.broadcasters.nationalBroadcasters
                .map(b => b.broadcasterDisplay)
                .filter(n => isWantedNetwork(n))
                .join(', ');
            const awayColor = getTeamColor(game.awayTeam.teamCity, game.awayTeam.teamName);
            const homeColor = getTeamColor(game.homeTeam.teamCity, game.homeTeam.teamName);
            const away = `<span style="color:${awayColor};">${game.awayTeam.teamCity} ${game.awayTeam.teamName}</span>`;
            const home = `<span style="color:${homeColor};">${game.homeTeam.teamCity} ${game.homeTeam.teamName}</span>`;
            rows.push(row(`&nbsp;&nbsp;${away} @ ${home} &middot; ${time} (${networks})`, 'padding-bottom:4px;'));
        }
    }
    rows.push(dividerRow());

    // ── PELICANS CENTRAL ──
    const recordStr = `${record.wins}-${record.losses}`;
    rows.push(`<tr><td style="${S.font}${S.pad}padding-top:20px;padding-bottom:2px;font-size:22px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;color:${S.gold};">Pelicans Central</td></tr>`);
    rows.push(`<tr><td style="${S.font}${S.pad}padding-bottom:12px;font-size:13px;color:#999;">${recordStr}</td></tr>`);

    // Tonight callout
    if (todayGame) {
        const isPelicansHome = todayGame.homeTeam.teamId === FAVORITE_TEAM_ID;
        const opponent = isPelicansHome ? todayGame.awayTeam : todayGame.homeTeam;
        const prefix = isPelicansHome ? 'vs' : '@';
        const time = formatTime(todayGame.gameDateTimeUTC);
        rows.push(row(`<span style="font-size:16px;color:${S.lossColor};font-weight:bold;">&#9658; TONIGHT</span><br>&nbsp;&nbsp;&nbsp;${prefix} ${opponent.teamCity} ${opponent.teamName} &middot; ${time} PST`, 'padding-bottom:12px;'));
    }

    // Last Night recap
    if (recap) {
        let recapLines = `&nbsp;&nbsp;&nbsp;${recap}`;
        rows.push(row(`<strong>Last Night</strong><br>${recapLines}`, 'padding-bottom:12px;'));
    }

    // Coming Up
    if (next3.length > 0) {
        let comingUpLines = '';
        for (const game of next3) {
            const isPelicansHome = game.homeTeam.teamId === FAVORITE_TEAM_ID;
            const opponent = isPelicansHome ? game.awayTeam : game.homeTeam;
            const prefix = isPelicansHome ? 'vs' : '@';
            const oppName = getTeamName(opponent.teamCity, opponent.teamName);
            const dateTimeStr = formatGameDateTime(game.gameDateTimeUTC);
            comingUpLines += `<br>&nbsp;&nbsp;&nbsp;${prefix} ${oppName}&nbsp;&nbsp;&nbsp;<span style="color:#999;">${dateTimeStr}</span>`;
        }
        rows.push(row(`<strong>Coming Up</strong>${comingUpLines}`, 'padding-bottom:12px;'));
    }

    // Last 3 Results
    if (last3.length > 0) {
        let last3Lines = '';
        for (const game of last3) {
            const isPelicansHome = game.homeTeam.teamId === FAVORITE_TEAM_ID;
            const opponent = isPelicansHome ? game.awayTeam : game.homeTeam;
            const pelScore = isPelicansHome ? game.homeTeam.score : game.awayTeam.score;
            const oppScore = isPelicansHome ? game.awayTeam.score : game.homeTeam.score;
            const isWin = pelScore > oppScore;
            const wl = isWin ? 'W' : 'L';
            const wlColor = isWin ? S.winColor : S.lossColor;
            const prefix = isPelicansHome ? 'vs' : '@';
            const oppName = getTeamName(opponent.teamCity, opponent.teamName);
            const dateShort = formatShortDate(game.gameDateTimeUTC);
            last3Lines += `<br>&nbsp;&nbsp;&nbsp;<span style="color:${wlColor};font-weight:bold;">${wl}</span>&nbsp;&nbsp;${prefix} ${oppName}&nbsp;&nbsp;&nbsp;${pelScore}-${oppScore}&nbsp;&nbsp;&nbsp;<span style="color:#999;">${dateShort}</span>`;
        }
        rows.push(row(`<strong>Last 3 Results</strong>${last3Lines}`, 'padding-bottom:12px;'));
    }

    // Injuries
    if (injuries && injuries.length > 0) {
        let injuryLines = '';
        for (const inj of injuries) {
            injuryLines += `<br>&nbsp;&nbsp;&nbsp;${inj.name} &mdash; Out`;
        }
        rows.push(row(`<strong>Injuries</strong>${injuryLines}`, 'padding-bottom:12px;'));
    }

    // Recent Pelicans Notes (auto-generated only, no fallback)
    const allItems = [...talkingPointItems];
    if (allItems.length > 0) {
        let noteLines = '';
        for (const item of allItems) {
            noteLines += `<br>&nbsp;&nbsp;&nbsp;<span style="color:#999;font-size:11px;text-transform:uppercase;">${item.label}</span><br>&nbsp;&nbsp;&nbsp;${item.text}`;
        }
        rows.push(row(`<strong>Recent Pelicans Notes</strong>${noteLines}`, 'padding-bottom:12px;'));
    }

    rows.push(dividerRow());

    // ── AROUND THE LEAGUE ──
    if (leagueContent) {
        rows.push(`<tr><td style="${S.font}${S.pad}padding-top:20px;padding-bottom:10px;font-size:22px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;color:${S.gold};">Around the League</td></tr>`);

        // Last Night's Scores
        if (leagueContent.scores && leagueContent.scores.length > 0) {
            rows.push(row(`<strong style="color:#555;">Last Night's Scores</strong>`, 'padding-bottom:6px;'));
            for (const s of leagueContent.scores) {
                rows.push(row(`&nbsp;&nbsp;&bull; ${s.summary}`, 'padding-bottom:3px;'));
            }
            rows.push(row('', 'padding-bottom:8px;'));
        }

        // Notable Stats
        if (leagueContent.stats && leagueContent.stats.length > 0) {
            rows.push(row(`<strong style="color:#555;">Notable Stats</strong>`, 'padding-bottom:6px;'));
            for (const s of leagueContent.stats) {
                rows.push(row(`&nbsp;&nbsp;&bull; ${s.text}`, 'padding-bottom:3px;'));
            }
            rows.push(row('', 'padding-bottom:8px;'));
        }

        // Highlights
        if (leagueContent.highlights && leagueContent.highlights.length > 0) {
            rows.push(row(`<strong style="color:#555;">Highlights</strong>`, 'padding-bottom:6px;'));
            for (const h of leagueContent.highlights) {
                const link = h.url ? ` &mdash; <a href="${h.url}" style="color:#2563eb;">Watch</a>` : '';
                rows.push(row(`&nbsp;&nbsp;&bull; ${h.text}${link}`, 'padding-bottom:3px;'));
            }
            rows.push(row('', 'padding-bottom:8px;'));
        }

        // League News
        if (leagueContent.news && leagueContent.news.length > 0) {
            rows.push(row(`<strong style="color:#555;">League News</strong>`, 'padding-bottom:6px;'));
            for (const n of leagueContent.news) {
                rows.push(row(`&nbsp;&nbsp;&bull; ${n.text}`, 'padding-bottom:3px;'));
            }
            rows.push(row('', 'padding-bottom:8px;'));
        }

        rows.push(dividerRow());
    }

    // ── Footer ──
    const costStr = cost ? ` &middot; API cost: $${cost}` : '';
    rows.push(`<tr><td style="${S.font}padding:10px 20px 30px;font-size:11px;color:#bbb;">NBA Today &middot; Generated ${dateStr}${costStr}</td></tr>`);

    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NBA Today - ${dateStr}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;${S.font}">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;">
        <tr><td align="center" style="padding:20px 0;">
            <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;background:#ffffff;">
                ${rows.join('\n                ')}
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

    // Get league content from Claude (retry up to 3 times)
    let leagueContent = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`Fetching league content from Claude (attempt ${attempt}/3)...`);
        leagueContent = await getLeagueContent();
        if (leagueContent) break;
        console.log(`Attempt ${attempt} failed, ${attempt < 3 ? 'retrying...' : 'giving up.'}`);
    }

    // Generate email
    const cost = getApiCost();
    console.log(`API cost: $${cost} (${apiUsage.inputTokens} input, ${apiUsage.outputTokens} output tokens)`);
    const emailHtml = generateEmail(dateStr, tvGames, pelicansGames, todayGame, recap, talkingPointItems, injuries, talkingPointsFallback, leagueContent, cost);

    // Send email
    await sendEmail(emailHtml, dateStr);

    console.log('Done!');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
