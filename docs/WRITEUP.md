# SuryaCheck: write-up

**Live:** https://bit.ly/4B0WI5e · **Track:** Waste & Energy

**Problem.** Lakhs of Indian homes now run rooftop solar under PM Surya Ghar. The owner sees one
number, "12.4 kWh today", and has nothing to compare it with. After the monsoon, dust builds up day
by day. A dead string or a tripping inverter can quietly take 10–25% of output. Inverter apps show
output; nobody shows the shortfall. So families lose a few hundred rupees a month, and clean energy,
without knowing.

**What we built.** SuryaCheck needs one photo of the inverter display or app; one day's units are
enough. Amazon Textract reads the numbers and the owner confirms them. We fetch the real hourly
sunshine for that roof from Open-Meteo, and pvlib computes what the panels should have made. Fixed
rules then give one verdict (Healthy, Dust, Possible fault, Weather), one plain sentence and the
rupees: lost this month, over the next year, and recovered per cleaning. The same page lists real
solar businesses nearby (Amazon Location Service) to call or WhatsApp. After a cleaning, EventBridge
Scheduler triggers a recheck that measures, against the same baseline, whether the money came back.

**AWS.**
- **Amplify** hosts the app; **API Gateway** and three **Lambdas** run it:
  - an API;
  - a pvlib analysis container;
  - a CLIP vision container that recognises panel, inverter and meter photos and estimates
    clean/dirty.
- **DynamoDB** (with a geohash GSI for neighbours) holds the data and **S3** the photos.
- **Rekognition** cross-checks panel photos.
- **SAM**, **Powertools** and **Cedar** (which authorises every action) are the open-source pieces.

**AI tools.**
- Claude Code helped build and test the project.
- AI only reads and estimates: Textract reads digits, and CLIP gives a visual dust estimate shown
  only when ≥ 80% confident.
- Code alone computes every number, verdict and action, checked by 69 tests. In a test on 300
  simulated roofs, clean roofs read Healthy 99% of the time, and dust and string faults were each
  caught 300/300.
- Bedrock was unavailable (AWS account verification), so explanations come from templates.

**Limitations.** One-day quick checks can't tell dust from a fault. Thresholds are not yet validated
on field data. Sample roofs and their neighbours are simulated, though the weather is real.

**Next.** Installers onboarding customers by area, for real neighbour comparison, plus better photo
models trained on licensed rooftop photos.
