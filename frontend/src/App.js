import './App.css';

import { standingsGraphTeamOptions, 
         standingsGraphXAxisGamesOptions, 
         standingsGraphXAxisTimeScaleOptions, 
         standingsGraphYAxisOptions,
         standingsGraphSeasonOptions,
         getStandingsGraphDataFromTeamData,
         getStandingsGraphOptions } from './standingsGraphData';

import React, { useEffect, useMemo, useState } from 'react';
import { Chart as ChartJS } from 'chart.js/auto'
import { Chart, Line } from 'react-chartjs-2';

import GraphOptions from './GraphOptions';

const teamSubsetDefault = standingsGraphTeamOptions.all;
const numGamesDefault = standingsGraphXAxisGamesOptions.all;
const timeScaleDefault = standingsGraphXAxisTimeScaleOptions.gameToGame;
const yAxisDefault = standingsGraphYAxisOptions.record;
const seasonDefault = standingsGraphSeasonOptions[2023];


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

  if (isLoading) {
    return <p>LOADING...</p>
  } else {
    return (
      <div className="App">
        <Line data={data} options={options}/>
        <GraphOptions teamSubsetOptions={teamSubsetOptions} 
                      numGamesOptions={numGamesOptions} 
                      timeScaleOptions={timeScaleOptions} 
                      yAxisOptions={yAxisOptions}
                      seasonOptions={seasonOptions} />
        
      </div>
    )
  }
}

export default App;
