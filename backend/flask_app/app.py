from flask import Flask, render_template

from .nba_server.nba_api_gateway import get_graph_data

app = Flask(__name__)


@app.route("/standings", methods=['GET'])
def graph_data():
    return render_template('graph.html', json_data=get_graph_data())
