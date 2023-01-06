from collections import defaultdict, OrderedDict
from dataclasses import dataclass
import datetime
import functools
import time
from typing import  Any, Callable, Dict, List, Optional, Tuple, Union
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
    """A counter class which records the outcomes of games played."""
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
    """Represents a single NBA game."""
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

    def to_json(self):
        d = self.__dict__.copy()
        del d['opponent']
        return d


@functools.total_ordering
class Team:
    """Represents an NBA team, with ability to track its record over the course of a season."""
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

    def to_json(self):
        attrs = self.__dict__
        attrs['games'] = [game.to_json() for game in self.games]
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


def break_two_way_tie(tied_teams: List[Team], 
                      own_conf_win_pct_vs_playoff_teams: Dict[Team, float],
                      other_conf_win_pct_vs_playoff_teams: Dict[Team, float],
                      division_leaders: Optional[Dict[str, Team]] = None) -> List[Team]:
    """Apply two-way tie-breaker criteria to a list of tied teams."""
    team_a, team_b = tied_teams
    head_to_head_win_pct = {team_a: team_a.get_win_pct_vs_team(team_b), 
                            team_b: team_b.get_win_pct_vs_team(team_a)}
    
    def _team_is_division_leader(team):
        return division_leaders[team.division] is team

    # Assess tie-breaker criteria
    if head_to_head_win_pct[team_a] != head_to_head_win_pct[team_b]:
        # Criterion 1: "Better winning percentage in games against each other"
        tied_teams.sort(key=lambda t: head_to_head_win_pct[t], reverse=True)
    elif division_leaders is not None and _team_is_division_leader(team_a) != _team_is_division_leader(team_b):
        # Criterion 2: "Division leader wins a tie over a team not leading a division"
        tied_teams.sort(key=_team_is_division_leader, reverse=True)
    elif team_a.division == team_b.division and team_a.division_win_pct != team_b.division_win_pct:
        # Criterion 3: "Division won-lost percentage (only if teams are in same division)"
        tied_teams.sort(key=lambda t: t.division_win_pct, reverse=True)
    elif team_a.conference_win_pct != team_b.conference_win_pct:
        # Criterion 4: "Conference won-lost percentage"
        tied_teams.sort(key=lambda t: t.conference_win_pct, reverse=True)
    elif own_conf_win_pct_vs_playoff_teams[team_a] != own_conf_win_pct_vs_playoff_teams[team_b]:
        # Criterion 5: "Won-lost percentage against teams eligible for the playoffs in own conference"
        tied_teams.sort(key=lambda t: own_conf_win_pct_vs_playoff_teams[t], reverse=True)
    elif other_conf_win_pct_vs_playoff_teams[team_a] != other_conf_win_pct_vs_playoff_teams[team_b]:
        # Criterion 6: "Won-lost percentage against teams eligible for the playoffs in other conference"
        tied_teams.sort(key=lambda t: other_conf_win_pct_vs_playoff_teams[t], reverse=True)
    elif team_a.point_differential != team_b.point_differential:
        # Criterion 7: "Better net result of total points scored less total points allowed against all opponents"
        tied_teams.sort(key=lambda t: t.point_differential, reverse=True)

    return tied_teams


