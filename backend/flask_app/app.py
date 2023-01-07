from flask import Flask
from flask_cors import CORS

from typing import Optional

from .nba_server.nba_api_gateway import get_standings_data

app = Flask(__name__)
CORS(app)   # Make all routes return CORS-allow headers as part of response


@app.route("/nba/<season>")
def team_standings_data(season: Optional[str] = None):
    return get_standings_data(season)
