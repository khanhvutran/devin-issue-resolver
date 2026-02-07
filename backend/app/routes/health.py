from apiflask import APIBlueprint
from apiflask.fields import String
from apiflask.schemas import Schema

health_bp = APIBlueprint("health", __name__, url_prefix="/api")


class HealthOut(Schema):
    message = String(required=True)
    status = String(required=True)


@health_bp.get("/health")
@health_bp.output(HealthOut)
@health_bp.doc(summary="Health check", description="Verify the API is running")
def health_check():
    return {
        "message": "Hello from Flask!",
        "status": "healthy",
    }
