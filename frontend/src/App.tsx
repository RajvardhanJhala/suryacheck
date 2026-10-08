const API = import.meta.env.VITE_API_URL as string

export default function App() {
  return (
    <main style={{ maxWidth: 560, margin: '48px auto', padding: '0 16px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>SuryaCheck</h1>
      <p>Is your rooftop solar making what today's sunshine allowed?</p>
      <p style={{ color: '#666' }}>Under construction for Environmental Hacks 2026. API: {API}</p>
    </main>
  )
}
