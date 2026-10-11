// Verdict words and their colour tone. Colour always comes with the word and an icon.
export const VERDICT: Record<string, { en: string; hi: string; tone: 'dust' | 'fault' | 'clean' | 'neutral' }> = {
  SOILING: { en: 'Dust', hi: 'धूल', tone: 'dust' },
  FAULT: { en: 'Possible fault', hi: 'संभावित खराबी', tone: 'fault' },
  INVERTER_TRIP: { en: 'Inverter trip', hi: 'इन्वर्टर बंद हुआ', tone: 'fault' },
  WEATHER: { en: 'Weather', hi: 'मौसम', tone: 'neutral' },
  PERSISTENT_LOW: { en: 'Always low', hi: 'हमेशा कम', tone: 'dust' },
  STEADY_LOSS: { en: 'Steady loss', hi: 'लगातार नुकसान', tone: 'dust' },
  UNEXPLAINED: { en: 'Unclear', hi: 'कारण अस्पष्ट', tone: 'neutral' },
  HEALTHY: { en: 'Healthy', hi: 'ठीक है', tone: 'clean' },
  INSUFFICIENT_DATA: { en: 'Need more data', hi: 'और डेटा चाहिए', tone: 'neutral' },
}
