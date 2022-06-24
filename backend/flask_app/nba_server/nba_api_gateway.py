from dataclasses import dataclass
import time
from typing import  Any, Dict, List, Tuple
import json
import os
import pickle

from nba_api.stats.endpoints.leaguestandingsv3 import LeagueStandingsV3
from nba_api.stats.endpoints.teamgamelogs import TeamGameLogs
from nba_api.stats.static import teams

from . import supplementary_team_data

SEASON_YEAR = '2021-22'
SEASON_TYPE = 'Regular Season'

TEAM_DATA_FILE = os.path.join(os.path.dirname(__file__), 'teamdata')


@dataclass
class Game():
    id: str
    game_num: int
    date: Any
    matchup: str
    outcome: str
    cumulative_wins: int
    cumulative_losses: int


@dataclass
class Team():
    name: str
    primary_colour: str
    secondary_colour: str
    conference: str
    division: str
    last_10: str
    current_streak: int
    games: List[Game]
    league_rank: int = 0

    def as_dict(self):
        attrs = self.__dict__
        attrs['games'] = [game.__dict__ for game in self.games]
        return attrs


def _get_parsed_game_logs(game_logs: Dict) -> List[Game]:
    id_column_idx = game_logs['headers'].index('GAME_ID')
    date_column_idx = game_logs['headers'].index('GAME_DATE')
    matchup_column_idx = game_logs['headers'].index('MATCHUP')
    outcome_column_idx = game_logs['headers'].index('WL')

    games = []
    n_wins = n_losses = 0
    for game_num, raw_game_data in enumerate(reversed(game_logs['data']), start=1):
        game_id = int(raw_game_data[id_column_idx])
        game_date = raw_game_data[date_column_idx]
        matchup = raw_game_data[matchup_column_idx]
        outcome = raw_game_data[outcome_column_idx]
        if outcome == 'W':
            n_wins += 1
        else:
            n_losses += 1
        games.append(Game(game_id, game_num, game_date, matchup, outcome, n_wins, n_losses))

    return games
            

def _get_game_logs_for_team(team_id: int) -> List[Game]:
    game_logs_data = TeamGameLogs(season_nullable=SEASON_YEAR, season_type_nullable=SEASON_TYPE, team_id_nullable=team_id)
    game_logs = _get_parsed_game_logs(game_logs_data.team_game_logs.data)
    return game_logs


def _get_standings_info_for_team(league_standings_response, team_id: int) -> Tuple:
    league_standings_headers = league_standings_response.standings.data['headers']
    league_standings_data = league_standings_response.standings.data['data']
    headers_to_data_indices = {header: idx for idx, header in enumerate(league_standings_headers)}
    for team_standings_data in league_standings_data:
        if team_standings_data[headers_to_data_indices['TeamID']] == team_id:
            desired_team_standings_data = team_standings_data
            break
    else:
        raise RuntimeError(f"Cannot find data for team ID {team_id}")

    conference = desired_team_standings_data[headers_to_data_indices['Conference']]
    division = desired_team_standings_data[headers_to_data_indices['Division']]
    last_ten = desired_team_standings_data[headers_to_data_indices['L10']].strip()  # Remove trailing whitespace
    current_streak = desired_team_standings_data[headers_to_data_indices['CurrentStreak']]
    
    return (conference, division, last_ten, current_streak)


def _get_teams_data() -> List[Team]:
    league_standings = LeagueStandingsV3(season=SEASON_YEAR, season_type=SEASON_TYPE)
    all_teams_raw = teams.get_teams()

    all_teams = []
    for raw_team_data in all_teams_raw:
        time.sleep(0.6)  # slowdown for API calls

        # Team basic info
        team_id = raw_team_data['id']
        team_name = raw_team_data['full_name']
        primary_colour, secondary_colour = supplementary_team_data.get_colours_for_team(team_name)

        # Team standings info
        conference, division, last_ten, current_streak = _get_standings_info_for_team(league_standings, team_id)

        # Team game logs
        print(f'Getting data for {team_name}...')
        games = _get_game_logs_for_team(team_id)
        
        all_teams.append(Team(team_name, 
                              primary_colour,
                              secondary_colour,
                              conference,
                              division,
                              last_ten,
                              current_streak,
                              games))


    # After compiling data for all teams, determine each teams' league-wide ranking
    # (This is required to be done manually as the endpoint currently returns bad ranking data)
    sorted_team_win_loss_ratio = sorted([((team.games[-1].cumulative_wins / team.games[-1].cumulative_losses), team.name)
                                            for team in all_teams], reverse=True)
    teams_ordered_by_rank = [team for _ratio, team in sorted_team_win_loss_ratio]

    for team in all_teams:
        team.league_rank = teams_ordered_by_rank.index(team.name)

    return all_teams


def _load_team_data():
    with open(TEAM_DATA_FILE, 'rb') as file:
        data = pickle.load(file)
        return data   


def _store_team_data():
    data = _get_teams_data()
    with open(TEAM_DATA_FILE, 'wb') as file:
        pickle.dump(data, file)


def _get_team_games_data():
    if not os.path.exists(TEAM_DATA_FILE):
        _store_team_data()
    raw_teams_data = _load_team_data()
    jsonified_teams_data = [team.as_dict() for team in raw_teams_data]
    return jsonified_teams_data


def get_graph_data():
    team_data = _get_team_games_data()
    return team_data
