import { Link } from 'react-router-dom'
import { PaperCard } from '@/components/ui/PaperCard'
import { DIALOGUE_RULES } from '@/pages/guide/dialogueRules'
import { useBackState } from '@/hooks/useBackState'

// 対話のルール(/rules)。参加のたびに読み返してもらえるよう、手渡されるルールの紙のように1枚の紙のカードに並べる。
// 法的なルールの利用規約とは性質が違うので、規約の書式(LegalDocument)は使わない
export function DialogueRulesPage() {
  const backState = useBackState('対話のルール')
  return (
    <div className="mx-auto max-w-2xl py-4">
      <p className="text-sm tracking-[0.25em] text-fg-muted">参加の前に</p>
      <h1 className="mt-3 font-brand text-3xl font-semibold tracking-widest text-fg">対話のルール</h1>
      <p className="mt-4 leading-loose text-fg-secondary">
        TAIWA の場が、誰にとっても安心して話せる場所であるための約束ごとです。
        <br className="hidden sm:inline" />
        参加のたびに、そっと思い出してもらえるとうれしいです。
      </p>

      {/* 右下の角の折れが最後の文章にかからないよう、下の余白を広めに取る */}
      <PaperCard as="article" className="mt-8 p-6 pb-12 sm:p-8 sm:pb-12">
        <ol className="space-y-6">
          {DIALOGUE_RULES.map((rule, i) => (
            <li key={rule.title} className="flex gap-4">
              <span aria-hidden="true" className="font-brand text-2xl leading-none text-fg-subtle">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <h2 className="font-semibold text-fg">{rule.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-fg-secondary">{rule.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-8 border-t border-border pt-4 text-xs leading-relaxed text-fg-muted">
          ルールが守られていないと感じたときは、ワークショップの主催者に問い合わせからお知らせください。
          サービス全体のルールは
          <Link to="/help/terms" state={backState} className="underline hover:text-fg-secondary">
            利用規約
          </Link>
          をご覧ください。
        </p>
      </PaperCard>
    </div>
  )
}
