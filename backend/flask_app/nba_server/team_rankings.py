from collections import defaultdict
import datetime
import enum
import functools
from typing import Callable, Dict, List, Optional, Union

from . import util
from .team_data import Team, Game


EASTERN_CONFERENCE = 'east'
WESTERN_CONFERENCE = 'west'
MODERN_NUM_PLAYOFF_TEAMS = 6
LEGACY_NUM_PLAYOFF_TEAMS = 8
NUM_PLAYOFF_AND_PLAYIN_TEAMS = 10


class PlayoffFormat(enum.Enum):
    LEGACY = 0  # 8 playoff teams, no play-in tournament
    MODERN = 1  # 6 playoff teams, additional 4 play-in teams


class Record:
    """A counter class which records the outcomes of games played."""
    def __init__(self):
        self.wins = 0
        self.losses = 0

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


@functools.total_ordering
class TeamWithRecord:
    """Augments a Team object to track its various records determining team rank over time."""
    def __init__(self, team: Team):
        self._team = team

        self._overall_record = Record()
        self._record_by_team = defaultdict(Record)
        self._conference_record = Record()
        self._division_record = Record()
        self._point_differential = 0

    def get_game_on_date(self, date):
        """Returns the game the team played on the given date if it exists."""
        for game in self._team.games:
            game_date = util.api_date_string_to_datetime(game.date)
            if game_date == date:
                return game
            elif game_date > date:
                # Stop looking
                break
    
    def update_record_after_game(self, game: Game):
        """Updates team records based on game outcome."""
        game_value = 1 if game.outcome == 'W' else -1
        self._overall_record.increment_by(game_value)
        self._record_by_team[game.opponent].increment_by(game_value)
        if game.opponent.conference == self._team.conference:
            self._conference_record.increment_by(game_value)
        if game.opponent.division == self._team.division:
            self._division_record.increment_by(game_value)
        self._point_differential += (game.team_score - game.opponent_score)
    
    def set_ranks_for_date(self, ranked_teams: List['TeamWithRecord'], date_string: str):
        league_rank = ranked_teams.index(self) + 1
        conference_seed = [t for t in ranked_teams if t.conference == self._team.conference].index(self) + 1
        self._team.conference_seed_by_date[date_string] = conference_seed
        self._team.league_rank_by_date[date_string] = league_rank
        self._team.conference_seed = conference_seed
        self._team.league_rank = league_rank

    def get_win_pct_vs_team(self, team: 'TeamWithRecord'):
        return self._record_by_team[team].as_pct()
    
    def get_record_vs_team(self, team: 'TeamWithRecord'):
        return self._record_by_team[team]
    
    @property
    def games(self):
        return self._team.games
        
    @property
    def division(self):
        return self._team.division
        
    @property
    def conference(self):
        return self._team.conference
    
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
        return hash(self._team)

    def __lt__(self, other: object) -> bool:
        assert isinstance(other, type(self))
        return self.overall_win_pct < other.overall_win_pct
    
    def __repr__(self) -> str:
        return f"{self._team.name}: {self._overall_record.wins} - {self._overall_record.losses} ({self.overall_win_pct}%)"


def break_two_way_tie(tied_teams: List[TeamWithRecord], 
                      own_conf_win_pct_vs_playoff_teams: Dict[TeamWithRecord, float],
                      other_conf_win_pct_vs_playoff_teams: Dict[TeamWithRecord, float],
                      division_leaders: Optional[Dict[str, TeamWithRecord]] = None) -> List[TeamWithRecord]:
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


def break_multi_way_tie(tied_teams: List[TeamWithRecord], 
                        own_conf_win_pct_vs_playoff_teams: Dict[TeamWithRecord, float],
                        other_conf_win_pct_vs_playoff_teams: Dict[TeamWithRecord, float],
                        division_leaders: Optional[Dict[str, TeamWithRecord]] = None) -> List[TeamWithRecord]:
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


def _flatten_teams(grouped_teams: List[Union[TeamWithRecord, List[TeamWithRecord]]]) -> List[TeamWithRecord]:
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


