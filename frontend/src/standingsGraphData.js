const GAMES_PER_SEASON = 82;
const IMAGE_POINT_SIZE_PX = 24;

// Standings graph user options

const standingsGraphTeamOptions = {
    all: 'All',
    east: 'East',
    west: 'West',
    // hottest: 'hottest 🔥', TODO
    // coldest: 'coldest ❄️'  TODO
}

const standingsGraphXAxisGamesOptions = {
    all: GAMES_PER_SEASON,
    10: 10,
    20: 20,
    40: 40
}

const standingsGraphXAxisTimeResolutionOptions = {
    gameToGame: 'game-to-game',
    weekToWeek: 'week-to-week',
    monthToMonth: 'month-to-month'
}

const standingsGraphYAxisOptions = {
    record: 'record',
    seed: 'seed'
}


// The basic graph options
const standingsGraphOptionsBase = {
    spanGaps: true,
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
        }
    }
}


const teamGraphDatasetBase = {
    label: "",
    data: [],
    // borderWidth: 2,
    tension: 0.0,
    clip: {left: false, top: false, right: IMAGE_POINT_SIZE_PX, bottom: false},
    hidden: false,
    // parsing: false
}

const weekInMilliseconds = 604800000;   // 7 days in milliseconds

function _getSeasonWeekNumForDate(seasonStartDate, date) {
    return Math.ceil((date - seasonStartDate) / weekInMilliseconds);
}



const months = ["January", "February", "March", "April", "May", "June", 
                "July", "August", "September", "October", "November", "December"];

function _groupGamesByMonth(games) {
    // Returns a map with arrays of games hashed by the string representation 
    // of the month the games took place in.
    var gamesByMonth = new Map();
    for (let i = 0; i < games.length; i++) {
        let game = games[i];
        let gameMonth = months[new Date(game.date).getMonth()];
        if (gamesByMonth[gameMonth] === undefined) {
            // Initialise an empty array for the month
            gamesByMonth[gameMonth] = [];
        }
        gamesByMonth[gameMonth].push(game);
    }
    return gamesByMonth;
}


function _getDataForGamesByMonthNum(games, xAxisMonthNumbers, yAxisType) {

    var gamesByMonthNum = new Map();
    xAxisMonthNumbers.forEach(monthNum => {
        // Initialise empty arrays corresponding to the month numbers
        gamesByMonthNum.set(monthNum, new Array());
    });

    // Bin the games into the months they were played in
    for (let i = 0; i < games.length; i++) {
        let game = games[i];
        let gameMonthNum = new Date(game.date).getMonth();
        if (gamesByMonthNum.has(gameMonthNum)) {
            // Add the game to the array of games for that month
            gamesByMonthNum.get(gameMonthNum).push(game);
        }
    }

    // Get data points for each month number
    var data = [];
    for (let games of gamesByMonthNum.values()) {
        if (games.length == 0) {
            // No games played in this month
            data.push(null);
        } else {
            // Get the data point for the last game in the month
            var lastGameInMonth = games[games.length - 1];
            if (yAxisType === standingsGraphYAxisOptions.record) {
                data.push(lastGameInMonth.cumulative_wins - lastGameInMonth.cumulative_losses);
            } else {
                // TODO implement y-axis seed data
            }
        }
    }

    return data;
}

function _getDataForGamesByWeekNum(games, seasonStartDate, xAxisWeekNumbers, yAxisType) {

    var gamesByWeekNum = new Map();
    xAxisWeekNumbers.forEach(weekNum => {
        // Initialise empty arrays corresponding to the week numbers
        gamesByWeekNum.set(weekNum, new Array());
    });

    // Bin the games into the week number they were played in
    for (let i = 0; i < games.length; i++) {
        let game = games[i];
        let gameWeekNum = Math.max(1, _getSeasonWeekNumForDate(seasonStartDate, new Date(game.date)));
        if (gamesByWeekNum.has(gameWeekNum)) {
            // Add the game to the array of games for that week
            gamesByWeekNum.get(gameWeekNum).push(game);
        }
    }

    // Get data points for each week number
    var data = [];
    for (let games of gamesByWeekNum.values()) {
        if (games.length == 0) {
            // No games played in this week
            data.push(null);
        } else {
            // Get the data point for the last game in the week
            var lastGameInWeek = games[games.length - 1];
            if (yAxisType === standingsGraphYAxisOptions.record) {
                data.push(lastGameInWeek.cumulative_wins - lastGameInWeek.cumulative_losses);
            } else {
                // TODO implement y-axis seed data
            }
        }
    }

    return data;
}

function _getDataForGamesByGameNum(games, xAxisGameNumbers, yAxisType) {

    var yAxisDataByGameNum = new Map();
    xAxisGameNumbers.forEach(gameNum => {
        yAxisDataByGameNum.set(gameNum, null);
    });

    for (var i = 0; i < games.length; i++) {
        let game = games[i];
        if (yAxisDataByGameNum.has(game.game_num)) {
            if (yAxisType === standingsGraphYAxisOptions.record) {
                yAxisDataByGameNum.set(game.game_num, (game.cumulative_wins - game.cumulative_losses));
            } else {
                // TODO implement y-axis seed data
            }
        }
    }

    return Array.from(yAxisDataByGameNum.values());
}

