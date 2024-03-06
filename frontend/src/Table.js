import styled from "styled-components";
import { useTable, useSortBy } from 'react-table'
import React from 'react';


const StyledTd = styled.td`
    text-align: left;
`


const StyledTr = styled.tr`
    text-align: left;
    
`

const StyledTh = styled.th`
    text-align: left;
    ${'' /* width: 75px; */}
    padding-right: 30px;
`

const StyledTable = styled.table`
    border-collapse: collapse;
    color: #292929;
`

const StyledTbody = styled.tbody`
    ${StyledTr}:nth-child(odd) {
        background: #D0D0D0;
    }
    ${'' /* ${({ active }) => active && `
    background: blue;
    `} */}
    ${StyledTr}:nth-child(6) {
        border-bottom: 1px solid black;
    }
    ${StyledTr}:nth-child(10) {
        border-bottom: 1px solid red;
    }

`

const TeamSlug = styled.div`
    color: ${props => props.textColour};
    background: ${props => props.primaryColour};
    display: flex;
    align-items: center;
    text-align: center;
    font-weight: bold;
    height: 18px;
    line-height: 36px;
    border-radius: 5px;
    padding: 0px 10px 2px 4px;
    img {
        vertical-align: middle;
        padding-right: 6px;
    }
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
        streakEmoji = '🔥';
    } else if (streak <= -3) {
        streakEmoji = '❄️';
    }
    let absStreak = Math.abs(streak);
    let streakEmojis = streakEmoji.repeat(Math.min(3, Math.floor(absStreak/3)));  // Cap at 3, shoutout 2023 Pistons
    let streakString = `${prefix}${Math.abs(absStreak)} ${streakEmojis}`;

    let teamSlug = 
        <TeamSlug primaryColour={dataset.team.primary_colour} secondaryColour={dataset.team.secondary_colour} textColour={dataset.team.text_colour}>
            <img src={dataset.logoURL} height="32px" width="32px"/>
            {dataset.team.slug}
        </TeamSlug>;

    return {
        rank: (teamSubset.selected == 'all' ? dataset.team.league_rank : dataset.team.conference_seed),
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
        streak: streakString.trim(),
        clinched: clinchString,
    };
}

function StandingsTable({data, teamSubset}) {
    const columns = React.useMemo(
        () => [
                {Header: '#', accessor: 'rank'},
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

    const defaultSort = React.useMemo(
        () => [
          {
            id: "rank",
            desc: false
          }
        ],
        []
      );

    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        rows,
        prepareRow,
    } = useTable({ columns, data: tableData, initialState: {sortBy: defaultSort} }, useSortBy)

    return (
        <StyledTable {...getTableProps()}>
            <thead>
                {headerGroups.map(headerGroup => (
                    <StyledTr {...headerGroup.getHeaderGroupProps()}>
                        {headerGroup.headers.map(column => (
                            <StyledTh {...column.getHeaderProps(column.getSortByToggleProps())}>{column.render('Header')}
                                <span>
                                    {column.isSorted ? column.isSortedDesc ? '🔽' : '🔼' : ''}
                                </span>
                            </StyledTh>
                        ))}
                    </StyledTr>
                ))}
            </thead>
            <StyledTbody {...getTableBodyProps()} orderedByRank={true}>
                {rows.map((row, i) => {
                    prepareRow(row)
                    return (
                        <StyledTr {...row.getRowProps()}>
                            {row.cells.map(cell => {
                                return <StyledTd {...cell.getCellProps()}>{cell.render('Cell')}</StyledTd>
                            })}
                        </StyledTr>
                    )
                })}
            </StyledTbody>
        </StyledTable>
    )
}


export { StandingsTable, TeamSlug };