import logging
from datetime import datetime, timedelta, timezone

from flask import Blueprint, request, jsonify

from app.services.player_analytics import player_analytics_service

logger = logging.getLogger(__name__)

analytics_bp = Blueprint("analytics", __name__, url_prefix="/api/servers")


def _parse_date_range(args):
    """Parse ?from=ISO&to=ISO. Defaults to last 30 days."""
    to_dt = datetime.now(timezone.utc)
    from_dt = to_dt - timedelta(days=30)
    try:
        if "from" in args:
            from_dt = datetime.fromisoformat(args["from"].replace("Z", "+00:00"))
        if "to" in args:
            to_dt = datetime.fromisoformat(args["to"].replace("Z", "+00:00"))
    except (ValueError, AttributeError) as e:
        logger.warning("Invalid date range params: %s", e)
    return from_dt, to_dt


@analytics_bp.route("/<server_name>/analytics/playtime", methods=["GET"])
def get_playtime(server_name: str):
    from_dt, to_dt = _parse_date_range(request.args)
    data = player_analytics_service.get_playtime(server_name, from_dt, to_dt)
    return jsonify({"playtime": data})


@analytics_bp.route("/<server_name>/analytics/heatmap", methods=["GET"])
def get_heatmap(server_name: str):
    from_dt, to_dt = _parse_date_range(request.args)
    data = player_analytics_service.get_heatmap(server_name, from_dt, to_dt)
    return jsonify({"heatmap": data})


@analytics_bp.route("/<server_name>/analytics/retention", methods=["GET"])
def get_retention(server_name: str):
    from_dt, to_dt = _parse_date_range(request.args)
    data = player_analytics_service.get_retention(server_name, from_dt, to_dt)
    return jsonify(data)
