import json
from flask import Flask
from flask_cors import CORS

from .nba_server.nba_api_gateway import CURRENT_SEASON, get_standings_graph_team_data

app = Flask(__name__)
CORS(app)   # Make all routes return CORS-allow headers as part of response


@app.route("/nba/<season>")
def team_standings_data(season: str = CURRENT_SEASON):
    return get_standings_graph_team_data(season)
