"""Notion export -> TATAKAE import JSON. Stub only."""
import argparse
import json
from pathlib import Path


def parse_tasks(csv_path: Path) -> list[dict]:
    # TODO(v2): map Notion Tasks & Sprints rows -> missions
    raise NotImplementedError


def parse_habits(csv_path: Path) -> list[dict]:
    # TODO(v2)
    raise NotImplementedError


def parse_areas(csv_path: Path) -> list[dict]:
    # TODO(v2)
    raise NotImplementedError


def parse_projects(csv_path: Path) -> list[dict]:
    # TODO(v2): projects -> goals
    raise NotImplementedError


def parse_second_brain(folder: Path) -> list[dict]:
    # TODO(v3): markdown pages -> notes
    raise NotImplementedError


def push(payload: dict, api: str) -> None:
    # TODO(v2): POST batches to /api/sync with Authorization: Bearer API_TOKEN
    raise NotImplementedError


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--export", type=Path)
    ap.add_argument("--out", type=Path, default=Path("import.json"))
    ap.add_argument("--push", type=Path)
    ap.add_argument("--api")
    args = ap.parse_args()
    # TODO(v2): wire up
    print(json.dumps(vars(args), default=str))


if __name__ == "__main__":
    main()
