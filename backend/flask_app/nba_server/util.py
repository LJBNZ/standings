import datetime


API_DATE_STRING_FMT = "%Y-%m-%dT%H:%M:%S"


def api_date_string_to_datetime(date_string: str) -> datetime.datetime:
    """Takes a date string returned by the NBA API and converts it to a datetime object."""
    return datetime.datetime.strptime(date_string, API_DATE_STRING_FMT)


def datetime_to_api_date_string(dt: datetime.datetime) -> str:
    """Takes a datetime object and returns its string representation in the API format."""
    return dt.strftime(API_DATE_STRING_FMT)
