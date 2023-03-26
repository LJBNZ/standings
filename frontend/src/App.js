import './App.css';

import { standingsGraphTeamOptions, 
         standingsGraphXAxisGamesOptions, 
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

import GraphOptions from './GraphOptions';
import StandingsTable from './Table';
import styled, { createGlobalStyle } from 'styled-components';

Chart.register(annotationPlugin);


const teamSubsetDefault = standingsGraphTeamOptions.all;
const numGamesDefault = standingsGraphXAxisGamesOptions.all;
const timeScaleDefault = standingsGraphXAxisTimeScaleOptions.gameToGame;
const yAxisDefault = standingsGraphYAxisOptions.record;
const seasonDefault = standingsGraphSeasonOptions[2023];

const GlobalStyle = createGlobalStyle`
  body {
    background-color: #e0e0e0;
  }
`

const StyledApp = styled.div`
  font-family: Inconsolata;
  margin: auto;
  width: 75%;
`

const StandingsGraph = styled(Line)`

`

defaults.font.family = 'Inconsolata';
defaults.color = '#292929'; 
defaults.borderColor = 'rgba(0, 0, 0, 0.2)';
defaults.backgroundColor = 'rgba(0, 0, 0, 1)';

function App() {

  const [teamSubsetOption, setTeamSubsetOption] = useState(teamSubsetDefault);
  const [numGamesOption, setNumGamesOption] = useState(numGamesDefault);
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

  let data = getStandingsGraphDataFromTeamData(teamData, 
                                               teamSubsetOption, 
                                               numGamesOption, 
                                               timeScaleOption, 
                                               yAxisOption);

  let options = getStandingsGraphOptions(teamSubsetOption,                                        
                                         numGamesOption, 
                                         timeScaleOption, 
                                         yAxisOption);

  const teamSubsetOptions = {name: "teamSubsetOptions", options: standingsGraphTeamOptions, selected: teamSubsetOption, setter: setTeamSubsetOption};
  const numGamesOptions = {name: "numGamesOptions", options: standingsGraphXAxisGamesOptions, selected: numGamesOption, setter: setNumGamesOption};
  const timeScaleOptions = {name: "timeScaleOptions", options: standingsGraphXAxisTimeScaleOptions, selected: timeScaleOption, setter: setTimeScaleOption};
  const yAxisOptions = {name: "yAxisOptions", options: standingsGraphYAxisOptions, selected: yAxisOption, setter: setYAxisOption};
  const seasonOptions = {name: "seasonOptions", options: standingsGraphSeasonOptions, selected: seasonOption, setter: setSeasonOption};

  return (
    <>
      <GlobalStyle/>
      <StyledApp className="App">
        <StandingsGraph data={data} options={options}/>
        <StandingsTable data={data} teamSubset={teamSubsetOptions}/>
        <GraphOptions teamSubsetOptions={teamSubsetOptions} 
                      numGamesOptions={numGamesOptions} 
                      timeScaleOptions={timeScaleOptions} 
                      yAxisOptions={yAxisOptions}
                      seasonOptions={seasonOptions}/>
      </StyledApp>
    </>
  )
}

export default App;
