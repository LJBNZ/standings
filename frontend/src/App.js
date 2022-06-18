import './App.css';

import { standingsGraphTeamOptions, 
         standingsGraphXAxisGamesOptions, 
         standingsGraphXAxisTimeResolutionOptions, 
         standingsGraphYAxisOptions, 
         getStandingsGraphDataFromTeamData,
         getStandingsGraphOptions } from './standingsGraphData';

import React, { useEffect, useState } from 'react';
import { Chart as ChartJS } from 'chart.js/auto'
import { Chart, Line } from 'react-chartjs-2';

const data = {
  labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  datasets: [
    {
      label: "First dataset",
      data: [33, 53, 85, 41, 44, 65],
      fill: true,
      backgroundColor: "rgba(75,192,192,0.2)",
      borderColor: "rgba(75,192,192,1)"
    },
    {
      label: "Second dataset",
      data: [33, 25, 35, 51, 54, 76],
      fill: false,
      borderColor: "#742774"
    }
  ]
};

function App() {

  const [teamSubsetOption, setTeamSubsetOption] = useState(standingsGraphTeamOptions.all);
  const [numGamesOption, setNumGamesOption] = useState(standingsGraphXAxisGamesOptions.all);
  const [timeStepOption, setTimeStepOption] = useState(standingsGraphXAxisTimeResolutionOptions.monthToMonth);
  const [yAxisOption, setYAxisOption] = useState(standingsGraphYAxisOptions.record);

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
                                               timeStepOption, 
                                               yAxisOption);
  let options = getStandingsGraphOptions(teamSubsetOption,                                        
                                         numGamesOption, 
                                         timeStepOption, 
                                         yAxisOption);

  return (
    <div className="App">
      {isLoading ? 
      (<p>LOADING...</p>) : 
      (<Line data={data} options={options}/>)}
    </div>
  );

}

export default App;
