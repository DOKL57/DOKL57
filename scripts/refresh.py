"""Refresh the rolling contribution history for Diff Breaker."""
import argparse
import json
import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
JOINED = date(2016, 12, 4)
DAYS_PER_ROW = 365
QUERY = """
query Archive($from: DateTime!, $to: DateTime!) {
  user(login: "DOKL57") {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar { weeks { contributionDays { date contributionCount } } }
    }
  }
}
"""


def download(start, end):
    variables = {"from": f"{start}T00:00:00Z", "to": f"{end}T23:59:59Z"}
    body = json.dumps({"query": QUERY, "variables": variables}).encode()
    request = Request("https://api.github.com/graphql", data=body, headers={
        "Authorization": "Bearer " + os.environ["GITHUB_TOKEN"],
        "Content-Type": "application/json", "User-Agent": "DOKL57-Diff-Breaker",
    })
    with urlopen(request, timeout=30) as response:
        result = json.load(response)
    if result.get("errors"):
        raise ValueError(result["errors"])
    weeks = result["data"]["user"]["contributionsCollection"]["contributionCalendar"]["weeks"]
    return {day["date"]: day["contributionCount"] for week in weeks for day in week["contributionDays"]}


def make_snapshot(end, fetch=download):
    rows = []
    stop = end
    while stop >= JOINED:
        # Reserve the registration year for the concrete at the end of the archive.
        earliest = JOINED if stop.year == JOINED.year else date(JOINED.year + 1, 1, 1)
        start = max(earliest, stop - timedelta(days=DAYS_PER_ROW - 1))
        received = fetch(start, stop)
        counts = []
        for offset in range((stop - start).days + 1):
            day = (start + timedelta(days=offset)).isoformat()
            count = received[day]  # Refuse partial calendars; retain the previous snapshot.
            if type(count) is not int or count < 0:
                raise ValueError(f"Invalid contribution count for {day}")
            if count:
                counts.append([day, count])
        rows.append({"start": str(start), "end": str(stop), "days": counts})
        stop = start - timedelta(days=1)
    return {"end": str(end), "joined": str(JOINED), "rows": rows}


def save(snapshot):
    path = ROOT / "activity.js"
    content = "const ACTIVITY = " + json.dumps(snapshot, separators=(",", ":")) + ";\n"
    temporary = path.with_suffix(".tmp")
    temporary.write_text(content, encoding="utf8")
    temporary.replace(path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--as-of", type=date.fromisoformat, default=datetime.now(timezone.utc).date())
    save(make_snapshot(parser.parse_args().as_of))
