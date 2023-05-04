from collections import defaultdict, OrderedDict
from dataclasses import dataclass
from typing import Any


_DEFAULT_PRIMARY = "#c705f7"  # Purple
_DEFAULT_SECONDARY = "#ffffff"   # White
WHITE_TEXT_COLOUR = "#ffffff"
BLACK_TEXT_COLOUR = "#000000"
DEFAULT_TEAM_COLOURS = (_DEFAULT_PRIMARY, _DEFAULT_SECONDARY)   # Default colours if something goes wrong...

# Primary and secondary hex colour data for each team
colours_by_team = {
    "Atlanta Hawks":          ("#e03a3e", "#c1d32f", WHITE_TEXT_COLOUR),
    "Boston Celtics":         ("#008348", "#000000", WHITE_TEXT_COLOUR),
    "Brooklyn Nets":          ("#666666", "#000000", WHITE_TEXT_COLOUR),
    "Charlotte Hornets":      ("#00788c", "#1d1160", WHITE_TEXT_COLOUR),
    "Chicago Bulls":          ("#ce1141", "#000000", WHITE_TEXT_COLOUR),
    "Cleveland Cavaliers":    ("#6f263d", "#ffb81c", WHITE_TEXT_COLOUR),
    "Dallas Mavericks":       ("#0053bc", "#00285e", WHITE_TEXT_COLOUR),
    "Denver Nuggets":         ("#0e2240", "#fec524", WHITE_TEXT_COLOUR),
    "Detroit Pistons":        ("#1d428a", "#c8102e", WHITE_TEXT_COLOUR),
    "Golden State Warriors":  ("#006bb6", "#fdb927", WHITE_TEXT_COLOUR),
    "Houston Rockets":        ("#ce1141", "#c4ced4", WHITE_TEXT_COLOUR),
    "Indiana Pacers":         ("#002d62", "#fdbb30", WHITE_TEXT_COLOUR),
    "Los Angeles Clippers":   ("#c8102e", "#1d428a", WHITE_TEXT_COLOUR),
    "Los Angeles Lakers":     ("#fdb927", "#552583", BLACK_TEXT_COLOUR),
    "Memphis Grizzlies":      ("#5d76a9", "#12173f", WHITE_TEXT_COLOUR),
    "Miami Heat":             ("#98002e", "#f9a01b", WHITE_TEXT_COLOUR),
    "Milwaukee Bucks":        ("#00471b", "#eee1c6", WHITE_TEXT_COLOUR),
    "Minnesota Timberwolves": ("#236192", "#78be20", WHITE_TEXT_COLOUR),
    "New Orleans Pelicans":   ("#b4975a", "#002b5c", BLACK_TEXT_COLOUR),
    "New York Knicks":        ("#006bb6", "#f58426", WHITE_TEXT_COLOUR),
    "Oklahoma City Thunder":  ("#007ac1", "#ef3b24", WHITE_TEXT_COLOUR),
    "Orlando Magic":          ("#0077c0", "#000000", WHITE_TEXT_COLOUR),
    "Philadelphia 76ers":     ("#006bb6", "#ed174c", WHITE_TEXT_COLOUR),
    "Phoenix Suns":           ("#e56020", "#1d1160", WHITE_TEXT_COLOUR),
    "Portland Trail Blazers": ("#e03a3e", "#000000", WHITE_TEXT_COLOUR),
    "Sacramento Kings":       ("#5a2b81", "#63727a", WHITE_TEXT_COLOUR),
    "San Antonio Spurs":      ("#000000", "#c4ced4", WHITE_TEXT_COLOUR),
    "Toronto Raptors":        ("#000000", "#ce1141", WHITE_TEXT_COLOUR),
    "Utah Jazz":              ("#fff21f", "#000000", BLACK_TEXT_COLOUR),
    "Washington Wizards":     ("#002b5c", "#e31837", WHITE_TEXT_COLOUR),
}

def get_colours_for_team(team_name: str) -> tuple:
    """Returns the primary, secondary and text colours for the team with the given name."""
    return colours_by_team.get(team_name, DEFAULT_TEAM_COLOURS)


@dataclass
class Game():
    """Represents a single NBA game."""
    id: str
    game_num: int
    date: Any
    date_ms: int
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


class Team:
    """Represents an NBA team."""
    def __init__(self, 
                 id: int,
                 name: str,
                 slug: str,
                 primary_colour: str,
                 secondary_colour: str,
                 text_colour: str,
                 conference: str,
                 division: str,
                 standings_info: dict):
        # Basic info
        self.id = id
        self.name = name
        self.slug = slug
        self.primary_colour = primary_colour
        self.secondary_colour = secondary_colour
        self.text_colour = text_colour
        self.conference = conference
        self.division = division
        self.standings_info = standings_info
        
        # Ranking data
        self.league_rank = None
        self.conference_seed = None
        self.league_rank_by_date = OrderedDict()
        self.conference_seed_by_date = OrderedDict()

    def to_json(self):
        attrs = self.__dict__
        attrs['games'] = [game.to_json() for game in self.games]
        for key in list(attrs.keys()):
            if key.startswith('_'):
                del attrs[key]
        return attrs
    
