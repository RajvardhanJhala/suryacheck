import pytest

from physics import rules
from shared.authz import is_action_allowed

ALL_ACTIONS = ["CLEAN_PANELS", "WAIT", "MESSAGE_INSTALLER", "CHECK_INVERTER_DISPLAY",
               "INSPECT_SHADING", "VERIFY_CAPACITY"]
VERDICTS = [v for v in rules.ACTIONS if v not in (rules.HEALTHY, rules.WEATHER, rules.INSUFFICIENT, rules.BELOW)]


@pytest.mark.parametrize("loss", [100, 400])
@pytest.mark.parametrize("verdict", VERDICTS)
def test_cedar_matches_rules(verdict, loss):
    """Every (verdict, action, loss) decision in Cedar equals rules.allowed_actions."""
    site = {"cleaning_cost_inr": 200}
    expected = set(rules.allowed_actions(verdict, loss, 200))
    for action in ALL_ACTIONS:
        allowed, _ = is_action_allowed(action, {"id": "a1", "verdict": verdict, "monthly_loss_inr": loss}, site)
        assert allowed == (action in expected), (verdict, loss, action)


@pytest.mark.parametrize("verdict", [rules.HEALTHY, rules.WEATHER, rules.INSUFFICIENT, rules.BELOW])
def test_nothing_allowed_when_nothing_is_wrong(verdict):
    for action in ALL_ACTIONS:
        assert not is_action_allowed(action, {"id": "a1", "verdict": verdict, "monthly_loss_inr": 999},
                                     {"cleaning_cost_inr": 200})[0]


def test_dust_cannot_message_installer():
    assert not is_action_allowed("MESSAGE_INSTALLER", {"id": "a1", "verdict": "SOILING", "monthly_loss_inr": 400},
                                 {"cleaning_cost_inr": 200})[0]


def test_simulated_site_never_messages_a_real_number():
    analysis = {"id": "a1", "verdict": "FAULT", "monthly_loss_inr": 600}
    assert is_action_allowed("MESSAGE_INSTALLER", analysis, {"simulated": True})[0]
    assert not is_action_allowed("MESSAGE_INSTALLER", analysis,
                                 {"simulated": True, "installer_phone": "+919800000000"})[0]
