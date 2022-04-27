from flask import Flask

from .nba_api_gateway import get_graph_data

app = Flask(__name__)


@app.route("/standings", methods=['GET'])
def graph_data():
    return get_graph_data()