def break_ties(tied_teams: List[TeamWithRecord], 
               all_teams: List[Union[TeamWithRecord, List[TeamWithRecord]]], 
               playoff_format: PlayoffFormat, 
               division_leaders: Optional[Dict[str, TeamWithRecord]] = None) -> List[TeamWithRecord]:
    """Break the ties between the given list of teams by ordering them in place using the two- and multi-way criteria."""
    # Pre-compute each team's win percentage vs playoff-eligible teams to save time
    own_conf_win_pct_vs_playoff_teams = {}
    other_conf_win_pct_vs_playoff_teams = {}
    for t in tied_teams:
        own_conf_win_pct_vs_playoff_teams[t] = _get_team_win_pct_vs_playoff_teams(t, all_teams, playoff_format, vs_own_conference=True)
        other_conf_win_pct_vs_playoff_teams[t] = _get_team_win_pct_vs_playoff_teams(t, all_teams, playoff_format, vs_own_conference=False)

    if len(tied_teams) == 2:
        # Apply two-way tie-breakers criteria
        ordered_groups = break_two_way_tie(tied_teams, own_conf_win_pct_vs_playoff_teams, other_conf_win_pct_vs_playoff_teams, division_leaders=division_leaders)
    else:
        # Apply multi-way tie-breaker criteria
        ordered_groups = break_multi_way_tie(tied_teams, own_conf_win_pct_vs_playoff_teams, other_conf_win_pct_vs_playoff_teams, division_leaders=division_leaders)

    return _flatten_teams(ordered_groups)


def _determine_division_leaders(all_teams: List[TeamWithRecord], playoff_format: PlayoffFormat) -> Dict[str, TeamWithRecord]:
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
            break_ties(leader_or_tie_group, all_teams, playoff_format)
            leader = leader_or_tie_group[0]
        else:
            leader = leader_or_tie_group
        division_leaders[division] = leader

    return division_leaders


def _sort_and_group_tied_teams(all_teams: List[TeamWithRecord], sort_key: Callable) -> List[Union[TeamWithRecord, List[TeamWithRecord]]]:
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


def _get_team_win_pct_vs_playoff_teams(team, all_ordered_teams, playoff_format, vs_own_conference=True):
    """Calculates the total record of a team against playoff teams in their own or other conference, returned as a percentage."""

    def get_playoff_teams_in_conference(conference: str):
        # Returns the teams eligible (or tied for eligibility) for the playoffs
        playoff_teams = []
        num_playoff_teams = MODERN_NUM_PLAYOFF_TEAMS if playoff_format == PlayoffFormat.MODERN else LEGACY_NUM_PLAYOFF_TEAMS
        for team_or_tie_group in all_ordered_teams:
            if len(playoff_teams) >= num_playoff_teams:
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


def rank_teams(teams: List[TeamWithRecord], playoff_format: PlayoffFormat) -> List[TeamWithRecord]:
    """Ranks the given teams based on their records, and NBA tie-breaker criteria if needed."""
    # Initial sort pass based on team overall winning percentage, containing sublists of tied teams
    ordering_with_tied_groups = _sort_and_group_tied_teams(teams, sort_key=lambda t: t.overall_win_pct)

    if len(ordering_with_tied_groups) == len(teams):
        # Happy path: teams have all been discretely ordered simply based on winning percentage without any ties
        return ordering_with_tied_groups    

    # Get the division leaders, which is a prerequisite for fully determining tie-breaker criteria
    leaders_by_division = _determine_division_leaders(teams, playoff_format)
    
    # Now apply tie-breaker criteria to each tied group
    ranked_teams = []
    for team_or_tie_group in ordering_with_tied_groups:
        if isinstance(team_or_tie_group, list):
            # Tie group: break ties and add back to list
            ordered_teams = break_ties(team_or_tie_group, 
                                       ordering_with_tied_groups, 
                                       playoff_format, 
                                       division_leaders=leaders_by_division)
            ranked_teams.extend(ordered_teams)
        else:
            # Single team: just add to list
            ranked_teams.append(team_or_tie_group)

    return ranked_teams


def calculate_team_ranks_over_time(teams: List[Team], play_in_format=True) -> None:
    """Determines the total ordering of teams across each day of the season to populate each team's
    league_rank_by_date and conference_seed_by_date data."""
    # Create team record tracker for each team
    teams = [TeamWithRecord(team) for team in teams]

    # Get the dates of the earliest and latest game of the season
    first_game_datetime = util.api_date_string_to_datetime(min([team.games[0].date for team in teams]))
    last_game_datetime = util.api_date_string_to_datetime(max([team.games[-1].date for team in teams]))

    current_datetime = first_game_datetime

    while current_datetime <= last_game_datetime:
        # Update team records for games played on this date
        for team in teams:
            game_on_current_date = team.get_game_on_date(current_datetime)
            if game_on_current_date is not None:
                # Update team records according to game result
                team.update_record_after_game(game_on_current_date)

        # Rank the teams by record and tie-breaker criteria
        ranked_teams = rank_teams(teams, playoff_format=PlayoffFormat.MODERN if play_in_format else PlayoffFormat.LEGACY)

        # Get the API-compliant string format of the current date
        current_date_string = util.datetime_to_api_date_string(current_datetime)

        # Determine each team's conference seed and league-wide rank on the current date
        for team in teams:
            team.set_ranks_for_date(ranked_teams, current_date_string)

        # Advance date by one day for next iteration
        current_datetime += datetime.timedelta(days=1)