def break_multi_way_tie(tied_teams: List[Team], 
                        own_conf_win_pct_vs_playoff_teams: Dict[Team, float],
                        other_conf_win_pct_vs_playoff_teams: Dict[Team, float],
                        division_leaders: Optional[Dict[str, Team]] = None) -> List[Team]:
    """Apply multi-way tie-breaker criteria to a list of tied teams via recursion and return the result."""

    if len(tied_teams) == 2:
        # Base case: only two tied teams given so use the two-way sort criteria instead
        return break_two_way_tie(tied_teams, 
                                 own_conf_win_pct_vs_playoff_teams,
                                 other_conf_win_pct_vs_playoff_teams,
                                 division_leaders)

    # Determine each team's win percentage in games against other teams in the tie group
    win_pct_vs_other_tied_teams_by_team = {}
    for team in tied_teams:
        record_vs_tied_teams = Record()
        for other_team in tied_teams:
            if other_team is team:
                continue
            record_vs_other_team = team.get_record_vs_team(other_team)
            record_vs_tied_teams += record_vs_other_team
        win_pct_vs_other_tied_teams_by_team[team] = record_vs_tied_teams.as_pct()    

    def team_is_division_leader(team):
        return division_leaders[team.division] is team
    
    def all_equal(tie_group, sort_key):
        return len(set(sort_key(team) for team in tie_group)) == 1
    
    def recurse_for_sub_groups(teams):
        # Recurse to settle any remaining ties
        for i in range(len(teams)):
            team_or_tie_group = teams[i]
            if isinstance(team_or_tie_group, list):
                ordered_tie_group = break_multi_way_tie(team_or_tie_group, 
                                                        own_conf_win_pct_vs_playoff_teams, 
                                                        other_conf_win_pct_vs_playoff_teams, 
                                                        division_leaders)
                teams[i] = ordered_tie_group
        return teams

    # Assess tie-breaker criteria
    if division_leaders is not None and not all_equal(tied_teams, sort_key=team_is_division_leader):
        # Criterion 1: "Division leader wins tie from team not leading a division"
        ordered_groups = _sort_and_group_tied_teams(tied_teams, sort_key=team_is_division_leader)
        tied_teams = recurse_for_sub_groups(ordered_groups)
    elif not all_equal(tied_teams, sort_key=lambda t: win_pct_vs_other_tied_teams_by_team[t]):
        # Criterion 2: "Better winning percentage in all games among the tied teams"
        ordered_groups = _sort_and_group_tied_teams(tied_teams, sort_key=lambda t: win_pct_vs_other_tied_teams_by_team[t])
        tied_teams = recurse_for_sub_groups(ordered_groups)
    elif all_equal(tied_teams, sort_key=lambda t: t.division) and not all_equal(tied_teams, sort_key=lambda t: t.division_win_pct):
        # Criterion 3: "Division won-lost percentage (only if all teams are in same division)"
        ordered_groups = _sort_and_group_tied_teams(tied_teams, sort_key=lambda t: t.division_win_pct)
        tied_teams = recurse_for_sub_groups(ordered_groups)
    elif not all_equal(tied_teams, sort_key=lambda t: t.conference_win_pct):
        # Criterion 4: "Conference won-lost percentage"
        ordered_groups = _sort_and_group_tied_teams(tied_teams, sort_key=lambda t: t.conference_win_pct)
        tied_teams = recurse_for_sub_groups(ordered_groups)
    elif not all_equal(tied_teams, sort_key=lambda t: own_conf_win_pct_vs_playoff_teams[t]):
        # Criterion 5: "Won-lost percentage against teams eligible for the playoffs in own conference"
        ordered_groups = _sort_and_group_tied_teams(tied_teams, sort_key=lambda t: own_conf_win_pct_vs_playoff_teams[t])
        tied_teams = recurse_for_sub_groups(ordered_groups)
    elif not all_equal(tied_teams, sort_key=lambda t: t.point_differential):
        ordered_groups = _sort_and_group_tied_teams(tied_teams, sort_key=lambda t: t.point_differential)
        tied_teams = recurse_for_sub_groups(ordered_groups)

    return tied_teams


def _flatten_teams(grouped_teams: List[Union[Team, List[Team]]]) -> List[Team]:
    """Given a list of teams containing nested tied subgroups of any level, returns flat representation."""
    flat_teams = []
    for team_or_tie_group in grouped_teams:
        if isinstance(team_or_tie_group, list):
            # Group of tied teams, recursively flatten in the case there are further subgroups
            flattened_group = _flatten_teams(team_or_tie_group)
            flat_teams.extend(flattened_group)
        else:
            # Single team
            flat_teams.append(team_or_tie_group)
    return flat_teams


def break_ties(tied_teams: List[Team], all_teams: List[Union[Team, List[Team]]], division_leaders: Optional[Dict[str, Team]] = None):
    """Break the ties between the given list of teams by ordering them in place using the two- and multi-way criteria."""
    # Pre-compute each team's win percentage vs playoff-eligible teams to save time
    own_conf_win_pct_vs_playoff_teams = {}
    other_conf_win_pct_vs_playoff_teams = {}
    for t in tied_teams:
        own_conf_win_pct_vs_playoff_teams[t] = _get_team_win_pct_vs_playoff_teams(t, all_teams, vs_own_conference=True)
        other_conf_win_pct_vs_playoff_teams[t] = _get_team_win_pct_vs_playoff_teams(t, all_teams, vs_own_conference=False)

    if len(tied_teams) == 2:
        # Apply two-way tie-breakers criteria
        ordered_groups = break_two_way_tie(tied_teams, own_conf_win_pct_vs_playoff_teams, other_conf_win_pct_vs_playoff_teams, division_leaders=division_leaders)
    else:
        # Apply multi-way tie-breaker criteria
        ordered_groups = break_multi_way_tie(tied_teams, own_conf_win_pct_vs_playoff_teams, other_conf_win_pct_vs_playoff_teams, division_leaders=division_leaders)

    return _flatten_teams(ordered_groups)


