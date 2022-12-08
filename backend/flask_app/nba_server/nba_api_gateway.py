from collections import defaultdict
from dataclasses import dataclass
import time
from typing import  Any, Dict, List, Tuple
import json
import os
import pickle

from nba_api.stats.endpoints.leaguestandingsv3 import LeagueStandingsV3
from nba_api.stats.endpoints.leaguegamefinder import LeagueGameFinder
from nba_api.stats.endpoints.teamgamelogs import TeamGameLogs
from nba_api.stats.static import teams

from . import supplementary_team_data

NBA_LEAGUE_ID = '00'
CURRENT_SEASON = '2022-23'
SEASON_TYPE = 'Regular Season'


def _get_cached_season_data_file_path(season_year: str):
    path = os.path.abspath(os.path.join(os.path.dirname(__file__), 'season_data_caches', season_year))
    print(path)
    return path


@dataclass
class Game():
    id: str
    game_num: int
    date: Any
    matchup: str
    team_score: int
    opponent_score: int
    outcome: str
    cumulative_wins: int
    cumulative_losses: int


@dataclass
class Team():
    name: str
    slug: str
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


def _get_parsed_game_logs(game_logs: Dict, team_id: int, team_scores_by_game_id: Dict) -> List[Game]:
    id_column_idx = game_logs['headers'].index('GAME_ID')
    date_column_idx = game_logs['headers'].index('GAME_DATE')
    matchup_column_idx = game_logs['headers'].index('MATCHUP')
    team_abbrv_column_idx = game_logs['headers'].index('TEAM_ABBREVIATION')
    outcome_column_idx = game_logs['headers'].index('WL')

    games = []
    n_wins = n_losses = 0
    for game_num, raw_game_data in enumerate(reversed(game_logs['data']), start=1):
        game_id = raw_game_data[id_column_idx]
        team_score = team_scores_by_game_id[game_id][team_id]
        opponent_score = next(score for t_id, score in team_scores_by_game_id[game_id].items() if t_id != team_id)
        game_date = raw_game_data[date_column_idx]
        team_abbrv = raw_game_data[team_abbrv_column_idx]
        matchup = raw_game_data[matchup_column_idx].replace(team_abbrv, '').strip()  # Strip team name from matchup string
        outcome = raw_game_data[outcome_column_idx]
        if outcome == 'W':
            n_wins += 1
        else:
            n_losses += 1
        games.append(Game(game_id, game_num, game_date, matchup, team_score, opponent_score, outcome, n_wins, n_losses))

    return games
            

def _get_game_logs_for_team(team_id: int, season_year: str, team_scores_by_game_id: Dict) -> List[Game]:
    game_logs_data = TeamGameLogs(season_nullable=season_year, season_type_nullable=SEASON_TYPE, team_id_nullable=team_id)
    game_logs = _get_parsed_game_logs(game_logs_data.team_game_logs.data, team_id, team_scores_by_game_id)
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


def _get_team_scores_by_game_id(all_games):
    # Creates a map of scores for each game by team ID
    game_id_column_idx = all_games['headers'].index('GAME_ID')
    team_id_column_idx = all_games['headers'].index('TEAM_ID')
    points_column_idx = all_games['headers'].index('PTS')
    
    scores_by_game_id = defaultdict(dict)

    for game in all_games['data']:
        game_id = game[game_id_column_idx]
        team_id = game[team_id_column_idx]
        team_score = game[points_column_idx]
        scores_by_game_id[game_id][team_id] = team_score

    return scores_by_game_id


def _get_teams_data(season_year: str) -> List[Team]:
    league_standings = LeagueStandingsV3(season=season_year, season_type=SEASON_TYPE)
    all_teams_raw = teams.get_teams()

    season_games = LeagueGameFinder(season_nullable=season_year, season_type_nullable=SEASON_TYPE, league_id_nullable=NBA_LEAGUE_ID).data_sets[0].data
    team_scores_by_game_id = _get_team_scores_by_game_id(season_games)

    all_teams = []
    for raw_team_data in all_teams_raw:
        time.sleep(0.6)  # slowdown for API calls

        # Team basic info
        team_id = raw_team_data['id']
        team_name = raw_team_data['full_name']
        team_slug = raw_team_data['abbreviation']
        primary_colour, secondary_colour = supplementary_team_data.get_colours_for_team(team_name)

        # Team standings info
        conference, division, last_ten, current_streak = _get_standings_info_for_team(league_standings, team_id)

        # Team game logs
        print(f'Getting data for {team_name}...')
        games = _get_game_logs_for_team(team_id, season_year, team_scores_by_game_id)
        
        all_teams.append(Team(team_name,
                              team_slug,
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


def _load_cached_season_data(cached_season_data_path):
    with open(cached_season_data_path, 'rb') as file:
        data = pickle.load(file)
        return data   


def _cache_season_data(season_data, cache_file_path):
    with open(cache_file_path, 'wb') as file:
        pickle.dump(season_data, file)


def _get_team_games_data(season_year: str):
    cached_season_data_path = _get_cached_season_data_file_path(season_year)
    if os.path.exists(cached_season_data_path):
        # Cached data exists, load it
        season_data = _load_cached_season_data(cached_season_data_path)
    else:
        # No cached data exists for the season, request it and cache it
        season_data = _get_teams_data(season_year)
        _cache_season_data(season_data, cached_season_data_path)
    
    # Return JSON-ifiable representations of team data
    jsonified_teams_data = [team.as_dict() for team in season_data]
    return jsonified_teams_data


def get_standings_graph_team_data(season_year: str):
    """ Entry point for the server to request the (JSON) team data for a given season. """
    team_data = _get_team_games_data(season_year)
    return json.dumps(team_data)
