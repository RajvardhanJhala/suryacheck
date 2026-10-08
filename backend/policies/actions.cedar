// Which real-world action SuryaCheck may take for a given diagnosis.
// Default is deny: anything not permitted here cannot be scheduled or sent,
// whatever the language model asks for. Mirrors rules.ACTIONS (tests check they agree).

// Dust: clean only when the monthly loss pays for the cleaning; otherwise wait (saves water).
permit (principal, action == Action::"CLEAN_PANELS", resource is Analysis)
when { ["SOILING", "STEADY_LOSS"].contains(resource.verdict)
       && resource.monthly_loss_inr >= resource.cleaning_cost_inr };

permit (principal, action == Action::"WAIT", resource is Analysis)
when { resource.verdict == "SOILING"
       && resource.monthly_loss_inr < resource.cleaning_cost_inr };

// Electrical problems go to the installer, never to a cleaner.
permit (principal, action == Action::"MESSAGE_INSTALLER", resource is Analysis)
when { ["FAULT", "INVERTER_TRIP"].contains(resource.verdict) };

permit (principal, action == Action::"CHECK_INVERTER_DISPLAY", resource is Analysis)
when { resource.verdict == "INVERTER_TRIP" };

permit (principal, action == Action::"INSPECT_SHADING", resource is Analysis)
when { ["PERSISTENT_LOW", "STEADY_LOSS", "UNEXPLAINED"].contains(resource.verdict) };

permit (principal, action == Action::"VERIFY_CAPACITY", resource is Analysis)
when { resource.verdict == "PERSISTENT_LOW" };

// A simulated demo site can never message a real phone number.
forbid (principal, action == Action::"MESSAGE_INSTALLER", resource is Analysis)
when { resource.simulated && resource.has_real_contact };
