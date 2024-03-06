import { standingsGraphTeamOptions, 
         standingsGraphXAxisTimeScaleOptions, 
         standingsGraphYAxisOptions,
         standingsGraphSeasonOptions,
         getStandingsGraphDataFromTeamData,
         getStandingsGraphOptions } from './standingsGraphData';

import React, { useEffect, useMemo, useState } from 'react';
import Chart from 'chart.js/auto';
import { Line } from 'react-chartjs-2';
import { defaults } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import 'chartjs-adapter-luxon';

import GraphOptions from './GraphOptions';
import { StandingsTable } from './Table';
import styled, { createGlobalStyle } from 'styled-components';


Chart.register(annotationPlugin);


const teamSubsetDefault = standingsGraphTeamOptions.all;
const timeScaleDefault = standingsGraphXAxisTimeScaleOptions.gameNum;
const yAxisDefault = standingsGraphYAxisOptions.record;
const seasonDefault = standingsGraphSeasonOptions[2024];

const GlobalStyle = createGlobalStyle`
  body {
    background-color: #e0e0e0;
    font-family: Inconsolata;
  }
`

const StyledApp = styled.div`
  margin: 0 auto;
  ${'' /* width: 75%; */}
  display: inline;
`

const StandingsGraph = styled(Line)`
`

defaults.font.family = 'Inconsolata';
defaults.color = '#292929'; 
defaults.borderColor = 'rgba(0, 0, 0, 0.2)';
defaults.backgroundColor = 'rgba(0, 0, 0, 1)';

function App() {

  const [teamSubsetOption, setTeamSubsetOption] = useState(teamSubsetDefault);
  const [timeScaleOption, setTimeScaleOption] = useState(timeScaleDefault);
  const [yAxisOption, setYAxisOption] = useState(yAxisDefault);
  const [seasonOption, setSeasonOption] = useState(seasonDefault);

  const [teamData, setTeamData] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(()=>{
    setIsLoading(true);
    fetch(`/nba/${seasonOption}`)
      .then(res => res.json())
        .then(
          (result) => {
            setIsLoading(false);
            setTeamData(result);
          },
          (error) => {
            console.log(error);
          }
        )
  }, [seasonOption]);

  let data = useMemo(() => getStandingsGraphDataFromTeamData(teamData, teamSubsetOption, timeScaleOption, yAxisOption, seasonOption), [teamData, teamSubsetOption, timeScaleOption, yAxisOption, seasonOption]);
  let options = useMemo(() => getStandingsGraphOptions(teamSubsetOption, timeScaleOption, yAxisOption, seasonOption), [teamSubsetOption, timeScaleOption, yAxisOption, seasonOption]);

  const teamSubsetOptions = {name: "teamSubsetOptions", options: standingsGraphTeamOptions, selected: teamSubsetOption, setter: setTeamSubsetOption};
  const timeScaleOptions = {name: "timeScaleOptions", options: standingsGraphXAxisTimeScaleOptions, selected: timeScaleOption, setter: setTimeScaleOption};
  const yAxisOptions = {name: "yAxisOptions", options: standingsGraphYAxisOptions, selected: yAxisOption, setter: setYAxisOption};
  const seasonOptions = {name: "seasonOptions", options: standingsGraphSeasonOptions, selected: seasonOption, setter: setSeasonOption};

  return (
    <>
      <GlobalStyle/>
      <div style={{width: '300px', margin: '0 auto', textAlign: 'center'}}>
        <h1>Cool heading</h1>
        <h3>cooler subheading</h3>
      </div>
      <StyledApp className="App">
        <div style={{margin: '20px', width: '40%', height: '60%', overflowX: 'auto', display: 'inline-block', verticalAlign: 'top'}}>
          <StandingsGraph data={data} options={options} height={'800px'} width={'0px'}/>
        </div>
        <div style={{margin: '20px', width: '40%', height: '60%', overflowX: 'auto', overflowY: 'auto', display: 'inline-block', verticalAlign: 'top'}}>
          <StandingsTable data={data} teamSubset={teamSubsetOptions}/>
        </div>
        <GraphOptions teamSubsetOptions={teamSubsetOptions} 
                      timeScaleOptions={timeScaleOptions} 
                      yAxisOptions={yAxisOptions}
                      seasonOptions={seasonOptions}/>
      </StyledApp>
    </>
  )
}

export default App;
