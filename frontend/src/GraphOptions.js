import React, { useEffect, useState } from 'react';

import GraphOption from './GraphOption';

function GraphOptions(props) {
    const teamSubsetOptions = props.teamSubsetOptions;
    const numGamesOptions = props.numGamesOptions;
    const timeScaleOptions = props.timeScaleOptions;
    const yAxisOptions = props.yAxisOptions;

    const teamSubsetChoice = <GraphOption name={teamSubsetOptions.name} options={teamSubsetOptions.options} default={teamSubsetOptions.default} setter={teamSubsetOptions.setter}/>;
    const timeScaleChoice = <GraphOption name={timeScaleOptions.name} options={timeScaleOptions.options} default={timeScaleOptions.default} setter={timeScaleOptions.setter}/>;
    const yAxisChoice = <GraphOption name={yAxisOptions.name} options={yAxisOptions.options} default={yAxisOptions.default} setter={yAxisOptions.setter}/>;
    const numGamesChoice = <GraphOption name={numGamesOptions.name} options={numGamesOptions.options} default={numGamesOptions.default} setter={numGamesOptions.setter}/>;

    return (
        <div className="graphOptions">
            <h1>Show me {teamSubsetChoice} teams' {timeScaleChoice} {yAxisChoice} (for the last {numGamesChoice} games) in the 2021-22 season.</h1>
        </div>
    )
}

export default GraphOptions;