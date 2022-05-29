const GAMES_PER_SEASON = 82;
const IMAGE_POINT_SIZE_PX = 24;

var parsedTeamData = JSON.parse(chartJsonData);

const ctx = document.getElementById('standings_canvas').getContext('2d');

var standingsChart = new Chart(ctx, {
    type: 'line',
    data: {},
    options: {
        layout: {
            padding: IMAGE_POINT_SIZE_PX
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                xAlign: 'right',
                yAlign: 'top',
                caretPadding: 8,
                cornerRadius: 0
            }
        },
        scales: {
            x: {
                type: 'linear',
                max: GAMES_PER_SEASON
            },
            y: {
                beginAtZero: true
            }
        },
        onHover: onHoverHandler,
    }
});


function onHoverHandler(event, activeElements) {
    var activeIndices = new Set();
    for (let i = 0; i < activeElements.length; i++) {
        activeIndices.add(activeElements[i].datasetIndex);
    }

    if (activeIndices.size > 0) {
        for (let datasetIdx = 0; datasetIdx < standingsChart.data.datasets.length; datasetIdx++) {
            let dataset = standingsChart.data.datasets[datasetIdx]
            if (activeIndices.has(datasetIdx)) {
                dataset.backgroundColor = dataset.team.primary_colour;
                dataset.borderColor = dataset.team.secondary_colour;
                dataset.order = dataset.team.league_rank - 100;
            } else {
                dataset.backgroundColor = "#ababab";
                dataset.borderColor = "#ababab";
            }
        }
    } else {
        for (let datasetIdx = 0; datasetIdx < standingsChart.data.datasets.length; datasetIdx++) {
            let dataset = standingsChart.data.datasets[datasetIdx]
            dataset.backgroundColor = dataset.team.primary_colour;
            dataset.borderColor = dataset.team.secondary_colour;
            dataset.order = dataset.team.league_rank;
        }
    }

    standingsChart.update();
}


function gamesBehind(teamAWins, teamALosses, teamBWins, teamBLosses) {
    // Computes games behind value from two teams' records
    return ((teamAWins - teamALosses) - (teamBWins - teamBLosses)) / 2;
}


function getLogoForTeam(teamName) {
    var img = new Image(IMAGE_POINT_SIZE_PX, IMAGE_POINT_SIZE_PX);
    img.src = imageFolderBasePath + "/" + teamName + ".png";
    img.style.filter = "alpha(opacity=50)";
    img.style.opacity = 0.5;
    return img;
}


function getTeamGamesBehindDatasets(teamData, conference) {
    // {"games": [{"cumulative_losses": 0, "cumulative_wins": 1, "date": "2021-10-21T00:00:00", "game_num": 0, 
    //             "id": 22100014, "matchup": "ATL vs. DAL", "outcome": "W"}, 
    //            ... 
    //           ],
    //  "primary_colour": "#123456"}
    //  "secondary_colour": "#123456"}
    //  "team_name": "Atlanta Hawks"}
    var datasets = [];

    // Compute the greatest total number of games played by any team in the league
    var maxGamesPlayed = 0;
    for (let teamIdx = 0; teamIdx < teamData.length; teamIdx++) {
        let teamGamesPlayed = teamData[teamIdx].games.length;
        if (teamGamesPlayed > maxGamesPlayed) {
            maxGamesPlayed = teamGamesPlayed;
        }
    }

    // // Initialise leading record at each game to worst possible record
    // var leadingRecordOverTime = [];
    // for (let i = 0; i < maxGamesPlayed; i++) {
    //     leadingRecordOverTime[i] = [0, i + 1];
    // }

    // // Compute the best record over time for each game played
    // for (let team_idx = 0; team_idx < teamData.length; team_idx++) {
    //     let team = teamData[team_idx];
    //     for (let game_idx = 0; game_idx < team.games.length; game_idx++) {
    //         let game = team.games[game_idx];
    //         let leadingRecordAtTime = leadingRecordOverTime[game_idx];
    //         if (gamesBehind(leadingRecordAtTime[0], leadingRecordAtTime[1], game.cumulative_wins, game.cumulative_losses) < 0) {
    //             // Teams record at time is better: assign it as the leading record at the current game
    //             leadingRecordOverTime[game_idx] = [game.cumulative_wins, game.cumulative_losses];
    //         }
    //     }
    // }


    for (let teamIdx = 0; teamIdx < teamData.length; teamIdx++) {
        let team = teamData[teamIdx];

        // let pointData = [{x: 0, y: 0}];  // Start from origin point
        let pointData = [];
        for (let gameIdx = 0; gameIdx < team.games.length; gameIdx++) {
            game = team.games[gameIdx];
            // let leadingRecordAtTime = leadingRecordOverTime[game_idx];
            // let gamesBehindAtTime = gamesBehind(leadingRecordAtTime[0], leadingRecordAtTime[1], game.cumulative_wins, game.cumulative_losses);
            gameDataPoint = {x: game.game_num, y: game.cumulative_wins - game.cumulative_losses};
            pointData.push(gameDataPoint);
        }
        
        // Set point style for all data to circle, except the last which is the team's logo
        (linePointStyles = []).length = pointData.length; 
        linePointStyles.fill('circle');
        linePointStyles[linePointStyles.length - 1] = getLogoForTeam(team.name);


        (linePointRadii = []).length = pointData.length; 
        linePointRadii.fill(3);
        linePointRadii[linePointRadii.length - 1] = IMAGE_POINT_SIZE_PX;


        (linePointHoverRadii = []).length = pointData.length; 
        linePointHoverRadii.fill(5);
        linePointHoverRadii[linePointHoverRadii.length - 1] = IMAGE_POINT_SIZE_PX;

        let dataset = {
            team: team,
            label: team.name,
            data: pointData,
            backgroundColor: team.primary_colour,
            borderColor: team.secondary_colour,
            borderWidth: 2,
            pointStyle: linePointStyles,
            pointRadius: linePointRadii,
            pointHoverRadius: linePointHoverRadii,
            tension: 0.5,
            clip: {left: false, top: false, right: IMAGE_POINT_SIZE_PX, bottom: false},
            hidden: false,
            order: team.league_rank,
            parsing: false
        }
        datasets.push(dataset);
    }

    return datasets;
}

function renderTeamGamesBehindGraph(teamData, conference) {
    var teamDatasets = getTeamGamesBehindDatasets(teamData, conference);
    standingsChart.data.datasets = teamDatasets;
    standingsChart.update();
}


function onConferenceSelection(selectedConference) {
    for (let i = 0; i < standingsChart.data.datasets.length; i++) {
        let team = standingsChart.data.datasets[i].team;
        console.log(team.conference);
        standingsChart.data.datasets[i].hidden = (selectedConference !== "All" && selectedConference !== team.conference);
    }
    standingsChart.update();
}


renderTeamGamesBehindGraph(parsedTeamData, conference="all");

