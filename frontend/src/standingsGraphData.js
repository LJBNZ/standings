import { externalTooltipHandler } from './standingsGraphTooltipHandler';


const GAMES_PER_SEASON = 82;
const IMAGE_POINT_SIZE_PX = 30;

// Standings graph user options

const standingsGraphTeamOptions = {
    all: 'All',
    east: 'East',
    west: 'West',
    // hottest: 'Hottest 🔥',
    // coldest: 'Coldest ❄️'
}

const standingsGraphXAxisGamesOptions = {
    all: GAMES_PER_SEASON,
    10: 10,
    20: 20,
    40: 40
}

const standingsGraphXAxisTimeScaleOptions = {
    gameToGame: 'game-to-game',
    weekToWeek: 'week-to-week',
    monthToMonth: 'month-to-month'
}

const standingsGraphYAxisOptions = {
    record: 'record',
    seed: 'seed'
}

const standingsGraphSeasonOptions = {
    2023: '2022-23',
    2022: '2021-22',
    2021: '2020-21',
    2020: '2019-20',
    2019: '2018-19',
    2018: '2017-18',
    2017: '2016-17',
    2016: '2015-16',
    2015: '2014-15',
    2014: '2013-14',
    2013: '2012-13',
    2012: '2011-12',
    2011: '2010-11',
    2010: '2009-10',
    2009: '2008-09',
    2008: '2007-08',
    2007: '2006-07',
    2006: '2005-06',
    2005: '2004-05',
}

const xAxisOriginLabel = '';

// const skipped = (ctx, value) => ctx.p0.skip || ctx.p1.skip ? value : undefined;

// The basic graph options
const standingsGraphOptionsBase = {
    interaction: {
        intersect: true,
        mode: 'nearest',
    },
    spanGaps: true,
    // segment: {
    //     borderColor: ctx => skipped(ctx, 'rgb(0,0,0,0.2)'),
    //     borderDash: ctx => skipped(ctx, [6, 6]),
    //   },
    layout: {
        padding: IMAGE_POINT_SIZE_PX
    },
    scales: {
        x: {
            type: 'category',
            title: {
                text: '',
                display: true
            }
        },
        y: {
            type: 'linear',
            title: {
                text: '',
                display: true
            }
        }
    },
    elements: {
        line: {
            borderWidth: 5,
            borderCapStyle: 'round'
        },
        point: {
            borderWidth: 0,
        },
    },
    plugins: {
        legend: {
            display: false
        },
        tooltip: {
            enabled: false,
            position: 'nearest',
            external: externalTooltipHandler,
        }
    },
    onHover: onHoverHandler, 
}


const teamGraphDatasetBase = {
    label: "",
    data: [],
    tension: 0.3,
    clip: {left: false, top: false, right: IMAGE_POINT_SIZE_PX, bottom: false},
    hidden: false,
    pointHitRadius: 10,
}


const months = ["January", "February", "March", "April", "May", "June", 
                "July", "August", "September", "October", "November", "December"];

const weekInMilliseconds = 604800000;   // 7 days in milliseconds

function _getSeasonWeekNumForDate(seasonStartDate, date) {
    return Math.ceil((date - seasonStartDate) / weekInMilliseconds);
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

    data.splice(0, 0, 0);   // Add origin point
    return [data, gamesByMonthNum];
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

    data.splice(0, 0, 0);   // Add origin point
    return [data, gamesByWeekNum];
}

function _getDataForGamesByGameNum(games, xAxisGameNumbers, yAxisType) {

    var yAxisDataByGameNum = new Map();
    xAxisGameNumbers.forEach(gameNum => {
        yAxisDataByGameNum.set(gameNum, null);
    });

    var gameByGameNum = new Map();

    for (var i = 0; i < games.length; i++) {
        let game = games[i];
        gameByGameNum.set(game.game_num, game);
        if (yAxisDataByGameNum.has(game.game_num)) {
            if (yAxisType === standingsGraphYAxisOptions.record) {
                yAxisDataByGameNum.set(game.game_num, (game.cumulative_wins - game.cumulative_losses));
            } else {
                // TODO implement y-axis seed data
            }
        }
    }

    var data = Array.from(yAxisDataByGameNum.values());
    data.splice(0, 0, 0);   // Add origin point
    return [data, gameByGameNum];
}

