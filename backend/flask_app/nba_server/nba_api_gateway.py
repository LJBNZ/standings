from collections import defaultdict, OrderedDict
from dataclasses import dataclass
import datetime
import functools
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

API_DATE_STRING_FMT = "%Y-%m-%dT%H:%M:%S"

EASTERN_CONFERENCE = 'east'
WESTERN_CONFERENCE = 'west'
NUM_PLAYOFF_TEAMS = 6
NUM_PLAYOFF_AND_PLAYIN_TEAMS = 8


def _get_cached_season_data_file_path(season_year: str):
    path = os.path.abspath(os.path.join(os.path.dirname(__file__), 'season_data_caches', season_year))
    print(path)
    return path


@dataclass
class Record:
    wins: int = 0
    losses: int = 0

    def as_pct(self) -> float:
        if self.wins == 0 and self.losses == 0:
            return 0.500
        else:
            return self.wins / (self.wins + self.losses)
    
    def increment_by(self, i: int):
        if i >= 0:
            self.wins += abs(i)
        else:
            self.losses += abs(i)
    
    def __add__(self, other):
        assert isinstance(other, Record)
        self.wins += other.wins
        self.losses += other.losses
        return self
    
    def __sub__(self, other):
        assert isinstance(other, Record)
        self.wins -= other.wins
        self.losses -= other.losses
        return self

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
    opponent: 'Team'

    def as_dict(self):
        d = self.__dict__.copy()
        del d['opponent']
        return d


@functools.total_ordering
class Team:
    def __init__(self, 
                 id: int,
                 name: str,
                 slug: str,
                 primary_colour: str,
                 secondary_colour: str,
                 conference: str,
                 division: str,
                 last_10: str,
                 current_streak: int):
        self.id = id
        self.name = name
        self.slug = slug
        self.primary_colour = primary_colour
        self.secondary_colour = secondary_colour
        self.conference = conference
        self.division = division
        self.last_10 = last_10
        self.current_streak = current_streak
        self.league_rank = None
        self.league_rank_by_date = OrderedDict()
        self.conference_seed_by_date = OrderedDict()

        self._overall_record = Record()
        self._record_by_team = defaultdict(Record)
        self._conference_record = Record()
        self._division_record = Record()
        self._point_differential = 0

    def as_dict(self):
        attrs = self.__dict__
        attrs['games'] = [game.as_dict() for game in self.games]
        for key in list(attrs.keys()):
            if key.startswith('_'):
                del attrs[key]
        return attrs
    
    def get_game_on_date(self, date):
        for game in self.games:
            game_date = date_string_to_datetime(game.date)
            if game_date == date:
                return game
            elif game_date > date:
                # Stop looking
                break
    
    def update_record_after_game(self, game: Game):
        game_value = 1 if game.outcome == 'W' else -1
        self._overall_record.increment_by(game_value)
        self._record_by_team[game.opponent].increment_by(game_value)
        if game.opponent.conference == self.conference:
            self._conference_record.increment_by(game_value)
        if game.opponent.division == self.division:
            self._division_record.increment_by(game_value)
        self._point_differential += (game.team_score - game.opponent_score)

    def get_win_pct_vs_team(self, team: 'Team'):
        return self._record_by_team[team].as_pct()
    
    def get_record_vs_team(self, team: 'Team'):
        return self._record_by_team[team]
    
    @property
    def overall_win_pct(self):
        return self._overall_record.as_pct()

    @property
    def conference_win_pct(self):
        return self._conference_record.as_pct()

    @property
    def division_win_pct(self):
        return self._division_record.as_pct()
    
    @property
    def point_differential(self):
        return self._point_differential

    def __hash__(self) -> int:
        return hash(self.name)

    def __lt__(self, other: object) -> bool:
        assert isinstance(other, type(self))
        return self.overall_win_pct < other.overall_win_pct
    
    def __repr__(self) -> str:
        return f"{self.name}: {self._overall_record.wins} - {self._overall_record.losses} ({self.overall_win_pct}%)"


def date_string_to_datetime(date_string):
    """Takes a date string returned by the NBA API and converts it to a datetime object."""
    return datetime.datetime.strptime(date_string, API_DATE_STRING_FMT)


