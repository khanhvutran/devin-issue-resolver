import connexion
from pathlib import Path


def create_app():
    spec_dir = Path(__file__).resolve().parent.parent / "openapi"
    app = connexion.FlaskApp(__name__, specification_dir=str(spec_dir))
    app.add_api("openapi.yaml")
    return app
