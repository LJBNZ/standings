from dataclasses import dataclass
import time
from typing import  Any, Dict, List
import json
import os
import pickle

from nba_api.stats.endpoints.teamgamelogs import TeamGameLogs
from nba_api.stats.static import teams

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
    games: List[Game]

    def as_dict(self):
        games = [game.__dict__ for game in self.games]
        return {'team_name': self.name, 'games': games}


def _get_parsed_game_logs(game_logs: Dict) -> List[Game]:
    id_column_idx = game_logs['headers'].index('GAME_ID')
    date_column_idx = game_logs['headers'].index('GAME_DATE')
    matchup_column_idx = game_logs['headers'].index('MATCHUP')
    outcome_column_idx = game_logs['headers'].index('WL')

    games = []
    n_wins = n_losses = 0
    for game_num, raw_game_data in enumerate(reversed(game_logs['data'])):
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


def _get_teams_data() -> List[Team]:
    all_teams_raw = teams.get_teams()
    all_teams = []
    for raw_team_data in all_teams_raw:
        time.sleep(0.6)  # slowdown for API calls
        team_id = raw_team_data['id']
        team_name = raw_team_data['full_name']
        print(f'Getting data for {team_name}...')
        games = _get_game_logs_for_team(team_id)
        all_teams.append(Team(team_name, games))
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
    jsonified_teams_data = json.dumps([team.as_dict() for team in raw_teams_data], sort_keys=True, indent=4)
    return jsonified_teams_data


def get_graph_data():
    team_data = _get_team_games_data()
    return team_data


# TESTING CODE BELOW

# def debug():
#     print(_get_team_games_data())


# if __name__ == '__main__':
#     debug()
