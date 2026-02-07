from apiflask import APIFlask


def create_app():
    app = APIFlask(
        __name__,
        title="Devin API",
        version="1.0.0",
    )

    from app.routes.health import health_bp

    app.register_blueprint(health_bp)

    return app
