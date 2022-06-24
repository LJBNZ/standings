import json
from flask import Flask, render_template
from flask_cors import CORS

from .nba_server.nba_api_gateway import get_graph_data

app = Flask(__name__)
CORS(app)   # Make all routes return CORS-allow headers as part of response


@app.route("/teamData", methods=['GET'])
def graph_data_raw():
    return json.dumps(get_graph_data())



@app.route("/standings", methods=['GET'])
def graph_data():
    return render_template('graph.html', json_data=get_graph_data())