def _determine_division_leaders(all_teams: List[Team]) -> Dict[str, Team]:
    """Determines the leading team in each division by sorting and applying tie-breaker criteria."""
    # Get teams in each division ordered by win percentage
    teams_by_division = defaultdict(list)
    for team in all_teams:
        division_teams = teams_by_division[team.division]
        division_teams.append(team)

    # Get the leader for each division, apply tie-breaker criteria if necessary
    division_leaders = {}
    for division, division_teams in teams_by_division.items():
        ordered_division_teams = _sort_and_group_tied_teams(division_teams, sort_key=lambda t: t.overall_win_pct)
        leader_or_tie_group = ordered_division_teams[0]
        if isinstance(leader_or_tie_group, list):
            # Multiple teams tied for division leader
            break_ties(leader_or_tie_group, all_teams)
            leader = leader_or_tie_group[0]
        else:
            leader = leader_or_tie_group
        division_leaders[division] = leader

    return division_leaders


def _sort_and_group_tied_teams(all_teams: List[Team], sort_key: Callable) -> List[Union[Team, List[Team]]]:
    """Sorts teams by the return value of the provided sort key function and groups tied teams in nested lists."""
    # Sort on sort key
    initial_ordering = sorted(all_teams, key=sort_key, reverse=True)

    # Find and create tied subgroups of teams
    ordering_with_tied_groups = []
    start_idx = 0
    while start_idx < len(initial_ordering):
        is_equal = True
        end_idx = start_idx
        while is_equal:
            # Advance pointer forward to find extent of contiguous tied group of teams
            end_idx += 1
            is_equal = end_idx < len(initial_ordering) and sort_key(initial_ordering[start_idx]) == sort_key(initial_ordering[end_idx])
            if not is_equal:
                if end_idx - start_idx > 1:
                    # End of group found, add the tied teams as a nested list and resume search from the end pointer
                    ordering_with_tied_groups.append(initial_ordering[start_idx:end_idx])
                    start_idx = end_idx
                else:
                    # No tied teams ahead, add the team and advance start pointer
                    ordering_with_tied_groups.append(initial_ordering[start_idx])
                    start_idx += 1
    
    return ordering_with_tied_groups


def _get_team_win_pct_vs_playoff_teams(team, all_ordered_teams, vs_own_conference=True):
    """Calculates the total record of a team against playoff teams in their own or other conference, returned as a percentage."""

    def get_playoff_teams_in_conference(conference: str):
        # Returns the 6 (or more if ties exist) teams eligible for the playoffs (not including play-in teams)
        playoff_teams = []
        for team_or_tie_group in all_ordered_teams:
            if len(playoff_teams) >= NUM_PLAYOFF_TEAMS:
                break
            if isinstance(team_or_tie_group, list):
                # Tie group
                playoff_teams.extend([t for t in team_or_tie_group if t.conference == conference])
            else:
                # Single team
                playoff_teams.append(team_or_tie_group)
        return playoff_teams

    # Get the playoff-eligible teams in the desired conference
    playoff_teams_by_conference = {EASTERN_CONFERENCE: get_playoff_teams_in_conference(EASTERN_CONFERENCE),
                                    WESTERN_CONFERENCE: get_playoff_teams_in_conference(WESTERN_CONFERENCE)}
    other_conference = WESTERN_CONFERENCE if team.conference == EASTERN_CONFERENCE else EASTERN_CONFERENCE
    playoff_teams = playoff_teams_by_conference[team.conference] if vs_own_conference else playoff_teams_by_conference[other_conference]
    if team in playoff_teams:
        playoff_teams.remove(team)   # Ensure the team is not included in the list of playoff-eligible opponents
    
    # Sum the total record for all games against those playoff teams
    cumulative_record = Record()
    for playoff_team in playoff_teams:
        cumulative_record += team.get_record_vs_team(playoff_team)
    return cumulative_record.as_pct()


def rank_teams(teams: List[Team]) -> List[Team]:
    """Ranks the given teams based on their records, and NBA tie-breaker criteria if needed."""
    # Initial sort pass based on team overall winning percentage, containing sublists of tied teams
    ordering_with_tied_groups = _sort_and_group_tied_teams(teams, sort_key=lambda t: t.overall_win_pct)

    if len(ordering_with_tied_groups) == len(teams):
        # Happy path: teams have all been discretely ordered simply based on winning percentage without any ties
        return ordering_with_tied_groups    

    # Get the division leaders, which is a prerequisite for fully determining tie-breaker criteria
    leaders_by_division = _determine_division_leaders(teams)
    
    # Now apply tie-breaker criteria to each tied group
    ranked_teams = []
    for team_or_tie_group in ordering_with_tied_groups:
        if isinstance(team_or_tie_group, list):
            # Tie group: break ties and add back to list
            ordered_teams = break_ties(team_or_tie_group, ordering_with_tied_groups, leaders_by_division)
            ranked_teams.extend(ordered_teams)
        else:
            # Single team: just add to list
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
    """Determines the total ordering of teams across each day of the season."""

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

        # Advance date by one day for next iteration
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
    return json.dumps([team.to_json() for team in season_data])


def get_standings_graph_team_data(season_year: str):
    """ Entry point for the server to request the (JSON) team data for a given season. """
    return _get_team_games_data(season_year)