function _getLogoURLForTeamName(teamName) {
    var imageName = teamName.toLowerCase().replace(/ /g, '_');
    return `./img/${imageName}.png`;
}

function _getLogoImageForTeamName(teamName) {
    var teamLogo = new Image(IMAGE_POINT_SIZE_PX, IMAGE_POINT_SIZE_PX);
    teamLogo.src = _getLogoURLForTeamName(teamName);
    return teamLogo;
}


function _setDatasetPointStyling(dataset) {
    var lastNotNullIdx = 0;
    for (let i = 0; i < dataset.data.length; i++) {
        if (dataset.data[i] != null) {
            lastNotNullIdx = i;
        }
    }
    var pointStyles = new Array(dataset.data.length).fill('point');
    pointStyles[lastNotNullIdx] = _getLogoImageForTeamName(dataset.team.name);
    dataset.pointStyle = pointStyles;

    var pointRadii = new Array(dataset.data.length).fill(2.5);
    pointRadii[0] = 0;
    dataset.pointRadius = pointRadii;

    var hoverRadii = new Array(dataset.data.length).fill(5);
    hoverRadii[0] = 0;
    hoverRadii[lastNotNullIdx] = IMAGE_POINT_SIZE_PX;
    dataset.pointHoverRadius = hoverRadii;
}


function _getDatasetForTeamData(team, data, xAxisTimeStepOption, yAxisOption, gamesByTimestep) {
    var dataset = {
        ...teamGraphDatasetBase,
        label: team.name,
        data: data,
        backgroundColor: team.secondary_colour,
        borderColor: team.primary_colour,
        order: team.league_rank,

        // Custom attributes
        yAxisOption: yAxisOption,
        xAxisTimeStepOption: xAxisTimeStepOption,
        gamesByTimestep: gamesByTimestep,
        team: team,
        logoURL: _getLogoURLForTeamName(team.name),
    }

    _setDatasetPointStyling(dataset);
    return dataset;
}

function _getGameToGameDataForTeams(teamData, maxNumGamesPlayed, xAxisNumGamesOption, xAxisTimeStepOption, yAxisTypeOption) {

    // Get the game numbers to plot on the x-axis
    var xAxisGameNumbers = [];
    var firstPlotGameNum = Math.max(1, (maxNumGamesPlayed - xAxisNumGamesOption));
    for (let gameNum = firstPlotGameNum; gameNum <= maxNumGamesPlayed; gameNum++) {
        xAxisGameNumbers.push(gameNum);
    }

    var datasets = [];
    for (let teamIdx = 0; teamIdx < teamData.length; teamIdx++) {
        var team = teamData[teamIdx];
        var [data, gameByGameNum] = _getDataForGamesByGameNum(team.games, xAxisGameNumbers, yAxisTypeOption);
        var teamDataset = _getDatasetForTeamData(team, data, xAxisTimeStepOption, yAxisTypeOption, gameByGameNum);
        datasets.push(teamDataset);
    }

    xAxisGameNumbers.splice(0, 0, xAxisOriginLabel);   // Add origin label for x-axis
    return {labels: xAxisGameNumbers, datasets: datasets};
}


function _getWeekToWeekDataForTeams(teamData, seasonStartDate, latestGameDate, xAxisTimeStepOption, yAxisTypeOption) {

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
        var [data, gamesByWeekNum] = _getDataForGamesByWeekNum(team.games, seasonStartDate, xAxisWeekNumbers, yAxisTypeOption);
        var teamDataset = _getDatasetForTeamData(team, data, xAxisTimeStepOption, yAxisTypeOption, gamesByWeekNum);
        datasets.push(teamDataset);
    }

    xAxisWeekNumbers.splice(0, 0, xAxisOriginLabel);   // Add origin label for x-axis
    return {labels: xAxisWeekNumbers, datasets: datasets};
}


