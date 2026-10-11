# Code decides, models only read: diagnosing rooftop solar with pvlib, Textract and Cedar

Built for Environmental Hacks 2026. Live: https://bit.ly/4B0WI5e

**The problem.** Indian rooftop solar owners see one number, "12.4 kWh today", and nothing to judge it against. Dust after the monsoon or a dead string can quietly cost a few hundred rupees a month.

**What we built.** SuryaCheck reads one photo of the inverter app with Amazon Textract, fetches the real sunshine for that roof from Open-Meteo, and uses pvlib to compute what the panels should have made. Fixed rules turn the gap into a verdict (Healthy, Dust, Possible fault), the rupees lost, and real solar businesses nearby (Amazon Location Service). EventBridge Scheduler rechecks after a cleaning.

**The stack.** Amplify, API Gateway, three Lambdas (API; pvlib container; CLIP ONNX vision container), DynamoDB, S3, Textract, Rekognition, SAM, Powertools and Cedar. Bill so far: $0.03 before credits.

**What fought back**

1. **Our own test called a clean roof dusty.** On 300 noisy simulated roofs, a 3-day median faked declines. A Theil–Sen trend whose 95% upper bound must be below zero fixed it: 99% of clean roofs read Healthy; dust and string faults were caught 300/300.
2. **The weather API invented an inverter trip.** Open-Meteo's hour-ending timestamps left a partial first day that looked like 0 kWh on a sunny day. We now drop days with fewer than 24 hours.
3. **A dust model that scored 87%, then 55%.** A CLIP probe trained on close-ups failed on real rooftop shots. It now shows a condition only when ≥ 80% sure (97.5% right then) and never decides the verdict.
4. **The cloud said no.** Bedrock stayed blocked ("Your account is currently being verified"), so templates write every explanation from computed numbers. Location search for "solar panel cleaning" near Ahmedabad returned El Paso, so we search broader terms and label results "not verified cleaners".
5. **The bug that passed every test.** Tests used Upload; on a phone, Take photo failed with "source must be screenshot, csv or manual". Lesson: test the path real people take, on their device.

**One rule.** Models read; code decides every number, verdict and action, and a Cedar policy gates what the app may do.

Code: https://github.com/RajvardhanJhala/suryacheck

*Opinions are my own and do not reflect AWS.*