function _getDatasetForTeamData(team, data) {
    return {
        ...teamGraphDatasetBase,
        team: team,
        label: team.name,
        data: data,
        backgroundColor: team.primary_colour,
        borderColor: team.secondary_colour,
        order: team.league_rank,
        // pointStyle: linePointStyles,
        // pointRadius: linePointRadii,
        // pointHoverRadius: linePointHoverRadii,
    }
}

function _getGameToGameDataForTeams(teamData, maxNumGamesPlayed, xAxisNumGamesOption, yAxisTypeOption) {

    // Get the game numbers to plot on the x-axis
    var xAxisGameNumbers = [];
    var firstPlotGameNum = Math.max(1, (maxNumGamesPlayed - xAxisNumGamesOption));
    for (let gameNum = firstPlotGameNum; gameNum <= maxNumGamesPlayed; gameNum++) {
        xAxisGameNumbers.push(gameNum);
    }

    var datasets = [];
    for (let teamIdx = 0; teamIdx < teamData.length; teamIdx++) {
        var team = teamData[teamIdx];
        var data = _getDataForGamesByGameNum(team.games, xAxisGameNumbers, yAxisTypeOption);
        var teamDataset = _getDatasetForTeamData(team, data);
        datasets.push(teamDataset);
    }

    return {labels: xAxisGameNumbers, datasets: datasets};
}


function _getWeekToWeekDataForTeams(teamData, seasonStartDate, latestGameDate, yAxisTypeOption) {

    // Get the week numbers to plot on the x-axis
    var xAxisWeekNumbers = [];
    var lastPlotWeekNum = _getSeasonWeekNumForDate(seasonStartDate, latestGameDate);
    for (let weekNum = 1; weekNum <= lastPlotWeekNum; weekNum++) {
        xAxisWeekNumbers.push(weekNum);
    }

    // Get the week-by-week dataset for each team
    var datasets = [];
    for (let teamIdx = 0; teamIdx < teamData.length; teamIdx++) {
        var team = teamData[teamIdx];
        var data = _getDataForGamesByWeekNum(team.games, seasonStartDate, xAxisWeekNumbers, yAxisTypeOption);
        var teamDataset = _getDatasetForTeamData(team, data);
        datasets.push(teamDataset);
    }

    // Format the week number string labels for plotting on the x-axis
    var labels = [];
    xAxisWeekNumbers.forEach(weekNum => {
        labels.push("Week " + weekNum.toString());
    });

    return {labels: labels, datasets: datasets};
}


function _getMonthToMonthDataForTeams(teamData, seasonStartDate, latestGameDate, yAxisTypeOption) {

    // Get the month numbers to plot on the x-axis
    var xAxisMonthNumbers = [];
    for (let iterDate = new Date(seasonStartDate.getTime()); iterDate.getMonth() != latestGameDate.getMonth() + 1; iterDate.setMonth(iterDate.getMonth() + 1)) {
        let a = 1;
        xAxisMonthNumbers.push(iterDate.getMonth());
    }

    // Get the month-by-month dataset for each team
    var datasets = [];
    for (let teamIdx = 0; teamIdx < teamData.length; teamIdx++) {
        var team = teamData[teamIdx];
        var data = _getDataForGamesByMonthNum(team.games, xAxisMonthNumbers, yAxisTypeOption);
        var teamDataset = _getDatasetForTeamData(team, data);
        datasets.push(teamDataset);
    }

    // Format the month string labels for plotting on the x-axis
    var labels = [];
    xAxisMonthNumbers.forEach(monthNum => {
        labels.push(months[monthNum]);
    });

    return {labels: labels, datasets: datasets};
}