def rank_teams(teams: List[Team]) -> List[Team]:
    """Ranks the given teams based on their records, and NBA tie-breaker criteria if needed."""
    # Initial sort pass based on team overall winning percentage
    initial_ordering = sorted(teams, reverse=True)

    # Find groups of teams with equal winning percentage and add them to nested lists
    ordering_with_tied_groups = []
    start_idx = 0
    while start_idx < len(initial_ordering):
        is_equal = True
        end_idx = start_idx
        while is_equal:
            # Advance pointer forward to find extent of contiguous tied group of teams
            end_idx += 1
            is_equal = end_idx < len(initial_ordering) and initial_ordering[start_idx].overall_win_pct == initial_ordering[end_idx].overall_win_pct
            if not is_equal:
                if end_idx - start_idx > 1:
                    # End of group found, add the tied teams as a nested list and resume search from the end pointer
                    ordering_with_tied_groups.append(initial_ordering[start_idx:end_idx])
                    start_idx = end_idx
                else:
                    # No tied teams ahead, add the team and advance start pointer
                    ordering_with_tied_groups.append(initial_ordering[start_idx])
                    start_idx += 1        

    if len(ordering_with_tied_groups) == len(teams):
        # Happy path: teams have all been discretely ordered simply based on winning percentage without any ties
        return initial_ordering
    
    # Get teams in each division ordered by win percentage
    teams_by_division = defaultdict(list)
    for team in teams:
        division_teams = teams_by_division[team.division]
        division_teams.append(team)
        division_teams.sort(key=lambda t: t.overall_win_pct, reverse=True)
    
    def _team_is_division_leader(team_):
        # Returns True if a team leads or ties a division else False
        return team_.division_win_pct == max([t.division_win_pct for t in teams_by_division[team_.division]])
    
    def _get_playoff_teams_in_conference(conference: str):
        # Returns the 6 (or more if ties exist) teams eligible for the playoffs (not including play-in teams)
        playoff_teams = []
        for team_or_tie_group in ordering_with_tied_groups:
            if len(playoff_teams) >= 6:
                break
            if isinstance(team_or_tie_group, list):
                # Tie group
                playoff_teams.extend([t for t in team_or_tie_group if t.conference == conference])
            else:
                # Single team
                playoff_teams.append(team_or_tie_group)
        return playoff_teams

    playoff_teams_by_conference = {EASTERN_CONFERENCE: _get_playoff_teams_in_conference(EASTERN_CONFERENCE),
                                   WESTERN_CONFERENCE: _get_playoff_teams_in_conference(WESTERN_CONFERENCE)}

    def _get_team_win_pct_vs_playoff_teams(team, vs_own_conference=True):
        """Calculates the total record of a team against playoff teams in their own or other conference, returned as a percentage."""
        other_conference = WESTERN_CONFERENCE if team.conference == EASTERN_CONFERENCE else EASTERN_CONFERENCE
        playoff_teams = playoff_teams_by_conference[team.conference] if vs_own_conference else playoff_teams_by_conference[other_conference]
        if team in playoff_teams:
            playoff_teams.remove(team)   # Ensure the team is not included in the list of playoff-eligible opponents
        cumulative_record = Record()
        for playoff_team in playoff_teams:
            try:
                cumulative_record += team.get_record_vs_team(playoff_team)
            except:
                raise
        return cumulative_record.as_pct()

    # Now apply tie-breaker criteria to each tied group
    for tie_group in [t for t in ordering_with_tied_groups if isinstance(t, list)]:
        if len(tie_group) == 2:
            # Apply two-way tie-breaker criteria 
            team_a, team_b = tie_group
            head_to_head_win_pct = {team_a: team_a.get_win_pct_vs_team(team_b), 
                                    team_b: team_b.get_win_pct_vs_team(team_a)}

            win_pct_vs_own_conference_playoff_teams_by_team = {team_a: _get_team_win_pct_vs_playoff_teams(team_a, vs_own_conference=True),
                                                               team_b: _get_team_win_pct_vs_playoff_teams(team_b, vs_own_conference=True)}

            win_pct_vs_other_conference_playoff_teams_by_team = {team_a: _get_team_win_pct_vs_playoff_teams(team_a, vs_own_conference=False),
                                                                 team_b: _get_team_win_pct_vs_playoff_teams(team_b, vs_own_conference=False)}

            if head_to_head_win_pct[team_a] != head_to_head_win_pct[team_b]:
                # Criterion 1: "Better winning percentage in games against each other"
                tie_group.sort(key=lambda t: head_to_head_win_pct[t], reverse=True)
            elif _team_is_division_leader(team_a) != _team_is_division_leader(team_b):
                # Criterion 2: "Division leader wins a tie over a team not leading a division"
                tie_group.sort(key=_team_is_division_leader, reverse=True)
            elif team_a.division == team_b.division and team_a.division_win_pct != team_b.division_win_pct:
                # Criterion 3: "Division won-lost percentage (only if teams are in same division)"
                tie_group.sort(key=lambda t: t.division_win_pct, reverse=True)
            elif team_a.conference_win_pct != team_b.conference_win_pct:
                # Criterion 4: "Conference won-lost percentage"
                tie_group.sort(key=lambda t: t.conference_win_pct, reverse=True)
            elif win_pct_vs_own_conference_playoff_teams_by_team[team_a] != win_pct_vs_own_conference_playoff_teams_by_team[team_b]:
                # Criterion 5: "Won-lost percentage against teams eligible for the playoffs in own conference"
                tie_group.sort(key=lambda t: win_pct_vs_own_conference_playoff_teams_by_team[t], reverse=True)
            elif win_pct_vs_other_conference_playoff_teams_by_team[team_a] != win_pct_vs_other_conference_playoff_teams_by_team[team_b]:
                # Criterion 6: "Won-lost percentage against teams eligible for the playoffs in other conference"
                tie_group.sort(key=lambda t: win_pct_vs_other_conference_playoff_teams_by_team[t], reverse=True)
            elif team_a.point_differential != team_b.point_differential:
                # Criterion 7: "Better point differential"
                tie_group.sort(key=lambda t: t.point_differential, reverse=True)
        else:
            # Apply 3+ way tie-breaker criteria
            pass
    
    # Flatten the ranked teams list now that the tie groups have been ordered
    ranked_teams = []
    for team_or_tie_group in ordering_with_tied_groups:
        if isinstance(team_or_tie_group, list):
            # Tie group
            ranked_teams.extend(team_or_tie_group)
        else:
            # Single team
            ranked_teams.append(team_or_tie_group)

    return ranked_teams

