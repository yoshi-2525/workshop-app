import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { DIALOGUE_RULE_GROUPS, DIALOGUE_RULES, type DialogueRuleGroup } from '@/pages/guide/dialogueRules'
import { ListenIcon, PlaceIcon, RulesHeroIllustration, TalkIcon } from '@/pages/guide/RulesIllustrations'
import { useBackState } from '@/hooks/useBackState'

const GROUP_ICONS: Record<DialogueRuleGroup, ComponentType> = {
  listen: ListenIcon,
  talk: TalkIcon,
  place: PlaceIcon,
}

// 対話のルール(/rules)。TAIWA について と同じ夜の読みものとして、ルールを「聴くとき」「話すとき」「場を守るために」の
// まとまりに分け、1つずつ暗い面のカードに並べる。番号はページに並べた順に通しで振る。
// 法的なルールの利用規約とは性質が違うので、規約の書式(LegalDocument)は使わない
export function DialogueRulesPage() {
  const backState = useBackState('対話のルール')
  const groups = DIALOGUE_RULE_GROUPS.map((group) => ({
    ...group,
    rules: DIALOGUE_RULES.filter((rule) => rule.group === group.key),
  }))
  // まとまりをまたいで通しの番号を振るため、各まとまりの最初の番号を数えておく
  const firstNumbers = groups.reduce<number[]>(
    (acc, _group, i) => [...acc, i === 0 ? 1 : acc[i - 1] + groups[i - 1].rules.length],
    [],
  )

  return (
    <div className="mx-auto max-w-3xl py-8 sm:py-12">
      <p className="text-sm tracking-[0.25em] text-fg-muted">はじめに読んでほしいこと</p>
      <h1 className="mt-4 font-brand text-3xl font-semibold tracking-widest text-fg sm:text-4xl">対話のルール</h1>
      <p className="mt-4 leading-loose text-fg-secondary">
        対話の場では誰もが安心して自分の考えを話し、互いの理解を深められる場を目指しています。
        一人ひとりが有意義な時間を過ごせるよう、ルールの順守にご協力をお願いいたします。
      </p>
      <div className="mt-9">
        <RulesHeroIllustration />
      </div>

      {groups.map((group, groupIndex) => {
        const Icon = GROUP_ICONS[group.key]
        const headingId = `rules-${group.key}`
        return (
          <section key={group.key} aria-labelledby={headingId} className="mt-12">
            <div className="flex items-center gap-2.5">
              <Icon />
              <h2 id={headingId} className="font-brand text-xl font-semibold tracking-wider text-fg">
                {group.label}
              </h2>
              <span aria-hidden="true" className="ml-2 h-px flex-1 bg-border-muted" />
            </div>
            <ol start={firstNumbers[groupIndex]} className="mt-4 space-y-3">
              {group.rules.map((rule, i) => (
                <li key={rule.title} className="flex gap-4 rounded-lg bg-surface-muted px-5 py-5 shadow-card sm:px-6">
                  <span aria-hidden="true" className="shrink-0 font-brand text-2xl leading-none text-accent">
                    {String(firstNumbers[groupIndex] + i).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="font-semibold text-fg">{rule.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-fg-secondary">{rule.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )
      })}

      <p className="mt-12 rounded-lg border border-border-muted px-5 py-4 text-[13px] leading-relaxed text-fg-muted">
        ルールが守られていないと感じたときは、ワークショップの主催者に問い合わせからお知らせください。
        サービス全体のルールは
        <Link to="/help/terms" state={backState} className="underline underline-offset-[3px] hover:text-fg-secondary">
          利用規約
        </Link>
        をご覧ください。
      </p>
    </div>
  )
}
