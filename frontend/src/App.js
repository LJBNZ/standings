import './App.css';

import { standingsGraphTeamOptions, 
         standingsGraphXAxisGamesOptions, 
         standingsGraphXAxisTimeScaleOptions, 
         standingsGraphYAxisOptions, 
         getStandingsGraphDataFromTeamData,
         getStandingsGraphOptions } from './standingsGraphData';

import React, { useEffect, useState } from 'react';
import { Chart as ChartJS } from 'chart.js/auto'
import { Chart, Line } from 'react-chartjs-2';

import GraphOptions from './GraphOptions';

const teamSubsetDefault = standingsGraphTeamOptions.all;
const numGamesDefault = standingsGraphXAxisGamesOptions.all;
const timeScaleDefault = standingsGraphXAxisTimeScaleOptions.gameToGame;
const yAxisDefault = standingsGraphYAxisOptions.record;

function App() {

  const [teamSubsetOption, setTeamSubsetOption] = useState(teamSubsetDefault);
  const [numGamesOption, setNumGamesOption] = useState(numGamesDefault);
  const [timeScaleOption, setTimeScaleOption] = useState(timeScaleDefault);
  const [yAxisOption, setYAxisOption] = useState(yAxisDefault);

  const [teamData, setTeamData] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(()=>{
    setIsLoading(true);
    fetch('/teamData')
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
  }, []);

  let data = getStandingsGraphDataFromTeamData(teamData, 
                                               teamSubsetOption, 
                                               numGamesOption, 
                                               timeScaleOption, 
                                               yAxisOption);

  let options = getStandingsGraphOptions(teamSubsetOption,                                        
                                         numGamesOption, 
                                         timeScaleOption, 
                                         yAxisOption);

  const teamSubsetOptions = {name: "teamSubsetOptions", options: standingsGraphTeamOptions, default: teamSubsetDefault, setter: setTeamSubsetOption};
  const numGamesOptions = {name: "numGamesOptions", options: standingsGraphXAxisGamesOptions, default: numGamesDefault, setter: setNumGamesOption};
  const timeScaleOptions = {name: "timeScaleOptions", options: standingsGraphXAxisTimeScaleOptions, default: timeScaleDefault, setter: setTimeScaleOption};
  const yAxisOptions = {name: "yAxisOptions", options: standingsGraphYAxisOptions, default: yAxisDefault, setter: setYAxisOption};

  if (isLoading) {
    return <p>LOADING...</p>
  } else {
    return (
      <div className="App">
        <Line data={data} options={options}/>
        <GraphOptions teamSubsetOptions={teamSubsetOptions} numGamesOptions={numGamesOptions} timeScaleOptions={timeScaleOptions} yAxisOptions={yAxisOptions} />
        
      </div>
    )
  }
}

export default App;
