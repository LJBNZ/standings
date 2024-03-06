import { standingsGraphTeamOptions, standingsGraphXAxisTimeScaleOptions, standingsGraphYAxisOptions } from './standingsGraphData'; 
import { DateTime } from "luxon";


function addOrdinalSuffixToNum(num) {
    // Adds 'st'/'nd'/'rd'/'th' suffix to number
    let j = num % 10,
        k = num % 100;
    if (j === 1 && k !== 11) {
        return num + "st";
    }
    if (j === 2 && k !== 12) {
        return num + "nd";
    }
    if (j === 3 && k !== 13) {
        return num + "rd";
    }
    return num + "th";
}


const getOrCreateTooltip = (chart) => {
    let tooltipEl = document.getElementById('chartjs-tooltip');
  
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.style.background = 'rgba(0, 0, 0, 0.7)';
        tooltipEl.style.borderRadius = '3px';
        tooltipEl.style.color = 'white';
        tooltipEl.style.opacity = 1;
        tooltipEl.style.pointerEvents = 'none';
        tooltipEl.style.position = 'absolute';
        tooltipEl.style.transform = 'translate(-50%, 0)';
        tooltipEl.style.transition = 'all .1s ease';
        tooltipEl.style.float = 'left';

    
        const table = document.createElement('table');
        table.style.margin = '6px';
    
        tooltipEl.appendChild(table);
        tooltipEl.id = 'chartjs-tooltip';
        chart.canvas.parentNode.appendChild(tooltipEl);
    }
  
    return tooltipEl;
};


function _getTooltipTitle(tooltip, xAxisTimeStepOption) {
    // Get the title for the tooltip based on the x-axis option
    let dataPoint = tooltip.dataPoints[0];
    let pointXLabel = dataPoint.raw.x;
    if (xAxisTimeStepOption == standingsGraphXAxisTimeScaleOptions.gameNum) {
        return `Game ${pointXLabel}`;
    } else {
        let pointDate = DateTime.fromMillis(dataPoint.parsed.x);
        let dateText = pointDate.toFormat('d LLL yyyy');
        if (xAxisTimeStepOption == standingsGraphXAxisTimeScaleOptions.week) {
            let data = dataPoint.dataset.data;
            let endOfFollowingWeekDateTime = DateTime.fromMillis(data[Math.max(data.length - 2, 0)].x).plus({'weeks': 1});
            if (dataPoint.dataIndex + 1 === data.length && (DateTime.now() < endOfFollowingWeekDateTime)) {
                // Current week
                return `Week ${dataPoint.dataIndex} (current)`;
            } else {
                return `Week ${dataPoint.dataIndex} (ending ${dateText})`;
            }
        } else if (xAxisTimeStepOption == standingsGraphXAxisTimeScaleOptions.month) {
            return pointDate.toLocaleString(DateTime.DATE_FULL);
        } else {
            return dateText;
        }
    }
}


function _getTooltipTeamText(dataPoint, xAxisTimeStepOption, yAxisOption, teamSubsetOption) {
    // Get the text for the data point as it relates to team record and x axis option
    // TODO why doesn't this work for a single conference's teams first day point on seed by day mode???????????????????????????????????????????????????????????????????
    var recordText, flavourText;
    if (yAxisOption === standingsGraphYAxisOptions.seed) {
        let xTimeMs = dataPoint.raw.x;
        let mostRecentGame;
        for (const game of dataPoint.dataset.team.games) {
            if (game.date_ms <= xTimeMs) {
                mostRecentGame = game;
            } else {
                break;
            }
        }
        recordText = `${mostRecentGame.cumulative_wins}-${mostRecentGame.cumulative_losses}`;
        let rankWithOrdinalSuffix = addOrdinalSuffixToNum(dataPoint.raw.y);
        flavourText = teamSubsetOption === standingsGraphTeamOptions.all ? `Ranked ${rankWithOrdinalSuffix}` : `${rankWithOrdinalSuffix} seed`;
    } else {
        if (xAxisTimeStepOption == standingsGraphXAxisTimeScaleOptions.gameNum || xAxisTimeStepOption == standingsGraphXAxisTimeScaleOptions.day) {
            // Game number or day timestep - just print current record
            let game = dataPoint.dataset.team.games[dataPoint.dataIndex - 1];
            recordText = `${game.cumulative_wins}-${game.cumulative_losses}`;
            flavourText = `${game.outcome} ${game.matchup} ${game.team_score}-${game.opponent_score}`;
        } else  {
            // Week or month timesteps - tally record in step
            let gamesInTimeStep = dataPoint.raw.games;
            let wins = 0, losses = 0;
            for (const game of gamesInTimeStep) {
                if (game.outcome == 'W') {
                    wins++;
                } else {
                    losses++;
                }
            }
            let lastGame = gamesInTimeStep[gamesInTimeStep.length - 1];
            recordText = `${lastGame.cumulative_wins}-${lastGame.cumulative_losses}`;
            if (xAxisTimeStepOption == standingsGraphXAxisTimeScaleOptions.week) {
                flavourText = `${wins}-${losses} in week`;
            } else {
                let pointDateTime = DateTime.fromMillis(dataPoint.parsed.x);
                let prevMonthName = pointDateTime.minus({'days': 1}).toLocaleString({month: 'short'});
                flavourText = `${wins}-${losses} in ${prevMonthName}`;
            }
        }
    }
    return {recordText: recordText, flavourText: flavourText};
}


