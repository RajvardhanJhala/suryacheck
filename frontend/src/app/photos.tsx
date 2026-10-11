import type { PhotoClass } from '../api'
import { Badge } from '../ui/primitives'

const COND_LABEL: Record<string, string> = { clean: 'Looks clean', dirty: 'Looks dirty' }
const CONFIDENT = 0.8   // test set: 97.5% right when shown at 0.8 vs 91% at 0.6
const NOT_PANEL = 0.6

/** Visual soiling estimate for one panel photo. Shown only when the model is confident; never the verdict. */
export function PanelEstimate({ cls }: { cls: PhotoClass | null | undefined }) {
  if (!cls) return <Badge>Checking…</Badge>
  if (cls.kind !== 'panel' && cls.kind_probs[cls.kind] >= NOT_PANEL) return <Badge tone="fault" icon="alert">Doesn't look like panels</Badge>
  const p = cls.condition ? cls.condition_probs?.[cls.condition] ?? 0 : 0
  if (!cls.condition || p < CONFIDENT) return <Badge>Visual check: not sure</Badge>
  return <Badge tone={cls.condition === 'clean' ? 'clean' : 'dust'} icon={cls.condition === 'clean' ? 'check' : 'dust'}>
    {COND_LABEL[cls.condition] ?? cls.condition} · {Math.round(p * 100)}%</Badge>
}
