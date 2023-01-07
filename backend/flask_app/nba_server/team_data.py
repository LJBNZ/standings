from collections import defaultdict, OrderedDict
from dataclasses import dataclass
from typing import Any


_DEFAULT_PRIMARY = "#c705f7"  # Purple
_DEFAULT_SECONDARY = "#ffffff"   # White
DEFAULT_TEAM_COLOURS = (_DEFAULT_PRIMARY, _DEFAULT_SECONDARY)   # Default colours if something goes wrong...

# Primary and secondary hex colour data for each team
colours_by_team = {
    "Atlanta Hawks":          ("#e03a3e", "#c1d32f"),
    "Boston Celtics":         ("#008348", "#000000"),
    "Brooklyn Nets":          ("#666666", "#000000"),
    "Charlotte Hornets":      ("#00788c", "#1d1160"),
    "Chicago Bulls":          ("#ce1141", "#000000"),
    "Cleveland Cavaliers":    ("#6f263d", "#ffb81c"),
    "Dallas Mavericks":       ("#0053bc", "#00285e"),
    "Denver Nuggets":         ("#0e2240", "#fec524"),
    "Detroit Pistons":        ("#1d428a", "#c8102e"),
    "Golden State Warriors":  ("#006bb6", "#fdb927"),
    "Houston Rockets":        ("#ce1141", "#c4ced4"),
    "Indiana Pacers":         ("#002d62", "#fdbb30"),
    "Los Angeles Clippers":   ("#c8102e", "#1d428a"),
    "Los Angeles Lakers":     ("#fdb927", "#552583"),
    "Memphis Grizzlies":      ("#5d76a9", "#12173f"),
    "Miami Heat":             ("#98002e", "#f9a01b"),
    "Milwaukee Bucks":        ("#00471b", "#eee1c6"),
    "Minnesota Timberwolves": ("#236192", "#78be20"),
    "New Orleans Pelicans":   ("#b4975a", "#002b5c"),
    "New York Knicks":        ("#006bb6", "#f58426"),
    "Oklahoma City Thunder":  ("#007ac1", "#ef3b24"),
    "Orlando Magic":          ("#0077c0", "#000000"),
    "Philadelphia 76ers":     ("#006bb6", "#ed174c"),
    "Phoenix Suns":           ("#e56020", "#1d1160"),
    "Portland Trail Blazers": ("#e03a3e", "#000000"),
    "Sacramento Kings":       ("#5a2b81", "#63727a"),
    "San Antonio Spurs":      ("#000000", "#c4ced4"),
    "Toronto Raptors":        ("#000000", "#ce1141"),
    "Utah Jazz":              ("#00471b", "#002b5c"),
    "Washington Wizards":     ("#002b5c", "#e31837"),
}

def get_colours_for_team(team_name: str) -> tuple:
    """Returns the primary and secondary colours for the team with the given name."""
    return colours_by_team.get(team_name, DEFAULT_TEAM_COLOURS)


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


class Team:
    """Represents an NBA team."""
    def __init__(self, 
                 id: int,
                 name: str,
                 slug: str,
                 primary_colour: str,
                 secondary_colour: str,
                 conference: str,
                 division: str):
        # Basic info
        self.id = id
        self.name = name
        self.slug = slug
        self.primary_colour = primary_colour
        self.secondary_colour = secondary_colour
        self.conference = conference
        self.division = division
        
        # Ranking data
        self.league_rank = None
        self.league_rank_by_date = OrderedDict()
        self.conference_seed_by_date = OrderedDict()

    def to_json(self):
        attrs = self.__dict__
        attrs['games'] = [game.to_json() for game in self.games]
        for key in list(attrs.keys()):
            if key.startswith('_'):
                del attrs[key]
        return attrs
    
