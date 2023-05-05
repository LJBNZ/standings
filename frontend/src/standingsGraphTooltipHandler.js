import { standingsGraphXAxisTimeScaleOptions } from './standingsGraphData'; 


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
    let pointXLabel = dataPoint.label;
    if (xAxisTimeStepOption == standingsGraphXAxisTimeScaleOptions.gameNum) {
        return `Game ${pointXLabel}`;
    } else if (xAxisTimeStepOption == standingsGraphXAxisTimeScaleOptions.week) {
        return `Week ${pointXLabel}`;
    } else {
        return pointXLabel;
    }
}
  
function _getTooltipTeamText(dataPoint, xAxisTimeStepOption) {
    // Get the text for the data point as it relates to team record and x axis option
    var leftText, rightText;
    if (xAxisTimeStepOption == standingsGraphXAxisTimeScaleOptions.gameNum) {
        let game = dataPoint.dataset.team.games[dataPoint.dataIndex - 1];   // TODO offset index in case game numbers filtered
        leftText = `${dataPoint.dataset.team.slug} (${game.cumulative_wins}W-${game.cumulative_losses}L)`;
        rightText = `${game.outcome} ${game.matchup} ${game.team_score}-${game.opponent_score}`;
    } else  {
        let timeStepIndex = dataPoint.dataIndex;
        if (xAxisTimeStepOption == standingsGraphXAxisTimeScaleOptions.month) {
            // timeStepIndex = months.indexOf(dataPoint.label);
        }
        let gamesInTimeStep = dataPoint.dataset.gamesByTimestep.get(timeStepIndex);
        let wins = 0, losses = 0;
        for (let game of gamesInTimeStep) {
            if (game.outcome == 'W') {
                wins++;
            } else {
                losses++;
            }
        }
        let lastGame = gamesInTimeStep[gamesInTimeStep.length - 1];
        leftText = `${dataPoint.dataset.team.slug} (${lastGame.cumulative_wins}W-${lastGame.cumulative_losses}L)`;
        if (xAxisTimeStepOption == standingsGraphXAxisTimeScaleOptions.week) {
            rightText = `${wins}-${losses} in week`;
        } else {
            rightText = `${wins}-${losses} in month`;
        }
    }
    return {leftText, rightText};
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

    let xAxisTimeStepOption = tooltip.dataPoints[0].dataset.xAxisTimeStepOption;

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
        const colors = tooltip.labelColors[i];

        const tr = document.createElement('tr');
        tr.style.backgroundColor = 'inherit';
        tr.style.borderWidth = 0;

        const td = document.createElement('td');
        td.style.borderWidth = 0;

        const image = document.createElement('img');
        image.style = 'width:20px'
        image.src = dataPoint.dataset.logoURL;

        let {leftText, rightText} = _getTooltipTeamText(dataPoint, xAxisTimeStepOption);
        const leftNode = document.createTextNode(leftText);
        const rightNode = document.createTextNode(rightText);

        td.appendChild(image);
        td.appendChild(leftNode);
        td.appendChild(rightNode);

        tr.appendChild(td);
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
    tooltipEl.style.left = positionX + tooltip.caretX + 'px';
    tooltipEl.style.top = positionY + tooltip.caretY + 'px';
    tooltipEl.style.font = tooltip.options.bodyFont.string;
    tooltipEl.style.textAlign = 'left';
    tooltipEl.style.padding = tooltip.options.padding + 'px ' + tooltip.options.padding + 'px';
};

export { externalTooltipHandler };