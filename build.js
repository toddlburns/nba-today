const fs = require('fs');
const https = require('https');

// Only these networks (excluding NBA TV)
const NATIONAL_NETWORKS = ['ESPN', 'TNT', 'ABC'];

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

function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/New_York'
    });
}

async function buildPage() {
    const today = new Date();
    const dateStr = formatDate(today);

    let gamesHtml = '';

    try {
        // Try the scoreboard endpoint first
        const data = await fetch('https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json');

        if (data.scoreboard && data.scoreboard.games) {
            const nationalGames = data.scoreboard.games.filter(game => {
                if (!game.broadcasters || !game.broadcasters.nationalBroadcasters) return false;
                const networks = game.broadcasters.nationalBroadcasters.map(b =>
                    (b.broadcasterDisplay || b.broadcasterName || '').toUpperCase()
                );
                // Check if any national network (excluding NBA TV)
                return networks.some(n => NATIONAL_NETWORKS.some(nn => n.includes(nn)));
            });

            if (nationalGames.length > 0) {
                nationalGames.forEach(game => {
                    const time = formatTime(game.gameTimeUTC);
                    const national = game.broadcasters.nationalBroadcasters || [];
                    const networks = national
                        .map(b => b.broadcasterDisplay || b.broadcasterName)
                        .filter(n => NATIONAL_NETWORKS.some(nn => n.toUpperCase().includes(nn)))
                        .join(', ');

                    gamesHtml += `
            <div class="game">
                <div class="teams">${game.awayTeam.teamCity} ${game.awayTeam.teamName} <span class="at-symbol">@</span> ${game.homeTeam.teamCity} ${game.homeTeam.teamName}</div>
                <div class="details">
                    <span class="time">${time}</span>
                    <span class="network">${networks}</span>
                </div>
            </div>`;
                });
            } else {
                gamesHtml = `<div class="no-games">There are no nationally televised games tonight.</div>`;
            }
        } else {
            gamesHtml = `<div class="no-games">There are no nationally televised games tonight.</div>`;
        }
    } catch (error) {
        console.error('Error fetching games:', error);
        // Try schedule endpoint as fallback
        try {
            const scheduleData = await fetch('https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json');
            const todayStr = today.toDateString();

            const gameDay = scheduleData.leagueSchedule.gameDates.find(gd => {
                const gDate = new Date(gd.gameDate);
                return gDate.toDateString() === todayStr;
            });

            if (gameDay && gameDay.games) {
                const nationalGames = gameDay.games.filter(game => {
                    if (!game.broadcasters || !game.broadcasters.nationalTvBroadcasters) return false;
                    const networks = game.broadcasters.nationalTvBroadcasters.map(b =>
                        (b.broadcasterDisplay || '').toUpperCase()
                    );
                    return networks.some(n => NATIONAL_NETWORKS.some(nn => n.includes(nn)));
                });

                if (nationalGames.length > 0) {
                    nationalGames.forEach(game => {
                        const time = formatTime(game.gameDateTimeUTC);
                        const networks = game.broadcasters.nationalTvBroadcasters
                            .map(b => b.broadcasterDisplay)
                            .filter(n => NATIONAL_NETWORKS.some(nn => n.toUpperCase().includes(nn)))
                            .join(', ');

                        gamesHtml += `
            <div class="game">
                <div class="teams">${game.awayTeam.teamCity} ${game.awayTeam.teamName} <span class="at-symbol">@</span> ${game.homeTeam.teamCity} ${game.homeTeam.teamName}</div>
                <div class="details">
                    <span class="time">${time}</span>
                    <span class="network">${networks}</span>
                </div>
            </div>`;
                    });
                } else {
                    gamesHtml = `<div class="no-games">There are no nationally televised games tonight.</div>`;
                }
            } else {
                gamesHtml = `<div class="no-games">There are no nationally televised games tonight.</div>`;
            }
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
            gamesHtml = `<div class="no-games">There are no nationally televised games tonight.</div>`;
        }
    }

    // Read template and inject content
    let html = fs.readFileSync('index.html', 'utf8');
    html = html.replace('<div class="date" id="date">Loading...</div>', `<div class="date" id="date">${dateStr}</div>`);
    html = html.replace('<!-- Games will be injected by build process -->', gamesHtml);

    fs.writeFileSync('index.html', html);
    console.log('Page built successfully for', dateStr);
}

buildPage();
