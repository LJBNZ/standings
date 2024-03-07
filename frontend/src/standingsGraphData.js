import { externalTooltipHandler } from './standingsGraphTooltipHandler';
import { DateTime } from "luxon";


const GAMES_PER_SEASON = 82;
const IMAGE_POINT_SIZE_PX = 30;
const ALL_STAR_BREAK_REASON = 'All-Star Break';

// Standings graph user options

const standingsGraphTeamOptions = {
    all: 'all',
    east: 'east',
    west: 'west',
}

const standingsGraphXAxisGamesOptions = {
    all: GAMES_PER_SEASON,
    10: 10,
    20: 20,
    40: 40
}

const standingsGraphXAxisTimeScaleOptions = {
    gameNum: 'game number',
    day: 'day',
    week: 'week',
    month: 'month',
}

const standingsGraphYAxisOptions = {
    record: 'record',
    seed: 'seed'
}

const standingsGraphSeasonOptions = {
    2024: '2023-24',
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


const dateStringToDateTime = (dateString) => DateTime.fromISO(dateString);
const millisecondsToDateTime = (dateMS) => DateTime.fromMillis(dateMS);


const seasonBreaks = {
    '2022-23': [{start: dateStringToDateTime('2023-02-17'), end: dateStringToDateTime('2023-02-22'), reason: ALL_STAR_BREAK_REASON},],
    '2021-22': [{start: dateStringToDateTime('2022-02-18'), end: dateStringToDateTime('2022-02-23'), reason: ALL_STAR_BREAK_REASON},],
    '2020-21': [{start: dateStringToDateTime('2021-03-04'), end: dateStringToDateTime('2021-03-09'), reason: ALL_STAR_BREAK_REASON},],
    '2019-20': [{start: dateStringToDateTime('2020-02-14'), end: dateStringToDateTime('2020-02-19'), reason: ALL_STAR_BREAK_REASON},
                {start: dateStringToDateTime('2020-03-11'), end: dateStringToDateTime('2020-07-29'), reason: 'COVID-19 Suspension'},],
    '2018-19': [{start: dateStringToDateTime('2019-02-15'), end: dateStringToDateTime('2019-02-20'), reason: ALL_STAR_BREAK_REASON},],
    // TODO add more breaks
}

const xAxisOriginLabel = '';

function skipped(ctx, value, onlyIfNotActive=false) {
    if (onlyIfNotActive) {
        let activeElements = ctx.chart.getActiveElements();
        for (const dataset of activeElements) {
            if (dataset.datasetIndex == ctx.datasetIndex) {
                return undefined;
            }
        }
    }
    return ctx.p0.skip || ctx.p1.skip ? value : undefined;
}

// The basic graph options
const standingsGraphOptionsBase = {
    interaction: {
        intersect: true,
        mode: 'nearest',
    },
    spanGaps: true,
    segment: {
        // borderColor: ctx => skipped(ctx, 'rgb(0,0,0,0.2)'),
        borderColor: ctx => skipped(ctx, '#ababab', true),
        borderDash: ctx => skipped(ctx, [6, 8]),
        // borderWidth: ctx => skipped(ctx, 2),
    },
    layout: {
        padding: IMAGE_POINT_SIZE_PX
    },
    scales: {
        x: undefined,
        y: {
            type: 'linear',
            title: {
                text: '',
                display: true
            },
            ticks: {
                count: undefined,
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
        },
        autocolors: false,
        annotation: {
            annotations: {
                playoffLine: {
                    type: 'line',
                    display: true,
                    yMin: 6.5,
                    yMax: 6.5,
                    borderColor: 'rgb(132, 99, 255)',
                    borderWidth: 2,
                    borderDash: [10, 10],
                    drawTime: 'beforeDatasetsDraw',
                    label: {
                        content: 'Playoff',
                        display: true,
                        backgroundColor: 'rgba(0,0,0,0)',
                        color: 'rgb(132, 99, 255)'
                    }
                },
                playinLine: {
                    type: 'line',
                    display: true,
                    yMin: 10.5,
                    yMax: 10.5,
                    borderColor: 'rgb(255, 99, 132)',
                    borderWidth: 2,
                    borderDash: [10, 10],
                    label: {
                        content: 'Play-in',
                        display: true,
                    }
                }
            }
        }
    },
    onHover: onHoverHandler, 
}


const teamGraphDatasetBase = {
    label: "",
    data: [],
    clip: {left: false, top: false, right: IMAGE_POINT_SIZE_PX, bottom: false},
    hidden: false,
    pointHitRadius: 10,
}


function _insertSeasonBreakData(data, seasonOption) {
    const breaks = seasonBreaks[seasonOption];
    if (breaks === undefined) {
        return;
    }

    let maxGameDateMs = 0;
    for (const d of data) {
        if (d.x > maxGameDateMs) {
            maxGameDateMs = d.x;
        }  
    }

    for (const brk of breaks) {
        let startMS = brk.start.toMillis();
        let endMS = brk.end.toMillis();
        if (maxGameDateMs <= startMS) {
            continue;
        }
        data.push({x: startMS, y: null});
        data.push({x: endMS, y: null});
    }

    data.sort((a, b) => a.x - b.x);
}


function _getRecordDataForTeamByGameNum(team) {
    const zeroDataPoint = {x: 0, y: 0};
    var data = [zeroDataPoint];
    for (const game of team.games) {
        let x = game.game_num;
        let y = game.cumulative_wins - game.cumulative_losses;
        data.push({x: x, y: y, games: [game]});
    }
    return data;
}

function _getRecordDataForTeamByDay(team, earliestGameDateTime) {
    const zeroDataPoint = {x: earliestGameDateTime.minus({days: 1}).toMillis(), y: 0};
    var data = [zeroDataPoint];
    for (const game of team.games) {
        let x = game.date_ms;
        let y = game.cumulative_wins - game.cumulative_losses;
        data.push({x: x, y: y, games: [game]});
    }
    return data;
}


function _getSeedDataForTeamByDay(team, earliestGameDateTime, teamSubsetOption) {
    const zeroDataPoint = {x: earliestGameDateTime.minus({'days': 1}).toMillis(), y: teamSubsetOption === standingsGraphTeamOptions.all ? 30 / 2 : 15 / 2};
    var data = [zeroDataPoint];
    const rankOverTime = teamSubsetOption === standingsGraphTeamOptions.all ? team.league_rank_by_date : team.conference_seed_by_date;
    for (const [dateMS, rank] of Object.entries(rankOverTime)) {
        let x = Number(dateMS);
        let y = rank;
        data.push({x: x, y: y});
    }
    var uniqueDataPoints = [];
    for (var i = 0; i < data.length; i++) {
        if (i === 0 || i === data.length - 1) {
            uniqueDataPoints.push(data[i]);
            continue;
        }
        const [last, current, next] = data.slice(i - 1, i + 2);
        if (last.y !== current.y || current.y !== next.y) {
            uniqueDataPoints.push(current);
        }
    }
    return uniqueDataPoints;
}


function _getRecordDataForTeamByTimeStep(team, earliestGameDateTime, timeStepOption) {
    const zeroDataPoint = {x: earliestGameDateTime.toMillis(), y: 0};
    const timeStepString = timeStepOption === standingsGraphXAxisTimeScaleOptions.week ? 'week' : 'month';
    var data = [zeroDataPoint];

    var maxGameDateMS = earliestGameDateTime.toMillis();
    for (const game of team.games) {
        if (game.date_ms > maxGameDateMS) {
            maxGameDateMS = game.date_ms;
        }
    }
    
    // Bin games by time step
    var gamesByTimeStep = new Map();
    for (const game of team.games) {
        let gameDateTime = millisecondsToDateTime(game.date_ms);
        let offset = {};
        offset[timeStepString] = 1;
        let timeStepEndDateTime = gameDateTime.plus(offset).startOf(timeStepString);
        var timeStepMS = timeStepEndDateTime.toMillis();
        timeStepMS = Math.min(timeStepMS, maxGameDateMS);
        
        if (gamesByTimeStep.has(timeStepMS)) {
            gamesByTimeStep.get(timeStepMS).push(game);
        } else {
            gamesByTimeStep.set(timeStepMS, [game]);
        }
    }

    // Convert bins of games to data points
    for (const [timeStepMS, games] of gamesByTimeStep) {
        if (games.length == 0) {
            continue;
        }
        games.sort((a, b) => a.date_ms - b.date_ms);
        var latestGameInTimeStep = games[games.length - 1];
        let x = timeStepMS;
        let y = latestGameInTimeStep.cumulative_wins - latestGameInTimeStep.cumulative_losses;
        data.push({x: x, y: y, games: games});
    }
    return data;
}


function _getSeedDataForTeamByTimeStep(team, earliestGameDateTime, timeStepOption, teamSubsetOption) {
    const zeroDataPoint = {x: earliestGameDateTime.toMillis(), y: teamSubsetOption === standingsGraphTeamOptions.all ? 30 / 2 : 15 / 2};
    const timeStepString = timeStepOption === standingsGraphXAxisTimeScaleOptions.week ? 'week' : 'month';
    const rankOverTime = teamSubsetOption === standingsGraphTeamOptions.all ? team.league_rank_by_date : team.conference_seed_by_date;
    var data = [zeroDataPoint];

    var maxSeedDateMS = 0;
    for (const dateMS of Object.keys(rankOverTime)) {
        let intDateMS = Number(dateMS);
        if (intDateMS > maxSeedDateMS) {
            maxSeedDateMS = intDateMS;
        }
    }
    
    // Bin seed data by time intervals
    var seedsByTimeStep = new Map();
    for (const [dateMS, rank] of Object.entries(rankOverTime)) {
        let dateTime = millisecondsToDateTime(Number(dateMS));
        let offset = {};
        offset[timeStepString] = 1;
        let timeStepEndDateTime = dateTime.plus(offset).startOf(timeStepString);
        var timeStepMS = timeStepEndDateTime.toMillis();
        timeStepMS = Math.min(timeStepMS, maxSeedDateMS);
        
        if (seedsByTimeStep.has(timeStepMS)) {
            seedsByTimeStep.get(timeStepMS).push(rank);
        } else {
            seedsByTimeStep.set(timeStepMS, [rank]);
        }
    }

    // Convert bins of seed data to graph data points
    for (const [timeStepMS, ranks] of seedsByTimeStep) {
        if (ranks.length == 0) {
            continue;
        }
        let x = timeStepMS;
        let y = ranks[ranks.length - 1];
        data.push({x: x, y: y});
    }
    return data;
}


function _getDataForTeam(team, earliestGameDateTime, xAxisTimeStepOption, yAxisOption, teamSubsetOption) {
    if (xAxisTimeStepOption === standingsGraphXAxisTimeScaleOptions.gameNum) {
        return _getRecordDataForTeamByGameNum(team);
    } else if (xAxisTimeStepOption === standingsGraphXAxisTimeScaleOptions.day) {
        if (yAxisOption === standingsGraphYAxisOptions.record) {
            return _getRecordDataForTeamByDay(team, earliestGameDateTime);
        } else {
            return _getSeedDataForTeamByDay(team, earliestGameDateTime, teamSubsetOption);
        }
    } else {
        if (yAxisOption === standingsGraphYAxisOptions.record) {
            return _getRecordDataForTeamByTimeStep(team, earliestGameDateTime, xAxisTimeStepOption);
        } else {
            return _getSeedDataForTeamByTimeStep(team, earliestGameDateTime, xAxisTimeStepOption, teamSubsetOption);
        }
    }
}


function _getLogoURLForTeamName(teamName, isGrayScale) {
    var imageName = teamName.toLowerCase().replace(/ /g, '_');
    return `./img/${imageName}${isGrayScale ? '_grayscale' : ''}.png`;
}


function _getLogoImageForTeamName(teamName, isGrayScale) {
    var teamLogo = new Image(IMAGE_POINT_SIZE_PX, IMAGE_POINT_SIZE_PX);
    teamLogo.src = _getLogoURLForTeamName(teamName, isGrayScale);
    return teamLogo;
}


function _setDatasetPointStyling(dataset, active) {
    var lastNotNullIdx = 0;
    const nullIndxs = [];
    for (let i = 0; i < dataset.data.length; i++) {
        let dataPoint = dataset.data[i];
        if (dataPoint.y != null && dataPoint.interactive != false) {
            lastNotNullIdx = i;
        } else {
            nullIndxs.push(i);
        }
    }
    var pointStyles = new Array(dataset.data.length).fill('point');
    pointStyles[lastNotNullIdx] = _getLogoImageForTeamName(dataset.team.name, !active);
    dataset.pointStyle = pointStyles;

    var pointRadii = new Array(dataset.data.length).fill(2.5);
    for (const i of nullIndxs) {
        pointRadii[i] = 0;
    }
    pointRadii[0] = 0;
    dataset.pointRadius = pointRadii;

    var hoverRadii = new Array(dataset.data.length).fill(5);
    for (const i of nullIndxs) {
        hoverRadii[i] = 0;
    }
    hoverRadii[0] = 0;
    hoverRadii[lastNotNullIdx] = IMAGE_POINT_SIZE_PX;
    dataset.pointHoverRadius = hoverRadii;
}


function _getDatasetForTeamData(team, data, xAxisTimeStepOption, yAxisOption, teamSubsetOption) {
    var dataset = {
        ...teamGraphDatasetBase,
        label: team.name,
        data: data,
        backgroundColor: team.secondary_colour,
        borderColor: team.primary_colour,
        order: team.league_rank,
        tension: yAxisOption === standingsGraphYAxisOptions.seed ? 0.1 : 0.3,

        // Custom attributes
        yAxisOption: yAxisOption,
        xAxisTimeStepOption: xAxisTimeStepOption,
        teamSubsetOption: teamSubsetOption,
        team: team,
        logoURL: _getLogoURLForTeamName(team.name),
    }

    _setDatasetPointStyling(dataset, true);
    return dataset;
}


function _getDataForTeams(teamData, earliestGameDateTime, xAxisTimeStepOption, yAxisTypeOption, teamSubsetOption, seasonOption) {

    var datasets = [];
    for (let teamIdx = 0; teamIdx < teamData.length; teamIdx++) {
        var team = teamData[teamIdx];
        var data = _getDataForTeam(team, earliestGameDateTime, xAxisTimeStepOption, yAxisTypeOption, teamSubsetOption);
        _insertSeasonBreakData(data, seasonOption);
        var teamDataset = _getDatasetForTeamData(team, data, xAxisTimeStepOption, yAxisTypeOption, teamSubsetOption);
        datasets.push(teamDataset);
    }

    return {datasets: datasets};
}


function getStandingsGraphDataFromTeamData(teamData,             // The team JSON data
                                           teamSubsetOption,     // One of standingsGraphTeamOptions
                                           xAxisTimeStepOption,  // One of standingsGraphXAxisTimeScaleOptions
                                           yAxisTypeOption,      // One of standingsGraphYAxisOptions
                                           seasonOption)         // One of standingsGraphSeasonOptions
                                           {    

    console.log("getting data");
    if (teamData.length == undefined) {
        return {labels: [], datasets: []};
    }

    // Compute the highest number of games and earliest game date played by any team
    var maxGamesPlayed = 0;
    var earliestGameDateMS = Infinity;
    for (let teamIdx = 0; teamIdx < teamData.length; teamIdx++) {
        let team = teamData[teamIdx];
        let teamGamesPlayed = team.games.length;
        if (teamGamesPlayed > maxGamesPlayed) {
            maxGamesPlayed = teamGamesPlayed;
        }
        let teamFirstGameDateMS = team.games[0].date_ms;
        if (teamFirstGameDateMS < earliestGameDateMS) {
            earliestGameDateMS = teamFirstGameDateMS;
        }
    }
    var earliestGameDateTime = millisecondsToDateTime(earliestGameDateMS);

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

    return _getDataForTeams(teamData, earliestGameDateTime, xAxisTimeStepOption, yAxisTypeOption, teamSubsetOption, seasonOption);
}


function defineSeasonBreakAnnotations(options, seasonOption) {
    const breaks = seasonBreaks[seasonOption];
    if (breaks === undefined) {
        // options.plugins.annotation.annotations = {};  TODO fix this
        return;
    }

    for (const brk of breaks) {
        options.plugins.annotation.annotations[`${brk.reason}Annotation`] = {
            type: 'box',
            display: true,
            xMin: brk.start.toMillis(),
            xMax: brk.end.toMillis(),
            backgroundColor: 'rgb(0,0,0,0.07)',
            borderColor: 'rgb(0,0,0,0.5)',
            borderWidth: 0,
            drawTime: 'beforeDatasetsDraw',
            label: {
                textStrokeWidth: 3,
                textAlign: 'center',
                content: brk.reason,
                display: true,
                backgroundColor: '#292929',
                color: '#e0e0e0',
                rotation: brk.reason == ALL_STAR_BREAK_REASON ? 90 : 0,
                drawTime: 'afterDatasetsDraw',
            }
        }
    }
}

function _calculateScaleRangesFromData(data) {
    var xMin = Infinity;
    var yMin = Infinity;
    var xMax = -Infinity;
    var yMax = -Infinity;
    for (const dataset of data.datasets) {
        for (const dataPoint of dataset.data) {
            if (dataPoint.x < xMin) {
                xMin = dataPoint.x;
            } else if (dataPoint.x > xMax) {
                xMax = dataPoint.x;
            } else if (dataPoint.y < yMin) {
                yMin = dataPoint.y;
            } else if (dataPoint.y > yMax) {
                yMax = dataPoint.y;
            }
        }
    }
    return {'xMin': xMin, 'xMax': xMax, 'yMin': yMin, 'yMax': yMax};
}

function getStandingsGraphOptions(data,
                                  teamSubsetOption,     // One of standingsGraphTeamOptions
                                  xAxisTimeStepOption,  // One of standingsGraphXAxisTimeScaleOptions
                                  yAxisTypeOption,      // One of standingsGraphYAxisOptions
                                  seasonOption) {    
    console.log("getting options");
    var options = standingsGraphOptionsBase;
    if (xAxisTimeStepOption === standingsGraphXAxisTimeScaleOptions.gameNum) {
        options.scales.x = {
            type: 'linear',
            title: {
                text: 'Game number'
            }
        };
        options.plugins.annotation.annotations = {};
    } else {
        options.scales.x = {
            type: 'time',
            title: {
                text: 'Date'
            },
            time: {
                unit: xAxisTimeStepOption
            }
        };
        defineSeasonBreakAnnotations(options, seasonOption);
    }

    if (yAxisTypeOption === standingsGraphYAxisOptions.record) {
        let ranges = _calculateScaleRangesFromData(data);
        options.scales.y.reverse = false;
        options.scales.y.title.text = 'Games above .500';
        options.scales.x.min = ranges.xMin;
        options.scales.x.max = ranges.xMax;
        options.scales.y.min = ranges.yMin;
        options.scales.y.max = ranges.yMax;
        options.scales.y.ticks.count = undefined;
        options.scales.y.ticks.autoSkip = true;
    } else {
        options.scales.x.title.text = 'Date';
        options.scales.y.reverse = true;
        if (teamSubsetOption === standingsGraphTeamOptions.all) {
            options.scales.y.title.text = 'League-wide rank';
            options.scales.y.min = 1;
            options.scales.y.max = 30;
            options.scales.y.ticks.count = 30;
            options.scales.y.ticks.autoSkip = false;
        } else {
            options.scales.y.title.text = 'Team seed';
            options.scales.y.min = 1;
            options.scales.y.max = 15;
            options.scales.y.ticks.count = 15;
            options.scales.y.ticks.autoSkip = false;
        }
    }
    return options;
}


function addAlphaToHexColour(colour, alpha) {
    // coerce values between 0 and 1
    var opacity = Math.round(Math.min(Math.max(alpha || 1, 0), 1) * 255);
    return colour + opacity.toString(16).toUpperCase();
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
                _setDatasetPointStyling(dataset, true);
                dataset.backgroundColor = addAlphaToHexColour(dataset.team.secondary_colour, 1.0);
                dataset.borderColor = addAlphaToHexColour(dataset.team.primary_colour, 1.0);
                dataset.order = dataset.team.league_rank - 100;
            } else {
                _setDatasetPointStyling(dataset, false);
                dataset.backgroundColor = addAlphaToHexColour("#C9C9C9", 1.0);
                dataset.borderColor = addAlphaToHexColour("#C9C9C9", 1.0);
                dataset.order = dataset.team.league_rank
            }
        }
    } else {
        for (let datasetIdx = 0; datasetIdx < chart.data.datasets.length; datasetIdx++) {
            let dataset = chart.data.datasets[datasetIdx]
            _setDatasetPointStyling(dataset, true);
            dataset.backgroundColor = dataset.team.secondary_colour;
            dataset.borderColor = dataset.team.primary_colour;
            dataset.order = dataset.team.league_rank;
        }
    }

    chart.update();
}


export { 
    standingsGraphTeamOptions, 
    standingsGraphXAxisGamesOptions, 
    standingsGraphXAxisTimeScaleOptions, 
    standingsGraphYAxisOptions,
    standingsGraphSeasonOptions,
    getStandingsGraphDataFromTeamData,
    getStandingsGraphOptions,
};