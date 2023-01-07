from collections import defaultdict
import datetime
import time
from typing import Dict, List, Optional, Tuple
import json
import os
import pickle

from nba_api.stats.endpoints.leaguestandingsv3 import LeagueStandingsV3
from nba_api.stats.endpoints.leaguegamefinder import LeagueGameFinder
from nba_api.stats.endpoints.teamgamelogs import TeamGameLogs
from nba_api.stats.static import teams

from . import team_data
from . import team_rankings
from .team_data import Team, Game


# API constant arguments
NBA_LEAGUE_ID = '00'
SEASON_TYPE = 'Regular Season'
BACKOFF_TIME_SEC = 0.6


def _get_cached_season_standings_data_file_path(season_year: str):
    """Returns the path to the cached data for the given year."""
    return os.path.abspath(os.path.join(os.path.dirname(__file__), 'season_data_caches', season_year))


def _get_current_season_string() -> str:
    """Returns the NBA season string based on the current date."""
    current_datetime = datetime.datetime.now()
    if current_datetime.month < 10:
        # Before tip-off month of October, current season string is <last year long>-<this year short>
        long_year = str(int(current_datetime.strftime('%Y')) - 1)
        short_year = current_datetime.strftime('%y')
    else:
        # After tip-off month, current season string is <this year long>-<next year short>
        long_year = current_datetime.strftime('%Y')
        short_year = str(int(current_datetime.strftime('%y')) + 1)
    return f"{long_year}-{short_year}"


def _get_game_logs_for_team(team_id: int, season_year: str, team_scores_by_game_id: Dict, teams_by_slug: Dict) -> List[Game]:
    """Fetches and parses the game logs for the given team, returns the list of Games."""
    game_logs_raw = TeamGameLogs(season_nullable=season_year, season_type_nullable=SEASON_TYPE, team_id_nullable=team_id)
    game_logs = game_logs_raw.team_game_logs.data
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
        _, opponent_slug = matchup.split()
        opponent = teams_by_slug[opponent_slug]
        if outcome == 'W':
            n_wins += 1
        else:
            n_losses += 1
        games.append(Game(game_id, game_num, game_date, matchup, team_score, opponent_score, outcome, n_wins, n_losses, opponent))

    return games


def _get_team_conference_and_division(league_standings_response, team_id: int) -> Tuple[str, str]:
    """Gets the conference and division for the given team from the league standings data."""
    league_standings_headers = league_standings_response.standings.data['headers']
    league_standings_data = league_standings_response.standings.data['data']
    headers_to_data_indices = {header: idx for idx, header in enumerate(league_standings_headers)}
    for team_standings_data in league_standings_data:
        if team_standings_data[headers_to_data_indices['TeamID']] == team_id:
            desired_team_standings_data = team_standings_data
            break
    else:
        raise RuntimeError(f"Cannot find data for team ID {team_id}")

    conference = desired_team_standings_data[headers_to_data_indices['Conference']].lower()
    division = desired_team_standings_data[headers_to_data_indices['Division']].lower()
    
    return conference, division


def _get_team_scores_by_game_id(all_games):
    """Creates a map of scores for each game by team ID."""
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
    """Fetches and parses the team data from the API for the given season"""
    league_standings = LeagueStandingsV3(season=season_year, season_type=SEASON_TYPE)
    all_teams_raw = teams.get_teams()

    all_teams = []
    for raw_team_data in all_teams_raw:
        time.sleep(BACKOFF_TIME_SEC)  # slowdown for API calls

        # Team basic info
        team_id = raw_team_data['id']
        team_name = raw_team_data['full_name']
        team_slug = raw_team_data['abbreviation']
        primary_colour, secondary_colour = team_data.get_colours_for_team(team_name)
        conference, division = _get_team_conference_and_division(league_standings, team_id)

        all_teams.append(Team(team_id, team_name, team_slug, primary_colour, secondary_colour, conference, division))

    return all_teams


def _populate_team_games(teams: List[Team], season_year: str) -> None:
    """Populates the team's list of played games."""
    season_games = LeagueGameFinder(season_nullable=season_year, 
                                    season_type_nullable=SEASON_TYPE, 
                                    league_id_nullable=NBA_LEAGUE_ID).data_sets[0].data
    team_scores_by_game_id = _get_team_scores_by_game_id(season_games)
    teams_by_slug = {team.slug: team for team in teams}

    for team in teams:
        time.sleep(BACKOFF_TIME_SEC)  # slowdown for API calls
        print(f'Getting data for {team.name}...')
        team.games = _get_game_logs_for_team(team.id, season_year, team_scores_by_game_id, teams_by_slug)


def _get_season_standings_data(season_year: str) -> List[Team]:
    """Gets each team's games and ranking data from the API for the given season."""
    # Parse the teams from the API
    all_teams = _get_teams_data(season_year)
    
    # Get games played data for teams from the API
    _populate_team_games(all_teams, season_year)
    
    # Populate team ranking data
    is_play_in_format = int(season_year.split('-')[0]) >= 2020
    team_rankings.calculate_team_ranks_over_time(all_teams, play_in_format=is_play_in_format)

    return all_teams


def _load_cached_season_standings_data(cached_season_data_path):
    """Deserializes and returns cached season data at the given path."""
    with open(cached_season_data_path, 'rb') as file:
        data = pickle.load(file)
        return data   


def _cache_season_standings_data(season_data, cache_file_path):
    """Caches serialized season data for later re-use."""
    with open(cache_file_path, 'wb') as file:
        pickle.dump(season_data, file)


def get_standings_data(season_year: Optional[str]) -> str:
    """Entry point for the server to request the team standings data for a given season. 
    Returns a JSON-format string response."""
    if season_year is None:
        season_year = _get_current_season_string()

    cached_season_data_path = _get_cached_season_standings_data_file_path(season_year)
    if os.path.exists(cached_season_data_path):
        # Cached data exists, load it
        team_standings_data = _load_cached_season_standings_data(cached_season_data_path)
    else:
        # No cached data exists for the season, request it and cache it
        team_standings_data = _get_season_standings_data(season_year)
        _cache_season_standings_data(team_standings_data, cached_season_data_path)
    
    # Return JSON-ifiable representations of team data
    return json.dumps([team.to_json() for team in team_standings_data])
