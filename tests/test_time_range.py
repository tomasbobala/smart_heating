"""Tests for coordinator._time_in_range (day/night window logic, incl. midnight wrap)."""
from datetime import time

from custom_components.smart_heating.coordinator import _time_in_range


def test_normal_range_within():
    assert _time_in_range(time(10, 0), time(6, 0), time(20, 0)) is True


def test_normal_range_before_start():
    assert _time_in_range(time(5, 0), time(6, 0), time(20, 0)) is False


def test_normal_range_at_end_is_exclusive():
    assert _time_in_range(time(20, 0), time(6, 0), time(20, 0)) is False


def test_normal_range_at_start_is_inclusive():
    assert _time_in_range(time(6, 0), time(6, 0), time(20, 0)) is True


def test_overnight_wrap_inside_evening():
    # e.g. night window 20:00 - 6:00
    assert _time_in_range(time(23, 0), time(20, 0), time(6, 0)) is True


def test_overnight_wrap_inside_morning():
    assert _time_in_range(time(3, 0), time(20, 0), time(6, 0)) is True


def test_overnight_wrap_outside():
    assert _time_in_range(time(12, 0), time(20, 0), time(6, 0)) is False
