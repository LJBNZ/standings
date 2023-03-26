import styled from "styled-components";
import { useTable, useSortBy } from 'react-table'
import React from 'react';

const StyledTable = styled.table`

`

const TeamSlug = styled.div`
    color: ${props => props.secondaryColour};
    background: ${props => props.primaryColour};
    font-weight: bold;
    height: 25px;
    line-height: 25px;
    width: 50px;
    border-radius: 5px;
    margin: 10px;
`

function getTableData(data, teamSubset) {
    var tableRows = [];
    for (const dataset of data.datasets) {
        if (teamSubset.selected == 'all' || dataset.team.conference == teamSubset.selected) {
            tableRows.push(getTableRow(dataset, teamSubset));
        }
    }
    return tableRows;
}

function getTableRow(dataset, teamSubset) {
    const standingsInfo = dataset.team.standings_info;
    let clinchString = '-';
    if (standingsInfo.clinched_playoffs == 1) {
        clinchString = '✔️';
    } else if (standingsInfo.clinched_playin == 1) {
        clinchString = '🆚';
    } else if (standingsInfo.eliminated == 1) {
        clinchString = '❌';
    }

    const streak = standingsInfo.streak;
    let prefix = ((streak > 0) ? 'W' : 'L');
    let streakEmoji = '';

    if (streak >= 3) {
        streakEmoji = ' 🔥';
    } else if (streak <= -3) {
        streakEmoji = ' ❄️';
    }
    let streakString = `${prefix}${Math.abs(streak)}${streakEmoji}`;

    let teamSlug = 
        <TeamSlug primaryColour={dataset.team.primary_colour} secondaryColour={dataset.team.secondary_colour}>
            {dataset.team.slug}
        </TeamSlug>;

    return {
        rank: dataset.team.league_rank,
        seed: dataset.team.conference_seed,
        team: teamSlug,
        wins: standingsInfo.wins,
        losses: standingsInfo.losses,
        winPct: (standingsInfo.wins / (standingsInfo.wins + standingsInfo.losses)).toFixed(3),
        gamesBack: standingsInfo.games_back,
        home: standingsInfo.home,
        away: standingsInfo.road,
        pointsPerGame: standingsInfo.points_per_game,
        opponentPointsPerGame: standingsInfo.opponent_points_per_game,
        pointDifferential: standingsInfo.point_differential,
        last10: standingsInfo.last_10,
        streak: streakString,
        clinched: clinchString,
    };
}

function StandingsTable({data, teamSubset}) {
    const rankHeader = (teamSubset.selected == 'all' ? 'Rank' : 'Seed');
    const columns = React.useMemo(
        () => [
                {Header: rankHeader, accessor: rankHeader.toLowerCase()},
                {Header: 'Team', accessor: 'team'},
                {Header: '', accessor: 'clinched'},
                {Header: 'W', accessor: 'wins'},
                {Header: 'L', accessor: 'losses'},
                {Header: 'Pct.', accessor: 'winPct'},
                {Header: 'GB', accessor: 'gamesBack'},
                {Header: 'Home', accessor: 'home'},
                {Header: 'Away', accessor: 'away'},
                {Header: 'PPG', accessor: 'pointsPerGame'},
                {Header: 'Opp. PPG', accessor: 'opponentPointsPerGame'},
                {Header: 'Diff.', accessor: 'pointDifferential'},
                {Header: 'Last 10', accessor: 'last10'},
                {Header: 'Streak', accessor: 'streak'},
            ],
        [teamSubset]
    )
    
    const tableData = React.useMemo(() => getTableData(data, teamSubset), [data, teamSubset]);

    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        rows,
        prepareRow,
    } = useTable({ columns, data: tableData }, useSortBy)

    return (
        <StyledTable {...getTableProps()}>
            <thead>
                {headerGroups.map(headerGroup => (
                    <tr {...headerGroup.getHeaderGroupProps()}>
                        {headerGroup.headers.map(column => (
                            <th {...column.getHeaderProps(column.getSortByToggleProps())}>{column.render('Header')}
                                <span>
                                    {column.isSorted ? column.isSortedDesc ? ' ↓' : ' ↑' : ''}
                                </span>
                            </th>
                        ))}
                    </tr>
                ))}
            </thead>
            <tbody {...getTableBodyProps()}>
                {rows.map((row, i) => {
                    prepareRow(row)
                    return (
                        <tr {...row.getRowProps()}>
                            {row.cells.map(cell => {
                                return <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
                            })}
                        </tr>
                    )
                })}
            </tbody>
        </StyledTable>
    )
}


export default StandingsTable;