const externalTooltipHandler = (context) => {
    // Tooltip Element
    const {chart, tooltip} = context;
    let tooltipEl = getOrCreateTooltip(chart);

    // Hide if no active elements
    if (tooltip.dataPoints.length === 0 || tooltip.dataPoints[0].dataIndex === 0 || tooltip.opacity === 0) {
        tooltipEl.style.opacity = 0;
        return;
    }

    const xAxisTimeStepOption = tooltip.dataPoints[0].dataset.xAxisTimeStepOption;
    const yAxisOption = tooltip.dataPoints[0].dataset.yAxisOption;
    const teamSubsetOption = tooltip.dataPoints[0].dataset.teamSubsetOption;

    // Construct table header
    const title = _getTooltipTitle(tooltip, xAxisTimeStepOption);

    const tableHead = document.createElement('thead');

    const tr = document.createElement('tr');
    tr.style.borderWidth = 0;

    const th = document.createElement('th');
    th.style.borderWidth = 0;
    const text = document.createTextNode(title);
    th.appendChild(text);
    tr.appendChild(th);
    tableHead.appendChild(tr);


    // Construct table body
    const tableBody = document.createElement('tbody');
    tooltip.dataPoints.forEach((dataPoint, i) => {
        const tr = document.createElement('tr');
        tr.style.borderWidth = 0;
        tr.style.marginTop = '4px';
        tr.style.display = 'flex';
        tr.style.alignItems = 'center';

        const teamRecordTextCell = document.createElement('td');
        teamRecordTextCell.style.borderWidth = 0;
        teamRecordTextCell.style.marginRight = '8px';
        const flavourTextCell = document.createElement('td');
        flavourTextCell.style.borderWidth = 0;
        
        const image = document.createElement('img');
        image.style.width = '30px';
        image.src = dataPoint.dataset.logoURL;

        const teamRecordSwatch = document.createElement('div');
        teamRecordSwatch.style.height = '10px';
        teamRecordSwatch.style.padding = '6px 6px 6px 4px';
        teamRecordSwatch.style.textAlign = 'center';
        teamRecordSwatch.style.verticalAlign = 'middle';
        teamRecordSwatch.style.color = dataPoint.dataset.team.text_colour;
        teamRecordSwatch.style.backgroundColor = dataPoint.dataset.team.primary_colour;
        teamRecordSwatch.style.borderRadius = '6px';
        teamRecordSwatch.style.display = 'flex';
        teamRecordSwatch.style.alignItems = 'center';

        let {recordText, flavourText} = _getTooltipTeamText(dataPoint, xAxisTimeStepOption, yAxisOption, teamSubsetOption);
        
        if (['W ', 'L '].includes(flavourText.slice(0, 2))) {
            let outcomeText = flavourText.slice(0, 1);
            flavourText = flavourText.slice(1);
            let outcomeTextNode = document.createTextNode(outcomeText);
            let outcomeTextElement = document.createElement('span');
            outcomeTextElement.style.fontWeight = 'bold';
            outcomeTextElement.style.color = outcomeText == 'W' ? '#68e869' : '#e86868';
            outcomeTextElement.appendChild(outcomeTextNode);
            flavourTextCell.appendChild(outcomeTextElement);
        }
        const flavourTextNode = document.createTextNode(flavourText);

        const slugText = document.createElement('p');
        const slugTextNode = document.createTextNode(dataPoint.dataset.team.slug);
        slugText.style.fontWeight = 'bold';
        slugText.style.verticalAlign = 'middle';
        slugText.style.color = dataPoint.dataset.team.text_colour;
        slugText.style.margin = '0px 4px 0px 4px';
        slugText.appendChild(slugTextNode);
        
        const teamRecordText = document.createElement('p');
        const teamRecordTextNode = document.createTextNode(recordText);
        teamRecordText.appendChild(teamRecordTextNode);
        
        teamRecordSwatch.appendChild(image);
        teamRecordSwatch.appendChild(slugText);
        teamRecordSwatch.appendChild(teamRecordText);

        teamRecordTextCell.appendChild(teamRecordSwatch);
        flavourTextCell.appendChild(flavourTextNode);

        tr.appendChild(teamRecordTextCell);
        tr.appendChild(flavourTextCell);
        tableBody.appendChild(tr);
    });

    const tableRoot = tooltipEl.querySelector('table');

    // Remove old children from previous tooltips' content
    while (tableRoot.firstChild) {
        tableRoot.firstChild.remove();
    }

    // Add new children
    tableRoot.appendChild(tableHead);
    tableRoot.appendChild(tableBody);

    const {offsetLeft: positionX, offsetTop: positionY} = chart.canvas;

    // Display, position, and set styles for font
    tooltipEl.style.opacity = 1;
    tooltipEl.style.left = positionX + tooltip.caretX - Math.min(100, tooltip.caretX - 100) + 'px';
    tooltipEl.style.top = positionY + tooltip.caretY + 20 + 'px';
    tooltipEl.style.font = tooltip.options.bodyFont.string;
    tooltipEl.style.textAlign = 'left';
    tooltipEl.style.padding = tooltip.options.padding + 'px ' + tooltip.options.padding + 'px';
};


export { externalTooltipHandler };