function getStandingsGraphDataFromTeamData(teamData,             // The team JSON data
                                           teamSubsetOption,     // One of standingsGraphTeamOptions
                                           xAxisNumGamesOption,  // One of standingsGraphXAxisGamesOptions
                                           xAxisTimeStepOption,  // One of standingsGraphXAxisTimeResolutionOptions
                                           yAxisTypeOption) {    // One of standingsGraphYAxisOptions

    if (teamData.length == undefined) {
        return {labels: [], datasets: []};
    }

    // Compute the highest number of games, earliest game date and latest game date played by any team
    var maxGamesPlayed = 0;
    var earliestGameDate = new Date();   // Current date
    var latestGameDate = new Date(0);   // Epoch 0-date (1970)
    for (let teamIdx = 0; teamIdx < teamData.length; teamIdx++) {
        let team = teamData[teamIdx];
        let teamGamesPlayed = team.games.length;
        if (teamGamesPlayed > maxGamesPlayed) {
            maxGamesPlayed = teamGamesPlayed;
        }
        let teamFirstGameDate = new Date(team.games[0].date);
        if (teamFirstGameDate < earliestGameDate) {
            earliestGameDate = teamFirstGameDate;
        }
        let teamLastGameDate = new Date(team.games[team.games.length - 1].date);
        if (teamLastGameDate > latestGameDate) {
            latestGameDate = teamLastGameDate;
        }
    }

    if (teamSubsetOption !== standingsGraphTeamOptions.all) {
        // Filter out teams that don't pertain to the selected team subset option
        let teamDataSubset = [];
        for (let teamIdx = 0; teamIdx < teamData.length; teamIdx++) {
            if (teamData[teamIdx].conference === teamSubsetOption) {
                teamDataSubset.push(teamData[teamIdx]);
            }
        }
        teamData = teamDataSubset;
    }


    if (xAxisTimeStepOption === standingsGraphXAxisTimeResolutionOptions.gameToGame) {
        var data = _getGameToGameDataForTeams(teamData, maxGamesPlayed, xAxisNumGamesOption, yAxisTypeOption);
    } else if (xAxisTimeStepOption === standingsGraphXAxisTimeResolutionOptions.weekToWeek) {
        data = _getWeekToWeekDataForTeams(teamData, earliestGameDate, latestGameDate, yAxisTypeOption);
    } else if (xAxisTimeStepOption === standingsGraphXAxisTimeResolutionOptions.monthToMonth) {
        data = _getMonthToMonthDataForTeams(teamData, earliestGameDate, latestGameDate, yAxisTypeOption);
    }


    return data;
}


function getStandingsGraphOptions(teamSubsetOption,     // One of standingsGraphTeamOptions
                                  xAxisNumGamesOption,  // One of standingsGraphXAxisGamesOptions
                                  xAxisTimeStepOption,  // One of standingsGraphXAxisTimeResolutionOptions
                                  yAxisTypeOption) {    // One of standingsGraphYAxisOptions
    var options = standingsGraphOptionsBase;
    if (xAxisTimeStepOption === standingsGraphXAxisTimeResolutionOptions.gameToGame) {
        options.scales.x.type = 'linear';
    } else {
        options.scales.x.type = 'category';
    }
    return options;
}

export { standingsGraphTeamOptions, 
         standingsGraphXAxisGamesOptions, 
         standingsGraphXAxisTimeResolutionOptions, 
         standingsGraphYAxisOptions, 
         getStandingsGraphDataFromTeamData,
         getStandingsGraphOptions };


// function onHoverHandler(event, activeElements) {
//     var activeIndices = new Set();
//     for (let i = 0; i < activeElements.length; i++) {
//         activeIndices.add(activeElements[i].datasetIndex);
//     }

//     if (activeIndices.size > 0) {
//         for (let datasetIdx = 0; datasetIdx < standingsChart.data.datasets.length; datasetIdx++) {
//             let dataset = standingsChart.data.datasets[datasetIdx]
//             if (activeIndices.has(datasetIdx)) {
//                 dataset.backgroundColor = dataset.team.primary_colour;
//                 dataset.borderColor = dataset.team.secondary_colour;
//                 dataset.order = dataset.team.league_rank - 100;
//             } else {
//                 dataset.backgroundColor = "#ababab";
//                 dataset.borderColor = "#ababab";
//             }
//         }
//     } else {
//         for (let datasetIdx = 0; datasetIdx < standingsChart.data.datasets.length; datasetIdx++) {
//             let dataset = standingsChart.data.datasets[datasetIdx]
//             dataset.backgroundColor = dataset.team.primary_colour;
//             dataset.borderColor = dataset.team.secondary_colour;
//             dataset.order = dataset.team.league_rank;
//         }
//     }

//     standingsChart.update();
// // }


// function gamesBehind(teamAWins, teamALosses, teamBWins, teamBLosses) {
//     // Computes games behind value from two teams' records
//     return ((teamAWins - teamALosses) - (teamBWins - teamBLosses)) / 2;
// }


// function getLogoForTeam(teamName) {
//     var img = new Image(IMAGE_POINT_SIZE_PX, IMAGE_POINT_SIZE_PX);
//     img.src = imageFolderBasePath + "/" + teamName + ".png";
//     img.style.filter = "alpha(opacity=50)";
//     img.style.opacity = 0.5;
//     return img;
// }


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



// function renderTeamGamesBehindGraph(teamData, conference) {
//     var teamDatasets = getTeamGamesBehindDatasets(teamData, conference);
//     standingsChart.data.datasets = teamDatasets;
//     standingsChart.update();
// }


// function onConferenceSelection(selectedConference) {
//     for (let i = 0; i < standingsChart.data.datasets.length; i++) {
//         let team = standingsChart.data.datasets[i].team;
//         console.log(team.conference);
//         standingsChart.data.datasets[i].hidden = (selectedConference !== "All" && selectedConference !== team.conference);
//     }
//     standingsChart.update();
// }


// renderTeamGamesBehindGraph(parsedTeamData, conference="all");

