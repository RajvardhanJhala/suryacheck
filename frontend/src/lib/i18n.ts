// Diagnosis text in English and Hindi, built only from computed numbers.
import type { Analysis } from '../api'

export type Lang = 'en' | 'hi'

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

const HEADLINE_HI: Record<string, string> = {
  SOILING: 'पैनलों पर धूल आपकी बचत घटा रही है।',
  FAULT: 'अचानक गिरावट — यह धूल नहीं, बिजली की खराबी लगती है।',
  INVERTER_TRIP: 'धूप वाले दिन भी सिस्टम ने लगभग कुछ नहीं बनाया।',
  WEATHER: 'यह मौसम की वजह से है — आसपास के सिस्टम भी कम चले।',
  PERSISTENT_LOW: 'आपका सिस्टम शुरू से ही अपेक्षा से कम बना रहा है।',
  STEADY_LOSS: 'उत्पादन आपके सबसे अच्छे हफ़्ते से लगातार कम है।',
  UNEXPLAINED: 'उत्पादन अपेक्षा से कम है, पर कारण अभी साफ़ नहीं है।',
  HEALTHY: 'आपके पैनल धूप के हिसाब से पूरा बना रहे हैं।',
  INSUFFICIENT_DATA: 'अभी साफ़ दिनों का डेटा कम है।',
}

const TODO_HI: Record<string, string> = {
  CLEAN_PANELS: 'सुबह जल्दी गीले कपड़े से पैनल साफ़ करवाएँ (तेज़ पानी की धार नहीं)। कुछ दिनों बाद SuryaCheck फिर जाँचेगा।',
  WAIT: 'अभी सफ़ाई का खर्च नुकसान से ज़्यादा है। एक हफ़्ते बाद फिर जाँचेंगे।',
  MESSAGE_INSTALLER: 'अपने इंस्टॉलर को यह सबूत भेजें — यह धूल नहीं, बिजली की समस्या लगती है।',
  CHECK_INVERTER_DISPLAY: 'इन्वर्टर की स्क्रीन पर एरर कोड देखें, फिर इंस्टॉलर को बताएँ।',
  INSPECT_SHADING: 'पैनलों पर नई छाया देखें (पेड़, पानी की टंकी, नया निर्माण), खासकर सुबह 10 से दोपहर 3 बजे के बीच।',
  VERIFY_CAPACITY: 'इंस्टॉलेशन के कागज़ों में सिस्टम का साइज़ जाँचें।',
  NONE: 'कुछ करने की ज़रूरत नहीं।',
  ADD_DATA: 'और दिनों की रीडिंग जोड़ें (महीने का स्क्रीनशॉट सबसे अच्छा)।',
}

const hiDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('hi-IN', { day: 'numeric', month: 'long' })
const pct = (x: number) => Math.round(Math.abs(x) * 100)

function whyHi(a: Analysis): string {
  const p = a.performance
  if (a.verdict === 'SOILING' && p.segment_decline != null && p.segment_slope != null)
    return `${hiDate(p.segment_start)} (पिछली बारिश या सफ़ाई) के बाद से उत्पादन ${pct(p.segment_decline)}% गिरा है, लगभग ${(Math.abs(p.segment_slope) * 100).toFixed(1)}% प्रतिदिन।`
  const step = p.steps.at(-1)
  if (a.verdict === 'FAULT' && step) return `${hiDate(step.date)} को उत्पादन ${pct(step.delta)}% अचानक गिरा और कम ही बना रहा।`
  if (a.verdict === 'INVERTER_TRIP' && p.trip_days.length) return `${p.trip_days.map(hiDate).join(', ')} को उत्पादन लगभग शून्य था।`
  return ''
}

export function diagnosisText(a: Analysis, lang: Lang) {
  if (lang === 'en') return a.explanation
  return { headline: HEADLINE_HI[a.verdict], why: whyHi(a), what_to_do: TODO_HI[a.action] ?? '' }
}

/** Confidence from the winning rule score; ties are never "high". */
export function confidence(a: Analysis): 'high' | 'medium' | 'low' | null {
  const s = a.scores?.[a.verdict]
  if (s == null) return null
  if (a.tie_candidates?.length) return 'low'
  return s >= 0.85 ? 'high' : s >= 0.65 ? 'medium' : 'low'
}
