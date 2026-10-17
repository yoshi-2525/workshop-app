import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '@/components/ui/styles'
import {
  AboutDialogueIllustration,
  AboutDoorIllustration,
  AboutHeroIllustration,
  AboutUneaseIllustration,
  PaceIcon,
  TitleIcon,
  WordsIcon,
} from '@/pages/guide/AboutIllustrations'

const VALUES: { title: string; body: string; Icon: ComponentType }[] = [
  {
    title: '言葉がままならなくてもいい',
    body: '整理された言葉で話さなくても大丈夫です。モヤモヤしたままでも、自分の言葉で話してみてください。参加者はそのままのあなたの言葉をありのままに受け容れてくれます。',
    Icon: WordsIcon,
  },
  {
    title: '無理に話さなくてもいい',
    body: '無理に話そうとしなくても大丈夫です。自分が話したいと思ったときに、話したいことを自分のペースで話してみてください。もちろん、聞いているだけでも大丈夫です。',
    Icon: PaceIcon,
  },
  {
    title: '肩書はどこかに置いてくる',
    body: '対話の場では、年齢や地位、職業などは関係ありません。経歴や肩書から少しばかり離れて、ひとりの人として話してみてください。その場で呼ばれたい名前を決めて、対話をお楽しみください。',
    Icon: TitleIcon,
  },
]

const SECTION_HEADING_CLASS = 'font-brand text-xl font-semibold tracking-wider text-fg'
const BODY_CLASS = 'mt-4 leading-loose text-fg-secondary'

// TAIWA について(/about)。サービスのコンセプトを、トップのヒーローと同じ夜の空気感の読みものとして伝える。
// 各節にカバー画像と同じ描き方のイラストを添える(狭い画面では本文の下に置く)
export function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl py-8 sm:py-12">
      <div className="text-left">
        <p className="text-sm tracking-[0.25em] text-fg-muted">TAIWA について</p>
        <h1 className="mt-5 font-brand text-3xl font-semibold leading-snug tracking-widest text-fg sm:text-4xl sm:leading-snug">
          少人数での対話を通して
          <br />
          心のモヤモヤを掬う場所
        </h1>
      </div>
      <div className="mt-10">
        <AboutHeroIllustration />
      </div>

      <section
        aria-labelledby="about-unease"
        className="mt-16 grid items-center gap-8 sm:mt-20 md:grid-cols-[1fr_320px] md:gap-11"
      >
        <div>
          <h2 id="about-unease" className={SECTION_HEADING_CLASS}>
            なんとなく感じる心のモヤモヤ
          </h2>
          <p className={BODY_CLASS}>
            仕事も生活も通常通りに営むことができる。でもふとした瞬間に心の中にモヤモヤが生まれる。
            「みんなと同じような人生が何となくつまらない…」、「みんなが楽しめるものを純粋に楽しめない…」
            そんな違和感は、うまく言葉にできない。誰かに話してみても、きっとわかってもらえない。そんなふうに感じて、心の中にしまってしまう。
          </p>
        </div>
        <AboutUneaseIllustration />
      </section>

      <section
        aria-labelledby="about-what"
        className="mt-16 grid items-center gap-8 sm:mt-20 md:grid-cols-[320px_1fr] md:gap-11"
      >
        {/* 本文を先に読めるよう、狭い画面ではイラストを本文の下に回す */}
        <div className="md:order-2">
          <h2 id="about-what" className={SECTION_HEADING_CLASS}>
            その違和感をみんなで話しあえる場所
          </h2>
          <p className={BODY_CLASS}>
            TAIWAは、少人数の対話型ワークショップを探し、参加できるサービスです。
            <br />
            「働くこと」「人と話すこと」など、日常にはさまざまな問いが生まれます。
            TAIWAではその問いと向き合い、同じように心に違和感を抱える人とじっくり言葉を交わします。
          </p>
          <p className={BODY_CLASS}>
            話すことで、自分でも気づいていなかった思いに気づいたり、誰かの言葉を聞くことで、自分のモヤモヤを少し違った角度から見つめたり。
            そんな対話を通して、心の中にあるモヤモヤを、少しずつ言葉にして掬っていきます。
          </p>
        </div>
        <div className="md:order-1">
          <AboutDialogueIllustration />
        </div>
      </section>

      <section aria-labelledby="about-values" className="mt-20 sm:mt-24">
        <h2 id="about-values" className={SECTION_HEADING_CLASS}>
          大切にしていること
        </h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-3">
          {VALUES.map(({ title, body, Icon }) => (
            <li key={title} className="rounded-lg bg-surface-muted px-5 py-6 shadow-card">
              <Icon />
              <h3 className="mt-3 font-semibold text-fg">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-secondary">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="about-first"
        className="mt-20 grid items-center gap-6 rounded-xl border border-border-muted bg-linear-to-br from-surface to-surface-muted p-6 sm:mt-24 sm:grid-cols-[120px_1fr] sm:gap-8 sm:p-9"
      >
        <div className="flex justify-center">
          <AboutDoorIllustration />
        </div>
        <div>
          <h2 id="about-first" className={SECTION_HEADING_CLASS}>
            はじめての方へ
          </h2>
          <p className={BODY_CLASS}>
            気になる対話を見つけたら、まずは詳細をのぞいてみてください。
            参加の前に「対話のルール」にも目を通してもらえると、安心して当日を迎えられます。
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Link to="/rules" className={SECONDARY_BUTTON_CLASS}>
              対話のルールを読む
            </Link>
            <Link to="/" className={PRIMARY_BUTTON_CLASS}>
              対話をさがす
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