def _get_parsed_game_logs(game_logs: Dict, team_id: int, team_scores_by_game_id: Dict, teams_by_slug: Dict) -> List[Game]:
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
            

def _get_game_logs_for_team(team_id: int, season_year: str, team_scores_by_game_id: Dict, teams_by_slug: Dict) -> List[Game]:
    game_logs_data = TeamGameLogs(season_nullable=season_year, season_type_nullable=SEASON_TYPE, team_id_nullable=team_id)
    game_logs = _get_parsed_game_logs(game_logs_data.team_game_logs.data, team_id, team_scores_by_game_id, teams_by_slug)
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



def _calculate_team_ranks_over_time(teams: List[Team]):

    first_game_datetime = date_string_to_datetime(min([team.games[0].date for team in teams]))
    last_game_datetime = date_string_to_datetime(max([team.games[-1].date for team in teams]))

    current_datetime = first_game_datetime

    while current_datetime <= last_game_datetime:

        # Update team records for games played on this date
        for team in teams:
            game_on_current_date = team.get_game_on_date(current_datetime)
            if game_on_current_date is not None:
                # Update team records according to game result
                team.update_record_after_game(game_on_current_date)

        # Rank the teams by record and tie-breaker criteria
        ranked_teams = rank_teams(teams)

        # Get the API-compliant string format of the current date
        current_date_string = current_datetime.strftime(API_DATE_STRING_FMT)

        # Determine each team's conference seed and league-wide rank on the current date
        for team in teams:
            league_rank = ranked_teams.index(team) + 1
            conference_seed = [t for t in ranked_teams if t.conference == team.conference].index(team) + 1
            team.conference_seed_by_date[current_date_string] = conference_seed
            team.league_rank_by_date[current_date_string] = league_rank
            team.league_rank = league_rank

        current_datetime += datetime.timedelta(days=1)


def _get_teams_data(season_year: str) -> List[Team]:
    all_teams_raw_path = _get_cached_season_data_file_path(season_year) + "_raw"
    if not os.path.exists(all_teams_raw_path):
        league_standings = LeagueStandingsV3(season=season_year, season_type=SEASON_TYPE)
        all_teams_raw = teams.get_teams()

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

            all_teams.append(Team(id=team_id,
                                  name=team_name,
                                  slug=team_slug,
                                  primary_colour=primary_colour,
                                  secondary_colour=secondary_colour,
                                  conference=conference.lower(),
                                  division=division,
                                  last_10=last_ten,
                                  current_streak=current_streak))

        season_games = LeagueGameFinder(season_nullable=season_year, season_type_nullable=SEASON_TYPE, league_id_nullable=NBA_LEAGUE_ID).data_sets[0].data
        team_scores_by_game_id = _get_team_scores_by_game_id(season_games)
        teams_by_slug = {team.slug: team for team in all_teams}

        for team in all_teams:
            time.sleep(0.6)  # slowdown for API calls
            print(f'Getting data for {team.name}...')
            team.games = _get_game_logs_for_team(team.id, season_year, team_scores_by_game_id, teams_by_slug)
    
        _cache_season_data(all_teams, all_teams_raw_path)

    else:
        # Cached data exists, load it
        all_teams = _load_cached_season_data(all_teams_raw_path)
 
    _calculate_team_ranks_over_time(all_teams)

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
