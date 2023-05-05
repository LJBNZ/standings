import datetime


API_DATE_STRING_FMT = "%Y-%m-%dT%H:%M:%S"
EPOCH_DATETIME = datetime.datetime.utcfromtimestamp(0)


def api_date_string_to_datetime(date_string: str) -> datetime.datetime:
    """Takes a date string returned by the NBA API and converts it to a datetime object."""
    return datetime.datetime.strptime(date_string, API_DATE_STRING_FMT)

def get_datetime_as_milliseconds(dt: datetime) -> int:
    return int((dt - EPOCH_DATETIME).total_seconds() * 1000)