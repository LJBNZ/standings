import GraphOption from './GraphOption';
import styled from 'styled-components'


function GraphOptions(props) {
    const teamSubsetOptions = props.teamSubsetOptions;
    const numGamesOptions = props.numGamesOptions;
    const timeScaleOptions = props.timeScaleOptions;
    const yAxisOptions = props.yAxisOptions;
    const seasonOptions = props.seasonOptions;

    const teamSubsetChoice = <GraphOption name={teamSubsetOptions.name} options={teamSubsetOptions.options} selected={teamSubsetOptions.selected} setter={teamSubsetOptions.setter}/>;
    const timeScaleChoice = <GraphOption name={timeScaleOptions.name} options={timeScaleOptions.options} selected={timeScaleOptions.selected} setter={timeScaleOptions.setter}/>;
    const yAxisChoice = <GraphOption name={yAxisOptions.name} options={yAxisOptions.options} selected={yAxisOptions.selected} setter={yAxisOptions.setter}/>;
    const numGamesChoice = <GraphOption name={numGamesOptions.name} options={numGamesOptions.options} selected={numGamesOptions.selected} setter={numGamesOptions.setter}/>;
    const seasonChoice = <GraphOption name={seasonOptions.name} options={seasonOptions.options} selected={seasonOptions.selected} setter={seasonOptions.setter}/>;

    return (
        <div className="graphOptions" style={{width: '50%', margin: '0 auto'}}>
            <h1>Show me {teamSubsetChoice} teams' {timeScaleChoice} {yAxisChoice} (for the last {numGamesChoice} games) in the {seasonChoice} season.</h1>
        </div>
    )
}

export default GraphOptions;