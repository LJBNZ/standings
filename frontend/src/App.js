import './App.css';

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

  const [teamData, setTeamData] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(()=>{
    setIsLoading(true);
    fetch('/teamData')
      .then(res => res.text())
        .then(
          (result) => {
            setTeamData(result);
            setIsLoading(false);
          },
          (error) => {
            console.log(error);
          }
        )
  }, []);

  return (
    <div className="App">
      {isLoading ? 
      (<p>LOADING...</p>) : 
      (<Line data={data} />)}
    </div>
  );

}

export default App;