function _getMonthToMonthDataForTeams(teamData, seasonStartDate, latestGameDate, xAxisTimeStepOption, yAxisTypeOption) {

    // Get the month numbers to plot on the x-axis
    var xAxisMonthNumbers = [];
    var iterDate = new Date(seasonStartDate.getTime())
    do {
        var currentMonth = iterDate.getMonth();
        xAxisMonthNumbers.push(currentMonth);
        iterDate.setMonth(currentMonth + 1);
    } while (currentMonth != latestGameDate.getMonth())

    // Get the month-by-month dataset for each team
    var datasets = [];
    for (let teamIdx = 0; teamIdx < teamData.length; teamIdx++) {
        var team = teamData[teamIdx];
        var [data, gamesByMonth] = _getDataForGamesByMonthNum(team.games, xAxisMonthNumbers, yAxisTypeOption);
        var teamDataset = _getDatasetForTeamData(team, data, xAxisTimeStepOption, yAxisTypeOption, gamesByMonth);
        datasets.push(teamDataset);
    }

    // Format the month string labels for plotting on the x-axis
    var labels = [xAxisOriginLabel];
    xAxisMonthNumbers.forEach(monthNum => {
        labels.push(months[monthNum]);
    });

    return {labels: labels, datasets: datasets};
}


function getStandingsGraphDataFromTeamData(teamData,             // The team JSON data
                                           teamSubsetOption,     // One of standingsGraphTeamOptions
                                           xAxisNumGamesOption,  // One of standingsGraphXAxisGamesOptions
                                           xAxisTimeStepOption,  // One of standingsGraphXAxisTimeScaleOptions
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


    if (xAxisTimeStepOption === standingsGraphXAxisTimeScaleOptions.gameToGame) {
        var data = _getGameToGameDataForTeams(teamData, maxGamesPlayed, xAxisNumGamesOption, xAxisTimeStepOption, yAxisTypeOption);
    } else if (xAxisTimeStepOption === standingsGraphXAxisTimeScaleOptions.weekToWeek) {
        data = _getWeekToWeekDataForTeams(teamData, earliestGameDate, latestGameDate, xAxisTimeStepOption, yAxisTypeOption);
    } else if (xAxisTimeStepOption === standingsGraphXAxisTimeScaleOptions.monthToMonth) {
        data = _getMonthToMonthDataForTeams(teamData, earliestGameDate, latestGameDate, xAxisTimeStepOption, yAxisTypeOption);
    }


    return data;
}


function getStandingsGraphOptions(teamSubsetOption,     // One of standingsGraphTeamOptions
                                  xAxisNumGamesOption,  // One of standingsGraphXAxisGamesOptions
                                  xAxisTimeStepOption,  // One of standingsGraphXAxisTimeScaleOptions
                                  yAxisTypeOption) {    // One of standingsGraphYAxisOptions
    var options = standingsGraphOptionsBase;
    if (xAxisTimeStepOption === standingsGraphXAxisTimeScaleOptions.gameToGame) {
        options.scales.x.title.text = 'Game number'
    } else if (xAxisTimeStepOption === standingsGraphXAxisTimeScaleOptions.weekToWeek) {
        options.scales.x.title.text = 'Week number'
    } else {
        options.scales.x.title.text = 'Month'
    }
    if (yAxisTypeOption === standingsGraphYAxisOptions.record) {
        options.scales.y.title.text = 'Games above .500'
    } else {
        options.scales.x.title.text = 'Seed number'
    }
    return options;
}


function onHoverHandler(event, activeElements, chart) {
    var activeIndices = new Set();
    for (let i = 0; i < activeElements.length; i++) {
        activeIndices.add(activeElements[i].datasetIndex);
    }

    if (activeIndices.size > 0) {
        for (let datasetIdx = 0; datasetIdx < chart.data.datasets.length; datasetIdx++) {
            let dataset = chart.data.datasets[datasetIdx]
            if (activeIndices.has(datasetIdx)) {
                dataset.backgroundColor = dataset.team.secondary_colour;
                dataset.borderColor = dataset.team.primary_colour;
                dataset.order = dataset.team.league_rank - 100;
            } else {
                dataset.backgroundColor = "#ababab";
                dataset.borderColor = "#ababab";
            }
        }
    } else {
        for (let datasetIdx = 0; datasetIdx < chart.data.datasets.length; datasetIdx++) {
            let dataset = chart.data.datasets[datasetIdx]
            dataset.backgroundColor = dataset.team.secondary_colour;
            dataset.borderColor = dataset.team.primary_colour;
            dataset.order = dataset.team.league_rank;
        }
    }

    chart.update();
}


export { standingsGraphTeamOptions, 
    standingsGraphXAxisGamesOptions, 
    standingsGraphXAxisTimeScaleOptions, 
    standingsGraphYAxisOptions,
    standingsGraphSeasonOptions,
    months,
    getStandingsGraphDataFromTeamData,
    getStandingsGraphOptions,
   };