"""Plain-English explanation built only from computed numbers. Used as-is when Bedrock is
unavailable; the model may rephrase it but never changes a number."""

ACTION_TEXT = {
    "CLEAN_PANELS": "Get the panels cleaned early in the morning with a wet cloth (no high-pressure jet). "
                    "SuryaCheck will recheck a few days later.",
    "WAIT": "Cleaning would cost more than you are losing right now. SuryaCheck will check again in a week.",
    "MESSAGE_INSTALLER": "Send your installer the evidence below; this looks electrical, not dust.",
    "CHECK_INVERTER_DISPLAY": "Look at the inverter's display for an error code, then message your installer.",
    "INSPECT_SHADING": "Check for new shade on the panels (a tree, water tank or new construction), "
                       "especially between 10 am and 3 pm.",
    "VERIFY_CAPACITY": "Confirm the system size on your installation papers; the numbers suggest it may differ.",
    "NONE": "Nothing to do.",
    "ADD_DATA": "Add more daily readings (a monthly screenshot or CSV works best).",
}

HEADLINE = {
    "SOILING": "Dust on your panels is costing you money.",
    "FAULT": "A sudden drop looks like an electrical fault, not dust.",
    "INVERTER_TRIP": "Your system produced almost nothing on a sunny day.",
    "WEATHER": "It's the weather, not your system — your neighbours dipped too.",
    "PERSISTENT_LOW": "Your system has always produced less than it should.",
    "STEADY_LOSS": "Output is steadily below your best week.",
    "UNEXPLAINED": "Output is lower than expected and the cause isn't clear yet.",
    "HEALTHY": "Your panels are making what the sunshine allowed.",
    "INSUFFICIENT_DATA": "Not enough clear days of data yet.",
}


def explain(verdict, action, monthly_loss_inr, evidence):
    headline = HEADLINE[verdict].format(loss=monthly_loss_inr or 0)
    return {"headline": headline, "why": " ".join(evidence[:2]), "what_to_do": ACTION_TEXT.get(action, "")}
